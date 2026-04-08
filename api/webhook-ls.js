'use strict';
const crypto = require('crypto');
const { updateProfile, getProfile, sbRequest } = require('./_supabase');

/* ── Variant ID → plan mapping ── */
function buildVariantMap() {
  return {
    [process.env.LS_VARIANT_OGRENCI_MONTHLY]: { type: 'subscription', plan: 'ogrenci' },
    [process.env.LS_VARIANT_OGRENCI_YEARLY]:  { type: 'subscription', plan: 'ogrenci' },
    [process.env.LS_VARIANT_PRO_MONTHLY]:     { type: 'subscription', plan: 'pro'     },
    [process.env.LS_VARIANT_PRO_YEARLY]:      { type: 'subscription', plan: 'pro'     },
    [process.env.LS_VARIANT_TOPUP_STARTER]:   { type: 'topup', docs: 5,   pages: 5   },
    [process.env.LS_VARIANT_TOPUP_MID]:       { type: 'topup', docs: 10,  pages: 10  },
    [process.env.LS_VARIANT_TOPUP_LARGE]:     { type: 'topup', docs: 20,  pages: 20  },
    [process.env.LS_VARIANT_TOPUP_MEGA]:      { type: 'topup', docs: 100, pages: 100 },
  };
}

/* ── Raw body topla (bodyParser: false) ── */
function getRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end',  () => resolve(data));
    req.on('error', reject);
  });
}

/* ── HMAC-SHA256 imza doğrulama ── */
function verifySignature(rawBody, signatureHeader, secret) {
  if (!signatureHeader || !secret) return false;
  const digest = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  try {
    return crypto.timingSafeEqual(
      Buffer.from(digest,          'hex'),
      Buffer.from(signatureHeader, 'hex')
    );
  } catch {
    return false;
  }
}

/* ── UUID format kontrolü ── */
function isValidUUID(v) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(v || ''));
}

/* ── Event handler ── */
async function handleEvent(eventName, payload, variantMap) {
  const userId = payload.meta?.custom_data?.user_id;
  if (!userId || !isValidUUID(userId)) return;

  const attrs = payload.data?.attributes || {};

  switch (eventName) {

    case 'subscription_created':
    case 'subscription_updated': {
      const variantId = String(attrs.variant_id || '');
      const mapping   = variantMap[variantId];
      if (!mapping || mapping.type !== 'subscription') return;

      await updateProfile(userId, {
        plan:               mapping.plan,
        plan_expires_at:    attrs.renews_at || attrs.ends_at || null,
        ls_subscription_id: String(payload.data?.id || ''),
        ls_customer_id:     String(attrs.customer_id || ''),
      });
      break;
    }

    case 'subscription_expired': {
      await updateProfile(userId, {
        plan:            'free',
        plan_expires_at: null,
      });
      break;
    }

    case 'subscription_cancelled': {
      // İptal edildi ama süre bitmedi — plan_expires_at zaten mevcut, değiştirme
      // subscription_expired gelince free'ye düşürülür
      break;
    }

    case 'order_created': {
      // Sadece tek seferlik siparişler (subscription_created ayrıca tetiklenir)
      if (attrs.first_subscription_item) return;

      const variantId = String(attrs.first_order_item?.variant_id || '');
      const mapping   = variantMap[variantId];
      if (!mapping || mapping.type !== 'topup') return;

      // Mevcut extra_docs'u oku
      const profile = await getProfile(userId);
      const nowValid = profile.extra_docs_expires_at &&
        new Date(profile.extra_docs_expires_at) > new Date();
      const existingDocs = nowValid ? (profile.extra_docs || 0) : 0;
      const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();

      await updateProfile(userId, {
        extra_docs:            existingDocs + mapping.docs,
        extra_docs_expires_at: expiresAt,
      });
      break;
    }
  }
}

/* ── Ana handler ── */
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();

  const rawBody  = await getRawBody(req);
  const signature = req.headers['x-signature'] || '';
  const secret    = process.env.LEMONSQUEEZY_WEBHOOK_SECRET || '';

  if (!verifySignature(rawBody, signature, secret)) {
    return res.status(403).json({ error: 'Geçersiz imza.' });
  }

  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return res.status(400).json({ error: 'Geçersiz JSON.' });
  }

  const eventName = payload.meta?.event_name || '';
  const variantMap = buildVariantMap();

  try {
    await handleEvent(eventName, payload, variantMap);
  } catch (err) {
    // Hata olsa bile 200 döndür — LemonSqueezy retry atmasın
    console.error('Webhook handler hatası:', err.message);
  }

  return res.status(200).json({ received: true });
};
