'use strict'

const keychain = require('./keychain')
const nostrTools          = require('nostr-tools')
const { getPublicKey, getEventHash, nip19 } = nostrTools
const { hmac }            = require('@noble/hashes/hmac')
const { sha256 }          = require('@noble/hashes/sha256')
const { bytesToHex }      = require('@noble/hashes/utils')

/**
 * Derive a Nostr private key from a BIP39 seed using HMAC-SHA256.
 * The result is a 32-byte hex string suitable for use as an secp256k1 private key.
 */
function deriveNostrKey(seedHex) {
  const s    = typeof seedHex === 'string' ? seedHex : Buffer.from(seedHex).toString('hex')
  const seed = Buffer.from(s.slice(0, 64), 'hex')
  const key  = hmac(sha256, seed, Buffer.from('Nostr seed'))
  return bytesToHex(key.slice(0, 32))
}

/**
 * Sign a Nostr event. Works with all nostr-tools versions by trying
 * the available signing API in order of preference.
 */
function signEv(event, privKey) {
  const privKeyHex = typeof privKey === 'string' ? privKey : bytesToHex(privKey)
  if (typeof nostrTools.getSignature === 'function') {
    event.id  = getEventHash(event)
    event.sig = nostrTools.getSignature(event, privKeyHex)
    return event
  }
  if (typeof nostrTools.finalizeEvent === 'function') {
    return nostrTools.finalizeEvent(event, Buffer.from(privKeyHex, 'hex'))
  }
  if (typeof nostrTools.signEvent === 'function') {
    event.id  = getEventHash(event)
    event.sig = nostrTools.signEvent(event, privKeyHex)
    return event
  }
  throw new Error('No signing function available in nostr-tools')
}

async function createProfile(DB, { seedHex, name, about }) {
  const privKeyHex = deriveNostrKey(seedHex)
  const pubKeyHex  = getPublicKey(privKeyHex)
  const npub       = nip19.npubEncode(pubKeyHex)

  const key           = await keychain.getOrCreateKey()
  const encryptedNsec = keychain.encrypt(privKeyHex, key)

  const now = Math.floor(Date.now() / 1000)
  const db = DB._db()

  db.prepare('UPDATE nostr_profile SET active=0').run()

  db.prepare(`INSERT INTO nostr_profile
      (pubkey, npub, encrypted_nsec, name, about, active, created_at, last_used_at)
      VALUES (?, ?, ?, ?, ?, 1, ?, ?)
      ON CONFLICT(pubkey) DO UPDATE SET
        encrypted_nsec=excluded.encrypted_nsec,
        name=excluded.name,
        about=excluded.about,
        active=1,
        last_used_at=excluded.last_used_at`)
    .run(pubKeyHex, npub, encryptedNsec, name || null, about || null, now, now)

  return { pubkey: pubKeyHex, npub, name, about }
}

async function importNsec(DB, { nsec, name }) {
  let privKeyHex
  try {
    const decoded = nip19.decode(nsec.trim())
    privKeyHex = decoded.data
  } catch (_) {
    privKeyHex = nsec.trim().replace(/^0x/, '')
  }

  const pubKeyHex = getPublicKey(privKeyHex)
  const npub      = nip19.npubEncode(pubKeyHex)

  const key           = await keychain.getOrCreateKey()
  const encryptedNsec = keychain.encrypt(privKeyHex, key)

  const now = Math.floor(Date.now() / 1000)
  const db = DB._db()

  db.prepare('UPDATE nostr_profile SET active=0').run()

  db.prepare(`INSERT INTO nostr_profile
      (pubkey, npub, encrypted_nsec, name, active, created_at, last_used_at)
      VALUES (?, ?, ?, ?, 1, ?, ?)
      ON CONFLICT(pubkey) DO UPDATE SET
        encrypted_nsec=excluded.encrypted_nsec,
        name=excluded.name,
        active=1,
        last_used_at=excluded.last_used_at`)
    .run(pubKeyHex, npub, encryptedNsec, name || null, now, now)

  return { pubkey: pubKeyHex, npub, name }
}

function getProfile(DB) {
  return DB._db()
    .prepare('SELECT id, pubkey, npub, name, about, picture, nip05, active, last_used_at FROM nostr_profile WHERE active=1 ORDER BY last_used_at DESC, id DESC LIMIT 1')
    .get() || null
}

function getPubkey(DB) {
  const p = getProfile(DB)
  return p ? p.pubkey : null
}

async function signEvent(DB, event) {
  if (Number(event?.kind) === 0) {
    throw new Error('Zap Browser does not sign Nostr metadata updates')
  }

  const row = DB._db()
    .prepare('SELECT encrypted_nsec FROM nostr_profile WHERE active=1 ORDER BY last_used_at DESC, id DESC LIMIT 1')
    .get()

  if (!row) throw new Error('No Nostr profile configured')

  const key        = await keychain.getOrCreateKey()
  const privKeyHex = keychain.decrypt(row.encrypted_nsec, key)
  const pubkey     = getPublicKey(privKeyHex)

  return signEv({
    kind:       event.kind       || 1,
    pubkey,
    tags:       event.tags       || [],
    content:    event.content    || '',
    created_at: event.created_at || Math.floor(Date.now() / 1000),
  }, privKeyHex)
}

function getRelays() {
  return {
    'wss://relay.shadowbip.com': { read: true,  write: true  },
    'wss://relay.damus.io':      { read: true,  write: true  },
    'wss://relay.nostr.band':    { read: true,  write: true  },
    'wss://nos.lol':             { read: true,  write: true  },
    'wss://relay.snort.social':  { read: true,  write: true  },
    'wss://nostr.wine':          { read: true,  write: false },
  }
}
function listProfiles(DB) {
  return DB._db()
    .prepare(`
      SELECT id, pubkey, npub, name, about, picture, nip05, active, last_used_at, created_at
      FROM nostr_profile
      ORDER BY active DESC, last_used_at DESC, id DESC
    `)
    .all()
}

function setActiveProfile(DB, id) {
  const db = DB._db()
  const row = db.prepare('SELECT id FROM nostr_profile WHERE id=?').get(Number(id))
  if (!row) throw new Error('Nostr profile not found')

  const now = Math.floor(Date.now() / 1000)

  db.prepare('UPDATE nostr_profile SET active=0').run()
  db.prepare('UPDATE nostr_profile SET active=1, last_used_at=? WHERE id=?').run(now, Number(id))

  return getProfile(DB)
}

function removeProfileById(DB, id) {
  const db = DB._db()
  const row = db.prepare('SELECT id, active FROM nostr_profile WHERE id=?').get(Number(id))
  if (!row) throw new Error('Nostr profile not found')

  db.prepare('DELETE FROM nostr_profile WHERE id=?').run(Number(id))

  if (Number(row.active) === 1) {
    const next = db.prepare('SELECT id FROM nostr_profile ORDER BY last_used_at DESC, id DESC LIMIT 1').get()
    if (next) {
      db.prepare('UPDATE nostr_profile SET active=1, last_used_at=? WHERE id=?')
        .run(Math.floor(Date.now() / 1000), next.id)
    }
  }

  return { ok: true }
}

function removeProfile(DB) {
  DB._db()
    .prepare('DELETE FROM nostr_profile WHERE active=1')
    .run()

  DB.setSetting('nostr_skipped', '0')

  return { ok: true }
}

module.exports = {
  createProfile,
  importNsec,
  getProfile,
  getPubkey,
  signEvent,
  getRelays,
  listProfiles,
  setActiveProfile,
  removeProfileById,
  removeProfile,
}