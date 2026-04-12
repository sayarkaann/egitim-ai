'use strict';
const https = require('https');

function httpsGet(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const options = {
      hostname: u.hostname,
      path: u.pathname + u.search,
      method: 'GET',
      headers: { 'User-Agent': 'NotioAI/1.0', ...headers },
    };
    const req = https.request(options, (res) => {
      // Handle redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return httpsGet(res.headers.location, headers).then(resolve).catch(reject);
      }
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject);
    req.setTimeout(8000, () => { req.destroy(); reject(new Error('timeout')); });
    req.end();
  });
}

async function fetchFromWikipedia(query) {
  try {
    // Önce Türkçe Wikipedia, sonra İngilizce
    for (const lang of ['tr', 'en']) {
      const url = `https://${lang}.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(query)}&prop=pageimages&format=json&pithumbsize=800`;
      const { status, body } = await httpsGet(url);
      if (status === 200) {
        const data = JSON.parse(body);
        const pages = data.query?.pages;
        if (pages) {
          const thumb = Object.values(pages)[0]?.thumbnail?.source;
          if (thumb) return thumb;
        }
      }
    }
  } catch (_) {}

  try {
    // Wikimedia Commons fallback
    const url = `https://commons.wikimedia.org/w/api.php?action=query&list=allimages&ailimit=5&aisearch=${encodeURIComponent(query)}&format=json&aiprop=url|size|mediatype&aisort=relevance`;
    const { status, body } = await httpsGet(url);
    if (status === 200) {
      const data = JSON.parse(body);
      const imgs = data.query?.allimages || [];
      const ok = imgs.find(i =>
        i.mediatype === 'BITMAP' &&
        (i.url.toLowerCase().endsWith('.jpg') || i.url.toLowerCase().endsWith('.png')) &&
        (i.width || 0) >= 400 && (i.height || 0) >= 300
      );
      if (ok?.url) return ok.url;
    }
  } catch (_) {}

  return null;
}

async function fetchFromPexels(query) {
  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey) return null;

  try {
    const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=3&orientation=landscape`;
    const { status, body } = await httpsGet(url, { Authorization: apiKey });
    if (status === 200) {
      const data = JSON.parse(body);
      const photo = data.photos?.[0];
      if (photo) return photo.src.large;
    }
  } catch (_) {}

  return null;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', 'https://notioai.net');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const query = req.query.q;
  if (!query) return res.status(400).json({ error: 'q parametresi gerekli' });

  // Wikipedia önce, Pexels fallback
  let url = await fetchFromWikipedia(query);
  if (!url) url = await fetchFromPexels(query);
  if (!url) return res.status(404).json({ error: 'Görsel bulunamadı' });

  // Görseli base64 olarak döndür (CORS sorununu tamamen çözer)
  try {
    const { status, body } = await httpsGet(url);
    if (status !== 200) return res.status(404).json({ error: 'Görsel indirilemedi' });

    const ext = url.toLowerCase().includes('.png') ? 'png' : 'jpeg';
    const b64 = Buffer.from(body, 'binary').toString('base64');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.status(200).json({ dataUrl: `data:image/${ext};base64,${b64}` });
  } catch (_) {
    return res.status(500).json({ error: 'Görsel dönüştürülemedi' });
  }
};
