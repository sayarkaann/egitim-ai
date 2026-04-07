const https = require('https');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const body = req.body || {};
    const { text: rawText, fileName, language } = body;

    if (!rawText || !rawText.trim()) {
      return res.status(400).json({ error: 'Metin bulunamadı.' });
    }

    // ~3000 token sınırı için metni kırp (1 token ≈ 4 karakter)
    const text = rawText.slice(0, 12000);

    const GROQ_API_KEY = process.env.GROQ_API_KEY;

    if (!GROQ_API_KEY) {
      return res.status(500).json({ error: 'API anahtarı eksik.' });
    }

    const prompt = buildSummaryPrompt(text, fileName, language);

    const requestBody = JSON.stringify({
      model: 'llama-3.1-8b-instant',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 4096,
      temperature: 0.5,
    });

    const summary = await callGroq(GROQ_API_KEY, requestBody);

    if (!summary) {
      return res.status(500).json({ error: 'Özet üretilemedi, tekrar deneyin.' });
    }

    return res.status(200).json({ summary });

  } catch (err) {
    return res.status(500).json({ error: err.message || 'Bilinmeyen hata' });
  }
};

/* ── Groq API ── */
function callGroq(apiKey, body) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.groq.com',
      path: '/openai/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.error) { reject(new Error(json.error.message || 'Groq API hatası')); return; }
          resolve(json.choices?.[0]?.message?.content || '');
        } catch (e) {
          reject(new Error('Yanıt işlenemedi: ' + data.slice(0, 200)));
        }
      });
    });

    req.on('error', (err) => reject(err));
    req.setTimeout(9000, () => { req.destroy(); reject(new Error('İstek zaman aşımına uğradı.')); });
    req.write(body);
    req.end();
  });
}

/* ── Özet Prompt ── */
function buildSummaryPrompt(text, fileName, language) {
  const fileLabel = fileName ? ` ("${fileName}")` : '';
  const langNote = language === 'en'
    ? 'Summarize the following academic paper or document in English.'
    : 'Aşağıdaki akademik makale veya belgeyi Türkçe olarak özetle.';

  const sections = language === 'en'
    ? `The summary should include the following sections:
- Main Topic: (1-2 sentences)
- Key Findings: (bullet points, 5-8 items)
- Methodology: (if present, 1-2 sentences)
- Conclusion and Recommendations: (2-3 sentences)
- Key Concepts: (comma-separated list)`
    : `Özet şu bölümleri içersin:
- Ana Konu: (1-2 cümle)
- Temel Bulgular: (madde madde, 5-8 madde)
- Yöntem: (varsa, 1-2 cümle)
- Sonuç ve Öneriler: (2-3 cümle)
- Anahtar Kavramlar: (virgülle ayrılmış liste)`;

  const docLabel = language === 'en' ? 'Document text' : 'Belge metni';

  return `${langNote}${fileLabel}

${sections}

${docLabel}:
${text}`;
}
