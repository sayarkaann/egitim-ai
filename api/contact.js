const { rateLimit } = require('./_ratelimit');

function esc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

function isValidEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || '').trim());
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', 'https://notioai.net');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const { name, email, subject, message } = req.body || {};

  // ── Rate limit: IP başına saatte max 5 mesaj ──
  const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket?.remoteAddress || 'unknown';
  const rl = rateLimit(`contact:${ip}`, 5, 60 * 60 * 1000);
  if (!rl.allowed) {
    return res.status(429).json({ error: 'Çok fazla mesaj gönderdiniz. Lütfen bir saat bekleyin.' });
  }

  if (!name || !email || !message) {
    return res.status(400).json({ error: 'Ad, e-posta ve mesaj zorunludur.' });
  }
  if (!isValidEmail(email)) {
    return res.status(400).json({ error: 'Geçerli bir e-posta adresi girin.' });
  }
  if (String(name).length > 100 || String(message).length > 5000) {
    return res.status(400).json({ error: 'Girdi çok uzun.' });
  }

  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) {
    return res.status(500).json({ error: 'Mail servisi yapılandırılmamış.' });
  }

  const emailBody = JSON.stringify({
    from: 'NotioAI Destek <destek@notioai.net>',
    to: ['destek.notioai@gmail.com'],
    reply_to: email.trim().slice(0, 254),
    subject: `[Destek] ${esc(subject || 'Yeni mesaj')} — ${esc(name)}`,
    html: `
      <h2>Yeni Destek Talebi</h2>
      <p><strong>Ad:</strong> ${esc(name)}</p>
      <p><strong>E-posta:</strong> ${esc(email)}</p>
      <p><strong>Konu:</strong> ${esc(subject || '-')}</p>
      <hr>
      <p><strong>Mesaj:</strong></p>
      <p>${esc(message).replace(/\n/g, '<br>')}</p>
    `,
  });

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: emailBody,
    });

    if (!response.ok) {
      const err = await response.json();
      return res.status(500).json({ error: err.message || 'Mail gönderilemedi.' });
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Sunucu hatası.' });
  }
};
