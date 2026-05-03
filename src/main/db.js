// src/main/db.js
'use strict'

const path = require('path')
const { app } = require('electron')
let db = null

function init() {
  const Database = require('better-sqlite3')
  const dbPath = path.join(app.getPath('userData'), 'zap.db')
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
      mint_url   TEXT NOT NULL,
      amount     INTEGER NOT NULL,
      secret     TEXT NOT NULL UNIQUE,
      c          TEXT NOT NULL,
      keyset_id  TEXT NOT NULL,
      spent      INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS favorites (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      title      TEXT NOT NULL,
      url        TEXT NOT NULL,
      favicon    TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS nwc_connections (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      name          TEXT NOT NULL,
      relay_url     TEXT NOT NULL,
      wallet_pubkey TEXT NOT NULL,
      secret        TEXT NOT NULL,
      active        INTEGER NOT NULL DEFAULT 1,
      created_at    INTEGER NOT NULL
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
}

const now = () => Math.floor(Date.now() / 1000)

// Settings
function getSetting(key) {
  const row = db.prepare('SELECT value FROM settings WHERE key=?').get(key)
  return row ? row.value : null
}
function setSetting(key, value) {
  db.prepare('INSERT OR REPLACE INTO settings(key,value) VALUES(?,?)').run(key, value)
}

// Privacy
function getPrivacy() {
  return db.prepare('SELECT * FROM privacy_settings WHERE id=1').get()
}
function setPrivacy(key, value) {
  db.prepare(`UPDATE privacy_settings SET ${key}=? WHERE id=1`).run(value)
  return getPrivacy()
}

// Favorites
function getFavorites() {
  return db.prepare('SELECT * FROM favorites ORDER BY created_at DESC').all()
}
function addFavorite({ title, url, favicon }) {
  const r = db.prepare('INSERT INTO favorites(title,url,favicon,created_at) VALUES(?,?,?,?)').run(title, url, favicon || null, now())
  return { id: r.lastInsertRowid, title, url, favicon, created_at: now() }
}
function removeFavorite(id) {
  db.prepare('DELETE FROM favorites WHERE id=?').run(id)
  return { ok: true }
}

// Cashu
function cashuGetBalance() {
  const row = db.prepare('SELECT COALESCE(SUM(amount),0) as total FROM cashu_proofs WHERE spent=0').get()
  return row.total
}
function cashuListMints() {
  return db.prepare('SELECT url,name,active FROM cashu_mints').all()
}
function cashuAddMint(url) {
  db.prepare('INSERT OR IGNORE INTO cashu_mints(url,active,added_at) VALUES(?,1,?)').run(url, now())
  return { url, name: null, active: 1 }
}
function cashuRemoveMint(url) {
  db.prepare('DELETE FROM cashu_mints WHERE url=?').run(url)
  return { ok: true }
}

module.exports = {
  init, getSetting, setSetting,
  getPrivacy, setPrivacy,
  getFavorites, addFavorite, removeFavorite,
  cashuGetBalance, cashuListMints, cashuAddMint, cashuRemoveMint,
  _db: () => db,
}
