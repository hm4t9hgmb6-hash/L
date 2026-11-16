/* Phoenix Empire — confirmation et gestion d'une réservation. */
(() => {
  'use strict';
  const { api, fmtEur, esc, icon, toast } = window.PE;
  const view = document.querySelector('[data-view]');
  const params = new URLSearchParams(location.search);
  const ref = params.get('ref');
  const token = params.get('t');
  const justPaid = params.has('session_id') || params.has('ok');
  let pollUntil = Date.now() + 90 * 1000;

  if (params.has('session_id') || params.has('ok')) {
    history.replaceState(null, '', `/reservation?ref=${encodeURIComponent(ref || '')}&t=${encodeURIComponent(token || '')}`);
  }

  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  function stateBlock({ iconName, muted, spinner, title, text, actions = '' }) {
    return `<div class="state">
      ${spinner ? '<div class="spinner" aria-hidden="true"></div>' : `<div class="state__icon ${muted ? 'state__icon--muted' : ''}">${icon(iconName)}</div>`}
      <h1>${title}</h1>
      <p>${text}</p>
      ${actions ? `<div class="hero__actions" style="justify-content:center">${actions}</div>` : ''}
    </div>`;
  }

  function ticket(b) {
    const rows = [
      ['Date', cap(b.dateLabel)],
      ['Horaire', `${b.start} → ${b.end}`],
      ['Durée', `${b.durationH} h`],
      ['Ingé son', b.engineerIncluded ? 'Inclus' : b.withEngineer ? 'Oui' : 'Non'],
      ['Options', b.extras.length ? b.extras.map((e) => (e.qty > 1 ? `${e.name} × ${e.qty}` : e.name)).join(', ') : 'Aucune'],
      ['Adresse', b.address],
    ];
    const money = [`Total <b>${fmtEur(b.totalCents)}</b>`, `Réglé <b>${fmtEur(b.paidCents - b.refundedCents)}</b>`];
    if (b.status === 'confirmed' && b.restCents > 0) money.push(`Reste à régler au studio <b>${fmtEur(b.restCents)}</b>`);
    if (b.refundedCents > 0) money.push(`Remboursé <b>${fmtEur(b.refundedCents)}</b>`);
    const actions = b.calendar ? `
      <a class="btn btn--ghost btn--sm" href="${esc(b.calendar.google)}" target="_blank" rel="noopener">${icon('calendar')} Google Agenda</a>
      <a class="btn btn--ghost btn--sm" href="${esc(b.calendar.ics)}">${icon('download')} Apple / Outlook (.ics)</a>
      <a class="btn btn--ghost btn--sm" href="${esc(b.mapsUrl)}" target="_blank" rel="noopener">${icon('pin')} Itinéraire</a>` : '';
    return `<article class="ticket">
      <div class="ticket__top">
        <div><p class="eyebrow">${esc(b.room.kind || 'Session')}</p><h2 style="margin-top:12px">${esc(b.room.name)}</h2><p>Au nom de ${esc(b.customer.name)}</p></div>
        <div class="ticket__ref"><span>Référence</span><strong>${esc(b.ref)}</strong></div>
      </div>
      <div class="ticket__cut" aria-hidden="true"></div>
      <div class="ticket__grid">${rows.map(([k, v]) => `<div><span>${k}</span><strong>${esc(v)}</strong></div>`).join('')}</div>
      <div class="ticket__money">${money.join('<span aria-hidden="true">·</span>')}</div>
      ${actions ? `<div class="ticket__actions">${actions}</div>` : ''}
    </article>`;
  }

  function manageBlock(b) {
    if (b.status !== 'confirmed') return '';
    if (!b.canCancel) {
      return `<div class="notice manage">${icon('clock')}<div><strong>Annulation en ligne fermée</strong><p>Le délai d'annulation gratuite est dépassé. Pour toute demande, contacte directement le studio.</p></div></div>`;
    }
    const refund = b.paidCents - b.refundedCents;
    return `<div class="notice manage" data-manage>${icon('refresh')}<div style="flex:1">
      <strong>Un empêchement ?</strong>
      <p>Tu peux annuler gratuitement jusqu'au ${esc(b.cancelDeadline)}${refund > 0 ? ` : tes ${fmtEur(refund)} te seront remboursés.` : '.'}</p>
      <div class="hero__actions" style="margin-top:14px" data-cancel-zone><button type="button" class="btn btn--danger btn--sm" data-cancel-ask>Annuler ma réservation</button></div>
    </div></div>`;
  }

  function render(b) {
    if (b.status === 'pending') {
      const demo = b.demo ? `<a class="btn btn--primary" href="/paiement-demo?ref=${encodeURIComponent(b.ref)}&t=${encodeURIComponent(token)}">Finaliser le paiement ${icon('arrow-right')}</a>` : '';
      view.innerHTML = stateBlock({
        spinner: !b.demo,
        iconName: 'clock',
        muted: true,
        title: b.demo ? 'Paiement en attente' : 'Validation du paiement…',
        text: b.demo ? 'Ton créneau est réservé pour toi quelques minutes, le temps de finaliser le paiement.' : 'On attend la confirmation de ta banque. Ça prend généralement quelques secondes, ne ferme pas cette page.',
        actions: demo,
      });
      if (!b.demo) {
        if (Date.now() < pollUntil) setTimeout(load, 2000);
        else view.innerHTML = stateBlock({ iconName: 'clock', muted: true, title: 'Paiement en cours de traitement', text: 'Ta banque met un peu plus de temps que d\'habitude. Tu recevras un e-mail dès que la réservation sera confirmée. Tu peux recharger cette page dans quelques minutes.' });
      }
      return;
    }

    if (b.status === 'confirmed') {
      const head = justPaid
        ? stateBlock({ iconName: 'check', title: 'C\'est réservé.', text: `Merci ${esc(b.customer.name.split(' ')[0])} ! Ta confirmation vient de partir à <strong>${esc(b.customer.email)}</strong>. On t'attend au studio.` })
        : stateBlock({ iconName: 'calendar', title: 'Ta réservation', text: 'Retrouve ici tous les détails de ta session.' });
      view.innerHTML = head + ticket(b) + manageBlock(b);
      return;
    }

    const reasons = {
      conflit: 'Ton paiement est arrivé après la fin du délai de réservation et le créneau a été pris entre-temps. Tu as été intégralement remboursé.',
      abandon: 'Le paiement n\'a pas été finalisé, le créneau a été libéré. Aucun montant n\'a été débité.',
    };
    const title = b.status === 'expired' ? 'Réservation expirée' : 'Réservation annulée';
    const text = b.status === 'expired'
      ? 'Le délai de paiement est dépassé et le créneau a été libéré. Aucun montant n\'a été débité.'
      : reasons[b.cancelReason] || (b.refundedCents > 0 ? `Cette réservation est annulée. ${fmtEur(b.refundedCents)} ont été remboursés sur ta carte (comptez 5 à 10 jours).` : 'Cette réservation est annulée.');
    view.innerHTML = stateBlock({ iconName: 'ban', muted: true, title, text, actions: `<a class="btn btn--primary" href="/reserver">Réserver un créneau ${icon('arrow-right')}</a>` })
      + (b.paidCents > 0 ? ticket(b) : '');
  }

  async function load() {
    if (!ref || !token) {
      view.innerHTML = stateBlock({ iconName: 'x', muted: true, title: 'Lien incomplet', text: 'Utilise le lien reçu dans ton e-mail de confirmation pour retrouver ta réservation.', actions: `<a class="btn btn--primary" href="/reserver">Réserver une session ${icon('arrow-right')}</a>` });
      return;
    }
    try {
      const b = await api(`/api/bookings/${encodeURIComponent(ref)}?t=${encodeURIComponent(token)}`);
      render(b);
    } catch (e) {
      view.innerHTML = stateBlock({ iconName: 'x', muted: true, title: e.status === 404 ? 'Réservation introuvable' : 'Oups', text: esc(e.message), actions: `<a class="btn btn--ghost" href="/">Retour à l'accueil</a>` });
    }
  }

  view.addEventListener('click', async (e) => {
    const zone = view.querySelector('[data-cancel-zone]');
    if (e.target.closest('[data-cancel-ask]')) {
      zone.innerHTML = `<button type="button" class="btn btn--danger btn--sm" data-cancel-confirm>Oui, annuler</button><button type="button" class="btn btn--ghost btn--sm" data-cancel-keep>Garder ma réservation</button>`;
      zone.querySelector('[data-cancel-confirm]').focus();
    } else if (e.target.closest('[data-cancel-keep]')) {
      zone.innerHTML = '<button type="button" class="btn btn--danger btn--sm" data-cancel-ask>Annuler ma réservation</button>';
    } else if (e.target.closest('[data-cancel-confirm]')) {
      const btn = e.target.closest('[data-cancel-confirm]');
      btn.classList.add('is-loading');
      try {
        const b = await api(`/api/bookings/${encodeURIComponent(ref)}/cancel`, { method: 'POST', body: { t: token } });
        render(b);
        toast(b.justRefundedCents > 0 ? `Réservation annulée · ${fmtEur(b.justRefundedCents)} remboursés` : 'Réservation annulée');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } catch (err) {
        btn.classList.remove('is-loading');
        toast(err.message, 'error');
      }
    }
  });

  load();
})();
