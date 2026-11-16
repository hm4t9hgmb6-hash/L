'use strict';
const path = require('node:path');
const crypto = require('node:crypto');
const express = require('express');

const { loadConfig, env: loadEnv, DAY_LABELS } = require('./src/config');
const { openDb } = require('./src/db');
const { createAvailability } = require('./src/availability');
const { createPayments } = require('./src/payments');
const { createMailer } = require('./src/mailer');
const { createBookingService, HttpError } = require('./src/bookings');
const { buildIcs } = require('./src/ics');
const { renderSite } = require('./src/render');
const T = require('./src/time');

function createApp(options = {}) {
  const cfg = options.config || loadConfig();
  const env = { ...loadEnv(), ...(options.env || {}) };
  const db = options.db || openDb(path.join(env.dataDir, 'phoenix.sqlite'));
  const avail = createAvailability(cfg, db);
  const payments = options.payments || createPayments(cfg, env);
  const mailer = options.mailer || createMailer(cfg, env);
  const svc = createBookingService({ cfg, env, db, avail, payments, mailer });
  const publicDir = path.join(__dirname, 'public');
  const pages = renderSite(publicDir, cfg, env);

  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  // --- En-têtes de sécurité -------------------------------------------------
  app.use((req, res, next) => {
    res.set({
      'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'X-Frame-Options': 'DENY',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    });
    if (env.production) res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    next();
  });

  // --- Webhook Stripe (corps brut, avant express.json) ----------------------
  app.post('/api/stripe/webhook', express.raw({ type: 'application/json', limit: '1mb' }), async (req, res) => {
    let event;
    try {
      event = payments.constructEvent(req.body, req.get('stripe-signature'));
    } catch (err) {
      console.error(`[webhook] rejeté : ${err.message}`);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }
    try {
      await svc.handleStripeEvent(event);
      res.json({ received: true });
    } catch (err) {
      console.error(`[webhook] erreur de traitement : ${err.message}`);
      res.status(500).json({ error: 'traitement impossible' });
    }
  });

  app.use(express.json({ limit: '50kb' }));

  // --- Limitation de débit simple, en mémoire -------------------------------
  function rateLimit({ windowMs, max }) {
    const hits = new Map();
    setInterval(() => { const now = Date.now(); for (const [k, v] of hits) if (v.reset < now) hits.delete(k); }, windowMs).unref();
    return (req, res, next) => {
      const now = Date.now();
      const key = req.ip;
      let h = hits.get(key);
      if (!h || h.reset < now) { h = { count: 0, reset: now + windowMs }; hits.set(key, h); }
      if (++h.count > max) return res.status(429).json({ error: 'Trop de tentatives. Patiente quelques minutes.' });
      next();
    };
  }
  const bookingLimiter = rateLimit({ windowMs: 10 * 60 * 1000, max: options.rateLimitMax || 20 });
  const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: options.rateLimitMax || 10 });

  const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

  // --- API publique ---------------------------------------------------------
  const publicConfig = {
    studio: cfg.studio,
    timezone: cfg.timezone,
    currency: cfg.currency,
    booking: {
      slotStepMinutes: cfg.booking.slotStepMinutes,
      maxAdvanceDays: cfg.booking.maxAdvanceDays,
      minNoticeHours: cfg.booking.minNoticeHours,
      freeCancellationHours: cfg.booking.freeCancellationHours,
    },
    payment: { ...cfg.payment, provider: payments.enabled ? 'stripe' : 'demo' },
    engineer: { hourly: cfg.engineer.hourly, label: cfg.engineer.label },
    hours: Object.fromEntries(Object.entries(cfg.openingMinutes).map(([k, w]) => [k, w ? { open: w.open, close: w.close } : null])),
    dayLabels: DAY_LABELS,
    closures: cfg.closures,
    rooms: cfg.rooms.map((r) => ({
      id: r.id, name: r.name, kind: r.kind, short: r.short, size: r.size, capacity: r.capacity,
      engineer: r.engineer, accent: r.accent, features: r.features, prices: r.prices, durations: r.durations, fromHourly: r.fromHourly,
    })),
    extras: cfg.extras.map((e) => ({ id: e.id, name: e.name, description: e.description, price: e.price, unit: e.unit, max: e.max })),
  };

  app.get('/api/config', (req, res) => res.json(publicConfig));

  app.get('/api/availability', (req, res) => {
    const out = avail.monthSummary({
      roomId: String(req.query.room || ''),
      month: String(req.query.month || ''),
      durationH: Number(req.query.duration) || 1,
      engineer: req.query.engineer === '1',
    });
    if (!out) return res.status(400).json({ error: 'Paramètres invalides.' });
    res.set('Cache-Control', 'no-store').json(out);
  });

  app.get('/api/slots', (req, res) => {
    const roomId = String(req.query.room || '');
    const date = String(req.query.date || '');
    const r = avail.room(roomId);
    if (!r || !T.parseDate(date)) return res.status(400).json({ error: 'Paramètres invalides.' });
    const durationH = Number(req.query.duration) || r.durations[0];
    if (!r.durations.includes(durationH)) return res.status(400).json({ error: 'Durée non proposée.' });
    const slots = avail.slotsFor({ roomId, date, durationH, engineer: req.query.engineer === '1' })
      .map(({ start, end, startMin, available }) => ({ start, end, startMin, available }));
    res.set('Cache-Control', 'no-store').json({ date, dateLabel: T.fmtDateLong(date), slots });
  });

  // Prochains créneaux libres par studio (bloc « dispo maintenant » de l'accueil).
  app.get('/api/next-slots', (req, res) => {
    const now = T.nowLocal(cfg.timezone);
    const out = [];
    for (const r of cfg.rooms) {
      const durationH = r.durations.find((d) => d >= 2) || r.durations[0];
      let found = null;
      for (let i = 0; i < 14 && !found; i++) {
        const date = T.addDays(now.date, i);
        const s = avail.slotsFor({ roomId: r.id, date, durationH, engineer: false }).find((x) => x.available);
        if (s) found = { date, start: s.start, offset: i };
      }
      out.push({ roomId: r.id, name: r.name, accent: r.accent, durationH, fromHourly: r.fromHourly, slot: found });
    }
    res.set('Cache-Control', 'no-store').json({ today: now.date, rooms: out });
  });

  app.post('/api/bookings', bookingLimiter, wrap(async (req, res) => {
    const out = await svc.createFromWeb(req.body || {});
    res.status(201).json(out);
  }));

  function findWithToken(req) {
    const b = db.getByRef(req.params.ref);
    const token = String(req.query.t || (req.body && req.body.t) || '');
    if (!b || token.length !== b.token.length || !crypto.timingSafeEqual(Buffer.from(token), Buffer.from(b.token))) {
      throw new HttpError(404, 'Réservation introuvable.');
    }
    return b;
  }

  app.get('/api/bookings/:ref', wrap(async (req, res) => {
    let b = findWithToken(req);
    b = await svc.syncWithStripe(b);
    res.set('Cache-Control', 'no-store').json(svc.publicView(b));
  }));

  app.get('/api/bookings/:ref/ics', wrap(async (req, res) => {
    const b = findWithToken(req);
    if (b.status !== 'confirmed') throw new HttpError(409, 'Réservation non confirmée.');
    res.set({ 'Content-Type': 'text/calendar; charset=utf-8', 'Content-Disposition': `attachment; filename="${b.ref}.ics"` });
    res.send(buildIcs(cfg, b, mailer.manageUrl(b)));
  }));

  app.post('/api/bookings/:ref/cancel', bookingLimiter, wrap(async (req, res) => {
    const b = findWithToken(req);
    const { booking, refundedCents } = await svc.cancel(b, { by: 'customer' });
    res.json({ ...svc.publicView(booking), justRefundedCents: refundedCents });
  }));

  // Mode démo : simule un paiement réussi.
  app.post('/api/demo/pay/:ref', wrap(async (req, res) => {
    if (!payments.demo) throw new HttpError(404, 'Indisponible.');
    const b = findWithToken(req);
    if (b.status !== 'pending' || b.hold_expires_at <= Date.now()) {
      throw new HttpError(409, 'Cette demande de paiement a expiré. Recommence ta réservation.');
    }
    const out = await svc.confirmPaid(b.id, { amountCents: b.due_cents });
    res.json(svc.publicView(out));
  }));

  // --- Espace studio (admin) --------------------------------------------------
  const sessionSecret = env.sessionSecret || crypto.createHash('sha256').update(`phoenix:${env.adminPassword}`).digest('hex');
  const sign = (v) => crypto.createHmac('sha256', sessionSecret).update(v).digest('base64url');
  const COOKIE = 'pe_admin';

  function readCookie(req, name) {
    const raw = req.headers.cookie || '';
    for (const part of raw.split(';')) {
      const i = part.indexOf('=');
      if (i > -1 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
    }
    return '';
  }

  function isAdmin(req) {
    if (!env.adminPassword) return false;
    const [exp, sig] = readCookie(req, COOKIE).split('.');
    if (!exp || !sig || Number(exp) < Date.now()) return false;
    const expected = sign(exp);
    return sig.length === expected.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  }

  function requireAdmin(req, res, next) {
    if (!isAdmin(req)) return res.status(401).json({ error: 'Connexion requise.' });
    next();
  }

  app.post('/api/admin/login', loginLimiter, (req, res) => {
    if (!env.adminPassword) return res.status(503).json({ error: 'Espace studio désactivé : définis ADMIN_PASSWORD dans le fichier .env.' });
    const given = crypto.createHash('sha256').update(String((req.body && req.body.password) || '')).digest();
    const expected = crypto.createHash('sha256').update(env.adminPassword).digest();
    if (!crypto.timingSafeEqual(given, expected)) return res.status(401).json({ error: 'Mot de passe incorrect.' });
    const exp = String(Date.now() + 12 * 3600 * 1000);
    res.cookie(COOKIE, `${exp}.${sign(exp)}`, { httpOnly: true, sameSite: 'strict', secure: env.production, maxAge: 12 * 3600 * 1000, path: '/' });
    res.json({ ok: true });
  });

  app.post('/api/admin/logout', (req, res) => {
    res.clearCookie(COOKIE, { path: '/' });
    res.json({ ok: true });
  });

  app.get('/api/admin/session', (req, res) => res.json({ authenticated: isAdmin(req), configured: !!env.adminPassword }));

  app.use('/api/admin', requireAdmin);

  app.get('/api/admin/overview', (req, res) => {
    const now = T.nowLocal(cfg.timezone);
    const monthStart = T.toAbs(`${now.date.slice(0, 7)}-01`, 0);
    const [y, m] = now.date.split('-').map(Number);
    const monthEnd = T.toAbs(T.dateOfDay(Date.UTC(y, m, 1) / 86400000), 0);
    const week = db.listBookings({ fromAbs: now.abs, toAbs: now.abs + 7 * 1440, status: 'confirmed' });
    const month = db.stats(Date.now(), monthStart, monthEnd);
    const pending = db.listBookings({ fromAbs: now.abs, status: 'pending' }).filter((b) => b.hold_expires_at > Date.now());
    res.json({
      today: now.date,
      nowMin: now.minutes,
      upcomingWeek: week.length,
      pendingCount: pending.length,
      month: { label: new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(monthStart * 60000)), ...month },
      provider: payments.enabled ? (env.stripeSecretKey.startsWith('sk_live') ? 'stripe-live' : 'stripe-test') : 'demo',
      mail: env.smtp.host ? 'smtp' : 'outbox',
      rooms: cfg.rooms.map((r) => ({ id: r.id, name: r.name, accent: r.accent, durations: r.durations, engineer: r.engineer, prices: r.prices })),
      extras: publicConfig.extras,
      hours: publicConfig.hours,
    });
  });

  app.get('/api/admin/bookings', (req, res) => {
    const from = req.query.from && T.parseDate(req.query.from) ? T.toAbs(String(req.query.from), 0) : null;
    const to = req.query.to && T.parseDate(req.query.to) ? T.toAbs(String(req.query.to), 0) + 1440 : null;
    const list = db.listBookings({ fromAbs: from, toAbs: to, status: String(req.query.status || 'all'), q: String(req.query.q || '').slice(0, 80) });
    res.json({ bookings: list.map(svc.adminView) });
  });

  app.post('/api/admin/bookings', wrap(async (req, res) => {
    const b = svc.createManual(req.body || {});
    res.status(201).json(svc.adminView(b));
  }));

  app.post('/api/admin/bookings/:id/cancel', wrap(async (req, res) => {
    const b = db.getById(Number(req.params.id));
    if (!b) throw new HttpError(404, 'Réservation introuvable.');
    const { booking, refundedCents } = await svc.cancel(b, { by: 'studio', refund: !!(req.body && req.body.refund), reason: req.body && req.body.reason });
    res.json({ ...svc.adminView(booking), justRefundedCents: refundedCents });
  }));

  app.post('/api/admin/bookings/:id/mark-paid', wrap(async (req, res) => {
    const b = db.getById(Number(req.params.id));
    if (!b) throw new HttpError(404, 'Réservation introuvable.');
    if (b.status !== 'confirmed') throw new HttpError(409, 'Seule une réservation confirmée peut être soldée.');
    res.json(svc.adminView(db.update(b.id, { paid_cents: Math.max(b.paid_cents, b.total_cents) })));
  }));

  app.get('/api/admin/blocks', (req, res) => {
    const now = T.nowLocal(cfg.timezone);
    const list = db.blocks(now.abs - 1440, now.abs + 400 * 1440).map((bl) => {
      const s = T.fromAbs(bl.start_abs);
      const e = T.fromAbs(bl.end_abs);
      return { ...bl, roomName: bl.room_id ? (avail.room(bl.room_id) || {}).name || bl.room_id : 'Tous les studios', startLabel: `${T.fmtDateShort(s.date)} ${T.fmtMin(s.minutes)}`, endLabel: `${T.fmtDateShort(e.date)} ${T.fmtMin(e.minutes)}` };
    });
    res.json({ blocks: list });
  });

  app.post('/api/admin/blocks', (req, res) => {
    const { roomId, date, start, end, allDay, reason } = req.body || {};
    if (!T.parseDate(date)) return res.status(400).json({ error: 'Date invalide.' });
    if (roomId && !avail.room(roomId)) return res.status(400).json({ error: 'Studio inconnu.' });
    let s; let e;
    if (allDay) {
      const w = cfg.openingMinutes[T.weekdayKey(date)];
      s = T.toAbs(date, 0);
      e = T.toAbs(date, Math.max(1440, w ? w.close : 1440));
    } else {
      const sm = T.parseHM(start);
      let em = T.parseHM(end);
      if (sm == null || em == null) return res.status(400).json({ error: 'Heures invalides.' });
      if (em <= sm) em += 1440;
      s = T.toAbs(date, sm);
      e = T.toAbs(date, em);
    }
    const bl = db.addBlock({ room_id: roomId || null, start_abs: s, end_abs: e, reason: String(reason || '').slice(0, 200) });
    const conflicts = db.activeBookings(s, e).filter((b) => !roomId || b.room_id === roomId).map((b) => b.ref);
    res.status(201).json({ block: bl, conflicts });
  });

  app.delete('/api/admin/blocks/:id', (req, res) => {
    res.json({ ok: db.deleteBlock(Number(req.params.id)) });
  });

  app.use('/api', (req, res) => res.status(404).json({ error: 'Route inconnue.' }));

  // --- Pages ------------------------------------------------------------------
  function sendPage(res, key, status = 200) {
    res.status(status).set({ 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' }).send(pages.get(key));
  }

  app.get(/.*/, (req, res, next) => {
    let p = req.path.replace(/\/+$/, '') || '/';
    if (p.endsWith('.html')) return res.redirect(301, p.replace(/(index)?\.html$/, '') || '/');
    const key = p === '/' ? '/index.html' : `${p}.html`;
    if (pages.has(key)) {
      if (key === '/admin.html') res.set('X-Robots-Tag', 'noindex');
      return sendPage(res, key);
    }
    next();
  });

  app.use(express.static(publicDir, {
    index: false,
    setHeaders(res, file) {
      if (/\.(woff2|svg|png|jpe?g|webp|avif)$/.test(file)) res.set('Cache-Control', 'public, max-age=604800');
      else res.set('Cache-Control', 'public, max-age=300');
    },
  }));

  app.use((req, res) => sendPage(res, '/404.html', 404));

  // --- Erreurs ----------------------------------------------------------------
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message, taken: err.taken || undefined });
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Requête invalide.' });
    console.error(err);
    res.status(500).json({ error: 'Erreur interne. Réessaie dans un instant.' });
  });

  // Les réservations non payées libèrent leur créneau automatiquement.
  const sweeper = setInterval(() => db.expireHolds(), 60 * 1000);
  sweeper.unref();

  return { app, db, cfg, env, svc, payments, close: () => { clearInterval(sweeper); db.close(); } };
}

if (require.main === module) {
  const { app, env, payments } = createApp();
  app.listen(env.port, () => {
    console.log(`\n  Phoenix Empire en ligne sur ${env.baseUrl}`);
    console.log(`  Paiement : ${payments.enabled ? 'Stripe' : 'MODE DÉMO (aucun paiement réel, définis STRIPE_SECRET_KEY)'}`);
    console.log(`  E-mails  : ${env.smtp.host ? `SMTP ${env.smtp.host}` : 'non envoyés, copiés dans data/outbox/'}`);
    console.log(`  Admin    : ${env.adminPassword ? `${env.baseUrl}/admin` : 'désactivé (définis ADMIN_PASSWORD)'}\n`);
  });
}

module.exports = { createApp };
