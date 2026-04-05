module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const { name, email, subject, message } = req.body || {};

  if (!name || !email || !message) {
    return res.status(400).json({ error: 'Ad, e-posta ve mesaj zorunludur.' });
  }

  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) {
    return res.status(500).json({ error: 'Mail servisi yapılandırılmamış.' });
  }

  const emailBody = JSON.stringify({
    from: 'NotioAI Destek <destek@notioai.net>',
    to: ['destek.notioai@gmail.com'],
    reply_to: email,
    subject: `[Destek] ${subject || 'Yeni mesaj'} — ${name}`,
    html: `
      <h2>Yeni Destek Talebi</h2>
      <p><strong>Ad:</strong> ${name}</p>
      <p><strong>E-posta:</strong> ${email}</p>
      <p><strong>Konu:</strong> ${subject || '-'}</p>
      <hr>
      <p><strong>Mesaj:</strong></p>
      <p>${message.replace(/\n/g, '<br>')}</p>
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
