'use strict';
// Stockage SQLite (module intégré à Node, aucune dépendance native).
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS bookings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ref TEXT NOT NULL UNIQUE,
  token TEXT NOT NULL,
  room_id TEXT NOT NULL,
  date TEXT NOT NULL,
  start_min INTEGER NOT NULL,
  duration_min INTEGER NOT NULL,
  start_abs INTEGER NOT NULL,
  end_abs INTEGER NOT NULL,
  with_engineer INTEGER NOT NULL DEFAULT 0,
  extras TEXT NOT NULL DEFAULT '[]',
  customer_name TEXT NOT NULL DEFAULT '',
  customer_email TEXT NOT NULL DEFAULT '',
  customer_phone TEXT NOT NULL DEFAULT '',
  artist_name TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  total_cents INTEGER NOT NULL DEFAULT 0,
  due_cents INTEGER NOT NULL DEFAULT 0,
  paid_cents INTEGER NOT NULL DEFAULT 0,
  refunded_cents INTEGER NOT NULL DEFAULT 0,
  payment_choice TEXT NOT NULL DEFAULT 'deposit',
  status TEXT NOT NULL DEFAULT 'pending',
  hold_expires_at INTEGER,
  stripe_session_id TEXT,
  stripe_payment_intent TEXT,
  source TEXT NOT NULL DEFAULT 'web',
  cancel_reason TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  confirmed_at INTEGER,
  cancelled_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_bookings_range ON bookings (start_abs, end_abs);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings (status);
CREATE INDEX IF NOT EXISTS idx_bookings_session ON bookings (stripe_session_id);

CREATE TABLE IF NOT EXISTS blocks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id TEXT,
  start_abs INTEGER NOT NULL,
  end_abs INTEGER NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_blocks_range ON blocks (start_abs, end_abs);
`;

const REF_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function newRef() {
  let s = '';
  for (let i = 0; i < 6; i++) s += REF_ALPHABET[crypto.randomInt(REF_ALPHABET.length)];
  return `PE-${s}`;
}

function newToken() {
  return crypto.randomBytes(24).toString('base64url');
}

function hydrate(row) {
  if (!row) return null;
  return { ...row, with_engineer: !!row.with_engineer, extras: JSON.parse(row.extras || '[]') };
}

function openDb(file) {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000; PRAGMA foreign_keys = ON;');
  db.exec(SCHEMA);

  const st = {
    insert: db.prepare(`INSERT INTO bookings
      (ref, token, room_id, date, start_min, duration_min, start_abs, end_abs, with_engineer, extras,
       customer_name, customer_email, customer_phone, artist_name, notes,
       total_cents, due_cents, paid_cents, payment_choice, status, hold_expires_at, source,
       created_at, updated_at, confirmed_at)
      VALUES (:ref, :token, :room_id, :date, :start_min, :duration_min, :start_abs, :end_abs, :with_engineer, :extras,
       :customer_name, :customer_email, :customer_phone, :artist_name, :notes,
       :total_cents, :due_cents, :paid_cents, :payment_choice, :status, :hold_expires_at, :source,
       :now, :now, :confirmed_at)`),
    byId: db.prepare('SELECT * FROM bookings WHERE id = ?'),
    byRef: db.prepare('SELECT * FROM bookings WHERE ref = ?'),
    bySession: db.prepare('SELECT * FROM bookings WHERE stripe_session_id = ?'),
    refExists: db.prepare('SELECT 1 FROM bookings WHERE ref = ?'),
    active: db.prepare(`SELECT * FROM bookings
      WHERE end_abs > :from AND start_abs < :to
        AND (status = 'confirmed' OR (status = 'pending' AND hold_expires_at > :now))`),
    blocks: db.prepare('SELECT * FROM blocks WHERE end_abs > :from AND start_abs < :to ORDER BY start_abs'),
    expireHolds: db.prepare(`UPDATE bookings SET status = 'expired', updated_at = :now
      WHERE status = 'pending' AND hold_expires_at <= :now`),
  };

  const api = {
    raw: db,

    transaction(fn) {
      db.exec('BEGIN IMMEDIATE');
      try {
        const out = fn();
        db.exec('COMMIT');
        return out;
      } catch (err) {
        db.exec('ROLLBACK');
        throw err;
      }
    },

    createBooking(b) {
      let ref = newRef();
      while (st.refExists.get(ref)) ref = newRef();
      const now = Date.now();
      const row = {
        ref,
        token: newToken(),
        room_id: b.room_id,
        date: b.date,
        start_min: b.start_min,
        duration_min: b.duration_min,
        start_abs: b.start_abs,
        end_abs: b.end_abs,
        with_engineer: b.with_engineer ? 1 : 0,
        extras: JSON.stringify(b.extras || []),
        customer_name: b.customer_name || '',
        customer_email: b.customer_email || '',
        customer_phone: b.customer_phone || '',
        artist_name: b.artist_name || '',
        notes: b.notes || '',
        total_cents: b.total_cents || 0,
        due_cents: b.due_cents || 0,
        paid_cents: b.paid_cents || 0,
        payment_choice: b.payment_choice || 'deposit',
        status: b.status || 'pending',
        hold_expires_at: b.hold_expires_at ?? null,
        source: b.source || 'web',
        now,
        confirmed_at: b.status === 'confirmed' ? now : null,
      };
      const { lastInsertRowid } = st.insert.run(row);
      return api.getById(Number(lastInsertRowid));
    },

    getById: (id) => hydrate(st.byId.get(id)),
    getByRef: (ref) => hydrate(st.byRef.get(String(ref || '').toUpperCase())),
    getBySession: (sid) => hydrate(st.bySession.get(sid)),

    update(id, fields) {
      const keys = Object.keys(fields);
      if (!keys.length) return api.getById(id);
      const sets = keys.map((k) => `${k} = :${k}`).join(', ');
      const params = { id, updated_at: Date.now() };
      for (const k of keys) {
        const v = fields[k];
        params[k] = typeof v === 'boolean' ? (v ? 1 : 0) : (v === undefined ? null : v);
      }
      db.prepare(`UPDATE bookings SET ${sets}, updated_at = :updated_at WHERE id = :id`).run(params);
      return api.getById(id);
    },

    activeBookings(fromAbs, toAbs, nowMs = Date.now()) {
      return st.active.all({ from: fromAbs, to: toAbs, now: nowMs }).map(hydrate);
    },

    blocks(fromAbs, toAbs) {
      return st.blocks.all({ from: fromAbs, to: toAbs });
    },

    addBlock({ room_id, start_abs, end_abs, reason }) {
      const r = db.prepare('INSERT INTO blocks (room_id, start_abs, end_abs, reason, created_at) VALUES (?, ?, ?, ?, ?)')
        .run(room_id || null, start_abs, end_abs, reason || '', Date.now());
      return db.prepare('SELECT * FROM blocks WHERE id = ?').get(Number(r.lastInsertRowid));
    },

    deleteBlock(id) {
      return db.prepare('DELETE FROM blocks WHERE id = ?').run(id).changes > 0;
    },

    expireHolds(nowMs = Date.now()) {
      return st.expireHolds.run({ now: nowMs }).changes;
    },

    listBookings({ fromAbs, toAbs, status, q, limit = 500 } = {}) {
      const where = [];
      const params = {};
      if (fromAbs != null) { where.push('end_abs > :from'); params.from = fromAbs; }
      if (toAbs != null) { where.push('start_abs < :to'); params.to = toAbs; }
      if (status && status !== 'all') {
        const list = String(status).split(',').filter((s) => /^[a-z]+$/.test(s));
        if (list.length) where.push(`status IN (${list.map((s) => `'${s}'`).join(',')})`);
      }
      if (q) {
        where.push('(ref LIKE :q OR customer_name LIKE :q OR customer_email LIKE :q OR artist_name LIKE :q OR customer_phone LIKE :q)');
        params.q = `%${q}%`;
      }
      const sql = `SELECT * FROM bookings ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY start_abs ASC LIMIT ${Math.min(Number(limit) || 500, 2000)}`;
      return db.prepare(sql).all(params).map(hydrate);
    },

    stats(nowMs, fromAbs, toAbs) {
      return db.prepare(`SELECT
          COUNT(*) AS count,
          COALESCE(SUM(total_cents), 0) AS total_cents,
          COALESCE(SUM(paid_cents - refunded_cents), 0) AS cashed_cents,
          COALESCE(SUM(duration_min), 0) AS minutes
        FROM bookings WHERE status = 'confirmed' AND start_abs >= :from AND start_abs < :to`)
        .get({ from: fromAbs, to: toAbs });
    },

    close() { db.close(); },
  };
  return api;
}

module.exports = { openDb };
