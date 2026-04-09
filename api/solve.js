const https = require('https');
const { getUser } = require('./_supabase');
const { rateLimit } = require('./_ratelimit');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', 'https://notioai.net');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const authHeader = req.headers['authorization'] || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    const user = await getUser(token);
    if (!user) return res.status(401).json({ error: 'Oturum açmanız gerekiyor.' });

    const rl = rateLimit(`solve:${user.id}`, 10, 60 * 1000);
    if (!rl.allowed) return res.status(429).json({ error: 'Çok fazla istek. Bir dakika bekleyin.' });

    const body = req.body || {};
    const { question, options, correct, userAnswer } = body;

    if (!question || typeof question !== 'string' || question.length > 1000) {
      return res.status(400).json({ error: 'Geçersiz soru.' });
    }
    if (!options || typeof options !== 'object') {
      return res.status(400).json({ error: 'Geçersiz şıklar.' });
    }
    if (!correct || !['A','B','C','D'].includes(String(correct).toUpperCase())) {
      return res.status(400).json({ error: 'Geçersiz doğru cevap.' });
    }

    const GROQ_API_KEY = process.env.GROQ_API_KEY;
    if (!GROQ_API_KEY) return res.status(500).json({ error: 'API anahtarı eksik.' });

    const prompt = buildSolvePrompt(question, options, correct, userAnswer);
    const requestBody = JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 2000,
      temperature: 0.3,
    });

    const solution = await callGroq(GROQ_API_KEY, requestBody);
    if (!solution) return res.status(500).json({ error: 'Çözüm üretilemedi.' });

    return res.status(200).json({ solution });

  } catch (err) {
    return res.status(500).json({ error: err.message || 'Bilinmeyen hata' });
  }
};

function buildSolvePrompt(question, options, correct, userAnswer) {
  const optionsList = `A) ${options.a}\nB) ${options.b}\nC) ${options.c}\nD) ${options.d}`;
  const userStatus = !userAnswer
    ? 'Soruyu boş bıraktı'
    : userAnswer === correct
      ? `${userAnswer} seçti — Doğru`
      : `${userAnswer} seçti — Yanlış (Doğru cevap: ${correct})`;

  return `Sen bir Türk sınav hazırlık öğretmenisin. Öğrenciye bu soruyu adım adım çözerek öğret.

SORU: ${question}

ŞIKLAR:
${optionsList}

DOĞRU CEVAP: ${correct}
ÖĞRENCİ: ${userStatus}

GÖREV: Bu soruyu Türkçe olarak adım adım çöz. Şu formatı kullan:

**Sorunun İstediği:**
(Sorunun ne sorduğunu 1-2 cümle ile açıkla)

**Çözüm:**
(Adım adım çözüm — her adımı numaralandır, formüller ve hesaplamalar dahil)

**Neden ${correct} Doğru:**
(Doğru cevabı kısaca açıkla)

${userAnswer && userAnswer !== correct ? `**Neden ${userAnswer} Yanlış:**\n(Öğrencinin seçtiği yanlış şıkkı açıkla)\n` : ''}
**İpucu:**
(Bu tür soruları çözmek için kısa bir ipucu)

Açık, sade ve anlaşılır Türkçe kullan. Matematiksel ifadeler için standart gösterim kullan.`;
}

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
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.error) { reject(new Error(json.error.message || 'Groq API hatası')); return; }
          resolve(json.choices?.[0]?.message?.content || '');
        } catch {
          reject(new Error('Yanıt işlenemedi'));
        }
      });
    });

    req.on('error', err => reject(err));
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('İstek zaman aşımına uğradı.')); });
    req.write(body);
    req.end();
  });
}
