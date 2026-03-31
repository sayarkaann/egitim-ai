exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  };

  try {
    const { topic, extraNotes, type, audience, pages, gradeLevel, language, tone } = JSON.parse(event.body);
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

    if (!GEMINI_API_KEY) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'API anahtarı eksik.' }) };
    }

    const prompt = buildPrompt(topic, extraNotes, type, audience, pages, gradeLevel, language, tone);

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 8192 }
        })
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'AI servisi hatası: ' + errText }) };
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    if (!content) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'İçerik üretilemedi, tekrar deneyin.' }) };
    }

    return { statusCode: 200, headers, body: JSON.stringify({ content }) };

  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};

function buildPrompt(topic, extraNotes, type, audience, pages, gradeLevel, language, tone) {
  const langMap  = { tr: 'Türkçe', en: 'İngilizce', de: 'Almanca', fr: 'Fransızca', ar: 'Arapça' };
  const toneMap  = { formal: 'resmi', friendly: 'samimi ve akıcı', academic: 'akademik', simple: 'basit ve anlaşılır' };
  const audLabel = audience === 'teacher' ? 'öğretmenler' : 'öğrenciler';
  const langLabel = langMap[language] || 'Türkçe';
  const toneLabel = toneMap[tone] || 'resmi';
  const gradeStr  = gradeLevel ? `${gradeLevel}. sınıf seviyesinde, ` : '';
  const notes     = extraNotes ? `\nEk talimatlar: ${extraNotes}` : '';

  if (type === 'pptx') {
    return `Sen deneyimli bir eğitim uzmanısın. ${audLabel} için ${langLabel} dilinde, ${toneLabel} tonda, ${gradeStr}${pages} slaytlık bir PowerPoint sunumu içeriği oluştur.

Konu: ${topic}${notes}

ZORUNLU FORMAT — Her slayt için tam olarak bu şablonu kullan:
SLAYT 1: [Başlık]
- [madde 1]
- [madde 2]
- [madde 3]

SLAYT 2: [Başlık]
- [madde 1]
...

Kurallar:
- İlk slayt kapak slaydı olsun (sunum başlığı + alt başlık)
- Son slayt özet/sonuç olsun
- Her slayta 3-5 madde ekle
- Toplam ${pages} slayt oluştur
- İçerik eğitici, net ve hedef kitleye uygun olsun`;
  }

  return `Sen deneyimli bir eğitim uzmanısın. ${audLabel} için ${langLabel} dilinde, ${toneLabel} tonda, ${gradeStr}kapsamlı bir eğitim belgesi oluştur.

Konu: ${topic}${notes}
Hedef uzunluk: yaklaşık ${pages} sayfa

FORMAT:
# [Belge Başlığı]

## [Bölüm 1]
[İçerik]

## [Bölüm 2]
[İçerik]
...

Kurallar:
- Eğer sınav/soru isteniyorsa soruları numaralandır ve cevapları en sona koy
- Eğer ders planı isteniyorsa kazanımlar, yöntemler ve değerlendirme bölümleri ekle
- ${pages} sayfalık içeriğe uygun kapsamda yaz
- Profesyonel, anlaşılır ve hedef kitleye uygun bir dil kullan`;
}
