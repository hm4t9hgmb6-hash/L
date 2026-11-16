/* Phoenix Empire — comportements communs à toutes les pages. */
(() => {
  'use strict';
  const root = document.documentElement;
  root.classList.remove('no-js');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- Outils partagés (utilisés aussi par booking.js, etc.) ----------
  const fmtEur = (cents) => {
    const v = cents / 100;
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: Number.isInteger(v) ? 0 : 2 }).format(v);
  };
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const icon = (name, cls = '') => `<svg class="icon ${cls}" aria-hidden="true"><use href="/assets/img/icons.svg#${name}"/></svg>`;

  async function api(url, options = {}) {
    const opts = { ...options, headers: { Accept: 'application/json', ...(options.headers || {}) } };
    if (opts.body && typeof opts.body !== 'string') {
      opts.body = JSON.stringify(opts.body);
      opts.headers['Content-Type'] = 'application/json';
    }
    let res;
    try {
      res = await fetch(url, opts);
    } catch {
      throw Object.assign(new Error('Connexion impossible. Vérifie ta connexion internet.'), { status: 0 });
    }
    let data = null;
    try { data = await res.json(); } catch { /* corps vide */ }
    if (!res.ok) throw Object.assign(new Error((data && data.error) || 'Une erreur est survenue.'), { status: res.status, data });
    return data;
  }

  let configPromise = null;
  const getConfig = () => (configPromise ||= api('/api/config'));

  // Heure murale du studio (Europe/Paris), quel que soit le fuseau du visiteur.
  function studioNow(tz) {
    const parts = {};
    for (const p of new Intl.DateTimeFormat('en-CA', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(new Date())) parts[p.type] = p.value;
    const date = `${parts.year}-${parts.month}-${parts.day}`;
    return { date, minutes: (Number(parts.hour) % 24) * 60 + Number(parts.minute) };
  }
  const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const dayKey = (date) => DAY_KEYS[new Date(`${date}T12:00:00Z`).getUTCDay()];
  const addDays = (date, n) => new Date(Date.parse(`${date}T12:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
  const hm = (m) => { const x = ((m % 1440) + 1440) % 1440; return `${String(Math.floor(x / 60)).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}`; };
  const shortDate = (date) => new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`));
  const longDate = (date) => new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`));

  function toast(message, type = '') {
    let el = document.querySelector('.toast');
    if (!el) {
      el = document.createElement('div');
      el.className = 'toast';
      el.setAttribute('role', 'status');
      el.setAttribute('aria-live', 'polite');
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.classList.toggle('toast--err', type === 'error');
    el.classList.add('is-on');
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove('is-on'), 4800);
  }

  window.PE = { api, getConfig, fmtEur, esc, icon, studioNow, dayKey, addDays, hm, shortDate, longDate, toast, reduceMotion };

  // ---------- En-tête ----------
  const header = document.querySelector('[data-header]');
  if (header) {
    const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }
  const burger = document.querySelector('[data-burger]');
  const nav = document.querySelector('[data-nav]');
  if (burger && nav) {
    const setOpen = (open) => {
      burger.setAttribute('aria-expanded', String(open));
      burger.setAttribute('aria-label', open ? 'Fermer le menu' : 'Ouvrir le menu');
      nav.classList.toggle('is-open', open);
      document.body.classList.toggle('menu-open', open);
    };
    burger.addEventListener('click', () => setOpen(burger.getAttribute('aria-expanded') !== 'true'));
    nav.addEventListener('click', (e) => { if (e.target.closest('a')) setOpen(false); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setOpen(false); });
  }

  // ---------- Apparition au défilement ----------
  const reveals = document.querySelectorAll('.reveal');
  if (reveals.length) {
    if (reduceMotion || !('IntersectionObserver' in window)) {
      reveals.forEach((el) => el.classList.add('is-in'));
    } else {
      const io = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const el = entry.target;
          const siblings = [...el.parentElement.children].filter((c) => c.classList.contains('reveal'));
          el.style.transitionDelay = `${Math.min(siblings.indexOf(el), 4) * 80}ms`;
          el.classList.add('is-in');
          io.unobserve(el);
        }
      }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
      reveals.forEach((el) => io.observe(el));
    }
  }

  // ---------- Braises du héros ----------
  const canvas = document.querySelector('[data-embers]');
  if (canvas && !reduceMotion) {
    const ctx = canvas.getContext('2d');
    let w = 0; let h = 0; let dpr = 1; let parts = []; let running = true; let raf = 0;
    const spawn = (initial) => ({
      x: Math.random() * w,
      y: initial ? Math.random() * h : h + 10,
      r: 0.6 + Math.random() * 2.2,
      vy: 0.25 + Math.random() * 0.9,
      vx: (Math.random() - 0.5) * 0.3,
      life: 0,
      max: 300 + Math.random() * 500,
      hue: 18 + Math.random() * 26,
      phase: Math.random() * Math.PI * 2,
    });
    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth; h = canvas.clientHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const target = Math.round(Math.min(90, (w * h) / 16000));
      parts = Array.from({ length: target }, () => spawn(true));
    };
    const tick = () => {
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < parts.length; i++) {
        const p = parts[i];
        p.life++;
        p.y -= p.vy;
        p.x += p.vx + Math.sin((p.life / 40) + p.phase) * 0.25;
        const t = p.life / p.max;
        const alpha = Math.max(0, Math.min(1, t * 6) * (1 - t)) * (0.55 + Math.sin(p.life / 6 + p.phase) * 0.25);
        if (t >= 1 || p.y < -10) { parts[i] = spawn(false); continue; }
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 4);
        g.addColorStop(0, `hsla(${p.hue}, 100%, 70%, ${alpha})`);
        g.addColorStop(1, `hsla(${p.hue}, 100%, 50%, 0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * 4, 0, Math.PI * 2);
        ctx.fill();
      }
      if (running) raf = requestAnimationFrame(tick);
    };
    resize();
    window.addEventListener('resize', () => { cancelAnimationFrame(raf); resize(); if (running) raf = requestAnimationFrame(tick); });
    new IntersectionObserver(([entry]) => {
      running = entry.isIntersecting;
      cancelAnimationFrame(raf);
      if (running) raf = requestAnimationFrame(tick);
    }).observe(canvas);
  }

  // ---------- Statut « ouvert maintenant » + horaires du jour ----------
  const status = document.querySelector('[data-open-status]');
  const hoursList = document.querySelector('[data-hours]');
  if (status || hoursList) {
    getConfig().then((cfg) => {
      const now = studioNow(cfg.timezone);
      const today = dayKey(now.date);
      if (hoursList) {
        const li = hoursList.querySelector(`[data-day="${today}"]`);
        if (li) li.classList.add('is-today');
      }
      if (!status) return;
      const win = (date) => (cfg.closures.includes(date) ? null : cfg.hours[dayKey(date)]);
      const yesterday = win(addDays(now.date, -1));
      const t = win(now.date);
      let open = null;
      if (yesterday && yesterday.close > 1440 && now.minutes < yesterday.close - 1440) open = yesterday.close - 1440;
      else if (t && now.minutes >= t.open && now.minutes < t.close) open = t.close;
      const text = status.querySelector('[data-open-text]');
      if (open != null) {
        status.classList.add('is-open');
        text.innerHTML = `<strong>Ouvert maintenant</strong> · jusqu'à ${hm(open)}`;
      } else {
        let label = '';
        if (t && now.minutes < t.open) label = `ouvre aujourd'hui à ${hm(t.open)}`;
        else {
          for (let i = 1; i <= 7; i++) {
            const d = addDays(now.date, i);
            const wv = win(d);
            if (wv) { label = `ouvre ${i === 1 ? 'demain' : longDate(d).split(' ')[0]} à ${hm(wv.open)}`; break; }
          }
        }
        text.textContent = `Fermé · ${label}`;
      }
    }).catch(() => {});
  }

  // ---------- Prochains créneaux libres ----------
  const nextList = document.querySelector('[data-next-list]');
  if (nextList) {
    api('/api/next-slots').then((data) => {
      nextList.innerHTML = data.rooms.map((r) => {
        if (!r.slot) {
          return `<li><a href="/reserver?studio=${esc(r.roomId)}" style="--accent:${esc(r.accent)}"><span class="next-card__dot"></span><span class="next-card__name">${esc(r.name)}</span><span class="next-card__when"><strong>Complet</strong>14 prochains jours</span></a></li>`;
        }
        const day = r.slot.offset === 0 ? "Aujourd'hui" : r.slot.offset === 1 ? 'Demain' : shortDate(r.slot.date);
        const href = `/reserver?studio=${encodeURIComponent(r.roomId)}&date=${r.slot.date}&heure=${r.slot.start}&duree=${r.durationH}`;
        return `<li><a href="${href}" style="--accent:${esc(r.accent)}"><span class="next-card__dot"></span><span class="next-card__name">${esc(r.name)}</span><span class="next-card__when"><strong>${esc(day)} · ${esc(r.slot.start)}</strong>${r.durationH} h · dès ${fmtEur(Math.round(r.fromHourly * 100))}/h</span>${icon('chevron-right')}</a></li>`;
      }).join('');
    }).catch(() => {
      nextList.innerHTML = `<li><a href="/reserver"><span class="next-card__name">Voir toutes les disponibilités</span>${icon('chevron-right')}</a></li>`;
    });
  }
})();
