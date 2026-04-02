# EgitimAI — Claude Code Talimatları

AI destekli eğitim belgesi üretici SaaS. Öğretmenler ve öğrenciler için PDF, Word, PPTX üretimi.

---

## Teknoloji Yığını

- **Frontend:** Vanilla HTML/CSS/JS — framework yok, React yok
- **AI API:** Groq (`llama-3.3-70b-versatile`) — Netlify serverless function üzerinden
- **Auth + DB:** Supabase (Auth, PostgreSQL, RLS açık)
- **Deployment:** Netlify (static hosting + serverless functions)
- **PPTX:** PptxGenJS v3.12.0 (CDN, client-side)
- **Font:** DM Sans (Google Fonts)
- **İkonlar:** Lucide Icons (CDN)
- **Görseller:** Wikipedia / Wikimedia Commons API (no API key, CORS açık)

## Dosya Yapısı

```
egitim-ai/
  app/
    index.html        # Dashboard
    create.html       # Belge oluşturma
    history.html      # Geçmiş
    templates.html    # Şablonlar
    pricing.html      # Planlar
    settings.html     # Ayarlar
    help.html         # Yardım
    js/
      app.js          # Tüm uygulama mantığı (~1250 satır)
    styles/
      app.css         # Uygulama stilleri
  index.html          # Landing page
  styles.css          # Landing page stilleri
  netlify/functions/
    generate.js       # AI generation serverless function
  netlify.toml        # Build config + cache headers
  build.js            # CSS cache-busting (Date.now() → ?v= parametresi)
  PAZAR_ANALIZI.md    # Pazar analizi ve iş modeli
```

## Plan Limitleri (PAZAR_ANALIZI.md'e göre)

| Plan       | Fiyat          | Belge/ay | Sayfa/belge |
|------------|----------------|----------|-------------|
| Ücretsiz   | 0₺             | 10       | 5           |
| Öğrenci    | 79₺/ay         | 60       | 20          |
| Pro        | 149₺/ay        | 150      | 30          |
| Kurumsal   | 100-200₺/öğretmen/ay | Sınırsız | 30   |

- `FREE_DOC_LIMIT = 10` (aylık, `created_at >= ay başı` ile filtrelenir)
- `FREE_PAGE_LIMIT = 5`
- Limit aşımında `showUpgradeModal()` çağrılır

## Önemli Uygulama Kararları

### AI Üretimi (`netlify/functions/generate.js`)
- `LANG_CONFIG` ile dil kısıtlaması prompt başında zorunlu tutulur
- `audienceBlock`: öğretmen vs öğrenci modu farklı pedagogik talimatlar verir
- PPTX için `SLAYT N: [Başlık]` formatı kullanılır
- `subject` parametresi prompt'a eklenir

### app.js Kritik Fonksiyonlar
- `stripMarkdown(text)`: PPTX'teki `**bold**`, `*italic*` işaretlerini temizler
- `parseSlidecontent()`: `stripMarkdown()` kullanır
- `fetchEducationalImage(query, lang)`: Wikipedia thumbnail → Wikimedia Commons fallback
- `imageUrlToBase64(url)`: fetch → blob → FileReader → base64, hatalar `null` döner
- `showUpgradeModal(reason)`: limit aşımı modalı
- Image fetch: `.catch(() => null)` ile hata izole edilir — ana flow'u kesmez

### Cache Busting
- `build.js` her Netlify deploy'unda HTML dosyalarındaki `?v=\d+` değerini `Date.now()` ile günceller
- `netlify.toml` `Cache-Control: must-revalidate` header'ı ekler

## Tasarım Kuralları

- **Renk:** Dark theme — `--bg: #0c0a08`, `--accent: #e8855a` (terracotta)
- **Font:** DM Sans 300–700, 9–40 optical size
- **Glassmorphism:** `--bg-card`, `--border: rgba(255,220,170,.07)`
- **Radius:** `--radius: 14px`
- **Animasyonlar:** `.fade-up`, `.fade-up--1/2/3` sınıfları — mevcut sistemi kullan

## Veritabanı

- Tablo: `documents` — `id`, `user_id`, `title`, `topic`, `format`, `language`, `created_at`
- RLS açık, kullanıcı sadece kendi belgelerini görür
- Aylık belge sayısı: `.gte('created_at', monthStart)` ile sorgulanır

## Önemli Uyarılar

- `app.js` tek dosya — fonksiyonlar bölünmez, tüm sayfalar bu dosyayı kullanır
- Supabase anahtarı `app.js` içinde hardcode (anon key, güvenli)
- Groq API anahtarı `netlify/functions/generate.js` içinde — **asla commit etme**
- Image fetch hataları `null` döner, Promise.all'ı kesmez
- `lucide.createIcons()` her sayfada DOMContentLoaded'da çağrılır
- `data-action="logout"` butonları `initLogout()` ile yönetilir
- `.env`, `credentials.json` asla commit edilmez
