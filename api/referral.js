const { getUser } = require('./_supabase');
const { rateLimit } = require('./_ratelimit');
const { createClient } = require('@supabase/supabase-js');

const sb = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

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
    const { data: profile } = await sb
      .from('profiles')
      .select('referral_code, referral_count')
      .eq('id', user.id)
      .single();

    // Kod yoksa oluştur
    if (!profile?.referral_code) {
      const code = Math.random().toString(36).slice(2, 10).toUpperCase();
      await sb.from('profiles').update({ referral_code: code }).eq('id', user.id);
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

    const { code } = req.body || {};
    if (!code || typeof code !== 'string') {
      return res.status(400).json({ error: 'Geçersiz referral kodu.' });
    }

    // Kendi kodunu kullanamazsın
    const { data: myProfile } = await sb
      .from('profiles')
      .select('referral_code, referred_by')
      .eq('id', user.id)
      .single();

    if (myProfile?.referred_by) {
      return res.status(400).json({ error: 'Zaten bir referral kullandınız.' });
    }
    if (myProfile?.referral_code === code.toUpperCase()) {
      return res.status(400).json({ error: 'Kendi referral kodunuzu kullanamazsınız.' });
    }

    // Referral kodu sahibini bul
    const { data: referrer } = await sb
      .from('profiles')
      .select('id, extra_docs, referral_count')
      .eq('referral_code', code.toUpperCase())
      .single();

    if (!referrer) {
      return res.status(404).json({ error: 'Referral kodu bulunamadı.' });
    }

    const BONUS = 5;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString();

    // Davet edeni ödüllendir
    await sb.from('profiles').update({
      extra_docs: (referrer.extra_docs || 0) + BONUS,
      extra_docs_expires_at: expiresAt,
      referral_count: (referrer.referral_count || 0) + 1,
    }).eq('id', referrer.id);

    // Yeni kullanıcıyı ödüllendir + referred_by kaydet
    await sb.from('profiles').update({
      extra_docs: BONUS,
      extra_docs_expires_at: expiresAt,
      referred_by: referrer.id,
    }).eq('id', user.id);

    return res.status(200).json({ success: true, bonus: BONUS });
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
};
