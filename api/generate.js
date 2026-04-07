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

/* ── OpenAI API ── */
function callOpenAI(apiKey, body) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.openai.com',
      path: '/v1/chat/completions',
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
          if (json.error) { reject(new Error(json.error.message || 'OpenAI API hatası')); return; }
          resolve(json.choices?.[0]?.message?.content || '');
        } catch (e) {
          reject(new Error('Yanıt işlenemedi: ' + data.slice(0, 200)));
        }
      });
    });

    req.on('error', (err) => reject(err));
    req.setTimeout(55000, () => { req.destroy(); reject(new Error('İstek zaman aşımına uğradı.')); });
    req.write(body);
    req.end();
  });
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
    req.setTimeout(9000, () => { req.destroy(); reject(new Error('İstek zaman aşımına uğradı.')); });
    req.write(body);
    req.end();
  });
}

/* ── MEB Müfredat Haritası ── */
function getCurriculumHint(subject, gradeLevel) {
  const map = {
    'Matematik': {
      '1': 'Sayılar (1-20), toplama-çıkarma, şekiller, ölçme',
      '2': 'Sayılar (1-100), dört işlem temelleri, uzunluk-ağırlık ölçme',
      '3': 'Çarpma-bölme, kesirler (yarım-çeyrek), geometrik şekiller',
      '4': 'Büyük sayılar, kesirler, ondalık sayılara giriş, alan ölçme',
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
      '3': 'Duyu organları, canlı-cansız varlıklar, madde ve ısı, yer kabuğu',
      '4': 'Besinler ve sindirim, maddenin halleri, kuvvet ve hareket, elektrik',
      '5': 'Besin zinciri, madde ve değişim, kuvvet, ışık ve ses',
      '6': 'Hücre ve organeller, maddenin tanecikli yapısı, kuvvet ve hareket, elektrik',
      '7': 'Bitki ve hayvan hücreleri, saf madde-karışım, enerji dönüşümleri, basınç',
      '8': 'DNA ve genetik, hücre bölünmesi (mitoz/mayoz), kuvvet-hareket-enerji, sürtünme, basit makineler, asit-baz, elektrik yükleri, LGS fen soruları',
    },
    'Fizik': {
      '9': 'Fizik bilimine giriş, madde ve özellikleri, hareket, kuvvet, enerji',
      '10': 'Elektrik ve manyetizma, dalgalar, optik, basınç',
      '11': 'Elektrik, manyetizma, modern fizik temelleri, çembersel hareket',
      '12': 'AYT Fizik: elektrik, manyetizma, dalgalar, çağdaş fizik',
    },
    'Kimya': {
      '9': 'Kimyanın temel kavramları, atom yapısı, periyodik tablo, kimyasal bağlar',
      '10': 'Mol kavramı, kimyasal reaksiyonlar, çözeltiler, asit-baz',
      '11': 'Organik kimya temelleri, reaksiyon hızı, kimyasal denge',
      '12': 'AYT Kimya: elektrokimya, organik kimya, kimyasal hesaplamalar',
    },
    'Biyoloji': {
      '9': 'Canlıların ortak özellikleri, hücre, canlıların sınıflandırılması, ekosistem',
      '10': 'Hücre bölünmeleri, kalıtım, biyoteknoloji, bitki biyolojisi',
      '11': 'Sinir sistemi, duyu organları, hormonlar, üreme ve gelişme, bağışıklık',
      '12': 'AYT Biyoloji: genden proteine, canlılar arası ilişkiler, komünite ekolojisi',
    },
    'Türkçe': {
      '1': 'Okuma-yazma, ses-harf ilişkisi, basit cümleler',
      '2': 'Metin okuma, sözcük bilgisi, noktalama işaretleri',
      '3': 'Metin türleri (şiir-hikaye), sözcük türleri, anlam bilgisi',
      '4': 'Okuduğunu anlama, dil bilgisi (isim-sıfat), yazılı anlatım',
      '5': 'Okuma anlama, yazım kuralları, sözcük türleri, paragraf oluşturma',
      '6': 'Metin türleri, dil bilgisi (isim-sıfat-zarf), cümle bilgisi',
      '7': 'Anlatım biçimleri, söz sanatları, fiiller, bağlaçlar',
      '8': 'Yazılı ve sözlü anlatım türleri, dil bilgisi (cümle ögeleri, fiil çatısı, yapı), LGS Türkçe soru tipleri',
      '9': 'Türk dili tarihi, metin türleri, dil bilgisi, söylem analizi',
      '10': 'Şiir, roman, tiyatro türleri; Tanzimat ve Servet-i Fünun edebiyatı',
      '11': 'Milli Edebiyat, Cumhuriyet dönemi edebiyatı, eleştiri türleri',
      '12': 'TYT/AYT Türkçe: paragraf soruları, dil bilgisi, anlam bilgisi',
    },
    'Türk Dili ve Edebiyatı': {
      '9': 'Türkçenin tarihi gelişimi, İslamiyet öncesi Türk edebiyatı, divan edebiyatı temelleri',
      '10': 'Divan edebiyatı, halk edebiyatı, Tanzimat edebiyatı',
      '11': 'Servet-i Fünun, Fecr-i Ati, Milli Edebiyat dönemi',
      '12': 'Cumhuriyet dönemi edebiyatı, AYT Edebiyat hazırlık',
    },
    'İngilizce': {
      '2': 'Greetings, numbers 1-10, colors, classroom objects — A1 level',
      '3': 'Family members, animals, daily routines — A1 level',
      '4': 'Food and drinks, weather, hobbies — A1 level',
      '5': 'Greetings, colors, numbers, family, daily routines — A1 level',
      '6': 'Present tense, school life, free time — A1-A2 level',
      '7': 'Past tense, travels, health — A2 level',
      '8': 'Present perfect, passive voice, technology, environment — B1 level, LGS English',
      '9': 'Grammar review, reading comprehension, B1-B2 level',
      '10': 'Reported speech, conditionals, vocabulary expansion — B2 level',
      '11': 'Advanced grammar, essay writing, academic vocabulary — B2 level',
      '12': 'TYT/AYT İngilizce: reading comprehension, grammar, vocabulary',
    },
    'Tarih': {
      '5': 'Tarih bilimine giriş, Türklerin anayurdu, ilk Türk devletleri',
      '6': 'İlk Müslüman Türk devletleri, Anadolu\'nun Türkleşmesi, Moğol istilası',
      '7': 'Osmanlı Devleti\'nin kuruluşu ve yükseliş dönemi',
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
    'Sosyal Bilgiler': {
      '4': 'Birey ve toplum, aile, üretim-tüketim, coğrafi özellikler',
      '5': 'Bireysel gelişim, Türk tarihi ve kültürü, ülkemiz ve dünya',
      '6': 'Sosyal bilgiler ve toplum, ekonomi, tarih, coğrafya ilişkisi',
      '7': 'İletişim ve insan ilişkileri, Türkiye\'de nüfus, Türk kültürü',
    },
    'Din Kültürü': {
      '4': 'İslam\'ın temelleri, Hz. Muhammed\'in hayatı, ibadet',
      '5': 'Kur\'an, peygamberler, ahlak değerleri',
      '6': 'İslam\'ın inanç esasları, ibadetler, Hz. Muhammed\'in hayatı',
      '7': 'Ahlak, değerler, dini bilgiler, İslam tarihi',
      '8': 'İslam medeniyeti, gençlik ve değerler, LGS Din soruları',
      '9': 'Din, kültür ve medeniyet; İslam ve diğer dinler',
      '10': 'İbadetler, ahlak, İslam tarihi ve medeniyeti',
      '11': 'Din, birey ve toplum; çağdaş dünyada din',
      '12': 'TYT Din Kültürü: inanç esasları, ibadetler, Hz. Muhammed',
    },
    'Felsefe': {
      '10': 'Felsefenin temel kavramları, bilgi felsefesi, varlık felsefesi',
      '11': 'Ahlak felsefesi, siyaset felsefesi, din felsefesi, estetik',
      '12': 'AYT Felsefe: epistemoloji, ontoloji, etik, sistematik felsefe',
    },
    'Matematik (İlkokul)': {
      '1': 'Sayılar (1-20), toplama-çıkarma, şekiller, ölçme',
      '2': 'Sayılar (1-100), dört işlem temelleri, uzunluk-ağırlık ölçme',
      '3': 'Çarpma-bölme, kesirler (yarım-çeyrek), geometrik şekiller',
      '4': 'Büyük sayılar, kesirler, ondalık sayılara giriş, alan ölçme',
    },
  };

  const subjectMap = map[subject] || {};
  const hint = subjectMap[gradeLevel];
  return hint ? `\nBu sınıf için müfredat konuları: ${hint}` : '';
}

function buildPrompt(topic, extraNotes, type, audience, pages, gradeLevel, language, tone, subject) {
  const LANG_CONFIG = {
    tr: { name: 'Türkçe',   enforce: 'KRİTİK: Tüm çıktı YALNIZCA Türkçe olmalıdır. Başlıklar, maddeler, açıklamalar dahil hiçbir yerde İngilizce veya başka yabancı dil kullanma. Klişe giriş cümleleri ("Bu belgede...", "In this document...") kullanma.' },
    en: { name: 'English',  enforce: 'CRITICAL: The entire output MUST be in English only — including all headings, bullets, and explanations. The topic may be in Turkish but your response must be 100% English. No Turkish words anywhere.' },
    de: { name: 'Deutsch',  enforce: 'WICHTIG: Die gesamte Ausgabe muss auf Deutsch sein. Das Thema kann auf Türkisch sein, aber deine Antwort muss vollständig auf Deutsch sein. Kein Türkisch.' },
    fr: { name: 'Français', enforce: 'IMPORTANT: Toute la sortie doit être en français. Le sujet peut être en turc, mais votre réponse doit être entièrement en français. Pas de turc.' },
    ar: { name: 'العربية',  enforce: 'مهم: يجب أن يكون كل الناتج باللغة العربية فقط. الموضوع قد يكون بالتركية لكن إجابتك يجب أن تكون بالعربية الكاملة.' },
    es: { name: 'Español',  enforce: 'IMPORTANTE: Todo el contenido debe estar en español únicamente. El tema puede estar en turco pero tu respuesta debe ser 100% en español.' },
    ru: { name: 'Русский',  enforce: 'ВАЖНО: Весь контент должен быть исключительно на русском языке. Тема может быть на турецком, но ответ должен быть полностью на русском.' },
  };

  const langCfg = LANG_CONFIG[language] || LANG_CONFIG.tr;
  const notes   = extraNotes ? `\nAdditional instructions: ${extraNotes}` : '';

  const toneInstructions = {
    tr: {
      formal:   'Yazım tonu: RESMİ ve kurumsal. Kısa, net cümleler. Kişisel ifade kullanma. Mesleki kelime dağarcığı.',
      friendly: 'Yazım tonu: SAMIMI ve sıcak. Etkin cümleler, doğrudan hitap. Teşvik edici, yaklaşılabilir dil. Aşırı teknik terimlerden kaçın.',
      academic: 'Yazım tonu: AKADEMİK. Konuya özgü terminolojiyi doğru kullan. Nesnel, kanıta dayalı yazım. Açık başlıklarla yapılandırılmış bölümler. Konuşma dili kullanma.',
      simple:   'Yazım tonu: SADE ve anlaşılır. Kısa cümleler, günlük dil. Teknik terimler çıkarsa hemen sade dille açıkla.',
    },
    en: {
      formal:   'Writing style: FORMAL and institutional. Short, precise sentences. Professional vocabulary.',
      friendly: 'Writing style: FRIENDLY and warm. Encouraging, approachable language.',
      academic: 'Writing style: ACADEMIC. Subject-specific terminology, objective writing, clear headings.',
      simple:   'Writing style: SIMPLE and clear. Short sentences, everyday language.',
    },
  };
  const toneLang = toneInstructions[language] || toneInstructions.tr;
  const toneStr = toneLang[tone] || toneLang.formal;

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
    gradeLabel  ? `Sınıf seviyesi: ${gradeLabel}` : '',
    subject     ? `Ders: ${subject}` : '',
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

ÖNEMLİ: İçerik yalnızca ${gradeLabel || 'seçilen'} seviyesine uygun olmalıdır.

"${topic}" konusunda ${pages} slaytlık sunum hazırla.${notes}

${pptxAudience}

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
- Her slayt tek bir konuya odaklanır, 3-5 madde
- Maddeler bilgilendirici ve tam (her biri 1-2 cümle, 15-25 kelime)
- TAM OLARAK ${pages} slayt
- TÜM metin ${langCfg.name} dilinde
- Özel karakter, ok işareti veya markdown sembolü kullanma`;
  }

  /* ── PDF / WORD ── */
  return `${langCfg.enforce}

${toneStr}

${audienceBlock}

${contextBlock}

ÖNEMLİ: İçerik yalnızca ${gradeLabel || 'seçilen'} seviyesine uygun olmalıdır.

"${topic}" konusunda belge yaz. Uzunluk: yaklaşık ${pages} sayfa.${notes}

FORMAT:
# [Başlık]
## [Bölüm]
[İçerik]

KURALLAR:
- Sınav/test ise: soruları "Soru 1.", "Soru 2.", "Soru 3." şeklinde numaralandır — asla markdown numaralı liste (1. 1. 1.) kullanma, numarayı her zaman açıkça yaz
- Çoktan seçmeli sınav ise: HER soru için mutlaka A) B) C) D) şıkları olmalıdır, şıksız soru bırakma
- Her sorudan sonra boş satır bırak, şıklar bittikten sonra da boş satır bırak
- Kelimeleri asla birleştirme, her kelime arasında boşluk olsun (örn: "Bir Pizza" doğru, "BirPizza" yanlış)
- Sadece içerik yaz, meta-yorum veya pedagojik açıklama ekleme
- Yaklaşık ${pages} sayfa doldur
- KRİTİK: TÜM içerik ${langCfg.name} dilinde yazılmalıdır — istisna yok`;
}
