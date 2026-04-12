'use strict';
const https = require('https');
const http  = require('http');

function fetchBuffer(url, headers = {}, redirects = 5) {
  return new Promise((resolve, reject) => {
    if (redirects === 0) return reject(new Error('Too many redirects'));
    const lib = url.startsWith('https') ? https : http;
    const u   = new URL(url);
    const req = lib.request(
      { hostname: u.hostname, path: u.pathname + u.search, method: 'GET',
        headers: { 'User-Agent': 'Mozilla/5.0 NotioAI/1.0', ...headers } },
      (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const next = res.headers.location.startsWith('http')
            ? res.headers.location
            : `https://${u.hostname}${res.headers.location}`;
          res.resume();
          return fetchBuffer(next, headers, redirects - 1).then(resolve).catch(reject);
        }
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => resolve({ status: res.statusCode, buffer: Buffer.concat(chunks), contentType: res.headers['content-type'] || '' }));
      }
    );
    req.on('error', reject);
    req.setTimeout(8000, () => { req.destroy(); reject(new Error('timeout')); });
    req.end();
  });
}

function fetchJson(url, headers = {}) {
  return fetchBuffer(url, headers).then(({ buffer }) => JSON.parse(buffer.toString('utf8')));
}

async function findImageUrl(query) {
  // 1. Türkçe Wikipedia
  try {
    const data = await fetchJson(`https://tr.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(query)}&prop=pageimages&format=json&pithumbsize=800`);
    const pages = data.query?.pages;
    if (pages) {
      const thumb = Object.values(pages)[0]?.thumbnail?.source;
      if (thumb) return thumb;
    }
  } catch (_) {}

  // 2. İngilizce Wikipedia
  try {
    const data = await fetchJson(`https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(query)}&prop=pageimages&format=json&pithumbsize=800`);
    const pages = data.query?.pages;
    if (pages) {
      const thumb = Object.values(pages)[0]?.thumbnail?.source;
      if (thumb) return thumb;
    }
  } catch (_) {}

  // 3. Wikimedia Commons
  try {
    const data = await fetchJson(`https://commons.wikimedia.org/w/api.php?action=query&list=allimages&ailimit=5&aisearch=${encodeURIComponent(query)}&format=json&aiprop=url|size|mediatype&aisort=relevance`);
    const imgs = data.query?.allimages || [];
    const ok   = imgs.find(i =>
      i.mediatype === 'BITMAP' &&
      /\.(jpg|jpeg|png)$/i.test(i.url) &&
      (i.width || 0) >= 400 && (i.height || 0) >= 300
    );
    if (ok?.url) return ok.url;
  } catch (_) {}

  // 4. Pexels
  const apiKey = process.env.PEXELS_API_KEY;
  if (apiKey) {
    try {
      const data = await fetchJson(
        `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=3&orientation=landscape`,
        { Authorization: apiKey }
      );
      const photo = data.photos?.[0];
      if (photo?.src?.large) return photo.src.large;
    } catch (_) {}
  }

  return null;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const query = req.query.q;
  if (!query) return res.status(400).json({ error: 'q parametresi gerekli' });

  const imgUrl = await findImageUrl(query);
  if (!imgUrl) return res.status(404).json({ error: 'Görsel bulunamadı' });

  try {
    const { buffer, contentType } = await fetchBuffer(imgUrl);
    const mime = contentType.startsWith('image/') ? contentType.split(';')[0] : 'image/jpeg';
    const b64  = buffer.toString('base64');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.status(200).json({ dataUrl: `data:${mime};base64,${b64}` });
  } catch (err) {
    return res.status(500).json({ error: 'Görsel indirilemedi: ' + err.message });
  }
};
