/* Dealpick — interactions minimales, sans dépendance */
(function () {
  'use strict';

  /* Thème : mémorise le choix, sinon suit la préférence système */
  var STORAGE_KEY = 'dealpick-theme';
  var root = document.documentElement;

  try {
    var saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'dark' || saved === 'light') root.setAttribute('data-theme', saved);
  } catch (e) { /* navigation privée : on retombe sur la préférence système */ }

  var toggle = document.querySelector('[data-theme-toggle]');
  if (toggle) {
    toggle.addEventListener('click', function () {
      var isDark = root.getAttribute('data-theme') === 'dark' ||
        (!root.hasAttribute('data-theme') &&
          window.matchMedia('(prefers-color-scheme: dark)').matches);
      var next = isDark ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      toggle.setAttribute('aria-label',
        next === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre');
      try { localStorage.setItem(STORAGE_KEY, next); } catch (e) {}
    });
  }

  /* Menu mobile */
  var navToggle = document.querySelector('[data-nav-toggle]');
  var mobileNav = document.querySelector('[data-mobile-nav]');
  if (navToggle && mobileNav) {
    navToggle.addEventListener('click', function () {
      var open = mobileNav.hidden;
      mobileNav.hidden = !open;
      navToggle.setAttribute('aria-expanded', String(open));
    });
  }
})();
