/**
 * Supabase REST helper — ekstra paket gerektirmez (sadece https)
 * Env vars: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
 */
const https = require('https');

const SUPABASE_URL        = process.env.SUPABASE_URL        || 'https://bkeiwcxrdunicjvikfin.supabase.co';
const SUPABASE_ANON_KEY   = process.env.SUPABASE_ANON_KEY   || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

/* ── Plan limitleri ── */
const PLAN_DOC_LIMITS     = { free: 10,  ogrenci: 60,  pro: 150, kurumsal: 200 };
const PLAN_ANALYZE_LIMITS = { free: 3,   ogrenci: 10,  pro: 30,  kurumsal: 100 };
const PLAN_PAGE_LIMITS    = { free: 5,   ogrenci: 20,  pro: 30,  kurumsal: 30  };

/* ── Düşük seviye HTTP yardımcısı ── */
function sbRequest(method, path, body, authToken, useServiceKey = false) {
  return new Promise((resolve, reject) => {
    const host    = new URL(SUPABASE_URL).hostname;
    const apiKey  = useServiceKey ? SUPABASE_SERVICE_KEY : SUPABASE_ANON_KEY;
    const bearer  = useServiceKey ? SUPABASE_SERVICE_KEY : (authToken || SUPABASE_ANON_KEY);
    const bodyStr = body ? JSON.stringify(body) : undefined;

    const headers = {
      'Content-Type':  'application/json',
      'apikey':        apiKey,
      'Authorization': `Bearer ${bearer}`,
    };
    if (bodyStr)                             headers['Content-Length'] = Buffer.byteLength(bodyStr);
    if (method === 'POST' || method === 'PATCH') headers['Prefer'] = 'return=representation';

    const req = https.request({ hostname: host, path, method, headers }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try   { resolve({ status: res.statusCode, data: data ? JSON.parse(data) : null }); }
        catch { resolve({ status: res.statusCode, data: null }); }
      });
    });

    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('Supabase isteği zaman aşımına uğradı.')); });
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

/* ── JWT doğrula, user döndür ── */
async function getUser(token) {
  if (!token) return null;
  const { status, data } = await sbRequest('GET', '/auth/v1/user', null, token, false);
  if (status !== 200 || !data?.id) return null;
  return data; // { id, email, ... }
}

/* ── Profil al (yoksa oluştur) ── */
async function getProfile(userId) {
  const { status, data } = await sbRequest(
    'GET',
    `/rest/v1/profiles?id=eq.${userId}&select=*`,
    null, null, true
  );
  if (status === 200 && Array.isArray(data) && data.length > 0) return data[0];

  // Trigger çalışmadıysa fallback: profil oluştur
  const { data: created } = await sbRequest('POST', '/rest/v1/profiles', { id: userId }, null, true);
  if (Array.isArray(created) && created.length > 0) return created[0];

  // En kötü durum: varsayılan free profil döndür
  return { id: userId, plan: 'free', plan_expires_at: null, docs_used_month: 0, analyze_used_month: 0 };
}

/* ── Aktif plan adını döndür (süresi dolan = free) ── */
function activePlan(profile) {
  if (!profile.plan || profile.plan === 'free') return 'free';
  if (profile.plan_expires_at && new Date(profile.plan_expires_at) < new Date()) return 'free';
  return profile.plan;
}

/* ── Aylık sayaç (ay başında sıfırla, güncel değeri döndür) ── */
function monthlyCount(profile, field, resetField) {
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const resetAt    = profile[resetField] ? new Date(profile[resetField]) : new Date(0);
  if (resetAt < monthStart) return 0; // ay geçmiş → sıfırla
  return profile[field] || 0;
}

/* ── Belge limiti kontrolü ── */
function checkDocLimit(profile, pages) {
  const plan      = activePlan(profile);
  const docLimit  = PLAN_DOC_LIMITS[plan]  || PLAN_DOC_LIMITS.free;
  const pageLimit = PLAN_PAGE_LIMITS[plan] || PLAN_PAGE_LIMITS.free;
  const used      = monthlyCount(profile, 'docs_used_month', 'docs_reset_at');

  // Extra docs aktif mi?
  const extraActive = (profile.extra_docs || 0) > 0 &&
    profile.extra_docs_expires_at &&
    new Date(profile.extra_docs_expires_at) > new Date();
  const effectiveLimit = docLimit + (extraActive ? (profile.extra_docs || 0) : 0);

  if (used >= effectiveLimit) {
    return { allowed: false, code: 'DOC_LIMIT', message: `Bu ay oluşturabileceğiniz ${effectiveLimit} belge limitine ulaştınız. Planınızı yükseltin.` };
  }
  if (pages > pageLimit) {
    return { allowed: false, code: 'PAGE_LIMIT', message: `Planınızda en fazla ${pageLimit} sayfa oluşturabilirsiniz.` };
  }
  return { allowed: true };
}

/* ── Özet limiti kontrolü ── */
function checkAnalyzeLimit(profile) {
  const plan  = activePlan(profile);
  const limit = PLAN_ANALYZE_LIMITS[plan] || PLAN_ANALYZE_LIMITS.free;
  const used  = monthlyCount(profile, 'analyze_used_month', 'analyze_reset_at');

  if (used >= limit) {
    return { allowed: false, code: 'ANALYZE_LIMIT', message: `Bu ay ${limit} makale özetleme hakkınızı kullandınız. Planınızı yükseltin.` };
  }
  return { allowed: true };
}

/* ── Belge sayacını artır ── */
async function incrementDocs(userId, profile) {
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  const resetAt    = profile.docs_reset_at ? new Date(profile.docs_reset_at) : new Date(0);
  const currentMonthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  const newCount = (resetAt < currentMonthStart ? 0 : (profile.docs_used_month || 0)) + 1;
  const updateBody = { docs_used_month: newCount };
  if (resetAt < currentMonthStart) updateBody.docs_reset_at = monthStart;

  await sbRequest('PATCH', `/rest/v1/profiles?id=eq.${userId}`, updateBody, null, true);
}

/* ── Özet sayacını artır ── */
async function incrementAnalyze(userId, profile) {
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  const resetAt    = profile.analyze_reset_at ? new Date(profile.analyze_reset_at) : new Date(0);
  const currentMonthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  const newCount = (resetAt < currentMonthStart ? 0 : (profile.analyze_used_month || 0)) + 1;
  const updateBody = { analyze_used_month: newCount };
  if (resetAt < currentMonthStart) updateBody.analyze_reset_at = monthStart;

  await sbRequest('PATCH', `/rest/v1/profiles?id=eq.${userId}`, updateBody, null, true);
}

/* ── Profil güncelle (webhook için) ── */
async function updateProfile(userId, fields) {
  return sbRequest('PATCH', `/rest/v1/profiles?id=eq.${userId}`, fields, null, true);
}

module.exports = { sbRequest, getUser, getProfile, checkDocLimit, checkAnalyzeLimit, incrementDocs, incrementAnalyze, updateProfile };
