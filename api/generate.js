const https = require('https');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const body = req.body || {};
    const { topic, extraNotes, type, audience, pages, gradeLevel, language, tone, subject } = body;

    const GROQ_API_KEY = process.env.GROQ_API_KEY;

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

    const content = await callGroq(GROQ_API_KEY, requestBody);

    if (!content) {
      return res.status(500).json({ error: 'İçerik üretilemedi, tekrar deneyin.' });
    }

    return res.status(200).json({ content });

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
    tr: { name: 'Türkçe',   enforce: 'Tüm çıktıyı doğal, akıcı Türkçe ile yaz. Klişe giriş cümleleri ("Bu belgede...") kullanma.' },
    en: { name: 'English',  enforce: 'CRITICAL: The entire output MUST be in English only — including all headings, bullets, and explanations. The topic may be in Turkish but your response must be 100% English. No Turkish words anywhere.' },
    de: { name: 'Deutsch',  enforce: 'WICHTIG: Die gesamte Ausgabe muss auf Deutsch sein. Das Thema kann auf Türkisch sein, aber deine Antwort muss vollständig auf Deutsch sein. Kein Türkisch.' },
    fr: { name: 'Français', enforce: 'IMPORTANT: Toute la sortie doit être en français. Le sujet peut être en turc, mais votre réponse doit être entièrement en français. Pas de turc.' },
    ar: { name: 'العربية',  enforce: 'مهم: يجب أن يكون كل الناتج باللغة العربية فقط. الموضوع قد يكون بالتركية لكن إجابتك يجب أن تكون بالعربية الكاملة.' },
  };

  const langCfg = LANG_CONFIG[language] || LANG_CONFIG.tr;
  const notes   = extraNotes ? `\nAdditional instructions: ${extraNotes}` : '';

  const toneInstructions = {
    formal:   'Writing style: FORMAL and institutional. Short, precise sentences. No personal expressions. Passive constructions where appropriate. Professional vocabulary.',
    friendly: 'Writing style: FRIENDLY and warm. Active sentences, direct address. Encouraging, approachable language. Avoid overly technical terms.',
    academic: 'Writing style: ACADEMIC. Use subject-specific terminology correctly. Objective, evidence-based writing. Structured sections with clear headings. No colloquial language. Cite facts, use logical argumentation.',
    simple:   'Writing style: SIMPLE and clear. Short sentences, everyday language. If technical terms appear, explain them immediately in plain language.',
  };
  const toneStr = toneInstructions[tone] || toneInstructions.formal;

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
    gradeLabel  ? `Grade level: ${gradeLabel}` : '',
    subject     ? `Subject: ${subject}` : '',
    curriculumHint,
  ].filter(Boolean).join('\n');

  const isTeacher = audience === 'teacher';

  const audienceBlock = isTeacher
    ? `Hedef kullanıcı: ÖĞRETMEN
Materyal türüne göre format:
- Ders planı: Kazanımlar → Ön Bilgi Kontrolü → Öğretim Yöntemi → Etkinlikler → Değerlendirme
- Sınav/Test: Kolay/orta/zor soru dağılımı belirt, cevap anahtarı ekle
- Konu anlatımı: Kavramsal açıklama, sınıf içi tartışma soruları, öğretim ipuçları
Dil: Mesleki, net, uygulanabilir`
    : `Hedef kullanıcı: ÖĞRENCİ
Materyal türüne göre format:
- Konu özeti: Sade dil, temel kavramlar kutusu, akılda kalıcı örnekler
- Ödev/Proje: Adım adım yönlendirme, ipuçları
- Çalışma notu: Anahtar kavramlar listesi, kendi kendine test soruları
Dil: Anlaşılır, motive edici, öğrenci dostu`;

  /* ── PPTX ── */
  if (type === 'pptx') {
    const pptxAudience = isTeacher
      ? `- Slaytlar öğretmen sunumu için: her slaytta öğretim notu/ipucu ekle parantez içinde\n- Son slayt: Değerlendirme soruları veya tartışma noktaları`
      : `- Slaytlar öğrenci sunumu için: sade, görsel, akılda kalıcı\n- Son slayt: Temel kavramlar özeti veya hatırlatıcı sorular`;
    return `${langCfg.enforce}

${toneStr}

${audienceBlock}

${contextBlock}

IMPORTANT: Content must be appropriate for ${gradeLabel || 'the selected'} level only.

Prepare a ${pages}-slide presentation on: "${topic}".${notes}

${pptxAudience}

REQUIRED FORMAT:
SLAYT 1: [Title]
- [Subtitle]
- [${gradeLabel}]

SLAYT 2: [Section Title]
- [Bullet]
- [Bullet]
- [Bullet]

(continue up to ${pages} slides)

RULES:
- Each slide focuses on one topic, max 5 bullets
- Bullets short and concise (max 10 words)
- EXACTLY ${pages} slides
- ALL text in ${langCfg.name}
- No special characters, arrows or markdown symbols`;
  }

  /* ── PDF / WORD ── */
  return `${langCfg.enforce}

${toneStr}

${audienceBlock}

${contextBlock}

IMPORTANT: Content must be appropriate for ${gradeLabel || 'the selected'} level only.

Write a document on: "${topic}". Length: approximately ${pages} pages.${notes}

FORMAT:
# [Title]
## [Section]
[Content]

RULES:
- If exam/test: number questions sequentially from 1, add answer key at the end
- Write content only, no meta-commentary or pedagogical explanations
- Fill approximately ${pages} pages
- CRITICAL: ALL content must be written in ${langCfg.name} — no exceptions`;
}
