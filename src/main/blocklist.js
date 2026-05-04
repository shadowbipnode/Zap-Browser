'use strict'

const fs   = require('fs')
const path = require('path')
const http = require('https')
const { app } = require('electron')

const LISTS = [
  { name: 'easylist',       url: 'https://easylist.to/easylist/easylist.txt' },
  { name: 'easyprivacy',    url: 'https://easylist.to/easylist/easyprivacy.txt' },
  { name: 'ublock',         url: 'https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/filters.txt' },
  { name: 'ublock-privacy', url: 'https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/privacy.txt' },
]

const WHITELIST = new Set([
  'google.com','google.it','google.co.uk','googleapis.com','gstatic.com',
  'youtube.com','ytimg.com','ggpht.com','googlevideo.com',
  'cloudflare.com','cloudflare-dns.com','cdnjs.cloudflare.com',
  'github.com','githubusercontent.com','githubassets.com',
  'apple.com','icloud.com','microsoft.com','bing.com',
  'mozilla.org','firefox.com','duckduckgo.com',
  'nostr.com','primal.net','damus.io','snort.social','stacker.news',
  'mempool.space','lnmarkets.com','bitrefill.com','robosats.com',
  'shadowbip.com','relay.shadowbip.com',
  'libero.it','mail.libero.it',
  'repubblica.it','repstatic.it','gedi.it',
  'corriere.it','rcsobjects.it',
  'sky.it','skytg24.it',
  'gazzetta.it','rcs.it',
])

let blockSet   = new Set()
let blockRegex = []
let initialized = false
let blockedCount = 0

function getDataDir() {
  try { return app.getPath('userData') } catch(_) { return '/tmp' }
}

function download(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, { timeout: 15000 }, res => {
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
  const regexes = []
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim()
    if (!line || line.startsWith('!') || line.startsWith('#') ||
        line.startsWith('@@') || line.includes('##') || line.includes('#@#')) continue
    if (line.startsWith('||') && line.includes('^')) {
      const domain = line.slice(2).split('^')[0].split('/')[0].toLowerCase()
      if (domain && !domain.includes('*') && domain.includes('.')) domains.add(domain)
      continue
    }
    if (line.startsWith('/') && line.endsWith('/')) {
      try { regexes.push(new RegExp(line.slice(1,-1))) } catch(_) {}
    }
  }
  return { domains, regexes }
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
  try { fs.writeFileSync(path.join(getDataDir(), `blocklist_${name}.txt`), text, 'utf8') } catch(_) {}
}

async function init(onReady) {
  console.log('[Blocklist] Inizializzazione...')
  const total = new Set()
  const regex = []

  for (const list of LISTS) {
    const cached = loadCache(list.name)
    if (cached) {
      const { domains, regexes } = parseList(cached)
      domains.forEach(d => total.add(d))
      regex.push(...regexes)
      console.log(`[Blocklist] Cache ${list.name}: ${domains.size} domini`)
    }
  }

  if (total.size > 0) {
    blockSet = total; blockRegex = regex; initialized = true
    console.log(`[Blocklist] Pronto da cache: ${blockSet.size} domini totali`)
    if (onReady) onReady(blockSet.size)
  }

  setTimeout(() => updateLists(onReady), 2000)
}

async function updateLists(onReady) {
  console.log('[Blocklist] Aggiornamento liste online...')
  const total = new Set()
  const regex = []

  for (const list of LISTS) {
    try {
      const text = await download(list.url)
      saveCache(list.name, text)
      const { domains, regexes } = parseList(text)
      domains.forEach(d => total.add(d))
      regex.push(...regexes)
      console.log(`[Blocklist] ${list.name}: ${domains.size} domini`)
    } catch(e) {
      console.log(`[Blocklist] ${list.name} fallito: ${e.message}`)
      const cached = loadCache(list.name)
      if (cached) {
        const { domains, regexes } = parseList(cached)
        domains.forEach(d => total.add(d))
        regex.push(...regexes)
      }
    }
  }

  blockSet = total; blockRegex = regex; initialized = true
  console.log(`[Blocklist] Aggiornato: ${blockSet.size} domini totali`)
  if (onReady) onReady(blockSet.size)
}

function shouldBlock(url) {
  if (!initialized) return false
  try {
    const host = new URL(url).hostname.replace(/^www\./, '').toLowerCase()

    // Whitelist — mai bloccare
    if (WHITELIST.has(host)) return false
    const parts = host.split('.')
    for (let i = 1; i < parts.length; i++) {
      if (WHITELIST.has(parts.slice(i).join('.'))) return false
    }

    // Check blocklist
    if (blockSet.has(host)) return true
    for (let i = 1; i < parts.length - 1; i++) {
      if (blockSet.has(parts.slice(i).join('.'))) return true
    }
  } catch(_) {}
  return false
}

function incrementBlocked() { blockedCount++ }
function getBlockedCount()  { return blockedCount }
function getListSize()      { return blockSet.size }
function isReady()          { return initialized }

module.exports = { init, shouldBlock, incrementBlocked, getBlockedCount, getListSize, isReady }
