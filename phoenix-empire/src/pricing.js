'use strict';
// Le prix est toujours recalculé côté serveur à partir de config/studio.json :
// le navigateur n'envoie que des choix, jamais des montants.

const euros = (n) => Math.round(Number(n) * 100);

function fmtEur(cents) {
  const v = cents / 100;
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: Number.isInteger(v) ? 0 : 2 }).format(v);
}

function quote(cfg, { room, durationH, withEngineer, extras = [], paymentChoice = 'deposit' }) {
  const lines = [];
  const base = euros(room.prices[durationH]);
  lines.push({ label: `${room.name} · ${durationH} h${room.engineer === 'included' ? ' (ingé son inclus)' : ''}`, cents: base });

  if (withEngineer && room.engineer === 'optional') {
    lines.push({ label: `${cfg.engineer.label} · ${durationH} h`, cents: euros(cfg.engineer.hourly) * durationH });
  }

  const chosen = [];
  for (const sel of extras) {
    const ex = cfg.extras.find((e) => e.id === sel.id);
    const qty = Math.floor(Number(sel.qty));
    if (!ex || !(qty > 0)) continue;
    const q = Math.min(qty, ex.max);
    const cents = euros(ex.price) * q;
    chosen.push({ id: ex.id, name: ex.name, qty: q, unit_cents: euros(ex.price) });
    lines.push({ label: q > 1 ? `${ex.name} × ${q}` : ex.name, cents });
  }

  const totalCents = lines.reduce((s, l) => s + l.cents, 0);
  const pct = Number(cfg.payment.depositPercent) || 0;
  const depositCents = pct > 0 && pct < 100 ? Math.round((totalCents * pct) / 100) : totalCents;
  let choice = paymentChoice === 'full' ? 'full' : 'deposit';
  if (depositCents === totalCents) choice = 'full';
  if (choice === 'full' && !cfg.payment.allowFullPayment && depositCents !== totalCents) choice = 'deposit';
  const dueCents = choice === 'full' ? totalCents : depositCents;

  return { lines, extras: chosen, totalCents, depositCents, dueCents, paymentChoice: choice };
}

module.exports = { quote, fmtEur, euros };
