'use strict';

/* =====================================================
   SUPABASE CONFIG
===================================================== */
const SUPABASE_URL      = 'https://bkeiwcxrdunicjvikfin.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJrZWl3Y3hyZHVuaWNqdmlrZmluIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5OTI1MTQsImV4cCI6MjA5MDU2ODUxNH0.GX97jQJbnGynrC09uJUTTOse_J7ZlAmpEu0AZr6jBAU';

let _sb = null;
function getSB() {
  if (!_sb) _sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return _sb;
}

/* =====================================================
   ICONS
===================================================== */
function initIcons(root) {
  if (!window.lucide) return;
  if (root) lucide.createIcons({ nodes: [root] });
  else lucide.createIcons();
}

/* =====================================================
   TOAST
===================================================== */
function showToast(message, type = 'info', duration = 3500) {
  const old = document.getElementById('app-toast');
  if (old) old.remove();

  const icons = { success: 'check-circle', error: 'alert-circle', info: 'info' };
  const toast = document.createElement('div');
  toast.id = 'app-toast';
  toast.className = `toast toast--${type}`;
  toast.innerHTML = `<span class="toast__icon"><i data-lucide="${icons[type] || 'info'}"></i></span><span>${message}</span>`;
  document.body.appendChild(toast);
  initIcons(toast);

  requestAnimationFrame(() => requestAnimationFrame(() => toast.classList.add('show')));
  setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 350); }, duration);
}

/* =====================================================
   FORM HELPERS
===================================================== */
function showFieldError(fieldEl, message) {
  fieldEl.classList.add('form-input--error');
  const container = fieldEl.closest('.form-group') || fieldEl.parentElement;
  let err = container.querySelector('.form-error');
  if (!err) { err = document.createElement('p'); err.className = 'form-error'; container.appendChild(err); }
  err.innerHTML = `<i data-lucide="alert-circle"></i> ${message}`;
  initIcons(err);
}

function clearAllErrors(formEl) {
  formEl.querySelectorAll('.form-input--error').forEach(el => el.classList.remove('form-input--error'));
  formEl.querySelectorAll('.form-error').forEach(el => el.remove());
}

function isValidEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()); }

/* =====================================================
   SIDEBAR
===================================================== */
function initSidebar() {
  const sidebar   = document.getElementById('sidebar');
  const overlay   = document.getElementById('sidebarOverlay');
  const toggleBtn = document.getElementById('sidebarToggle');
  if (!sidebar) return;

  const open  = () => { sidebar.classList.add('open');    overlay?.classList.add('show');    document.body.style.overflow = 'hidden'; };
  const close = () => { sidebar.classList.remove('open'); overlay?.classList.remove('show'); document.body.style.overflow = ''; };

  toggleBtn?.addEventListener('click', () => sidebar.classList.contains('open') ? close() : open());
  overlay?.addEventListener('click', close);
}

/* =====================================================
   USER INFO
===================================================== */
async function populateUserInfo() {
  const { data: { session } } = await getSB().auth.getSession();
  if (!session) return;

  const meta      = session.user.user_metadata || {};
  const firstName = meta.first_name || meta.firstName || session.user.email.split('@')[0];
  const lastName  = meta.last_name  || meta.lastName  || '';
  const initials  = (firstName[0] || '') + (lastName[0] || '');

  document.querySelectorAll('[data-user-name]').forEach(el   => el.textContent = `${firstName} ${lastName}`.trim());
  document.querySelectorAll('[data-user-email]').forEach(el  => el.textContent = session.user.email);
  document.querySelectorAll('[data-user-plan]').forEach(el   => el.textContent = 'Ücretsiz');
  document.querySelectorAll('[data-user-avatar]').forEach(el => el.textContent = initials || '?');
  document.querySelectorAll('[data-user-first]').forEach(el  => el.textContent = firstName);
}

/* =====================================================
   LOGOUT
===================================================== */
function initLogout() {
  document.querySelectorAll('[data-action="logout"]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      await getSB().auth.signOut();
      window.location.href = 'auth.html';
    });
  });
}

/* =====================================================
   AUTH GUARD
===================================================== */
async function requireAuth() {
  const { data: { session } } = await getSB().auth.getSession();
  if (!session) { window.location.href = 'auth.html'; return null; }
  return session;
}

/* =====================================================
   AUTH PAGE
===================================================== */
async function initAuthPage() {
  if (!document.getElementById('authPage')) return;

  const sb = getSB();
  const { data: { session } } = await sb.auth.getSession();
  if (session) { window.location.href = 'index.html'; return; }

  initIcons();

  const loginTab      = document.getElementById('loginTab');
  const registerTab   = document.getElementById('registerTab');
  const loginForm     = document.getElementById('loginForm');
  const registerForm  = document.getElementById('registerForm');
  const loginTitle    = document.getElementById('loginTitle');
  const loginSubtitle = document.getElementById('loginSubtitle');

  function showLogin() {
    loginTab.classList.add('active');
    registerTab.classList.remove('active');
    loginForm.classList.remove('hidden');
    registerForm.classList.add('hidden');
    if (loginTitle)    loginTitle.textContent    = 'Tekrar hoş geldiniz';
    if (loginSubtitle) loginSubtitle.textContent = 'Hesabınıza giriş yapın';
  }

  function showRegister() {
    registerTab.classList.add('active');
    loginTab.classList.remove('active');
    registerForm.classList.remove('hidden');
    loginForm.classList.add('hidden');
    if (loginTitle)    loginTitle.textContent    = 'Hesap oluşturun';
    if (loginSubtitle) loginSubtitle.textContent = 'Ücretsiz başlayın, kredi kartı gerekmez';
  }

  loginTab?.addEventListener('click', showLogin);
  registerTab?.addEventListener('click', showRegister);

  const params = new URLSearchParams(window.location.search);
  if (params.get('mode') === 'register') showRegister();

  // Password toggles
  document.querySelectorAll('[data-toggle-password]').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = document.getElementById(btn.dataset.togglePassword);
      if (!input) return;
      const isText = input.type === 'text';
      input.type = isText ? 'password' : 'text';
      const icon = btn.querySelector('[data-lucide]');
      if (icon) { icon.setAttribute('data-lucide', isText ? 'eye' : 'eye-off'); initIcons(btn); }
    });
  });

  // LOGIN
  loginForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearAllErrors(loginForm);

    const emailEl    = document.getElementById('loginEmail');
    const passwordEl = document.getElementById('loginPassword');
    let valid = true;

    if (!isValidEmail(emailEl.value))      { showFieldError(emailEl,    'Geçerli bir e-posta adresi girin.'); valid = false; }
    if (passwordEl.value.length < 6)       { showFieldError(passwordEl, 'Şifre en az 6 karakter olmalıdır.'); valid = false; }
    if (!valid) return;

    const btn = loginForm.querySelector('[type="submit"]');
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner"></span> Giriş yapılıyor...`;

    const { data, error } = await sb.auth.signInWithPassword({
      email: emailEl.value.trim(),
      password: passwordEl.value,
    });

    if (error) {
      btn.disabled = false;
      btn.innerHTML = `<i data-lucide="log-in"></i> Giriş Yap`;
      initIcons(btn);
      const msg = error.message.includes('Invalid') ? 'E-posta veya şifre hatalı.' : error.message;
      showFieldError(emailEl, msg);
      showToast(msg, 'error');
    } else {
      showToast('Giriş başarılı! Yönlendiriliyorsunuz...', 'success');
      setTimeout(() => { window.location.href = 'index.html'; }, 800);
    }
  });

  // REGISTER
  registerForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearAllErrors(registerForm);

    const firstEl    = document.getElementById('registerFirst');
    const lastEl     = document.getElementById('registerLast');
    const emailEl    = document.getElementById('registerEmail');
    const passwordEl = document.getElementById('registerPassword');
    const confirmEl  = document.getElementById('registerConfirm');
    let valid = true;

    if (firstEl.value.trim().length < 2)   { showFieldError(firstEl,    'Ad en az 2 karakter olmalıdır.');    valid = false; }
    if (lastEl.value.trim().length < 2)    { showFieldError(lastEl,     'Soyad en az 2 karakter olmalıdır.'); valid = false; }
    if (!isValidEmail(emailEl.value))      { showFieldError(emailEl,    'Geçerli bir e-posta adresi girin.'); valid = false; }
    if (passwordEl.value.length < 6)       { showFieldError(passwordEl, 'Şifre en az 6 karakter olmalıdır.'); valid = false; }
    if (confirmEl.value !== passwordEl.value) { showFieldError(confirmEl, 'Şifreler eşleşmiyor.');            valid = false; }
    if (!valid) return;

    const btn = registerForm.querySelector('[type="submit"]');
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner"></span> Hesap oluşturuluyor...`;

    const { data, error } = await sb.auth.signUp({
      email: emailEl.value.trim(),
      password: passwordEl.value,
      options: { data: { first_name: firstEl.value.trim(), last_name: lastEl.value.trim() } }
    });

    if (error) {
      btn.disabled = false;
      btn.innerHTML = `<i data-lucide="user-plus"></i> Ücretsiz Kayıt Ol`;
      initIcons(btn);
      showFieldError(emailEl, error.message);
      showToast(error.message, 'error');
    } else if (data.user && !data.session) {
      btn.innerHTML = `✓ E-posta gönderildi!`;
      showToast('E-postanıza bir onay linki gönderildi. Lütfen kontrol edin.', 'info', 7000);
    } else {
      showToast('Hesabınız oluşturuldu!', 'success');
      setTimeout(() => { window.location.href = 'index.html'; }, 800);
    }
  });

  // Google (yakında)
  document.querySelectorAll('[data-action="google-auth"]').forEach(btn => {
    btn.addEventListener('click', () => showToast('Google girişi yakında aktif olacak.', 'info'));
  });
}

/* =====================================================
   DASHBOARD PAGE
===================================================== */
async function initDashboard() {
  if (!document.getElementById('dashboardPage')) return;

  const session = await requireAuth();
  if (!session) return;

  await populateUserInfo();
  initSidebar();
  initLogout();
  initIcons();

  const sb = getSB();
  const { data: docs } = await sb
    .from('documents')
    .select('*')
    .eq('user_id', session.user.id)
    .order('created_at', { ascending: false })
    .limit(20);

  const total = docs?.length || 0;
  animateCounter(document.getElementById('statDocs'),      total);
  animateCounter(document.getElementById('statDownloads'), total);
  animateCounter(document.getElementById('statHours'),     Math.ceil(total * 0.5));
  animateCounter(document.getElementById('statCredits'),   Math.max(0, 10 - total));

  renderDocsTable(docs || []);
}

function animateCounter(el, target) {
  if (!el) return;
  const duration = 900;
  const start = performance.now();
  const tick = (now) => {
    const p = Math.min((now - start) / duration, 1);
    el.textContent = Math.round((1 - Math.pow(1 - p, 3)) * target).toLocaleString('tr-TR');
    if (p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function renderDocsTable(docs) {
  const table = document.querySelector('.docs-table');
  if (!table) return;

  const header = table.querySelector('.docs-table__header');
  table.innerHTML = '';
  if (header) table.appendChild(header);

  if (docs.length === 0) {
    const empty = document.createElement('div');
    empty.style.cssText = 'padding:40px 24px;text-align:center;color:var(--text-3);font-size:14px;';
    empty.innerHTML = `<div style="font-size:32px;margin-bottom:12px;">📄</div>Henüz belge oluşturmadınız.<br><a href="create.html" style="color:var(--accent);text-decoration:none;font-weight:500;">İlk belgenizi oluşturun →</a>`;
    table.appendChild(empty);
    return;
  }

  const typeIcon  = { pdf: 'PDF', word: 'DOC', pptx: 'PPT' };
  const typeLabel = { pdf: 'PDF', word: 'DOCX', pptx: 'PPTX' };

  docs.forEach(doc => {
    const row = document.createElement('div');
    row.className = 'docs-table__row';
    const date = new Date(doc.created_at).toLocaleDateString('tr-TR', { day:'numeric', month:'short', year:'numeric' });
    row.innerHTML = `
      <div class="docs-table__name">
        <div class="doc-icon doc-icon--${doc.type}">${typeIcon[doc.type] || 'DOC'}</div>
        <span>${escapeHtml(doc.title)}</span>
      </div>
      <div class="docs-table__type"><span class="badge badge--${doc.type}">${typeLabel[doc.type] || doc.type.toUpperCase()}</span></div>
      <div class="docs-table__size">${doc.pages} sayfa</div>
      <div class="docs-table__date">${date}</div>
      <div class="docs-table__actions">
        <button class="btn btn--icon btn--ghost" title="İndir" data-doc-id="${doc.id}">
          <i data-lucide="download"></i>
        </button>
      </div>`;
    table.appendChild(row);
  });

  initIcons();

  table.querySelectorAll('[data-doc-id]').forEach(btn => {
    btn.addEventListener('click', () => {
      const doc = docs.find(d => d.id === btn.dataset.docId);
      if (doc) downloadDocument(doc.title, doc.type, doc.content, doc.pages);
    });
  });
}

/* =====================================================
   CREATE PAGE
===================================================== */
async function initCreatePage() {
  if (!document.getElementById('createPage')) return;

  const session = await requireAuth();
  if (!session) return;

  await populateUserInfo();
  initSidebar();
  initLogout();

  let selectedType     = 'pdf';
  let selectedAudience = 'teacher';
  let generatedContent = '';
  let generatedTitle   = '';

  // Toggles
  document.querySelectorAll('[data-doc-type]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-doc-type]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedType = btn.dataset.docType;
    });
  });

  document.querySelectorAll('[data-audience]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-audience]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedAudience = btn.dataset.audience;
    });
  });

  const pageRange = document.getElementById('pageCount');
  const pageValue = document.getElementById('pageCountValue');
  pageRange?.addEventListener('input', () => { if (pageValue) pageValue.textContent = pageRange.value; });

  // Form submit
  const createForm  = document.getElementById('createForm');
  const generateBtn = document.getElementById('generateBtn');

  createForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearAllErrors(createForm);

    const topicInput = document.getElementById('topicInput');
    const topic = topicInput.value.trim();
    if (topic.length < 5) { showFieldError(topicInput, 'Konu en az 5 karakter olmalıdır.'); return; }

    const extraNotes = document.getElementById('extraNotes')?.value || '';
    const pages      = pageRange?.value || '5';
    const gradeLevel = document.getElementById('gradeLevel')?.value || '';
    const language   = document.getElementById('docLanguage')?.value || 'tr';
    const tone       = document.getElementById('docTone')?.value || 'formal';

    generatedTitle = topic.slice(0, 60);
    await runGeneration({ topic, extraNotes, type: selectedType, audience: selectedAudience, pages, gradeLevel, language, tone, session });
  });

  // Download buttons
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action="download"]');
    if (btn && generatedContent) {
      downloadDocument(generatedTitle, selectedType, generatedContent, pageRange?.value || '5');
    }
  });

  initIcons();

  async function runGeneration(params) {
    const panel       = document.getElementById('generationPanel');
    const resultPanel = document.getElementById('generationResult');
    const progressFill = document.getElementById('progressFill');
    const resultTitle  = document.getElementById('resultTitle');
    const resultMeta   = document.getElementById('resultMeta');

    const steps = ['step-analyze', 'step-outline', 'step-content', 'step-format', 'step-export'];

    // Reset UI
    generateBtn.disabled = true;
    generateBtn.innerHTML = `<span class="spinner"></span> Oluşturuluyor...`;
    resultPanel?.classList.remove('visible');
    if (progressFill) progressFill.style.width = '0%';
    steps.forEach(id => { const el = document.getElementById(id); if (el) { el.classList.remove('active','done'); } });
    panel?.classList.add('visible');
    panel?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    // Animate steps while waiting for API
    let stepIdx = 0;
    const stepTimer = setInterval(() => {
      if (stepIdx > 0) {
        const prev = document.getElementById(steps[stepIdx - 1]);
        if (prev) { prev.classList.remove('active'); prev.classList.add('done'); }
      }
      if (stepIdx < steps.length) {
        const el = document.getElementById(steps[stepIdx]);
        if (el) el.classList.add('active');
        if (progressFill) progressFill.style.width = `${Math.round(((stepIdx + 1) / steps.length) * 80)}%`;
        stepIdx++;
      }
    }, 1400);

    try {
      const response = await fetch('/.netlify/functions/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic:      params.topic,
          extraNotes: params.extraNotes,
          type:       params.type,
          audience:   params.audience,
          pages:      params.pages,
          gradeLevel: params.gradeLevel,
          language:   params.language,
          tone:       params.tone,
        })
      });

      clearInterval(stepTimer);

      if (!response.ok) throw new Error('Sunucu hatası. Lütfen tekrar deneyin.');

      const json = await response.json();
      if (json.error) throw new Error(json.error);

      generatedContent = json.content;

      // Complete all steps
      steps.forEach(id => { const el = document.getElementById(id); if (el) { el.classList.remove('active'); el.classList.add('done'); } });
      if (progressFill) progressFill.style.width = '100%';

      setTimeout(async () => {
        const typeLabels = { pdf: 'PDF', word: 'Word', pptx: 'PowerPoint' };
        if (resultTitle) resultTitle.textContent = `${generatedTitle}.${params.type === 'word' ? 'docx' : params.type}`;
        if (resultMeta)  resultMeta.textContent  = `${typeLabels[params.type]} • ${params.pages} sayfa • ${params.audience === 'teacher' ? 'Öğretmen' : 'Öğrenci'} hedefli`;
        resultPanel?.classList.add('visible');
        showToast('Belgeniz başarıyla oluşturuldu!', 'success');

        generateBtn.disabled = false;
        generateBtn.innerHTML = `<i data-lucide="sparkles"></i> Yeni Belge Oluştur`;
        initIcons(generateBtn);

        // Supabase'e kaydet
        await getSB().from('documents').insert({
          user_id:  params.session.user.id,
          title:    generatedTitle,
          type:     params.type,
          content:  generatedContent,
          pages:    parseInt(params.pages, 10),
          audience: params.audience,
        });
      }, 400);

    } catch (err) {
      clearInterval(stepTimer);
      generateBtn.disabled = false;
      generateBtn.innerHTML = `<i data-lucide="sparkles"></i> Belge Oluştur`;
      initIcons(generateBtn);
      panel?.classList.remove('visible');
      showToast(err.message || 'Bir hata oluştu, tekrar deneyin.', 'error');
    }
  }
}

/* =====================================================
   DOCUMENT DOWNLOAD
===================================================== */
function downloadDocument(title, type, content, pages) {
  if (type === 'pdf')  generatePDF(title, content);
  else if (type === 'word')  generateWord(title, content);
  else if (type === 'pptx')  generatePPTX(title, content, pages);
}

function generatePDF(title, content) {
  const body = `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<title>${escapeHtml(title)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; color: #222; font-size: 12pt; line-height: 1.7; }
  h1 { font-size: 20pt; color: #1a1a2e; border-bottom: 2px solid #7990f8; padding-bottom: 10px; margin: 0 0 24px; }
  h2 { font-size: 14pt; color: #2d2d4e; margin: 24px 0 8px; }
  h3 { font-size: 12pt; color: #444; margin: 16px 0 6px; }
  p  { margin: 0 0 10px; }
  ul, ol { margin: 0 0 10px 22px; }
  li { margin-bottom: 4px; }
  strong { color: #1a1a2e; }
  .footer { margin-top: 48px; font-size: 9pt; color: #aaa; border-top: 1px solid #eee; padding-top: 10px; }
  @media print { @page { margin: 2cm; } body { padding: 0; } }
</style>
</head>
<body>
${markdownToHtml(content)}
<div class="footer">EgitimAI tarafından oluşturuldu &mdash; ${new Date().toLocaleDateString('tr-TR')}</div>
<script>setTimeout(() => { window.print(); }, 600);<\/script>
</body>
</html>`;

  const blob = new Blob([body], { type: 'text/html;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const win  = window.open(url, '_blank');
  if (!win) showToast('Açılır pencere engellendi. Tarayıcı ayarlarından izin verin.', 'error');
}

function generateWord(title, content) {
  const html = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head>
<meta charset="UTF-8">
<style>
  body   { font-family: Arial, sans-serif; font-size: 12pt; line-height: 1.6; margin: 2cm; }
  h1     { font-size: 18pt; color: #1a1a2e; border-bottom: 1px solid #7990f8; padding-bottom: 6pt; }
  h2     { font-size: 14pt; color: #2d2d4e; }
  h3     { font-size: 12pt; color: #444; }
  p      { margin-bottom: 8pt; }
  ul, ol { margin-left: 18pt; }
  li     { margin-bottom: 3pt; }
  .footer{ color: #aaa; font-size: 9pt; margin-top: 36pt; border-top: 1px solid #eee; padding-top: 6pt; }
</style>
</head>
<body>
${markdownToHtml(content)}
<p class="footer">EgitimAI tarafından oluşturuldu &mdash; ${new Date().toLocaleDateString('tr-TR')}</p>
</body>
</html>`;

  const blob = new Blob(['\ufeff', html], { type: 'application/msword;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `${sanitizeFilename(title)}.doc`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast('Word belgesi indiriliyor...', 'success');
}

function generatePPTX(title, content, pages) {
  if (!window.PptxGenJS) {
    showToast('PowerPoint kütüphanesi henüz yüklenmedi. Lütfen bekleyin ve tekrar deneyin.', 'error');
    return;
  }

  const slides = parseSlidecontent(content);
  const pptx   = new PptxGenJS();

  slides.forEach((slide, i) => {
    const s = pptx.addSlide();

    if (i === 0) {
      // Kapak slaydı
      s.background = { color: '1a1a2e' };
      s.addText(slide.title, {
        x: 0.5, y: 2.2, w: 9, h: 1.4,
        fontSize: 28, bold: true, color: 'FFFFFF', align: 'center',
      });
      if (slide.bullets[0]) {
        s.addText(slide.bullets[0], {
          x: 0.5, y: 3.8, w: 9, h: 0.7,
          fontSize: 14, color: 'aaaacc', align: 'center',
        });
      }
      s.addText('EgitimAI', {
        x: 0.5, y: 6.8, w: 9, h: 0.4,
        fontSize: 9, color: '555577', align: 'center',
      });
    } else {
      // Normal slayt
      s.background = { color: 'f8f9ff' };
      s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 10, h: 0.06, fill: { color: '7990f8' } });
      s.addText(slide.title, {
        x: 0.4, y: 0.2, w: 9.2, h: 0.8,
        fontSize: 18, bold: true, color: '1a1a2e',
      });
      if (slide.bullets.length > 0) {
        const bulletItems = slide.bullets.map(b => ({ text: b, options: { bullet: { type: 'bullet' }, paraSpaceAfter: 6 } }));
        s.addText(bulletItems, {
          x: 0.4, y: 1.2, w: 9.2, h: 5.8,
          fontSize: 13, color: '333344', valign: 'top',
        });
      }
      s.addText(`${i + 1} / ${slides.length}`, {
        x: 8.5, y: 7.1, w: 1.2, h: 0.3,
        fontSize: 8, color: 'aaaaaa', align: 'right',
      });
    }
  });

  pptx.writeFile({ fileName: `${sanitizeFilename(title)}.pptx` });
  showToast('PowerPoint indiriliyor...', 'success');
}

function parseSlidecontent(content) {
  const slides  = [];
  const lines   = content.split('\n');
  let current   = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const match = trimmed.match(/^SLAYT\s*\d+\s*[:：]\s*(.+)/i);
    if (match) {
      if (current) slides.push(current);
      current = { title: match[1].trim(), bullets: [] };
    } else if (current) {
      if (/^[-•*]\s+/.test(trimmed)) {
        const b = trimmed.replace(/^[-•*]\s+/, '').trim();
        if (b) current.bullets.push(b);
      } else if (!/^#+/.test(trimmed)) {
        current.bullets.push(trimmed);
      }
    }
  }
  if (current) slides.push(current);

  // Fallback
  if (slides.length === 0) {
    slides.push({ title: 'Sunum', bullets: content.split('\n').filter(l => l.trim()).slice(0, 6) });
  }

  return slides;
}

/* =====================================================
   MARKDOWN → HTML
===================================================== */
function markdownToHtml(text) {
  const lines  = text.split('\n');
  let html     = '';
  let inUL     = false;
  let inOL     = false;

  const closeList = () => {
    if (inUL) { html += '</ul>\n'; inUL = false; }
    if (inOL) { html += '</ol>\n'; inOL = false; }
  };

  const inline = (s) => s
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g,     '<em>$1</em>');

  for (const line of lines) {
    const t = line.trim();
    if (!t) { closeList(); html += '\n'; continue; }

    if (t.startsWith('# '))       { closeList(); html += `<h1>${inline(t.slice(2))}</h1>\n`; }
    else if (t.startsWith('## ')) { closeList(); html += `<h2>${inline(t.slice(3))}</h2>\n`; }
    else if (t.startsWith('### ')){ closeList(); html += `<h3>${inline(t.slice(4))}</h3>\n`; }
    else if (/^[-*•] /.test(t))  {
      if (inOL) { html += '</ol>\n'; inOL = false; }
      if (!inUL){ html += '<ul>\n'; inUL = true; }
      html += `<li>${inline(t.replace(/^[-*•] /, ''))}</li>\n`;
    } else if (/^\d+\. /.test(t)) {
      if (inUL) { html += '</ul>\n'; inUL = false; }
      if (!inOL){ html += '<ol>\n'; inOL = true; }
      html += `<li>${inline(t.replace(/^\d+\. /, ''))}</li>\n`;
    } else {
      closeList();
      html += `<p>${inline(t)}</p>\n`;
    }
  }
  closeList();
  return html;
}

/* =====================================================
   UTILS
===================================================== */
function sanitizeFilename(name) {
  return name.replace(/[/\\?%*:|"<>]/g, '-').slice(0, 60) || 'belge';
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* =====================================================
   INIT
===================================================== */
document.addEventListener('DOMContentLoaded', () => {
  initIcons();
  initAuthPage();
  initDashboard();
  initCreatePage();
});
