'use strict'

const { contextBridge, ipcRenderer } = require('electron')

// Prevent WebRTC from leaking the real IP address by removing ICE servers.
// This means WebRTC still works (e.g. for video calls) but won't reveal the
// user's IP to arbitrary third-party STUN servers.
const OrigRTC = window.RTCPeerConnection || window.webkitRTCPeerConnection
if (OrigRTC) {
  const PrivateRTC = function (config) {
    if (config && config.iceServers) config.iceServers = []
    return new OrigRTC(config)
  }
  PrivateRTC.prototype = OrigRTC.prototype
  window.RTCPeerConnection = PrivateRTC
  if (window.webkitRTCPeerConnection) window.webkitRTCPeerConnection = PrivateRTC
}

// Allow pages to open links in a new tab via middle-click (handled in main)
contextBridge.exposeInMainWorld('__zapOpenNewTab', (url) => {
  ipcRenderer.invoke('open-in-new-tab', { url })
})

// Global middle-click support inside web pages.
// Opens normal links in a new Zap Browser foreground tab.
// Strong dedupe prevents duplicate tab creation from complex news sites.
window.addEventListener('auxclick', (event) => {
  if (event.button !== 1) return

  const target = event.target
  const link = target?.closest?.('a[href]')
  if (!link) return

  const href = link.href
  if (!href || href.startsWith('javascript:') || href.startsWith('#')) return

  const now = Date.now()
  if (window.__zapLastAuxUrl === href && now - (window.__zapLastAuxAt || 0) < 1200) {
    event.preventDefault()
    event.stopPropagation()
    event.stopImmediatePropagation()
    return
  }

  window.__zapLastAuxUrl = href
  window.__zapLastAuxAt = now

  event.preventDefault()
  event.stopPropagation()
  event.stopImmediatePropagation()

  ipcRenderer.invoke('open-in-new-tab', { url: href })
}, true)

// Expose window.nostr (NIP-07) so Nostr web apps can request signatures
// without ever seeing the private key.
contextBridge.exposeInMainWorld('nostr', {
  getPublicKey: ()             => ipcRenderer.invoke('nostr-get-pubkey-nip07'),
  signEvent:    (event)        => ipcRenderer.invoke('nostr-sign-event-nip07', { event }),
  getRelays:    ()             => ipcRenderer.invoke('nostr-get-relays-nip07'),
  nip04: {
    encrypt: (pubkey, text) => ipcRenderer.invoke('nostr-nip04-encrypt', { pubkey, text }),
    decrypt: (pubkey, text) => ipcRenderer.invoke('nostr-nip04-decrypt', { pubkey, text }),
  },
})

window.dispatchEvent(new Event('nostr:ready'))

// Zap Browser privacy hardening: hide common cookie consent/CMP overlays.
// This does not accept tracking cookies. It only removes known consent UI noise.
(() => {
  const selectors = [
    '#onetrust-banner-sdk',
    '#onetrust-consent-sdk',
    '.ot-sdk-container',
    '.ot-sdk-row',
    '.qc-cmp2-container',
    '.qc-cmp2-main',
    '.qc-cmp2-persistent-link',
    '.qc-cmp-ui-container',
    '.didomi-popup-container',
    '.didomi-consent-popup',
    '#didomi-host',
    '.iubenda-cs-container',
    '.iubenda-cs-overlay',
    '.iubenda-cs-banner',
    '#CybotCookiebotDialog',
    '.CookieConsent',
    '.cookie-consent',
    '.cookie-banner',
    '.cookies-banner',
    '.cookiebar',
    '[aria-label*="cookie" i]',
    '[id*="cookie" i]',
    '[class*="cookie" i]',
    '[id*="consent" i]',
    '[class*="consent" i]',
    '[id*="cmp" i]',
    '[class*="cmp" i]'
  ]

  const styleId = 'zap-cookie-banner-blocker-style'

  function injectStyle() {
    if (document.getElementById(styleId)) return
    const style = document.createElement('style')
    style.id = styleId
    style.textContent = `
      ${selectors.join(',')} {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }

      html, body {
        overflow: auto !important;
      }
    `
    document.documentElement.appendChild(style)
  }

  function cleanup() {
    injectStyle()

    for (const sel of selectors) {
      document.querySelectorAll(sel).forEach(el => {
        try { el.remove() } catch (_) {}
      })
    }

    document.documentElement.style.overflow = 'auto'
    document.body && (document.body.style.overflow = 'auto')
  }

  cleanup()

  const mo = new MutationObserver(() => cleanup())
  mo.observe(document.documentElement, { childList: true, subtree: true })

  window.addEventListener('load', cleanup)
  setTimeout(cleanup, 500)
  setTimeout(cleanup, 1500)
  setTimeout(cleanup, 3000)
})()

// Zap privacy: aggressive consent wall remover v2
(() => {
  const killText = [
    'cookie',
    'cookies',
    'consenso',
    'privacy',
    'riservatezza',
    'i nostri partner',
    'accetto',
    'più opzioni',
    'gestisci opzioni'
  ]

  function looksLikeConsent(el) {
    const txt = (el.innerText || el.textContent || '').toLowerCase()
    if (!txt || txt.length < 80) return false
    let hits = 0
    for (const k of killText) if (txt.includes(k)) hits++
    return hits >= 3
  }

  function killConsent() {
    document.querySelectorAll('body *').forEach(el => {
      try {
        const st = getComputedStyle(el)
        const fixed = st.position === 'fixed' || st.position === 'sticky'
        const big = el.getBoundingClientRect().height > 120
        if ((fixed || big) && looksLikeConsent(el)) el.remove()
      } catch (_) {}
    })

    document.documentElement.style.overflow = 'auto'
    if (document.body) {
      document.body.style.overflow = 'auto'
      document.body.style.pointerEvents = 'auto'
    }
  }

  killConsent()
  new MutationObserver(killConsent).observe(document.documentElement, { childList: true, subtree: true })
  window.addEventListener('load', killConsent)
  setInterval(killConsent, 1000)
})()

// Zap privacy: remove large consent/paywall modals with accept/refuse buttons.
(() => {
  const words = [
    'accetta e continua',
    'rifiuta e abbonati',
    'sei già abbonato',
    'cookie policy',
    'i nostri partner',
    'pubblicità profilata',
    'preferenze'
  ]

  function scoreText(txt) {
    txt = (txt || '').toLowerCase()
    return words.reduce((n, w) => n + (txt.includes(w) ? 1 : 0), 0)
  }

  function unlockPage() {
    document.documentElement.style.overflow = 'auto'
    document.documentElement.style.filter = 'none'
    document.documentElement.style.pointerEvents = 'auto'

    if (document.body) {
      document.body.style.overflow = 'auto'
      document.body.style.filter = 'none'
      document.body.style.pointerEvents = 'auto'
    }

    document.querySelectorAll('*').forEach(el => {
      try {
        const st = getComputedStyle(el)
        const z = Number(st.zIndex) || 0
        const rect = el.getBoundingClientRect()
        const txt = el.innerText || el.textContent || ''

        const isOverlay =
          (st.position === 'fixed' || st.position === 'absolute') &&
          z >= 10 &&
          rect.width > window.innerWidth * 0.35 &&
          rect.height > window.innerHeight * 0.20

        const isBackdrop =
          (st.position === 'fixed' || st.position === 'absolute') &&
          rect.width >= window.innerWidth * 0.8 &&
          rect.height >= window.innerHeight * 0.8 &&
          (
            st.backgroundColor.includes('rgba') ||
            st.backdropFilter !== 'none' ||
            st.filter !== 'none'
          )

        if ((isOverlay && scoreText(txt) >= 2) || (isBackdrop && scoreText(document.body?.innerText || '') >= 2)) {
          el.remove()
        }
      } catch (_) {}
    })
  }

  unlockPage()
  new MutationObserver(unlockPage).observe(document.documentElement, { childList: true, subtree: true, attributes: true })
  window.addEventListener('load', unlockPage)
  setTimeout(unlockPage, 300)
  setTimeout(unlockPage, 1000)
  setTimeout(unlockPage, 2500)
  setInterval(unlockPage, 1500)
})()

// ─────────────────────────────────────────────────────────────
// Zap Browser anti-fingerprinting layer
// Inspired by Tor Browser / Brave style mitigations.
// ─────────────────────────────────────────────────────────────
(() => {
  const rand = (min, max) =>
    Math.floor(Math.random() * (max - min + 1)) + min

  // Stable-ish fake values per page session
  const fakeHardwareConcurrency = [4, 8][rand(0,1)]
  const fakeDeviceMemory = [4, 8][rand(0,1)]

  // webdriver
  try {
    Object.defineProperty(Navigator.prototype, 'webdriver', {
      get: () => false,
      configurable: false,
    })
  } catch (_) {}

  // hardwareConcurrency
  try {
    Object.defineProperty(Navigator.prototype, 'hardwareConcurrency', {
      get: () => fakeHardwareConcurrency,
      configurable: false,
    })
  } catch (_) {}

  // deviceMemory
  try {
    Object.defineProperty(Navigator.prototype, 'deviceMemory', {
      get: () => fakeDeviceMemory,
      configurable: false,
    })
  } catch (_) {}

  // languages
  try {
    Object.defineProperty(Navigator.prototype, 'languages', {
      get: () => ['en-US', 'en'],
      configurable: false,
    })
  } catch (_) {}

  // platform
  try {
    Object.defineProperty(Navigator.prototype, 'platform', {
      get: () => 'Win32',
      configurable: false,
    })
  } catch (_) {}

  // plugins
  try {
    Object.defineProperty(Navigator.prototype, 'plugins', {
      get: () => ({
        length: 3,
        0: { name: 'Chrome PDF Plugin' },
        1: { name: 'Chrome PDF Viewer' },
        2: { name: 'Native Client' },
      }),
      configurable: false,
    })
  } catch (_) {}

  // mimeTypes
  try {
    Object.defineProperty(Navigator.prototype, 'mimeTypes', {
      get: () => ({
        length: 2,
      }),
      configurable: false,
    })
  } catch (_) {}

  // screen fingerprint normalization
  try {
    Object.defineProperty(screen, 'colorDepth', {
      get: () => 24,
    })

    Object.defineProperty(screen, 'pixelDepth', {
      get: () => 24,
    })
  } catch (_) {}

  // Timezone spoof
  try {
    const originalResolved =
      Intl.DateTimeFormat.prototype.resolvedOptions

    Intl.DateTimeFormat.prototype.resolvedOptions = function () {
      const r = originalResolved.apply(this, arguments)
      r.timeZone = 'UTC'
      return r
    }
  } catch (_) {}

  
// Canvas anti-fingerprint
try {
  const toDataURL = HTMLCanvasElement.prototype.toDataURL
  const toBlob = HTMLCanvasElement.prototype.toBlob
  const getImageData = CanvasRenderingContext2D.prototype.getImageData

  function noisify(canvas, context) {
    try {
      const shift = {
        r: Math.floor(Math.random() * 10) - 5,
        g: Math.floor(Math.random() * 10) - 5,
        b: Math.floor(Math.random() * 10) - 5,
        a: Math.floor(Math.random() * 10) - 5
      }

      const width = canvas.width
      const height = canvas.height

      if (!width || !height) return

      const imageData = context.getImageData(0, 0, width, height)

      for (let i = 0; i < imageData.data.length; i += 4) {
        imageData.data[i + 0] += shift.r
        imageData.data[i + 1] += shift.g
        imageData.data[i + 2] += shift.b
        imageData.data[i + 3] += shift.a
      }

      context.putImageData(imageData, 0, 0)
    } catch (_) {}
  }

  HTMLCanvasElement.prototype.toDataURL = function() {
    const context = this.getContext("2d")
    if (context) noisify(this, context)
    return toDataURL.apply(this, arguments)
  }

  HTMLCanvasElement.prototype.toBlob = function() {
    const context = this.getContext("2d")
    if (context) noisify(this, context)
    return toBlob.apply(this, arguments)
  }

  CanvasRenderingContext2D.prototype.getImageData = function() {
    const imageData = getImageData.apply(this, arguments)

    for (let i = 0; i < imageData.data.length; i += 4) {
      imageData.data[i + 0] += Math.floor(Math.random() * 3) - 1
    }

    return imageData
  }
} catch (_) {}

// WebGL vendor masking

  try {
    const getParameter = WebGLRenderingContext.prototype.getParameter

    WebGLRenderingContext.prototype.getParameter = function(parameter) {
      // UNMASKED_VENDOR_WEBGL
      if (parameter === 37445) return 'Intel Inc.'

      // UNMASKED_RENDERER_WEBGL
      if (parameter === 37446) return 'Intel Iris OpenGL Engine'

      return getParameter.apply(this, arguments)
    }
  } catch (_) {}

  // Audio fingerprint slight noise
  try {
    const orig = AudioBuffer.prototype.getChannelData

    AudioBuffer.prototype.getChannelData = function() {
      const data = orig.apply(this, arguments)

      if (!this._zapNoised) {
        this._zapNoised = true

        for (let i = 0; i < data.length; i += 100) {
          data[i] = data[i] + 0.0000001
        }
      }

      return data
    }
  } catch (_) {}

  console.log('[ZapBrowser] anti-fingerprinting enabled')
})()

// WebGL2
try {
  const getParameter2 = WebGL2RenderingContext.prototype.getParameter

  WebGL2RenderingContext.prototype.getParameter = function(parameter) {
    if (parameter === 37445) return 'Intel Inc.'
    if (parameter === 37446) return 'Intel Iris OpenGL Engine'
    return getParameter2.apply(this, arguments)
  }
} catch (_) {}


// Zap anti-fingerprint hardening v2: normalize high-signal leaks
(() => {
  function spoof(obj, prop, value) {
    try {
      Object.defineProperty(obj, prop, {
        get: () => value,
        configurable: true,
      })
    } catch (_) {}
  }

  spoof(navigator, 'platform', 'MacIntel')
  spoof(Navigator.prototype, 'platform', 'MacIntel')

  spoof(navigator, 'hardwareConcurrency', 8)
  spoof(Navigator.prototype, 'hardwareConcurrency', 8)

  spoof(navigator, 'deviceMemory', 8)
  spoof(Navigator.prototype, 'deviceMemory', 8)

  spoof(navigator, 'language', 'en-US')
  spoof(Navigator.prototype, 'language', 'en-US')

  spoof(navigator, 'languages', ['en-US', 'en'])
  spoof(Navigator.prototype, 'languages', ['en-US', 'en'])

  spoof(navigator, 'vendor', 'Google Inc.')
  spoof(Navigator.prototype, 'vendor', 'Google Inc.')

  // timezone consistency with Mac/US-like fingerprint
  try {
    const realOffset = Date.prototype.getTimezoneOffset
    Date.prototype.getTimezoneOffset = function () { return 0 }
  } catch (_) {}

  try {
    const origResolved = Intl.DateTimeFormat.prototype.resolvedOptions
    Intl.DateTimeFormat.prototype.resolvedOptions = function () {
      const r = origResolved.apply(this, arguments)
      r.timeZone = 'UTC'
      return r
    }
  } catch (_) {}

  // hide real media devices labels
  try {
    if (navigator.mediaDevices?.enumerateDevices) {
      const origEnum = navigator.mediaDevices.enumerateDevices.bind(navigator.mediaDevices)
      navigator.mediaDevices.enumerateDevices = async function () {
        const devices = await origEnum()
        return devices.map((d, i) => ({
          deviceId: `default-${i}`,
          groupId: 'default',
          kind: d.kind,
          label: '',
          toJSON() { return this },
        }))
      }
    }
  } catch (_) {}

  // block WebGL debug extension, which leaks real GPU
  try {
    const origGetExtension = WebGLRenderingContext.prototype.getExtension
    WebGLRenderingContext.prototype.getExtension = function (name) {
      if (String(name).toLowerCase() === 'webgl_debug_renderer_info') return null
      return origGetExtension.apply(this, arguments)
    }
  } catch (_) {}

  try {
    const origGetExtension2 = WebGL2RenderingContext.prototype.getExtension
    WebGL2RenderingContext.prototype.getExtension = function (name) {
      if (String(name).toLowerCase() === 'webgl_debug_renderer_info') return null
      return origGetExtension2.apply(this, arguments)
    }
  } catch (_) {}

  console.log('[ZapBrowser] anti-fingerprint hardening v2 enabled')
})()

// Zap anti-fingerprint main-world injection
(() => {
  const code = `
    (() => {
      const spoof = (obj, prop, value) => {
        try {
          Object.defineProperty(obj, prop, {
            get: () => value,
            configurable: true
          })
        } catch (_) {}
      }

      spoof(Navigator.prototype, 'platform', 'MacIntel')
      spoof(navigator, 'platform', 'MacIntel')

      spoof(Navigator.prototype, 'hardwareConcurrency', 8)
      spoof(navigator, 'hardwareConcurrency', 8)

      spoof(Navigator.prototype, 'deviceMemory', 8)
      spoof(navigator, 'deviceMemory', 8)

      spoof(Navigator.prototype, 'language', 'en-US')
      spoof(navigator, 'language', 'en-US')

      spoof(Navigator.prototype, 'languages', ['en-US', 'en'])
      spoof(navigator, 'languages', ['en-US', 'en'])

      spoof(Navigator.prototype, 'vendor', 'Google Inc.')
      spoof(navigator, 'vendor', 'Google Inc.')

      spoof(Navigator.prototype, 'webdriver', false)
      spoof(navigator, 'webdriver', false)

      try {
        Date.prototype.getTimezoneOffset = function () { return 0 }
      } catch (_) {}

      try {
        const resolved = Intl.DateTimeFormat.prototype.resolvedOptions
        Intl.DateTimeFormat.prototype.resolvedOptions = function () {
          const r = resolved.apply(this, arguments)
          r.timeZone = 'UTC'
          return r
        }
      } catch (_) {}

      try {
        if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
          navigator.mediaDevices.enumerateDevices = async () => []
        }
      } catch (_) {}

      try {
        const ge = WebGLRenderingContext.prototype.getExtension
        WebGLRenderingContext.prototype.getExtension = function(name) {
          if (String(name).toLowerCase() === 'webgl_debug_renderer_info') return null
          return ge.apply(this, arguments)
        }
      } catch (_) {}

      try {
        const ge2 = WebGL2RenderingContext.prototype.getExtension
        WebGL2RenderingContext.prototype.getExtension = function(name) {
          if (String(name).toLowerCase() === 'webgl_debug_renderer_info') return null
          return ge2.apply(this, arguments)
        }
      } catch (_) {}

      console.log('[ZapBrowser] main-world anti-fingerprint active')
    })()
  `

  const inject = () => {
    try {
      const s = document.createElement('script')
      s.textContent = code
      ;(document.documentElement || document.head).appendChild(s)
      s.remove()
    } catch (_) {}
  }

  inject()
  document.addEventListener('DOMContentLoaded', inject, { once: true })
})()

// Zap anti-fingerprint main-world injection via Electron webFrame
try {
  const { webFrame } = require('electron')

  const code = `
    (() => {
      const spoof = (obj, prop, value) => {
        try {
          Object.defineProperty(obj, prop, {
            get: () => value,
            configurable: true
          })
        } catch (_) {}
      }

      spoof(Navigator.prototype, 'platform', 'Linux x86_64')
      spoof(navigator, 'platform', 'Linux x86_64')

      spoof(Navigator.prototype, 'hardwareConcurrency', 4)
      spoof(navigator, 'hardwareConcurrency', 4)

      spoof(Navigator.prototype, 'deviceMemory', 4)
      spoof(navigator, 'deviceMemory', 4)

      spoof(Navigator.prototype, 'language', 'en-US')
      spoof(navigator, 'language', 'en-US')

      spoof(Navigator.prototype, 'languages', ['en-US', 'en'])
      spoof(navigator, 'languages', ['en-US', 'en'])

      spoof(Navigator.prototype, 'webdriver', false)
      spoof(navigator, 'webdriver', false)

      try {
        navigator.mediaDevices.enumerateDevices = async () => []
      } catch (_) {}

      try {
        Date.prototype.getTimezoneOffset = function () { return 0 }
      } catch (_) {}

      try {
        const ro = Intl.DateTimeFormat.prototype.resolvedOptions
        Intl.DateTimeFormat.prototype.resolvedOptions = function () {
          const r = ro.apply(this, arguments)
          r.timeZone = 'UTC'
          return r
        }
      } catch (_) {}

      console.log('[ZapBrowser] real main-world anti-fingerprint active')
    })()
  `

  webFrame.executeJavaScript(code).catch(() => {})
} catch (_) {}
