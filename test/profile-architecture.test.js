'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const Module = require('node:module')
const Database = require('better-sqlite3')

test('migrates legacy profile data and preserves profile isolation', () => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'zap-profiles-'))
  const dbPath = path.join(userData, 'zap.db')
  const legacy = new Database(dbPath)

  legacy.exec(`
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
      (1, 'legacy-pubkey', 'legacy-npub', 'encrypted', 'Legacy', 1);

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
      ('https://example.com', 'getPublicKey', 'allow', 1, 1);
  `)
  legacy.close()

  const originalLoad = Module._load
  Module._load = function (request, parent, isMain) {
    if (request === 'electron') {
      return { app: { getPath: () => userData } }
    }
    return originalLoad.call(this, request, parent, isMain)
  }

  const DB = require('../src/main/db')

  try {
    DB.init()

    assert.equal(DB.getActiveBrowserProfile().id, 'default')
    assert.equal(DB.listNostrPermissions('default').length, 1)

    const migrated = DB._db()
      .prepare('SELECT browser_profile_id, active FROM nostr_profile WHERE id=1')
      .get()
    assert.deepEqual(migrated, { browser_profile_id: 'default', active: 1 })

    const second = DB.createBrowserProfile({ name: 'Work' })
    DB.setNostrPermission('https://example.com', 'getPublicKey', 'deny', second.id)
    DB._db().prepare(`
      INSERT INTO nostr_profile
        (browser_profile_id, pubkey, npub, encrypted_nsec, name, active, created_at, last_used_at)
      VALUES
        (?, 'legacy-pubkey', 'legacy-npub', 'encrypted-work', 'Work Identity', 1, 2, 2)
    `).run(second.id)

    assert.equal(DB.getNostrPermission('https://example.com', 'getPublicKey', 'default').decision, 'allow')
    assert.equal(DB.getNostrPermission('https://example.com', 'getPublicKey', second.id).decision, 'deny')

    const nostr = require('../src/main/nostr')
    assert.equal(nostr.getProfile(DB, 'default').name, 'Legacy')
    assert.equal(nostr.getProfile(DB, second.id).name, 'Work Identity')
    assert.equal(nostr.listProfiles(DB, 'default').length, 1)
    assert.equal(nostr.listProfiles(DB, second.id).length, 1)

    DB.setActiveBrowserProfile(second.id)
    assert.equal(DB.getActiveBrowserProfile().id, second.id)

    const deleted = DB.deleteBrowserProfile(second.id)
    assert.equal(deleted.was_active, true)
    assert.equal(deleted.active_profile.id, 'default')
    assert.equal(DB.getBrowserProfileById(second.id), null)
  } finally {
    DB._db()?.close()
    Module._load = originalLoad
    fs.rmSync(userData, { recursive: true, force: true })
  }
})

test('uses stable persistent and ephemeral partition boundaries', () => {
  const profileContext = require('../src/main/browser/profileContext')

  assert.equal(profileContext.persistentPartition('default'), null)
  assert.equal(profileContext.persistentPartition('work profile'), 'persist:zap-profile-work-profile')
  assert.equal(profileContext.privatePartition('work profile', 'tab/1'), 'zap-private-work-profile-tab-1')
})
