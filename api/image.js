'use strict';
const https = require('https');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', 'https://notioai.net');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const query = req.query.q;
  if (!query) return res.status(400).json({ error: 'q parametresi gerekli' });

  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Pexels API key eksik' });

  const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=3&orientation=landscape`;

  try {
    const data = await new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.pexels.com',
        path: `/v1/search?query=${encodeURIComponent(query)}&per_page=3&orientation=landscape`,
        method: 'GET',
        headers: { Authorization: apiKey },
      };
      const req2 = https.request(options, (r) => {
        let body = '';
        r.on('data', c => body += c);
        r.on('end', () => resolve(JSON.parse(body)));
      });
      req2.on('error', reject);
      req2.setTimeout(8000, () => { req2.destroy(); reject(new Error('timeout')); });
      req2.end();
    });

    const photo = data.photos?.[0];
    if (!photo) return res.status(404).json({ error: 'Görsel bulunamadı' });

    return res.status(200).json({ url: photo.src.large });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
