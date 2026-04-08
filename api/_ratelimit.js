/**
 * In-memory rate limiter (Vercel serverless — instance başına)
 * Kullanıcı başına belirli bir pencerede max istek sınırı koyar.
 */

const store = new Map(); // key → { count, resetAt }

/**
 * @param {string} key       — kullanıcı ID veya IP
 * @param {number} maxReqs   — pencerede izin verilen max istek
 * @param {number} windowMs  — pencere süresi (ms)
 * @returns {{ allowed: boolean, remaining: number }}
 */
function rateLimit(key, maxReqs, windowMs) {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: maxReqs - 1 };
  }

  if (entry.count >= maxReqs) {
    return { allowed: false, remaining: 0 };
  }

  entry.count++;
  return { allowed: true, remaining: maxReqs - entry.count };
}

// Bellek sızıntısını önle — 5 dakikada bir eski kayıtları temizle
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of store.entries()) {
    if (now > val.resetAt) store.delete(key);
  }
}, 5 * 60 * 1000);

module.exports = { rateLimit };
