'use strict';
// Outils de date et d'heure. Les créneaux sont exprimés en « heure murale » du
// studio (Europe/Paris) : un jour = AAAA-MM-JJ, une heure = minutes depuis minuit.
// Pour comparer des créneaux entre jours, on utilise des « minutes absolues »
// locales : jourDepuisEpoch × 1440 + minutes.
const { DAY_KEYS } = require('./config');

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function parseDate(s) {
  const m = DATE_RE.exec(String(s || ''));
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return { y, mo, d };
}

function epochDay(dateStr) {
  const p = parseDate(dateStr);
  if (!p) throw new Error(`date invalide : ${dateStr}`);
  return Date.UTC(p.y, p.mo - 1, p.d) / 86400000;
}

function dateOfDay(day) {
  return new Date(day * 86400000).toISOString().slice(0, 10);
}

function addDays(dateStr, n) {
  return dateOfDay(epochDay(dateStr) + n);
}

function weekdayKey(dateStr) {
  return DAY_KEYS[new Date(epochDay(dateStr) * 86400000).getUTCDay()];
}

function toAbs(dateStr, minutes) {
  return epochDay(dateStr) * 1440 + minutes;
}

function fromAbs(abs) {
  const day = Math.floor(abs / 1440);
  return { date: dateOfDay(day), minutes: abs - day * 1440 };
}

function pad(n) {
  return String(n).padStart(2, '0');
}

function fmtMin(minutes) {
  const m = ((minutes % 1440) + 1440) % 1440;
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
}

function parseHM(s) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(s || ''));
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

const partsCache = new Map();
function partsFormatter(tz) {
  if (!partsCache.has(tz)) {
    partsCache.set(tz, new Intl.DateTimeFormat('en-CA', {
      timeZone: tz, hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
    }));
  }
  return partsCache.get(tz);
}

function zonedParts(ms, tz) {
  const out = {};
  for (const p of partsFormatter(tz).formatToParts(new Date(ms))) out[p.type] = p.value;
  return { y: Number(out.year), mo: Number(out.month), d: Number(out.day), h: Number(out.hour) % 24, mi: Number(out.minute), s: Number(out.second) };
}

// Heure murale actuelle au studio.
function nowLocal(tz, nowMs = Date.now()) {
  const p = zonedParts(nowMs, tz);
  const date = `${p.y}-${pad(p.mo)}-${pad(p.d)}`;
  const minutes = p.h * 60 + p.mi;
  return { date, minutes, abs: toAbs(date, minutes) };
}

function tzOffsetMs(ms, tz) {
  const p = zonedParts(ms, tz);
  return Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s) - Math.floor(ms / 1000) * 1000;
}

// Convertit une heure murale locale (minutes absolues) en instant UTC (ms).
function absToUtcMs(abs, tz) {
  const guess = abs * 60000;
  let utc = guess - tzOffsetMs(guess, tz);
  utc = guess - tzOffsetMs(utc, tz);
  return utc;
}

const longDate = new Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const shortDate = new Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' });

function fmtDateLong(dateStr) {
  return longDate.format(new Date(epochDay(dateStr) * 86400000));
}

function fmtDateShort(dateStr) {
  return shortDate.format(new Date(epochDay(dateStr) * 86400000));
}

module.exports = {
  parseDate, epochDay, dateOfDay, addDays, weekdayKey, toAbs, fromAbs,
  fmtMin, parseHM, nowLocal, absToUtcMs, fmtDateLong, fmtDateShort, pad,
};
