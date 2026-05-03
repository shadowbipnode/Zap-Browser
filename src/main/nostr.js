// src/main/nostr.js
'use strict'

const { getPublicKey, nip19 } = require('nostr-tools')
const { bytesToHex, hexToBytes } = require('@noble/hashes/utils')
const { sha256 } = require('@noble/hashes/sha256')
const { hmac } = require('@noble/hashes/hmac')

// NIP-06: derive Nostr keypair from BIP39 seed
// Path: m/44'/1237'/0'/0/0  (simplified HMAC derivation)
function deriveNostrKey(seedHex) {
  const seed = Buffer.from(seedHex.slice(0, 64), 'hex')
  // Simplified: HMAC-SHA256(seed, "nostr") as private key
  const key = hmac(sha256, seed, Buffer.from('nostr nip06 key derivation'))
  return bytesToHex(key.slice(0, 32))
}

function createProfile(DB, { seedHex, name, about }) {
  const privKeyHex = deriveNostrKey(seedHex)
  const pubKeyHex  = getPublicKey(hexToBytes(privKeyHex))
  const npub       = nip19.npubEncode(pubKeyHex)

  const db = DB._db()
  db.prepare(`INSERT OR REPLACE INTO nostr_profile(id,pubkey,npub,encrypted_nsec,name,about,created_at)
    VALUES(1,?,?,?,?,?,?)`)
    .run(pubKeyHex, npub, privKeyHex, name || 'anon', about || null, Math.floor(Date.now()/1000))

  return { pubkey: pubKeyHex, npub, name, about }
}

function importNsec(DB, { nsec, name }) {
  let privKeyHex
  try {
    const decoded = nip19.decode(nsec)
    privKeyHex = bytesToHex(decoded.data)
  } catch {
    privKeyHex = nsec // assume hex
  }
  const pubKeyHex = getPublicKey(hexToBytes(privKeyHex))
  const npub      = nip19.npubEncode(pubKeyHex)

  const db = DB._db()
  db.prepare(`INSERT OR REPLACE INTO nostr_profile(id,pubkey,npub,encrypted_nsec,name,created_at)
    VALUES(1,?,?,?,?,?)`)
    .run(pubKeyHex, npub, privKeyHex, name || 'anon', Math.floor(Date.now()/1000))

  return { pubkey: pubKeyHex, npub, name }
}

function getProfile(DB) {
  const db = DB._db()
  return db.prepare('SELECT pubkey,npub,name,about,picture,nip05 FROM nostr_profile WHERE id=1').get() || null
}

function getPubkey(DB) {
  const p = getProfile(DB)
  return p ? p.pubkey : null
}

function signEvent(DB, event) {
  const { finalizeEvent } = require('nostr-tools')
  const db = DB._db()
  const row = db.prepare('SELECT encrypted_nsec FROM nostr_profile WHERE id=1').get()
  if (!row) throw new Error('No Nostr profile configured')
  const privKey = hexToBytes(row.encrypted_nsec)
  const signed = finalizeEvent({
    kind:       event.kind,
    tags:       event.tags || [],
    content:    event.content || '',
    created_at: Math.floor(Date.now() / 1000),
  }, privKey)
  return signed
}

function getRelays() {
  return {
    'wss://relay.damus.io':       { read: true, write: true },
    'wss://relay.nostr.band':     { read: true, write: true },
    'wss://nos.lol':              { read: true, write: true },
    'wss://relay.snort.social':   { read: true, write: true },
    'wss://nostr.wine':           { read: true, write: false },
  }
}

module.exports = { createProfile, importNsec, getProfile, getPubkey, signEvent, getRelays }
