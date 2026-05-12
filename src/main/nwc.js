'use strict'

const WebSocket = require('ws')
const { getPublicKey, getSignature, getEventHash, nip04 } = require('nostr-tools')
const { hexToBytes } = require('@noble/hashes/utils')
const keychain = require('./keychain')
let activeWs     = null
let activeConn   = null
let pendingCalls = new Map()
async function decryptStoredSecret(row) {
  if (row.encrypted_secret) {
    const key = await keychain.getOrCreateKey()
    return keychain.decrypt(row.encrypted_secret, key)
  }

  // Backward compatibility with older databases
  return row.secret
}
function parseNwcUri(uri) {
  const normalised = uri.trim()
    .replace('nostr+walletconnect://', 'nwc://')
    .replace('nostr+walletconnect:',   'nwc://')
  const u      = new URL(normalised.startsWith('nwc://') ? normalised : 'nwc://' + normalised)
  const pubkey = u.hostname
  const relay  = u.searchParams.get('relay')
  const secret = u.searchParams.get('secret')
  if (!relay || !secret || !pubkey) throw new Error('Invalid NWC URI')
  return { pubkey, relay, secret }
}

function openWs(relayUrl, walletPubkey, secretHex) {
  return new Promise((resolve, reject) => {
    if (activeWs) { try { activeWs.close() } catch (_) {} activeWs = null }

    const ws      = new WebSocket(relayUrl)
    const timeout = setTimeout(() => reject(new Error('Relay connection timeout')), 10000)

    ws.on('open', () => {
      clearTimeout(timeout)
      activeWs = ws
      const ourPubkey = getPublicKey(hexToBytes(secretHex))
      ws.send(JSON.stringify(['REQ', 'nwc-sub', { kinds: [23195], '#p': [ourPubkey], limit: 0 }]))
      resolve(ws)
    })

    ws.on('message', async (data) => {
      try {
        const msg = JSON.parse(data.toString())
        if (msg[0] !== 'EVENT') return

        const event = msg[2]
        if (!event || event.kind !== 23195) return

        const decrypted = await nip04.decrypt(secretHex, walletPubkey, event.content)
        const response  = JSON.parse(decrypted)

        const requestTag = Array.isArray(event.tags)
          ? event.tags.find(t => Array.isArray(t) && t[0] === 'e')
          : null

        const requestId = requestTag?.[1]

        let pending = requestId ? pendingCalls.get(requestId) : null
        let pendingKey = requestId

        // Legacy fallback for wallet services that do not return an e tag.
        // Only safe when exactly one request is pending.
        if (!pending) {
          if (pendingCalls.size !== 1) {
            console.warn('[NWC] Response without request correlation ignored', {
              requestId,
              pending: pendingCalls.size,
            })
            return
          }

          const first = pendingCalls.entries().next()
          if (first.done) return

          pendingKey = first.value[0]
          pending = first.value[1]
        }

        clearTimeout(pending.timer)

        if (response.error) {
          pending.reject(new Error(response.error.message || 'NWC error'))
        } else {
          pending.resolve(response.result)
        }

        pendingCalls.delete(pendingKey)
      } catch (err) {
        console.error('[NWC] Failed to process response:', err.message)
      }
    })

    ws.on('error', (err) => { clearTimeout(timeout); reject(err) })
    ws.on('close', () => {
      activeWs = null
      for (const [, p] of pendingCalls) {
        clearTimeout(p.timer)
        p.reject(new Error('WebSocket closed'))
      }
      pendingCalls.clear()
    })
  })
}

async function nwcRequest(method, params = {}) {
  if (!activeWs || activeWs.readyState !== WebSocket.OPEN) {
    throw new Error('NWC not connected')
  }
  if (!activeConn) throw new Error('No active NWC connection')

  const { wallet_pubkey, secret } = activeConn
  const encrypted = await nip04.encrypt(secret, wallet_pubkey, JSON.stringify({ method, params }))
  const pubkey    = getPublicKey(hexToBytes(secret))

  const event  = { kind: 23194, created_at: Math.floor(Date.now() / 1000), tags: [['p', wallet_pubkey]], content: encrypted, pubkey }
  event.id     = getEventHash(event)
  event.sig    = getSignature(event, secret)

  return new Promise((resolve, reject) => {
    const requestId = event.id

    const timer = setTimeout(() => {
      pendingCalls.delete(requestId)
      reject(new Error(`NWC request timed out: ${method}`))
    }, 30000)

    pendingCalls.set(requestId, {
      method,
      resolve,
      reject,
      timer,
      createdAt: Date.now(),
    })

    activeWs.send(JSON.stringify(['EVENT', event]))
  })
}


async function connect(DB, { nwcUri, name }) {
  const parsed = parseNwcUri(nwcUri)

  await openWs(parsed.relay, parsed.pubkey, parsed.secret)

  const key = await keychain.getOrCreateKey()
  const encryptedSecret = keychain.encrypt(parsed.secret, key)

  const db = DB._db()

  db.prepare('UPDATE nwc_connections SET active=0').run()

  const r = db
    .prepare(`
      INSERT INTO nwc_connections
      (name, relay_url, wallet_pubkey, secret, encrypted_secret, active, created_at)
      VALUES (?, ?, ?, ?, ?, 1, ?)
    `)
    .run(
      name || 'My node',
      parsed.relay,
      parsed.pubkey,
      '', // legacy field intentionally blank
      encryptedSecret,
      Math.floor(Date.now() / 1000)
    )

  activeConn = {
    relay_url: parsed.relay,
    wallet_pubkey: parsed.pubkey,
    secret: parsed.secret,
  }

  return {
    id: r.lastInsertRowid,
    name,
    relay: parsed.relay,
    pubkey: parsed.pubkey,
    active: true,
  }
}

async function reconnectFromDB(DB) {
  const row = DB._db()
    .prepare('SELECT * FROM nwc_connections WHERE active=1')
    .get()

  if (!row) return false

  try {
    const secret = await decryptStoredSecret(row)

    await openWs(
      row.relay_url,
      row.wallet_pubkey,
      secret
    )

    // Auto-migrate legacy plaintext entries
    if (!row.encrypted_secret && row.secret) {
      const key = await keychain.getOrCreateKey()
      const encryptedSecret = keychain.encrypt(row.secret, key)

      DB._db()
        .prepare(`
          UPDATE nwc_connections
          SET encrypted_secret = ?, secret = ''
          WHERE id = ?
        `)
        .run(encryptedSecret, row.id)
    }

    activeConn = {
      ...row,
      secret,
    }

    return true
  } catch (err) {
    console.error('Failed to reconnect NWC:', err.message)
    return false
  }
}







function disconnect(DB) {
  if (activeWs) { try { activeWs.close() } catch (_) {} activeWs = null }
  activeConn = null
  if (DB) DB._db().prepare('UPDATE nwc_connections SET active=0').run()
  return { ok: true }
}

function isConnected(DB) {
  if (!activeWs || activeWs.readyState !== WebSocket.OPEN) return false
  return DB._db().prepare('SELECT COUNT(*) as n FROM nwc_connections WHERE active=1').get().n > 0
}

async function getBalance(DB) {
  if (!isConnected(DB) && !(await reconnectFromDB(DB))) throw new Error('NWC not connected')
  const r = await nwcRequest('get_balance')
  return { balance: Math.floor((r.balance || 0) / 1000), unit: 'sat' }
}

async function payInvoice(DB, invoice) {
  if (!isConnected(DB) && !(await reconnectFromDB(DB))) throw new Error('NWC not connected')
  const r = await nwcRequest('pay_invoice', { invoice })
  return { success: true, preimage: r.preimage }
}

async function makeInvoice(DB, { amountMsat, description }) {
  if (!isConnected(DB) && !(await reconnectFromDB(DB))) throw new Error('NWC not connected')
  const r = await nwcRequest('make_invoice', { amount: amountMsat, description: description || '' })
  return { invoice: r.invoice }
}

function decodeInvoice(bolt11) {
  try {
    const match = bolt11.match(/^ln[a-z]+(\d+)([munp]?)/)
    if (!match) return { paymentRequest: bolt11, amountMsat: 0, description: '', expiry: 3600 }
    const multipliers = { m: 100000000, u: 100000, n: 100, p: 0.1 }
    const mult = multipliers[match[2]] ?? 100000000000
    return { paymentRequest: bolt11, amountMsat: Math.floor(parseInt(match[1]) * mult), description: '', expiry: 3600 }
  } catch (_) {
    return { paymentRequest: bolt11, amountMsat: 0, description: '', expiry: 3600 }
  }
}

module.exports = { connect, disconnect, isConnected, getBalance, payInvoice, makeInvoice, decodeInvoice, reconnectFromDB }
