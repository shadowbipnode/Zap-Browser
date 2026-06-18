'use strict'

const path      = require('path')
const crypto    = require('crypto')
const { app }   = require('electron')

let db = null

function init() {
  const Database = require('better-sqlite3')
  const dbPath   = path.join(app.getPath('userData'), 'zap.db')
  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')


  db.exec(`
    CREATE TABLE IF NOT EXISTS browser_profiles (
      id           TEXT PRIMARY KEY,
      name         TEXT NOT NULL,
      is_default   INTEGER NOT NULL DEFAULT 0,
      created_at   INTEGER NOT NULL,
      updated_at   INTEGER NOT NULL,
      last_used_at INTEGER NOT NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_browser_profiles_default
      ON browser_profiles(is_default)
      WHERE is_default=1;

    CREATE TABLE IF NOT EXISTS browser_profile_state (
      id                INTEGER PRIMARY KEY CHECK (id=1),
      active_profile_id TEXT NOT NULL REFERENCES browser_profiles(id)
    );

    CREATE TABLE IF NOT EXISTS downloads (
      id TEXT PRIMARY KEY,
      filename TEXT,
      url TEXT,
      path TEXT,
      state TEXT,
      received INTEGER DEFAULT 0,
      total INTEGER DEFAULT 0,
      created_at INTEGER
    )
  `)

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
      doh_provider   TEXT    NOT NULL DEFAULT 'https://cloudflare-dns.com/dns-query',
      tor_enabled    INTEGER NOT NULL DEFAULT 0,
      tor_host       TEXT    NOT NULL DEFAULT '127.0.0.1',
      tor_port       INTEGER NOT NULL DEFAULT 9050,
      popup_block    INTEGER NOT NULL DEFAULT 1,
      overlay_block  INTEGER NOT NULL DEFAULT 1
    );
    INSERT OR IGNORE INTO privacy_settings (id) VALUES (1);
  `)

  try { db.prepare('ALTER TABLE favorites ADD COLUMN parent_id INTEGER').run() } catch (_) {}
  try { db.prepare('ALTER TABLE favorites ADD COLUMN is_folder INTEGER NOT NULL DEFAULT 0').run() } catch (_) {}
  try { db.prepare('ALTER TABLE favorites ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0').run() } catch (_) {}

  // Legacy bookmarks migration:
  // Older Zap Browser versions stored bookmarks directly at root without a
  // dedicated bookmarks bar folder. Create the root folder and move legacy
  // root items into it once.
  try {
    const bar = db
      .prepare("SELECT id FROM favorites WHERE is_folder=1 AND lower(title) IN ('bookmarks bar', 'barra dei preferiti') LIMIT 1")
      .get()

    if (!bar) {
      const info = db
        .prepare("INSERT INTO favorites(title,url,favicon,parent_id,is_folder,sort_order,created_at) VALUES(?,?,?,?,?,?,?)")
        .run('Bookmarks bar', '', null, null, 1, 0, Date.now())

      const barId = info.lastInsertRowid

      db.prepare(`
        UPDATE favorites
        SET parent_id = ?
        WHERE parent_id IS NULL
          AND id != ?
      `).run(barId, barId)
    }
  } catch (_) {}


migrateNwcConnectionsSchema()
migratePrivacySettingsSchema()
migrateBrowserProfiles()
migrateNostrProfilesSchema()
migrateNostrPermissionsSchema()
}

function migrateBrowserProfiles() {
  const ts = now()

  db.prepare(`
    INSERT OR IGNORE INTO browser_profiles
      (id, name, is_default, created_at, updated_at, last_used_at)
    VALUES ('default', 'Default', 1, ?, ?, ?)
  `).run(ts, ts, ts)

  const active = db.prepare(`
    SELECT active_profile_id
    FROM browser_profile_state
    WHERE id=1
  `).get()

  if (!active) {
    db.prepare(`
      INSERT INTO browser_profile_state(id, active_profile_id)
      VALUES (1, 'default')
    `).run()
    return
  }

  const exists = db.prepare(`
    SELECT id
    FROM browser_profiles
    WHERE id=?
  `).get(active.active_profile_id)

  if (!exists) {
    db.prepare(`
      UPDATE browser_profile_state
      SET active_profile_id='default'
      WHERE id=1
    `).run()
  }
}

function migrateNostrPermissionsSchema() {
  const columns = db
    .prepare('PRAGMA table_info(nostr_permissions)')
    .all()
    .map(c => c.name)

  if (columns.includes('browser_profile_id')) return

  const ts = now()

  db.transaction(() => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS nostr_permissions_next (
        id                 INTEGER PRIMARY KEY AUTOINCREMENT,
        browser_profile_id TEXT    NOT NULL DEFAULT 'default' REFERENCES browser_profiles(id),
        origin             TEXT    NOT NULL,
        action             TEXT    NOT NULL,
        decision           TEXT    NOT NULL,
        created_at         INTEGER NOT NULL,
        updated_at         INTEGER NOT NULL,
        UNIQUE(browser_profile_id, origin, action)
      )
    `)

    db.prepare(`
      INSERT OR IGNORE INTO nostr_permissions_next
        (browser_profile_id, origin, action, decision, created_at, updated_at)
      SELECT
        'default',
        origin,
        action,
        decision,
        COALESCE(created_at, ?),
        COALESCE(updated_at, ?)
      FROM nostr_permissions
      ORDER BY id ASC
    `).run(ts, ts)

    db.exec('DROP TABLE nostr_permissions')
    db.exec('ALTER TABLE nostr_permissions_next RENAME TO nostr_permissions')
    db.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_nostr_permissions_browser_profile_origin_action
      ON nostr_permissions(browser_profile_id, origin, action)
    `)
  })()
}

function migrateNostrProfilesSchema() {
  const columns = db
    .prepare('PRAGMA table_info(nostr_profile)')
    .all()
    .map(c => c.name)

  if (!columns.includes('active')) {
    db.prepare('ALTER TABLE nostr_profile ADD COLUMN active INTEGER NOT NULL DEFAULT 0').run()
  }

  if (!columns.includes('last_used_at')) {
    db.prepare('ALTER TABLE nostr_profile ADD COLUMN last_used_at INTEGER').run()
  }

  if (!columns.includes('browser_profile_id')) {
    db.prepare("ALTER TABLE nostr_profile ADD COLUMN browser_profile_id TEXT NOT NULL DEFAULT 'default'").run()
  }

  db.prepare("UPDATE nostr_profile SET browser_profile_id='default' WHERE browser_profile_id IS NULL OR browser_profile_id=''").run()
  db.exec(`
    UPDATE nostr_profile
    SET active=0
    WHERE active=1
      AND id NOT IN (
        SELECT MAX(id)
        FROM nostr_profile
        WHERE active=1
        GROUP BY browser_profile_id
      )
  `)
  db.exec('DROP INDEX IF EXISTS idx_nostr_profile_pubkey')
  db.exec('DROP INDEX IF EXISTS idx_nostr_profile_active_browser_profile')
  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_nostr_profile_browser_profile_pubkey
    ON nostr_profile(browser_profile_id, pubkey)
  `)
  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_nostr_profile_active_browser_profile
    ON nostr_profile(browser_profile_id)
    WHERE active=1
  `)

  const ts = now()
  const browserProfiles = db.prepare('SELECT id FROM browser_profiles').all()

  for (const browserProfile of browserProfiles) {
    const active = db.prepare(`
      SELECT id
      FROM nostr_profile
      WHERE browser_profile_id=? AND active=1
      ORDER BY last_used_at DESC, id DESC
      LIMIT 1
    `).get(browserProfile.id)

    if (active) continue

    const first = db.prepare(`
      SELECT id
      FROM nostr_profile
      WHERE browser_profile_id=?
      ORDER BY last_used_at DESC, id DESC
      LIMIT 1
    `).get(browserProfile.id)

    if (first) {
      db.prepare('UPDATE nostr_profile SET active=1, last_used_at=? WHERE id=?').run(ts, first.id)
    }
  }
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

function migratePrivacySettingsSchema() {
  const columns = db
    .prepare('PRAGMA table_info(privacy_settings)')
    .all()
    .map(c => c.name)

  if (!columns.includes('popup_block')) {
    db.prepare('ALTER TABLE privacy_settings ADD COLUMN popup_block INTEGER NOT NULL DEFAULT 1').run()
  }

  if (!columns.includes('overlay_block')) {
    db.prepare('ALTER TABLE privacy_settings ADD COLUMN overlay_block INTEGER NOT NULL DEFAULT 1').run()
  }
}

const now = () => Math.floor(Date.now() / 1000)

// ── Settings ──────────────────────────────────────────────────────────────────
function getSetting(key) {
  const row = db.prepare('SELECT value FROM settings WHERE key=?').get(key)
  return row ? row.value : null
}

// ── Browser profiles ──────────────────────────────────────────────────────────
function getActiveBrowserProfile() {
  return db.prepare(`
    SELECT p.*
    FROM browser_profiles p
    JOIN browser_profile_state s ON s.active_profile_id=p.id
    WHERE s.id=1
    LIMIT 1
  `).get() || db.prepare('SELECT * FROM browser_profiles WHERE id=?').get('default')
}

function listBrowserProfiles() {
  return db.prepare(`
    SELECT *
    FROM browser_profiles
    ORDER BY is_default DESC, last_used_at DESC, name ASC
  `).all()
}

function createBrowserProfile({ name }) {
  const title = String(name || '').trim()
  if (!title) throw new Error('Profile name is required')

  const id = crypto.randomUUID()
  const ts = now()

  db.prepare(`
    INSERT INTO browser_profiles
      (id, name, is_default, created_at, updated_at, last_used_at)
    VALUES (?, ?, 0, ?, ?, ?)
  `).run(id, title, ts, ts, ts)

  return getBrowserProfileById(id)
}

function renameBrowserProfile(id, name) {
  const profileId = String(id || '')
  const title = String(name || '').trim()
  if (!title) throw new Error('Profile name is required')

  const existing = getBrowserProfileById(profileId)
  if (!existing) throw new Error('Browser profile not found')

  const ts = now()
  db.prepare('UPDATE browser_profiles SET name=?, updated_at=? WHERE id=?').run(title, ts, profileId)

  return getBrowserProfileById(profileId)
}

function setActiveBrowserProfile(id) {
  const profile = db.prepare('SELECT * FROM browser_profiles WHERE id=?').get(String(id || ''))
  if (!profile) throw new Error('Browser profile not found')

  const ts = now()
  db.prepare('UPDATE browser_profiles SET last_used_at=?, updated_at=? WHERE id=?').run(ts, ts, profile.id)
  db.prepare('UPDATE browser_profile_state SET active_profile_id=? WHERE id=1').run(profile.id)

  return getActiveBrowserProfile()
}

function getBrowserProfileById(id) {
  return db.prepare('SELECT * FROM browser_profiles WHERE id=?').get(String(id || '')) || null
}

function deleteBrowserProfile(id) {
  const profileId = String(id || '')
  const profile = getBrowserProfileById(profileId)

  if (!profile) throw new Error('Browser profile not found')
  if (Number(profile.is_default) === 1) throw new Error('The default profile cannot be deleted')

  const wasActive = getActiveBrowserProfileId() === profileId

  db.transaction(() => {
    if (wasActive) {
      db.prepare("UPDATE browser_profile_state SET active_profile_id='default' WHERE id=1").run()
      const ts = now()
      db.prepare("UPDATE browser_profiles SET last_used_at=?, updated_at=? WHERE id='default'").run(ts, ts)
    }

    db.prepare('DELETE FROM nostr_permissions WHERE browser_profile_id=?').run(profileId)
    db.prepare('DELETE FROM nostr_profile WHERE browser_profile_id=?').run(profileId)
    db.prepare('DELETE FROM browser_profiles WHERE id=?').run(profileId)
  })()

  return {
    ok: true,
    deleted_profile_id: profileId,
    was_active: wasActive,
    active_profile: getActiveBrowserProfile(),
  }
}
function setSetting(key, value) {
  db.prepare('INSERT OR REPLACE INTO settings(key,value) VALUES(?,?)').run(key, value)
}

// ── Privacy ───────────────────────────────────────────────────────────────────

try { db.prepare('ALTER TABLE privacy_settings ADD COLUMN tor_enabled INTEGER NOT NULL DEFAULT 0').run() } catch (_) {}
try { db.prepare("ALTER TABLE privacy_settings ADD COLUMN tor_host TEXT NOT NULL DEFAULT '127.0.0.1'").run() } catch (_) {}
try { db.prepare('ALTER TABLE privacy_settings ADD COLUMN tor_port INTEGER NOT NULL DEFAULT 9050').run() } catch (_) {}


function ensurePrivacyMigrations() {
  const cols = db.prepare("PRAGMA table_info(privacy_settings)").all().map(c => c.name)

  if (!cols.includes('tor_enabled')) {
    db.prepare('ALTER TABLE privacy_settings ADD COLUMN tor_enabled INTEGER NOT NULL DEFAULT 0').run()
  }

  if (!cols.includes('tor_host')) {
    db.prepare("ALTER TABLE privacy_settings ADD COLUMN tor_host TEXT NOT NULL DEFAULT '127.0.0.1'").run()
  }

  if (!cols.includes('tor_port')) {
    db.prepare('ALTER TABLE privacy_settings ADD COLUMN tor_port INTEGER NOT NULL DEFAULT 9050').run()
  }
}


function getPrivacy() {
  ensurePrivacyMigrations()
  return db.prepare('SELECT * FROM privacy_settings WHERE id=1').get()
}
function setPrivacy(key, value) {
  ensurePrivacyMigrations()
  db.prepare(`UPDATE privacy_settings SET ${key}=? WHERE id=1`).run(value)
  return getPrivacy()
}

// ── Favorites ─────────────────────────────────────────────────────────────────
function getFavorites() {
  return db.prepare(`
    SELECT *
    FROM favorites
    ORDER BY
      COALESCE(parent_id, 0),
      is_folder DESC,
      sort_order ASC,
      created_at DESC
  `).all()
}
function addFavorite({ title, url, favicon, parent_id = null, is_folder = 0, sort_order = 0 }) {
  const ts = now()
  const safeUrl = is_folder ? '' : url

  const r = db
    .prepare('INSERT INTO favorites(title,url,favicon,parent_id,is_folder,sort_order,created_at) VALUES(?,?,?,?,?,?,?)')
    .run(title, safeUrl, favicon || null, parent_id, is_folder ? 1 : 0, sort_order || 0, ts)

  return {
    id: r.lastInsertRowid,
    title,
    url: safeUrl,
    favicon: favicon || null,
    parent_id,
    is_folder: is_folder ? 1 : 0,
    sort_order: sort_order || 0,
    created_at: ts,
  }
}
function removeFavorite(id) {
  const item = db.prepare(`
    SELECT id, is_folder
    FROM favorites
    WHERE id=?
  `).get(id)

  if (!item) return false

  const deleteRecursive = (parentId) => {
    const children = db.prepare(`
      SELECT id
      FROM favorites
      WHERE parent_id=?
    `).all(parentId)

    for (const child of children) {
      deleteRecursive(child.id)
    }

    db.prepare(`
      DELETE FROM favorites
      WHERE id=?
    `).run(parentId)
  }

  if (item.is_folder) {
    deleteRecursive(id)
  } else {
    db.prepare(`
      DELETE FROM favorites
      WHERE id=?
    `).run(id)
  }

  return true
}

function updateFavoriteTitle(id, title) {
  db.prepare('UPDATE favorites SET title=? WHERE id=?').run(title, id)
  return { ok: true, id, title }
}

function moveFavorite(id, parent_id = null) {
  const item = db.prepare('SELECT id, is_folder FROM favorites WHERE id=?').get(id)
  if (!item) return { ok: false, error: 'Favorite not found' }

  const targetParent = parent_id === null || parent_id === undefined ? null : Number(parent_id)

  if (targetParent !== null) {
    const parent = db.prepare('SELECT id, is_folder FROM favorites WHERE id=?').get(targetParent)

    if (!parent || Number(parent.is_folder) !== 1) {
      return { ok: false, error: 'Invalid target folder' }
    }

    if (Number(item.is_folder) === 1) {
      let cursor = parent

      while (cursor) {
        if (Number(cursor.id) === Number(id)) {
          return { ok: false, error: 'Cannot move folder into itself or one of its children' }
        }

        cursor = db.prepare('SELECT id, parent_id FROM favorites WHERE id=?').get(cursor.parent_id)
      }
    }
  }

  db.prepare('UPDATE favorites SET parent_id=? WHERE id=?').run(targetParent, id)

  return { ok: true, id, parent_id: targetParent }
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
function getActiveNostrProfileId() {
  const row = db.prepare('SELECT id FROM nostr_profile WHERE active=1 ORDER BY last_used_at DESC, id DESC LIMIT 1').get()
  return row?.id || null
}

function getActiveBrowserProfileId() {
  return getActiveBrowserProfile()?.id || 'default'
}

function getNostrPermission(origin, action, browserProfileId = null) {
  return db
    .prepare(`
      SELECT decision
      FROM nostr_permissions
      WHERE browser_profile_id=? AND origin=? AND action=?
    `)
    .get(browserProfileId || getActiveBrowserProfileId(), origin, action) || null
}

function setNostrPermission(origin, action, decision, browserProfileId = null) {
  const ts = now()
  const targetBrowserProfileId = browserProfileId || getActiveBrowserProfileId()

  db.prepare(`
    INSERT INTO nostr_permissions(browser_profile_id, origin, action, decision, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(browser_profile_id, origin, action)
    DO UPDATE SET decision=excluded.decision, updated_at=excluded.updated_at
  `).run(targetBrowserProfileId, origin, action, decision, ts, ts)

  return { browser_profile_id: targetBrowserProfileId, profile_id: targetBrowserProfileId, origin, action, decision }
}

function listNostrPermissions(browserProfileId = null) {
  const targetBrowserProfileId = browserProfileId || getActiveBrowserProfileId()

  return db
    .prepare(`
      SELECT browser_profile_id, browser_profile_id AS profile_id, origin, action, decision, updated_at
      FROM nostr_permissions
      WHERE browser_profile_id=?
      ORDER BY updated_at DESC
    `)
    .all(targetBrowserProfileId)
}

function removeNostrPermission(origin, action, browserProfileId = null) {
  const targetBrowserProfileId = browserProfileId || getActiveBrowserProfileId()

  db
    .prepare('DELETE FROM nostr_permissions WHERE browser_profile_id=? AND origin=? AND action=?')
    .run(targetBrowserProfileId, origin, action)

  return { ok: true }
}

function clearNostrPermissions(browserProfileId = null) {
  db.prepare('DELETE FROM nostr_permissions WHERE browser_profile_id=?').run(browserProfileId || getActiveBrowserProfileId())
  return { ok: true }
}

module.exports = {
  init,
  getSetting, setSetting,
  getActiveBrowserProfile, getActiveBrowserProfileId, listBrowserProfiles, createBrowserProfile, renameBrowserProfile, setActiveBrowserProfile, getBrowserProfileById, deleteBrowserProfile,
  getPrivacy, setPrivacy,
  addDownload, getDownloads, clearDownloads,
  getFavorites, addFavorite, removeFavorite, updateFavoriteTitle, moveFavorite,
  addHistory, getHistory, clearHistory,
  cashuGetBalance, cashuListMints, cashuAddMint, cashuRemoveMint,
  getNostrPermission, setNostrPermission, listNostrPermissions, removeNostrPermission, clearNostrPermissions,
  _db: () => db,
}


function addDownload(d) {
  console.log('[DB] addDownload', d)

  db.prepare(`
    INSERT OR REPLACE INTO downloads
    (id, filename, url, path, state, received, total, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    d.id,
    d.fileName || d.filename || '',
    d.url || '',
    d.savePath || d.path || '',
    d.state || '',
    d.receivedBytes || d.received || 0,
    d.totalBytes || d.total || 0,
    Date.now()
  )
}

function getDownloads() {
  return db.prepare(`
    SELECT
      id,
      filename AS fileName,
      url,
      path AS savePath,
      state,
      received AS receivedBytes,
      total AS totalBytes,
      created_at
    FROM downloads
    ORDER BY created_at DESC
    LIMIT 200
  `).all()
}

function clearDownloads() {
  db.prepare('DELETE FROM downloads').run()
}
