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

/* Menus déroulants du bandeau : « À propos » et « Découvrir ».
   Ouverture au clic plutôt qu'au survol — ça marche pareil au clavier, à la
   souris et au doigt sur tablette, et ça évite le menu qui s'ouvre tout seul
   quand on ne fait que passer la souris en allant ailleurs. Un seul menu
   ouvert à la fois ; un clic ailleurs ou Échap referme. */
(function () {
  'use strict';

  var groupes = document.querySelectorAll('[data-nav-drop]');
  if (!groupes.length) return;

  function fermerTous(saufDeclencheur) {
    groupes.forEach(function (g) {
      var declencheur = g.querySelector('[data-nav-drop-trigger]');
      var panneau = g.querySelector('[data-nav-drop-panel]');
      if (!declencheur || !panneau || declencheur === saufDeclencheur) return;
      declencheur.setAttribute('aria-expanded', 'false');
      panneau.hidden = true;
    });
  }

  groupes.forEach(function (g) {
    var declencheur = g.querySelector('[data-nav-drop-trigger]');
    var panneau = g.querySelector('[data-nav-drop-panel]');
    if (!declencheur || !panneau) return;

    declencheur.addEventListener('click', function (ev) {
      ev.stopPropagation();
      var etaitOuvert = declencheur.getAttribute('aria-expanded') === 'true';
      fermerTous(null);
      declencheur.setAttribute('aria-expanded', String(!etaitOuvert));
      panneau.hidden = etaitOuvert;
    });
  });

  document.addEventListener('click', function () { fermerTous(null); });

  document.addEventListener('keydown', function (ev) {
    if (ev.key !== 'Escape') return;
    var declencheurActif = document.activeElement &&
      document.activeElement.closest('[data-nav-drop]') &&
      document.activeElement.closest('[data-nav-drop]').querySelector('[data-nav-drop-trigger]');
    fermerTous(null);
    if (declencheurActif) declencheurActif.focus();
  });
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

/* Deux diaporamas, un seul mécanisme : chaque groupe de diapositives vit dans
   un rail qui défile au cran (scroll-snap). Les onglets et les flèches ne font
   que pousser le rail ; le balayage au doigt et le défilement au trackpad
   fonctionnent donc sans code, et c'est le rail qui reste la source de vérité
   — on relit sa position pour remettre les onglets et le compteur à jour. */
(function () {
  'use strict';

  var reduit = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Pousse un rail sur la diapositive i. */
  function pousser(rail, i) {
    rail.scrollTo({ left: rail.clientWidth * i, behavior: reduit ? 'auto' : 'smooth' });
  }

  /* Diapositive actuellement au cran. */
  function rangCourant(rail) {
    return Math.round(rail.scrollLeft / rail.clientWidth);
  }

  /* Appelle `sur` quand le défilement s'est stabilisé — un défilement fluide
     émet des dizaines d'événements, on ne garde que le dernier. */
  function auRepos(rail, sur) {
    var attente;
    rail.addEventListener('scroll', function () {
      window.clearTimeout(attente);
      attente = window.setTimeout(sur, 90);
    });
  }

  /* Ne laisse dans l'arbre d'accessibilité que l'élément i de la liste. */
  function nExposerQue(elements, i) {
    for (var j = 0; j < elements.length; j++) {
      if (!elements[j]) continue;
      if (j === i) elements[j].removeAttribute('aria-hidden');
      else elements[j].setAttribute('aria-hidden', 'true');
    }
  }

  /* ---- « Trois gestes » : onglets nommés, deux rails synchronisés -------- */
  (function () {
    var bloc = document.querySelector('[data-tabs]');
    if (!bloc) return;

    var onglets = bloc.querySelectorAll('[role="tab"]');
    var panneaux = bloc.querySelectorAll('[role="tabpanel"]');
    var visuels = bloc.querySelectorAll('[data-tab-media]');
    var rails = bloc.querySelectorAll('[data-tab-rail]');
    if (!onglets.length || !rails.length) return;

    var courant = 0;

    function marquer(i) {
      for (var j = 0; j < onglets.length; j++) {
        var actif = j === i;
        onglets[j].setAttribute('aria-selected', String(actif));
        onglets[j].tabIndex = actif ? 0 : -1;
      }
      nExposerQue(panneaux, i);
      nExposerQue(visuels, i);
      courant = i;
    }

    function aller(i, donnerLeFocus) {
      for (var r = 0; r < rails.length; r++) pousser(rails[r], i);
      marquer(i);
      if (donnerLeFocus) onglets[i].focus();
    }

    for (var k = 0; k < onglets.length; k++) {
      (function (i) {
        onglets[i].addEventListener('click', function () { aller(i, false); });
        onglets[i].addEventListener('keydown', function (ev) {
          var d = ev.key === 'ArrowRight' ? 1 : ev.key === 'ArrowLeft' ? -1 : 0;
          if (!d) return;
          ev.preventDefault();
          aller((i + d + onglets.length) % onglets.length, true);
        });
      })(k);
    }

    /* Balayage direct sur l'un des rails : on remet les onglets à jour et on
       aligne l'autre rail. Pas de boucle à craindre — si l'autre rail est déjà
       au bon cran, scrollTo n'émet aucun événement. */
    for (var m = 0; m < rails.length; m++) {
      (function (rail) {
        auRepos(rail, function () {
          var i = rangCourant(rail);
          if (i === courant || i < 0 || i >= onglets.length) return;
          marquer(i);
          for (var n = 0; n < rails.length; n++) {
            if (rails[n] !== rail) pousser(rails[n], i);
          }
        });
      })(rails[m]);
    }
  })();

  /* ---- « Développez votre activité » : deux flèches, un rail ------------- */
  (function () {
    var bloc = document.querySelector('[data-grow]');
    if (!bloc) return;

    var rail = bloc.querySelector('[data-grow-rail]');
    if (!rail) return;

    var diapos = rail.querySelectorAll('.grow__row');
    var rang = bloc.querySelector('[data-grow-rang]');
    var prec = bloc.querySelector('[data-grow-prec]');
    var suiv = bloc.querySelector('[data-grow-suiv]');
    if (diapos.length < 2) return;

    var courante = 0;

    function marquer(i) {
      courante = i;
      if (rang) rang.textContent = String(i + 1);
      nExposerQue(diapos, i);
      /* Aux extrémités la flèche s'éteint : sur un rail, revenir de la
         dernière à la première par un balayage complet se lit comme un raté. */
      if (prec) prec.disabled = i === 0;
      if (suiv) suiv.disabled = i === diapos.length - 1;
    }

    function aller(pas) {
      var cible = Math.min(Math.max(courante + pas, 0), diapos.length - 1);
      if (cible === courante) return;
      pousser(rail, cible);
      marquer(cible);
    }

    if (prec) prec.addEventListener('click', function () { aller(-1); });
    if (suiv) suiv.addEventListener('click', function () { aller(1); });

    auRepos(rail, function () {
      var i = rangCourant(rail);
      if (i !== courante && i >= 0 && i < diapos.length) marquer(i);
    });

    marquer(0);
  })();
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

/* Bandeau cookies.
   Purement informatif tant qu'aucun cookie non essentiel n'est déposé : pas
   de choix accepter/refuser à faire, donc pas de rideau bloquant ni de reflow
   de page. Le jour où un outil de mesure d'audience est ajouté, ce bloc est
   celui à transformer en bandeau de consentement (deux boutons à égalité de
   poids visuel, refus aussi simple que l'acceptation — l'exigence de la
   CNIL). Le choix « compris » est mémorisé par appareil, pas par session :
   il ne doit pas réapparaître à chaque visite. */
(function () {
  'use strict';

  var CLE = 'dealpick-cookies-vu';
  var bandeau = document.querySelector('[data-cookie-bar]');
  if (!bandeau) return;

  function ouvrir() { bandeau.hidden = false; }
  function fermer() {
    bandeau.hidden = true;
    try { localStorage.setItem(CLE, '1'); } catch (e) { /* stockage indisponible : tant pis, on ne bloque rien */ }
  }

  var dejaVu = false;
  try { dejaVu = localStorage.getItem(CLE) === '1'; } catch (e) { /* considéré comme non vu */ }
  if (!dejaVu) ouvrir();

  /* Sur les pages qui portent la barre d'action mobile, décale le bandeau
     cookies pour que les deux ne se chevauchent pas en bas d'écran. */
  if (document.querySelector('[data-sticky-cta]')) {
    bandeau.classList.add('is-with-sticky-cta');
  }

  var boutonFermer = bandeau.querySelector('[data-cookie-dismiss]');
  if (boutonFermer) boutonFermer.addEventListener('click', fermer);

  var reouvertures = document.querySelectorAll('[data-cookie-reopen]');
  for (var i = 0; i < reouvertures.length; i++) {
    reouvertures[i].addEventListener('click', function (ev) {
      ev.preventDefault();
      ouvrir();
      bandeau.scrollIntoView({ block: 'end', behavior: 'smooth' });
    });
  }
})();
