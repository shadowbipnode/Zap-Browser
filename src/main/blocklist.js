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
  // Google infra
  'google.com','google.it','google.co.uk','google.de','google.fr','google.es',
  'google.com.br','google.ca','google.com.au','google.co.jp','google.nl',
  'googleapis.com','gstatic.com','googlevideo.com','googleusercontent.com',
  'googletagmanager.com', // permesso — blocchiamo solo i tracking ID nel path
  'fonts.googleapis.com','fonts.gstatic.com','accounts.google.com',
  'ssl.gstatic.com','maps.googleapis.com','maps.gstatic.com',
  // YouTube
  'youtube.com','ytimg.com','ggpht.com','youtube-nocookie.com','youtu.be',
  // CDN globali critici
  'cloudflare.com','cdnjs.cloudflare.com','cloudflare-dns.com',
  'fastly.net','fastlylb.net',
  'akamai.net','akamaized.net','akamaihd.net','akamai.com',
  'edgesuite.net','edgekey.net',
  'jsdelivr.net','unpkg.com',
  'bootstrapcdn.com','maxcdn.bootstrapcdn.com',
  'cloudfront.net','amazonaws.com','awsstatic.com','aws.amazon.com',
  'stackpath.com','stackpathdns.com','bootstrapcdn.com',
  // Font e asset
  'typekit.net','typekit.com','use.typekit.net','p.typekit.net',
  'use.fontawesome.com','fontawesome.com','fa.com',
  'fonts.com','monotype.com',
  // Immagini e media CDN
  'imgur.com','imageshack.com','photobucket.com',
  'gravatar.com','wp.com','wordpress.com','wordpress.org',
  'twimg.com','pbs.twimg.com',
  'cdninstagram.com','fbcdn.net',
  'redd.it','redditmedia.com','redditstatic.com','reddituploads.com',
  // Video player
  'jwplatform.com','jwpcdn.com','jwplayer.com',
  'brightcove.com','brightcove.net','boltdns.net',
  'vimeo.com','vimeocdn.com','vhx.tv',
  'dailymotion.com','dmcdn.net',
  'twitch.tv','twitchsvc.net','jtvnw.net',
  // Social
  'twitter.com','x.com','t.co',
  'instagram.com','facebook.com','fb.com',
  'linkedin.com','licdn.com',
  'reddit.com','redd.it',
  'pinterest.com','pinimg.com',
  'tiktok.com','tiktokcdn.com',
  // News italiani — contenuto e CDN
  'gedi.it','repstatic.it','gedidigital.it','gelocal.it','lediufficio.com',
  'rcs.it','rcsobjects.it','corriere.it','gazzetta.it','cdnrcs.it',
  'mediaset.it','mediasetplay.mediaset.it','digitalia.fm','tgcom24.it',
  'rai.it','rainews.it','raiplaysound.it','raiplay.it','raicdn.it',
  'virgilio.it','libero.it','italiaonline.it','alice.it','tin.it',
  'sky.it','skytg24.it','skysport.it','skyinitalia.it',
  'lastampa.it','ilsole24ore.com','sole24ore.com',
  'ansa.it','ansa.com','ansait.cdn-immedia.net',
  'fanpage.it','napolitoday.it','today.it',
  'ilgiornale.it','ilfoglio.it','linkiesta.it',
  'hdblog.it','hwupgrade.it','tom-hw.com','techradar.com',
  'calcioefinanza.it','pianetamilan.it','tuttointer.net',
  'gazzettadelsud.it','gazzettadiparma.it','gazzettadimodena.it',
  // News internazionali — contenuto e CDN
  'bbc.com','bbc.co.uk','bbci.co.uk','bbcimg.co.uk',
  'theguardian.com','guim.co.uk','guardianapps.co.uk',
  'cnn.com','cnn.it','turner.com','tbs.com','hbo.com',
  'nytimes.com','nyt.com','nyti.ms',
  'washingtonpost.com','wpengine.com',
  'wsj.com','wsj.net','dowjoneson.com','barrons.com',
  'reuters.com','thomsonreuters.com',
  'apnews.com','ap.org',
  'bloomberg.com','bwbx.io','bloomberg.net',
  'forbes.com','forbesimg.com',
  'businessinsider.com','insider.com',
  'theverge.com','vox.com','voxmedia.com',
  'wired.com','conde.io','condenast.com',
  'techcrunch.com','aol.com',
  'huffpost.com','buzzfeed.com','buzzfeednews.com',
  'vice.com','vice.media',
  'politico.com','politico.eu',
  'lemonde.fr','lefigaro.fr','liberation.fr',
  'elpais.com','elmundo.es','elconfidencial.com',
  'spiegel.de','zeit.de','faz.net',
  'correiobraziliense.com.br','globo.com','g1.com.br',
  // Dev e tech
  'github.com','githubusercontent.com','githubassets.com','github.io',
  'gitlab.com','bitbucket.org',
  'stackoverflow.com','sstatic.net','stackexchange.com',
  'npmjs.com','npmjs.org','yarnpkg.com',
  'pypi.org','python.org',
  'developer.mozilla.org','mozilla.org','firefox.com',
  // E-commerce (immagini prodotti)
  'amazon.com','amazon.it','amazon.co.uk','amazon.de',
  'ssl-images-amazon.com','media-amazon.com','images-amazon.com',
  'ebay.com','ebayimg.com','ebaystatic.com',
  // Mappe
  'openstreetmap.org','tile.openstreetmap.org',
  'here.com','mapbox.com','mapboxgl.com',
  // Browser e OS
  'microsoft.com','msftconnecttest.com','windowsupdate.com',
  'apple.com','icloud.com','mzstatic.com','itunes.com',
  'duckduckgo.com','ddg.gg',
  // Bitcoin/Nostr/Crypto
  'shadowbip.com','relay.shadowbip.com',
  'primal.net','damus.io','snort.social',
  'stacker.news','mempool.space','blockstream.info',
  'lnmarkets.com','bitrefill.com','robosats.com',
  'coinos.io','minibits.cash','legend.lnbits.com',
  'bitcoin.org','bitcoinmagazine.com',
  // Misc
  'recaptcha.net','gstatic.com',
  'disqus.com','disquscdn.com',
  'cloudinary.com','imgix.net','imagekit.io',
  'giphy.com','gfycat.com',
  'spotify.com','scdn.co',
  'soundcloud.com','sndcdn.com',
  'medium.com','miro.medium.com',
])

let blockSet    = new Set()
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
  const domains = new Set()
  const allow   = new Set()
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
    if (line.includes('##') || line.includes('#@#') || line.includes('#?#')) continue
    // Dominio puro ||example.com^
    if (line.startsWith('||') && line.includes('^')) {
      const dom = line.slice(2).split('^')[0].split('/')[0].split('$')[0].toLowerCase()
      if (dom.includes('.') && !dom.includes('*') && !dom.includes(' ') && dom.length > 4) {
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
  // Rimuovi eccezioni @@ dalla blocklist
  for (const d of allow) total.delete(d)
  // Rimuovi anche tutti i domini della WHITELIST
  for (const d of WHITELIST) total.delete(d)
  blockSet = total
  allowSet = allow
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

  // 1. Whitelist — mai bloccare
  if (WHITELIST.has(host)) return false
  const parts = host.split('.')
  for (let i = 1; i < parts.length; i++) {
    if (WHITELIST.has(parts.slice(i).join('.'))) return false
  }

  // 2. Eccezioni @@ dalle liste
  if (allowSet.has(host)) return false

  // 3. Blocca dominio puro dalla lista
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
