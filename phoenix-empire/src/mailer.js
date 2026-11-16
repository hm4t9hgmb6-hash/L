'use strict';
// E-mails transactionnels. Sans configuration SMTP, les e-mails sont écrits dans
// data/outbox/ (pratique pour tester) au lieu d'être envoyés.
const fs = require('node:fs');
const path = require('node:path');
const T = require('./time');
const { fmtEur } = require('./pricing');
const { buildIcs, address } = require('./ics');

const escHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function createMailer(cfg, env) {
  let transport = null;
  if (env.smtp.host) {
    const nodemailer = require('nodemailer');
    transport = nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.secure,
      auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.pass } : undefined,
    });
  }
  const from = env.smtp.from || `${cfg.studio.name} <${cfg.studio.email}>`;
  const studioInbox = env.notifyEmail || cfg.studio.email;
  const outbox = path.join(env.dataDir, 'outbox');

  async function send({ to, subject, html, text, attachments, replyTo }) {
    if (!to) return;
    if (transport) {
      try {
        await transport.sendMail({ from, to, subject, html, text, attachments, replyTo });
      } catch (err) {
        console.error(`[mail] échec d'envoi à ${to} : ${err.message}`);
      }
      return;
    }
    try {
      fs.mkdirSync(outbox, { recursive: true });
      const file = path.join(outbox, `${Date.now()}-${subject.replace(/[^a-z0-9]+/gi, '-').slice(0, 60)}.html`);
      fs.writeFileSync(file, `<!-- À : ${to}\n     Objet : ${subject} -->\n${html}`);
      console.log(`[mail] (non envoyé, SMTP non configuré) → ${to} · ${subject}`);
    } catch (err) {
      console.error(`[mail] impossible d'écrire dans data/outbox : ${err.message}`);
    }
  }

  function manageUrl(b) {
    return `${env.baseUrl}/reservation?ref=${encodeURIComponent(b.ref)}&t=${encodeURIComponent(b.token)}`;
  }

  function details(b) {
    const room = cfg.rooms.find((r) => r.id === b.room_id);
    const rows = [
      ['Référence', b.ref],
      ['Studio', room ? room.name : b.room_id],
      ['Date', T.fmtDateLong(b.date)],
      ['Horaire', `${T.fmtMin(b.start_min)} – ${T.fmtMin(b.start_min + b.duration_min)} (${b.duration_min / 60} h)`],
    ];
    if (b.with_engineer) rows.push(['Ingé son', room && room.engineer === 'included' ? 'Inclus' : 'Oui']);
    for (const ex of b.extras) rows.push(['Option', ex.qty > 1 ? `${ex.name} × ${ex.qty}` : ex.name]);
    rows.push(['Total', fmtEur(b.total_cents)]);
    rows.push(['Déjà réglé', fmtEur(b.paid_cents - b.refunded_cents)]);
    const rest = b.total_cents - b.paid_cents;
    if (rest > 0 && b.status === 'confirmed') rows.push(['Reste à régler sur place', fmtEur(rest)]);
    return rows;
  }

  function layout({ title, intro, rows, cta, footer }) {
    const tr = rows.map(([k, v]) => `<tr><td style="padding:8px 0;color:#a89a8f;font-size:14px;width:44%">${escHtml(k)}</td><td style="padding:8px 0;color:#f6efe9;font-size:14px;font-weight:600">${escHtml(v)}</td></tr>`).join('');
    return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="color-scheme" content="dark"></head>
<body style="margin:0;background:#0a0807;font-family:Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0a0807;padding:32px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#15100d;border:1px solid #2a211c;border-radius:16px;overflow:hidden">
<tr><td style="height:4px;background:linear-gradient(90deg,#f2b544,#ff5b1f,#d7263d);background-color:#ff5b1f"></td></tr>
<tr><td style="padding:28px 28px 8px"><div style="font-size:12px;letter-spacing:.24em;text-transform:uppercase;color:#ff8a3d;font-weight:700">${escHtml(cfg.studio.name)}</div>
<h1 style="margin:12px 0 8px;font-size:24px;line-height:1.25;color:#f6efe9">${escHtml(title)}</h1>
<p style="margin:0;color:#cfc3ba;font-size:15px;line-height:1.6">${intro}</p></td></tr>
<tr><td style="padding:16px 28px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #2a211c">${tr}</table></td></tr>
${cta ? `<tr><td style="padding:8px 28px 24px"><a href="${escHtml(cta.href)}" style="display:inline-block;background:#ff6a26;color:#140a05;text-decoration:none;font-weight:700;padding:13px 22px;border-radius:999px;font-size:15px">${escHtml(cta.label)}</a></td></tr>` : ''}
<tr><td style="padding:20px 28px 28px;border-top:1px solid #2a211c;color:#a89a8f;font-size:13px;line-height:1.6">${footer || ''}
${escHtml(cfg.studio.name)} · ${escHtml(address(cfg))}<br>${escHtml(cfg.studio.phone)} · ${escHtml(cfg.studio.email)}</td></tr>
</table></td></tr></table></body></html>`;
  }

  const text = (title, rows, extra = '') => `${title}\n\n${rows.map(([k, v]) => `${k} : ${v}`).join('\n')}\n${extra}\n\n${cfg.studio.name} · ${address(cfg)} · ${cfg.studio.phone}`;

  return {
    async bookingConfirmed(b) {
      const url = manageUrl(b);
      const rows = details(b);
      const room = cfg.rooms.find((r) => r.id === b.room_id);
      const title = 'Ta session est confirmée';
      const access = cfg.studio.address && cfg.studio.address.access ? `<br>${escHtml(cfg.studio.address.access)}` : '';
      await send({
        to: b.customer_email,
        replyTo: cfg.studio.email,
        subject: `Session confirmée · ${room ? room.name : ''}, ${T.fmtDateShort(b.date)} à ${T.fmtMin(b.start_min)} (${b.ref})`,
        html: layout({
          title,
          intro: `Merci ${escHtml(b.customer_name.split(' ')[0] || '')} ! Ton créneau est bloqué. Rendez-vous au <strong style="color:#f6efe9">${escHtml(address(cfg))}</strong>${access}. Arrive 10 minutes avant pour t'installer.`,
          rows,
          cta: { href: url, label: 'Gérer ma réservation' },
          footer: `Annulation gratuite jusqu'à ${cfg.booking.freeCancellationHours} h avant le début de la session, depuis le lien ci-dessus.<br><br>`,
        }),
        text: text(title, rows, `\nGérer ma réservation : ${url}`),
        attachments: [{ filename: `${b.ref}.ics`, content: buildIcs(cfg, b, url), contentType: 'text/calendar; charset=utf-8; method=PUBLISH' }],
      });
      await send({
        to: studioInbox,
        replyTo: b.customer_email,
        subject: `Nouvelle réservation ${b.ref} · ${room ? room.name : ''}, ${T.fmtDateShort(b.date)} ${T.fmtMin(b.start_min)}`,
        html: layout({
          title: 'Nouvelle réservation',
          intro: `${escHtml(b.customer_name)}${b.artist_name ? ` (${escHtml(b.artist_name)})` : ''} · ${escHtml(b.customer_email)} · ${escHtml(b.customer_phone)}${b.notes ? `<br><br><em>« ${escHtml(b.notes)} »</em>` : ''}`,
          rows,
          cta: { href: `${env.baseUrl}/admin`, label: 'Ouvrir l\'espace studio' },
        }),
        text: text('Nouvelle réservation', rows, `\nClient : ${b.customer_name} · ${b.customer_email} · ${b.customer_phone}\n${b.notes}`),
      });
    },

    async bookingCancelled(b, { refundCents = 0, byStudio = false, reason = '' } = {}) {
      const rows = details(b);
      if (refundCents > 0) rows.push(['Remboursement', `${fmtEur(refundCents)} (sous 5 à 10 jours sur ta carte)`]);
      const title = 'Ta réservation est annulée';
      const intro = byStudio
        ? `Le studio a annulé ta réservation ${escHtml(b.ref)}.${reason ? ` Motif : ${escHtml(reason)}.` : ''} N'hésite pas à nous contacter pour trouver un autre créneau.`
        : `Ta réservation ${escHtml(b.ref)} est bien annulée.`;
      await send({
        to: b.customer_email,
        replyTo: cfg.studio.email,
        subject: `Réservation annulée · ${b.ref}`,
        html: layout({ title, intro, rows, cta: { href: `${env.baseUrl}/reserver`, label: 'Réserver un autre créneau' } }),
        text: text(title, rows),
      });
      if (!byStudio) {
        await send({
          to: studioInbox,
          subject: `Annulation client ${b.ref} · ${T.fmtDateShort(b.date)} ${T.fmtMin(b.start_min)}`,
          html: layout({ title: 'Annulation par le client', intro: `${escHtml(b.customer_name)} · ${escHtml(b.customer_email)}`, rows }),
          text: text('Annulation par le client', rows),
        });
      }
    },

    async paymentConflict(b, refundCents) {
      const rows = details(b);
      rows.push(['Remboursement', fmtEur(refundCents)]);
      const title = 'Ton paiement a été remboursé';
      await send({
        to: b.customer_email,
        subject: `Créneau indisponible · ${b.ref} remboursée`,
        html: layout({
          title,
          intro: 'Ton paiement est arrivé après l\'expiration de la réservation temporaire, et le créneau a été pris entre-temps. Tu as été remboursé intégralement. Désolé pour ce contretemps !',
          rows,
          cta: { href: `${env.baseUrl}/reserver`, label: 'Choisir un autre créneau' },
        }),
        text: text(title, rows),
      });
    },

    manageUrl,
  };
}

module.exports = { createMailer, escHtml };
