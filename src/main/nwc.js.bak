// src/main/nwc.js — NWC reale con WebSocket + NIP-47
'use strict'

const WebSocket = require('ws')
const crypto    = require('crypto')
const { getPublicKey, getSignature, getEventHash, nip04 } = require('nostr-tools')
const { hexToBytes } = require('@noble/hashes/utils')

let activeWs     = null
let activeConn   = null
let pendingCalls = new Map()

function parseNwcUri(uri) {
  const s = uri.trim()
    .replace('nostr+walletconnect://', 'nwc://')
    .replace('nostr+walletconnect:',  'nwc://')
  const u = new URL(s.startsWith('nwc://') ? s : 'nwc://' + s)
  const pubkey = u.hostname
  const relay  = u.searchParams.get('relay')
  const secret = u.searchParams.get('secret')
  if (!relay || !secret || !pubkey) throw new Error('NWC URI non valido')
  return { pubkey, relay, secret }
}

function openWs(relayUrl, walletPubkey, secretHex) {
  return new Promise((resolve, reject) => {
    if (activeWs) { try { activeWs.close() } catch(_){} activeWs = null }
    const ws = new WebSocket(relayUrl)
    const timeout = setTimeout(() => reject(new Error('Timeout connessione relay')), 10000)

    ws.on('open', () => {
      clearTimeout(timeout)
      activeWs = ws
      const ourPubkey = getPublicKey(hexToBytes(secretHex))
      ws.send(JSON.stringify(['REQ', 'nwc-sub', { kinds:[23195], '#p':[ourPubkey], limit:0 }]))
      resolve(ws)
    })

    ws.on('message', async (data) => {
      try {
        const msg = JSON.parse(data.toString())
        console.log('[NWC] messaggio relay:', JSON.stringify(msg).slice(0,120))
        if (msg[0] !== 'EVENT') return
        const event = msg[2]
        if (event.kind !== 23195) return
        const decrypted = await nip04.decrypt(secretHex, walletPubkey, event.content)
        const response  = JSON.parse(decrypted)
        // Risolvi prima pending call disponibile
        for (const [key, p] of pendingCalls.entries()) {
          clearTimeout(p.timer)
          if (response.error) p.reject(new Error(response.error.message || 'NWC error'))
          else p.resolve(response.result)
          pendingCalls.delete(key)
          break
        }
      } catch(_) {}
    })

    ws.on('error', (err) => { clearTimeout(timeout); reject(err) })
    ws.on('close', () => {
      activeWs = null
      for (const [k,p] of pendingCalls) { clearTimeout(p.timer); p.reject(new Error('Connessione chiusa')) }
      pendingCalls.clear()
    })
  })
}

async function nwcRequest(method, params = {}) {
  if (!activeWs || activeWs.readyState !== WebSocket.OPEN) throw new Error('NWC non connesso')
  if (!activeConn) throw new Error('Nessuna connessione attiva')
  const { wallet_pubkey, secret } = activeConn
  const content   = JSON.stringify({ method, params })
  const encrypted = await nip04.encrypt(secret, wallet_pubkey, content)
  const pubkey = getPublicKey(hexToBytes(secret))
  const template = {
    kind: 23194,
    created_at: Math.floor(Date.now()/1000),
    tags: [['p', wallet_pubkey]],
    content: encrypted,
    pubkey,
  }
  template.id  = getEventHash(template)
  template.sig = getSignature(template, secret)
  const event  = template
  return new Promise((resolve, reject) => {
    const key   = method + '_' + Date.now()
    const timer = setTimeout(() => { pendingCalls.delete(key); reject(new Error(`Timeout ${method}`)) }, 15000)
    pendingCalls.set(key, { resolve, reject, timer })
    const payload = JSON.stringify(['EVENT', event])
    console.log('[NWC] invio evento:', payload.slice(0, 200))
    activeWs.send(payload)
  })
}

async function connect(DB, { nwcUri, name }) {
  const parsed = parseNwcUri(nwcUri)
  await openWs(parsed.relay, parsed.pubkey, parsed.secret)
  const db = DB._db()
  db.prepare('UPDATE nwc_connections SET active=0').run()
  const r = db.prepare('INSERT INTO nwc_connections(name,relay_url,wallet_pubkey,secret,active,created_at) VALUES(?,?,?,?,1,?)')
    .run(name||'Il mio nodo', parsed.relay, parsed.pubkey, parsed.secret, Math.floor(Date.now()/1000))
  activeConn = { relay_url: parsed.relay, wallet_pubkey: parsed.pubkey, secret: parsed.secret }
  return { id: r.lastInsertRowid, name, relay: parsed.relay, pubkey: parsed.pubkey, active: true }
}

async function reconnectFromDB(DB) {
  const row = DB._db().prepare('SELECT * FROM nwc_connections WHERE active=1').get()
  if (!row) return false
  try { await openWs(row.relay_url, row.wallet_pubkey, row.secret); activeConn = row; return true }
  catch(_) { return false }
}

function disconnect(DB) {
  if (activeWs) { try { activeWs.close() } catch(_){} activeWs = null }
  activeConn = null
  DB._db().prepare('UPDATE nwc_connections SET active=0').run()
  return { ok: true }
}

function isConnected(DB) {
  if (!activeWs || activeWs.readyState !== WebSocket.OPEN) return false
  return DB._db().prepare('SELECT COUNT(*) as n FROM nwc_connections WHERE active=1').get().n > 0
}

async function getBalance(DB) {
  if (!isConnected(DB)) { if (!(await reconnectFromDB(DB))) throw new Error('NWC non connesso') }
  const r = await nwcRequest('get_balance')
  return { balance: Math.floor((r.balance||0)/1000), unit:'sat' }
}

async function payInvoice(DB, invoice) {
  if (!isConnected(DB)) { if (!(await reconnectFromDB(DB))) throw new Error('NWC non connesso') }
  const r = await nwcRequest('pay_invoice', { invoice })
  return { success: true, preimage: r.preimage }
}

async function makeInvoice(DB, { amountMsat, description }) {
  if (!isConnected(DB)) { if (!(await reconnectFromDB(DB))) throw new Error('NWC non connesso') }
  const r = await nwcRequest('make_invoice', { amount: amountMsat, description: description||'' })
  return { invoice: r.invoice }
}

function decodeInvoice(bolt11) {
  try {
    const match = bolt11.match(/^ln[a-z]+(\d+)([munp]?)/)
    if (!match) return { paymentRequest:bolt11, amountMsat:0, description:'', expiry:3600 }
    const mult = { m:100000000, u:100000, n:100, p:0.1 }[match[2]] || 100000000000
    return { paymentRequest:bolt11, amountMsat:Math.floor(parseInt(match[1])*mult), description:'', expiry:3600 }
  } catch(_) { return { paymentRequest:bolt11, amountMsat:0, description:'', expiry:3600 } }
}

function disconnect(DB) {
  if (activeWs) { try { activeWs.close() } catch(_) {} activeWs = null }
  activeConn = null
  // Cancella connessione attiva dal DB
  if (DB) DB._db().prepare('UPDATE nwc_connections SET active=0').run()
  return { ok: true }
}

module.exports = { connect, disconnect, isConnected, getBalance, payInvoice, makeInvoice, decodeInvoice, reconnectFromDB }
