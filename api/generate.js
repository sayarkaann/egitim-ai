const https = require('https');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const body = req.body || {};
    const { topic, extraNotes, type, audience, pages, gradeLevel, language, tone, subject, addVisuals } = body;

    const GROQ_API_KEY   = process.env.GROQ_API_KEY;
    const PEXELS_API_KEY = process.env.PEXELS_API_KEY;

    if (!GROQ_API_KEY) {
      return res.status(500).json({ error: 'API anahtarı eksik.' });
    }

    const prompt = buildPrompt(topic, extraNotes, type, audience, pages, gradeLevel, language, tone, subject);

    const requestBody = JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 8192,
      temperature: 0.7,
    });

    // Run AI generation + image fetch in parallel
    const [content, imageUrl] = await Promise.all([
      callGroq(GROQ_API_KEY, requestBody),
      (addVisuals && PEXELS_API_KEY)
        ? fetchPexelsImage(PEXELS_API_KEY, subject ? `${subject} ${topic}` : topic)
        : Promise.resolve(null),
    ]);

    if (!content) {
      return res.status(500).json({ error: 'İçerik üretilemedi, tekrar deneyin.' });
    }

    return res.status(200).json({ content, imageUrl });

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
    req.setTimeout(28000, () => { req.destroy(); reject(new Error('İstek zaman aşımına uğradı.')); });
    req.write(body);
    req.end();
  });
}

/* ── Pexels Image API ── */
function fetchPexelsImage(apiKey, query) {
  return new Promise((resolve) => {
    const path = `/v1/search?query=${encodeURIComponent(query)}&per_page=3&orientation=landscape&locale=tr-TR`;
    const options = {
      hostname: 'api.pexels.com',
      path,
      headers: { Authorization: apiKey },
    };
    https.get(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const photo = json.photos?.[0];
          resolve(photo?.src?.large || photo?.src?.medium || null);
        } catch {
          resolve(null);
        }
      });
    }).on('error', () => resolve(null));
  });
}

/* ── MEB Müfredat Haritası ── */
function getCurriculumHint(subject, gradeLevel) {
  const map = {
    'Matematik': {
      '5': 'Doğal sayılar, kesirler, ondalık sayılar, alan-çevre hesapları, temel geometri',
      '6': 'Tam sayılar, oran-orantı, yüzdeler, çember ve daire, veri toplama',
      '7': 'Rasyonel sayılar, denklemler, eşitsizlikler, üçgenler, istatistik',
      '8': 'Kareköklü sayılar, çarpanlara ayırma, ikinci dereceden denklemler, Pisagor teoremi, olasılık, LGS hazırlık soruları',
      '9': 'Kümeler, mantık, fonksiyonlar, polinomlar, trigonometri temelleri',
      '10': 'Logaritma, trigonometri, analitik geometri, olasılık',
      '11': 'Türev, integral temelleri, karmaşık sayılar, dizi-seri',
      '12': 'İntegral, TYT/AYT matematik soruları, limit ve süreklilik',
    },
    'Fen Bilimleri': {
      '5': 'Besin zinciri, madde ve değişim, kuvvet, ışık ve ses',
      '6': 'Hücre ve organeller, maddenin tanecikli yapısı, kuvvet ve hareket, elektrik',
      '7': 'Bitki ve hayvan hücreleri, saf madde-karışım, enerji dönüşümleri, basınç',
      '8': 'DNA ve genetik, hücre bölünmesi (mitoz/mayoz), kuvvet-hareket-enerji, sürtünme, basit makineler, asit-baz, elektrik yükleri, LGS fen soruları',
      '9': 'Bilimin doğası, kimyasal bağlar, hücre biyolojisi, kuvvet ve hareket yasaları',
    },
    'Türkçe': {
      '5': 'Okuma anlama, yazım kuralları, sözcük türleri, paragraf oluşturma',
      '6': 'Metin türleri, dil bilgisi (isim-sıfat-zarf), cümle bilgisi',
      '7': 'Anlatım biçimleri, söz sanatları, fiiller, bağlaçlar',
      '8': 'Yazılı ve sözlü anlatım türleri, dil bilgisi (cümle ögeleri, fiil çatısı, yapı), LGS Türkçe soru tipleri',
      '9': 'Türk dili tarihi, metin türleri, dil bilgisi, söylem analizi',
    },
    'İngilizce': {
      '5': 'Greetings, colors, numbers, family, daily routines — A1 level',
      '6': 'Present tense, school life, free time — A1-A2 level',
      '7': 'Past tense, travels, health — A2 level',
      '8': 'Present perfect, passive voice, technology, environment — B1 level, LGS English',
      '9': 'Grammar review, reading comprehension, B1-B2 level',
    },
    'Tarih': {
      '8': 'İnkılap Tarihi: Kurtuluş Savaşı, Atatürk dönemi reformları, çok partili hayata geçiş',
      '9': 'Tarih yazımı, uygarlıkların doğuşu, Türk ve dünya tarihi',
      '10': 'Osmanlı tarihi, dünya savaşları, Türkiye Cumhuriyeti tarihi',
      '11': 'Yakın dönem dünya tarihi, soğuk savaş, Türkiye\'nin modernleşmesi',
      '12': 'AYT Tarih konuları, çağdaş dünya tarihi',
    },
    'Coğrafya': {
      '9': 'Harita bilgisi, iklim, Türkiye\'nin fiziki coğrafyası',
      '10': 'Türkiye\'nin beşeri coğrafyası, nüfus, ekonomi',
      '11': 'Kıtalar coğrafyası, doğal afetler, çevre sorunları',
      '12': 'AYT Coğrafya, küresel sorunlar, bölgesel coğrafya',
    },
  };

  const subjectMap = map[subject] || {};
  const hint = subjectMap[gradeLevel];
  return hint ? `\nBu sınıf için müfredat konuları: ${hint}` : '';
}

function buildPrompt(topic, extraNotes, type, audience, pages, gradeLevel, language, tone, subject) {
  const LANG_CONFIG = {
    tr: { name: 'Türkçe', enforce: 'Belgeyi doğal, akıcı Türkçe ile yaz. Klişe giriş cümleleri ("Bu belgede...") kullanma.\n\n' },
    en: { name: 'English', enforce: 'CRITICAL: Write 100% in English. No Turkish anywhere.\n\n' },
    de: { name: 'Deutsch', enforce: 'Nur auf Deutsch schreiben. Kein Türkisch.\n\n' },
    fr: { name: 'Français', enforce: 'Écrivez entièrement en français. Pas de turc.\n\n' },
    ar: { name: 'العربية', enforce: 'اكتب بالعربية فقط. لا تركية.\n\n' },
  };

  const langCfg = LANG_CONFIG[language] || LANG_CONFIG.tr;
  const notes   = extraNotes ? `\nEk talimatlar: ${extraNotes}` : '';
  const toneMap = { formal: 'resmi', friendly: 'samimi', academic: 'akademik', simple: 'sade' };
  const toneStr = toneMap[tone] || 'resmi';

  // Grade level context
  const gradeLabels = {
    '1':'1. sınıf', '2':'2. sınıf', '3':'3. sınıf', '4':'4. sınıf',
    '5':'5. sınıf', '6':'6. sınıf', '7':'7. sınıf',
    '8':'8. sınıf (LGS hazırlık)',
    '9':'9. sınıf (Lise 1)', '10':'10. sınıf (Lise 2)',
    '11':'11. sınıf (Lise 3)', '12':'12. sınıf (YKS/TYT/AYT hazırlık)',
    'university':'Üniversite',
  };
  const gradeLabel = gradeLevel ? (gradeLabels[gradeLevel] || `${gradeLevel}. sınıf`) : '';
  const curriculumHint = getCurriculumHint(subject, gradeLevel);

  const contextBlock = [
    gradeLabel  ? `Sınıf: ${gradeLabel}` : '',
    subject     ? `Ders: ${subject}` : '',
    toneStr     ? `Ton: ${toneStr}` : '',
    curriculumHint,
  ].filter(Boolean).join('\n');

  /* ── PPTX ── */
  if (type === 'pptx') {
    return `${langCfg.enforce}${contextBlock}

UYARI: Sorular ve içerik YALNIZCA ${gradeLabel || 'seçilen'} seviyesine uygun olmalı. Daha basit sınıf konuları kullanma.

"${topic}" konusunda ${pages} slaytlık sunum hazırla.${notes}

ZORUNLU FORMAT:
SLAYT 1: [Başlık]
- [Alt başlık]
- [${gradeLabel}]

SLAYT 2: [Bölüm Başlığı]
- [Madde]
- [Madde]
- [Madde]

(${pages} slayta kadar devam et)

KURALLAR:
- Her slayt tek konuya odaklan, max 5 madde
- Maddeler kısa ve öz (max 10 kelime)
- TAM OLARAK ${pages} slayt
- Tüm metin ${langCfg.name} dilinde
- Özel karakter, ok işareti veya markdown sembolleri kullanma`;
  }

  /* ── PDF / WORD ── */
  return `${langCfg.enforce}${contextBlock}

UYARI: Sorular ve içerik YALNIZCA ${gradeLabel || 'seçilen'} seviyesine uygun olmalı. Daha basit veya daha zor sınıf konuları kullanma.

"${topic}" konusunda belge hazırla. Uzunluk: yaklaşık ${pages} sayfa.${notes}

FORMAT:
# [Başlık]
## [Bölüm]
[İçerik]

KURALLAR:
- Sınav ise: soruları numaralandır, en sona cevap anahtarı ekle
- Sadece içerik yaz, pedagojik açıklama veya meta-yorum ekleme
- ${pages} sayfa dolduracak kadar içerik üret
- Tüm içerik ${langCfg.name} dilinde`;
}
