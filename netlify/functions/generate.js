const https = require('https');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  };

  try {
    const body = JSON.parse(event.body);
    const { topic, extraNotes, type, audience, pages, gradeLevel, language, tone, subject } = body;

    const GROQ_API_KEY = process.env.GROQ_API_KEY;
    if (!GROQ_API_KEY) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'API anahtarı eksik.' }) };
    }

    const prompt = buildPrompt(topic, extraNotes, type, audience, pages, gradeLevel, language, tone, subject);

    const requestBody = JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 8192,
      temperature: 0.7,
    });

    const content = await callGroq(GROQ_API_KEY, requestBody);

    if (!content) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'İçerik üretilemedi, tekrar deneyin.' }) };
    }

    return { statusCode: 200, headers, body: JSON.stringify({ content }) };

  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message || 'Bilinmeyen hata' }) };
  }
};

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
    req.setTimeout(28000, () => { req.destroy(); reject(new Error('İstek zaman aşımına uğradı.')); });
    req.write(body);
    req.end();
  });
}

function buildPrompt(topic, extraNotes, type, audience, pages, gradeLevel, language, tone, subject) {
  // Language configuration — output language enforcement
  const LANG_CONFIG = {
    tr: { name: 'Turkish',  enforce: 'DİL TALİMATI: Belgeyi doğal, akıcı pedagojik Türkçe ile yaz. Makine çevirisi tarzı ifadeler, klişe giriş cümleleri ("Bu belgede...", "Bu derste...") ve tekrar eden kalıplardan kaçın. Öğretmenin sınıfta kullanacağı gerçekçi, uygulanabilir bir dil kullan.\n\n' },
    en: { name: 'English',  enforce: 'CRITICAL REQUIREMENT: You MUST write 100% of this document in English. Every single word, heading, bullet, and sentence must be in English. Absolutely no Turkish allowed anywhere in the response.\n\n' },
    de: { name: 'German',   enforce: 'WICHTIGE ANFORDERUNG: Das gesamte Dokument muss ausschließlich auf Deutsch verfasst werden. Kein Wort Türkisch im gesamten Text.\n\n' },
    fr: { name: 'French',   enforce: 'EXIGENCE CRITIQUE: Rédigez l\'intégralité de ce document en français. Aucun mot en turc n\'est autorisé.\n\n' },
    ar: { name: 'Arabic',   enforce: 'متطلب حرج: يجب كتابة هذا المستند بالكامل باللغة العربية. لا يسمح بأي كلمة تركية.\n\n' },
  };

  const langCfg  = LANG_CONFIG[language] || LANG_CONFIG.tr;
  const isTeacher = audience === 'teacher';
  const gradeStr  = gradeLevel ? `grade ${gradeLevel}` : 'general level';
  const subjectStr = subject ? `${subject}, ` : '';
  const notes    = extraNotes ? `\nExtra instructions: ${extraNotes}` : '';

  const toneMap  = { formal: 'formal', friendly: 'friendly and engaging', academic: 'academic', simple: 'simple and accessible' };
  const toneStr  = toneMap[tone] || 'formal';

  // Grade level → Turkish MEB curriculum context
  const gradeContextMap = {
    '1': '1. sınıf (6-7 yaş, temel okuma-yazma seviyesi)',
    '2': '2. sınıf (7-8 yaş)',
    '3': '3. sınıf (8-9 yaş)',
    '4': '4. sınıf (9-10 yaş)',
    '5': '5. sınıf (10-11 yaş, ortaokul başlangıcı)',
    '6': '6. sınıf (11-12 yaş)',
    '7': '7. sınıf (12-13 yaş)',
    '8': '8. sınıf (13-14 yaş, LGS hazırlık dönemi)',
    '9': '9. sınıf (14-15 yaş, lise 1)',
    '10': '10. sınıf (15-16 yaş, lise 2)',
    '11': '11. sınıf (16-17 yaş, lise 3)',
    '12': '12. sınıf (17-18 yaş, YKS/TYT/AYT hazırlık)',
    'university': 'Üniversite seviyesi',
  };
  const gradeCtx = gradeLevel ? (gradeContextMap[gradeLevel] || `${gradeLevel}. sınıf`) : 'genel seviye';
  const gradeStr = gradeLevel ? `${gradeCtx}` : 'genel seviye';
  const subjectStr = subject ? `${subject} dersi, ` : '';

  const depthBlock = `KONU VE SEVİYE: ${subjectStr}${gradeStr}.
Belge tamamen bu sınıf seviyesine uygun olmalı: dil, soru zorluğu, kavramlar ve örnekler ${gradeCtx} için uygun olsun. Türkiye MEB müfredatını esas al.`;

  const langNote = `OUTPUT LANGUAGE: ${langCfg.name}. Write everything in ${langCfg.name}.`;

  /* ── PPTX ── */
  if (type === 'pptx') {
    return `${langCfg.enforce}${depthBlock}

${langNote}

"${topic}" konusunda ${pages} slaytlık bir sunum hazırla.
${notes}

ZORUNLU FORMAT (değiştirme):
SLAYT 1: [Başlık]
- [Alt başlık]
- [Sınıf/seviye bilgisi]

SLAYT 2: [Bölüm Başlığı]
- [Madde — max 12 kelime]
- [Madde — max 12 kelime]
- [Madde — max 12 kelime]

(tüm ${pages} slayt bu formatta devam eder)

KURALLAR:
- Her slayt tek konuya odaklan
- Slaytta maksimum 5 madde, tercihen 3-4
- SLAYT 1 = kapak slaytı
- Son slayt = özet veya sorular
- TAM OLARAK ${pages} slayt üret
- Tüm metin ${langCfg.name} dilinde`;
  }

  /* ── PDF / WORD ── */
  return `${langCfg.enforce}${depthBlock}

${langNote}

"${topic}" konusunda bir belge hazırla. Hedef uzunluk: yaklaşık ${pages} sayfa.
${notes}

FORMAT:
# [Belge Başlığı]

## [Bölüm 1]
[İçerik]

## [Bölüm 2]
[İçerik]

KURALLAR:
- Sınav/test ise: soruları numaralandır, en sona cevap anahtarı koy
- Sadece belge içeriğini yaz — açıklama, yorum veya pedagojik not ekleme
- Yaklaşık ${pages} sayfayı dolduracak kadar içerik üret
- Tüm içerik ${langCfg.name} dilinde olmalı`;
}
