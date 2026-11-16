'use strict';
const T = require('./time');

function icsDate(ms) {
  return new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function esc(s) {
  return String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

// Plie les lignes à 75 octets comme le demande la RFC 5545.
function fold(line) {
  const bytes = Buffer.from(line, 'utf8');
  if (bytes.length <= 75) return line;
  const out = [];
  let cur = '';
  for (const ch of line) {
    if (Buffer.byteLength(cur + ch, 'utf8') > (out.length ? 74 : 75)) { out.push(cur); cur = ''; }
    cur += ch;
  }
  out.push(cur);
  return out.join('\r\n ');
}

function eventTimes(cfg, booking) {
  return {
    startMs: T.absToUtcMs(booking.start_abs, cfg.timezone),
    endMs: T.absToUtcMs(booking.end_abs, cfg.timezone),
  };
}

function address(cfg) {
  const a = cfg.studio.address || {};
  return [a.street, [a.zip, a.city].filter(Boolean).join(' ')].filter(Boolean).join(', ');
}

function buildIcs(cfg, booking, manageUrl) {
  const room = cfg.rooms.find((r) => r.id === booking.room_id);
  const { startMs, endMs } = eventTimes(cfg, booking);
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Phoenix Empire//Reservations//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${booking.ref}@phoenix-empire`,
    `DTSTAMP:${icsDate(Date.now())}`,
    `DTSTART:${icsDate(startMs)}`,
    `DTEND:${icsDate(endMs)}`,
    `SUMMARY:${esc(`Session ${room ? room.name : ''} · ${cfg.studio.name}`)}`,
    `LOCATION:${esc(address(cfg))}`,
    `DESCRIPTION:${esc(`Réservation ${booking.ref}\nGérer ma réservation : ${manageUrl}`)}`,
    `URL:${esc(manageUrl)}`,
    'STATUS:CONFIRMED',
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    'DESCRIPTION:Session au studio',
    'TRIGGER:-PT2H',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.map(fold).join('\r\n') + '\r\n';
}

function googleCalendarUrl(cfg, booking, manageUrl) {
  const room = cfg.rooms.find((r) => r.id === booking.room_id);
  const { startMs, endMs } = eventTimes(cfg, booking);
  const p = new URLSearchParams({
    action: 'TEMPLATE',
    text: `Session ${room ? room.name : ''} · ${cfg.studio.name}`,
    dates: `${icsDate(startMs)}/${icsDate(endMs)}`,
    details: `Réservation ${booking.ref}\n${manageUrl}`,
    location: address(cfg),
  });
  return `https://calendar.google.com/calendar/render?${p}`;
}

module.exports = { buildIcs, googleCalendarUrl, address };
