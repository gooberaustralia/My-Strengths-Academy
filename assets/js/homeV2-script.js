/**
 * homeV2-script.js
 * V2 page — FAQ accordion + interest form validation
 */

(function () {
  'use strict';

  /* ============================================================
     COPYRIGHT YEAR
  ============================================================ */
  const yearEl = document.getElementById('v2-copyright-year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ============================================================
     FAQ ACCORDION
  ============================================================ */
  document.querySelectorAll('.faq-item').forEach(function (item) {
    const btn    = item.querySelector('.faq-question');
    const answer = item.querySelector('.faq-answer');
    if (!btn || !answer) return;

    btn.addEventListener('click', function () {
      const isOpen = item.classList.contains('open');

      // Close all others
      document.querySelectorAll('.faq-item.open').forEach(function (openItem) {
        if (openItem !== item) {
          openItem.classList.remove('open');
          openItem.querySelector('.faq-question').setAttribute('aria-expanded', 'false');
        }
      });

      // Toggle this one
      item.classList.toggle('open', !isOpen);
      btn.setAttribute('aria-expanded', (!isOpen).toString());
    });

    // Keyboard support
    btn.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        btn.click();
      }
    });
  });

  /* ============================================================
     INTEREST FORM VALIDATION
  ============================================================ */
  const form       = document.getElementById('interest-form');
  const submitBtn  = document.getElementById('v2-submit-btn');
  const successMsg = document.getElementById('v2-form-success');

  if (!form || !submitBtn || !successMsg) return;

  const validators = {
    'v2-first-name': function (v) { return v.trim() ? null : 'Please enter your first name.'; },
    'v2-last-name':  function (v) { return v.trim() ? null : 'Please enter your last name.'; },
    'v2-email': function (v) {
      if (!v.trim()) return 'Please enter your email address.';
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? null : 'Please enter a valid email address.';
    },
    'v2-who': function (v) { return v ? null : 'Please select an option.'; }
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

  Object.keys(validators).forEach(function (id) {
    const field = document.getElementById(id);
    if (!field) return;
    field.addEventListener('blur', function () {
      const msg = validators[id](field.value);
      if (msg) showError(id, msg); else clearError(id);
    });
    field.addEventListener('input', function () {
      if (field.classList.contains('error')) {
        if (!validators[id](field.value)) clearError(id);
      }
    });
  });

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
        successMsg.focus();
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

})();
