const https = require('https');
const { getUser, getProfile, checkExamLimit, incrementExam } = require('./_supabase');
const { rateLimit } = require('./_ratelimit');

const VALID_EXAM_TYPES = ['tyt', 'ayt', 'lgs', 'genel'];
const VALID_DIFFICULTIES = ['easy', 'medium', 'hard', 'mixed'];

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

    const rl = rateLimit(`exam:${user.id}`, 5, 60 * 1000);
    if (!rl.allowed) return res.status(429).json({ error: 'Çok fazla istek gönderdiniz. Lütfen bir dakika bekleyin.' });

    const body = req.body || {};
    const { examType, subject, topic, questionCount: rawCount, difficulty } = body;

    if (!VALID_EXAM_TYPES.includes(examType)) {
      return res.status(400).json({ error: 'Geçersiz sınav türü.' });
    }
    if (!subject || String(subject).trim().length < 2) {
      return res.status(400).json({ error: 'Ders seçimi zorunludur.' });
    }
    if (String(subject).length > 60) {
      return res.status(400).json({ error: 'Geçersiz ders adı.' });
    }
    if (topic && String(topic).length > 200) {
      return res.status(400).json({ error: 'Konu çok uzun (max 200 karakter).' });
    }
    if (difficulty && !VALID_DIFFICULTIES.includes(difficulty)) {
      return res.status(400).json({ error: 'Geçersiz zorluk seviyesi.' });
    }

    const questionCount = Math.min(Math.max(parseInt(rawCount, 10) || 10, 5), 40);

    const profile = await getProfile(user.id);
    const limitCheck = checkExamLimit(profile, questionCount);
    if (!limitCheck.allowed) {
      return res.status(429).json({ error: limitCheck.message, code: limitCheck.code });
    }

    const GROQ_API_KEY = process.env.GROQ_API_KEY;
    if (!GROQ_API_KEY) return res.status(500).json({ error: 'API anahtarı eksik.' });

    const prompt = buildExamPrompt(examType, subject, topic, questionCount, difficulty);

    const requestBody = JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 6000,
      temperature: 0.8,
    });

    const rawContent = await callGroq(GROQ_API_KEY, requestBody);
    if (!rawContent) return res.status(500).json({ error: 'İçerik üretilemedi, tekrar deneyin.' });

    const questions = parseQuestions(rawContent);
    if (!questions || questions.length === 0) {
      return res.status(500).json({ error: 'Sorular ayrıştırılamadı, tekrar deneyin.' });
    }

    await incrementExam(user.id, profile).catch(() => {});

    return res.status(200).json({ questions });

  } catch (err) {
    return res.status(500).json({ error: err.message || 'Bilinmeyen hata' });
  }
};

function buildExamPrompt(examType, subject, topic, count, difficulty) {
  const examLabels = { tyt: 'TYT', ayt: 'AYT', lgs: 'LGS', genel: 'Genel' };
  const diffLabels = { easy: 'kolay', medium: 'orta', hard: 'zor', mixed: 'karışık (kolay/orta/zor)' };
  const examLabel = examLabels[examType] || 'Genel';
  const diffLabel = diffLabels[difficulty] || 'orta';
  const topicStr = topic ? `Konu: ${topic}` : `(${subject} dersinin genel konularından seç)`;

  const examples = getExamples(examType, subject);

  return `Sen bir Türk sınav hazırlık uzmanısın. ${examLabel} sınavına hazırlanan öğrenciler için ${subject} dersi çoktan seçmeli sorular üretiyorsun.

${examples ? `ÖRNEK SORULAR (bu tarz ve zorlukta sorular üret, aynı soruları kopyalama):\n${examples}\n` : ''}

GÖREV: ${examLabel} tarzında, ${subject} dersinden, ${topicStr}, zorluk: ${diffLabel}, TAM OLARAK ${count} adet çoktan seçmeli soru üret.

KRİTİK KURALLAR:
- Her soru için mutlaka A, B, C, D şıkları olsun
- Doğru cevap A, B, C veya D olsun
- Her soruya kısa (1-3 cümle) Türkçe çözüm açıklaması yaz
- Sorular Türkçe olsun
- TAM OLARAK ${count} soru üret, ne eksik ne fazla
- Örnek soruları kopyalama, sadece tarzını al

ZORUNLU ÇIKTI FORMATI (başka hiçbir şey yazma, sadece JSON):
[
  {
    "q": "Soru metni",
    "a": "A şıkkı metni",
    "b": "B şıkkı metni",
    "c": "C şıkkı metni",
    "d": "D şıkkı metni",
    "correct": "B",
    "explanation": "Çözüm açıklaması"
  }
]`;
}

function getExamples(examType, subject) {
  const examples = {
    tyt: {
      'Matematik': `S: Bir sayının %25'i 15 ise, bu sayının %60'ı kaçtır?
A) 30  B) 36  C) 42  D) 45
Cevap: B — Sayı = 15 × 4 = 60. %60'ı = 36.

S: 3x + 7 = 22 denkleminin çözümü kaçtır?
A) 3  B) 4  C) 5  D) 6
Cevap: C — 3x = 15, x = 5.`,

      'Türkçe': `S: Aşağıdaki cümlelerin hangisinde altı çizili sözcük ad tamlamasının tamlananıdır?
A) Annemin gözleri doldu.  B) Çocukların sesi kesildi.  C) Bahçenin kapısı açık.  D) Masanın üstü temiz.
Cevap: C

S: "Söz gümüşse sükut altındır" atasözündeki söz sanatı nedir?
A) Kişileştirme  B) Benzetme  C) Abartma  D) Tezat
Cevap: B`,

      'default': `S: Aşağıdakilerden hangisi TYT ${subject} konularından biri değildir?
A) Temel kavramlar  B) Uygulama soruları  C) İleri düzey analiz  D) Kısa sorular
Cevap: C`,
    },
    ayt: {
      'Matematik': `S: f(x) = x² - 3x + 2 fonksiyonunun x = 2 noktasındaki türevi nedir?
A) 0  B) 1  C) 2  D) 3
Cevap: B — f'(x) = 2x - 3. f'(2) = 4 - 3 = 1.

S: ∫(2x + 3)dx ifadesinin belirsiz integrali nedir?
A) x² + 3x + C  B) 2x² + 3x + C  C) x² + C  D) 2x + C
Cevap: A`,

      'Fizik': `S: Yatay atılan bir cisim 5 saniyede yere düşüyorsa, düşme yüksekliği yaklaşık kaç metredir? (g=10 m/s²)
A) 50  B) 100  C) 125  D) 250
Cevap: C — h = ½gt² = ½×10×25 = 125 m.`,

      'default': `S: AYT ${subject} kapsamındaki temel bir kavramla ilgili soru.
A) Seçenek 1  B) Seçenek 2  C) Seçenek 3  D) Seçenek 4
Cevap: A`,
    },
    lgs: {
      'Matematik': `S: 2⁴ × 3² işleminin sonucu kaçtır?
A) 24  B) 48  C) 144  D) 216
Cevap: C — 16 × 9 = 144.

S: Bir dikdörtgenin uzun kenarı kısa kenarının 3 katıdır. Çevresi 32 cm ise kısa kenar kaç cm'dir?
A) 4  B) 6  C) 8  D) 10
Cevap: A — 2(x + 3x) = 32, 8x = 32, x = 4.`,

      'Türkçe': `S: "Kitap okumak insanı zenginleştirir" cümlesinde "zenginleştirir" fiilinin yapısı nedir?
A) Basit  B) Türemiş  C) Birleşik  D) Öbekleşmiş
Cevap: B`,

      'Fen Bilimleri': `S: Hücre bölünmesi sırasında DNA eşlenmesi hangi aşamada gerçekleşir?
A) Profaz  B) Metafaz  C) İnterfaz  D) Anafaz
Cevap: C`,

      'default': `S: LGS ${subject} konusuyla ilgili temel soru.
A) Seçenek 1  B) Seçenek 2  C) Seçenek 3  D) Seçenek 4
Cevap: A`,
    },
    genel: {
      'default': `S: ${subject} dersine ait temel bir kavramsal soru.
A) Doğru ifade  B) Yanlış ifade 1  C) Yanlış ifade 2  D) Yanlış ifade 3
Cevap: A`,
    },
  };

  const examExamples = examples[examType] || examples.genel;
  return examExamples[subject] || examExamples['default'] || '';
}

function parseQuestions(raw) {
  try {
    // JSON array bul
    const match = raw.match(/\[[\s\S]*\]/);
    if (!match) return null;
    const arr = JSON.parse(match[0]);
    if (!Array.isArray(arr)) return null;

    return arr.filter(q =>
      q && typeof q.q === 'string' &&
      typeof q.a === 'string' && typeof q.b === 'string' &&
      typeof q.c === 'string' && typeof q.d === 'string' &&
      typeof q.correct === 'string' && typeof q.explanation === 'string'
    ).map(q => ({
      q: q.q.trim(),
      a: q.a.trim(), b: q.b.trim(), c: q.c.trim(), d: q.d.trim(),
      correct: q.correct.toUpperCase().trim(),
      explanation: q.explanation.trim(),
    }));
  } catch {
    return null;
  }
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
        } catch (e) {
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
