/* Phoenix Empire — tunnel de réservation. */
(() => {
  'use strict';
  const { api, getConfig, fmtEur, esc, icon, studioNow, addDays, shortDate, longDate, toast } = window.PE;
  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
  const STORE_KEY = 'pe-booking';

  let cfg = null;
  let maxStep = 1;
  let monthData = null;
  let slotsData = null;
  let monthReq = 0;
  let slotsReq = 0;

  const state = {
    step: 1,
    roomId: null,
    duration: null,
    engineer: false,
    month: null,
    date: null,
    start: null,
    extras: {},
    payment: 'deposit',
    customer: { name: '', artist: '', email: '', phone: '' },
    notes: '',
  };

  const room = () => (cfg && cfg.rooms.find((r) => r.id === state.roomId)) || null;
  const euros = (n) => Math.round(Number(n) * 100);

  function save() {
    try { sessionStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch { /* navigation privée */ }
  }
  function restore() {
    try { return JSON.parse(sessionStorage.getItem(STORE_KEY) || 'null'); } catch { return null; }
  }

  // ---------- Prix (affichage ; le serveur recalcule toujours) ----------
  function quote() {
    const r = room();
    if (!r || !state.duration) return null;
    const lines = [{ label: `${r.name} · ${state.duration} h`, cents: euros(r.prices[state.duration]) }];
    if (r.engineer === 'optional' && state.engineer) lines.push({ label: `Ingé son · ${state.duration} h`, cents: euros(cfg.engineer.hourly) * state.duration });
    for (const ex of cfg.extras) {
      const q = state.extras[ex.id] || 0;
      if (q > 0) lines.push({ label: q > 1 ? `${ex.name} × ${q}` : ex.name, cents: euros(ex.price) * q });
    }
    const total = lines.reduce((s, l) => s + l.cents, 0);
    const pct = Number(cfg.payment.depositPercent) || 0;
    const deposit = pct > 0 && pct < 100 ? Math.round((total * pct) / 100) : total;
    let choice = state.payment === 'full' ? 'full' : 'deposit';
    if (deposit === total) choice = 'full';
    if (choice === 'full' && !cfg.payment.allowFullPayment) choice = 'deposit';
    return { lines, total, deposit, due: choice === 'full' ? total : deposit, choice };
  }

  // ---------- Étapes ----------
  function canReach(n) {
    if (n <= 1) return true;
    if (!state.roomId || !state.duration) return false;
    if (n >= 3 && !(state.date && state.start)) return false;
    return true;
  }

  function goTo(n, { focus = true } = {}) {
    if (!canReach(n)) return;
    state.step = n;
    maxStep = Math.max(maxStep, n);
    $$('[data-step]').forEach((s) => { s.hidden = Number(s.dataset.step) !== n; });
    $$('[data-stepper] li').forEach((li, i) => {
      const k = i + 1;
      li.classList.toggle('is-current', k === n);
      li.classList.toggle('is-done', k < n || (k <= maxStep && canReach(k + 1) && k !== n));
      const btn = $('button', li);
      btn.disabled = !canReach(k);
      if (k === n) btn.setAttribute('aria-current', 'step'); else btn.removeAttribute('aria-current');
    });
    if (n === 2) enterStep2();
    if (n === 3) renderExtras();
    if (n === 4) enterStep4();
    updateNav();
    save();
    if (focus) {
      const top = $('[data-stepper]').getBoundingClientRect().top + window.scrollY - 100;
      if (window.scrollY > top) window.scrollTo({ top, behavior: window.PE.reduceMotion ? 'auto' : 'smooth' });
      const title = $(`[data-step="${n}"] .step__title`);
      if (title) title.focus({ preventScroll: true });
    }
  }

  function stepReady(n) {
    if (n === 1) return !!state.roomId;
    if (n === 2) return !!(state.date && state.start);
    return true;
  }

  function updateNav() {
    const cur = $(`[data-step="${state.step}"]`);
    const next = cur && $('[data-next]', cur);
    if (next) next.disabled = !stepReady(state.step);
    const mbtn = $('[data-mbar-next]');
    mbtn.disabled = !stepReady(state.step);
    const q = quote();
    mbtn.textContent = state.step === 4 ? (q ? `Payer ${fmtEur(q.due)}` : 'Payer') : 'Continuer';
    const extrasCount = Object.values(state.extras).reduce((s, v) => s + v, 0);
    const extrasNext = $('[data-extras-next]');
    if (extrasNext) extrasNext.textContent = extrasCount ? 'Continuer' : 'Continuer sans option';
  }

  // ---------- Étape 1 : studio ----------
  function renderRooms() {
    $('[data-rooms]').innerHTML = cfg.rooms.map((r) => {
      const bars = [10, 18, 26, 34, 26, 18, 10].map((h) => `<i style="height:${h}px"></i>`).join('');
      const eng = r.engineer === 'included' ? 'Ingé son inclus' : r.engineer === 'optional' ? 'Avec ou sans ingé' : 'En autonomie';
      return `<button type="button" class="room-option" role="radio" aria-checked="${state.roomId === r.id}" data-room="${esc(r.id)}" style="--accent:${esc(r.accent)}">
        <span class="room-option__swatch" aria-hidden="true">${bars}</span>
        <span><h3>${esc(r.name)}</h3><p>${esc(r.short || r.kind)}</p>
          <span class="room-option__tags"><span>${esc(r.size)}</span><span>${esc(r.capacity)} pers. max</span><span>${eng}</span></span></span>
        <span class="room-option__price"><strong>${fmtEur(Math.round(r.fromHourly * 100))}</strong>/h dès</span>
      </button>`;
    }).join('');
  }

  function selectRoom(id) {
    if (state.roomId === id) return;
    const r = cfg.rooms.find((x) => x.id === id);
    if (!r) return;
    state.roomId = id;
    state.duration = r.durations.includes(state.duration) ? state.duration : (r.durations.find((d) => d >= 2) || r.durations[0]);
    if (r.engineer !== 'optional') state.engineer = false;
    state.start = null;
    monthData = null;
    slotsData = null;
    $$('[data-room]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.room === id)));
    renderSummary();
    updateNav();
    save();
  }

  // ---------- Étape 2 : créneau ----------
  function enterStep2() {
    const r = room();
    $('[data-room-hint]').textContent = `${r.name} · ${r.kind}`;
    $('[data-durations]').innerHTML = r.durations.map((d) => {
      const price = r.prices[d];
      const per = price / d;
      return `<button type="button" class="opt" role="radio" aria-checked="${state.duration === d}" data-duration="${d}">
        <strong>${d} h</strong><span>${fmtEur(euros(price))}${d > 1 ? ` · ${fmtEur(euros(per))}/h` : ''}</span></button>`;
    }).join('');
    $('[data-engineer-block]').hidden = r.engineer !== 'optional';
    $('[data-engineer-included]').hidden = r.engineer !== 'included';
    $('[data-engineer]').checked = !!state.engineer;
    $('[data-engineer-price]').textContent = `+${fmtEur(euros(cfg.engineer.hourly))}/h · il prépare la session, enregistre et t'accompagne`;
    if (!state.month) {
      const base = state.date || studioNow(cfg.timezone).date;
      state.month = base.slice(0, 7);
    }
    loadMonth();
    if (state.date) loadSlots();
  }

  function engineerParam() {
    const r = room();
    return r.engineer === 'optional' && state.engineer ? '1' : '0';
  }

  async function loadMonth() {
    const id = ++monthReq;
    const cal = $('[data-cal]');
    cal.classList.add('is-loading');
    renderCalendar();
    try {
      const data = await api(`/api/availability?room=${encodeURIComponent(state.roomId)}&month=${state.month}&duration=${state.duration}&engineer=${engineerParam()}`);
      if (id !== monthReq) return;
      monthData = data;
      renderCalendar();
    } catch (e) {
      if (id === monthReq) toast(e.message, 'error');
    } finally {
      if (id === monthReq) cal.classList.remove('is-loading');
    }
  }

  function renderCalendar() {
    const [y, m] = state.month.split('-').map(Number);
    const first = new Date(Date.UTC(y, m - 1, 1));
    const label = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(first);
    $('[data-cal-month]').textContent = label;
    const today = monthData ? monthData.today : studioNow(cfg.timezone).date;
    const lastDate = monthData ? monthData.lastDate : addDays(today, cfg.booking.maxAdvanceDays);
    $('[data-cal-prev]').disabled = state.month <= today.slice(0, 7);
    $('[data-cal-next]').disabled = state.month >= lastDate.slice(0, 7);

    const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const offset = (first.getUTCDay() + 6) % 7; // lundi en premier
    const dows = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
    let html = dows.map((d) => `<span class="cal__dow" aria-hidden="true">${d}</span>`).join('');
    for (let i = 0; i < offset; i++) html += '<span class="cal__day is-empty" aria-hidden="true"></span>';
    for (let d = 1; d <= days; d++) {
      const date = `${state.month}-${String(d).padStart(2, '0')}`;
      const info = monthData && monthData.month === state.month ? monthData.days[date] : null;
      const past = date < today || date > lastDate;
      const free = info ? info.free : 0;
      const disabled = past || !info || !info.open || free === 0;
      const cls = ['cal__day'];
      if (date === today) cls.push('is-today');
      if (!disabled) cls.push(free <= 2 ? 'is-low' : 'is-high');
      const aria = `${longDate(date)}${disabled ? (info && !info.open ? ', fermé' : ', complet') : `, ${free} départ${free > 1 ? 's' : ''} possible${free > 1 ? 's' : ''}`}`;
      html += `<button type="button" class="${cls.join(' ')}" data-date="${date}" aria-pressed="${state.date === date}" aria-label="${esc(aria)}" ${disabled ? 'disabled' : ''}>${d}</button>`;
    }
    $('[data-cal-grid]').innerHTML = html;
  }

  function shiftMonth(delta) {
    const [y, m] = state.month.split('-').map(Number);
    const d = new Date(Date.UTC(y, m - 1 + delta, 1));
    state.month = d.toISOString().slice(0, 7);
    monthData = null;
    loadMonth();
    save();
  }

  async function loadSlots() {
    const id = ++slotsReq;
    const block = $('[data-slots-block]');
    block.hidden = false;
    $('[data-slots-label]').textContent = `Heure de début · ${longDate(state.date)}`;
    $('[data-slots]').innerHTML = '<div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div>';
    try {
      const data = await api(`/api/slots?room=${encodeURIComponent(state.roomId)}&date=${state.date}&duration=${state.duration}&engineer=${engineerParam()}`);
      if (id !== slotsReq) return;
      slotsData = data;
      if (state.start && !data.slots.some((s) => s.start === state.start && s.available)) {
        state.start = null;
        renderSummary();
      }
      renderSlots();
      updateNav();
    } catch (e) {
      if (id === slotsReq) $('[data-slots]').innerHTML = `<p class="empty">${esc(e.message)}</p>`;
    }
  }

  function renderSlots() {
    const list = slotsData ? slotsData.slots : [];
    const el = $('[data-slots]');
    if (!list.some((s) => s.available)) {
      el.innerHTML = '<p class="empty" style="grid-column:1/-1">Plus aucun créneau libre ce jour-là pour cette durée. Essaie un autre jour ou une durée plus courte.</p>';
      return;
    }
    const group = (min) => (min >= 1440 ? 'Nuit' : min >= 1080 ? 'Soirée' : min >= 720 ? 'Après-midi' : 'Matin');
    let html = '';
    let last = '';
    for (const s of list) {
      const g = group(s.startMin);
      if (g !== last) { html += `<p class="slots__group">${g}</p>`; last = g; }
      html += `<button type="button" class="slot" data-start="${s.start}" aria-pressed="${state.start === s.start}" ${s.available ? '' : 'disabled aria-label="' + s.start + ', indisponible"'}>${s.start}<small>→ ${s.end}</small></button>`;
    }
    el.innerHTML = html;
  }

  // ---------- Étape 3 : options ----------
  function renderExtras() {
    const el = $('[data-extras]');
    if (!cfg.extras.length) { el.innerHTML = '<p class="empty">Aucune option disponible pour le moment.</p>'; return; }
    el.innerHTML = cfg.extras.map((ex) => {
      const q = state.extras[ex.id] || 0;
      return `<div class="extra-pick ${q ? 'is-on' : ''}" data-extra="${esc(ex.id)}">
        <div><h3>${esc(ex.name)}</h3><p>${esc(ex.description || '')}</p><p class="extra-pick__price">${fmtEur(euros(ex.price))} <span class="muted">/ ${esc(ex.unit || 'unité')}</span></p></div>
        <div class="stepper-qty" role="group" aria-label="Quantité : ${esc(ex.name)}">
          <button type="button" data-qty="-1" aria-label="Retirer" ${q <= 0 ? 'disabled' : ''}>${icon('minus')}</button>
          <output aria-live="polite">${q}</output>
          <button type="button" data-qty="1" aria-label="Ajouter" ${q >= ex.max ? 'disabled' : ''}>${icon('plus')}</button>
        </div>
      </div>`;
    }).join('');
  }

  // ---------- Étape 4 : coordonnées et paiement ----------
  function enterStep4() {
    const form = $('[data-form]');
    for (const k of ['name', 'artist', 'email', 'phone']) form.elements[k].value = state.customer[k] || '';
    form.elements.notes.value = state.notes || '';
    renderPayOptions();
    $('[data-demo-notice]').hidden = cfg.payment.provider !== 'demo';
  }

  function renderPayOptions() {
    const q = quote();
    if (!q) return;
    const opts = [];
    if (q.deposit < q.total) {
      opts.push({ id: 'deposit', title: `Acompte de ${cfg.payment.depositPercent} %`, sub: `Le reste (${fmtEur(q.total - q.deposit)}) se règle au studio`, amount: q.deposit });
      if (cfg.payment.allowFullPayment) opts.push({ id: 'full', title: 'Payer la totalité', sub: 'Rien à régler sur place', amount: q.total });
    } else {
      opts.push({ id: 'full', title: 'Paiement de la session', sub: 'Rien à régler sur place', amount: q.total });
    }
    $('[data-pay-options]').innerHTML = opts.map((o) => `<button type="button" class="pay-option" role="radio" aria-checked="${q.choice === o.id}" data-pay="${o.id}"><span><strong>${o.title}</strong><small>${esc(o.sub)}</small></span><b>${fmtEur(o.amount)}</b></button>`).join('');
    $('[data-submit-label]').textContent = `Payer ${fmtEur(q.due)}`;
  }

  function showFormError(msg) {
    const box = $('[data-form-error]');
    box.hidden = !msg;
    $('[data-form-error-text]').textContent = msg || '';
    if (msg) box.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  function validateForm(form) {
    const c = state.customer;
    const checks = [
      ['name', c.name.trim().length >= 2, 'Indique ton nom.'],
      ['email', /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(c.email.trim()), 'Adresse e-mail invalide.'],
      ['phone', c.phone.replace(/\D/g, '').length >= 8, 'Numéro de téléphone invalide.'],
    ];
    for (const [name, ok] of checks) form.elements[name].setAttribute('aria-invalid', String(!ok));
    const bad = checks.find(([, ok]) => !ok);
    if (bad) { form.elements[bad[0]].focus(); return bad[2]; }
    if (!form.elements.terms.checked) return 'Merci d\'accepter les conditions générales de vente.';
    return null;
  }

  async function submit() {
    const form = $('[data-form]');
    const err = validateForm(form);
    if (err) { showFormError(err); return; }
    showFormError('');
    const btn = $('[data-submit]');
    btn.classList.add('is-loading');
    $('[data-mbar-next]').classList.add('is-loading');
    try {
      const q = quote();
      const res = await api('/api/bookings', {
        method: 'POST',
        body: {
          roomId: state.roomId,
          date: state.date,
          start: state.start,
          duration: state.duration,
          engineer: state.engineer,
          extras: Object.entries(state.extras).filter(([, v]) => v > 0).map(([id, qty]) => ({ id, qty })),
          customer: state.customer,
          notes: state.notes,
          payment: q.choice,
          acceptTerms: true,
        },
      });
      save();
      window.location.href = res.redirectUrl;
    } catch (e) {
      btn.classList.remove('is-loading');
      $('[data-mbar-next]').classList.remove('is-loading');
      if (e.status === 409) {
        state.start = null;
        toast(e.message, 'error');
        goTo(2);
        loadMonth();
        loadSlots();
        renderSummary();
      } else {
        showFormError(e.message);
      }
    }
  }

  // ---------- Récapitulatif ----------
  function renderSummary() {
    const r = room();
    const summary = $('[data-summary]');
    summary.style.setProperty('--accent', r ? r.accent : '#ff5b1f');
    $('[data-sum-room]').textContent = r ? r.name : 'Choisis un studio';
    const rows = [];
    const row = (k, v) => rows.push(`<li class="${v ? '' : 'is-empty'}"><span>${esc(k)}</span><span>${esc(v || 'À choisir')}</span></li>`);
    if (r) {
      row('Date', state.date ? longDate(state.date).replace(/^./, (c) => c.toUpperCase()) : '');
      if (state.start && slotsData) {
        const s = slotsData.slots.find((x) => x.start === state.start);
        row('Horaire', s ? `${s.start} → ${s.end}` : state.start);
      } else row('Horaire', state.start || '');
      row('Durée', state.duration ? `${state.duration} h` : '');
      if (r.engineer === 'included') row('Ingé son', 'Inclus');
      else if (r.engineer === 'optional') row('Ingé son', state.engineer ? `Oui · +${fmtEur(euros(cfg.engineer.hourly) * state.duration)}` : 'Non');
      for (const ex of cfg.extras) {
        const q = state.extras[ex.id] || 0;
        if (q) row(q > 1 ? `${ex.name} × ${q}` : ex.name, fmtEur(euros(ex.price) * q));
      }
    }
    $('[data-sum-rows]').innerHTML = rows.join('');
    const q = quote();
    $('[data-sum-total]').textContent = q ? fmtEur(q.total) : '—';
    $('[data-mbar-total]').textContent = q ? fmtEur(q.total) : '—';
    $('[data-sum-deposit]').textContent = q && q.deposit < q.total
      ? (q.choice === 'full' ? 'Tout est réglé en ligne.' : `Aujourd'hui : ${fmtEur(q.deposit)} d'acompte · Sur place : ${fmtEur(q.total - q.deposit)}`)
      : '';
    if (state.step === 4) renderPayOptions();
    updateNav();
  }

  // ---------- Événements ----------
  function bind() {
    $('[data-rooms]').addEventListener('click', (e) => {
      const b = e.target.closest('[data-room]');
      if (b) selectRoom(b.dataset.room);
    });
    $('[data-rooms]').addEventListener('dblclick', (e) => { if (e.target.closest('[data-room]')) goTo(2); });

    $('[data-durations]').addEventListener('click', (e) => {
      const b = e.target.closest('[data-duration]');
      if (!b) return;
      state.duration = Number(b.dataset.duration);
      $$('[data-duration]').forEach((x) => x.setAttribute('aria-checked', String(x === b)));
      loadMonth();
      if (state.date) loadSlots();
      renderSummary();
      save();
    });

    $('[data-engineer]').addEventListener('change', (e) => {
      state.engineer = e.target.checked;
      loadMonth();
      if (state.date) loadSlots();
      renderSummary();
      save();
    });

    $('[data-cal-prev]').addEventListener('click', () => shiftMonth(-1));
    $('[data-cal-next]').addEventListener('click', () => shiftMonth(1));
    $('[data-cal-grid]').addEventListener('click', (e) => {
      const b = e.target.closest('[data-date]');
      if (!b || b.disabled) return;
      state.date = b.dataset.date;
      state.start = null;
      $$('[data-date]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      loadSlots();
      renderSummary();
      save();
      if (window.innerWidth < 1020) setTimeout(() => $('[data-slots-block]').scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
    });

    $('[data-slots]').addEventListener('click', (e) => {
      const b = e.target.closest('[data-start]');
      if (!b || b.disabled) return;
      state.start = b.dataset.start;
      $$('[data-start]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      renderSummary();
      save();
    });

    $('[data-extras]').addEventListener('click', (e) => {
      const b = e.target.closest('[data-qty]');
      if (!b) return;
      const id = b.closest('[data-extra]').dataset.extra;
      const ex = cfg.extras.find((x) => x.id === id);
      state.extras[id] = Math.max(0, Math.min(ex.max, (state.extras[id] || 0) + Number(b.dataset.qty)));
      renderExtras();
      renderSummary();
      save();
    });

    $('[data-pay-options]').addEventListener('click', (e) => {
      const b = e.target.closest('[data-pay]');
      if (!b) return;
      state.payment = b.dataset.pay;
      renderSummary();
      save();
    });

    const form = $('[data-form]');
    form.addEventListener('input', (e) => {
      const t = e.target;
      if (t.name in state.customer) state.customer[t.name] = t.value;
      if (t.name === 'notes') state.notes = t.value;
      if (t.getAttribute('aria-invalid') === 'true') t.removeAttribute('aria-invalid');
      save();
    });
    form.addEventListener('submit', (e) => { e.preventDefault(); submit(); });

    $$('[data-next]').forEach((b) => b.addEventListener('click', () => goTo(state.step + 1)));
    $$('[data-prev]').forEach((b) => b.addEventListener('click', () => goTo(state.step - 1)));
    $('[data-stepper]').addEventListener('click', (e) => {
      const b = e.target.closest('[data-goto]');
      if (b && !b.disabled) goTo(Number(b.dataset.goto));
    });
    $('[data-mbar-next]').addEventListener('click', () => {
      if (state.step === 4) $('[data-form]').requestSubmit();
      else goTo(state.step + 1);
    });
  }

  // ---------- Démarrage ----------
  async function init() {
    try {
      cfg = await getConfig();
    } catch (e) {
      $('[data-rooms]').innerHTML = `<p class="empty">${esc(e.message)}</p>`;
      return;
    }
    const params = new URLSearchParams(location.search);
    const cancelled = params.get('annule');
    const saved = restore();

    if (cancelled && params.get('t')) {
      // Retour depuis la page de paiement : on libère le créneau tout de suite.
      try { await api(`/api/bookings/${encodeURIComponent(cancelled)}/cancel`, { method: 'POST', body: { t: params.get('t') } }); } catch { /* déjà libéré */ }
      $('[data-flash]').innerHTML = `<div class="notice notice--warn" style="margin-top:28px"><svg class="icon" aria-hidden="true"><use href="/assets/img/icons.svg#refresh"/></svg><div><strong>Paiement annulé</strong><p>Aucun montant n'a été débité et ton créneau a été libéré. Tes choix sont conservés : tu peux reprendre où tu en étais.</p></div></div>`;
      history.replaceState(null, '', '/reserver');
    }

    if (saved && (cancelled || !params.has('studio'))) Object.assign(state, saved, { step: 1 });
    if (params.has('studio')) {
      state.roomId = null;
      selectRoomSilently(params.get('studio'));
      const d = params.get('date');
      const h = params.get('heure');
      const du = Number(params.get('duree'));
      const r = room();
      if (r && du && r.durations.includes(du)) state.duration = du;
      if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) { state.date = d; state.month = d.slice(0, 7); }
      if (h && /^\d{2}:\d{2}$/.test(h)) state.start = h;
      history.replaceState(null, '', '/reserver');
    }
    if (!room()) Object.assign(state, { roomId: null, duration: null, date: null, start: null });
    if (state.date && state.date < studioNow(cfg.timezone).date) { state.date = null; state.start = null; }

    renderRooms();
    renderSummary();
    bind();

    let target = 1;
    if (room()) target = 2;
    if (room() && state.date && state.start) {
      // On revérifie que le créneau mémorisé est toujours libre.
      try {
        const data = await api(`/api/slots?room=${encodeURIComponent(state.roomId)}&date=${state.date}&duration=${state.duration}&engineer=${engineerParam()}`);
        slotsData = data;
        if (data.slots.some((s) => s.start === state.start && s.available)) target = cancelled ? 4 : 2;
        else state.start = null;
      } catch { state.start = null; }
    }
    maxStep = target;
    renderSummary();
    goTo(target, { focus: false });
  }

  function selectRoomSilently(id) {
    const r = cfg.rooms.find((x) => x.id === id);
    if (!r) return;
    state.roomId = id;
    state.duration = r.durations.find((d) => d >= 2) || r.durations[0];
    if (r.engineer !== 'optional') state.engineer = false;
  }

  init();
})();
