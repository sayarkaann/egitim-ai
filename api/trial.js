const { getUser, getProfile, updateProfile } = require('./_supabase');
const { rateLimit } = require('./_ratelimit');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', 'https://notioai.net');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const authHeader = req.headers['authorization'] || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    const user = await getUser(token);
    if (!user) return res.status(401).json({ error: 'Oturum açmanız gerekiyor.' });

    const rl = rateLimit(`trial:${user.id}`, 3, 60 * 1000);
    if (!rl.allowed) return res.status(429).json({ error: 'Çok fazla istek.' });

    const profile = await getProfile(user.id);

    // Zaten ücretli plan
    if (profile?.plan && profile.plan !== 'free') {
      return res.status(400).json({ error: 'Zaten aktif bir planınız var.' });
    }

    // Deneme hakkı kullanılmış
    if (profile?.trial_used) {
      return res.status(400).json({ error: 'Ücretsiz deneme hakkınızı daha önce kullandınız.' });
    }

    // 7 günlük Pro aktifleştir
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { status } = await updateProfile(user.id, {
      plan: 'pro',
      plan_expires_at: expiresAt,
      trial_used: true,
    });

    if (status !== 200 && status !== 204) throw new Error('Profil güncellenemedi.');

    return res.status(200).json({ success: true, expiresAt });

  } catch (err) {
    return res.status(500).json({ error: err.message || 'Bilinmeyen hata' });
  }
};
