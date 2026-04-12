const { getUser, sbRequest } = require('./_supabase');
const { rateLimit } = require('./_ratelimit');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', 'https://notioai.net');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const user = await getUser(token);
  if (!user) return res.status(401).json({ error: 'Oturum açmanız gerekiyor.' });

  // GET — kullanıcının referral bilgilerini döndür
  if (req.method === 'GET') {
    const { status, data } = await sbRequest(
      'GET',
      `/rest/v1/profiles?id=eq.${user.id}&select=referral_code,referral_count`,
      null, null, true
    );

    if (status !== 200 || !Array.isArray(data) || data.length === 0) {
      return res.status(500).json({ error: 'Profil alınamadı.' });
    }

    const profile = data[0];

    // Kod yoksa oluştur
    if (!profile.referral_code) {
      const code = Math.random().toString(36).slice(2, 10).toUpperCase();
      await sbRequest('PATCH', `/rest/v1/profiles?id=eq.${user.id}`, { referral_code: code }, null, true);
      return res.status(200).json({ code, count: 0 });
    }

    return res.status(200).json({
      code: profile.referral_code,
      count: profile.referral_count || 0,
    });
  }

  // POST — referral kodunu işle (yeni kullanıcı kaydı sonrası)
  if (req.method === 'POST') {
    const rl = rateLimit(`referral:${user.id}`, 3, 60 * 1000);
    if (!rl.allowed) return res.status(429).json({ error: 'Çok fazla istek.' });

    let body = req.body || {};
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
    const { code } = body;

    if (!code || typeof code !== 'string') {
      return res.status(400).json({ error: 'Geçersiz referral kodu.' });
    }

    // Kendi profilini al
    const { data: myData } = await sbRequest(
      'GET',
      `/rest/v1/profiles?id=eq.${user.id}&select=referral_code,referred_by`,
      null, null, true
    );
    const myProfile = Array.isArray(myData) ? myData[0] : null;

    if (myProfile?.referred_by) {
      return res.status(400).json({ error: 'Zaten bir referral kullandınız.' });
    }
    if (myProfile?.referral_code === code.toUpperCase()) {
      return res.status(400).json({ error: 'Kendi referral kodunuzu kullanamazsınız.' });
    }

    // Referral kodu sahibini bul
    const { data: refData } = await sbRequest(
      'GET',
      `/rest/v1/profiles?referral_code=eq.${code.toUpperCase()}&select=id,extra_docs,referral_count`,
      null, null, true
    );
    const referrer = Array.isArray(refData) && refData.length > 0 ? refData[0] : null;

    if (!referrer) {
      return res.status(404).json({ error: 'Referral kodu bulunamadı.' });
    }

    const BONUS = 5;
    const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();

    // Davet edeni ödüllendir
    await sbRequest('PATCH', `/rest/v1/profiles?id=eq.${referrer.id}`, {
      extra_docs: (referrer.extra_docs || 0) + BONUS,
      extra_docs_expires_at: expiresAt,
      referral_count: (referrer.referral_count || 0) + 1,
    }, null, true);

    // Yeni kullanıcıyı ödüllendir + referred_by kaydet
    await sbRequest('PATCH', `/rest/v1/profiles?id=eq.${user.id}`, {
      extra_docs: BONUS,
      extra_docs_expires_at: expiresAt,
      referred_by: referrer.id,
    }, null, true);

    return res.status(200).json({ success: true, bonus: BONUS });
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
};
