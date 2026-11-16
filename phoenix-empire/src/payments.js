'use strict';
// Paiement : Stripe Checkout si STRIPE_SECRET_KEY est défini, sinon mode démo
// (page de paiement simulée, aucun argent n'est encaissé).
const T = require('./time');

const STRIPE_SESSION_MINUTES = 31; // Stripe impose au moins 30 minutes.

function createPayments(cfg, env) {
  const stripe = env.stripeSecretKey ? require('stripe')(env.stripeSecretKey) : null;
  const holdMinutes = stripe ? STRIPE_SESSION_MINUTES + 2 : 15;

  return {
    enabled: !!stripe,
    demo: !stripe,
    holdMs: holdMinutes * 60 * 1000,

    async createCheckout(booking, room) {
      const back = `${env.baseUrl}/reservation?ref=${encodeURIComponent(booking.ref)}&t=${encodeURIComponent(booking.token)}`;
      if (!stripe) {
        return { url: `/paiement-demo?ref=${encodeURIComponent(booking.ref)}&t=${encodeURIComponent(booking.token)}`, sessionId: null };
      }
      const label = booking.payment_choice === 'full' ? 'Session' : `Acompte ${cfg.payment.depositPercent} %`;
      const when = `${T.fmtDateLong(booking.date)}, ${T.fmtMin(booking.start_min)} – ${T.fmtMin(booking.start_min + booking.duration_min)}`;
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        locale: 'fr',
        customer_email: booking.customer_email || undefined,
        client_reference_id: booking.ref,
        expires_at: Math.floor(Date.now() / 1000) + STRIPE_SESSION_MINUTES * 60,
        line_items: [{
          quantity: 1,
          price_data: {
            currency: cfg.currency,
            unit_amount: booking.due_cents,
            product_data: {
              name: `${label} · ${room.name}`,
              description: `${when} · Réf. ${booking.ref}`,
            },
          },
        }],
        metadata: { booking_ref: booking.ref, booking_id: String(booking.id) },
        payment_intent_data: {
          description: `${cfg.studio.name} · ${booking.ref}`,
          metadata: { booking_ref: booking.ref },
        },
        success_url: `${back}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${env.baseUrl}/reserver?annule=${encodeURIComponent(booking.ref)}&t=${encodeURIComponent(booking.token)}`,
      });
      return { url: session.url, sessionId: session.id };
    },

    async retrieveSession(id) {
      if (!stripe || !id) return null;
      return stripe.checkout.sessions.retrieve(id);
    },

    async expireSession(id) {
      if (!stripe || !id) return;
      try { await stripe.checkout.sessions.expire(id); } catch { /* déjà expirée ou payée */ }
    },

    async refund(paymentIntent, amountCents, ref) {
      if (!(amountCents > 0)) return 0;
      if (!stripe || !paymentIntent) return amountCents; // mode démo ou paiement hors ligne
      const r = await stripe.refunds.create({ payment_intent: paymentIntent, amount: amountCents, metadata: { booking_ref: ref } });
      return r.amount;
    },

    constructEvent(rawBody, signature) {
      if (!stripe) throw new Error('Stripe non configuré');
      if (!env.stripeWebhookSecret) throw new Error('STRIPE_WEBHOOK_SECRET manquant');
      return stripe.webhooks.constructEvent(rawBody, signature, env.stripeWebhookSecret);
    },
  };
}

module.exports = { createPayments };
