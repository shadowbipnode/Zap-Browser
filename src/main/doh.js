// src/main/doh.js
// DNS over HTTPS — intercetta richieste DNS e le risolve via HTTPS
// Usa Cloudflare (1.1.1.1) o provider configurato

'use strict'

const https = require('https')
const cache = new Map()  // hostname -> { ips, expiry }

const DOH_PROVIDERS = {
  cloudflare: 'https://cloudflare-dns.com/dns-query',
  google:     'https://dns.google/dns-query',
  quad9:      'https://dns.quad9.net/dns-query',
}

let currentProvider = 'cloudflare'
let enabled = true

function setProvider(name) {
  if (DOH_PROVIDERS[name]) currentProvider = name
}

function setEnabled(v) { enabled = v }
function isEnabled()   { return enabled }

// Risolvi hostname via DoH
function resolve(hostname) {
  return new Promise((resolve, reject) => {
    // Check cache
    const cached = cache.get(hostname)
    if (cached && cached.expiry > Date.now()) {
      return resolve(cached.ips)
    }

    const url = `${DOH_PROVIDERS[currentProvider]}?name=${encodeURIComponent(hostname)}&type=A`
    const req = https.get(url, {
      headers: { 'Accept': 'application/dns-json' },
      timeout: 3000,
    }, res => {
      const chunks = []
      res.on('data', c => chunks.push(c))
      res.on('end', () => {
        try {
          const data = JSON.parse(Buffer.concat(chunks).toString())
          const ips = (data.Answer || [])
            .filter(r => r.type === 1)  // A record
            .map(r => r.data)
          if (ips.length > 0) {
            cache.set(hostname, { ips, expiry: Date.now() + 300000 }) // 5min TTL
          }
          resolve(ips)
        } catch(e) { reject(e) }
      })
    })
    req.on('error', reject)
    req.on('timeout', () => { req.destroy(); reject(new Error('DoH timeout')) })
  })
}

// Svuota cache
function clearCache() { cache.clear() }

module.exports = { resolve, setProvider, setEnabled, isEnabled, clearCache, DOH_PROVIDERS }
