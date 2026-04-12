# EgitimAI — Claude Code Talimatları

AI destekli eğitim belgesi üretici SaaS. Öğretmenler ve öğrenciler için PDF, Word, PPTX üretimi.
Canlı adres: **notioai.net**

---

## Teknoloji Yığını

- **Frontend:** Vanilla HTML/CSS/JS — framework yok, React yok
- **AI API:** Groq (`llama-3.3-70b-versatile`) — Vercel serverless function üzerinden
- **Auth + DB:** Supabase (Auth, PostgreSQL, RLS açık)
- **Deployment:** Vercel (static hosting + serverless functions)
- **PPTX:** PptxGenJS v3.12.0 (CDN, client-side)
- **Font:** DM Sans (Google Fonts)
- **İkonlar:** Lucide Icons (CDN)
- **Ödeme:** LemonSqueezy (webhook: api/webhook-ls.js)
- **i18n:** app/js/i18n.js (7 dil: tr/en/de/fr/ar/es/ru)

## Dosya Yapısı

```
egitim-ai/
  app/
    index.html        # Dashboard
    create.html       # Belge oluşturma
    history.html      # Geçmiş
    templates.html    # Şablonlar
    pricing.html      # Planlar ve ödeme
    settings.html     # Ayarlar
    help.html         # Yardım
    analyze.html      # Makale özetleme
    exam.html         # Sınav sorusu üretimi
    batch.html        # Toplu belge
    folders.html      # Klasörlerim
    cancel.html       # Abonelik iptali
    auth.html         # Giriş / Kayıt
    js/
      app.js          # Tüm uygulama mantığı (~2800+ satır)
      i18n.js         # Çeviri sistemi (7 dil)
    styles/
      app.css         # Uygulama stilleri
  api/
    generate.js       # Belge üretimi (Groq)
    analyze.js        # Makale özetleme
    exam.js           # Sınav sorusu üretimi
    solve.js          # Adım adım çözüm
    trial.js          # 7 günlük Pro denemesi
    referral.js       # Referral sistemi
    share.js          # Belge paylaşımı
    contact.js        # İletişim formu
    webhook-ls.js     # LemonSqueezy webhook (HMAC-SHA256)
    image.js          # Görsel getirme (Wikipedia/Wikimedia)
    _supabase.js      # Shared Supabase helper + plan limitleri
    _ratelimit.js     # Rate limiter (in-memory)
  index.html          # Landing page
  blog.html           # Blog
  legal.html          # Gizlilik / Kullanım koşulları
  share.html          # Belge paylaşım sayfası
  styles.css          # Landing page stilleri
  manifest.json       # PWA manifest
  sw.js               # Service Worker
  sitemap.xml         # SEO sitemap
  robots.txt          # SEO robots
  build.js            # CSS cache-busting (Date.now() → ?v= parametresi)
  vercel.json         # Vercel routing config
```

## Plan Limitleri

| Plan       | Fiyat          | Belge/ay | Sayfa/belge | Analiz/ay | Sınav/ay |
|------------|----------------|----------|-------------|-----------|----------|
| Ücretsiz   | 0₺             | 10       | 5           | 3         | 5        |
| Öğrenci    | 99₺/ay         | 60       | 20          | 10        | 30       |
| Pro        | 169₺/ay        | 150      | 30          | 30        | 100      |
| Kurumsal   | 2.999₺/ay      | 200      | 50          | 100       | 300      |

## LemonSqueezy Variant ID'leri (CANLI)

- Öğrenci Aylık: `72d8c1df-c614-48bd-b560-5f2cd7b962fe`
- Öğrenci Yıllık: `62df31af-a884-4857-94b9-7af03e3e5123`
- Pro Aylık: `a445d557-fe0c-41a7-bc77-3b829aa7f15e`
- Pro Yıllık: `b356c0f0-7c7e-4d80-aa21-016577fd3617`

## Vercel Env Variables

- `GROQ_API_KEY` — Groq API anahtarı
- `PEXELS_API_KEY` — Pexels görsel API
- `LEMONSQUEEZY_WEBHOOK_SECRET` — Webhook HMAC doğrulama
- `LS_VARIANT_OGRENCI_MONTHLY`, `LS_VARIANT_OGRENCI_YEARLY`
- `LS_VARIANT_PRO_MONTHLY`, `LS_VARIANT_PRO_YEARLY`
- `LS_VARIANT_TOPUP_STARTER`, `LS_VARIANT_TOPUP_MID`, `LS_VARIANT_TOPUP_LARGE`, `LS_VARIANT_TOPUP_MEGA`

## Supabase profiles Tablosu

- `id`, `plan`, `plan_expires_at`
- `docs_used_month`, `docs_reset_at`
- `analyze_used_month`, `analyze_reset_at`
- `exam_used_month`, `exam_reset_at`
- `extra_docs`, `extra_docs_expires_at`
- `ls_subscription_id`, `ls_customer_id`
- `trial_used` (boolean)
- `referral_code` (unique text), `referred_by` (uuid), `referral_count` (int)

## Migration Dosyaları (canlıda çalıştırılması gereken)

```
supabase_migration.sql          — core tablo
supabase_migration_2.sql        — LemonSqueezy kolonları
supabase_migration_3.sql        — exam kolonları
supabase_migration_referral.sql — referral kolonları
supabase_migration_trial.sql    — trial_used kolonu
supabase_migration_share.sql    — shared_docs tablosu
```

## Önemli Uygulama Kararları

### app.js Kritik Fonksiyonlar
- `initSidebar()` — mobil hamburger menü, her sayfada çağrılmalı
- `requireAuth()` — session yoksa auth.html'e yönlendirir
- `populateUserInfo()` — sidebar kullanıcı adı/plan günceller
- `markCurrentPlan()` — pricing sayfasında mevcut planı işaretler
- `openLSCheckout()` — LemonSqueezy checkout modal açar
- `showToast(msg, type)` — bildirim gösterir
- `initIcons(root?)` — lucide ikonları render eder
- `stripMarkdown(text)` — PPTX için markdown temizler

### Sayfa Init Akışı
Her sayfada app.js global DOMContentLoaded şunları çağırır:
`initAuthPage`, `initDashboard`, `initCreatePage`, `initHistoryPage`,
`initTemplatesPage`, `initSettingsPage`, `initFoldersPage`,
`initAnalyzePage`, `initPricingPage`, `initExamPage`, `initBatchPage`

**ÖNEMLİ:** Sayfa HTML'lerindeki inline script'lerde bu init fonksiyonları
tekrar çağrılmamalı — çift listener hatasına yol açar (bkz. analyze.html düzeltmesi).

### Cache Busting
- `build.js` HTML dosyalarındaki `?v=\d+` değerini `Date.now()` ile günceller
- Her deploy öncesi çalıştır: `node build.js`

### Auth Redirect
- `app/auth.html?next=pricing&plan=pro` → giriş sonrası `pricing.html?plan=pro`
- `pricing.html?plan=pro` → otomatik Pro checkout açar

## Tasarım Kuralları

- **Renk:** Dark theme — `--bg: #0c0a08`, `--accent: #e8855a` (terracotta)
- **Font:** DM Sans 300–700
- **Radius:** `--radius: 14px`
- **Glassmorphism:** `--bg-card`, `--border: rgba(255,220,170,.07)`

## Güvenlik

- Backend JWT auth (tüm API endpoint'leri korumalı)
- Rate limiting: generate 10/dk, analyze 5/dk, exam 5/dk, solve 10/dk, contact 5/saat
- CORS: sadece `https://notioai.net`
- Webhook: HMAC-SHA256 imza doğrulama
- Groq API anahtarı asla client'a açık değil

## Önemli Uyarılar

- `app.js` tek dosya — fonksiyonlar bölünmez
- Supabase anon key `app.js` içinde hardcode (anon key, güvenli)
- `.env`, `credentials.json` asla commit edilmez
- `lucide.createIcons()` yerine her zaman `initIcons()` kullan
