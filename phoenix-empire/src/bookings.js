'use strict';
// Logique métier des réservations : création, confirmation de paiement,
// annulation et remboursement.
const T = require('./time');
const { quote, fmtEur } = require('./pricing');
const { googleCalendarUrl, address } = require('./ics');

class HttpError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    Object.assign(this, extra);
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const clean = (s, max) => String(s ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
const cleanMultiline = (s, max) => String(s ?? '').replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, ' ').trim().slice(0, max);

function createBookingService({ cfg, env, db, avail, payments, mailer }) {
  // --- Lecture de la demande -------------------------------------------------
  function parseSelection(input) {
    const room = avail.room(String(input.roomId || ''));
    if (!room) throw new HttpError(400, 'Choisis un studio.');
    const date = String(input.date || '');
    if (!T.parseDate(date)) throw new HttpError(400, 'Choisis une date.');
    const startMin = T.parseHM(input.start);
    if (startMin == null) throw new HttpError(400, 'Choisis une heure de début.');
    const durationH = Number(input.duration);
    if (!room.durations.includes(durationH)) throw new HttpError(400, 'Durée non proposée pour ce studio.');
    const engineer = room.engineer === 'included' ? true : room.engineer === 'optional' ? !!input.engineer : false;
    const extras = Array.isArray(input.extras) ? input.extras.slice(0, 20).map((e) => ({ id: String(e.id), qty: Number(e.qty) })) : [];
    return { room, date, startMin, durationH, engineer, extras };
  }

  function parseCustomer(c = {}, { required = true } = {}) {
    const out = {
      name: clean(c.name, 120),
      email: clean(c.email, 200).toLowerCase(),
      phone: clean(c.phone, 40),
      artist: clean(c.artist, 120),
    };
    if (required) {
      if (out.name.length < 2) throw new HttpError(400, 'Indique ton nom.');
      if (!EMAIL_RE.test(out.email)) throw new HttpError(400, 'Adresse e-mail invalide.');
      if (out.phone.replace(/\D/g, '').length < 8) throw new HttpError(400, 'Numéro de téléphone invalide.');
    } else if (out.email && !EMAIL_RE.test(out.email)) {
      throw new HttpError(400, 'Adresse e-mail invalide.');
    }
    return out;
  }

  // --- Création (site public) -----------------------------------------------
  async function createFromWeb(input) {
    const sel = parseSelection(input);
    const customer = parseCustomer(input.customer);
    if (input.acceptTerms !== true) throw new HttpError(400, 'Merci d\'accepter les conditions générales de vente.');
    const q = quote(cfg, { room: sel.room, durationH: sel.durationH, withEngineer: sel.engineer, extras: sel.extras, paymentChoice: input.payment });
    if (q.dueCents < 50) throw new HttpError(400, 'Montant trop faible pour un paiement en ligne.');

    const now = Date.now();
    const booking = db.transaction(() => {
      const c = avail.check({ roomId: sel.room.id, date: sel.date, startMin: sel.startMin, durationH: sel.durationH, engineer: sel.engineer, nowMs: now });
      if (!c.ok) throw new HttpError(409, c.error, { taken: !!c.taken });
      return db.createBooking({
        room_id: sel.room.id,
        date: sel.date,
        start_min: sel.startMin,
        duration_min: sel.durationH * 60,
        start_abs: c.startAbs,
        end_abs: c.endAbs,
        with_engineer: c.withEngineer,
        extras: q.extras,
        customer_name: customer.name,
        customer_email: customer.email,
        customer_phone: customer.phone,
        artist_name: customer.artist,
        notes: cleanMultiline(input.notes, 1000),
        total_cents: q.totalCents,
        due_cents: q.dueCents,
        payment_choice: q.paymentChoice,
        status: 'pending',
        hold_expires_at: now + payments.holdMs,
        source: 'web',
      });
    });

    try {
      const pay = await payments.createCheckout(booking, sel.room);
      if (pay.sessionId) db.update(booking.id, { stripe_session_id: pay.sessionId });
      return { ref: booking.ref, token: booking.token, redirectUrl: pay.url, demo: payments.demo };
    } catch (err) {
      console.error(`[paiement] création de session impossible pour ${booking.ref} : ${err.message}`);
      db.update(booking.id, { status: 'cancelled', cancel_reason: 'paiement indisponible', cancelled_at: Date.now() });
      throw new HttpError(502, 'Le paiement en ligne est momentanément indisponible. Réessaie dans quelques instants ou contacte le studio.');
    }
  }

  // --- Confirmation de paiement (webhook Stripe, retour client, mode démo) ----
  async function confirmPaid(bookingId, { amountCents, paymentIntent = null }) {
    let outcome = 'noop';
    const updated = db.transaction(() => {
      const b = db.getById(bookingId);
      if (!b) return null;
      if (b.status === 'confirmed' || b.paid_cents > 0) return b; // déjà traité (idempotent)
      const c = avail.check({
        roomId: b.room_id, date: b.date, startMin: b.start_min, durationH: b.duration_min / 60,
        engineer: b.with_engineer, excludeId: b.id, ignoreNotice: true,
      });
      const now = Date.now();
      if (!c.ok) {
        outcome = 'conflict';
        return db.update(b.id, { status: 'cancelled', cancel_reason: 'conflit', paid_cents: amountCents, stripe_payment_intent: paymentIntent, cancelled_at: now });
      }
      outcome = 'confirmed';
      return db.update(b.id, { status: 'confirmed', paid_cents: amountCents, stripe_payment_intent: paymentIntent, confirmed_at: now, hold_expires_at: null });
    });
    if (outcome === 'confirmed') {
      mailer.bookingConfirmed(updated).catch((e) => console.error(e));
    } else if (outcome === 'conflict') {
      try {
        const refunded = await payments.refund(paymentIntent, amountCents, updated.ref);
        const after = db.update(updated.id, { refunded_cents: refunded });
        mailer.paymentConflict(after, refunded).catch((e) => console.error(e));
      } catch (err) {
        console.error(`[paiement] REMBOURSEMENT À FAIRE À LA MAIN pour ${updated.ref} : ${err.message}`);
      }
    }
    return db.getById(bookingId);
  }

  // Si le webhook n'est pas encore arrivé, on interroge Stripe directement.
  async function syncWithStripe(b) {
    if (!b || !payments.enabled || !b.stripe_session_id) return b;
    if (!['pending', 'expired'].includes(b.status) && !(b.status === 'cancelled' && b.cancel_reason === 'abandon')) return b;
    try {
      const s = await payments.retrieveSession(b.stripe_session_id);
      if (s && s.payment_status === 'paid') {
        return confirmPaid(b.id, { amountCents: s.amount_total, paymentIntent: typeof s.payment_intent === 'string' ? s.payment_intent : s.payment_intent?.id });
      }
    } catch (err) {
      console.error(`[paiement] vérification de ${b.ref} impossible : ${err.message}`);
    }
    return db.getById(b.id);
  }

  async function handleStripeEvent(event) {
    const s = event.data && event.data.object;
    if (!s) return;
    const b = db.getBySession(s.id) || (s.metadata && s.metadata.booking_ref ? db.getByRef(s.metadata.booking_ref) : null);
    if (!b) return;
    if ((event.type === 'checkout.session.completed' && s.payment_status === 'paid') || event.type === 'checkout.session.async_payment_succeeded') {
      await confirmPaid(b.id, { amountCents: s.amount_total, paymentIntent: typeof s.payment_intent === 'string' ? s.payment_intent : null });
    } else if (event.type === 'checkout.session.expired' && b.status === 'pending') {
      db.update(b.id, { status: 'expired' });
    }
  }

  // --- Annulation -----------------------------------------------------------
  function cancelDeadlineAbs(b) {
    return b.start_abs - cfg.booking.freeCancellationHours * 60;
  }

  function canCustomerCancel(b, nowMs = Date.now()) {
    if (b.status === 'pending') return true;
    if (b.status !== 'confirmed') return false;
    return T.nowLocal(cfg.timezone, nowMs).abs < cancelDeadlineAbs(b);
  }

  async function cancel(b, { by = 'customer', refund = true, reason = '' } = {}) {
    if (b.status === 'pending') {
      const out = db.update(b.id, { status: 'cancelled', cancel_reason: by === 'customer' ? 'abandon' : clean(reason, 200) || 'annulée par le studio', cancelled_at: Date.now(), hold_expires_at: null });
      await payments.expireSession(b.stripe_session_id);
      return { booking: out, refundedCents: 0 };
    }
    if (b.status !== 'confirmed') throw new HttpError(409, 'Cette réservation n\'est plus active.');
    if (by === 'customer' && !canCustomerCancel(b)) {
      throw new HttpError(409, `L'annulation en ligne n'est possible que jusqu'à ${cfg.booking.freeCancellationHours} h avant la session. Contacte le studio.`);
    }
    const refundable = Math.max(0, b.paid_cents - b.refunded_cents);
    let refunded = 0;
    if (refund && refundable > 0) {
      try {
        refunded = await payments.refund(b.stripe_payment_intent, refundable, b.ref);
      } catch (err) {
        console.error(`[paiement] remboursement de ${b.ref} impossible : ${err.message}`);
        throw new HttpError(502, 'Le remboursement a échoué. Aucune annulation n\'a été faite, réessaie ou contacte le studio.');
      }
    }
    const out = db.update(b.id, {
      status: 'cancelled',
      cancel_reason: by === 'customer' ? 'annulée par le client' : clean(reason, 200) || 'annulée par le studio',
      cancelled_at: Date.now(),
      refunded_cents: b.refunded_cents + refunded,
    });
    if (out.customer_email) {
      mailer.bookingCancelled(out, { refundCents: refunded, byStudio: by !== 'customer', reason }).catch((e) => console.error(e));
    }
    return { booking: out, refundedCents: refunded };
  }

  // --- Création manuelle (espace studio) --------------------------------------
  function createManual(input) {
    const sel = parseSelection(input);
    const customer = parseCustomer(input.customer, { required: false });
    if (!customer.name) customer.name = 'Réservation sur place';
    const q = quote(cfg, { room: sel.room, durationH: sel.durationH, withEngineer: sel.engineer, extras: sel.extras, paymentChoice: 'full' });
    const paid = input.paid ? q.totalCents : 0;
    const b = db.transaction(() => {
      const c = avail.check({ roomId: sel.room.id, date: sel.date, startMin: sel.startMin, durationH: sel.durationH, engineer: sel.engineer, ignoreNotice: true });
      if (!c.ok) throw new HttpError(409, c.error);
      return db.createBooking({
        room_id: sel.room.id, date: sel.date, start_min: sel.startMin, duration_min: sel.durationH * 60,
        start_abs: c.startAbs, end_abs: c.endAbs, with_engineer: c.withEngineer, extras: q.extras,
        customer_name: customer.name, customer_email: customer.email, customer_phone: customer.phone, artist_name: customer.artist,
        notes: cleanMultiline(input.notes, 1000), total_cents: q.totalCents, due_cents: 0, paid_cents: paid,
        payment_choice: 'onsite', status: 'confirmed', source: 'admin',
      });
    });
    if (input.notify && b.customer_email) mailer.bookingConfirmed(b).catch((e) => console.error(e));
    return b;
  }

  // --- Vues -------------------------------------------------------------------
  function publicView(b, nowMs = Date.now()) {
    const room = avail.room(b.room_id);
    const manage = mailer.manageUrl(b);
    const deadline = T.fromAbs(cancelDeadlineAbs(b));
    return {
      ref: b.ref,
      status: b.status,
      cancelReason: b.cancel_reason,
      room: room ? { id: room.id, name: room.name, kind: room.kind } : { id: b.room_id, name: b.room_id },
      date: b.date,
      dateLabel: T.fmtDateLong(b.date),
      start: T.fmtMin(b.start_min),
      end: T.fmtMin(b.start_min + b.duration_min),
      durationH: b.duration_min / 60,
      withEngineer: b.with_engineer,
      engineerIncluded: room ? room.engineer === 'included' : false,
      extras: b.extras,
      totalCents: b.total_cents,
      dueCents: b.due_cents,
      paidCents: b.paid_cents,
      refundedCents: b.refunded_cents,
      restCents: Math.max(0, b.total_cents - b.paid_cents),
      paymentChoice: b.payment_choice,
      customer: { name: b.customer_name, email: b.customer_email },
      holdExpiresAt: b.status === 'pending' ? b.hold_expires_at : null,
      canCancel: canCustomerCancel(b, nowMs),
      cancelDeadline: `${T.fmtDateLong(deadline.date)} à ${T.fmtMin(deadline.minutes)}`,
      calendar: b.status === 'confirmed' ? { google: googleCalendarUrl(cfg, b, manage), ics: `/api/bookings/${b.ref}/ics?t=${encodeURIComponent(b.token)}` } : null,
      address: address(cfg),
      mapsUrl: cfg.studio.mapsUrl,
      demo: payments.demo,
    };
  }

  function adminView(b) {
    const room = avail.room(b.room_id);
    return {
      id: b.id, ref: b.ref, status: b.status, source: b.source, cancelReason: b.cancel_reason,
      roomId: b.room_id, roomName: room ? room.name : b.room_id,
      date: b.date, dateLabel: T.fmtDateShort(b.date), start: T.fmtMin(b.start_min), end: T.fmtMin(b.start_min + b.duration_min),
      startMin: b.start_min, durationMin: b.duration_min, startAbs: b.start_abs, endAbs: b.end_abs,
      withEngineer: b.with_engineer, extras: b.extras,
      customer: { name: b.customer_name, email: b.customer_email, phone: b.customer_phone, artist: b.artist_name },
      notes: b.notes,
      totalCents: b.total_cents, paidCents: b.paid_cents, refundedCents: b.refunded_cents, paymentChoice: b.payment_choice,
      total: fmtEur(b.total_cents), paid: fmtEur(b.paid_cents), stripe: !!b.stripe_payment_intent,
      holdExpiresAt: b.hold_expires_at, createdAt: b.created_at, confirmedAt: b.confirmed_at, cancelledAt: b.cancelled_at,
      manageUrl: mailer.manageUrl(b),
    };
  }

  return { createFromWeb, confirmPaid, syncWithStripe, handleStripeEvent, cancel, canCustomerCancel, createManual, publicView, adminView };
}

module.exports = { createBookingService, HttpError };
