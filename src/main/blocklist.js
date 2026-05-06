'use strict'
// Zap Browser — Ad Block Engine v2
// Approccio conservativo: blocca solo domini puri di tracker/ads noti
// Non blocca CDN, risorse, immagini di siti legittimi

const fs    = require('fs')
const path  = require('path')
const https = require('https')
const { app } = require('electron')

const LISTS = [
  { name: 'easylist',       url: 'https://easylist.to/easylist/easylist.txt' },
  { name: 'easyprivacy',    url: 'https://easylist.to/easylist/easyprivacy.txt' },
  { name: 'ublock',         url: 'https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/filters.txt' },
  { name: 'ublock-privacy', url: 'https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/privacy.txt' },
]

// Domini SEMPRE permessi — mai bloccare
// Include CDN globali, news, immagini, font ecc.
const WHITELIST = new Set([
  // Solo infrastruttura critica — CDN, font, browser
  'gstatic.com','fonts.googleapis.com','fonts.gstatic.com',
  'accounts.google.com','ssl.gstatic.com',
  'cloudflare.com','cdnjs.cloudflare.com',
  'fastly.net','akamai.net','akamaized.net','akamaihd.net',
  'jsdelivr.net','unpkg.com',
  'cloudfront.net','amazonaws.com',
  'typekit.net','use.typekit.net',
  'use.fontawesome.com',
  'jwplatform.com','jwpcdn.com',
  'vimeo.com','vimeocdn.com',
  'github.com','githubusercontent.com',
  'mozilla.org','apple.com','microsoft.com',
  'duckduckgo.com',
  'youtube.com','youtu.be','ytimg.com','yt3.ggpht.com',
  'googlevideo.com','youtube-nocookie.com',
  // Bitcoin/Nostr
  'shadowbip.com','primal.net','damus.io',
  'snort.social','stacker.news','mempool.space',
])

let blockSet    = new Set()
let cosmeticRules = []  // selettori CSS da nascondere

// Selettori hardcoded per ads comuni — funzionano su qualsiasi sito
const HARDCODED_COSMETIC = [
  // Google AdSense / DoubleClick
  'ins.adsbygoogle',
  'ins[data-ad-client]',
  'ins[data-ad-slot]',
  '.adsbygoogle',
  'iframe[src*="doubleclick.net"]',
  'iframe[src*="googlesyndication"]',
  'iframe[src*="googleadservices"]',
  'div[id^="google_ads_"]',
  'div[id^="div-gpt-ad"]',
  'div[class*="google-ad"]',
  // Banner generici
  'div[id*="banner-ad"]',
  'div[class*="banner-ad"]',
  'div[id*="ad-banner"]',
  'div[class*="ad-banner"]',
  'div[id*="advertisement"]',
  'div[class*="advertisement"]',
  'div[id*="leaderboard"]',
  'div[class*="leaderboard"]',
  // Outbrain/Taboola
  'div[id^="outbrain"]',
  'div[class*="outbrain"]',
  'div[id^="taboola"]',
  'div[class*="taboola"]',
  // Slot generici
  '[data-ad]',
  '[data-advertisement]',
  '[data-google-query-id]',
]
let allowSet    = new Set()
let initialized = false
let blockedCount = 0

function getDataDir() {
  try { return app.getPath('userData') } catch(_) { return '/tmp' }
}

function download(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: 20000 }, res => {
      if (res.statusCode !== 200) { reject(new Error(`HTTP ${res.statusCode}`)); return }
      const chunks = []
      res.on('data', c => chunks.push(c))
      res.on('end',  () => resolve(Buffer.concat(chunks).toString('utf8')))
    })
    req.on('error', reject)
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')) })
  })
}

function parseList(text) {
  const domains    = new Set()
  const allow      = new Set()
  const cosmetic   = []
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim()
    if (!line || line.startsWith('!') || line.startsWith('#')) continue
    // Eccezioni @@ — sempre permetti
    if (line.startsWith('@@||') && line.includes('^')) {
      const dom = line.slice(4).split('^')[0].split('/')[0].split('$')[0].toLowerCase()
      if (dom.includes('.') && !dom.includes('*')) allow.add(dom)
      continue
    }
    if (line.startsWith('@@')) continue
    // Regole cosmetic: ##.classe o ###id — nascondi elementi HTML
    if (line.includes('##') && !line.startsWith('!') && !line.startsWith('@@')) {
      const idx = line.indexOf('##')
      const selector = line.slice(idx + 2).trim()
      if (selector && !selector.includes(':has(') && !selector.includes(':-') &&
          !selector.includes(':xpath') && selector.length < 200) {
        cosmetic.push(selector)
      }
      continue
    }
    if (line.includes('#@#') || line.includes('#?#')) continue
    // Dominio puro ||example.com^ — solo se NON ha path specifico
    if (line.startsWith('||') && line.includes('^')) {
      const afterPipes  = line.slice(2)
      const caretIdx    = afterPipes.indexOf('^')
      const beforeCaret = afterPipes.slice(0, caretIdx)
      const afterCaret  = afterPipes.slice(caretIdx + 1)
      // Skip se ha path PRIMA del ^ es: ||example.com/ads^
      const hasPathBefore = beforeCaret.includes('/')
      // Skip se ha path DOPO il ^ es: ||gazzetta.it^*/stats.php?
      const hasPathAfter  = afterCaret.length > 0 && afterCaret[0] !== '$'
      if (!hasPathBefore && !hasPathAfter) {
        const dom = beforeCaret.split('$')[0].toLowerCase()
        if (dom.includes('.') && !dom.includes('*') && !dom.includes(' ') && dom.length > 4) {
          domains.add(dom)
        }
      }
    }
  }
  return { domains, allow, cosmeticSelectors: cosmetic }
}

function loadCache(name) {
  try {
    const file = path.join(getDataDir(), `blocklist_${name}.txt`)
    if (!fs.existsSync(file)) return null
    const ageH = (Date.now() - fs.statSync(file).mtimeMs) / 3600000
    if (ageH > 24) return null
    return fs.readFileSync(file, 'utf8')
  } catch(_) { return null }
}

function saveCache(name, text) {
  try { fs.writeFileSync(path.join(getDataDir(), `blocklist_${name}.txt`), text) } catch(_) {}
}

function applyResults(results) {
  const total = new Set()
  const allow = new Set()
  const cosmetic = []
  for (const r of results) {
    r.domains.forEach(d => total.add(d))
    r.allow.forEach(d => allow.add(d))
    if (r.cosmeticSelectors) cosmetic.push(...r.cosmeticSelectors)
  }
  for (const d of allow) total.delete(d)
  for (const d of WHITELIST) total.delete(d)
  blockSet = total
  allowSet = allow
  cosmeticRules = [...new Set(cosmetic)]  // dedup
  console.log(`[Blocklist] Regole cosmetic: ${cosmeticRules.length}`)
}

async function init(onReady) {
  console.log('[Blocklist] Inizializzazione...')
  const results = []
  for (const list of LISTS) {
    const cached = loadCache(list.name)
    if (cached) {
      results.push(parseList(cached))
      console.log(`[Blocklist] Cache ${list.name} OK`)
    }
  }
  if (results.length > 0) {
    applyResults(results)
    initialized = true
    console.log(`[Blocklist] Pronto: ${blockSet.size} domini`)
    if (onReady) onReady(blockSet.size)
  }
  setTimeout(() => updateLists(onReady), 3000)
}

async function updateLists(onReady) {
  const results = []
  for (const list of LISTS) {
    try {
      const text = await download(list.url)
      saveCache(list.name, text)
      results.push(parseList(text))
      console.log(`[Blocklist] Scaricato ${list.name}`)
    } catch(e) {
      console.log(`[Blocklist] ${list.name} fallito: ${e.message}`)
      const cached = loadCache(list.name)
      if (cached) results.push(parseList(cached))
    }
  }
  applyResults(results)
  initialized = true
  console.log(`[Blocklist] Aggiornato: ${blockSet.size} domini`)
  if (onReady) onReady(blockSet.size)
}

function getBaseDomain(hostname) {
  // Estrai dominio base: sub.example.co.uk -> example.co.uk
  const parts = hostname.split('.')
  if (parts.length <= 2) return hostname
  // Gestisci TLD doppi comuni
  const twoPartTlds = ['co.uk','co.it','com.br','co.jp','co.au','co.nz','co.za','com.ar','com.mx']
  const lastTwo = parts.slice(-2).join('.')
  if (twoPartTlds.includes(lastTwo)) return parts.slice(-3).join('.')
  return parts.slice(-2).join('.')
}

function shouldBlock(url, pageUrl) {
  if (!initialized) return false
  let host, pageHost, pageBase
  try {
    host = new URL(url).hostname.replace(/^www\./, '').toLowerCase()
    if (pageUrl) {
      pageHost = new URL(pageUrl).hostname.replace(/^www\./, '').toLowerCase()
      pageBase = getBaseDomain(pageHost)
    }
  } catch(_) { return false }

  const hostBase = getBaseDomain(host)

  // 1. Se stesso dominio base della pagina → SEMPRE permetti
  // Es: gazzettaobjects.it richiesto da gazzetta.it → stesso gruppo RCS
  if (pageBase && hostBase === pageBase) return false

  // 2. Whitelist hardcoded — infrastruttura critica
  if (WHITELIST.has(host)) return false
  const parts = host.split('.')
  for (let i = 1; i < parts.length; i++) {
    if (WHITELIST.has(parts.slice(i).join('.'))) return false
  }

  // 3. Eccezioni @@ dalle liste
  if (allowSet.has(host)) return false
  for (let i = 1; i < parts.length - 1; i++) {
    if (allowSet.has(parts.slice(i).join('.'))) return false
  }

  // 4. Blocca solo se nella blocklist (tracker/ads noti)
  if (blockSet.has(host)) return true
  for (let i = 1; i < parts.length - 1; i++) {
    if (blockSet.has(parts.slice(i).join('.'))) return true
  }

  return false
}

function incrementBlocked() { blockedCount++ }
function getBlockedCount()  { return blockedCount }
function getListSize()      { return blockSet.size }
function isReady()          { return initialized }

function getCosmeticCSS() {
  const all = [...HARDCODED_COSMETIC, ...cosmeticRules]
  if (all.length === 0) return ''
  return all.join(', ') + ' { display: none !important; visibility: hidden !important; }'
}

module.exports = { init, shouldBlock, incrementBlocked, getBlockedCount, getListSize, isReady, getCosmeticCSS }
