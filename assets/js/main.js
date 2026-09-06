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

/* Carte de ville : synchronisation épingles ↔ liste.
   Le comportement est volontairement le même que celui attendu d'une vraie
   carte, pour que le remplacement par MapLibre ou Leaflet ne change que le
   fond et le positionnement des marqueurs. */
(function () {
  'use strict';
  var map = document.querySelector('.map');
  if (!map) return;

  var pins = map.querySelectorAll('[data-pin]');
  var popups = map.querySelectorAll('[data-popup]');
  var rows = document.querySelectorAll('[data-row]');

  function clear() {
    for (var i = 0; i < pins.length; i++) pins[i].setAttribute('aria-pressed', 'false');
    for (var j = 0; j < popups.length; j++) popups[j].hidden = true;
    for (var k = 0; k < rows.length; k++) rows[k].removeAttribute('aria-current');
  }

  function select(id, scroll) {
    clear();
    var pin = map.querySelector('[data-pin="' + id + '"]');
    var popup = map.querySelector('[data-popup="' + id + '"]');
    var row = document.querySelector('[data-row="' + id + '"]');
    if (pin) pin.setAttribute('aria-pressed', 'true');
    if (popup) {
      popup.classList.remove('map-popup--below');
      popup.hidden = false;
      /* Si la bulle sort par le haut de la carte, on la bascule sous l'épingle. */
      if (popup.getBoundingClientRect().top < map.getBoundingClientRect().top) {
        popup.classList.add('map-popup--below');
      }
    }
    if (row) {
      row.setAttribute('aria-current', 'true');
      if (scroll && row.scrollIntoView) row.scrollIntoView({ block: 'nearest' });
    }
  }

  function highlight(id) {
    var pin = map.querySelector('[data-pin="' + id + '"]');
    if (pin && pin.getAttribute('aria-pressed') !== 'true') pin.setAttribute('aria-pressed', 'true');
  }

  for (var i = 0; i < pins.length; i++) {
    (function (pin) {
      pin.addEventListener('click', function () {
        var id = pin.getAttribute('data-pin');
        if (pin.getAttribute('aria-pressed') === 'true') { clear(); return; }
        select(id, true);
      });
    })(pins[i]);
  }

  for (var j = 0; j < popups.length; j++) {
    var close = popups[j].querySelector('.map-popup__close');
    if (close) close.addEventListener('click', clear);
  }

  /* Survoler ou tabuler une ligne situe le commerce sur la carte,
     sans empêcher le clic d'ouvrir la fiche de l'offre. */
  for (var k = 0; k < rows.length; k++) {
    (function (row) {
      var id = row.getAttribute('data-row');
      row.addEventListener('mouseenter', function () { clear(); highlight(id); });
      row.addEventListener('focus', function () { clear(); highlight(id); });
      row.addEventListener('mouseleave', clear);
    })(rows[k]);
  }

  document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') clear(); });
})();
