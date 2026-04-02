'use strict';

/* =====================================================
   SUPABASE CONFIG
===================================================== */
const SUPABASE_URL      = 'https://bkeiwcxrdunicjvikfin.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJrZWl3Y3hyZHVuaWNqdmlrZmluIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5OTI1MTQsImV4cCI6MjA5MDU2ODUxNH0.GX97jQJbnGynrC09uJUTTOse_J7ZlAmpEu0AZr6jBAU';

/* Free plan limits */
const FREE_DOC_LIMIT  = 5;   // per month
const FREE_PAGE_LIMIT = 5;

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
   THEME TOGGLE
===================================================== */
function initTheme() {
  const saved = localStorage.getItem('egitim-theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
  updateThemeIcon(saved);
}

function toggleTheme() {
  const curr = document.documentElement.getAttribute('data-theme') || 'dark';
  const next = curr === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('egitim-theme', next);
  updateThemeIcon(next);
}

function updateThemeIcon(theme) {
  const btn = document.getElementById('themeToggle');
  if (!btn) return;
  const icon = btn.querySelector('i');
  if (icon) {
    icon.setAttribute('data-lucide', theme === 'dark' ? 'sun' : 'moon');
    if (window.lucide) lucide.createIcons({ nodes: [btn] });
  }
  btn.onclick = toggleTheme;
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
   UPGRADE MODAL
===================================================== */
function showUpgradeModal(reason = '') {
  const existing = document.getElementById('upgradeModal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'upgradeModal';
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-box">
      <div class="modal-icon"><i data-lucide="crown"></i></div>
      <h2 class="modal-title">Pro Plana Geç</h2>
      <p class="modal-desc">${reason || 'Ücretsiz planın 3 belge limitine ulaştınız.'}</p>
      <div class="modal-features">
        <div class="modal-feature"><i data-lucide="check"></i> Sınırsız belge oluşturma</div>
        <div class="modal-feature"><i data-lucide="check"></i> 30 sayfaya kadar</div>
        <div class="modal-feature"><i data-lucide="check"></i> Otomatik görsel ekleme</div>
        <div class="modal-feature"><i data-lucide="check"></i> Klasörler ve organizasyon</div>
      </div>
      <div class="modal-actions">
        <a href="pricing.html" class="btn btn--primary btn--lg">
          <i data-lucide="crown"></i> Planları İncele
        </a>
        <button class="btn btn--ghost" id="upgradeModalClose">Şimdi değil</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  initIcons(modal);

  document.getElementById('upgradeModalClose')?.addEventListener('click', () => modal.remove());
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
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
   IMAGE FETCH — Wikipedia / Wikimedia Commons
===================================================== */
async function fetchEducationalImage(query, language) {
  if (!query) return null;
  const wikiLang = language === 'tr' ? 'tr' : 'en';

  try {
    // 1. Wikipedia article thumbnail
    const url1 = `https://${wikiLang}.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(query)}&prop=pageimages&format=json&pithumbsize=700&origin=*`;
    const r1   = await fetch(url1);
    if (r1.ok) {
      const d1    = await r1.json();
      const pages = d1.query?.pages;
      if (pages) {
        const thumb = Object.values(pages)[0]?.thumbnail?.source;
        if (thumb) return thumb;
      }
    }
  } catch (_) {}

  try {
    // 2. Wikimedia Commons search
    const url2 = `https://commons.wikimedia.org/w/api.php?action=query&list=allimages&ailimit=6&aisearch=${encodeURIComponent(query)}&format=json&origin=*&aiprop=url|size|mediatype&aisort=relevance`;
    const r2   = await fetch(url2);
    if (r2.ok) {
      const d2   = await r2.json();
      const imgs = d2.query?.allimages || [];
      const ok   = imgs.find(i =>
        i.mediatype === 'BITMAP' &&
        (i.url.toLowerCase().endsWith('.jpg') || i.url.toLowerCase().endsWith('.png') || i.url.toLowerCase().endsWith('.jpeg')) &&
        (i.width || 0) >= 400 && (i.height || 0) >= 300
      );
      if (ok?.url) return ok.url;
      if (imgs[0]?.url) return imgs[0].url;
    }
  } catch (_) {}

  return null;
}

async function imageUrlToBase64(url) {
  try {
    const res  = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload  = () => resolve(reader.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
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
    if (!isValidEmail(emailEl.value))  { showFieldError(emailEl,    'Geçerli bir e-posta adresi girin.'); valid = false; }
    if (passwordEl.value.length < 6)   { showFieldError(passwordEl, 'Şifre en az 6 karakter olmalıdır.'); valid = false; }
    if (!valid) return;

    const btn = loginForm.querySelector('[type="submit"]');
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner"></span> Giriş yapılıyor...`;

    const { error } = await sb.auth.signInWithPassword({ email: emailEl.value.trim(), password: passwordEl.value });
    if (error) {
      btn.disabled = false;
      btn.innerHTML = `<i data-lucide="log-in"></i> Giriş Yap`;
      initIcons(btn);
      const msg = error.message.includes('Invalid') ? 'E-posta veya şifre hatalı.' : error.message;
      showFieldError(emailEl, msg);
      showToast(msg, 'error');
    } else {
      showToast('Giriş başarılı!', 'success');
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
    if (firstEl.value.trim().length < 2)        { showFieldError(firstEl,    'Ad en az 2 karakter olmalıdır.');    valid = false; }
    if (lastEl.value.trim().length < 2)         { showFieldError(lastEl,     'Soyad en az 2 karakter olmalıdır.'); valid = false; }
    if (!isValidEmail(emailEl.value))           { showFieldError(emailEl,    'Geçerli bir e-posta adresi girin.'); valid = false; }
    if (passwordEl.value.length < 6)            { showFieldError(passwordEl, 'Şifre en az 6 karakter olmalıdır.'); valid = false; }
    if (confirmEl.value !== passwordEl.value)   { showFieldError(confirmEl,  'Şifreler eşleşmiyor.');              valid = false; }
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
      showToast('E-postanıza bir onay linki gönderildi.', 'info', 7000);
    } else {
      showToast('Hesabınız oluşturuldu!', 'success');
      setTimeout(() => { window.location.href = 'index.html'; }, 800);
    }
  });

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
  const remaining = document.getElementById('statRemaining');
  if (remaining) remaining.textContent = Math.max(0, FREE_DOC_LIMIT - total);

  renderDocsTable(docs || []);
}

function animateCounter(el, target) {
  if (!el) return;
  const duration = 900;
  const start    = performance.now();
  const tick     = (now) => {
    const p = Math.min((now - start) / duration, 1);
    el.textContent = Math.round((1 - Math.pow(1 - p, 3)) * target).toLocaleString('tr-TR');
    if (p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function renderDocsTable(docs, showDelete = false, folders = [], onFolderChange = null) {
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
    const row  = document.createElement('div');
    row.className = 'docs-table__row';
    const date = new Date(doc.created_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' });
    const deleteBtn = showDelete
      ? `<button class="btn btn--icon btn--ghost" title="Sil" data-delete-id="${doc.id}" style="color:var(--danger)"><i data-lucide="trash-2"></i></button>`
      : '';
    const folderBtn = (showDelete && folders.length && onFolderChange)
      ? `<button class="btn btn--icon btn--ghost" title="Klasöre taşı" data-folder-move-id="${doc.id}" data-current-folder="${doc.folder_id || ''}"><i data-lucide="folder-input"></i></button>`
      : '';
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
        ${folderBtn}
        ${deleteBtn}
      </div>`;
    table.appendChild(row);
  });

  initIcons();

  table.querySelectorAll('[data-doc-id]').forEach(btn => {
    btn.addEventListener('click', () => {
      const doc = docs.find(d => d.id === btn.dataset.docId);
      if (doc) downloadDocument(doc.title, doc.type, doc.content, doc.pages, null);
    });
  });

  if (showDelete) {
    table.querySelectorAll('[data-delete-id]').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Bu belgeyi silmek istediğinize emin misiniz?')) return;
        const { error } = await getSB().from('documents').delete().eq('id', btn.dataset.deleteId);
        if (!error) {
          btn.closest('.docs-table__row').remove();
          showToast('Belge silindi.', 'success');
        } else {
          showToast('Silme işlemi başarısız.', 'error');
        }
      });
    });
  }

  if (onFolderChange && folders.length) {
    table.querySelectorAll('[data-folder-move-id]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        showFolderPickerMenu(btn, btn.dataset.folderMoveId, btn.dataset.currentFolder, folders, onFolderChange);
      });
    });
  }
}

function showFolderPickerMenu(anchorEl, docId, currentFolderId, folders, onFolderChange) {
  document.getElementById('folderPickerMenu')?.remove();

  const menu = document.createElement('div');
  menu.id = 'folderPickerMenu';
  menu.className = 'context-menu';

  const noneItem = `<button class="context-menu__item ${!currentFolderId ? 'context-menu__item--active' : ''}" data-pick-folder=""><i data-lucide="x"></i> Klasör yok</button>`;
  const folderItems = folders.map(f =>
    `<button class="context-menu__item ${currentFolderId === f.id ? 'context-menu__item--active' : ''}" data-pick-folder="${f.id}"><i data-lucide="folder"></i> ${escapeHtml(f.name)}</button>`
  ).join('');

  menu.innerHTML = `<div class="context-menu__header">Klasöre Taşı</div>${noneItem}${folderItems}`;

  const rect = anchorEl.getBoundingClientRect();
  menu.style.cssText = `position:fixed;top:${rect.bottom + 4}px;right:${window.innerWidth - rect.right}px;z-index:1000;min-width:180px;`;
  document.body.appendChild(menu);
  initIcons(menu);

  const close = () => menu.remove();
  setTimeout(() => document.addEventListener('click', close, { once: true }), 0);

  menu.querySelectorAll('[data-pick-folder]').forEach(item => {
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      close();
      const fid = item.dataset.pickFolder || null;
      anchorEl.dataset.currentFolder = fid || '';
      onFolderChange(docId, fid);
    });
  });
}

/* =====================================================
   HISTORY PAGE
===================================================== */
async function initHistoryPage() {
  if (!document.getElementById('historyPage')) return;

  const session = await requireAuth();
  if (!session) return;

  await populateUserInfo();
  initSidebar();
  initLogout();
  initIcons();

  const sb = getSB();

  // Load folders for "move to folder" dropdown
  let userFolders = [];
  (async () => {
    const { data } = await sb.from('folders').select('id, name').eq('user_id', session.user.id).order('name');
    userFolders = data || [];
  })();

  async function loadDocs(searchQuery = '') {
    let query = sb
      .from('documents')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false });

    if (searchQuery) {
      query = query.ilike('title', `%${searchQuery}%`);
    }

    const { data: docs } = await query;
    renderDocsTable(docs || [], true, userFolders, async (docId, folderId) => {
      await sb.from('documents').update({ folder_id: folderId || null }).eq('id', docId);
      showToast(folderId ? 'Klasöre taşındı.' : 'Klasörden çıkarıldı.', 'success');
    });
  }

  await loadDocs();

  // Search
  const searchInput = document.getElementById('historySearch');
  let searchTimer;
  searchInput?.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => loadDocs(searchInput.value.trim()), 400);
  });
}

/* =====================================================
   TEMPLATES PAGE
===================================================== */
function initTemplatesPage() {
  if (!document.getElementById('templatesPage')) return;

  const session_check = requireAuth().then(session => {
    if (!session) return;
    populateUserInfo();
    initSidebar();
    initLogout();
    initIcons();
  });

  const templates = [
    { icon: 'file-text',    title: 'Çoktan Seçmeli Sınav',     desc: '20 soruluk, 4 şıklı çoktan seçmeli sınav', type: 'pdf',  audience: 'teacher', topic: '20 soruluk çoktan seçmeli sınav', subject: 'Matematik' },
    { icon: 'book-open',    title: 'Ders Planı',                desc: 'Kazanımlar, yöntemler ve değerlendirme içeren tam ders planı', type: 'word', audience: 'teacher', topic: 'Haftalık ders planı', subject: 'Türkçe' },
    { icon: 'presentation', title: 'Konu Sunumu',               desc: 'Görsel ve etkileyici PowerPoint sunumu', type: 'pptx',  audience: 'teacher', topic: 'Konu sunumu', subject: 'Fen Bilimleri' },
    { icon: 'clipboard',    title: 'Konu Özeti (Öğrenci)',      desc: 'Öğrenci için sade ve anlaşılır konu özeti', type: 'pdf',  audience: 'student', topic: 'Konu özeti çalışma notu', subject: 'Tarih' },
    { icon: 'edit',         title: 'Alıştırma Soruları',        desc: 'Cevaplı alıştırma ve pratik soruları', type: 'pdf',  audience: 'student', topic: 'Alıştırma soruları ve çözümleri', subject: 'Matematik' },
    { icon: 'layers',       title: 'Yıllık Plan',               desc: 'Aylık konu dağılımı içeren yıllık plan', type: 'word', audience: 'teacher', topic: 'Yıllık ders planı', subject: 'Coğrafya' },
    { icon: 'flask-conical','title': 'Deney Raporu',            desc: 'Fen bilimleri laboratuvar deney raporu', type: 'pdf',  audience: 'student', topic: 'Deney raporu şablonu', subject: 'Fen Bilimleri' },
    { icon: 'bar-chart',    title: 'Değerlendirme Rubriği',     desc: 'Ödev ve proje değerlendirme kriterleri', type: 'word', audience: 'teacher', topic: 'Değerlendirme rubriği', subject: 'Tüm Dersler' },
    { icon: 'globe',        title: 'İngilizce Konu Belgesi',    desc: 'İngilizce olarak hazırlanmış konu belgesi', type: 'pdf', audience: 'student', topic: 'Topic study notes', subject: 'İngilizce', language: 'en' },
    { icon: 'users',        title: 'Grup Aktivitesi Planı',     desc: 'İşbirlikli öğrenme etkinlik planı', type: 'word', audience: 'teacher', topic: 'Grup çalışması etkinlik planı', subject: 'Sosyal Bilgiler' },
    { icon: 'calculator',   title: 'Matematik Çalışma Kağıdı',  desc: 'Adım adım çözümlü matematik soruları', type: 'pdf', audience: 'student', topic: 'Matematik çalışma kağıdı ve çözümler', subject: 'Matematik' },
    { icon: 'mic',          title: 'Münazara / Sunum Kılavuzu', desc: 'Öğrenciler için sunum ve münazara kılavuzu', type: 'word', audience: 'student', topic: 'Sunum ve münazara kılavuzu', subject: 'Türkçe' },
  ];

  const grid = document.querySelector('.templates-grid');
  if (!grid) return;

  grid.innerHTML = templates.map(t => `
    <div class="template-card" data-template='${JSON.stringify(t)}'>
      <div class="template-card__icon"><i data-lucide="${t.icon}"></i></div>
      <div class="template-card__body">
        <div class="template-card__title">${t.title}</div>
        <div class="template-card__desc">${t.desc}</div>
        <div class="template-card__meta">
          <span class="badge badge--${t.type}">${t.type.toUpperCase()}</span>
          <span class="badge" style="background:rgba(255,220,170,.08);color:var(--text-2);">${t.subject}</span>
        </div>
      </div>
      <button class="btn btn--primary btn--sm template-card__btn">
        <i data-lucide="arrow-right"></i> Kullan
      </button>
    </div>`).join('');

  initIcons(grid);

  grid.querySelectorAll('.template-card').forEach(card => {
    card.querySelector('.template-card__btn')?.addEventListener('click', () => {
      const t = JSON.parse(card.dataset.template);
      const params = new URLSearchParams({
        topic:    t.topic,
        type:     t.type,
        audience: t.audience,
        subject:  t.subject,
        ...(t.language ? { language: t.language } : {}),
      });
      window.location.href = `create.html?${params.toString()}`;
    });
  });
}

/* =====================================================
   SETTINGS PAGE
===================================================== */
async function initSettingsPage() {
  if (!document.getElementById('settingsPage')) return;

  const session = await requireAuth();
  if (!session) return;

  await populateUserInfo();
  initSidebar();
  initLogout();
  initIcons();

  const meta      = session.user.user_metadata || {};
  const firstName = meta.first_name || meta.firstName || '';
  const lastName  = meta.last_name  || meta.lastName  || '';

  const firstEl = document.getElementById('settingsFirst');
  const lastEl  = document.getElementById('settingsLast');
  const emailEl = document.getElementById('settingsEmail');
  if (firstEl) firstEl.value = firstName;
  if (lastEl)  lastEl.value  = lastName;
  if (emailEl) emailEl.value = session.user.email;

  // Get monthly doc count for plan display
  const sb = getSB();
  const settingsNow = new Date();
  const settingsMonthStart = new Date(settingsNow.getFullYear(), settingsNow.getMonth(), 1).toISOString();
  const { count } = await sb
    .from('documents')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', session.user.id)
    .gte('created_at', settingsMonthStart);

  const usageBar = document.getElementById('planUsageBar');
  const usageText = document.getElementById('planUsageText');
  if (usageBar)  usageBar.style.width  = `${Math.min(100, ((count || 0) / FREE_DOC_LIMIT) * 100)}%`;
  if (usageText) usageText.textContent = `${count || 0} / ${FREE_DOC_LIMIT} belge bu ay kullanıldı`;

  const settingsForm = document.getElementById('settingsForm');
  settingsForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = settingsForm.querySelector('[type="submit"]');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Kaydediliyor...';

    const { error } = await getSB().auth.updateUser({
      data: {
        first_name: firstEl?.value.trim() || firstName,
        last_name:  lastEl?.value.trim()  || lastName,
      }
    });

    btn.disabled = false;
    btn.innerHTML = '<i data-lucide="save"></i> Kaydet';
    initIcons(btn);

    if (error) {
      showToast('Güncelleme başarısız: ' + error.message, 'error');
    } else {
      showToast('Profil güncellendi!', 'success');
      await populateUserInfo();
    }
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
  let generatedContent  = '';
  let generatedTitle    = '';
  let generatedImageUrl = null;  // reserved for future use

  // Load user folders into dropdown
  (async () => {
    const folderSelect = document.getElementById('docFolder');
    if (!folderSelect) return;
    const { data: folders } = await getSB()
      .from('folders')
      .select('id, name, color')
      .eq('user_id', session.user.id)
      .order('name');
    if (folders?.length) {
      folders.forEach(f => {
        const opt = document.createElement('option');
        opt.value = f.id;
        opt.textContent = f.name;
        folderSelect.appendChild(opt);
      });
    }
  })();

  // Pre-fill from URL params (from templates)
  const urlP = new URLSearchParams(window.location.search);
  if (urlP.get('type'))     selectedType     = urlP.get('type');
  if (urlP.get('audience')) selectedAudience = urlP.get('audience');
  if (urlP.get('topic')) {
    const ti = document.getElementById('topicInput');
    if (ti) { ti.value = urlP.get('topic'); ti.dispatchEvent(new Event('input')); }
  }
  if (urlP.get('subject')) {
    const si = document.getElementById('docSubject');
    if (si) si.value = urlP.get('subject');
  }
  if (urlP.get('language')) {
    const li = document.getElementById('docLanguage');
    if (li) li.value = urlP.get('language');
  }

  // Sync toggles with pre-selected values
  document.querySelectorAll('[data-doc-type]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.docType === selectedType);
  });
  document.querySelectorAll('[data-audience]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.audience === selectedAudience);
  });

  // Toggle interactions
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
  pageRange?.addEventListener('input', () => {
    if (pageValue) pageValue.textContent = pageRange.value;
    // Warn about free plan page limit
    if (parseInt(pageRange.value) > FREE_PAGE_LIMIT) {
      const hint = document.getElementById('pageLimitHint');
      if (hint) { hint.style.display = 'block'; }
    } else {
      const hint = document.getElementById('pageLimitHint');
      if (hint) { hint.style.display = 'none'; }
    }
  });

  const createForm  = document.getElementById('createForm');
  const generateBtn = document.getElementById('generateBtn');

  createForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearAllErrors(createForm);

    const topicInput = document.getElementById('topicInput');
    const topic = topicInput.value.trim();
    if (topic.length < 5) { showFieldError(topicInput, 'Konu en az 5 karakter olmalıdır.'); return; }

    const pages     = parseInt(pageRange?.value || '5', 10);
    const language  = document.getElementById('docLanguage')?.value || 'tr';

    // FREE PLAN LIMIT CHECK (monthly)
    const sb = getSB();
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const { count } = await sb
      .from('documents')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', session.user.id)
      .gte('created_at', monthStart);

    if ((count || 0) >= FREE_DOC_LIMIT) {
      showUpgradeModal(`Bu ay ${FREE_DOC_LIMIT} belge limitine ulaştınız. Pro plana geçerek aylık 150 belge oluşturun.`);
      return;
    }

    if (pages > FREE_PAGE_LIMIT) {
      showToast(`Ücretsiz planda en fazla ${FREE_PAGE_LIMIT} sayfa oluşturabilirsiniz.`, 'error', 4000);
      if (pageRange) pageRange.value = FREE_PAGE_LIMIT;
      if (pageValue) pageValue.textContent = FREE_PAGE_LIMIT;
      return;
    }

    const extraNotes = document.getElementById('extraNotes')?.value || '';
    const gradeLevel = document.getElementById('gradeLevel')?.value  || '';
    const tone     = document.getElementById('docTone')?.value    || 'formal';
    const subject  = document.getElementById('docSubject')?.value || '';
    const folderId = document.getElementById('docFolder')?.value  || null;

    generatedTitle    = topic.slice(0, 60);
    generatedImageUrl = null;

    await runGeneration({ topic, extraNotes, type: selectedType, audience: selectedAudience, pages, gradeLevel, language, tone, subject, session, folderId });
  });

  // Download buttons
  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action="download"]');
    if (btn && generatedContent) {
      const icon = btn.querySelector('i[data-lucide]');
      const origHtml = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span>';
      try {
        await downloadDocument(generatedTitle, selectedType, generatedContent, pageRange?.value || '5', generatedImageUrl);
      } finally {
        btn.disabled = false;
        btn.innerHTML = origHtml;
        initIcons(btn);
      }
    }
  });

  initIcons();

  async function runGeneration(params) {
    const panel        = document.getElementById('generationPanel');
    const resultPanel  = document.getElementById('generationResult');
    const progressFill = document.getElementById('progressFill');
    const resultTitle  = document.getElementById('resultTitle');
    const resultMeta   = document.getElementById('resultMeta');
    const steps        = ['step-analyze', 'step-outline', 'step-content', 'step-format', 'step-export'];

    // Reset UI
    generateBtn.disabled = true;
    generateBtn.innerHTML = `<span class="spinner"></span> Oluşturuluyor...`;
    resultPanel?.classList.remove('visible');
    if (progressFill) progressFill.style.width = '0%';
    steps.forEach(id => { const el = document.getElementById(id); if (el) el.classList.remove('active', 'done'); });
    panel?.classList.add('visible');
    panel?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

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
    }, 1600);

    try {
      const response = await fetch('/api/generate', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic:      params.topic,
          extraNotes: params.extraNotes,
          type:       params.type,
          audience:   params.audience,
          pages:      params.pages,
          gradeLevel: params.gradeLevel,
          language:   params.language,
          tone:    params.tone,
          subject: params.subject,
        })
      });

      clearInterval(stepTimer);

      if (!response.ok) throw new Error('Sunucu hatası. Lütfen tekrar deneyin.');
      const json = await response.json();
      if (json.error) throw new Error(json.error);

      generatedContent = json.content;

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

        const docInsert = {
          user_id:  params.session.user.id,
          title:    generatedTitle,
          type:     params.type,
          content:  generatedContent,
          pages:    params.pages,
          audience: params.audience,
        };
        if (params.folderId) docInsert.folder_id = params.folderId;
        await getSB().from('documents').insert(docInsert);
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
async function downloadDocument(title, type, content, pages, imageUrl) {
  if (type === 'pdf')        await generatePDF(title, content, imageUrl);
  else if (type === 'word')  await generateWord(title, content, imageUrl);
  else if (type === 'pptx')  await generatePPTX(title, content, pages, imageUrl);
}

async function generatePDF(title, content, imageUrl) {
  const imgHtml = imageUrl
    ? `<div style="text-align:center;margin:0 0 28px;"><img src="${imageUrl}" style="max-width:100%;max-height:260px;border-radius:10px;box-shadow:0 4px 16px rgba(0,0,0,.15);" alt="İlgili görsel" /></div>`
    : '';

  const body = `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<title>${escapeHtml(title)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; color: #222; font-size: 12pt; line-height: 1.7; }
  h1 { font-size: 20pt; color: #1a1a2e; border-bottom: 2px solid #e8855a; padding-bottom: 10px; margin: 0 0 24px; }
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
${imgHtml}
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

async function generateWord(title, content, imageUrl) {
  const imgHtml = imageUrl
    ? `<p style="text-align:center;"><img src="${imageUrl}" style="max-width:100%;max-height:240px;border-radius:8px;" /></p><br>`
    : '';

  const html = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head>
<meta charset="UTF-8">
<style>
  body   { font-family: Arial, sans-serif; font-size: 12pt; line-height: 1.6; margin: 2cm; }
  h1     { font-size: 18pt; color: #1a1a2e; border-bottom: 1px solid #e8855a; padding-bottom: 6pt; }
  h2     { font-size: 14pt; color: #2d2d4e; }
  h3     { font-size: 12pt; color: #444; }
  p      { margin-bottom: 8pt; }
  ul, ol { margin-left: 18pt; }
  li     { margin-bottom: 3pt; }
  .footer{ color: #aaa; font-size: 9pt; margin-top: 36pt; border-top: 1px solid #eee; padding-top: 6pt; }
</style>
</head>
<body>
${imgHtml}
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

async function generatePPTX(title, content, pages, imageUrl) {
  if (!window.PptxGenJS) {
    showToast('PowerPoint kütüphanesi henüz yüklenmedi. Lütfen bekleyin ve tekrar deneyin.', 'error');
    return;
  }

  const slides = parseSlidecontent(content);
  const pptx   = new PptxGenJS();
  pptx.layout  = 'LAYOUT_WIDE';

  for (let i = 0; i < slides.length; i++) {
    const slide = slides[i];
    const s     = pptx.addSlide();

    if (i === 0) {
      // Cover slide
      s.background = { color: '1a1a2e' };
      // Add image to cover if available
      if (imageUrl) {
        try {
          s.addImage({ path: imageUrl, x: 0, y: 0, w: 13.33, h: 7.5, transparency: 65 });
        } catch (_) {}
      }
      s.addText(slide.title, {
        x: 0.5, y: 2.0, w: 12.3, h: 1.6,
        fontSize: 32, bold: true, color: 'FFFFFF', align: 'center',
      });
      if (slide.bullets[0]) {
        s.addText(slide.bullets[0], {
          x: 0.5, y: 3.8, w: 12.3, h: 0.8,
          fontSize: 16, color: 'ddcccc', align: 'center',
        });
      }
      s.addText('EgitimAI', {
        x: 0.5, y: 7.0, w: 12.3, h: 0.3,
        fontSize: 9, color: '556688', align: 'center',
      });
    } else {
      // Content slide — with optional image on right side
      const hasImg = imageUrl && i === 1; // add image only to first content slide
      const contentW = hasImg ? 7.5 : 12.3;

      s.background = { color: 'f8f9ff' };
      s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.33, h: 0.08, fill: { color: 'e8855a' } });
      s.addText(slide.title, {
        x: 0.4, y: 0.18, w: 12.5, h: 0.85,
        fontSize: 20, bold: true, color: '1a1a2e',
      });

      if (hasImg) {
        try {
          s.addImage({ path: imageUrl, x: 8.1, y: 1.1, w: 4.8, h: 3.4, rounding: true });
        } catch (_) {}
      }

      if (slide.bullets.length > 0) {
        const bulletItems = slide.bullets.map(b => ({
          text: b,
          options: { bullet: { type: 'bullet' }, paraSpaceAfter: 8 }
        }));
        s.addText(bulletItems, {
          x: 0.4, y: 1.15, w: contentW, h: 5.9,
          fontSize: 14, color: '333344', valign: 'top',
        });
      }
      s.addText(`${i + 1} / ${slides.length}`, {
        x: 11.8, y: 7.1, w: 1.2, h: 0.3,
        fontSize: 8, color: 'bbbbbb', align: 'right',
      });
    }
  }

  await pptx.writeFile({ fileName: `${sanitizeFilename(title)}.pptx` });
  showToast('PowerPoint indiriliyor...', 'success');
}

/* Remove markdown markers and problematic symbols from plain text (for PPTX) */
function stripMarkdown(text) {
  const supMap = '⁰¹²³⁴⁵⁶⁷⁸⁹';
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')   // **bold**
    .replace(/\*(.+?)\*/g,     '$1')   // *italic*
    .replace(/__(.+?)__/g,     '$1')   // __bold__
    .replace(/_(.+?)_/g,       '$1')   // _italic_
    .replace(/`(.+?)`/g,       '$1')   // `code`
    .replace(/#{1,6}\s*/g,     '')     // ## headings
    .replace(/\^(\d+)/g, (_, n) => n.split('').map(d => supMap[+d]).join(''))  // ^2 → ²
    .replace(/[→⇒⟹➜➡►▶]/g,  '>')   // arrows
    .replace(/[—–]/g,          '-')    // em/en dash
    .replace(/[""]/g,          '"')    // curly double quotes
    .replace(/['']/g,          "'")    // curly single quotes
    .replace(/[•◦▸▹◆◇■□●○▪▫]/g, '') // bullet symbols
    .replace(/\[|\]/g,         '')     // brackets
    .replace(/\|/g,            ' ')    // pipe
    .trim();
}

function parseSlidecontent(content) {
  const slides = [];
  const lines  = content.split('\n');
  let current  = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const match = trimmed.match(/^SLAYT\s*\d+\s*[:：]\s*(.+)/i);
    if (match) {
      if (current) slides.push(current);
      current = { title: stripMarkdown(match[1].trim()), bullets: [] };
    } else if (current) {
      if (/^[-•*]\s+/.test(trimmed)) {
        const b = stripMarkdown(trimmed.replace(/^[-•*]\s+/, '').trim());
        if (b) current.bullets.push(b);
      } else if (!/^#+/.test(trimmed)) {
        current.bullets.push(stripMarkdown(trimmed));
      }
    }
  }
  if (current) slides.push(current);

  if (slides.length === 0) {
    slides.push({ title: 'Sunum', bullets: content.split('\n').filter(l => l.trim()).slice(0, 6) });
  }
  return slides;
}

/* =====================================================
   MARKDOWN → HTML
===================================================== */
function markdownToHtml(text) {
  // Merge blank lines between consecutive numbered list items so numbering stays continuous
  text = text.replace(/(\n\d+\.\s[^\n]+)\n\n+(\d+\.\s)/g, '$1\n$2');
  const lines = text.split('\n');
  let html    = '';
  let inUL    = false;
  let inOL    = false;

  const closeList = () => {
    if (inUL) { html += '</ul>\n'; inUL = false; }
    if (inOL) { html += '</ol>\n'; inOL = false; }
  };

  const inline = (s) => s
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g,     '<em>$1</em>')
    .replace(/\^(\d+)/g,       '<sup>$1</sup>');

  for (const line of lines) {
    const t = line.trim();
    if (!t) { closeList(); html += '\n'; continue; }
    if (t.startsWith('# '))        { closeList(); html += `<h1>${inline(t.slice(2))}</h1>\n`; }
    else if (t.startsWith('## '))  { closeList(); html += `<h2>${inline(t.slice(3))}</h2>\n`; }
    else if (t.startsWith('### ')) { closeList(); html += `<h3>${inline(t.slice(4))}</h3>\n`; }
    else if (/^[-*•] /.test(t)) {
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
   FOLDERS PAGE
===================================================== */
async function initFoldersPage() {
  if (!document.getElementById('foldersPage')) return;

  const session = await requireAuth();
  if (!session) return;

  await populateUserInfo();
  initSidebar();
  initLogout();
  initIcons();

  const sb = getSB();
  let activeFolderId = null;

  const foldersGrid  = document.getElementById('foldersGrid');
  const folderDocs   = document.getElementById('folderDocsSection');
  const folderDocsTitle = document.getElementById('folderDocsTitle');
  const newFolderBtn = document.getElementById('newFolderBtn');

  // ── Load folders ──
  async function loadFolders() {
    const { data: folders } = await sb
      .from('folders')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false });

    // Count docs per folder
    const counts = {};
    if (folders?.length) {
      const { data: countRows } = await sb
        .from('documents')
        .select('folder_id')
        .eq('user_id', session.user.id)
        .in('folder_id', folders.map(f => f.id));
      (countRows || []).forEach(r => { counts[r.folder_id] = (counts[r.folder_id] || 0) + 1; });
    }

    if (!foldersGrid) return;
    foldersGrid.innerHTML = '';

    if (!folders || folders.length === 0) {
      foldersGrid.innerHTML = `<div class="folders-empty"><i data-lucide="folder-open"></i><p>Henüz klasör oluşturmadınız.</p><button class="btn btn--primary btn--sm" id="emptyNewFolderBtn"><i data-lucide="plus"></i> Yeni Klasör</button></div>`;
      initIcons(foldersGrid);
      document.getElementById('emptyNewFolderBtn')?.addEventListener('click', openNewFolderModal);
      return;
    }

    folders.forEach(folder => {
      const card = document.createElement('div');
      card.className = 'folder-card' + (activeFolderId === folder.id ? ' folder-card--active' : '');
      card.dataset.folderId = folder.id;
      const count = counts[folder.id] || 0;
      card.innerHTML = `
        <div class="folder-card__icon" style="color:${folder.color || '#e8855a'}">
          <i data-lucide="folder"></i>
        </div>
        <div class="folder-card__body">
          <div class="folder-card__name">${escapeHtml(folder.name)}</div>
          <div class="folder-card__count">${count} belge</div>
        </div>
        <div class="folder-card__menu">
          <button class="btn btn--icon btn--ghost folder-card__menu-btn" title="Seçenekler" data-folder-id="${folder.id}" data-folder-name="${escapeHtml(folder.name)}">
            <i data-lucide="more-vertical"></i>
          </button>
        </div>`;
      foldersGrid.appendChild(card);
    });

    initIcons(foldersGrid);

    // Click on card body → open folder
    foldersGrid.querySelectorAll('.folder-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('.folder-card__menu-btn')) return;
        const fid = card.dataset.folderId;
        const fname = card.querySelector('.folder-card__name').textContent;
        openFolderDocs(fid, fname);
        foldersGrid.querySelectorAll('.folder-card').forEach(c => c.classList.remove('folder-card--active'));
        card.classList.add('folder-card--active');
      });
    });

    // "..." menu
    foldersGrid.querySelectorAll('.folder-card__menu-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        showFolderMenu(btn, btn.dataset.folderId, btn.dataset.folderName);
      });
    });

    // Re-open active folder if any
    if (activeFolderId) {
      const activeCard = foldersGrid.querySelector(`[data-folder-id="${activeFolderId}"]`);
      if (activeCard) {
        activeCard.classList.add('folder-card--active');
        const fname = activeCard.querySelector('.folder-card__name').textContent;
        openFolderDocs(activeFolderId, fname);
      }
    }
  }

  // ── Open folder docs ──
  async function openFolderDocs(folderId, folderName) {
    activeFolderId = folderId;
    if (folderDocsTitle) folderDocsTitle.textContent = folderName;
    if (folderDocs) folderDocs.style.display = 'block';

    const { data: docs } = await sb
      .from('documents')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('folder_id', folderId)
      .order('created_at', { ascending: false });

    const table = document.getElementById('folderDocsTable');
    if (!table) return;

    table.innerHTML = '';

    if (!docs || docs.length === 0) {
      table.innerHTML = `<div style="padding:32px;text-align:center;color:var(--text-3);">Bu klasörde henüz belge yok.<br><a href="create.html" style="color:var(--accent);">Belge oluşturun →</a></div>`;
      return;
    }

    const typeIcon  = { pdf: 'PDF', word: 'DOC', pptx: 'PPT' };
    const typeLabel = { pdf: 'PDF', word: 'DOCX', pptx: 'PPTX' };
    docs.forEach(doc => {
      const row = document.createElement('div');
      row.className = 'docs-table__row';
      const date = new Date(doc.created_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' });
      row.innerHTML = `
        <div class="docs-table__name">
          <div class="doc-icon doc-icon--${doc.type}">${typeIcon[doc.type] || 'DOC'}</div>
          <span>${escapeHtml(doc.title)}</span>
        </div>
        <div class="docs-table__type"><span class="badge badge--${doc.type}">${typeLabel[doc.type] || doc.type.toUpperCase()}</span></div>
        <div class="docs-table__size">${doc.pages} sayfa</div>
        <div class="docs-table__date">${date}</div>
        <div class="docs-table__actions">
          <button class="btn btn--icon btn--ghost" title="İndir" data-doc-id="${doc.id}"><i data-lucide="download"></i></button>
          <button class="btn btn--icon btn--ghost" title="Klasörden çıkar" data-remove-id="${doc.id}" style="color:var(--text-3)"><i data-lucide="folder-minus"></i></button>
        </div>`;
      table.appendChild(row);
    });
    initIcons(table);

    table.querySelectorAll('[data-doc-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        const doc = docs.find(d => d.id === btn.dataset.docId);
        if (doc) downloadDocument(doc.title, doc.type, doc.content, doc.pages, null);
      });
    });

    table.querySelectorAll('[data-remove-id]').forEach(btn => {
      btn.addEventListener('click', async () => {
        await sb.from('documents').update({ folder_id: null }).eq('id', btn.dataset.removeId);
        btn.closest('.docs-table__row').remove();
        showToast('Belge klasörden çıkarıldı.', 'success');
        await loadFolders(); // refresh counts
      });
    });
  }

  // ── New folder modal ──
  function openNewFolderModal() {
    const existing = document.getElementById('folderModal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'folderModal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-box" style="max-width:400px;">
        <h2 class="modal-title" style="font-size:1.1rem;margin-bottom:16px;">Yeni Klasör</h2>
        <div class="form-group">
          <label class="form-label">Klasör adı</label>
          <input type="text" id="folderNameInput" class="form-input" placeholder="ör. 7. Sınıf Matematik" maxlength="50" />
        </div>
        <div class="form-group">
          <label class="form-label">Renk</label>
          <div class="folder-color-picker" id="folderColorPicker">
            <button class="folder-color-btn folder-color-btn--active" data-color="#e8855a" style="background:#e8855a"></button>
            <button class="folder-color-btn" data-color="#7990f8" style="background:#7990f8"></button>
            <button class="folder-color-btn" data-color="#4ade80" style="background:#4ade80"></button>
            <button class="folder-color-btn" data-color="#fbbf24" style="background:#fbbf24"></button>
            <button class="folder-color-btn" data-color="#c4b5fd" style="background:#c4b5fd"></button>
            <button class="folder-color-btn" data-color="#f87171" style="background:#f87171"></button>
          </div>
        </div>
        <div class="modal-actions">
          <button class="btn btn--primary" id="saveFolderBtn"><i data-lucide="folder-plus"></i> Oluştur</button>
          <button class="btn btn--ghost" id="cancelFolderBtn">İptal</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    initIcons(modal);

    let selectedColor = '#e8855a';
    modal.querySelectorAll('.folder-color-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        modal.querySelectorAll('.folder-color-btn').forEach(b => b.classList.remove('folder-color-btn--active'));
        btn.classList.add('folder-color-btn--active');
        selectedColor = btn.dataset.color;
      });
    });

    document.getElementById('cancelFolderBtn')?.addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

    const saveBtn = document.getElementById('saveFolderBtn');
    saveBtn?.addEventListener('click', async () => {
      const name = document.getElementById('folderNameInput')?.value.trim();
      if (!name) { showToast('Klasör adı girin.', 'error'); return; }
      saveBtn.disabled = true;
      saveBtn.innerHTML = '<span class="spinner"></span>';
      const { error } = await sb.from('folders').insert({ user_id: session.user.id, name, color: selectedColor });
      if (error) {
        showToast('Klasör oluşturulamadı.', 'error');
      } else {
        showToast('Klasör oluşturuldu!', 'success');
        modal.remove();
        await loadFolders();
      }
      saveBtn.disabled = false;
    });

    setTimeout(() => document.getElementById('folderNameInput')?.focus(), 100);
  }

  // ── Folder context menu ──
  function showFolderMenu(anchorEl, folderId, folderName) {
    document.getElementById('folderContextMenu')?.remove();

    const menu = document.createElement('div');
    menu.id = 'folderContextMenu';
    menu.className = 'context-menu';
    menu.innerHTML = `
      <button class="context-menu__item" id="renameFolder"><i data-lucide="pencil"></i> Yeniden Adlandır</button>
      <button class="context-menu__item context-menu__item--danger" id="deleteFolder"><i data-lucide="trash-2"></i> Sil</button>`;

    const rect = anchorEl.getBoundingClientRect();
    menu.style.cssText = `position:fixed;top:${rect.bottom + 4}px;left:${rect.left - 140}px;z-index:1000;`;
    document.body.appendChild(menu);
    initIcons(menu);

    const close = () => menu.remove();
    setTimeout(() => document.addEventListener('click', close, { once: true }), 0);

    document.getElementById('renameFolder')?.addEventListener('click', (e) => {
      e.stopPropagation();
      close();
      const newName = prompt('Klasör adı:', folderName);
      if (newName && newName.trim()) {
        sb.from('folders').update({ name: newName.trim() }).eq('id', folderId).then(() => {
          showToast('Klasör yeniden adlandırıldı.', 'success');
          loadFolders();
        });
      }
    });

    document.getElementById('deleteFolder')?.addEventListener('click', async (e) => {
      e.stopPropagation();
      close();
      if (!confirm(`"${folderName}" klasörünü silmek istediğinize emin misiniz? Belgeler silinmez, sadece klasörden çıkarılır.`)) return;
      await sb.from('documents').update({ folder_id: null }).eq('folder_id', folderId);
      await sb.from('folders').delete().eq('id', folderId);
      if (activeFolderId === folderId) {
        activeFolderId = null;
        if (folderDocs) folderDocs.style.display = 'none';
      }
      showToast('Klasör silindi.', 'success');
      await loadFolders();
    });
  }

  newFolderBtn?.addEventListener('click', openNewFolderModal);
  await loadFolders();
}

/* =====================================================
   INIT
===================================================== */
// Apply theme before paint to avoid flash
initTheme();

document.addEventListener('DOMContentLoaded', () => {
  initIcons();
  updateThemeIcon(document.documentElement.getAttribute('data-theme') || 'dark');
  initAuthPage();
  initDashboard();
  initCreatePage();
  initHistoryPage();
  initTemplatesPage();
  initSettingsPage();
  initFoldersPage();
});
