'use strict';
// Rendu des pages HTML : les contenus (studios, tarifs, horaires, FAQ...) sont
// injectés depuis config/studio.json pour qu'il n'y ait qu'une source de vérité
// et que les moteurs de recherche voient le contenu complet.
const fs = require('node:fs');
const path = require('node:path');
const { fmtEur } = require('./pricing');
const { DAY_LABELS } = require('./config');
const T = require('./time');

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const icon = (name, cls = '') => `<svg class="icon${cls ? ` ${cls}` : ''}" aria-hidden="true"><use href="/assets/img/icons.svg#${name}"/></svg>`;
const DAY_ORDER = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

function euro(n) {
  return fmtEur(Math.round(Number(n) * 100));
}

function hoursLabel(cfg, key) {
  const w = cfg.openingMinutes[key];
  if (!w) return 'Fermé';
  return `${T.fmtMin(w.open)} – ${w.close === 1440 ? '00:00' : T.fmtMin(w.close)}`;
}

// Hauteurs pseudo-aléatoires mais stables pour l'illustration d'un studio.
function bars(seed, n) {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  const out = [];
  for (let i = 0; i < n; i++) {
    h = Math.imul(h ^ (h >>> 13), 0x5bd1e995) >>> 0;
    const env = Math.sin((i / (n - 1)) * Math.PI);
    out.push(Math.round(18 + env * 62 * (0.45 + (h % 1000) / 1800)));
  }
  return out;
}

function roomVisual(room, index) {
  if (room.image) {
    return `<div class="room-visual has-image" style="--accent:${esc(room.accent)}"><img src="${esc(room.image)}" alt="${esc(room.name)}" loading="lazy" width="1200" height="900"></div>`;
  }
  const b = bars(room.id, 28).map((v, i) => `<span style="--h:${v}%;--i:${i}"></span>`).join('');
  return `<div class="room-visual" style="--accent:${esc(room.accent)}" aria-hidden="true">
    <div class="room-visual__glow"></div>
    <div class="room-visual__grid"></div>
    <div class="room-visual__bars">${b}</div>
    <div class="room-visual__label"><span>${String(index + 1).padStart(2, '0')}</span>${esc(room.name.split(' ').slice(-1)[0])}</div>
  </div>`;
}

function engineerText(cfg, room) {
  if (room.engineer === 'included') return 'Ingé son inclus';
  if (room.engineer === 'optional') return `Ingé son en option (+${euro(cfg.engineer.hourly)}/h)`;
  return 'En autonomie';
}

const blocks = {
  rooms(cfg) {
    return cfg.rooms.map((r, i) => `
    <article class="room reveal" id="studio-${esc(r.id)}" style="--accent:${esc(r.accent)}">
      ${roomVisual(r, i)}
      <div class="room__body">
        <p class="eyebrow">${esc(r.kind)}</p>
        <h3 class="room__title">${esc(r.name)}</h3>
        <p class="room__text">${esc(r.description)}</p>
        <ul class="room__meta">
          <li>${icon('area')}<span>${esc(r.size)}</span></li>
          <li>${icon('users')}<span>Jusqu'à ${esc(r.capacity)} pers.</span></li>
          <li>${icon('headphones')}<span>${esc(engineerText(cfg, r))}</span></li>
        </ul>
        <ul class="chips">${r.features.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>
        <details class="gear">
          <summary>${icon('chevron-down')}Voir le matériel</summary>
          <ul>${r.gear.map((g) => `<li>${esc(g)}</li>`).join('')}</ul>
        </details>
        <div class="room__foot">
          <p class="room__price"><span>Dès</span> <strong>${euro(r.fromHourly)}</strong><span>/h</span></p>
          <a class="btn btn--primary" href="/reserver?studio=${esc(r.id)}">Réserver ${esc(r.name.split(' ').slice(-1)[0])} ${icon('arrow-right')}</a>
        </div>
      </div>
    </article>`).join('');
  },

  services(cfg) {
    return cfg.services.map((s) => `
      <li class="service reveal">
        <span class="service__icon">${icon(s.icon || 'sparkle')}</span>
        <h3>${esc(s.title)}</h3>
        <p>${esc(s.text)}</p>
      </li>`).join('');
  },

  pricing(cfg) {
    return cfg.rooms.map((r) => `
      <article class="price-card reveal" style="--accent:${esc(r.accent)}">
        <header>
          <p class="eyebrow">${esc(r.kind)}</p>
          <h3>${esc(r.name)}</h3>
          <p class="price-card__from"><strong>${euro(r.fromHourly)}</strong> /h <span>au meilleur tarif</span></p>
        </header>
        <ul class="price-list">
          ${r.durations.map((d) => {
            const per = r.prices[d] / d;
            const save = r.prices[r.durations[0]] / r.durations[0] - per;
            return `<li><span>${d} h${d >= 8 ? ' · journée' : d === 4 ? ' · demi-journée' : ''}</span><span class="price-list__val">${save > 0.5 ? `<em>${euro(per)}/h</em>` : ''}<strong>${euro(r.prices[d])}</strong></span></li>`;
          }).join('')}
        </ul>
        <p class="price-card__note">${icon('headphones')} ${esc(engineerText(cfg, r))}</p>
        <a class="btn btn--ghost btn--block" href="/reserver?studio=${esc(r.id)}">Choisir ce studio ${icon('arrow-right')}</a>
      </article>`).join('');
  },

  extras(cfg) {
    return cfg.extras.map((e) => `
      <li class="extra">
        <div><h4>${esc(e.name)}</h4><p>${esc(e.description || '')}</p></div>
        <p class="extra__price"><strong>${euro(e.price)}</strong><span>/${esc(e.unit || 'unité')}</span></p>
      </li>`).join('');
  },

  faq(cfg) {
    return cfg.faq.map((f, i) => `
      <details class="faq__item"${i === 0 ? ' open' : ''}>
        <summary><span>${esc(f.q)}</span><span class="faq__toggle" aria-hidden="true">${icon('plus')}</span></summary>
        <div class="faq__answer"><p>${esc(f.a)}</p></div>
      </details>`).join('');
  },

  hours(cfg) {
    return DAY_ORDER.map((k) => `<li data-day="${k}"><span>${DAY_LABELS[k]}</span><span>${hoursLabel(cfg, k)}</span></li>`).join('');
  },

  socials(cfg) {
    const s = cfg.studio.socials || {};
    const names = { instagram: 'Instagram', tiktok: 'TikTok', youtube: 'YouTube' };
    return Object.keys(names).filter((k) => s[k]).map((k) =>
      `<a class="social" href="${esc(s[k])}" target="_blank" rel="noopener" aria-label="${names[k]}">${icon(k)}</a>`).join('');
  },

  testimonials(cfg) {
    if (!cfg.testimonials.length) return '';
    return `<section class="section testimonials" aria-labelledby="t-title"><div class="container">
      <h2 id="t-title" class="section__title reveal">Ils sont passés par l'Empire.</h2>
      <ul class="quotes">${cfg.testimonials.map((t) => `<li class="quote reveal"><blockquote>« ${esc(t.text)} »</blockquote><p><strong>${esc(t.name)}</strong>${t.role ? ` · ${esc(t.role)}` : ''}</p></li>`).join('')}</ul>
    </div></section>`;
  },

  jsonld(cfg, env) {
    const a = cfg.studio.address || {};
    const spec = DAY_ORDER.filter((k) => cfg.openingMinutes[k]).map((k) => {
      const w = cfg.openingMinutes[k];
      return { '@type': 'OpeningHoursSpecification', dayOfWeek: `https://schema.org/${{ mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday' }[k]}`, opens: T.fmtMin(w.open), closes: w.close >= 1440 ? (w.close === 1440 ? '23:59' : T.fmtMin(w.close)) : T.fmtMin(w.close) };
    });
    const data = {
      '@context': 'https://schema.org',
      '@type': 'LocalBusiness',
      additionalType: 'https://en.wikipedia.org/wiki/Recording_studio',
      name: cfg.studio.name,
      description: cfg.studio.description,
      url: env.baseUrl,
      logo: `${env.baseUrl}/assets/img/logo.svg`,
      telephone: cfg.studio.phone,
      email: cfg.studio.email,
      priceRange: `${euro(Math.min(...cfg.rooms.map((r) => r.fromHourly)))} – ${euro(Math.max(...cfg.rooms.map((r) => r.fromHourly)))} /h`,
      address: { '@type': 'PostalAddress', streetAddress: a.street, postalCode: a.zip, addressLocality: a.city, addressCountry: a.country || 'FR' },
      openingHoursSpecification: spec,
      sameAs: Object.values(cfg.studio.socials || {}).filter(Boolean),
    };
    return `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`;
  },

  header(cfg, env) {
    const preview = env && env.preview
      ? '<p class="preview-bar" role="note"><strong>Aperçu</strong><span class="preview-bar__long">· site en préparation : adresse, tarifs et paiements fictifs</span><span class="preview-bar__short">· infos et paiements fictifs</span></p>'
      : '';
    return `<a class="skip" href="#main">Aller au contenu</a>
<header class="site-header" data-header>
  ${preview}
  <div class="container site-header__inner">
    <a class="brand" href="/" aria-label="${esc(cfg.studio.name)}, accueil">
      <img src="/assets/img/logo.svg" alt="" width="34" height="34">
      <span class="brand__name">Phoenix<span>Empire</span></span>
    </a>
    <nav class="nav" aria-label="Navigation principale" data-nav>
      <ul>
        <li><a href="/#studios">Studios</a></li>
        <li><a href="/#services">Services</a></li>
        <li><a href="/#tarifs">Tarifs</a></li>
        <li><a href="/#faq">FAQ</a></li>
        <li><a href="/#contact">Contact</a></li>
      </ul>
      <a class="btn btn--primary nav__cta" href="/reserver">Réserver ${icon('arrow-right')}</a>
    </nav>
    <a class="btn btn--primary btn--sm header-cta" href="/reserver">Réserver</a>
    <button class="burger" type="button" aria-label="Ouvrir le menu" aria-expanded="false" data-burger><span></span><span></span></button>
  </div>
</header>`;
  },

  footer(cfg) {
    const a = cfg.studio.address || {};
    return `<footer class="site-footer">
  <div class="container">
    <div class="site-footer__top">
      <div class="site-footer__brand">
        <a class="brand" href="/"><img src="/assets/img/logo.svg" alt="" width="34" height="34"><span class="brand__name">Phoenix<span>Empire</span></span></a>
        <p>${esc(cfg.studio.tagline)} · ${esc(a.city || '')}</p>
        <div class="socials">${blocks.socials(cfg)}</div>
      </div>
      <nav class="site-footer__cols" aria-label="Pied de page">
        <div><h4>Studio</h4><ul><li><a href="/#studios">Nos studios</a></li><li><a href="/#services">Services</a></li><li><a href="/#tarifs">Tarifs</a></li><li><a href="/reserver">Réserver</a></li></ul></div>
        <div><h4>Infos</h4><ul><li><a href="/#faq">Questions fréquentes</a></li><li><a href="/#contact">Accès & horaires</a></li><li><a href="mailto:${esc(cfg.studio.email)}">${esc(cfg.studio.email)}</a></li><li><a href="tel:${esc(String(cfg.studio.phone).replace(/[^+\d]/g, ''))}">${esc(cfg.studio.phone)}</a></li></ul></div>
        <div><h4>Légal</h4><ul><li><a href="/legal/mentions-legales">Mentions légales</a></li><li><a href="/legal/cgv">Conditions de vente</a></li><li><a href="/legal/confidentialite">Confidentialité</a></li></ul></div>
      </nav>
    </div>
    <div class="site-footer__bottom">
      <p>© ${new Date().getFullYear()} ${esc(cfg.studio.name)}. Tous droits réservés.</p>
      <p class="site-footer__pay">${icon('lock')} Paiement sécurisé par Stripe</p>
    </div>
  </div>
  <p class="site-footer__giant" aria-hidden="true">Phoenix Empire</p>
</footer>`;
  },
};

function vars(cfg, env) {
  const a = cfg.studio.address || {};
  const minHourly = Math.min(...cfg.rooms.map((r) => r.fromHourly));
  return {
    'studio.name': cfg.studio.name,
    'studio.tagline': cfg.studio.tagline,
    'studio.city': cfg.studio.city || a.city,
    'studio.description': cfg.studio.description,
    'studio.email': cfg.studio.email,
    'studio.phone': cfg.studio.phone,
    'studio.phoneHref': String(cfg.studio.phone).replace(/[^+\d]/g, ''),
    'studio.mapsUrl': cfg.studio.mapsUrl,
    'address.street': a.street,
    'address.zip': a.zip,
    'address.city': a.city,
    'address.access': a.access || '',
    'address.full': [a.street, [a.zip, a.city].filter(Boolean).join(' ')].filter(Boolean).join(', '),
    fromPrice: euro(minHourly),
    deposit: cfg.payment.depositPercent,
    cancelHours: cfg.booking.freeCancellationHours,
    roomCount: cfg.rooms.length,
    engineerHourly: euro(cfg.engineer.hourly),
    baseUrl: env.baseUrl,
    year: new Date().getFullYear(),
    ...Object.fromEntries(Object.entries(cfg.legal).map(([k, v]) => [`legal.${k}`, v])),
  };
}

// Typographie française : espace insécable avant « : ; ? ! » et à l'intérieur des guillemets,
// appliquée uniquement au texte (jamais dans les balises).
function frenchSpacing(html) {
  return html.replace(/>([^<]+)</g, (m, text) => `>${text
    .replace(/ ([:;?!»])/g, '\u202f$1')
    .replace(/« /g, '«\u202f')}<`);
}

function renderTemplate(html, cfg, env) {
  const v = vars(cfg, env);
  return frenchSpacing(html
    .replace(/<!--@(\w+)-->/g, (m, name) => (blocks[name] ? blocks[name](cfg, env) : m))
    .replace(/\{\{([\w.]+)\}\}/g, (m, key) => {
      if (!(key in v)) return m;
      // Les champs encore « [À COMPLÉTER] » sont surlignés pour ne pas être oubliés.
      if (/^\[.*\]$/.test(String(v[key]))) return `<span class="todo">${esc(v[key])}</span>`;
      return esc(v[key]);
    }));
}

// Rend toutes les pages .html du dossier public au démarrage.
function renderSite(publicDir, cfg, env) {
  const pages = new Map();
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) { if (entry.name !== 'assets') walk(full); continue; }
      if (!entry.name.endsWith('.html')) continue;
      const rel = '/' + path.relative(publicDir, full).split(path.sep).join('/');
      pages.set(rel, renderTemplate(fs.readFileSync(full, 'utf8'), cfg, env));
    }
  };
  walk(publicDir);
  return pages;
}

module.exports = { renderSite, renderTemplate, esc };
