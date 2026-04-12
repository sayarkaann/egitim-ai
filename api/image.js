'use strict';
const https = require('https');
const http  = require('http');

function fetchBuffer(urlStr, headers = {}, redirects = 5) {
  return new Promise((resolve, reject) => {
    if (redirects === 0) return reject(new Error('Too many redirects'));
    const lib = urlStr.startsWith('https') ? https : http;
    const u   = new URL(urlStr);
    const req = lib.request(
      { hostname: u.hostname, path: u.pathname + u.search, method: 'GET',
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NotioAI/1.0)', ...headers } },
      (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const loc  = res.headers.location;
          const next = loc.startsWith('http') ? loc : `https://${u.hostname}${loc}`;
          res.resume();
          return fetchBuffer(next, headers, redirects - 1).then(resolve).catch(reject);
        }
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => resolve({
          status: res.statusCode,
          buffer: Buffer.concat(chunks),
          contentType: res.headers['content-type'] || 'image/jpeg',
        }));
      }
    );
    req.on('error', reject);
    req.setTimeout(9000, () => { req.destroy(); reject(new Error('timeout')); });
    req.end();
  });
}

async function fetchJson(urlStr, headers = {}) {
  const { buffer } = await fetchBuffer(urlStr, headers);
  return JSON.parse(buffer.toString('utf8'));
}

async function findImageUrl(query) {
  // 1. Pexels (fotoğraf kalitesi daha yüksek, daha alakalı)
  const apiKey = process.env.PEXELS_API_KEY;
  if (apiKey) {
    try {
      const data = await fetchJson(
        `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=5&orientation=landscape`,
        { Authorization: apiKey }
      );
      const photo = data.photos?.[0];
      if (photo?.src?.large) return photo.src.large;
    } catch (_) {}
  }

  // 2. Wikipedia search API (TR önce, EN fallback)
  for (const lang of ['tr', 'en']) {
    try {
      const searchUrl = `https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srlimit=3&format=json`;
      const searchData = await fetchJson(searchUrl);
      const results = searchData.query?.search || [];
      for (const result of results) {
        const pageUrl = `https://${lang}.wikipedia.org/w/api.php?action=query&pageids=${result.pageid}&prop=pageimages&format=json&pithumbsize=800`;
        const pageData = await fetchJson(pageUrl);
        const pages    = pageData.query?.pages;
        if (pages) {
          const thumb = Object.values(pages)[0]?.thumbnail?.source;
          if (thumb) return thumb;
        }
      }
    } catch (_) {}
  }

  // 3. Wikimedia Commons
  try {
    const url  = `https://commons.wikimedia.org/w/api.php?action=query&list=allimages&ailimit=5&aisearch=${encodeURIComponent(query)}&format=json&aiprop=url|size|mediatype&aisort=relevance`;
    const data = await fetchJson(url);
    const imgs = data.query?.allimages || [];
    const ok   = imgs.find(i =>
      i.mediatype === 'BITMAP' &&
      /\.(jpg|jpeg|png)$/i.test(i.url) &&
      (i.width || 0) >= 400 && (i.height || 0) >= 300
    );
    if (ok?.url) return ok.url;
  } catch (_) {}

  return null;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const query = req.query.q;
  if (!query) return res.status(400).json({ error: 'q parametresi gerekli' });

  const imgUrl = await findImageUrl(query);
  if (!imgUrl) {
    console.log(`[image] No result for: ${query}`);
    return res.status(404).json({ error: 'Görsel bulunamadı', query });
  }

  try {
    const { buffer, contentType } = await fetchBuffer(imgUrl);
    const mime = contentType.startsWith('image/') ? contentType.split(';')[0] : 'image/jpeg';
    const b64  = buffer.toString('base64');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.status(200).json({ dataUrl: `data:${mime};base64,${b64}` });
  } catch (err) {
    console.log(`[image] Download failed: ${err.message} — ${imgUrl}`);
    return res.status(500).json({ error: 'Görsel indirilemedi' });
  }
};
