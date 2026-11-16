'use strict';
// Chargement et validation de config/studio.json + variables d'environnement.
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const CONFIG_PATH = process.env.STUDIO_CONFIG || path.join(ROOT, 'config', 'studio.json');

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const DAY_LABELS = { mon: 'Lundi', tue: 'Mardi', wed: 'Mercredi', thu: 'Jeudi', fri: 'Vendredi', sat: 'Samedi', sun: 'Dimanche' };

function fail(msg) {
  throw new Error(`config/studio.json : ${msg}`);
}

function hm(str) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(str));
  if (!m) fail(`heure invalide « ${str} » (format attendu HH:MM)`);
  const v = Number(m[1]) * 60 + Number(m[2]);
  if (v > 24 * 60 || Number(m[2]) > 59) fail(`heure invalide « ${str} »`);
  return v;
}

function loadConfig(file = CONFIG_PATH) {
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  const cfg = structuredClone(raw);

  cfg.timezone = cfg.timezone || 'Europe/Paris';
  cfg.currency = (cfg.currency || 'eur').toLowerCase();
  cfg.booking = {
    slotStepMinutes: 60,
    minNoticeHours: 2,
    maxAdvanceDays: 90,
    bufferMinutes: 0,
    freeCancellationHours: 48,
    ...cfg.booking,
  };
  cfg.payment = { depositPercent: 30, allowFullPayment: true, ...cfg.payment };
  const dep = Number(cfg.payment.depositPercent);
  if (!(dep >= 0 && dep <= 100)) fail('payment.depositPercent doit être entre 0 et 100');
  if (dep === 0 || dep === 100) cfg.payment.allowFullPayment = true;
  cfg.engineer = { count: 1, hourly: 0, label: 'Ingénieur du son', ...cfg.engineer };
  cfg.closures = Array.isArray(cfg.closures) ? cfg.closures : [];
  cfg.extras = Array.isArray(cfg.extras) ? cfg.extras : [];
  cfg.services = Array.isArray(cfg.services) ? cfg.services : [];
  cfg.testimonials = Array.isArray(cfg.testimonials) ? cfg.testimonials : [];
  cfg.faq = Array.isArray(cfg.faq) ? cfg.faq : [];
  cfg.legal = cfg.legal || {};

  // Horaires : minutes depuis minuit du jour d'ouverture. Une fermeture
  // inférieure ou égale à l'ouverture veut dire « le lendemain » (ex. 10:00 → 02:00).
  cfg.openingMinutes = {};
  for (const key of DAY_KEYS) {
    const h = cfg.hours ? cfg.hours[key] : null;
    if (!h) { cfg.openingMinutes[key] = null; continue; }
    if (!Array.isArray(h) || h.length !== 2) fail(`hours.${key} doit être ["HH:MM", "HH:MM"] ou null`);
    const open = hm(h[0]);
    let close = hm(h[1]);
    if (close <= open) close += 24 * 60;
    cfg.openingMinutes[key] = { open, close };
  }

  if (!Array.isArray(cfg.rooms) || cfg.rooms.length === 0) fail('au moins un studio est requis dans "rooms"');
  const ids = new Set();
  for (const room of cfg.rooms) {
    if (!room.id || !/^[a-z0-9-]+$/.test(room.id)) fail(`identifiant de studio invalide « ${room.id} » (minuscules, chiffres, tirets)`);
    if (ids.has(room.id)) fail(`identifiant de studio en double « ${room.id} »`);
    ids.add(room.id);
    if (!['included', 'optional', 'none'].includes(room.engineer)) room.engineer = 'none';
    room.features = room.features || [];
    room.gear = room.gear || [];
    const durations = Object.keys(room.prices || {}).map(Number).filter((d) => d > 0).sort((a, b) => a - b);
    if (!durations.length) fail(`le studio « ${room.id} » n'a aucun tarif`);
    for (const d of durations) {
      if (!(Number(room.prices[d]) >= 0)) fail(`tarif invalide pour « ${room.id} » (${d} h)`);
      if ((d * 60) % cfg.booking.slotStepMinutes !== 0) fail(`la durée ${d} h du studio « ${room.id} » n'est pas un multiple du pas de créneau`);
    }
    room.durations = durations;
    room.fromHourly = Math.min(...durations.map((d) => room.prices[d] / d));
  }
  const extraIds = new Set();
  for (const ex of cfg.extras) {
    if (!ex.id || extraIds.has(ex.id)) fail(`option invalide ou en double « ${ex.id} »`);
    extraIds.add(ex.id);
    ex.max = Math.max(1, Number(ex.max) || 1);
  }

  // Remplace les jetons {deposit} et {cancelHours} dans les textes de FAQ.
  const tokens = { deposit: cfg.payment.depositPercent, cancelHours: cfg.booking.freeCancellationHours };
  const fill = (s) => String(s).replace(/\{(\w+)\}/g, (m, k) => (k in tokens ? tokens[k] : m));
  cfg.faq = cfg.faq.map((f) => ({ q: fill(f.q), a: fill(f.a) }));

  return cfg;
}

function env() {
  const port = Number(process.env.PORT) || 3000;
  return {
    port,
    baseUrl: (process.env.BASE_URL || process.env.RENDER_EXTERNAL_URL || `http://localhost:${port}`).replace(/\/$/, ''),
    production: process.env.NODE_ENV === 'production',
    // Aperçu : bandeau « informations fictives » et site non référencé par les moteurs de recherche.
    preview: process.env.PREVIEW === 'true',
    dataDir: process.env.DATA_DIR || path.join(ROOT, 'data'),
    stripeSecretKey: process.env.STRIPE_SECRET_KEY || '',
    stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
    adminPassword: process.env.ADMIN_PASSWORD || '',
    sessionSecret: process.env.SESSION_SECRET || '',
    smtp: {
      host: process.env.SMTP_HOST || '',
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASS || '',
      from: process.env.MAIL_FROM || '',
    },
    notifyEmail: process.env.STUDIO_NOTIFY_EMAIL || '',
  };
}

module.exports = { loadConfig, env, DAY_KEYS, DAY_LABELS, ROOT };
