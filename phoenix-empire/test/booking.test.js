'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { loadConfig } = require('../src/config');
const { openDb } = require('../src/db');
const { createAvailability, maxConcurrency } = require('../src/availability');
const { quote } = require('../src/pricing');
const T = require('../src/time');
const { createApp } = require('../server');

const cfg = loadConfig();

// Prochaine date ouverte du lundi au jeudi, au moins `offset` jours après aujourd'hui.
function weekdayDate(offset) {
  let d = T.addDays(T.nowLocal('Europe/Paris').date, offset);
  while (cfg.closures.includes(d) || !['mon', 'tue', 'wed', 'thu'].includes(T.weekdayKey(d))) d = T.addDays(d, 1);
  return d;
}

// ---------------------------------------------------------------------------
// Outils de date
// ---------------------------------------------------------------------------
test('conversion heure de Paris → UTC (hiver et été)', () => {
  assert.equal(new Date(T.absToUtcMs(T.toAbs('2026-01-15', 14 * 60), 'Europe/Paris')).toISOString(), '2026-01-15T13:00:00.000Z');
  assert.equal(new Date(T.absToUtcMs(T.toAbs('2026-07-15', 14 * 60), 'Europe/Paris')).toISOString(), '2026-07-15T12:00:00.000Z');
  // Une session qui finit à 2 h du matin tombe bien le lendemain.
  assert.equal(new Date(T.absToUtcMs(T.toAbs('2026-07-17', 26 * 60), 'Europe/Paris')).toISOString(), '2026-07-18T00:00:00.000Z');
});

test('heure locale du studio', () => {
  const now = T.nowLocal('Europe/Paris', Date.parse('2026-11-16T22:30:00Z'));
  assert.equal(now.date, '2026-11-16');
  assert.equal(now.minutes, 23 * 60 + 30);
});

// ---------------------------------------------------------------------------
// Disponibilités
// ---------------------------------------------------------------------------
function freshAvail() {
  const db = openDb(':memory:');
  return { db, avail: createAvailability(cfg, db) };
}
// Lundi 16 novembre 2026, 9 h à Paris.
const NOW = Date.parse('2026-11-16T08:00:00Z');

test('les créneaux respectent les horaires, y compris après minuit', () => {
  const { avail } = freshAvail();
  // Vendredi 20 novembre : 10:00 → 02:00.
  const slots = avail.slotsFor({ roomId: 'braise', date: '2026-11-20', durationH: 2, nowMs: NOW });
  assert.equal(slots[0].start, '10:00');
  assert.equal(slots.at(-1).start, '00:00');
  assert.equal(slots.at(-1).end, '02:00');
  assert.ok(slots.every((s) => s.available));
});

test('pas de réservation trop tôt ni trop loin, ni un jour de fermeture', () => {
  const { avail } = freshAvail();
  const today = avail.slotsFor({ roomId: 'braise', date: '2026-11-16', durationH: 1, nowMs: NOW });
  // Il est 9 h, délai minimum 3 h → premier départ possible à 12 h.
  assert.equal(today.find((s) => s.available).start, '12:00');
  assert.deepEqual(avail.slotsFor({ roomId: 'braise', date: '2026-12-25', durationH: 1, nowMs: NOW }), []);
  assert.deepEqual(avail.slotsFor({ roomId: 'braise', date: '2027-06-01', durationH: 1, nowMs: NOW }), []);
});

test('un créneau réservé ne peut plus être pris, les autres studios restent libres', () => {
  const { db, avail } = freshAvail();
  const date = '2026-11-20';
  db.createBooking({ room_id: 'braise', date, start_min: 14 * 60, duration_min: 240, start_abs: T.toAbs(date, 840), end_abs: T.toAbs(date, 1080), status: 'confirmed' });
  const check = (start, room = 'braise') => avail.check({ roomId: room, date, startMin: start * 60, durationH: 2, nowMs: NOW }).ok;
  assert.equal(check(13), false); // chevauche 14:00
  assert.equal(check(16), false);
  assert.equal(check(12), true); // finit pile à 14:00
  assert.equal(check(18), true); // commence pile à 18:00
  assert.equal(check(15, 'plume'), true);
});

test('une réservation en attente de paiement bloque le créneau jusqu\'à son expiration', () => {
  const { db, avail } = freshAvail();
  const date = '2026-11-20';
  db.createBooking({ room_id: 'plume', date, start_min: 600, duration_min: 120, start_abs: T.toAbs(date, 600), end_abs: T.toAbs(date, 720), status: 'pending', hold_expires_at: NOW + 60000 });
  assert.equal(avail.check({ roomId: 'plume', date, startMin: 600, durationH: 2, nowMs: NOW }).ok, false);
  assert.equal(avail.check({ roomId: 'plume', date, startMin: 600, durationH: 2, nowMs: NOW + 120000 }).ok, true);
});

test('le nombre d\'ingés son disponibles est respecté', () => {
  const { db, avail } = freshAvail();
  const date = '2026-11-20';
  const add = (room, start) => db.createBooking({ room_id: room, date, start_min: start, duration_min: 120, start_abs: T.toAbs(date, start), end_abs: T.toAbs(date, start + 120), with_engineer: true, status: 'confirmed' });
  add('ignis', 600); // ingé n°1, 10:00–12:00
  add('plume', 600); // ingé n°2, 10:00–12:00 (config : 2 ingés)
  const withEng = avail.check({ roomId: 'braise', date, startMin: 600, durationH: 2, engineer: true, nowMs: NOW });
  const without = avail.check({ roomId: 'braise', date, startMin: 600, durationH: 2, engineer: false, nowMs: NOW });
  assert.equal(withEng.ok, false);
  assert.equal(without.ok, true);
  assert.equal(avail.check({ roomId: 'braise', date, startMin: 720, durationH: 2, engineer: true, nowMs: NOW }).ok, true);
});

test('simultanéité maximale', () => {
  const iv = [{ start_abs: 0, end_abs: 10 }, { start_abs: 20, end_abs: 30 }, { start_abs: 5, end_abs: 25 }];
  assert.equal(maxConcurrency(iv, 0, 30), 2);
  assert.equal(maxConcurrency(iv, 10, 20), 1);
});

test('une fermeture bloque les créneaux concernés', () => {
  const { db, avail } = freshAvail();
  const date = '2026-11-21';
  db.addBlock({ room_id: null, start_abs: T.toAbs(date, 0), end_abs: T.toAbs(date, 1560), reason: 'Congés' });
  assert.ok(avail.slotsFor({ roomId: 'ignis', date, durationH: 2, nowMs: NOW }).every((s) => !s.available));
});

// ---------------------------------------------------------------------------
// Prix
// ---------------------------------------------------------------------------
test('calcul du prix, de l\'acompte et des options', () => {
  const room = cfg.rooms.find((r) => r.id === 'braise');
  const q = quote(cfg, { room, durationH: 2, withEngineer: true, extras: [{ id: 'mix', qty: 1 }, { id: 'master', qty: 2 }, { id: 'inconnu', qty: 3 }] });
  assert.equal(q.totalCents, 6400 + 4000 + 9000 + 8000);
  assert.equal(q.depositCents, Math.round(q.totalCents * 0.3));
  assert.equal(q.dueCents, q.depositCents);
  assert.equal(quote(cfg, { room, durationH: 2, paymentChoice: 'full' }).dueCents, 6400);
  // L'ingé son « inclus » n'est jamais facturé en plus.
  const ignis = cfg.rooms.find((r) => r.id === 'ignis');
  assert.equal(quote(cfg, { room: ignis, durationH: 4, withEngineer: true }).totalCents, 19600);
});

// ---------------------------------------------------------------------------
// Parcours complet via l'API (mode démo)
// ---------------------------------------------------------------------------
test('parcours complet : réservation, paiement, double réservation, annulation, admin', async (t) => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pe-test-'));
  const { app, close } = createApp({ env: { dataDir, adminPassword: 'secret', stripeSecretKey: '', smtp: { host: '' }, baseUrl: 'http://test' }, db: openDb(':memory:'), rateLimitMax: 1000 });
  const server = app.listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  t.after(() => { server.close(); close(); fs.rmSync(dataDir, { recursive: true, force: true }); });

  const call = async (method, url, body, headers = {}) => {
    const res = await fetch(base + url, { method, headers: { 'Content-Type': 'application/json', ...headers }, body: body ? JSON.stringify(body) : undefined });
    return { status: res.status, body: await res.json().catch(() => null), headers: res.headers };
  };

  const date = weekdayDate(10);
  const payload = {
    roomId: 'braise', date, start: '14:00', duration: 2, engineer: true, extras: [{ id: 'mix', qty: 1 }],
    customer: { name: 'Nina Test', email: 'nina@example.com', phone: '06 11 22 33 44', artist: 'NINA' },
    payment: 'deposit', acceptTerms: true,
    // Un client malin qui tente d'imposer son prix est ignoré.
    totalCents: 1,
  };

  const slotsBefore = await call('GET', `/api/slots?room=braise&date=${date}&duration=2&engineer=1`);
  assert.equal(slotsBefore.body.slots.find((s) => s.start === '14:00').available, true);

  const missingTerms = await call('POST', '/api/bookings', { ...payload, acceptTerms: false });
  assert.equal(missingTerms.status, 400);

  const created = await call('POST', '/api/bookings', payload);
  assert.equal(created.status, 201);
  assert.match(created.body.ref, /^PE-[A-Z2-9]{6}$/);
  assert.match(created.body.redirectUrl, /^\/paiement-demo\?/);

  // Le créneau est bloqué pendant le paiement : impossible de le prendre deux fois.
  const twice = await call('POST', '/api/bookings', { ...payload, customer: { ...payload.customer, email: 'autre@example.com' } });
  assert.equal(twice.status, 409);
  const slotsDuring = await call('GET', `/api/slots?room=braise&date=${date}&duration=2&engineer=1`);
  assert.equal(slotsDuring.body.slots.find((s) => s.start === '14:00').available, false);

  const { ref, token } = created.body;
  const wrongToken = await call('GET', `/api/bookings/${ref}?t=nope`);
  assert.equal(wrongToken.status, 404);

  const pending = await call('GET', `/api/bookings/${ref}?t=${token}`);
  assert.equal(pending.body.status, 'pending');
  assert.equal(pending.body.totalCents, 6400 + 4000 + 9000);
  assert.equal(pending.body.dueCents, Math.round(19400 * 0.3));

  const paid = await call('POST', `/api/demo/pay/${ref}`, { t: token });
  assert.equal(paid.status, 200);
  assert.equal(paid.body.status, 'confirmed');
  assert.equal(paid.body.paidCents, 5820);
  assert.equal(paid.body.restCents, 19400 - 5820);
  assert.equal(paid.body.canCancel, true);

  const ics = await fetch(`${base}/api/bookings/${ref}/ics?t=${token}`);
  assert.equal(ics.status, 200);
  assert.match(await ics.text(), /BEGIN:VEVENT[\s\S]*DTSTART:\d{8}T\d{6}Z/);

  // Les e-mails sont écrits dans data/outbox quand SMTP n'est pas configuré.
  await new Promise((r) => setTimeout(r, 50));
  const outbox = fs.readdirSync(path.join(dataDir, 'outbox'));
  assert.equal(outbox.length, 2, 'un e-mail au client, un au studio');

  // Admin : accès protégé.
  assert.equal((await call('GET', '/api/admin/bookings')).status, 401);
  assert.equal((await call('POST', '/api/admin/login', { password: 'faux' })).status, 401);
  const login = await call('POST', '/api/admin/login', { password: 'secret' });
  assert.equal(login.status, 200);
  const cookie = login.headers.get('set-cookie').split(';')[0];
  const list = await call('GET', '/api/admin/bookings?status=confirmed', null, { Cookie: cookie });
  assert.equal(list.body.bookings.length, 1);
  assert.equal(list.body.bookings[0].ref, ref);

  // Fermeture posée par le studio : le créneau du soir disparaît.
  const block = await call('POST', '/api/admin/blocks', { roomId: 'braise', date, allDay: false, start: '20:00', end: '22:00', reason: 'Maintenance' }, { Cookie: cookie });
  assert.equal(block.status, 201);
  const slotsBlocked = await call('GET', `/api/slots?room=braise&date=${date}&duration=2`);
  assert.equal(slotsBlocked.body.slots.find((s) => s.start === '20:00').available, false);
  assert.equal(slotsBlocked.body.slots.find((s) => s.start === '22:00').available, true);

  // Réservation manuelle sur un créneau déjà pris : refusée.
  const manualConflict = await call('POST', '/api/admin/bookings', { roomId: 'braise', date, start: '15:00', duration: 1, customer: { name: 'Walk-in' } }, { Cookie: cookie });
  assert.equal(manualConflict.status, 409);

  // Annulation par le client (plus de 48 h avant) : remboursement intégral.
  const cancelled = await call('POST', `/api/bookings/${ref}/cancel`, { t: token });
  assert.equal(cancelled.status, 200);
  assert.equal(cancelled.body.status, 'cancelled');
  assert.equal(cancelled.body.justRefundedCents, 5820);
  const slotsAfter = await call('GET', `/api/slots?room=braise&date=${date}&duration=2&engineer=1`);
  assert.equal(slotsAfter.body.slots.find((s) => s.start === '14:00').available, true);
});

test('un paiement arrivé après expiration, sur un créneau repris, est remboursé', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pe-test-'));
  const refunds = [];
  const payments = {
    enabled: true, demo: false, holdMs: 30 * 60000,
    createCheckout: async (b) => ({ url: `https://pay.example/${b.ref}`, sessionId: `cs_${b.ref}` }),
    retrieveSession: async () => null,
    expireSession: async () => {},
    refund: async (pi, amount) => { refunds.push([pi, amount]); return amount; },
    constructEvent: () => { throw new Error('non utilisé'); },
  };
  const { db, svc, close } = createApp({ env: { dataDir, smtp: { host: '' }, baseUrl: 'http://test' }, db: openDb(':memory:'), payments });
  try {
    const date = weekdayDate(12);
    const input = (email) => ({ roomId: 'plume', date, start: '11:00', duration: 2, customer: { name: 'A B', email, phone: '0611223344' }, acceptTerms: true });
    const a = await svc.createFromWeb(input('a@example.com'));
    const bookingA = db.getByRef(a.ref);
    db.update(bookingA.id, { hold_expires_at: Date.now() - 1000 }); // le client A a traîné
    const b = await svc.createFromWeb(input('b@example.com'));
    const bookingB = db.getByRef(b.ref);
    await svc.confirmPaid(bookingB.id, { amountCents: bookingB.due_cents, paymentIntent: 'pi_B' });
    const lateA = await svc.confirmPaid(bookingA.id, { amountCents: bookingA.due_cents, paymentIntent: 'pi_A' });
    assert.equal(lateA.status, 'cancelled');
    assert.equal(lateA.cancel_reason, 'conflit');
    assert.deepEqual(refunds, [['pi_A', bookingA.due_cents]]);
    assert.equal(db.getById(bookingB.id).status, 'confirmed');
    // Webhook rejoué : rien ne se passe deux fois.
    await svc.confirmPaid(bookingB.id, { amountCents: bookingB.due_cents, paymentIntent: 'pi_B' });
    assert.equal(refunds.length, 1);
  } finally {
    close();
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});

test('webhook Stripe signé : le paiement confirme la réservation', async (t) => {
  const { createPayments } = require('../src/payments');
  const stripe = require('stripe')('sk_test_dummy');
  const secret = 'whsec_test_secret';
  const env = { dataDir: fs.mkdtempSync(path.join(os.tmpdir(), 'pe-test-')), stripeSecretKey: 'sk_test_dummy', stripeWebhookSecret: secret, smtp: { host: '' }, baseUrl: 'http://test' };
  const payments = createPayments(cfg, env);
  payments.createCheckout = async (b) => ({ url: 'https://checkout.stripe.com/x', sessionId: `cs_test_${b.ref}` });
  payments.retrieveSession = async () => ({ payment_status: 'unpaid' });
  const { app, svc, db, close } = createApp({ env, db: openDb(':memory:'), payments });
  const server = app.listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  t.after(() => { server.close(); close(); fs.rmSync(env.dataDir, { recursive: true, force: true }); });

  const date = weekdayDate(14);
  const created = await svc.createFromWeb({ roomId: 'ignis', date, start: '10:00', duration: 4, customer: { name: 'Sam P', email: 'sam@example.com', phone: '0611223344' }, payment: 'full', acceptTerms: true });
  const booking = db.getByRef(created.ref);
  const payload = JSON.stringify({
    id: 'evt_test', type: 'checkout.session.completed',
    data: { object: { id: booking.stripe_session_id, payment_status: 'paid', amount_total: booking.due_cents, payment_intent: 'pi_test', metadata: { booking_ref: booking.ref } } },
  });

  const forged = await fetch(`${base}/api/stripe/webhook`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Stripe-Signature': 't=1,v1=faux' }, body: payload });
  assert.equal(forged.status, 400, 'une signature invalide est rejetée');
  assert.equal(db.getById(booking.id).status, 'pending');

  const header = stripe.webhooks.generateTestHeaderString({ payload, secret });
  const ok = await fetch(`${base}/api/stripe/webhook`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Stripe-Signature': header }, body: payload });
  assert.equal(ok.status, 200);
  const after = db.getById(booking.id);
  assert.equal(after.status, 'confirmed');
  assert.equal(after.paid_cents, 19600);
  assert.equal(after.stripe_payment_intent, 'pi_test');
});
