const https = require('https');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const body = req.body || {};
    const { text: rawText, fileName, language, summaryLength = 'medium', summaryStyle = 'simple' } = body;

    if (!rawText || !rawText.trim()) {
      return res.status(400).json({ error: 'Metin bulunamadı.' });
    }

    // Uzun belgeler için akıllı örnekleme: başından + ortasından + sonundan al
    const text = smartSample(rawText, 6000);

    const GROQ_API_KEY = process.env.GROQ_API_KEY;
    if (!GROQ_API_KEY) {
      return res.status(500).json({ error: 'API anahtarı eksik.' });
    }

    const maxTokens = summaryLength === 'short' ? 800 : summaryLength === 'long' ? 2500 : 1500;
    const prompt = buildSummaryPrompt(text, fileName, language, summaryLength, summaryStyle);

    const requestBody = JSON.stringify({
      model: 'llama-3.1-8b-instant',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: maxTokens,
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

/* ── Akıllı Metin Örnekleme ── */
function smartSample(text, maxChars) {
  if (text.length <= maxChars) return text;

  // Baştan 2500, ortadan 2000, sondan 1500 al
  const start  = text.slice(0, 2500);
  const mid    = text.slice(Math.floor(text.length / 2) - 1000, Math.floor(text.length / 2) + 1000);
  const end    = text.slice(-1500);

  return `${start}\n\n[...]\n\n${mid}\n\n[...]\n\n${end}`;
}

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
    req.setTimeout(25000, () => { req.destroy(); reject(new Error('İstek zaman aşımına uğradı.')); });
    req.write(body);
    req.end();
  });
}

/* ── Özet Prompt ── */
function buildSummaryPrompt(text, fileName, language, summaryLength, summaryStyle) {
  const isTr = language !== 'en';
  const fileLabel = fileName ? ` ("${fileName}")` : '';

  const lengthInstr = isTr
    ? ({ short: '1–2 paragraf kısa özet yaz.', medium: '3–5 paragraf orta uzunlukta kapsamlı özet yaz.', long: 'Tüm bölümleri detaylı şekilde ele alan uzun ve kapsamlı bir özet yaz (10–15 paragraf).' })[summaryLength] || ''
    : ({ short: 'Write a brief 1–2 paragraph summary.', medium: 'Write a comprehensive 3–5 paragraph summary.', long: 'Write a detailed, long-form summary covering all sections (10–15 paragraphs).' })[summaryLength] || '';

  const styleInstr = isTr
    ? ({ academic: 'Akademik, bilimsel ve resmi bir dil kullan.', simple: 'Sade, anlaşılır ve akıcı bir dil kullan.', bullet: 'Madde madde liste formatında yaz, cümle kurmak yerine maddeler halinde özetle.' })[summaryStyle] || ''
    : ({ academic: 'Use academic, formal, and scientific language.', simple: 'Use plain, clear, and accessible language.', bullet: 'Write in bullet-point format, summarizing as concise items rather than full sentences.' })[summaryStyle] || '';

  const sections = isTr
    ? `Özet şu bölümleri içersin:\n- Ana Konu\n- Temel Bulgular\n- Yöntem (varsa)\n- Sonuç ve Öneriler\n- Anahtar Kavramlar`
    : `The summary should include:\n- Main Topic\n- Key Findings\n- Methodology (if present)\n- Conclusion and Recommendations\n- Key Concepts`;

  const intro = isTr
    ? `Aşağıdaki akademik makale veya belgeyi${fileLabel} Türkçe olarak özetle.`
    : `Summarize the following academic paper or document${fileLabel} in English.`;

  const docLabel = isTr ? 'Belge metni' : 'Document text';

  return `${intro}

${lengthInstr} ${styleInstr}

${sections}

${docLabel}:
${text}`;
}
