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
