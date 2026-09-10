/* Dealpick — interactions minimales, sans dépendance */
(function () {
  'use strict';

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

/* Diaporama des étapes : les points suivent le défilement et permettent d'y aller. */
(function () {
  'use strict';
  var slider = document.querySelector('[data-slider]');
  var dots = document.querySelector('[data-slider-dots]');
  if (!slider || !dots) return;

  var slides = slider.children;
  var buttons = dots.querySelectorAll('button');

  function sync() {
    var i = Math.round(slider.scrollLeft / (slider.scrollWidth / slides.length));
    for (var j = 0; j < buttons.length; j++) {
      buttons[j].setAttribute('aria-current', String(j === i));
    }
  }

  for (var k = 0; k < buttons.length; k++) {
    (function (index) {
      buttons[index].addEventListener('click', function () {
        slides[index].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' });
      });
    })(k);
  }

  var pending;
  slider.addEventListener('scroll', function () {
    window.clearTimeout(pending);
    pending = window.setTimeout(sync, 90);
  });
  sync();
})();

/* Bloc à onglets : le sélecteur change le visuel et le texte, au clic comme
   aux flèches du clavier. */
(function () {
  'use strict';
  var bloc = document.querySelector('[data-tabs]');
  if (!bloc) return;

  var onglets = bloc.querySelectorAll('[role="tab"]');
  var panneaux = bloc.querySelectorAll('[role="tabpanel"]');
  var visuels = bloc.querySelectorAll('[data-tab-media]');

  function activer(i, donnerLeFocus) {
    for (var j = 0; j < onglets.length; j++) {
      var actif = j === i;
      onglets[j].setAttribute('aria-selected', String(actif));
      onglets[j].tabIndex = actif ? 0 : -1;
      panneaux[j].hidden = !actif;
      if (visuels[j]) visuels[j].hidden = !actif;
    }
    if (donnerLeFocus) onglets[i].focus();
  }

  for (var k = 0; k < onglets.length; k++) {
    (function (i) {
      onglets[i].addEventListener('click', function () { activer(i, false); });
      onglets[i].addEventListener('keydown', function (ev) {
        var d = ev.key === 'ArrowRight' ? 1 : ev.key === 'ArrowLeft' ? -1 : 0;
        if (!d) return;
        ev.preventDefault();
        activer((i + d + onglets.length) % onglets.length, true);
      });
    })(k);
  }
})();

/* Révélation au défilement.
   Le CSS n'anime que si <html> porte .reveal-ready : sans JS, ou si l'appareil
   demande un mouvement réduit, la page reste entièrement visible. */
(function () {
  'use strict';

  var reduit = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduit || !('IntersectionObserver' in window)) return;

  var cibles = document.querySelectorAll('[data-reveal]');
  if (!cibles.length) return;

  document.documentElement.classList.add('reveal-ready');

  var observateur = new IntersectionObserver(function (entrees) {
    for (var i = 0; i < entrees.length; i++) {
      if (!entrees[i].isIntersecting) continue;
      entrees[i].target.classList.add('is-in');
      observateur.unobserve(entrees[i].target);
    }
  }, { rootMargin: '0px 0px -12% 0px', threshold: 0.08 });

  for (var i = 0; i < cibles.length; i++) observateur.observe(cibles[i]);
})();

/* En-tête : filet et fond translucide seulement une fois la page défilée.
   En haut de page l'en-tête se fond dans le héros, ce qui laisse le titre
   respirer ; dès qu'on descend, il se détache du contenu qui passe dessous. */
(function () {
  'use strict';

  var entete = document.querySelector('.site-header');
  if (!entete) return;

  var enCours = false;
  function evaluer() {
    entete.classList.toggle('is-scrolled', window.scrollY > 8);
    enCours = false;
  }
  window.addEventListener('scroll', function () {
    if (enCours) return;
    enCours = true;
    window.requestAnimationFrame(evaluer);
  }, { passive: true });
  evaluer();
})();

/* Barre d'appel à l'action mobile : n'apparaît qu'une fois le module de
   recherche du héros sorti de l'écran, pour ne pas doubler ce qui est déjà
   visible, et s'efface au-dessus du pied de page. */
(function () {
  'use strict';

  var barre = document.querySelector('[data-sticky-cta]');
  var repere = document.querySelector('[data-sticky-cta-after]');
  if (!barre || !repere || !('IntersectionObserver' in window)) return;

  var observateur = new IntersectionObserver(function (entrees) {
    barre.classList.toggle('is-visible', !entrees[0].isIntersecting &&
      entrees[0].boundingClientRect.top < 0);
  }, { threshold: 0 });

  observateur.observe(repere);
})();
