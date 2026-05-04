'use strict'

const nostrTools = require('nostr-tools')
const { getPublicKey, getEventHash, nip19 } = nostrTools

const { hmac }   = require('@noble/hashes/hmac')
const { sha256 } = require('@noble/hashes/sha256')
const { bytesToHex } = require('@noble/hashes/utils')

function deriveNostrKey(seedHex) {
  const s = typeof seedHex === 'string' ? seedHex : Buffer.from(seedHex).toString('hex')
  const seed = Buffer.from(s.slice(0, 64), 'hex')
  const key  = hmac(sha256, seed, Buffer.from('Nostr seed'))
  return bytesToHex(key.slice(0, 32))
}

function signEv(event, privKey) {
  // Normalizza: accetta sia hex string che Uint8Array
  const privKeyHex = typeof privKey === 'string' ? privKey : bytesToHex(privKey)
  try {
    if (typeof nostrTools.signEvent === 'function') {
      event.id  = getEventHash(event)
      event.sig = nostrTools.signEvent(event, privKeyHex)
      return event
    }
    if (typeof nostrTools.finalizeEvent === 'function') {
      return nostrTools.finalizeEvent(event, Buffer.from(privKeyHex, 'hex'))
    }
    if (typeof nostrTools.getSignature === 'function') {
      event.id  = getEventHash(event)
      event.sig = nostrTools.getSignature(event, privKeyHex)
      return event
    }
    throw new Error('Nessuna funzione di firma trovata in nostr-tools')
  } catch(e) {
    throw new Error('signEvent failed: ' + e.message)
  }
}



function createProfile(DB, { seedHex, name, about }) {
  const privKeyHex = deriveNostrKey(seedHex)
  const pubKeyHex  = getPublicKey(privKeyHex)
  const npub       = nip19.npubEncode(pubKeyHex)

  DB._db().prepare(`INSERT OR REPLACE INTO nostr_profile
    (id,pubkey,npub,encrypted_nsec,name,about,created_at) VALUES(1,?,?,?,?,?,?)`)
    .run(pubKeyHex, npub, privKeyHex, name||'anon', about||null, Math.floor(Date.now()/1000))

  return { pubkey: pubKeyHex, npub, name, about }
}

function importNsec(DB, { nsec, name }) {
  let privKeyHex
  try {
    const decoded = nip19.decode(nsec.trim())
    privKeyHex = decoded.data
  } catch(_) {
    privKeyHex = nsec.trim().replace(/^0x/, '')
  }
  const pubKeyHex = getPublicKey(privKeyHex)
  const npub      = nip19.npubEncode(pubKeyHex)

  DB._db().prepare(`INSERT OR REPLACE INTO nostr_profile
    (id,pubkey,npub,encrypted_nsec,name,created_at) VALUES(1,?,?,?,?,?)`)
    .run(pubKeyHex, npub, privKeyHex, name||'anon', Math.floor(Date.now()/1000))

  return { pubkey: pubKeyHex, npub, name }
}

function getProfile(DB) {
  return DB._db().prepare('SELECT pubkey,npub,name,about,picture,nip05 FROM nostr_profile WHERE id=1').get()||null
}

function getPubkey(DB) { const p=getProfile(DB); return p?p.pubkey:null }

function signEvent(DB, event) {
  const row = DB._db().prepare('SELECT encrypted_nsec FROM nostr_profile WHERE id=1').get()
  if (!row) throw new Error('Nessun profilo Nostr')
  const privKeyHex = row.encrypted_nsec
  const pubkey     = getPublicKey(privKeyHex)
  return signEv({
    kind:       event.kind    || 1,
    pubkey,
    tags:       event.tags    || [],
    content:    event.content || '',
    created_at: event.created_at || Math.floor(Date.now()/1000),
  }, privKeyHex)
}

function getRelays() {
  return {
    'wss://relay.shadowbip.com':  {read:true,write:true},
    'wss://relay.damus.io':       {read:true,write:true},
    'wss://relay.nostr.band':     {read:true,write:true},
    'wss://nos.lol':              {read:true,write:true},
    'wss://relay.snort.social':   {read:true,write:true},
    'wss://nostr.wine':           {read:true,write:false},
  }
}

module.exports = { createProfile, importNsec, getProfile, getPubkey, signEvent, getRelays }
