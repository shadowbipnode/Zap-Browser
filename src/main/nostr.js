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

  DB._db()
    .prepare(`INSERT OR REPLACE INTO nostr_profile
      (id, pubkey, npub, encrypted_nsec, name, about, created_at)
      VALUES (1, ?, ?, ?, ?, ?, ?)`)
    .run(pubKeyHex, npub, encryptedNsec, name || null, about || null, Math.floor(Date.now() / 1000))

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

  DB._db()
    .prepare(`INSERT OR REPLACE INTO nostr_profile
      (id, pubkey, npub, encrypted_nsec, name, created_at)
      VALUES (1, ?, ?, ?, ?, ?)`)
    .run(pubKeyHex, npub, encryptedNsec, name || null, Math.floor(Date.now() / 1000))

  return { pubkey: pubKeyHex, npub, name }
}

function getProfile(DB) {
  return DB._db()
    .prepare('SELECT pubkey, npub, name, about, picture, nip05 FROM nostr_profile WHERE id=1')
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
    .prepare('SELECT encrypted_nsec FROM nostr_profile WHERE id=1')
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
function removeProfile(DB) {
  DB._db()
    .prepare('DELETE FROM nostr_profile WHERE id=1')
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
  removeProfile,
}