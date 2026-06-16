/**
 * My Strengths Academy — script.js
 * Audited against ui-ux-pro-max design system checklist:
 *   ✓ Sticky CTA (waitlist pattern: above-fold + sticky)
 *   ✓ Scroll-spy active nav (navigation: active state required)
 *   ✓ Blur-based form validation (forms: validate on blur not submit)
 *   ✓ Scroll animations (animation: 150-300ms, transform/opacity only)
 *   ✓ Carousel with keyboard/focus support
 *   ✓ Mobile menu with escape key + body scroll lock
 *   ✓ prefers-reduced-motion respected
 *   ✓ cursor-pointer on interactive elements
 *   ✓ Focus management after form submit
 */

(function () {
  'use strict';

  const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ============================================================
     STICKY NAV — .scrolled class after 20px
  ============================================================ */
  const header = document.getElementById('site-header');

  function onScroll() {
    header.classList.toggle('scrolled', window.scrollY > 20);
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ============================================================
     STICKY FLOATING CTA — appears after hero leaves viewport
  ============================================================ */
  const stickyCta  = document.getElementById('sticky-cta');
  const heroSection = document.querySelector('.hero');

  if (stickyCta && heroSection) {
    const heroObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          const show = !entry.isIntersecting;
          stickyCta.classList.toggle('visible', show);
          stickyCta.setAttribute('aria-hidden', (!show).toString());
        });
      },
      { threshold: 0.1 }
    );
    heroObserver.observe(heroSection);
  }

  /* ============================================================
     MOBILE MENU TOGGLE
  ============================================================ */
  const navToggle = document.getElementById('nav-toggle');
  const navMenu   = document.getElementById('nav-menu');

  function closeMenu() {
    navMenu.classList.remove('open');
    navToggle.classList.remove('open');
    navToggle.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  }

  if (navToggle && navMenu) {
    navToggle.addEventListener('click', function () {
      const isOpen = navMenu.classList.toggle('open');
      navToggle.classList.toggle('open', isOpen);
      navToggle.setAttribute('aria-expanded', isOpen.toString());
      document.body.style.overflow = isOpen ? 'hidden' : '';
    });

    navMenu.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', closeMenu);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && navMenu.classList.contains('open')) {
        closeMenu();
        navToggle.focus();
      }
    });
  }

  /* ============================================================
     SCROLL-SPY — highlight active nav section
     Skill: navigation active state required
  ============================================================ */
  const navLinks = Array.from(document.querySelectorAll('.nav-link[href^="#"]'));
  const sections = navLinks
    .map(function (link) {
      return document.querySelector(link.getAttribute('href'));
    })
    .filter(Boolean);

  function updateActiveNav() {
    const scrollY   = window.scrollY;
    const navHeight = header.offsetHeight;
    let current     = null;

    sections.forEach(function (section) {
      if (scrollY >= section.offsetTop - navHeight - 60) {
        current = section.id;
      }
    });

    navLinks.forEach(function (link) {
      const matches = link.getAttribute('href') === '#' + current;
      link.classList.toggle('active', matches);
    });
  }

  window.addEventListener('scroll', updateActiveNav, { passive: true });
  updateActiveNav();

  /* ============================================================
     SMOOTH SCROLL
  ============================================================ */
  document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
    anchor.addEventListener('click', function (e) {
      const target = document.querySelector(this.getAttribute('href'));
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({ behavior: REDUCED_MOTION ? 'auto' : 'smooth', block: 'start' });
      // Move focus for accessibility
      target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
    });
  });

  /* ============================================================
     SCROLL ANIMATIONS — IntersectionObserver
     Skill: animation 150-300ms, transform/opacity only
  ============================================================ */
  if (!REDUCED_MOTION && 'IntersectionObserver' in window) {
    const observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );
    document.querySelectorAll('.animate-in').forEach(function (el) {
      observer.observe(el);
    });
  } else {
    document.querySelectorAll('.animate-in').forEach(function (el) {
      el.classList.add('visible');
    });
  }

  /* ============================================================
     QUOTE CAROUSEL
  ============================================================ */
  const track   = document.getElementById('carousel-track');
  const prevBtn = document.getElementById('carousel-prev');
  const nextBtn = document.getElementById('carousel-next');
  const dotsWrap = document.getElementById('carousel-dots');

  if (track && prevBtn && nextBtn && dotsWrap) {
    const slides = Array.from(track.querySelectorAll('.quote-slide'));
    const dots   = Array.from(dotsWrap.querySelectorAll('.dot'));
    let current  = 0;
    let timer    = null;

    function goTo(index) {
      const next = (index + slides.length) % slides.length;
      slides[current].classList.remove('active');
      dots[current].classList.remove('active');
      dots[current].setAttribute('aria-selected', 'false');
      current = next;
      slides[current].classList.add('active');
      dots[current].classList.add('active');
      dots[current].setAttribute('aria-selected', 'true');
      // Update aria-label on track for screen readers
      track.setAttribute('aria-label', 'Testimonial ' + (current + 1) + ' of ' + slides.length);
    }

    function startAuto() {
      if (REDUCED_MOTION) return;
      timer = setInterval(function () { goTo(current + 1); }, 5000);
    }

    function resetAuto() { clearInterval(timer); startAuto(); }

    nextBtn.addEventListener('click', function () { goTo(current + 1); resetAuto(); });
    prevBtn.addEventListener('click', function () { goTo(current - 1); resetAuto(); });

    dots.forEach(function (dot) {
      dot.addEventListener('click', function () {
        goTo(parseInt(this.dataset.index, 10));
        resetAuto();
      });
    });

    track.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { goTo(current + 1); resetAuto(); }
      if (e.key === 'ArrowLeft')  { goTo(current - 1); resetAuto(); }
    });

    const carousel = track.closest('.carousel');
    if (carousel) {
      carousel.addEventListener('mouseenter', function () { clearInterval(timer); });
      carousel.addEventListener('mouseleave', startAuto);
      carousel.addEventListener('focusin',    function () { clearInterval(timer); });
      carousel.addEventListener('focusout',   startAuto);
    }

    startAuto();
  }

  /* ============================================================
     FORM VALIDATION
     Skill: validate on blur (not keystroke or submit-only)
            inline errors below each field
            focus first invalid field on submit error
  ============================================================ */
  const form       = document.getElementById('waitlist-form');
  const submitBtn  = document.getElementById('submit-btn');
  const successMsg = document.getElementById('form-success');

  if (form && submitBtn && successMsg) {

    /* --- Validators --- */
    const validators = {
      'first-name': function (v) { return v.trim() ? null : 'Please enter your first name.'; },
      'last-name':  function (v) { return v.trim() ? null : 'Please enter your last name.'; },
      'email':      function (v) {
        if (!v.trim()) return 'Please enter your email address.';
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? null : 'Please enter a valid email address.';
      },
      'role': function (v) { return v ? null : 'Please select who you are.'; }
    };

    function showError(fieldId, message) {
      const field = document.getElementById(fieldId);
      const error = document.getElementById(fieldId + '-error');
      if (field) { field.classList.add('error'); field.setAttribute('aria-invalid', 'true'); }
      if (error) { error.textContent = message; error.classList.add('visible'); }
    }

    function clearError(fieldId) {
      const field = document.getElementById(fieldId);
      const error = document.getElementById(fieldId + '-error');
      if (field) { field.classList.remove('error'); field.removeAttribute('aria-invalid'); }
      if (error) { error.textContent = ''; error.classList.remove('visible'); }
    }

    /* --- Blur validation (validate on blur, not on keystroke) --- */
    Object.keys(validators).forEach(function (id) {
      const field = document.getElementById(id);
      if (!field) return;

      field.addEventListener('blur', function () {
        const msg = validators[id](field.value);
        if (msg) { showError(id, msg); } else { clearError(id); }
      });

      // Clear error as soon as user starts correcting
      field.addEventListener('input', function () {
        if (field.classList.contains('error')) {
          const msg = validators[id](field.value);
          if (!msg) clearError(id);
        }
      });
    });

    /* --- Full validation on submit --- */
    function validateAll() {
      let firstInvalid = null;
      let valid = true;

      Object.keys(validators).forEach(function (id) {
        const field = document.getElementById(id);
        if (!field) return;
        const msg = validators[id](field.value);
        if (msg) {
          showError(id, msg);
          if (!firstInvalid) firstInvalid = field;
          valid = false;
        } else {
          clearError(id);
        }
      });

      // Focus first invalid field (skill: focus-management)
      if (firstInvalid) firstInvalid.focus();
      return valid;
    }

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      if (!validateAll()) return;

      submitBtn.disabled = true;
      submitBtn.classList.add('loading');

      try {
        const response = await fetch(form.action, {
          method: 'POST',
          body: new FormData(form),
          headers: { 'Accept': 'application/json' }
        });

        if (response.ok) {
          form.hidden = true;
          successMsg.hidden = false;
          successMsg.focus(); // move focus for screen readers
          successMsg.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
          throw new Error('Server error');
        }
      } catch (err) {
        submitBtn.disabled = false;
        submitBtn.classList.remove('loading');

        let banner = form.querySelector('.form-submit-error');
        if (!banner) {
          banner = document.createElement('p');
          banner.className = 'form-submit-error field-error visible';
          banner.style.cssText = 'text-align:center;margin-top:0.5rem;';
          banner.setAttribute('role', 'alert');
          form.querySelector('.form-submit').insertAdjacentElement('afterend', banner);
        }
        banner.textContent = 'Something went wrong. Please try again or email us directly.';
      }
    });
  }

  /* ============================================================
     FOOTER COPYRIGHT YEAR
  ============================================================ */
  const yearEl = document.getElementById('copyright-year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

})();
