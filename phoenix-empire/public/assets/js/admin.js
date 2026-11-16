/* Phoenix Empire — espace studio. */
(() => {
  'use strict';
  const { api, fmtEur, esc, icon, toast, addDays, hm } = window.PE;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  let ov = null;
  let weekStart = null;
  let current = null; // réservation ouverte dans la fenêtre
  const bookingsById = new Map();

  const STATUS = {
    confirmed: ['Confirmée', 'pill--ok'],
    pending: ['Paiement en cours', 'pill--warn'],
    cancelled: ['Annulée', 'pill--err'],
    expired: ['Expirée', 'pill--off'],
  };
  const pill = (s) => `<span class="pill ${(STATUS[s] || ['', ''])[1]}">${(STATUS[s] || [s])[0]}</span>`;
  const roomOf = (id) => (ov ? ov.rooms.find((r) => r.id === id) : null);
  const epochDay = (date) => Date.parse(`${date}T00:00:00Z`) / 86400000;
  const mondayOf = (date) => addDays(date, -((new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7));
  const dayLabel = (date) => new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`));

  // ---------- Connexion ----------
  async function boot() {
    const s = await api('/api/admin/session');
    if (!s.authenticated) {
      $('[data-login]').hidden = false;
      if (!s.configured) {
        const err = $('[data-login-error]');
        err.hidden = false;
        err.textContent = 'Espace désactivé : ajoute ADMIN_PASSWORD dans le fichier .env puis redémarre le serveur.';
      }
      return;
    }
    $('[data-login]').hidden = true;
    $('[data-app]').hidden = false;
    await loadOverview();
    weekStart = mondayOf(ov.today);
    initForms();
    loadWeek();
  }

  $('[data-login-form]').addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = $('[data-login-error]');
    try {
      await api('/api/admin/login', { method: 'POST', body: { password: e.target.elements.password.value } });
      err.hidden = true;
      boot();
    } catch (ex) {
      err.hidden = false;
      err.textContent = ex.message;
    }
  });

  $('[data-logout]').addEventListener('click', async () => {
    await api('/api/admin/logout', { method: 'POST' }).catch(() => {});
    location.reload();
  });

  // ---------- Vue d'ensemble ----------
  async function loadOverview() {
    ov = await api('/api/admin/overview');
    const prov = { 'stripe-live': ['Stripe · encaissement réel', 'pill--ok'], 'stripe-test': ['Stripe · mode test', 'pill--warn'], demo: ['Paiement : mode démo', 'pill--warn'] }[ov.provider];
    const p = $('[data-provider]');
    p.textContent = prov[0];
    p.className = `pill ${prov[1]}`;
    const setup = [];
    if (ov.provider === 'demo') setup.push('Le paiement en ligne est en <strong>mode démo</strong> : ajoute STRIPE_SECRET_KEY et STRIPE_WEBHOOK_SECRET dans .env pour encaisser (voir README).');
    if (ov.mail !== 'smtp') setup.push('Les e-mails ne partent pas encore : ils sont copiés dans <code>data/outbox/</code>. Configure SMTP_HOST dans .env.');
    $('[data-setup]').innerHTML = setup.map((t) => `<div class="notice notice--warn" style="margin-bottom:12px">${icon('bolt')}<div><p>${t}</p></div></div>`).join('');
    const hours = Math.round(ov.month.minutes / 60);
    $('[data-kpis]').innerHTML = [
      ['7 prochains jours', ov.upcomingWeek, `session${ov.upcomingWeek > 1 ? 's' : ''} confirmée${ov.upcomingWeek > 1 ? 's' : ''}`],
      [`Encaissé · ${ov.month.label}`, fmtEur(ov.month.cashed_cents), `sur ${fmtEur(ov.month.total_cents)} réservés`],
      [`Heures · ${ov.month.label}`, `${hours} h`, `${ov.month.count} session${ov.month.count > 1 ? 's' : ''}`],
      ['Paiements en cours', ov.pendingCount, 'créneaux bloqués le temps du paiement'],
    ].map(([k, v, s]) => `<div class="kpi"><span>${esc(k)}</span><strong>${esc(v)}</strong><small>${esc(s)}</small></div>`).join('');
    $('[data-legend]').innerHTML = ov.rooms.map((r) => `<span style="--accent:${esc(r.accent)};margin-left:14px"><i class="room-dot"></i>${esc(r.name)}</span>`).join('');
  }

  // ---------- Onglets ----------
  $$('[data-tab]').forEach((t) => t.addEventListener('click', () => {
    $$('[data-tab]').forEach((x) => x.setAttribute('aria-selected', String(x === t)));
    $$('[data-panel]').forEach((p) => { p.hidden = p.dataset.panel !== t.dataset.tab; });
    if (t.dataset.tab === 'list') loadList();
    if (t.dataset.tab === 'blocks') loadBlocks();
    if (t.dataset.tab === 'planning') loadWeek();
  }));

  // ---------- Planning ----------
  async function loadWeek() {
    const end = addDays(weekStart, 6);
    $('[data-week-label]').textContent = `${dayLabel(weekStart)} → ${dayLabel(end)}`;
    const [{ bookings }, { blocks }] = await Promise.all([
      api(`/api/admin/bookings?from=${weekStart}&to=${end}&status=confirmed,pending`),
      api('/api/admin/blocks'),
    ]);
    bookings.forEach((b) => bookingsById.set(b.id, b));
    const now = Date.now();
    const live = bookings.filter((b) => b.status === 'confirmed' || b.holdExpiresAt > now);
    let html = '';
    for (let i = 0; i < 7; i++) {
      const date = addDays(weekStart, i);
      const d0 = epochDay(date) * 1440;
      const items = live.filter((b) => b.date === date).sort((a, b) => a.startAbs - b.startAbs).map((b) => {
        const r = roomOf(b.roomId);
        return `<button type="button" class="week__item ${b.status === 'pending' ? 'is-pending' : ''}" data-open="${b.id}" style="--accent:${esc(r ? r.accent : '#888')}">
          <strong>${b.start} – ${b.end}</strong><span>${esc(b.customer.artist || b.customer.name)} · ${esc(b.roomName)}</span></button>`;
      });
      const bl = blocks.filter((x) => x.start_abs < d0 + 1440 && x.end_abs > d0).map((x) =>
        `<div class="week__item is-block"><strong>Fermé · ${esc(x.roomName)}</strong><span>${esc(x.reason || 'Créneau bloqué')}</span></div>`);
      html += `<div class="week__day ${date === ov.today ? 'is-today' : ''}"><h3>${dayLabel(date)}<b>${items.length || ''}</b></h3>${bl.join('')}${items.join('') || (bl.length ? '' : '<p class="week__none">Aucune session</p>')}</div>`;
    }
    $('[data-week-grid]').innerHTML = html;
  }

  $$('[data-week]').forEach((b) => b.addEventListener('click', () => {
    const d = Number(b.dataset.week);
    weekStart = d === 0 ? mondayOf(ov.today) : addDays(weekStart, d * 7);
    loadWeek();
  }));

  // ---------- Liste ----------
  async function loadList() {
    const f = $('[data-filters]').elements;
    const p = new URLSearchParams({ status: f.status.value, q: f.q.value });
    if (f.from.value) p.set('from', f.from.value);
    else if (f.status.value === 'confirmed,pending') p.set('from', ov.today);
    if (f.to.value) p.set('to', f.to.value);
    const { bookings } = await api(`/api/admin/bookings?${p}`);
    bookings.forEach((b) => bookingsById.set(b.id, b));
    const rows = (f.status.value === 'cancelled' || f.status.value === 'all' || f.status.value === 'expired') ? bookings.reverse() : bookings;
    $('[data-table]').innerHTML = rows.length ? rows.map((b) => {
      const r = roomOf(b.roomId);
      return `<tr data-open="${b.id}">
        <td><strong>${esc(b.dateLabel)}</strong><small>${b.start} – ${b.end}</small></td>
        <td><span class="room-dot" style="--accent:${esc(r ? r.accent : '#888')}"></span>${esc(b.roomName)}</td>
        <td><strong>${esc(b.customer.name)}</strong><small>${esc(b.customer.artist || b.customer.email)}</small></td>
        <td><strong>${b.total}</strong><small>réglé ${b.paid}${b.refundedCents ? ` · remb. ${fmtEur(b.refundedCents)}` : ''}</small></td>
        <td>${pill(b.status)}</td>
        <td><code>${esc(b.ref)}</code></td>
      </tr>`;
    }).join('') : '<tr><td colspan="6" class="muted" style="text-align:center;padding:40px">Aucune réservation pour ces critères.</td></tr>';
  }
  $('[data-filters]').addEventListener('submit', (e) => { e.preventDefault(); loadList(); });
  $('[data-filters]').addEventListener('change', () => loadList());

  // ---------- Fenêtre de détail ----------
  document.addEventListener('click', (e) => {
    const o = e.target.closest('[data-open]');
    if (o) openModal(bookingsById.get(Number(o.dataset.open)));
  });

  function openModal(b) {
    if (!b) return;
    current = b;
    const r = roomOf(b.roomId);
    $('[data-modal-room]').textContent = `${b.roomName} · ${b.ref}`;
    $('[data-modal-title]').textContent = `${b.dateLabel} · ${b.start} – ${b.end}`;
    const rows = [
      ['Statut', pill(b.status) + (b.cancelReason ? ` <span class="muted">${esc(b.cancelReason)}</span>` : '')],
      ['Client', esc(b.customer.name)],
      ['Artiste', esc(b.customer.artist || '—')],
      ['E-mail', b.customer.email ? `<a href="mailto:${esc(b.customer.email)}">${esc(b.customer.email)}</a>` : '—'],
      ['Téléphone', b.customer.phone ? `<a href="tel:${esc(b.customer.phone)}">${esc(b.customer.phone)}</a>` : '—'],
      ['Ingé son', b.withEngineer ? 'Oui' : 'Non'],
      ['Options', b.extras.length ? esc(b.extras.map((x) => (x.qty > 1 ? `${x.name} × ${x.qty}` : x.name)).join(', ')) : 'Aucune'],
      ['Total', b.total],
      ['Réglé', `${b.paid}${b.stripe ? ' (Stripe)' : b.paymentChoice === 'onsite' ? ' (sur place)' : ''}`],
      ['Reste dû', b.status === 'confirmed' ? fmtEur(Math.max(0, b.totalCents - b.paidCents)) : '—'],
      ['Remboursé', b.refundedCents ? fmtEur(b.refundedCents) : '—'],
      ['Notes', esc(b.notes || '—')],
      ['Origine', b.source === 'admin' ? 'Ajoutée par le studio' : 'Site internet'],
    ];
    $('[data-modal-body]').innerHTML = `<dl class="dl">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl><div data-cancel-box></div>`;
    const foot = [];
    if (b.status === 'confirmed' && b.paidCents < b.totalCents) foot.push('<button class="btn btn--primary btn--sm" type="button" data-act="paid">Marquer comme soldée</button>');
    foot.push(`<button class="btn btn--ghost btn--sm" type="button" data-act="copy">${icon('copy')} Lien client</button>`);
    if (b.status === 'confirmed' || b.status === 'pending') foot.push('<button class="btn btn--danger btn--sm" type="button" data-act="cancel">Annuler</button>');
    $('[data-modal-foot]').innerHTML = foot.join('');
    $('[data-modal]').hidden = false;
    $('[data-modal-close]').focus();
    if (r) $('.modal__box').style.setProperty('--accent', r.accent);
  }

  function closeModal() { $('[data-modal]').hidden = true; current = null; }
  $('[data-modal-close]').addEventListener('click', closeModal);
  $('[data-modal]').addEventListener('click', (e) => { if (e.target === e.currentTarget) closeModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('[data-modal]').hidden) closeModal(); });

  async function refreshAll() {
    await loadOverview();
    const tab = $('[aria-selected="true"][data-tab]').dataset.tab;
    if (tab === 'list') loadList();
    if (tab === 'planning') loadWeek();
  }

  async function onAction(e) {
    const b = e.target.closest('[data-act]');
    if (!b || !current) return;
    const act = b.dataset.act;
    if (act === 'copy') {
      try { await navigator.clipboard.writeText(current.manageUrl); toast('Lien copié : le client peut y voir et annuler sa réservation.'); } catch { prompt('Lien de gestion :', current.manageUrl); }
    } else if (act === 'paid') {
      const out = await api(`/api/admin/bookings/${current.id}/mark-paid`, { method: 'POST' });
      bookingsById.set(out.id, out);
      openModal(out);
      toast('Réservation soldée');
      refreshAll();
    } else if (act === 'cancel') {
      const refundable = current.paidCents - current.refundedCents;
      $('[data-cancel-box]').innerHTML = `<div class="notice notice--err" style="margin-top:20px">${icon('ban')}<div style="flex:1;display:grid;gap:12px">
        <strong>Annuler cette réservation ?</strong>
        ${refundable > 0 ? `<label class="check"><input type="checkbox" data-refund checked><span>Rembourser ${fmtEur(refundable)} au client${current.stripe ? ' (automatique via Stripe)' : ' (à faire toi-même : paiement hors ligne ou démo)'}</span></label>` : ''}
        <input class="input" data-reason maxlength="200" placeholder="Motif envoyé au client (facultatif)">
        <div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn btn--danger btn--sm" type="button" data-act="cancel-go">Confirmer l'annulation</button></div>
      </div></div>`;
    } else if (act === 'cancel-go') {
      b.classList.add('is-loading');
      try {
        const refund = $('[data-refund]') ? $('[data-refund]').checked : false;
        const out = await api(`/api/admin/bookings/${current.id}/cancel`, { method: 'POST', body: { refund, reason: $('[data-reason]').value } });
        bookingsById.set(out.id, out);
        toast(out.justRefundedCents ? `Annulée · ${fmtEur(out.justRefundedCents)} remboursés` : 'Réservation annulée');
        closeModal();
        refreshAll();
      } catch (err) {
        b.classList.remove('is-loading');
        toast(err.message, 'error');
      }
    }
  }
  $('[data-modal-foot]').addEventListener('click', onAction);
  $('[data-modal-body]').addEventListener('click', onAction);

  // ---------- Formulaires ----------
  function windowFor(date) {
    const key = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][new Date(`${date}T12:00:00Z`).getUTCDay()];
    return ov.hours[key];
  }

  function initForms() {
    const roomOpts = ov.rooms.map((r) => `<option value="${esc(r.id)}">${esc(r.name)}</option>`).join('');
    $('[data-add-room]').innerHTML = roomOpts;
    $('[data-block-room]').innerHTML = `<option value="">Tous les studios</option>${roomOpts}`;
    const add = $('[data-add-form]');
    add.elements.date.value = ov.today;
    add.elements.date.min = ov.today;
    $('[data-block-form]').elements.date.value = ov.today;
    $('[data-block-form]').elements.date.min = ov.today;

    const refreshAdd = () => {
      const r = roomOf(add.elements.roomId.value);
      const prevDur = Number(add.elements.duration.value);
      add.elements.duration.innerHTML = r.durations.map((d) => `<option value="${d}" ${d === prevDur ? 'selected' : ''}>${d} h · ${fmtEur(r.prices[d] * 100)}</option>`).join('');
      $('[data-add-engineer-wrap]').hidden = r.engineer !== 'optional';
      const w = windowFor(add.elements.date.value);
      const dur = Number(add.elements.duration.value) * 60;
      const prevStart = add.elements.start.value;
      const opts = [];
      if (w) for (let m = w.open; m + dur <= w.close; m += 60) opts.push(`<option value="${hm(m)}" ${hm(m) === prevStart ? 'selected' : ''}>${hm(m)} → ${hm(m + dur)}</option>`);
      add.elements.start.innerHTML = opts.join('') || '<option value="">Fermé ce jour-là</option>';
    };
    add.addEventListener('change', (e) => { if (['roomId', 'date', 'duration'].includes(e.target.name)) refreshAdd(); });
    refreshAdd();

    add.addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = add.elements;
      const err = $('[data-add-error]');
      err.hidden = true;
      try {
        const out = await api('/api/admin/bookings', {
          method: 'POST',
          body: {
            roomId: f.roomId.value, date: f.date.value, start: f.start.value, duration: Number(f.duration.value), engineer: f.engineer.checked,
            customer: { name: f.name.value, artist: f.artist.value, email: f.email.value, phone: f.phone.value },
            notes: f.notes.value, paid: f.paid.checked, notify: f.notify.checked,
          },
        });
        toast(`Réservation ${out.ref} enregistrée`);
        for (const k of ['name', 'artist', 'email', 'phone', 'notes']) f[k].value = '';
        f.paid.checked = false;
        await loadOverview();
        weekStart = mondayOf(out.date);
        $('[data-tab="planning"]').click();
      } catch (ex) {
        err.hidden = false;
        err.textContent = ex.message;
      }
    });

    const bf = $('[data-block-form]');
    $('[data-block-allday]').addEventListener('change', (e) => { $$('[data-block-time]').forEach((x) => { x.hidden = e.target.checked; }); });
    bf.addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = bf.elements;
      const err = $('[data-block-error]');
      err.hidden = true;
      try {
        const out = await api('/api/admin/blocks', { method: 'POST', body: { roomId: f.roomId.value, date: f.date.value, allDay: f.allDay.checked, start: f.start.value, end: f.end.value, reason: f.reason.value } });
        f.reason.value = '';
        if (out.conflicts.length) toast(`Créneau bloqué. Attention : ${out.conflicts.length} réservation(s) déjà prise(s) sur cette période (${out.conflicts.join(', ')}).`, 'error');
        else toast('Créneau bloqué');
        loadBlocks();
      } catch (ex) {
        err.hidden = false;
        err.textContent = ex.message;
      }
    });
    $('[data-blocks]').addEventListener('click', async (e) => {
      const b = e.target.closest('[data-del]');
      if (!b) return;
      await api(`/api/admin/blocks/${b.dataset.del}`, { method: 'DELETE' });
      toast('Fermeture supprimée');
      loadBlocks();
    });
  }

  async function loadBlocks() {
    const { blocks } = await api('/api/admin/blocks');
    $('[data-blocks]').innerHTML = blocks.length ? blocks.map((b) => `<li><div><strong>${esc(b.roomName)}</strong><small>${esc(b.startLabel)} → ${esc(b.endLabel)}${b.reason ? ` · ${esc(b.reason)}` : ''}</small></div>
      <button class="btn btn--ghost btn--sm" type="button" data-del="${b.id}">Supprimer</button></li>`).join('') : '<li class="muted">Aucune fermeture prévue.</li>';
  }

  boot().catch((e) => toast(e.message, 'error'));
})();
