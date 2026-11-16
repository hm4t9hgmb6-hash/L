'use strict';
// Calcul des créneaux disponibles. Une réservation « bloque » son studio dès
// qu'elle est confirmée, ou pendant la durée de paiement si elle est en attente.
const T = require('./time');

function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && aEnd > bStart;
}

// Nombre maximal de réservations simultanées sur l'intervalle [start, end).
function maxConcurrency(intervals, start, end) {
  const events = [];
  for (const it of intervals) {
    const s = Math.max(it.start_abs, start);
    const e = Math.min(it.end_abs, end);
    if (s < e) { events.push([s, 1]); events.push([e, -1]); }
  }
  events.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let cur = 0;
  let max = 0;
  for (const [, delta] of events) { cur += delta; if (cur > max) max = cur; }
  return max;
}

function createAvailability(cfg, db) {
  const roomsById = new Map(cfg.rooms.map((r) => [r.id, r]));
  const closures = new Set(cfg.closures);

  function room(id) {
    return roomsById.get(id) || null;
  }

  // Fenêtre d'ouverture d'un jour, en minutes depuis minuit (fermeture possible après 24:00).
  function openingWindow(date) {
    if (!T.parseDate(date) || closures.has(date)) return null;
    return cfg.openingMinutes[T.weekdayKey(date)] || null;
  }

  function needsEngineer(r, engineer) {
    if (!r) return false;
    if (r.engineer === 'included') return true;
    if (r.engineer === 'optional') return !!engineer;
    return false;
  }

  function bounds(nowMs) {
    const now = T.nowLocal(cfg.timezone, nowMs);
    const earliestAbs = now.abs + Math.round(cfg.booking.minNoticeHours * 60);
    const lastDate = T.addDays(now.date, cfg.booking.maxAdvanceDays);
    return { now, earliestAbs, lastDate };
  }

  // Charge une seule fois tout ce qui peut entrer en conflit sur une plage.
  function loadContext(fromAbs, toAbs, nowMs, excludeId) {
    const buffer = cfg.booking.bufferMinutes;
    const bookings = db.activeBookings(fromAbs - buffer, toAbs + buffer, nowMs)
      .filter((b) => b.id !== excludeId);
    const blocks = db.blocks(fromAbs, toAbs);
    return { bookings, blocks };
  }

  function evaluate(ctx, r, startAbs, endAbs, engineer, b) {
    if (startAbs < b.earliestAbs) return 'passé';
    const buffer = cfg.booking.bufferMinutes;
    for (const bl of ctx.blocks) {
      if ((bl.room_id == null || bl.room_id === r.id) && overlaps(startAbs, endAbs, bl.start_abs, bl.end_abs)) return 'fermé';
    }
    for (const bk of ctx.bookings) {
      if (bk.room_id === r.id && overlaps(startAbs - buffer, endAbs + buffer, bk.start_abs, bk.end_abs)) return 'réservé';
    }
    if (needsEngineer(r, engineer)) {
      const eng = ctx.bookings.filter((bk) => bk.with_engineer);
      if (maxConcurrency(eng, startAbs, endAbs) >= cfg.engineer.count) return 'ingé indisponible';
    }
    return null;
  }

  // Liste des heures de début possibles pour un jour donné.
  function slotsFor({ roomId, date, durationH, engineer, nowMs = Date.now(), excludeId = null, ctx = null }) {
    const r = room(roomId);
    if (!r) return [];
    const win = openingWindow(date);
    if (!win) return [];
    const b = bounds(nowMs);
    if (date > b.lastDate) return [];
    const dur = Math.round(durationH * 60);
    const step = cfg.booking.slotStepMinutes;
    const dayAbs = T.toAbs(date, 0);
    const context = ctx || loadContext(dayAbs + win.open, dayAbs + win.close, nowMs, excludeId);
    const out = [];
    for (let s = win.open; s + dur <= win.close; s += step) {
      const startAbs = dayAbs + s;
      const reason = evaluate(context, r, startAbs, startAbs + dur, engineer, b);
      out.push({ start: T.fmtMin(s), startMin: s, end: T.fmtMin(s + dur), available: !reason, reason: reason || undefined });
    }
    return out;
  }

  // Vérification finale avant d'enregistrer une réservation.
  function check({ roomId, date, startMin, durationH, engineer, nowMs = Date.now(), excludeId = null, ignoreNotice = false }) {
    const r = room(roomId);
    if (!r) return { ok: false, error: 'Studio inconnu.' };
    if (!r.durations.includes(Number(durationH))) return { ok: false, error: 'Durée non proposée pour ce studio.' };
    const win = openingWindow(date);
    if (!win) return { ok: false, error: 'Le studio est fermé ce jour-là.' };
    const dur = Math.round(durationH * 60);
    if (startMin < win.open || startMin + dur > win.close) return { ok: false, error: 'Ce créneau dépasse les horaires d\'ouverture.' };
    if ((startMin - win.open) % cfg.booking.slotStepMinutes !== 0) return { ok: false, error: 'Heure de début invalide.' };
    const b = bounds(nowMs);
    if (ignoreNotice) b.earliestAbs = -Infinity;
    else if (date > b.lastDate) return { ok: false, error: 'Cette date est trop éloignée pour réserver en ligne.' };
    const startAbs = T.toAbs(date, startMin);
    const endAbs = startAbs + dur;
    const ctx = loadContext(startAbs, endAbs, nowMs, excludeId);
    const reason = evaluate(ctx, r, startAbs, endAbs, engineer, b);
    if (reason === 'passé') return { ok: false, error: 'Ce créneau n\'est plus réservable en ligne.' };
    if (reason) return { ok: false, error: 'Ce créneau vient d\'être réservé. Choisis-en un autre.', taken: true };
    return { ok: true, startAbs, endAbs, room: r, withEngineer: needsEngineer(r, engineer) };
  }

  // Résumé d'un mois pour le calendrier : nombre de départs possibles par jour.
  function monthSummary({ roomId, month, durationH, engineer, nowMs = Date.now() }) {
    const r = room(roomId);
    const m = /^(\d{4})-(\d{2})$/.exec(String(month || ''));
    if (!r || !m) return null;
    const first = `${m[1]}-${m[2]}-01`;
    if (!T.parseDate(first)) return null;
    const days = {};
    const firstDay = T.epochDay(first);
    const nextMonth = new Date(Date.UTC(Number(m[1]), Number(m[2]), 1)).getTime() / 86400000;
    const ctx = loadContext(firstDay * 1440, (nextMonth + 1) * 1440, nowMs, null);
    for (let d = firstDay; d < nextMonth; d++) {
      const date = T.dateOfDay(d);
      const win = openingWindow(date);
      if (!win) { days[date] = { open: false, free: 0 }; continue; }
      const slots = slotsFor({ roomId, date, durationH, engineer, nowMs, ctx });
      days[date] = { open: true, free: slots.filter((s) => s.available).length };
    }
    const b = bounds(nowMs);
    return { month: `${m[1]}-${m[2]}`, today: b.now.date, lastDate: b.lastDate, days };
  }

  return { room, openingWindow, needsEngineer, slotsFor, check, monthSummary };
}

module.exports = { createAvailability, maxConcurrency, overlaps };
