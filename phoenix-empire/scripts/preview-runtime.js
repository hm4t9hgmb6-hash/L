/* Phoenix Empire — aperçu sans serveur.
   Simule l'API du site dans le navigateur, avec le même code de calcul que le
   serveur (créneaux, prix, réservations). Les données restent dans ce navigateur. */
(() => {
  'use strict';
  const CONFIG = /*__CONFIG__*/null;
  const MODULES = /*__MODULES__*/{};

  // --- Mini chargeur de modules (format CommonJS du serveur) ------------------
  const cache = {};
  function require(name) {
    const key = String(name).replace(/^\.\.?\//, '').replace(/\.js$/, '');
    if (cache[key]) return cache[key].exports;
    if (!MODULES[key]) throw new Error(`module introuvable : ${name}`);
    const module = { exports: {} };
    cache[key] = module;
    MODULES[key](module, module.exports, require);
    return module.exports;
  }

  const T = require('time');
  const { createAvailability } = require('availability');
  const { createBookingService, HttpError } = require('bookings');

  document.documentElement.lang = 'fr';

  // --- Stockage local ------------------------------------------------------------
  const STORE = 'pe-preview-db-v1';
  const read = (k, store = 'localStorage') => { try { return window[store].getItem(k); } catch { return null; } };
  const write = (k, v, store = 'localStorage') => { try { window[store].setItem(k, v); } catch { /* stockage bloqué */ } };

  // Retour sur la page de confirmation si l'adresse a perdu ses paramètres.
  if (/(reservation|paiement-demo)\.html$/.test(location.pathname) && !location.search) {
    const last = read('pe-last');
    if (last) history.replaceState(null, '', `${location.pathname}?${last}`);
  }

  let state = null;
  try { state = JSON.parse(read(STORE) || 'null'); } catch { state = null; }
  if (!state || !Array.isArray(state.bookings)) state = { seq: 0, bseq: 0, bookings: [], blocks: [], seeded: false };
  const persist = () => write(STORE, JSON.stringify(state));
  const clone = (o) => (o ? JSON.parse(JSON.stringify(o)) : null);

  const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const rand = (n) => { const a = new Uint32Array(n); crypto.getRandomValues(a); return [...a]; };
  const newRef = () => `PE-${rand(6).map((x) => ALPHA[x % ALPHA.length]).join('')}`;
  const newToken = () => rand(24).map((x) => (x % 36).toString(36)).join('');

  const db = {
    transaction(fn) {
      const snapshot = JSON.stringify(state);
      try { const out = fn(); persist(); return out; } catch (e) { state = JSON.parse(snapshot); throw e; }
    },
    createBooking(b) {
      const now = Date.now();
      let ref = newRef();
      while (state.bookings.some((x) => x.ref === ref)) ref = newRef();
      const row = {
        id: ++state.seq, ref, token: newToken(),
        room_id: b.room_id, date: b.date, start_min: b.start_min, duration_min: b.duration_min,
        start_abs: b.start_abs, end_abs: b.end_abs, with_engineer: !!b.with_engineer, extras: b.extras || [],
        customer_name: b.customer_name || '', customer_email: b.customer_email || '', customer_phone: b.customer_phone || '',
        artist_name: b.artist_name || '', notes: b.notes || '',
        total_cents: b.total_cents || 0, due_cents: b.due_cents || 0, paid_cents: b.paid_cents || 0, refunded_cents: 0,
        payment_choice: b.payment_choice || 'deposit', status: b.status || 'pending', hold_expires_at: b.hold_expires_at ?? null,
        stripe_session_id: null, stripe_payment_intent: null, source: b.source || 'web', cancel_reason: null,
        created_at: now, updated_at: now, confirmed_at: b.status === 'confirmed' ? now : null, cancelled_at: null,
      };
      state.bookings.push(row);
      persist();
      return clone(row);
    },
    getById: (id) => clone(state.bookings.find((x) => x.id === id)),
    getByRef: (ref) => clone(state.bookings.find((x) => x.ref === String(ref || '').toUpperCase())),
    getBySession: () => null,
    update(id, fields) {
      const row = state.bookings.find((x) => x.id === id);
      if (!row) return null;
      Object.assign(row, fields, { updated_at: Date.now() });
      persist();
      return clone(row);
    },
    activeBookings(from, to, now = Date.now()) {
      return state.bookings.filter((b) => b.end_abs > from && b.start_abs < to
        && (b.status === 'confirmed' || (b.status === 'pending' && b.hold_expires_at > now))).map(clone);
    },
    blocks: (from, to) => state.blocks.filter((b) => b.end_abs > from && b.start_abs < to).sort((a, b) => a.start_abs - b.start_abs).map(clone),
    addBlock({ room_id, start_abs, end_abs, reason }) {
      const row = { id: ++state.bseq, room_id: room_id || null, start_abs, end_abs, reason: reason || '', created_at: Date.now() };
      state.blocks.push(row);
      persist();
      return clone(row);
    },
    deleteBlock(id) {
      const n = state.blocks.length;
      state.blocks = state.blocks.filter((b) => b.id !== id);
      persist();
      return state.blocks.length < n;
    },
    listBookings({ fromAbs, toAbs, status, q } = {}) {
      const statuses = status && status !== 'all' ? String(status).split(',') : null;
      const needle = String(q || '').toLowerCase();
      return state.bookings.filter((b) => (fromAbs == null || b.end_abs > fromAbs) && (toAbs == null || b.start_abs < toAbs)
        && (!statuses || statuses.includes(b.status))
        && (!needle || [b.ref, b.customer_name, b.customer_email, b.artist_name, b.customer_phone].some((v) => String(v).toLowerCase().includes(needle))))
        .sort((a, b) => a.start_abs - b.start_abs).map(clone);
    },
    stats(now, from, to) {
      const list = state.bookings.filter((b) => b.status === 'confirmed' && b.start_abs >= from && b.start_abs < to);
      return {
        count: list.length,
        total_cents: list.reduce((s, b) => s + b.total_cents, 0),
        cashed_cents: list.reduce((s, b) => s + b.paid_cents - b.refunded_cents, 0),
        minutes: list.reduce((s, b) => s + b.duration_min, 0),
      };
    },
  };

  // --- Services -------------------------------------------------------------------
  const env = { baseUrl: '', preview: true };
  const avail = createAvailability(CONFIG, db);
  const payments = {
    enabled: false, demo: true, holdMs: 15 * 60 * 1000,
    createCheckout: async (b) => ({ url: `paiement-demo.html?ref=${encodeURIComponent(b.ref)}&t=${encodeURIComponent(b.token)}`, sessionId: null }),
    retrieveSession: async () => null,
    expireSession: async () => {},
    refund: async (pi, amount) => amount,
  };
  const noop = async () => {};
  const mailer = {
    bookingConfirmed: noop, bookingCancelled: noop, paymentConflict: noop,
    manageUrl: (b) => `reservation.html?ref=${encodeURIComponent(b.ref)}&t=${encodeURIComponent(b.token)}`,
  };
  const svc = createBookingService({ cfg: CONFIG, env, db, avail, payments, mailer });

  // Quelques réservations d'exemple pour que le planning ne soit pas vide.
  if (!state.seeded) {
    const today = T.nowLocal(CONFIG.timezone).date;
    const seeds = [
      [1, 'ignis', '14:00', 4, false, 'Exemple · session album', true],
      [2, 'braise', '18:00', 2, true, 'Exemple · topline', false],
      [3, 'plume', '11:00', 2, false, 'Exemple · podcast', true],
      [5, 'ignis', '10:00', 8, false, 'Exemple · journée mix', false],
    ];
    for (const [d, roomId, start, duration, engineer, artist, paid] of seeds) {
      try {
        svc.createManual({ roomId, date: T.addDays(today, d), start, duration, engineer, paid, notify: false, customer: { name: 'Client exemple', artist } });
      } catch { /* jour fermé : on passe */ }
    }
    state.seeded = true;
    persist();
  }

  const publicConfig = {
    studio: CONFIG.studio,
    timezone: CONFIG.timezone,
    currency: CONFIG.currency,
    booking: {
      slotStepMinutes: CONFIG.booking.slotStepMinutes,
      maxAdvanceDays: CONFIG.booking.maxAdvanceDays,
      minNoticeHours: CONFIG.booking.minNoticeHours,
      freeCancellationHours: CONFIG.booking.freeCancellationHours,
    },
    payment: { ...CONFIG.payment, provider: 'demo' },
    engineer: { hourly: CONFIG.engineer.hourly, label: CONFIG.engineer.label },
    hours: CONFIG.openingMinutes,
    dayLabels: CONFIG.dayLabels,
    closures: CONFIG.closures,
    rooms: CONFIG.rooms.map((r) => ({
      id: r.id, name: r.name, kind: r.kind, short: r.short, size: r.size, capacity: r.capacity,
      engineer: r.engineer, accent: r.accent, features: r.features, prices: r.prices, durations: r.durations, fromHourly: r.fromHourly,
    })),
    extras: CONFIG.extras.map((e) => ({ id: e.id, name: e.name, description: e.description, price: e.price, unit: e.unit, max: e.max })),
  };

  const view = (b) => { const v = svc.publicView(b); if (v.calendar) v.calendar.ics = null; return v; };
  const isAdmin = () => read('pe-admin', 'sessionStorage') === '1';
  const need = (ok) => { if (!ok) throw new HttpError(401, 'Connexion requise.'); };
  const findWithToken = (ref, token) => {
    const b = db.getByRef(ref);
    if (!b || b.token !== String(token || '')) throw new HttpError(404, 'Réservation introuvable.');
    return b;
  };

  async function route(method, path, q, body) {
    let m;
    if (method === 'GET' && path === '/config') return publicConfig;
    if (method === 'GET' && path === '/availability') {
      const out = avail.monthSummary({ roomId: q.get('room'), month: q.get('month'), durationH: Number(q.get('duration')) || 1, engineer: q.get('engineer') === '1' });
      if (!out) throw new HttpError(400, 'Paramètres invalides.');
      return out;
    }
    if (method === 'GET' && path === '/slots') {
      const r = avail.room(q.get('room'));
      const date = q.get('date');
      if (!r || !T.parseDate(date)) throw new HttpError(400, 'Paramètres invalides.');
      const durationH = Number(q.get('duration')) || r.durations[0];
      const slots = avail.slotsFor({ roomId: r.id, date, durationH, engineer: q.get('engineer') === '1' })
        .map(({ start, end, startMin, available }) => ({ start, end, startMin, available }));
      return { date, dateLabel: T.fmtDateLong(date), slots };
    }
    if (method === 'GET' && path === '/next-slots') {
      const now = T.nowLocal(CONFIG.timezone);
      const rooms = CONFIG.rooms.map((r) => {
        const durationH = r.durations.find((d) => d >= 2) || r.durations[0];
        let slot = null;
        for (let i = 0; i < 14 && !slot; i++) {
          const date = T.addDays(now.date, i);
          const s = avail.slotsFor({ roomId: r.id, date, durationH, engineer: false }).find((x) => x.available);
          if (s) slot = { date, start: s.start, offset: i };
        }
        return { roomId: r.id, name: r.name, accent: r.accent, durationH, fromHourly: r.fromHourly, slot };
      });
      return { today: now.date, rooms };
    }
    if (method === 'POST' && path === '/bookings') {
      const out = await svc.createFromWeb(body || {});
      write('pe-last', `ref=${encodeURIComponent(out.ref)}&t=${encodeURIComponent(out.token)}`);
      return out;
    }
    if ((m = /^\/bookings\/([^/]+)$/.exec(path)) && method === 'GET') return view(findWithToken(m[1], q.get('t')));
    if ((m = /^\/bookings\/([^/]+)\/cancel$/.exec(path)) && method === 'POST') {
      const { booking, refundedCents } = await svc.cancel(findWithToken(m[1], body && body.t), { by: 'customer' });
      return { ...view(booking), justRefundedCents: refundedCents };
    }
    if ((m = /^\/demo\/pay\/([^/]+)$/.exec(path)) && method === 'POST') {
      const b = findWithToken(m[1], body && body.t);
      if (b.status !== 'pending' || b.hold_expires_at <= Date.now()) throw new HttpError(409, 'Cette demande de paiement a expiré. Recommence ta réservation.');
      return view(await svc.confirmPaid(b.id, { amountCents: b.due_cents }));
    }

    // Espace studio (mot de passe de l'aperçu : demo)
    if (path === '/admin/session') return { authenticated: isAdmin(), configured: true };
    if (path === '/admin/login' && method === 'POST') {
      if (String(body && body.password) !== 'demo') throw new HttpError(401, 'Mot de passe incorrect. Dans l\'aperçu, le mot de passe est « demo ».');
      write('pe-admin', '1', 'sessionStorage');
      return { ok: true };
    }
    if (path === '/admin/logout') { write('pe-admin', '0', 'sessionStorage'); return { ok: true }; }
    if (path.startsWith('/admin/')) need(isAdmin());
    if (path === '/admin/overview') {
      const now = T.nowLocal(CONFIG.timezone);
      const monthStart = T.toAbs(`${now.date.slice(0, 7)}-01`, 0);
      const [y, mo] = now.date.split('-').map(Number);
      const monthEnd = T.toAbs(T.dateOfDay(Date.UTC(y, mo, 1) / 86400000), 0);
      const week = db.listBookings({ fromAbs: now.abs, toAbs: now.abs + 7 * 1440, status: 'confirmed' });
      const pending = db.listBookings({ fromAbs: now.abs, status: 'pending' }).filter((b) => b.hold_expires_at > Date.now());
      return {
        today: now.date, nowMin: now.minutes, upcomingWeek: week.length, pendingCount: pending.length,
        month: { label: new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(monthStart * 60000)), ...db.stats(Date.now(), monthStart, monthEnd) },
        provider: 'demo', mail: 'outbox',
        rooms: CONFIG.rooms.map((r) => ({ id: r.id, name: r.name, accent: r.accent, durations: r.durations, engineer: r.engineer, prices: r.prices })),
        extras: publicConfig.extras, hours: publicConfig.hours,
      };
    }
    if (path === '/admin/bookings' && method === 'GET') {
      const from = q.get('from') && T.parseDate(q.get('from')) ? T.toAbs(q.get('from'), 0) : null;
      const to = q.get('to') && T.parseDate(q.get('to')) ? T.toAbs(q.get('to'), 0) + 1440 : null;
      return { bookings: db.listBookings({ fromAbs: from, toAbs: to, status: q.get('status') || 'all', q: q.get('q') }).map(svc.adminView) };
    }
    if (path === '/admin/bookings' && method === 'POST') return svc.adminView(svc.createManual(body || {}));
    if ((m = /^\/admin\/bookings\/(\d+)\/cancel$/.exec(path))) {
      const b = db.getById(Number(m[1]));
      if (!b) throw new HttpError(404, 'Réservation introuvable.');
      const { booking, refundedCents } = await svc.cancel(b, { by: 'studio', refund: !!(body && body.refund), reason: body && body.reason });
      return { ...svc.adminView(booking), justRefundedCents: refundedCents };
    }
    if ((m = /^\/admin\/bookings\/(\d+)\/mark-paid$/.exec(path))) {
      const b = db.getById(Number(m[1]));
      if (!b || b.status !== 'confirmed') throw new HttpError(409, 'Seule une réservation confirmée peut être soldée.');
      return svc.adminView(db.update(b.id, { paid_cents: Math.max(b.paid_cents, b.total_cents) }));
    }
    if (path === '/admin/blocks' && method === 'GET') {
      const now = T.nowLocal(CONFIG.timezone);
      return {
        blocks: db.blocks(now.abs - 1440, now.abs + 400 * 1440).map((bl) => {
          const s = T.fromAbs(bl.start_abs);
          const e = T.fromAbs(bl.end_abs);
          return { ...bl, roomName: bl.room_id ? (avail.room(bl.room_id) || {}).name : 'Tous les studios', startLabel: `${T.fmtDateShort(s.date)} ${T.fmtMin(s.minutes)}`, endLabel: `${T.fmtDateShort(e.date)} ${T.fmtMin(e.minutes)}` };
        }),
      };
    }
    if (path === '/admin/blocks' && method === 'POST') {
      const { roomId, date, start, end, allDay, reason } = body || {};
      if (!T.parseDate(date)) throw new HttpError(400, 'Date invalide.');
      let s; let e;
      if (allDay) {
        const w = CONFIG.openingMinutes[T.weekdayKey(date)];
        s = T.toAbs(date, 0);
        e = T.toAbs(date, Math.max(1440, w ? w.close : 1440));
      } else {
        const sm = T.parseHM(start);
        let em = T.parseHM(end);
        if (sm == null || em == null) throw new HttpError(400, 'Heures invalides.');
        if (em <= sm) em += 1440;
        s = T.toAbs(date, sm);
        e = T.toAbs(date, em);
      }
      const block = db.addBlock({ room_id: roomId || null, start_abs: s, end_abs: e, reason: String(reason || '').slice(0, 200) });
      const conflicts = db.activeBookings(s, e).filter((b) => !roomId || b.room_id === roomId).map((b) => b.ref);
      return { block, conflicts };
    }
    if ((m = /^\/admin\/blocks\/(\d+)$/.exec(path)) && method === 'DELETE') return { ok: db.deleteBlock(Number(m[1])) };
    throw new HttpError(404, 'Route inconnue.');
  }

  // --- Interception des appels /api ------------------------------------------------
  const realFetch = window.fetch.bind(window);
  const reply = (status, data) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
  window.fetch = async (input, init = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url, location.href);
    const match = /\/api(\/.*)$/.exec(url.pathname);
    if (!match) return realFetch(input, init);
    let body = null;
    if (init.body) { try { body = JSON.parse(init.body); } catch { return reply(400, { error: 'Requête invalide.' }); } }
    try {
      const out = await route(String(init.method || 'GET').toUpperCase(), match[1], url.searchParams, body);
      return reply(200, out);
    } catch (e) {
      if (e instanceof HttpError) return reply(e.status, { error: e.message, taken: e.taken || undefined });
      console.error(e);
      return reply(500, { error: 'Erreur interne. Réessaie dans un instant.' });
    }
  };
})();
