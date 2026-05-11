'use strict'

const path      = require('path')
const { app }   = require('electron')

let db = null

function init() {
  const Database = require('better-sqlite3')
  const dbPath   = path.join(app.getPath('userData'), 'zap.db')
  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS wallet (
      id             INTEGER PRIMARY KEY,
      encrypted_seed TEXT NOT NULL,
      salt           TEXT NOT NULL,
      mode           TEXT NOT NULL DEFAULT 'bitcoin',
      created_at     INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS nostr_profile (
      id             INTEGER PRIMARY KEY,
      pubkey         TEXT NOT NULL,
      npub           TEXT NOT NULL,
      encrypted_nsec TEXT,
      name           TEXT,
      about          TEXT,
      picture        TEXT,
      nip05          TEXT,
      created_at     INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS cashu_mints (
      url      TEXT PRIMARY KEY,
      name     TEXT,
      active   INTEGER NOT NULL DEFAULT 1,
      added_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS cashu_proofs (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      mint_url   TEXT    NOT NULL,
      amount     INTEGER NOT NULL,
      secret     TEXT    NOT NULL UNIQUE,
      c          TEXT    NOT NULL,
      keyset_id  TEXT    NOT NULL,
      spent      INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS history (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      url        TEXT    NOT NULL,
      title      TEXT,
      visited_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_history_visited ON history(visited_at DESC);

    CREATE TABLE IF NOT EXISTS favorites (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      title      TEXT    NOT NULL,
      url        TEXT    NOT NULL,
      favicon    TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS nwc_connections (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      name             TEXT    NOT NULL,
      relay_url        TEXT    NOT NULL,
      wallet_pubkey    TEXT    NOT NULL,
      secret           TEXT    NOT NULL DEFAULT '',
      encrypted_secret TEXT,
      active           INTEGER NOT NULL DEFAULT 1,
      created_at       INTEGER NOT NULL
    );
    
    CREATE TABLE IF NOT EXISTS nostr_permissions (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      origin     TEXT    NOT NULL,
      action     TEXT    NOT NULL,
      decision   TEXT    NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      UNIQUE(origin, action)
    );


    CREATE TABLE IF NOT EXISTS privacy_settings (
      id             INTEGER PRIMARY KEY,
      adblock        INTEGER NOT NULL DEFAULT 1,
      webrtc_protect INTEGER NOT NULL DEFAULT 1,
      ua_mode        TEXT    NOT NULL DEFAULT 'rotate',
      custom_ua      TEXT,
      doh_enabled    INTEGER NOT NULL DEFAULT 1,
      doh_provider   TEXT    NOT NULL DEFAULT 'https://cloudflare-dns.com/dns-query'
    );
    INSERT OR IGNORE INTO privacy_settings (id) VALUES (1);
  `)
migrateNwcConnectionsSchema()
}
function migrateNwcConnectionsSchema() {
  const columns = db
    .prepare('PRAGMA table_info(nwc_connections)')
    .all()
    .map(c => c.name)

  if (!columns.includes('encrypted_secret')) {
    db.prepare(
      'ALTER TABLE nwc_connections ADD COLUMN encrypted_secret TEXT'
    ).run()
  }
}
const now = () => Math.floor(Date.now() / 1000)

// ── Settings ──────────────────────────────────────────────────────────────────
function getSetting(key) {
  const row = db.prepare('SELECT value FROM settings WHERE key=?').get(key)
  return row ? row.value : null
}
function setSetting(key, value) {
  db.prepare('INSERT OR REPLACE INTO settings(key,value) VALUES(?,?)').run(key, value)
}

// ── Privacy ───────────────────────────────────────────────────────────────────
function getPrivacy() {
  return db.prepare('SELECT * FROM privacy_settings WHERE id=1').get()
}
function setPrivacy(key, value) {
  db.prepare(`UPDATE privacy_settings SET ${key}=? WHERE id=1`).run(value)
  return getPrivacy()
}

// ── Favorites ─────────────────────────────────────────────────────────────────
function getFavorites() {
  return db.prepare('SELECT * FROM favorites ORDER BY created_at DESC').all()
}
function addFavorite({ title, url, favicon }) {
  const r = db
    .prepare('INSERT INTO favorites(title,url,favicon,created_at) VALUES(?,?,?,?)')
    .run(title, url, favicon || null, now())
  return { id: r.lastInsertRowid, title, url, favicon, created_at: now() }
}
function removeFavorite(id) {
  db.prepare('DELETE FROM favorites WHERE id=?').run(id)
  return { ok: true }
}

// ── Cashu ─────────────────────────────────────────────────────────────────────
function cashuGetBalance() {
  const row = db
    .prepare('SELECT COALESCE(SUM(amount),0) as total FROM cashu_proofs WHERE spent=0')
    .get()
  return row.total
}
function cashuListMints() {
  return db.prepare('SELECT url, name, active FROM cashu_mints').all()
}
function cashuAddMint(url) {
  db.prepare('INSERT OR IGNORE INTO cashu_mints(url,active,added_at) VALUES(?,1,?)').run(url, now())
  return { url, name: null, active: 1 }
}
function cashuRemoveMint(url) {
  db.prepare('DELETE FROM cashu_mints WHERE url=?').run(url)
  return { ok: true }
}

// ── History ───────────────────────────────────────────────────────────────────
function addHistory(url, title) {
  if (!url || url === 'zap://newtab') return
  db.prepare('INSERT INTO history(url,title,visited_at) VALUES(?,?,?)')
    .run(url, title || url, now())
}
function getHistory(limit = 100) {
  return db.prepare('SELECT * FROM history ORDER BY visited_at DESC LIMIT ?').all(limit)
}
function clearHistory() {
  db.prepare('DELETE FROM history').run()
  return { ok: true }
}

// ── Nostr permissions ─────────────────────────────────────────────────────────
function getNostrPermission(origin, action) {
  return db
    .prepare('SELECT decision FROM nostr_permissions WHERE origin=? AND action=?')
    .get(origin, action) || null
}

function setNostrPermission(origin, action, decision) {
  const ts = now()

  db.prepare(`
    INSERT INTO nostr_permissions(origin, action, decision, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(origin, action)
    DO UPDATE SET decision=excluded.decision, updated_at=excluded.updated_at
  `).run(origin, action, decision, ts, ts)

  return { origin, action, decision }
}

function listNostrPermissions() {
  return db
    .prepare('SELECT origin, action, decision, updated_at FROM nostr_permissions ORDER BY updated_at DESC')
    .all()
}

function removeNostrPermission(origin, action) {
  db
    .prepare('DELETE FROM nostr_permissions WHERE origin=? AND action=?')
    .run(origin, action)

  return { ok: true }
}

module.exports = {
  init,
  getSetting, setSetting,
  getPrivacy, setPrivacy,
  getFavorites, addFavorite, removeFavorite,
  addHistory, getHistory, clearHistory,
  cashuGetBalance, cashuListMints, cashuAddMint, cashuRemoveMint,
  getNostrPermission, setNostrPermission, listNostrPermissions, removeNostrPermission,
  _db: () => db,
}
