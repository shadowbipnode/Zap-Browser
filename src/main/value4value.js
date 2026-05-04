// src/main/value4value.js
// Value4Value — micropagamenti automatici ai creator
// Legge meta tag <meta name="lightning" content="lnurl...">
// e <meta name="value" ...> (Podcasting 2.0)

'use strict'

let activePayments = new Map()  // url -> { lnurl, amount, lastPaid }
let autoPayEnabled = false
let autoPayAmount  = 10  // sats per minuto default
let nwcModule      = null

function init(nwc) { nwcModule = nwc }

function setAutoPayEnabled(v) { autoPayEnabled = v }
function setAutoPayAmount(n)  { autoPayAmount = n }
function isAutoPayEnabled()   { return autoPayEnabled }
function getAutoPayAmount()   { return autoPayAmount }

// Parsea meta tag Value4Value da HTML
function parseV4VTags(html) {
  const result = { lightning: null, lnurl: null, nostrPubkey: null }

  // <meta name="lightning" content="lnurl1...">
  const lightningMatch = html.match(/<meta[^>]+name=["']lightning["'][^>]+content=["']([^"']+)["']/i)
  if (lightningMatch) result.lightning = lightningMatch[1]

  // <meta name="nostr" content="npub1...">
  const nostrMatch = html.match(/<meta[^>]+name=["']nostr["'][^>]+content=["']([^"']+)["']/i)
  if (nostrMatch) result.nostrPubkey = nostrMatch[1]

  // Link rel="payment"
  const paymentLink = html.match(/<link[^>]+rel=["']payment["'][^>]+href=["']([^"']+)["']/i)
  if (paymentLink) result.lnurl = paymentLink[1]

  return result
}

// Controlla se una pagina supporta V4V
async function checkPage(url, webContents) {
  try {
    const html = await webContents.executeJavaScript(`document.documentElement.outerHTML`)
    const tags = parseV4VTags(html)

    // Controlla anche window.webln e window.nostr
    const hasWebLN = await webContents.executeJavaScript(`!!window.webln`).catch(() => false)
    const hasNostr = await webContents.executeJavaScript(`!!window.nostr`).catch(() => false)

    return {
      supported: !!(tags.lightning || tags.lnurl || tags.nostrPubkey),
      lightning: tags.lightning,
      lnurl:     tags.lnurl,
      nostrPubkey: tags.nostrPubkey,
      hasWebLN,
      hasNostr,
    }
  } catch(_) {
    return { supported: false }
  }
}

// Invia un micropagamento alla pagina corrente
async function sendBoost(DB, amount, message) {
  if (!nwcModule) return { error: 'NWC non configurato' }
  try {
    // TODO: resolve LNURL → invoice → pay via NWC
    return { success: true, amount }
  } catch(e) {
    return { error: e.message }
  }
}

module.exports = {
  init, checkPage, sendBoost,
  setAutoPayEnabled, setAutoPayAmount,
  isAutoPayEnabled, getAutoPayAmount,
  parseV4VTags,
}
