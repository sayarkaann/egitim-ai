'use strict';
const { getUser } = require('./_supabase');
const { sbRequest } = require('./_supabase');

const SHARE_TABLE = '/rest/v1/shared_docs';

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', 'https://notioai.net');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // GET — paylaşılan belgeyi getir (public, auth gerekmez)
  if (req.method === 'GET') {
    const id = req.query.id;
    if (!id) return res.status(400).json({ error: 'id gerekli' });
    const { status, data } = await sbRequest('GET', `${SHARE_TABLE}?id=eq.${id}&select=id,title,type,content,created_at,expires_at`, null, null, true);
    if (status !== 200 || !data?.length) return res.status(404).json({ error: 'Belge bulunamadı veya süresi dolmuş.' });
    const doc = data[0];
    if (doc.expires_at && new Date(doc.expires_at) < new Date()) return res.status(410).json({ error: 'Bu paylaşım linkinin süresi dolmuş.' });
    return res.status(200).json(doc);
  }

  // POST — yeni paylaşım oluştur (auth gerekli)
  if (req.method === 'POST') {
    const authHeader = req.headers['authorization'] || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    const user = await getUser(token);
    if (!user) return res.status(401).json({ error: 'Giriş yapmanız gerekiyor.' });

    let body = {};
    try {
      const chunks = [];
      await new Promise((resolve, reject) => {
        req.on('data', c => chunks.push(c));
        req.on('end', resolve);
        req.on('error', reject);
      });
      body = JSON.parse(Buffer.concat(chunks).toString());
    } catch { return res.status(400).json({ error: 'Geçersiz istek.' }); }

    const { title, type, content } = body;
    if (!title || !type || !content) return res.status(400).json({ error: 'title, type ve content zorunlu.' });

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const { status, data } = await sbRequest('POST', SHARE_TABLE, {
      user_id: user.id,
      title:   title.slice(0, 100),
      type,
      content: content.slice(0, 50000),
      expires_at: expiresAt,
    }, null, true);

    if (status !== 201 || !data?.length) return res.status(500).json({ error: 'Paylaşım oluşturulamadı.' });
    return res.status(200).json({ id: data[0].id, expiresAt });
  }

  return res.status(405).end();
};
