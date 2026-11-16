/* Phoenix Empire — page de paiement simulée (mode démo uniquement). */
(() => {
  'use strict';
  const { api, fmtEur, esc } = window.PE;
  const $ = (s) => document.querySelector(s);
  const params = new URLSearchParams(location.search);
  const ref = params.get('ref');
  const token = params.get('t');
  const back = `/reserver?annule=${encodeURIComponent(ref || '')}&t=${encodeURIComponent(token || '')}`;
  $('[data-back]').href = back;

  const fail = (msg) => { const el = $('[data-error]'); el.hidden = false; el.textContent = msg; };

  api(`/api/bookings/${encodeURIComponent(ref)}?t=${encodeURIComponent(token)}`).then((b) => {
    if (b.status !== 'pending') { location.href = `/reservation?ref=${encodeURIComponent(ref)}&t=${encodeURIComponent(token)}`; return; }
    $('[data-amount]').textContent = fmtEur(b.dueCents);
    $('[data-label]').textContent = b.paymentChoice === 'full' ? 'Paiement de la session' : `Acompte · total ${fmtEur(b.totalCents)}`;
    $('[data-email]').value = b.customer.email;
    $('[data-rows]').innerHTML = [
      ['Studio', b.room.name], ['Date', b.dateLabel], ['Horaire', `${b.start} → ${b.end}`], ['Référence', b.ref],
    ].map(([k, v]) => `<li><span>${k}</span><span>${esc(v)}</span></li>`).join('');
    $('[data-pay-label]').textContent = `Payer ${fmtEur(b.dueCents)}`;
    $('[data-pay]').disabled = false;
  }).catch((e) => fail(e.message));

  $('[data-form]').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('[data-pay]');
    btn.classList.add('is-loading');
    try {
      await api(`/api/demo/pay/${encodeURIComponent(ref)}`, { method: 'POST', body: { t: token } });
      location.href = `/reservation?ref=${encodeURIComponent(ref)}&t=${encodeURIComponent(token)}&ok=1`;
    } catch (err) {
      btn.classList.remove('is-loading');
      fail(err.message);
    }
  });
})();
