'use strict'

const {
  getPublicKey,
  getEventHash,
  signEvent: signNostrEvent,
  nip19,
  nip04,
} = require('nostr-tools')

const { hmac }   = require('@noble/hashes/hmac')
const { sha256 } = require('@noble/hashes/sha256')
const { bytesToHex } = require('@noble/hashes/utils')

function deriveNostrKey(seedHex) {
  const s = typeof seedHex === 'string' ? seedHex : Buffer.from(seedHex).toString('hex')
  const seed = Buffer.from(s.slice(0, 64), 'hex')
  const key  = hmac(sha256, seed, Buffer.from('Nostr seed'))
  return bytesToHex(key.slice(0, 32))
}

function publishMetadata(privKeyHex, name, about) {
  try {
    const WebSocket = require('ws')
    const relays = Object.keys(getRelays())
    const pubkey = getPublicKey(privKeyHex)
    const event = {
      kind: 0,
      pubkey,
      created_at: Math.floor(Date.now() / 1000),
      tags: [],
      content: JSON.stringify({
        name: name || 'anon',
        display_name: name || 'anon',
        about: about || '',
        picture: '',
      }),
    }
    event.id  = getEventHash(event)
    event.sig = signNostrEvent(event, privKeyHex)

    for (const relay of relays) {
      try {
        const ws = new WebSocket(relay)
        ws.on('open', () => {
          ws.send(JSON.stringify(['EVENT', event]))
          setTimeout(() => ws.close(), 4000)
        })
        ws.on('error', () => {})
      } catch(_) {}
    }
  } catch(e) { console.error('[Nostr] publishMetadata error:', e.message) }
}

function createProfile(DB, { seedHex, name, about }) {
  const privKeyHex = deriveNostrKey(seedHex)
  const pubKeyHex  = getPublicKey(privKeyHex)
  const npub       = nip19.npubEncode(pubKeyHex)

  const db = DB._db()
  db.prepare(`INSERT OR REPLACE INTO nostr_profile
    (id,pubkey,npub,encrypted_nsec,name,about,created_at)
    VALUES(1,?,?,?,?,?,?)`)
    .run(pubKeyHex, npub, privKeyHex, name||'anon', about||null, Math.floor(Date.now()/1000))

  // Pubblica metadata sui relay
  publishMetadata(privKeyHex, name, about)

  return { pubkey: pubKeyHex, npub, name, about }
}

function importNsec(DB, { nsec, name }) {
  let privKeyHex
  try {
    const decoded = nip19.decode(nsec)
    privKeyHex = bytesToHex(decoded.data)
  } catch(_) {
    privKeyHex = nsec.replace(/^0x/, '')
  }
  const pubKeyHex = getPublicKey(privKeyHex)
  const npub      = nip19.npubEncode(pubKeyHex)

  const db = DB._db()
  db.prepare(`INSERT OR REPLACE INTO nostr_profile
    (id,pubkey,npub,encrypted_nsec,name,created_at)
    VALUES(1,?,?,?,?,?)`)
    .run(pubKeyHex, npub, privKeyHex, name||'anon', Math.floor(Date.now()/1000))

  publishMetadata(privKeyHex, name, null)

  return { pubkey: pubKeyHex, npub, name }
}

function getProfile(DB) {
  return DB._db().prepare(
    'SELECT pubkey,npub,name,about,picture,nip05 FROM nostr_profile WHERE id=1'
  ).get() || null
}

function getPubkey(DB) {
  const p = getProfile(DB)
  return p ? p.pubkey : null
}

function signEvent(DB, event) {
  const row = DB._db().prepare('SELECT encrypted_nsec FROM nostr_profile WHERE id=1').get()
  if (!row) throw new Error('Nessun profilo Nostr configurato')
  const privKeyHex = row.encrypted_nsec
  const pubkey     = getPublicKey(privKeyHex)
  const ev = {
    kind:       event.kind       || 1,
    pubkey,
    tags:       event.tags       || [],
    content:    event.content    || '',
    created_at: Math.floor(Date.now() / 1000),
  }
  ev.id  = getEventHash(ev)
  ev.sig = signNostrEvent(ev, privKeyHex)
  return ev
}

function getRelays() {
  return {
    'wss://relay.shadowbip.com':  { read:true, write:true },
    'wss://relay.damus.io':       { read:true, write:true },
    'wss://relay.nostr.band':     { read:true, write:true },
    'wss://nos.lol':              { read:true, write:true },
    'wss://relay.snort.social':   { read:true, write:true },
    'wss://nostr.wine':           { read:true, write:false },
  }
}

module.exports = { createProfile, importNsec, getProfile, getPubkey, signEvent, getRelays }
