/* ===================================================
   EGITIM AI — main.js
   Animations, interactions, scroll effects
=================================================== */

'use strict';

/* ---- Lucide Icons Init ---- */
document.addEventListener('DOMContentLoaded', () => {
  if (window.lucide) {
    lucide.createIcons();
  }

  initNav();
  initMobileMenu();
  initScrollReveal();
  initTypingEffect();
  initPricingToggle();
  initScenarioTabs();
  initSmoothScroll();
  initPreviewFormatToggle();
});

/* =====================================================
   NAV: Scroll effect
===================================================== */
function initNav() {
  const nav = document.getElementById('nav');
  if (!nav) return;

  const onScroll = () => {
    if (window.scrollY > 30) {
      nav.classList.add('scrolled');
    } else {
      nav.classList.remove('scrolled');
    }
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

/* =====================================================
   MOBILE MENU
===================================================== */
function initMobileMenu() {
  const hamburger  = document.getElementById('hamburger');
  const mobileMenu = document.getElementById('mobileMenu');
  const links      = mobileMenu ? mobileMenu.querySelectorAll('.mobile-menu__link, .mobile-menu__actions a') : [];
  if (!hamburger || !mobileMenu) return;

  let open = false;

  function toggle() {
    open = !open;
    mobileMenu.classList.toggle('open', open);
    document.body.style.overflow = open ? 'hidden' : '';

    // swap icon
    const icon = hamburger.querySelector('[data-lucide]');
    if (icon) {
      icon.setAttribute('data-lucide', open ? 'x' : 'menu');
      if (window.lucide) lucide.createIcons({ nodes: [icon] });
    }
  }

  hamburger.addEventListener('click', toggle);

  links.forEach(link => {
    link.addEventListener('click', () => {
      if (open) toggle();
    });
  });

  // close on outside tap
  mobileMenu.addEventListener('click', (e) => {
    if (e.target === mobileMenu) toggle();
  });
}

/* =====================================================
   SCROLL REVEAL (IntersectionObserver)
===================================================== */
function initScrollReveal() {
  const elements = document.querySelectorAll('.reveal');
  if (!elements.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.12,
    rootMargin: '0px 0px -48px 0px'
  });

  elements.forEach(el => observer.observe(el));
}

/* =====================================================
   TYPING EFFECT (Hero preview)
===================================================== */
function initTypingEffect() {
  const el = document.getElementById('typingText');
  if (!el) return;

  const phrases = [
    '8. sınıf matematik, kesirler, 20 soruluk sınav...',
    '10. sınıf biyoloji, hücre bölünmesi sunumu...',
    'Haftalık ders planı, 5. sınıf Türkçe...',
    'Proje raporu: Yenilenebilir Enerji Kaynakları...',
    'Kimya deney raporu: Asit-Baz Tepkimeleri...',
  ];

  let phraseIndex  = 0;
  let charIndex    = 0;
  let isDeleting   = false;
  let isPausing    = false;

  function tick() {
    const current = phrases[phraseIndex];

    if (isPausing) {
      isPausing = false;
      setTimeout(tick, isDeleting ? 80 : 1200);
      return;
    }

    if (!isDeleting) {
      el.textContent = current.slice(0, charIndex + 1);
      charIndex++;

      if (charIndex === current.length) {
        isDeleting = true;
        isPausing  = true;
        setTimeout(tick, 1800);
        return;
      }
      setTimeout(tick, 55);
    } else {
      el.textContent = current.slice(0, charIndex - 1);
      charIndex--;

      if (charIndex === 0) {
        isDeleting    = false;
        phraseIndex   = (phraseIndex + 1) % phrases.length;
        isPausing     = true;
        setTimeout(tick, 400);
        return;
      }
      setTimeout(tick, 28);
    }
  }

  setTimeout(tick, 800);
}

/* =====================================================
   PRICING TOGGLE (Monthly / Yearly)
===================================================== */
function initPricingToggle() {
  const toggleBtn = document.getElementById('pricingToggle');
  const amounts   = document.querySelectorAll('.pricing-card__amount');
  if (!toggleBtn) return;

  let yearly = false;

  toggleBtn.addEventListener('click', () => {
    yearly = !yearly;
    toggleBtn.classList.toggle('on', yearly);
    toggleBtn.setAttribute('aria-checked', yearly.toString());

    const studentNote = document.getElementById('studentYearlyNote');
    const proNote     = document.getElementById('proYearlyNote');
    if (studentNote) studentNote.style.display = yearly ? 'block' : 'none';
    if (proNote)     proNote.style.display     = yearly ? 'block' : 'none';

    amounts.forEach(el => {
      const monthly = parseInt(el.dataset.monthly, 10);
      const yearlyV = parseInt(el.dataset.yearly, 10);
      if (isNaN(monthly) || isNaN(yearlyV)) return;
      const value   = yearly ? yearlyV : monthly;
      const formatted = value === 0 ? '₺0' : `₺${value}`;

      // Animate number change
      el.style.opacity = '0';
      el.style.transform = 'translateY(-8px)';
      setTimeout(() => {
        el.textContent = formatted;
        el.style.transition = 'opacity .2s ease, transform .2s ease';
        el.style.opacity = '1';
        el.style.transform = 'translateY(0)';
      }, 150);
    });
  });
}

/* =====================================================
   SCENARIO TABS
===================================================== */
function initScenarioTabs() {
  const tabs   = document.querySelectorAll('.scenarios__tab');
  const panels = document.querySelectorAll('.scenarios__panel');
  if (!tabs.length) return;

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;

      // Update tab states
      tabs.forEach(t => t.classList.toggle('scenarios__tab--active', t === tab));

      // Update panel visibility with fade
      panels.forEach(panel => {
        if (panel.dataset.panel === target) {
          panel.style.opacity = '0';
          panel.classList.add('scenarios__panel--active');
          requestAnimationFrame(() => {
            panel.style.transition = 'opacity .3s ease';
            panel.style.opacity = '1';
          });

          // Re-trigger reveal animations for newly shown cards
          const revealItems = panel.querySelectorAll('.reveal');
          revealItems.forEach(el => {
            el.classList.remove('visible');
            setTimeout(() => el.classList.add('visible'), 50);
          });
        } else {
          panel.classList.remove('scenarios__panel--active');
          panel.style.opacity = '1';
        }
      });
    });
  });
}

/* =====================================================
   SMOOTH SCROLL for nav links
===================================================== */
function initSmoothScroll() {
  const anchors = document.querySelectorAll('a[href^="#"]');
  anchors.forEach(anchor => {
    anchor.addEventListener('click', (e) => {
      const href = anchor.getAttribute('href');
      if (href === '#' || href.length <= 1) return;

      const target = document.querySelector(href);
      if (!target) return;

      e.preventDefault();
      const navHeight = document.getElementById('nav')?.offsetHeight || 68;
      const top = target.getBoundingClientRect().top + window.scrollY - navHeight - 8;

      window.scrollTo({ top, behavior: 'smooth' });
    });
  });
}

/* =====================================================
   PREVIEW FORMAT TOGGLE (Hero window)
===================================================== */
function initPreviewFormatToggle() {
  const items = document.querySelectorAll('.preview-format__item');
  if (!items.length) return;

  items.forEach(item => {
    item.addEventListener('click', () => {
      items.forEach(i => i.classList.remove('preview-format__item--active'));
      item.classList.add('preview-format__item--active');
    });
  });
}

/* =====================================================
   PARALLAX ORBS (subtle, on desktop only)
===================================================== */
(function initParallax() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (window.innerWidth < 1024) return;

  const orbs = document.querySelectorAll('.hero__orb');
  if (!orbs.length) return;

  let ticking = false;

  window.addEventListener('mousemove', (e) => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const cx = (e.clientX / window.innerWidth  - 0.5) * 2;
      const cy = (e.clientY / window.innerHeight - 0.5) * 2;

      orbs.forEach((orb, i) => {
        const factor = (i + 1) * 6;
        orb.style.transform = `translate(${cx * factor}px, ${cy * factor}px)`;
      });
      ticking = false;
    });
  });
})();

/* =====================================================
   COUNTER ANIMATION (Hero stats)
===================================================== */
(function initCounters() {
  const stats = document.querySelectorAll('.hero__stat strong');
  if (!stats.length) return;

  const parse = (text) => {
    const num  = parseFloat(text.replace(/[^\d.]/g, ''));
    const suffix = text.replace(/[\d.,]/g, '').trim();
    return { num, suffix };
  };

  const format = (val, originalText) => {
    if (originalText.includes('.')) {
      return val.toFixed(1) + originalText.replace(/[\d.]/g, '');
    }
    return Math.round(val).toLocaleString('tr-TR') + originalText.replace(/[\d,]/g, '');
  };

  const animateCounter = (el) => {
    const original = el.textContent;
    const { num }  = parse(original);
    const duration = 1600;
    const start    = performance.now();

    const tick = (now) => {
      const elapsed  = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased    = 1 - Math.pow(1 - progress, 4); // ease-out quartic
      const current  = eased * num;

      el.textContent = format(current, original);
      if (progress < 1) requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        animateCounter(entry.target);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.5 });

  stats.forEach(el => observer.observe(el));
})();

/* =====================================================
   ACTIVE NAV LINK (on scroll)
===================================================== */
(function initActiveNav() {
  const sections = document.querySelectorAll('section[id]');
  const navLinks = document.querySelectorAll('.nav__link');
  if (!sections.length || !navLinks.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        navLinks.forEach(link => {
          const href = link.getAttribute('href').slice(1);
          link.style.color = href === entry.target.id ? 'var(--accent-l)' : '';
        });
      }
    });
  }, { rootMargin: '-40% 0px -55% 0px' });

  sections.forEach(s => observer.observe(s));
})();
