// src/main/nwc.js
'use strict'

function parseNwcUri(uri) {
  const stripped = uri.trim()
    .replace('nostr+walletconnect://', 'nwc://')
    .replace('nostr+walletconnect:', 'nwc://')
  const url = new URL(stripped.startsWith('nwc://') ? stripped : 'nwc://' + stripped)
  const pubkey = url.hostname
  const relay  = url.searchParams.get('relay')
  const secret = url.searchParams.get('secret')
  if (!relay || !secret || !pubkey) throw new Error('NWC URI non valido — manca relay, secret o pubkey')
  return { pubkey, relay, secret }
}

function connect(DB, { nwcUri, name }) {
  const parsed = parseNwcUri(nwcUri)
  const db = DB._db()
  db.prepare('UPDATE nwc_connections SET active=0').run()
  const r = db.prepare(`INSERT INTO nwc_connections(name,relay_url,wallet_pubkey,secret,active,created_at)
    VALUES(?,?,?,?,1,?)`)
    .run(name || 'Il mio nodo', parsed.relay, parsed.pubkey, parsed.secret, Math.floor(Date.now()/1000))
  return { id: r.lastInsertRowid, name, relay: parsed.relay, pubkey: parsed.pubkey, active: true }
}

function disconnect(DB) {
  DB._db().prepare('UPDATE nwc_connections SET active=0').run()
  return { ok: true }
}

function isConnected(DB) {
  const row = DB._db().prepare('SELECT COUNT(*) as n FROM nwc_connections WHERE active=1').get()
  return row.n > 0
}

async function getBalance(DB) {
  // TODO: real NWC WebSocket NIP-47 get_balance request
  if (!isConnected(DB)) throw new Error('NWC non connesso')
  return { balance: 0, unit: 'sat' }
}

async function payInvoice(DB, invoice) {
  if (!isConnected(DB)) throw new Error('NWC non connesso')
  // TODO: real NIP-47 pay_invoice via WebSocket
  return { success: true, preimage: 'placeholder' }
}

async function makeInvoice(DB, { amountMsat, description }) {
  if (!isConnected(DB)) throw new Error('NWC non connesso')
  // TODO: real NIP-47 make_invoice
  return { invoice: `lnbc${amountMsat/1000}n1stub` }
}

function decodeInvoice(bolt11) {
  // TODO: real BOLT11 decode with bolt11 npm package
  return { paymentRequest: bolt11, amountMsat: 0, description: '', expiry: 3600 }
}

module.exports = { connect, disconnect, isConnected, getBalance, payInvoice, makeInvoice, decodeInvoice }
