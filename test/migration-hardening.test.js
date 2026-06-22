'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const Module = require('node:module')
const Database = require('better-sqlite3')

const dbModulePath = require.resolve('../src/main/db')

function openZapDatabase(userData) {
  const originalLoad = Module._load
  Module._load = function (request, parent, isMain) {
    if (request === 'electron') {
      return { app: { getPath: () => userData } }
    }
    return originalLoad.call(this, request, parent, isMain)
  }

  delete require.cache[dbModulePath]
  const DB = require(dbModulePath)
  DB.init()

  return {
    DB,
    close() {
      DB._db()?.close()
      delete require.cache[dbModulePath]
      Module._load = originalLoad
    },
  }
}

function withTemporaryDatabase(prefix, setup, run) {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), prefix))
  const dbPath = path.join(userData, 'zap.db')

  try {
    if (setup) {
      const legacy = new Database(dbPath)
      setup(legacy)
      legacy.close()
    }
    run(userData)
  } finally {
    fs.rmSync(userData, { recursive: true, force: true })
  }
}

function migrationSnapshot(DB) {
  const database = DB._db()
  return {
    profiles: database.prepare(`
      SELECT id, name, is_default
      FROM browser_profiles
      ORDER BY id
    `).all(),
    activeProfile: database.prepare(`
      SELECT active_profile_id
      FROM browser_profile_state
      WHERE id=1
    `).get(),
    privacy: database.prepare(`
      SELECT *
      FROM privacy_settings
      ORDER BY browser_profile_id
    `).all(),
    nostrProfiles: database.prepare(`
      SELECT id, browser_profile_id, pubkey, active, last_used_at
      FROM nostr_profile
      ORDER BY id
    `).all(),
    nostrPermissions: database.prepare(`
      SELECT browser_profile_id, origin, action, decision, created_at, updated_at
      FROM nostr_permissions
      ORDER BY browser_profile_id, origin, action
    `).all(),
    favorites: database.prepare(`
      SELECT id, title, url, parent_id, is_folder, sort_order
      FROM favorites
      ORDER BY id
    `).all(),
  }
}

test('initializes a fresh database deterministically', () => {
  withTemporaryDatabase('zap-migration-fresh-', null, userData => {
    let opened = openZapDatabase(userData)

    try {
      assert.deepEqual(
        opened.DB.listBrowserProfiles().map(profile => ({
          id: profile.id,
          name: profile.name,
          is_default: profile.is_default,
        })),
        [{ id: 'default', name: 'Default', is_default: 1 }],
      )
      assert.equal(opened.DB.getPrivacy('default').browser_profile_id, 'default')

      const favorites = opened.DB.getFavorites()
      assert.equal(favorites.length, 1)
      assert.equal(favorites[0].title, 'Bookmarks bar')
      assert.equal(favorites[0].parent_id, null)
      assert.equal(favorites[0].sort_order, 0)

      const firstSnapshot = migrationSnapshot(opened.DB)
      opened.close()
      opened = openZapDatabase(userData)
      assert.deepEqual(migrationSnapshot(opened.DB), firstSnapshot)
    } finally {
      opened.close()
    }
  })
})

test('migrates legacy global settings, Nostr data, and flat bookmarks once', () => {
  withTemporaryDatabase('zap-migration-legacy-', legacy => {
    legacy.exec(`
      CREATE TABLE settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
      INSERT INTO settings(key, value) VALUES
        ('initialized', '1'),
        ('nostr_skipped', '0');

      CREATE TABLE privacy_settings (
        id INTEGER PRIMARY KEY,
        adblock INTEGER NOT NULL DEFAULT 1,
        webrtc_protect INTEGER NOT NULL DEFAULT 1,
        ua_mode TEXT NOT NULL DEFAULT 'rotate',
        custom_ua TEXT,
        doh_enabled INTEGER NOT NULL DEFAULT 1,
        doh_provider TEXT NOT NULL DEFAULT 'https://cloudflare-dns.com/dns-query',
        popup_block INTEGER NOT NULL DEFAULT 1,
        overlay_block INTEGER NOT NULL DEFAULT 1
      );
      INSERT INTO privacy_settings
        (id, adblock, webrtc_protect, ua_mode, custom_ua, doh_enabled, doh_provider, popup_block, overlay_block)
      VALUES
        (1, 0, 0, 'custom', 'Legacy UA', 0, 'https://dns.example/query', 0, 0);

      CREATE TABLE nostr_profile (
        id INTEGER PRIMARY KEY,
        pubkey TEXT NOT NULL,
        npub TEXT NOT NULL,
        encrypted_nsec TEXT,
        name TEXT,
        about TEXT,
        picture TEXT,
        nip05 TEXT,
        created_at INTEGER NOT NULL
      );
      INSERT INTO nostr_profile
        (id, pubkey, npub, encrypted_nsec, name, created_at)
      VALUES
        (7, 'legacy-pubkey', 'legacy-npub', 'encrypted', 'Legacy identity', 10);

      CREATE TABLE nostr_permissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        origin TEXT NOT NULL,
        action TEXT NOT NULL,
        decision TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        UNIQUE(origin, action)
      );
      INSERT INTO nostr_permissions
        (origin, action, decision, created_at, updated_at)
      VALUES
        ('https://example.com', 'getPublicKey', 'allow', 11, 12),
        ('https://sign.example', 'signEvent', 'deny', 13, 14);

      CREATE TABLE favorites (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        url TEXT NOT NULL,
        favicon TEXT,
        created_at INTEGER NOT NULL
      );
      INSERT INTO favorites(id, title, url, favicon, created_at) VALUES
        (3, 'First legacy bookmark', 'https://first.example', NULL, 20),
        (9, 'Second legacy bookmark', 'https://second.example', 'icon.png', 21),
        (10, 'Second legacy bookmark', 'https://second.example', 'icon.png', 22);
    `)
  }, userData => {
    let opened = openZapDatabase(userData)

    try {
      const DB = opened.DB
      assert.equal(DB.getSetting('initialized'), '1')
      assert.equal(DB.getSetting('nostr_skipped'), '0')
      assert.equal(DB.getActiveBrowserProfile().id, 'default')

      const privacy = DB.getPrivacy('default')
      assert.equal(privacy.adblock, 0)
      assert.equal(privacy.webrtc_protect, 0)
      assert.equal(privacy.ua_mode, 'custom')
      assert.equal(privacy.custom_ua, 'Legacy UA')
      assert.equal(privacy.doh_enabled, 0)
      assert.equal(privacy.doh_provider, 'https://dns.example/query')
      assert.equal(privacy.popup_block, 0)
      assert.equal(privacy.overlay_block, 0)
      assert.equal(privacy.tor_enabled, 0)

      assert.deepEqual(
        DB.listNostrPermissions('default').map(permission => ({
          origin: permission.origin,
          action: permission.action,
          decision: permission.decision,
        })).sort((a, b) => a.origin.localeCompare(b.origin)),
        [
          { origin: 'https://example.com', action: 'getPublicKey', decision: 'allow' },
          { origin: 'https://sign.example', action: 'signEvent', decision: 'deny' },
        ],
      )

      const migratedNostr = DB._db().prepare(`
        SELECT browser_profile_id, active
        FROM nostr_profile
        WHERE id=7
      `).get()
      assert.deepEqual(migratedNostr, { browser_profile_id: 'default', active: 1 })

      const favorites = DB.getFavorites()
      const bar = favorites.find(item => item.title === 'Bookmarks bar')
      assert.ok(bar)
      assert.deepEqual(
        favorites
          .filter(item => Number(item.parent_id) === Number(bar.id))
          .map(item => ({ id: item.id, sort_order: item.sort_order })),
        [
          { id: 3, sort_order: 0 },
          { id: 9, sort_order: 1 },
          { id: 10, sort_order: 2 },
        ],
      )

      const firstSnapshot = migrationSnapshot(DB)
      opened.close()
      opened = openZapDatabase(userData)
      assert.deepEqual(migrationSnapshot(opened.DB), firstSnapshot)
    } finally {
      opened.close()
    }
  })
})

test('repairs invalid bookmark parents and cycles without losing nested data', () => {
  withTemporaryDatabase('zap-migration-bookmarks-', legacy => {
    legacy.exec(`
      CREATE TABLE favorites (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        url TEXT NOT NULL,
        favicon TEXT,
        parent_id INTEGER,
        is_folder INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL
      );
      INSERT INTO favorites(id, title, url, parent_id, is_folder, created_at) VALUES
        (1, 'Bookmarks bar', '', NULL, 1, 1),
        (2, 'Folder', '', 1, 1, 2),
        (3, 'Nested folder', '', 2, 1, 3),
        (4, 'Nested bookmark', 'https://nested.example', 3, 0, 4),
        (5, 'Missing parent', 'https://missing.example', 999, 0, 5),
        (6, 'Self reference', '', 6, 1, 6),
        (7, 'Cycle A', '', 8, 1, 7),
        (8, 'Cycle B', '', 7, 1, 8),
        (9, 'Bookmark as parent', 'https://bad-parent.example', 4, 0, 9);
    `)
  }, userData => {
    let opened = openZapDatabase(userData)

    try {
      const favorites = new Map(
        opened.DB.getFavorites().map(item => [Number(item.id), item])
      )

      assert.equal(favorites.size, 9)
      assert.equal(favorites.get(1).parent_id, null)
      assert.equal(favorites.get(2).parent_id, 1)
      assert.equal(favorites.get(3).parent_id, 2)
      assert.equal(favorites.get(4).parent_id, 3)
      assert.equal(favorites.get(5).parent_id, 1)
      assert.equal(favorites.get(6).parent_id, 1)
      assert.equal(favorites.get(7).parent_id, 1)
      assert.equal(favorites.get(8).parent_id, 7)
      assert.equal(favorites.get(9).parent_id, 1)

      const siblings = opened.DB.getFavorites().filter(item => Number(item.parent_id) === 1)
      assert.deepEqual(
        siblings.map(item => item.sort_order),
        siblings.map((_, index) => index),
      )

      const firstSnapshot = migrationSnapshot(opened.DB)
      opened.close()
      opened = openZapDatabase(userData)
      assert.deepEqual(migrationSnapshot(opened.DB), firstSnapshot)
    } finally {
      opened.close()
    }
  })
})

test('repairs partially migrated default profile state without duplicating profiles', () => {
  withTemporaryDatabase('zap-migration-profiles-', legacy => {
    legacy.exec(`
      CREATE TABLE browser_profiles (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        is_default INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        last_used_at INTEGER NOT NULL
      );
      INSERT INTO browser_profiles
        (id, name, is_default, created_at, updated_at, last_used_at)
      VALUES
        ('work', 'Work', 1, 1, 1, 1);

      CREATE TABLE browser_profile_state (
        id INTEGER PRIMARY KEY CHECK (id=1),
        active_profile_id TEXT NOT NULL
      );
      INSERT INTO browser_profile_state(id, active_profile_id)
      VALUES (1, 'missing-profile');
    `)
  }, userData => {
    let opened = openZapDatabase(userData)

    try {
      assert.deepEqual(
        opened.DB.listBrowserProfiles()
          .map(profile => ({ id: profile.id, is_default: profile.is_default }))
          .sort((a, b) => a.id.localeCompare(b.id)),
        [
          { id: 'default', is_default: 1 },
          { id: 'work', is_default: 0 },
        ],
      )
      assert.equal(opened.DB.getActiveBrowserProfile().id, 'default')

      const firstSnapshot = migrationSnapshot(opened.DB)
      opened.close()
      opened = openZapDatabase(userData)
      assert.deepEqual(migrationSnapshot(opened.DB), firstSnapshot)
    } finally {
      opened.close()
    }
  })
})
