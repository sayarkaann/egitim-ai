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
    tr: { name: 'Turkish',  enforce: '' },
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

  // Audience-specific instructions
  const audienceBlock = isTeacher
    ? `AUDIENCE: This is for a TEACHER.
- Include clear learning objectives and outcomes
- Add pedagogical methods and teaching strategies
- Provide assessment and evaluation criteria
- Include timing estimates for each activity
- Suggest materials, resources, and differentiation tips
- Add classroom management considerations`
    : `AUDIENCE: This is for a STUDENT.
- Use age-appropriate, encouraging, and motivating language
- Include many concrete examples and visual descriptions
- Add practice exercises and self-check questions
- Highlight key terms and important concepts (use bold)
- Include a summary section at the end
- Add study tips and memory techniques`;

  const langNote = `OUTPUT LANGUAGE: ${langCfg.name}. Write everything in ${langCfg.name}.`;

  /* ── PPTX ── */
  if (type === 'pptx') {
    return `${langCfg.enforce}You are an expert educational content creator.

${langNote}
TONE: ${toneStr}
CONTEXT: ${subjectStr}${gradeStr}
${audienceBlock}

Create a ${pages}-slide educational PowerPoint presentation about:
"${topic}"
${notes}

MANDATORY SLIDE FORMAT (use exactly this, do not deviate):
SLAYT 1: [Cover Title]
- [Subtitle or presenter info]
- [Key theme]
- [Date or grade level]

SLAYT 2: [Section Title]
- [Bullet point]
- [Bullet point]
- [Bullet point]

(continue this pattern for all ${pages} slides)

RULES:
- Slide 1 = cover/title slide
- Last slide = summary or Q&A
- Every slide: 3–5 concise bullet points
- Total slides: exactly ${pages}
- All text in ${langCfg.name}`;
  }

  /* ── PDF / WORD ── */
  return `${langCfg.enforce}You are an expert educational content creator.

${langNote}
TONE: ${toneStr}
CONTEXT: ${subjectStr}${gradeStr}
TARGET LENGTH: approximately ${pages} pages
${audienceBlock}

Create a comprehensive educational document about:
"${topic}"
${notes}

FORMAT:
# [Document Title]

## [Section 1 Title]
[Content]

## [Section 2 Title]
[Content]

(continue for ${pages} pages worth of content)

RULES:
- If exam/test: number all questions; put full answer key at the very end
- If lesson plan: include objectives, timeline, methods, and assessment rubric
- If worksheet: mix explanation with practice questions
- Write enough content to fill approximately ${pages} pages
- All content must be in ${langCfg.name}`;
}
