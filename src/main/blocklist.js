'use strict'

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

// Domini sempre permessi — CDN critici, infrastruttura, news
const WHITELIST = new Set([
  // Google infra (non ads)
  'gstatic.com','googleapis.com','googlevideo.com','googleusercontent.com',
  'fonts.googleapis.com','fonts.gstatic.com','accounts.google.com',
  // YouTube
  'youtube.com','ytimg.com','ggpht.com','youtube-nocookie.com',
  // CDN globali
  'cloudflare.com','cdnjs.cloudflare.com','cloudflare-dns.com',
  'fastly.net','akamai.net','akamaized.net','akamaihd.net',
  'jsdelivr.net','unpkg.com','bootstrapcdn.com',
  'cloudfront.net','amazonaws.com','awsstatic.com',
  'stackpath.com','stackpathdns.com',
  // Font
  'typekit.net','typekit.com','use.typekit.net',
  'use.fontawesome.com','fontawesome.com',
  // Video player
  'jwplatform.com','jwpcdn.com','jwplayer.com',
  'brightcove.com','brightcove.net',
  'vimeo.com','vimeocdn.com',
  // Social (contenuto, non tracking)
  'twimg.com','cdninstagram.com',
  // CMS e blog
  'wp.com','wordpress.com','wordpress.org','gravatar.com',
  // Italiani news CDN
  'gedi.it','repstatic.it','gedidigital.it','gelocal.it',
  'rcs.it','rcsobjects.it','corriere.it',
  'mediaset.it','mediasetplay.mediaset.it','digitalia.fm',
  'rai.it','rainews.it','raiplaysound.it',
  'virgilio.it','libero.it','italiaonline.it',
  'gazzetta.it','sport.sky.it','sky.it','skytg24.it',
  'lastampa.it','ilsole24ore.com','ilsole24ore.it',
  'ansa.it','tgcom24.mediaset.it','fanpage.it',
  'hdblog.it','hwupgrade.it','tom-hw.com',
  // Internazionali news CDN
  'bbci.co.uk','bbc.co.uk','bbc.com',
  'guim.co.uk','guardianapps.co.uk','theguardian.com',
  'turner.com','cnn.com','cnn.it',
  'nyt.com','nytimes.com',
  'wsj.net','wsj.com','dowjoneson.com',
  'reuters.com','apnews.com',
  'bloomberg.com','bwbx.io',
  // Dev e tech
  'github.com','githubusercontent.com','githubassets.com',
  'stackoverflow.com','sstatic.net',
  // Browser e OS
  'mozilla.org','firefox.com','microsoft.com',
  'apple.com','icloud.com','mzstatic.com',
  'duckduckgo.com',
  // Bitcoin/Nostr
  'shadowbip.com','primal.net','damus.io',
  'snort.social','stacker.news','mempool.space',
  'lnmarkets.com','bitrefill.com','robosats.com',
  'coinos.io','minibits.cash',
])

let blockSet     = new Set()
let allowSet     = new Set()  // eccezioni @@ dalle liste
let initialized  = false
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
  const domains = new Set()
  const allow   = new Set()

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim()
    if (!line || line.startsWith('!') || line.startsWith('#')) continue

    // Eccezione @@ — dominio da permettere sempre
    if (line.startsWith('@@||') && line.includes('^')) {
      const dom = line.slice(4).split('^')[0].split('/')[0].toLowerCase()
      if (dom.includes('.') && !dom.includes('*')) allow.add(dom)
      continue
    }
    if (line.startsWith('@@')) continue

    // Skip CSS/element hiding
    if (line.includes('##') || line.includes('#@#') ||
        line.includes('#?#') || line.includes('#$#')) continue

    // Dominio puro: ||example.com^
    if (line.startsWith('||') && line.includes('^')) {
      const body = line.slice(2)
      const dom  = body.split('^')[0].split('/')[0].split('$')[0].toLowerCase()
      if (dom.includes('.') && !dom.includes('*') &&
          !dom.includes(' ') && dom.length > 4) {
        domains.add(dom)
      }
    }
  }
  return { domains, allow }
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
  for (const r of results) {
    r.domains.forEach(d => total.add(d))
    r.allow.forEach(d => allow.add(d))
  }
  // Rimuovi dalla blocklist i domini nelle eccezioni @@
  for (const d of allow) total.delete(d)
  blockSet   = total
  allowSet   = allow
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

function shouldBlock(url) {
  if (!initialized) return false
  let host
  try { host = new URL(url).hostname.replace(/^www\./, '').toLowerCase() }
  catch(_) { return false }

  // 1. Whitelist hardcoded — mai bloccare
  if (WHITELIST.has(host)) return false
  const parts = host.split('.')
  for (let i = 1; i < parts.length; i++) {
    if (WHITELIST.has(parts.slice(i).join('.'))) return false
  }

  // 2. Eccezioni @@ dalle liste
  if (allowSet.has(host)) return false

  // 3. Blocca dominio puro
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

module.exports = { init, shouldBlock, incrementBlocked, getBlockedCount, getListSize, isReady }
