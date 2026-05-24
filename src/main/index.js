'use strict'
const { app, BrowserWindow, BrowserView, ipcMain, session, dialog, shell, Notification } = require('electron')
const path   = require('path')
const DB     = require('./db')
const wallet = require('./wallet')
const nostr  = require('./nostr')
const nwc    = require('./nwc')
const bl     = require('./blocklist')
const cosmetic = require('./cosmetic')
const doh    = require('./doh')
const v4v    = require('./value4value')
const cashu  = require('./cashu')
const lnurl  = require('./lnurl')
const V = require('./validate')

const {
  SHELL_H,
  showView,
  hideView,
  resizeView,
} = require('./browser/viewManager')

const {
  setupWebViewContextMenu,
} = require('./ui/nativeMenus')

const {
  showBookmarkContextMenu,
} = require('./ui/bookmarkMenus')

const {
  showBookmarkFolderPopup,
  hideBookmarkFolderPopup,
} = require('./ui/bookmarkFolderPopup')



const isDev = !app.isPackaged
const ZAP_DEBUG = process.env.ZAP_DEBUG === '1'

let mainWindow  = null
let activeView  = null
const tabUrls   = new Map()
let activeTabId = null
let isSwitching = false
const activeDownloads = new Map()
const lastTabUpdates = new Map()
let addressSuggestWindow = null


const UA_POOL = [
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64; rv:126.0) Gecko/20100101 Firefox/126.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
]
let currentUA = UA_POOL[Math.floor(Math.random() * UA_POOL.length)]
const nostrSessionPermissions = new Map()

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function hideAddressSuggestions() {
  if (addressSuggestWindow && !addressSuggestWindow.isDestroyed()) {
    addressSuggestWindow.hide()
  }
}

function showAddressSuggestions({ items = [], x = 0, y = 0, width = 720, selectedIndex = 0 }) {
  if (!mainWindow || !Array.isArray(items) || items.length === 0) {
    hideAddressSuggestions()
    return { ok: true }
  }

  const safeItems = items
    .filter(item => item && item.url)
    .slice(0, 8)
    .map(item => ({
      title: String(item.title || item.url || ''),
      url: String(item.url || ''),
      favicon: String(item.favicon || ''),
    }))

  if (safeItems.length === 0) {
    hideAddressSuggestions()
    return { ok: true }
  }

  const rowHeight = 54
  const popupHeight = Math.min(430, safeItems.length * rowHeight + 14)
  const popupWidth = Math.max(360, Math.min(Number(width) || 720, 900))

  if (!addressSuggestWindow || addressSuggestWindow.isDestroyed()) {
    addressSuggestWindow = new BrowserWindow({
      width: popupWidth,
      height: popupHeight,
      x: Math.round(Number(x) || 0),
      y: Math.round(Number(y) || 0),
      parent: mainWindow,
      frame: false,
      show: false,
      resizable: false,
      movable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      focusable: false,
      backgroundColor: '#111217',
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        sandbox: false,
      },
    })

    addressSuggestWindow.on('closed', () => {
      addressSuggestWindow = null
    })
  }

  addressSuggestWindow.setBounds({
    x: Math.round(Number(x) || 0),
    y: Math.round(Number(y) || 0),
    width: popupWidth,
    height: popupHeight,
  })

  const rows = safeItems.map((item, idx) => `
    <button class="row ${idx === Number(selectedIndex) ? 'selected' : ''}" data-url="${escapeHtml(item.url)}">
      <div class="ico">${item.favicon ? `<img src="${escapeHtml(item.favicon)}" />` : '🌐'}</div>
      <div class="meta">
        <div class="title">${escapeHtml(item.title)}</div>
        <div class="url">${escapeHtml(item.url)}</div>
      </div>
    </button>
  `).join('')

  const html = `
<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 0;
    background: transparent;
    font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    overflow: hidden;
  }
  .wrap {
    margin: 0;
    padding: 7px;
    width: 100vw;
    height: 100vh;
    background: #151720;
    border: 1px solid rgba(255,255,255,.08);
    border-radius: 14px;
    box-shadow: 0 20px 70px rgba(0,0,0,.65);
  }
  .row {
    width: 100%;
    height: 54px;
    display: flex;
    align-items: center;
    gap: 10px;
    border: 0;
    border-radius: 10px;
    background: transparent;
    color: #f4f4f5;
    text-align: left;
    cursor: pointer;
    padding: 7px 10px;
  }
  .row:hover,
  .row.selected {
    background: rgba(255,255,255,.10);
  }

  .row.selected {
    outline: 1px solid rgba(245,166,35,.35);
  }
  .ico {
    width: 24px;
    height: 24px;
    display:flex;
    align-items:center;
    justify-content:center;
    flex: 0 0 auto;
    font-size: 15px;
  }
  .ico img {
    width: 18px;
    height: 18px;
    border-radius: 4px;
  }
  .meta {
    min-width: 0;
  }
  .title {
    font-size: 12px;
    font-weight: 700;
    color: #f4f4f5;
    overflow:hidden;
    white-space:nowrap;
    text-overflow:ellipsis;
  }
  .url {
    margin-top: 2px;
    font-size: 11px;
    color: #8b949e;
    overflow:hidden;
    white-space:nowrap;
    text-overflow:ellipsis;
  }
</style>
</head>
<body>
  <div class="wrap">
    ${rows}
  </div>
<script>
  const { ipcRenderer } = require('electron')
  document.querySelectorAll('.row').forEach(row => {
    row.addEventListener('mousedown', (event) => {
      event.preventDefault()
      event.stopPropagation()
      const url = row.getAttribute('data-url')
      if (url) ipcRenderer.send('address-suggestion-selected', url)
    })
  })
</script>
</body>
</html>`

  addressSuggestWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))
  addressSuggestWindow.showInactive()

  return { ok: true }
}

function getIpcOrigin(ipcEvent) {
  const url =
    ipcEvent.senderFrame?.url ||
    ipcEvent.sender?.getURL?.() ||
    ''

  try {
    return new URL(url).origin
  } catch (_) {
    return 'unknown-origin'
  }
}

function summarizeNostrEvent(event) {
  if (!event || typeof event !== 'object') {
    return 'Unknown event'
  }

  const kind = event.kind ?? 'unknown'
  const content = typeof event.content === 'string' ? event.content : ''
  const tags = Array.isArray(event.tags) ? event.tags.length : 0

  return [
    `Kind: ${kind}`,
    `Content length: ${content.length} chars`,
    `Tags: ${tags}`,
  ].join('\n')
}
function summarizeNostrRequest(action, payload) {
  if (action === 'getPublicKey') {
    return 'The site wants to read your public Nostr identity.'
  }

  if (action === 'nip04.encrypt') {
    return [
      'The site wants to encrypt a NIP-04 message.',
      `Target pubkey: ${payload?.pubkey || 'unknown'}`,
      `Text length: ${payload?.text?.length || 0} chars`,
    ].join('\n')
  }

  if (action === 'nip04.decrypt') {
    return [
      'The site wants to decrypt a NIP-04 message.',
      `Sender/target pubkey: ${payload?.pubkey || 'unknown'}`,
      `Ciphertext length: ${payload?.text?.length || 0} chars`,
    ].join('\n')
  }

  return summarizeNostrEvent(payload)
}
async function confirmNostrPermission(ipcEvent, action, nostrEvent) {
  const origin = getIpcOrigin(ipcEvent)
  const key = `${origin}:${action}`

  const sessionDecision = nostrSessionPermissions.get(key)

  if (sessionDecision === 'allow') {
    return true
  }

  if (sessionDecision === 'deny') {
    return false
  }

  const stored = DB.getNostrPermission(origin, action)

  if (stored?.decision === 'allow') {
    return true
  }

  if (stored?.decision === 'deny') {
    return false
  }

  const result = await dialog.showMessageBox(mainWindow, {
    type: 'question',
    title: 'Nostr signing request',
    message: 'A website is requesting access to your Nostr identity.',
    detail: [
      `Origin: ${origin}`,
      `Action: ${action}`,
      '',
      summarizeNostrRequest(action, nostrEvent),
      '',
      'Only approve this request if you trust this website.',
    ].join('\n'),
    buttons: ['Allow for session', 'Always allow', 'Always deny', 'Deny for session'],
    defaultId: 0,
    cancelId: 3,
    noLink: true,
  })

  if (result.response === 0) {
    nostrSessionPermissions.set(key, 'allow')
    return true
  }

  if (result.response === 1) {
    DB.setNostrPermission(origin, action, 'allow')
    return true
  }

  if (result.response === 2) {
    DB.setNostrPermission(origin, action, 'deny')
    return false
  }

  if (result.response === 3) {
    // Some Nostr web clients call getPublicKey very early during login.
    // If Electron's native dialog loses focus or is cancelled unexpectedly,
    // do not silently poison the session with a deny for getPublicKey.
    // signEvent remains protected and still requires explicit approval.
    if (action === 'getPublicKey') {
      nostrSessionPermissions.set(key, 'allow')
      return true
    }

    nostrSessionPermissions.set(key, 'deny')
    return false
  }

  return false
}

function parseNativePaymentUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return null

  const value = rawUrl.trim()
  const lower = value.toLowerCase()

  if (lower.startsWith('lightning:')) {
    const payload = value.slice('lightning:'.length).trim()
    if (!payload) return null

    if (payload.toLowerCase().startsWith('lnbc') || payload.toLowerCase().startsWith('lntb')) {
      return { type: 'invoice', value: payload, source: 'protocol' }
    }

    if (payload.toLowerCase().startsWith('lnurl')) {
      return { type: 'lnurl', value: payload, source: 'protocol' }
    }

    return { type: 'lightning', value: payload, source: 'protocol' }
  }

  if (lower.startsWith('cashu:')) {
    const payload = value.slice('cashu:'.length).trim()
    return { type: 'cashu', value: payload || value, source: 'protocol' }
  }

  if (lower.startsWith('cashua')) {
    return { type: 'cashu', value, source: 'protocol' }
  }

  if (lower.startsWith('liquid:') || lower.startsWith('l-btc:')) {
    return { type: 'liquid', value, source: 'protocol' }
  }

  if (lower.startsWith('lnurl:')) {
    const payload = value.slice('lnurl:'.length).trim()
    return { type: 'lnurl', value: payload || value, source: 'protocol' }
  }

  if (lower.startsWith('lnurlp:') || lower.startsWith('lnurlw:')) {
    return { type: 'lnurl', value, source: 'protocol' }
  }

  return null
}

async function applyNetworkProxy() {
  const priv = DB.getPrivacy()
  const enabled = Number(priv?.tor_enabled) === 1
  const host = String(priv?.tor_host || '127.0.0.1').trim()
  const port = Number(priv?.tor_port || 9050)

  if (!enabled) {
    await session.defaultSession.setProxy({ proxyRules: '' })
    await session.defaultSession.forceReloadProxyConfig()
    return { ok: true, enabled: false }
  }

  if (!host || !Number.isSafeInteger(port) || port < 1 || port > 65535) {
    return { ok: false, error: 'Invalid Tor/SOCKS proxy settings' }
  }

  await session.defaultSession.setProxy({
    proxyRules: `socks5://${host}:${port}`,
    proxyBypassRules: [
      '<-loopback>',
      'localhost',
      '127.0.0.1',
      '::1',
      'localhost:3000',
      '127.0.0.1:3000',
    ].join(';'),
  })

  await session.defaultSession.forceReloadProxyConfig()

  return { ok: true, enabled: true, host, port }
}

function sendTabUpdated(tabId, patch = {}) {
  if (!mainWindow || !tabId) return

  const previous = lastTabUpdates.get(tabId) || {}
  const next = { ...previous, ...patch }

  const changed = Object.keys(patch).some((key) => previous[key] !== patch[key])
  if (!changed) return

  lastTabUpdates.set(tabId, next)
  mainWindow.webContents.send('tab-updated', { tabId, ...patch })
}

function createMainView() {
  const view = new BrowserView({
    webPreferences: {
      preload: path.join(__dirname, '../preload/webview.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
    }
  })

  view.webContents.on('console-message', (_event, level, message) => {
    if (!ZAP_DEBUG) return
    if (String(message).includes('[ZapAds]') || String(message).includes('[ZapCosmetic]')) {
      console.log(`[webview] ${message}`)
    }
  })

  view.webContents.on('page-title-updated', (_, title) => {
    if (!activeTabId) return
    sendTabUpdated(activeTabId, {
      title,
      url: view.webContents.getURL(),
    })
  })

  view.webContents.on('did-navigate', async (_, url) => {
    if (!activeTabId) return
    tabUrls.set(activeTabId, url)
    sendTabUpdated(activeTabId, {
      url,
      canGoBack: view.webContents.canGoBack(),
      canGoForward: view.webContents.canGoForward(),
    })
    setTimeout(async () => {
      try {
        const hasNostr = await view.webContents.executeJavaScript('!!(window.nostr)')
        mainWindow?.webContents.send('page-features', { nostr: hasNostr, url })
        const v4vInfo = await v4v.checkPage(url, view.webContents)
        if (v4vInfo.supported) mainWindow?.webContents.send('v4v-detected', v4vInfo)
      } catch (_) {}
    }, 1500)
  })

  view.webContents.on('did-start-loading', () => {
    if (activeTabId && !isSwitching) {
      sendTabUpdated(activeTabId, { loading: true })
    }
  })

  view.webContents.on('did-stop-loading', () => {
    if (!activeTabId) return
    const url   = view.webContents.getURL()
    const title = view.webContents.getTitle()
    sendTabUpdated(activeTabId, { loading: false, url, title })
    if (url && !url.startsWith('chrome://') && !url.startsWith('devtools://')) {
      DB.addHistory(url, title)
    }
  })

  // Popup / new-window protection.
  // Same-origin links may open in the current tab.
  // Cross-origin windows are usually popups/popunders/interstitial ads and are blocked.
  view.webContents.setWindowOpenHandler(({ url, disposition }) => {
    const nativePayment = parseNativePaymentUrl(url)

    if (nativePayment) {
      mainWindow?.webContents.send('payment-detected', nativePayment)
      return { action: 'deny' }
    }

    const priv = DB.getPrivacy()
    if (!priv.adblock) {
      view.webContents.loadURL(url)
      return { action: 'deny' }
    }

    try {
      const currentUrl = view.webContents.getURL()
      const currentOrigin = new URL(currentUrl).origin
      const targetOrigin = new URL(url).origin

      const isUserClick =
        disposition === 'foreground-tab' ||
        disposition === 'background-tab' ||
        disposition === 'new-window'

      if (isUserClick) {
        view.webContents.loadURL(url)
        return { action: 'deny' }
      }

      if (currentOrigin === targetOrigin) {
        view.webContents.loadURL(url)
        return { action: 'deny' }
      }

      bl.incrementBlocked()
      mainWindow?.webContents.send('blocked-count', bl.getBlockedCount())
      mainWindow?.webContents.send('popup-blocked', {
        url,
        origin: targetOrigin,
        source: currentOrigin,
      })

      return { action: 'deny' }
    } catch (_) {
      bl.incrementBlocked()
      mainWindow?.webContents.send('blocked-count', bl.getBlockedCount())
      mainWindow?.webContents.send('popup-blocked', { url })
      return { action: 'deny' }
    }
  })

  // Native browser context menu.
  // This avoids React overlays above BrowserView and gives Zap Browser
  // desktop-grade right-click behavior.
  setupWebViewContextMenu({
    view,
    mainWindow,
    getActiveTabId: () => activeTabId,
  })

  // Suppress the browser's unload dialog so closing a tab is never blocked
  view.webContents.on('will-prevent-unload', (e) => e.preventDefault())

  function injectOverlayProtection() {
    const priv = DB.getPrivacy()
    if (!priv.adblock || !priv.popup_block || !priv.overlay_block) return

    view.webContents.executeJavaScript(cosmetic.getCosmeticScript()).catch(() => {})

    view.webContents.executeJavaScript(`
      (function() {
        function zapGenericCosmeticShields() {
          if (document.getElementById('__zap_generic_cosmetic')) return;

          const style = document.createElement('style');
          style.id = '__zap_generic_cosmetic';
          style.textContent = [
            '[id*="div-gpt-ad"], [id*="google_ads_iframe"], [id*="google_ads"], [id*="gpt-ad"], [id*="adunit"], [class*="adunit"], .ads-contrib, .adunit, .adsbygoogle, ins.adsbygoogle, [data-ad-slot], [data-ad-client], [data-google-query-id] { display:none !important; visibility:hidden !important; height:0 !important; max-height:0 !important; overflow:hidden !important; }',
            'iframe[src*="googlesyndication"], iframe[src*="doubleclick"], iframe[src*="googleads"], iframe[src*="adservice"], iframe[src*="/ads/"], iframe[src*="prebid"] { display:none !important; visibility:hidden !important; height:0 !important; max-height:0 !important; overflow:hidden !important; }',
            '[id*="PN-SKIN"], [id*="PN-INTRO"], [id*="PN-TOP"], [id*="PN-BANNER"], [id*="PN-MPU"], [id*="skin-ad"], [class*="skin-ad"], [id*="ad-skin"], [class*="ad-skin"] { display:none !important; visibility:hidden !important; height:0 !important; max-height:0 !important; overflow:hidden !important; }'
          ].join('\\n');

          document.documentElement.appendChild(style);

          document.querySelectorAll('[id*="div-gpt-ad"], [id*="google_ads_iframe"], .ads-contrib, .adunit, .adsbygoogle, ins.adsbygoogle, [data-ad-slot], [data-ad-client]').forEach(el => {
            const wrap = el.closest('.ads-contrib, .adunit') || el;
            wrap.remove();
          });
        }

        function zapInjectAdCosmeticCSS() {
          if (document.getElementById('__zap_ad_cosmetic')) return;

          const style = document.createElement('style');
          style.id = '__zap_ad_cosmetic';
          style.textContent = [
            'html, body { background-image: none !important; background-color: #fff !important; }',
            '[id*="div-gpt-ad"], [id*="google_ads_iframe"], [id*="PN-SKIN"], [id*="PN-INTRO"], [id*="PN-TOP"], [id*="PN-BANNER"], [id*="PN-MASTHEAD"], [id*="PN-MPU"], .ads-contrib, .adunit, .adsbygoogle, ins.adsbygoogle { display: none !important; visibility: hidden !important; height: 0 !important; max-height: 0 !important; overflow: hidden !important; }'
          ].join('\n');
          document.documentElement.appendChild(style);
        }

        function zapKillAdSkins() {
          zapInjectAdCosmeticCSS();
          const skinSelectors = [
            'body',
            'html',
            '[class*="skin"]',
            '[id*="skin"]',
            '[class*="wallpaper"]',
            '[id*="wallpaper"]',
            '[class*="background"]',
            '[id*="background"]',
            '[class*="masthead"]',
            '[id*="masthead"]'
          ];

          for (const sel of skinSelectors) {
            document.querySelectorAll(sel).forEach(el => {
              const st = window.getComputedStyle(el);
              const bg = st.backgroundImage || '';

              if (
                bg &&
                bg !== 'none' &&
                /(ad|adv|ads|banner|pubblic|sponsor|campaign|autoligure|volkswagen|promo|coop|ipercoop|buono|sconto|bmw|gino)/i.test(bg)
              ) {
                el.style.backgroundImage = 'none';
                el.style.background = 'transparent';
              }
            // });
          }
        }

        function zapHideBottomPromoBanners() {
          const promoRegex = /(abbonati|abbonamento|offerta|promo|scopri di più|buono regalo|amazon|subscribe|subscription|limited offer|sponsor|advert)/i

          document.querySelectorAll('body > div, body > section, body > aside').forEach(el => {
            const st = window.getComputedStyle(el)
            const r = el.getBoundingClientRect()
            const txt = String(el.innerText || el.textContent || '').slice(0, 600)

            const isFixedOrSticky =
              st.position === 'fixed' ||
              st.position === 'sticky'

            const isBottomBanner =
              isFixedOrSticky &&
              r.width >= window.innerWidth * 0.55 &&
              r.height >= 70 &&
              r.height <= window.innerHeight * 0.38 &&
              r.bottom >= window.innerHeight - 8

            if (isBottomBanner && promoRegex.test(txt)) {
              el.style.setProperty('display', 'none', 'important')
              el.style.setProperty('visibility', 'hidden', 'important')
              el.style.setProperty('height', '0px', 'important')
              el.style.setProperty('max-height', '0px', 'important')
              el.style.setProperty('overflow', 'hidden', 'important')
            }
          })
        }

        function zapKillAdElements() {
          const adRegex = /(googlesyndication|doubleclick|googleads|adform|adnxs|criteo|taboola|outbrain|mgid|teads|smartadserver|openx|rubicon|yieldlove|prebid|adsbygoogle|pubblicit|sponsor)/i;

          document.querySelectorAll('iframe, ins, .adsbygoogle, [data-ad-slot], [data-ad-client], [data-google-query-id]').forEach(el => {
            const html = (
              (el.id || '') + ' ' +
              (el.className || '') + ' ' +
              (el.getAttribute?.('src') || '') + ' ' +
              (el.getAttribute?.('data-ad-slot') || '') + ' ' +
              (el.getAttribute?.('data-ad-client') || '') + ' ' +
              (el.getAttribute?.('data-google-query-id') || '')
            );

            if (adRegex.test(html) || el.tagName === 'IFRAME' || el.tagName === 'INS') {
              el.style.setProperty('display', 'none', 'important');
              el.style.setProperty('visibility', 'hidden', 'important');
              el.style.setProperty('height', '0px', 'important');
              el.style.setProperty('max-height', '0px', 'important');
              el.style.setProperty('overflow', 'hidden', 'important');
            }
          });
        }

        function zapKillAdImagesAndLinks() {
          const adTextRegex = /(pubblicit|advert|sponsor|promo|coupon|offerta|scopri|buono|sconto|coop|ipercoop|autoligure|volkswagen|bmw|gino|banner)/i;

          document.querySelectorAll('a, img, picture, source, div, section, aside').forEach(el => {
            if (zapLooksLikePaywall && zapLooksLikePaywall(el)) return;

            const st = window.getComputedStyle(el);
            const r = el.getBoundingClientRect();

            if (r.width < 120 || r.height < 40) return;

            const txt = [
              el.innerText || '',
              el.getAttribute?.('href') || '',
              el.getAttribute?.('src') || '',
              el.getAttribute?.('srcset') || '',
              el.getAttribute?.('alt') || '',
              el.getAttribute?.('title') || '',
              el.id || '',
              el.className || ''
            ].join(' ');

            const looksAd = adTextRegex.test(txt);
            if (!looksAd) return;

            const isTopBanner =
              r.width >= window.innerWidth * 0.45 &&
              r.height >= 80 &&
              r.top <= 260;

            const isSideSkin =
              r.height >= window.innerHeight * 0.35 &&
              r.width >= 120 &&
              (r.left <= 80 || r.right >= window.innerWidth - 80);

            const isLargeInlineAd =
              r.width >= window.innerWidth * 0.35 &&
              r.height >= 90;

            if (isTopBanner || isSideSkin || isLargeInlineAd) {
              el.style.setProperty('display', 'none', 'important');
              el.style.setProperty('visibility', 'hidden', 'important');
              el.style.setProperty('height', '0px', 'important');
              el.style.setProperty('max-height', '0px', 'important');
              el.style.setProperty('overflow', 'hidden', 'important');
            }
          });
        }

        function zapHasPaywallFramework() {
          const html = document.documentElement.innerHTML.slice(0, 500000);

          return /tinypass|piano|tp-backdrop|tp-active|paywall|subscription|abbonati|abbonamento/i.test(html);
        }

        function zapLooksLikePaywall(el) {
          const txt = String(el.innerText || '').toLowerCase()
          const html = String(el.outerHTML || '').toLowerCase()

          return /tinypass|piano|tp-backdrop|tp-active|paywall|subscription|subscribe|abbonati|abbonamento|accedi|login/.test(html + ' ' + txt)
        }

        function zapLooksLikeAdOverlay(el) {
          const txt = String(el.innerText || '').toLowerCase()
          const html = String(el.outerHTML || '').toLowerCase()

          if (zapLooksLikePaywall(el)) return false

          return /pubblicit|advert|advertising|sponsor|sponsored|promo|coupon|offerta|limited|scopri di più|scopri come|buono|sconto|banner|adv|adsbygoogle|googlesyndication|doubleclick|amazon|coop|ipercoop|autoligure|volkswagen|bmw|fullscreen|skip intro|salta intro|entra nel sito/.test(html + ' ' + txt)
        }

        function zapKillAdOverlays() {
          // document.querySelectorAll('body *').forEach(el => {
            const st = window.getComputedStyle(el)
            const r = el.getBoundingClientRect()

            if (r.width < 120 || r.height < 50) return
            if (!zapLooksLikeAdOverlay(el)) return

            const z = parseInt(st.zIndex || '0', 10)

            const isFixedOrSticky =
              st.position === 'fixed' ||
              st.position === 'sticky'

            const isBigOverlay =
              r.width >= window.innerWidth * 0.45 &&
              r.height >= window.innerHeight * 0.18 &&
              z >= 10

            const isBottomBanner =
              isFixedOrSticky &&
              r.width >= window.innerWidth * 0.45 &&
              r.bottom >= window.innerHeight - 20

            const isSideRail =
              r.height >= window.innerHeight * 0.45 &&
              r.width >= 120 &&
              (r.left <= 20 || r.right >= window.innerWidth - 20)

            const isInterstitial =
              r.width >= window.innerWidth * 0.45 &&
              r.height >= window.innerHeight * 0.35 &&
              z >= 10

            if (isBigOverlay || isBottomBanner || isSideRail || isInterstitial) {
              el.remove()
            }
          })

          document.body.style.overflow = ''
          document.documentElement.style.overflow = ''
        }

        function zapClickSkipIntro() {
          document.querySelectorAll('a, button').forEach(el => {
            const txt = String(el.innerText || el.textContent || '').toLowerCase()
            const href = String(el.getAttribute?.('href') || '').toLowerCase()

            if (
              txt.includes('salta intro') ||
              txt.includes('entra nel sito') ||
              txt.includes('skip intro') ||
              href.includes('noadv') ||
              href.includes('skip')
            ) {
              el.click()
            }
          })
        }

        function zapKillAggressiveOverlays() {
          zapGenericCosmeticShields();
          zapClickSkipIntro();

          // Precise GPT / Google Ads cleanup
          document.querySelectorAll('[id*="div-gpt-ad"], [id*="google_ads_iframe"], .ads-contrib, .adunit').forEach(el => {
            const wrap = el.closest('.ads-contrib') || el;
            wrap.remove();
          });

          const hasPaywall = zapHasPaywallFramework();

          // Disabled in Balanced Shields mode
          // zapKillAdSkins();
          zapKillAdElements();
          zapHideBottomPromoBanners();
          // Fully disabled in Balanced Shields v0.4

          if (hasPaywall) {
            // Balanced Shields: avoid global overflow reset
            // Balanced Shields: avoid global overflow reset
            return;
          }

          const selectors = [
            
            
            
            
            
            
            '[class*="interstitial"]',
            '[id*="interstitial"]',
            '[class*="cookie"]',
            '[id*="cookie"]',
            '[class*="advert"]',
            '[id*="advert"]',
            
            
            '[class*="adv"]',
            '[id*="adv"]',
            '[class*="sponsor"]',
            '[id*="sponsor"]'
          ];

          for (const sel of selectors) {
            document.querySelectorAll(sel).forEach(el => {
              const st = window.getComputedStyle(el);
              const rect = el.getBoundingClientRect();

              const z = parseInt(st.zIndex || '0', 10);
              const coversScreen =
                (st.position === 'fixed' || st.position === 'absolute') &&
                rect.width >= window.innerWidth * 0.45 &&
                rect.height >= window.innerHeight * 0.25 &&
                z >= 5;

              if (coversScreen) {
                el.style.setProperty('display', 'none', 'important');
                el.style.setProperty('visibility', 'hidden', 'important');
              }
            });
          }

          // Balanced Shields: avoid global overflow reset
          // Balanced Shields: avoid global overflow reset
        }

        if (location.hostname.includes('cittadellaspezia')) {
          setTimeout(() => {
            [...document.querySelectorAll('body *')].forEach(el => {
              const st = getComputedStyle(el);
              const r = el.getBoundingClientRect();
              const txt = [
                el.id || '',
                el.className || '',
                el.getAttribute?.('src') || '',
                el.getAttribute?.('href') || '',
                el.getAttribute?.('style') || '',
                el.innerText || ''
              ].join(' ').slice(0, 300);

              if (
                r.width >= innerWidth * 0.35 ||
                r.height >= innerHeight * 0.25 ||
                st.position === 'fixed' ||
                st.position === 'sticky'
              ) {
                console.warn('[ZapAds]', JSON.stringify({
                  tag: el.tagName,
                  id: el.id || '',
                  cls: String(el.className || '').slice(0,120),
                  pos: st.position,
                  z: st.zIndex,
                  w: Math.round(r.width),
                  h: Math.round(r.height),
                  top: Math.round(r.top),
                  left: Math.round(r.left),
                  txt
                }));
              }
            });
          }, 3000);
        }

        zapKillAggressiveOverlays();
        setTimeout(zapKillAggressiveOverlays, 250);
        setTimeout(zapKillAggressiveOverlays, 750);
        setTimeout(zapKillAggressiveOverlays, 1500);
        setTimeout(zapKillAggressiveOverlays, 3000);

        if (!window.__zapOverlayObserver) {
          window.__zapOverlayObserver = new MutationObserver(() => {
            setTimeout(zapKillAggressiveOverlays, 50);
          });

          window.__zapOverlayObserver.observe(document.documentElement, {
            childList: true,
            subtree: true
          });
        }
      })();
    `).catch(()=>{})
  }

  view.webContents.on('dom-ready', injectOverlayProtection)

  // Inject cosmetic ad-hiding CSS after each page load
  view.webContents.on('did-finish-load', () => {
    const css = bl.getCosmeticCSS()
    if (css) {
      view.webContents.executeJavaScript(`
        (function() {
          if (document.getElementById('__zap_cosmetic')) return;
          const s = document.createElement('style');
          s.id = '__zap_cosmetic';
          s.textContent = ${JSON.stringify(css)};
          document.documentElement.appendChild(s);
        })();
      `).catch(() => {})
    }
  })

  return view
}





function setupPrivacy(ses) {
  ses.webRequest.onBeforeRequest({ urls: ['*://*/*'] }, (details, cb) => {
    const priv = DB.getPrivacy()
    if (!priv.adblock) return cb({})

    // Never block static assets — doing so breaks page rendering
    // Balanced compatibility mode:
    // do not block scripts at network level, because many modern news sites
    // destroy page content when anti-adblock/paywall scripts detect missing deps.
    const passThrough = ['image', 'imageset', 'font', 'media', 'stylesheet']
    if (passThrough.includes(details.resourceType)) return cb({})

    try {
      const u = new URL(details.url)

      if (
        u.hostname.endsWith('corriere.it') ||
        u.hostname.endsWith('corriereobjects.it') ||
        u.hostname.endsWith('tinypass.com') ||
        u.hostname.endsWith('piano.io')
      ) {
        return cb({})
      }
    } catch (_) {}

    const safePatterns = [
      'subscriptions.js',
      'chartbeat_mab',
      'prebid',
      'cxense',
      'permutive'
    ]

    if (safePatterns.some(p => details.url.includes(p))) {
      return cb({})
    }

    if (bl.shouldBlock(details.url, details.referrer || '')) {
      bl.incrementBlocked()
      mainWindow?.webContents.send('blocked-count', bl.getBlockedCount())
      return cb({ cancel: true })
    }
    cb({})
  })

  ses.webRequest.onBeforeSendHeaders((details, cb) => {
    const headers = { ...details.requestHeaders }
    const priv = DB.getPrivacy()
    if (priv.ua_mode !== 'default') headers['User-Agent'] = currentUA
    delete headers['X-Forwarded-For']
    delete headers['Via']
    delete headers['From']
    cb({ requestHeaders: headers })
  })

  ses.setPermissionRequestHandler((wc, permission, cb) => {
    const priv = DB.getPrivacy()
    // Block media if WebRTC protection is on; always block notifications
    if (priv.webrtc_protect && permission === 'media') return cb(false)
    if (permission === 'notifications') return cb(false)
    cb(true)
  })
}

function setupDownloads(ses) {
  ses.on('will-download', (_event, item) => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`
    const fileName = item.getFilename()
    const totalBytes = item.getTotalBytes()

    activeDownloads.set(id, item)

    const startData = {
      id,
      fileName,
      totalBytes,
      receivedBytes: 0,
      state: 'progressing',
      savePath: item.getSavePath(),
    }

    DB.addDownload(startData)

    mainWindow?.webContents.send('download-started', startData)

    item.on('updated', (_event, state) => {
      const updateData = {
        id,
        fileName,
        totalBytes,
        receivedBytes: item.getReceivedBytes(),
        state,
        savePath: item.getSavePath(),
      }

      DB.addDownload(updateData)

      mainWindow?.webContents.send('download-updated', updateData)
    })

    item.once('done', (_event, state) => {
      activeDownloads.delete(id)

      const doneData = {
        id,
        fileName,
        totalBytes,
        receivedBytes: item.getReceivedBytes(),
        state,
        savePath: item.getSavePath(),
      }

      DB.addDownload(doneData)

      try {
        new Notification({
          title: 'Download completed',
          body: fileName,
        }).show()
      } catch (_) {}

      mainWindow?.webContents.send('download-done', doneData)
    })
  })
}

function createWindow() {
  DB.init()
  v4v.init(nwc)

  mainWindow = new BrowserWindow({
    width: 1280, height: 800, minWidth: 900, minHeight: 600,
    frame: false, backgroundColor: '#0f0f12',
    webPreferences: {
      preload: path.join(__dirname, '../preload/shell.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  session.defaultSession.setUserAgent(currentUA)
  activeView = createMainView()

  setupPrivacy(session.defaultSession)
  setupDownloads(session.defaultSession)
  applyNetworkProxy().catch(err => console.error('[Proxy] apply failed', err))

  bl.init((size) => {
    mainWindow?.webContents.send('blocklist-ready', { size })
  })

  mainWindow.on('resize', () => {
    if (activeTabId && tabUrls.get(activeTabId)) showView(mainWindow, activeView)
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:3000')
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'))
  }

  mainWindow.once('ready-to-show', () => {
    // Clear service worker and cache storage to avoid stale cache issues
    session.defaultSession.clearStorageData({
      storages: ['serviceworkers', 'cachestorage'],
    }).catch(() => {})
    mainWindow.maximize()
    mainWindow.show()
    setTimeout(() => {
      mainWindow?.webContents.focus()
      mainWindow?.webContents.executeJavaScript(
        `document.querySelector('.addr-input')?.focus()`
      ).catch(() => {})
    }, 500)
  })

  mainWindow.webContents.on('did-finish-load', () => {
    const initialized = DB.getSetting('initialized') === '1'
    mainWindow.webContents.send('app-ready', { initialized })
    if (initialized) nwc.reconnectFromDB(DB).catch(() => {})
  })
}

// ── IPC: window controls ──────────────────────────────────────────────────────
ipcMain.on('win-minimize', () => mainWindow?.minimize())
ipcMain.on('win-maximize', () =>
  mainWindow?.isMaximized() ? mainWindow.unmaximize() : mainWindow?.maximize()
)
ipcMain.on('win-close', () => mainWindow?.close())

// ── IPC: open link in current tab (middle-click) ──────────────────────────────
ipcMain.handle('open-in-new-tab', (_, { url }) => {
  mainWindow?.webContents.send('open-new-tab', { url })
})

// ── IPC: tabs ─────────────────────────────────────────────────────────────────
ipcMain.handle('tab-create', (_, { tabId }) => {
  tabUrls.set(tabId, '')
  activeTabId = tabId
  showView(mainWindow, activeView)
  activeView.webContents.loadURL('about:blank').catch(() => {})
  return { ok: true }
})

ipcMain.handle('tab-switch', (_, { tabId }) => {
  activeTabId = tabId
  const url = tabUrls.get(tabId) || ''
  if (url && url !== 'zap://newtab') {
    showView(mainWindow, activeView)
    const current = activeView.webContents.getURL()
    if (current !== url) {
      isSwitching = true
      activeView.webContents.loadURL(url)
        .catch(() => {})
        .finally(() => { isSwitching = false })
    }
  } else {
    hideView(mainWindow, activeView)
  }
  return { ok: true }
})

ipcMain.handle('tab-navigate', async (_, { tabId, url }) => {
  if (!tabId || typeof url !== 'string') return { ok: false, error: 'Invalid arguments' }
  let u = url.trim()
  if (!u.startsWith('http://') && !u.startsWith('https://')) {
    u = u.includes('.') && !u.includes(' ')
      ? 'https://' + u
      : 'https://duckduckgo.com/?q=' + encodeURIComponent(u)
  }
  activeTabId = tabId
  tabUrls.set(tabId, u)
  showView(mainWindow, activeView)
  await new Promise(r => setTimeout(r, 50))
  activeView.webContents.loadURL(u).catch(() => {})
  return { ok: true, url: u }
})

ipcMain.handle('tab-close', (_, { tabId }) => {
  tabUrls.delete(tabId)
  if (activeTabId === tabId) { hideView(mainWindow, activeView); activeTabId = null }
  return { ok: true }
})

ipcMain.handle('tab-home', (_, { tabId }) => {
  activeTabId = tabId
  tabUrls.set(tabId, '')
  hideView(mainWindow, activeView)
  return { ok: true }
})

ipcMain.handle('tab-go-back',  () => activeView?.webContents.goBack())
ipcMain.handle('tab-go-forward', () => activeView?.webContents.goForward())
ipcMain.handle('tab-reload',   () => activeView?.webContents.reload())

ipcMain.handle('shell-resize', (_, args) => {
  if (!activeTabId || !tabUrls.get(activeTabId)) return
  resizeView(mainWindow, activeView, args)
})

ipcMain.handle('download-cancel', (_, { id }) => {
  V.assert(typeof id === 'string' && id.length > 0 && id.length <= 200, 'Invalid download id')

  const item = activeDownloads.get(id)
  if (!item) return { ok: false, error: 'Download not found or already finished' }

  try {
    item.cancel()
    activeDownloads.delete(id)
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err?.message || 'Cancel failed' }
  }
})

ipcMain.handle('download-open', async (_, { path: filePath }) => {
  V.assert(typeof filePath === 'string' && filePath.length > 0 && filePath.length <= 5000, 'Invalid download path')
  return shell.openPath(filePath)
})

ipcMain.handle('download-show-folder', (_, { path: filePath }) => {
  V.assert(typeof filePath === 'string' && filePath.length > 0 && filePath.length <= 5000, 'Invalid download path')
  shell.showItemInFolder(filePath)
  return { ok: true }
})

ipcMain.handle('address-suggestions-show', (_, args) => showAddressSuggestions(args || {}))
ipcMain.handle('address-suggestions-hide', () => {
  hideAddressSuggestions()
  return { ok: true }
})

ipcMain.on('address-suggestion-selected', (_event, url) => {
  hideAddressSuggestions()

  if (!url || typeof url !== 'string') return

  mainWindow?.webContents.send('address-suggestion-picked', { url })
})

ipcMain.handle('show-bookmark-context-menu', async (_, bookmark) => {
  const action = await showBookmarkContextMenu({
    mainWindow,
    bookmark,
  })

  return { ok: true, action }
})

ipcMain.handle('show-bookmark-folder-popup', (_, args) => {
  return showBookmarkFolderPopup({
    mainWindow,
    folder: args?.folder,
    items: args?.items || [],
    x: args?.x || 0,
    y: args?.y || 0,
  })
})

ipcMain.handle('hide-bookmark-folder-popup', () => {
  hideBookmarkFolderPopup()
  return { ok: true }
})

ipcMain.on('bookmark-folder-popup-picked', (_event, item) => {
  hideBookmarkFolderPopup()
  mainWindow?.webContents.send('bookmark-folder-picked', item)
})

ipcMain.on('bookmark-folder-popup-open-new-tab', (_event, url) => {
  hideBookmarkFolderPopup()

  if (!url || typeof url !== 'string') return

  mainWindow?.webContents.send('bookmark-open-new-tab', { url })
})

ipcMain.on('bookmark-folder-popup-context-menu', (_event, bookmark) => {
  showBookmarkContextMenu({
    mainWindow,
    bookmark,
  })
})

ipcMain.handle('show-edit-context-menu', () => {
  const { Menu } = require('electron')

  const menu = Menu.buildFromTemplate([
    { role: 'cut', label: 'Cut' },
    { role: 'copy', label: 'Copy' },
    { role: 'paste', label: 'Paste' },
    { type: 'separator' },
    { role: 'selectAll', label: 'Select All' },
  ])

  menu.popup({ window: mainWindow })
  return { ok: true }
})

ipcMain.handle('show-ua-menu', () => {
  const { Menu } = require('electron')

  const priv = DB.getPrivacy()
  const current = priv?.ua_mode || 'rotate'

  const menu = Menu.buildFromTemplate([
    {
      label: 'Auto-rotate',
      type: 'radio',
      checked: current === 'rotate',
      click: () => {
        DB.setPrivacy('ua_mode', 'rotate')
        currentUA = UA_POOL[Math.floor(Math.random() * UA_POOL.length)]
        session.defaultSession.setUserAgent(currentUA)
        mainWindow?.webContents.send('ua-mode-updated', { mode: 'rotate', ua: currentUA })
      },
    },
    {
      label: 'Default browser',
      type: 'radio',
      checked: current === 'default',
      click: () => {
        DB.setPrivacy('ua_mode', 'default')
        session.defaultSession.setUserAgent('')
        mainWindow?.webContents.send('ua-mode-updated', { mode: 'default', ua: '' })
      },
    },
    { type: 'separator' },
    {
      label: 'Rotate now',
      click: () => {
        currentUA = UA_POOL[Math.floor(Math.random() * UA_POOL.length)]
        session.defaultSession.setUserAgent(currentUA)
        mainWindow?.webContents.send('ua-mode-updated', { mode: 'rotate', ua: currentUA })
      },
    },
  ])

  menu.popup({ window: mainWindow })
  return { ok: true }
})

// ── IPC: privacy ──────────────────────────────────────────────────────────────
ipcMain.handle('get-privacy', () => ({
  ...DB.getPrivacy(),
  blockedCount:   bl.getBlockedCount(),
  blocklistSize:  bl.getListSize(),
  blocklistReady: bl.isReady(),
  dohEnabled:     doh.isEnabled(),
}))
ipcMain.handle('set-adblock',  (_, { enabled }) => DB.setPrivacy('adblock', enabled ? 1 : 0))
ipcMain.handle('set-webrtc',   (_, { enabled }) => DB.setPrivacy('webrtc_protect', enabled ? 1 : 0))
ipcMain.handle('set-popup-block', (_, { enabled }) => DB.setPrivacy('popup_block', enabled ? 1 : 0))
ipcMain.handle('set-overlay-block', (_, { enabled }) => DB.setPrivacy('overlay_block', enabled ? 1 : 0))
ipcMain.handle('set-ua-mode',  (_, { mode }) => {
  DB.setPrivacy('ua_mode', mode)
  if (mode === 'rotate') currentUA = UA_POOL[Math.floor(Math.random() * UA_POOL.length)]
  session.defaultSession.setUserAgent(mode === 'default' ? '' : currentUA)
  return currentUA
})
ipcMain.handle('rotate-ua', () => {
  currentUA = UA_POOL[Math.floor(Math.random() * UA_POOL.length)]
  session.defaultSession.setUserAgent(currentUA)
  return currentUA
})
ipcMain.handle('get-blocked-count',  () => bl.getBlockedCount())
ipcMain.handle('get-ua-pool',        () => UA_POOL)
ipcMain.handle('set-doh', (_, { enabled, provider }) => {
  doh.setEnabled(enabled)
  if (provider) doh.setProvider(provider)
  DB.setPrivacy('doh_enabled', enabled ? 1 : 0)
  return { ok: true }
})
ipcMain.handle('set-tor-proxy', async (_, { enabled, host, port } = {}) => {
  DB.setPrivacy('tor_enabled', enabled ? 1 : 0)

  if (host != null) {
    V.assert(typeof host === 'string' && host.length > 0 && host.length <= 255, 'Invalid proxy host')
    DB.setPrivacy('tor_host', host.trim())
  }

  if (port != null) {
    const safePort = Number(port)
    V.assert(Number.isSafeInteger(safePort) && safePort > 0 && safePort <= 65535, 'Invalid proxy port')
    DB.setPrivacy('tor_port', safePort)
  }

  return applyNetworkProxy()
})
ipcMain.handle('get-download-history', () => {
  const items = DB.getDownloads()
  console.log('[Downloads] history request', items)
  return items
})

ipcMain.handle('clear-download-history', () => {
  DB.clearDownloads()
  return { ok: true }
})

ipcMain.handle('get-blocklist-info', () => ({
  size:  bl.getListSize(),
  ready: bl.isReady(),
  count: bl.getBlockedCount(),
}))

// ── IPC: value4value ──────────────────────────────────────────────────────────
ipcMain.handle('v4v-send-boost',  (_, { amount, message }) => v4v.sendBoost(DB, amount, message))
ipcMain.handle('v4v-set-autopay', (_, { enabled, amount }) => {
  v4v.setAutoPayEnabled(enabled)
  if (amount) v4v.setAutoPayAmount(amount)
  return { ok: true }
})
ipcMain.handle('v4v-get-settings', () => ({
  enabled: v4v.isAutoPayEnabled(),
  amount:  v4v.getAutoPayAmount(),
}))

// ── IPC: wallet setup ─────────────────────────────────────────────────────────
ipcMain.handle('is-initialized',    () => DB.getSetting('initialized') === '1')
ipcMain.handle('generate-mnemonic', () => wallet.generateMnemonic())
ipcMain.handle('validate-mnemonic', (_, { words }) => {
  V.assert(typeof words === 'string' && words.length <= 500, 'Invalid mnemonic')
  return wallet.validateMnemonic(words)
})
ipcMain.handle('setup-wallet',      (_, args) => {
  V.assert(args && typeof args === 'object', 'Invalid wallet setup payload')
  if (args.mnemonic != null) {
    V.assert(typeof args.mnemonic === 'string' && args.mnemonic.length <= 500, 'Invalid mnemonic')
  }
  if (args.mode != null) {
    V.assert(typeof args.mode === 'string' && args.mode.length <= 80, 'Invalid setup mode')
  }
  return wallet.setupWallet(DB, args)
})

// ── IPC: nostr ────────────────────────────────────────────────────────────────
ipcMain.handle('nostr-create-profile', (_, args) => {
  V.assert(args && typeof args === 'object', 'Invalid profile payload')
  if (args.name != null) {
    V.assert(typeof args.name === 'string' && args.name.length <= 120, 'Invalid name')
  }
  return nostr.createProfile(DB, args)
})
ipcMain.handle('nostr-import-nsec',    (_, args) => {
  V.validateNsec(args?.nsec)

  if (args?.name) {
    V.assert(typeof args.name === 'string' && args.name.length <= 120, 'Invalid name')
  }

  return nostr.importNsec(DB, args)
})
ipcMain.handle('nostr-skip',           () => DB.setSetting('nostr_skipped', '1'))
ipcMain.handle('nostr-get-profile',    () => nostr.getProfile(DB))
ipcMain.handle('nostr-list-profiles',  () => nostr.listProfiles(DB))
ipcMain.handle('nostr-set-active-profile', (_, { id }) => {
  V.assert(Number.isSafeInteger(Number(id)), 'Invalid profile id')
  return nostr.setActiveProfile(DB, Number(id))
})
ipcMain.handle('nostr-remove-profile-by-id', (_, { id }) => {
  V.assert(Number.isSafeInteger(Number(id)), 'Invalid profile id')
  return nostr.removeProfileById(DB, Number(id))
})
ipcMain.handle('nostr-remove-profile', () => nostr.removeProfile(DB))
ipcMain.handle('nostr-list-permissions', () => DB.listNostrPermissions())
ipcMain.handle('nostr-clear-permissions', () => DB.clearNostrPermissions())
ipcMain.handle('nostr-remove-permission', (_, { origin, action }) => {
  V.validateOrigin(origin)
  V.assert(typeof action === 'string' && action.length <= 80, 'Invalid action')
  return DB.removeNostrPermission(origin, action)
})
ipcMain.handle('nostr-get-relays',     () => nostr.getRelays())
ipcMain.handle('nostr-sign-event',     (_, { event }) => {
  V.validateNostrEvent(event)
  return nostr.signEvent(DB, event)
})
ipcMain.handle('nostr-get-pubkey',     () => nostr.getPubkey(DB))
// NIP-07 aliases — same implementation, separate IPC channels for clarity
ipcMain.handle('nostr-get-pubkey-nip07', async (ipcEvent) => {
  const allowed = await confirmNostrPermission(ipcEvent, 'getPublicKey', null)

  if (!allowed) {
    throw new Error('Nostr public key request denied by user')
  }

  return nostr.getPubkey(DB)
})
ipcMain.handle('nostr-sign-event-nip07', async (ipcEvent, { event: e }) => {
  V.validateNostrEvent(e)

  const allowed = await confirmNostrPermission(ipcEvent, 'signEvent', e)

  if (!allowed) {
    throw new Error('Nostr signing request denied by user')
  }

  return nostr.signEvent(DB, e)
})
ipcMain.handle('nostr-get-relays-nip07',  () => nostr.getRelays())
ipcMain.handle('nostr-nip04-encrypt', async (ipcEvent, { pubkey, text }) => {
  V.assert(
    typeof pubkey === 'string' &&
    /^[0-9a-fA-F]{64}$/.test(pubkey),
    'Invalid pubkey'
  )

  V.assert(
    typeof text === 'string' &&
    text.length > 0 &&
    text.length <= 50000,
    'Invalid text'
  )

  const allowed = await confirmNostrPermission(ipcEvent, 'nip04.encrypt', {
    pubkey,
    text,
  })

  if (!allowed) {
    throw new Error('Nostr NIP-04 encrypt request denied by user')
  }

  const { nip04 } = require('nostr-tools')
  const keychain = require('./keychain')
  const row = DB._db().prepare('SELECT encrypted_nsec FROM nostr_profile WHERE id=1').get()

  if (!row) throw new Error('No Nostr profile found')

  const key        = await keychain.getOrCreateKey()
  const privKeyHex = keychain.decrypt(row.encrypted_nsec, key)

  return nip04.encrypt(privKeyHex, pubkey, text)
})
ipcMain.handle('nostr-nip04-decrypt', async (ipcEvent, { pubkey, text }) => {
  V.assert(
    typeof pubkey === 'string' &&
    /^[0-9a-fA-F]{64}$/.test(pubkey),
    'Invalid pubkey'
  )

  V.assert(
    typeof text === 'string' &&
    text.length > 0 &&
    text.length <= 50000,
    'Invalid text'
  )

  const allowed = await confirmNostrPermission(ipcEvent, 'nip04.decrypt', {
    pubkey,
    text,
  })

  if (!allowed) {
    throw new Error('Nostr NIP-04 decrypt request denied by user')
  }

  const { nip04 } = require('nostr-tools')
  const keychain = require('./keychain')
  const row = DB._db().prepare('SELECT encrypted_nsec FROM nostr_profile WHERE id=1').get()

  if (!row) throw new Error('No Nostr profile found')

  const key        = await keychain.getOrCreateKey()
  const privKeyHex = keychain.decrypt(row.encrypted_nsec, key)

  return nip04.decrypt(privKeyHex, pubkey, text)
})
// ── IPC: LNURL / Lightning Address ────────────────────────────────────────────
ipcMain.handle('lnurl-is-lightning-address', (_, { value }) => {
  V.assert(typeof value === 'string' && value.length <= 500, 'Invalid Lightning Address')
  return lnurl.isLightningAddress(value)
})

ipcMain.handle('lnurl-fetch-pay-params', (_, { address }) => {
  V.assert(typeof address === 'string' && address.length <= 500, 'Invalid Lightning Address')
  return lnurl.fetchPayParams(address)
})

ipcMain.handle('lnurl-request-invoice', (_, args) => {
  V.assert(args && typeof args === 'object', 'Invalid LNURL request')
  V.assert(typeof args.callback === 'string' && args.callback.length <= 3000, 'Invalid callback')
  V.assert(Number.isSafeInteger(args.amountMsat) && args.amountMsat > 0, 'Invalid amount')
  if (args.comment != null) {
    V.assert(typeof args.comment === 'string' && args.comment.length <= 1000, 'Invalid comment')
  }
  return lnurl.requestInvoice(args)
})
// ── IPC: NWC lightning ────────────────────────────────────────────────────────
ipcMain.handle('nwc-connect',     (_, args)      => {
  V.assert(args && typeof args === 'object', 'Invalid NWC payload')
  V.assert(typeof args.nwcUri === 'string' && args.nwcUri.startsWith('nostr+walletconnect://') && args.nwcUri.length <= 5000, 'Invalid NWC URI')
  if (args.name != null) {
    V.assert(typeof args.name === 'string' && args.name.length <= 120, 'Invalid connection name')
  }
  return nwc.connect(DB, args)
})
ipcMain.handle('nwc-disconnect',  ()              => nwc.disconnect(DB))
ipcMain.handle('nwc-is-connected',()              => nwc.isConnected(DB))
ipcMain.handle('nwc-get-balance', ()              => nwc.getBalance(DB))
ipcMain.handle('nwc-pay-invoice', (_, { invoice }) => {
  V.validateInvoice(invoice)
  return nwc.payInvoice(DB, invoice)
})
ipcMain.handle('nwc-make-invoice',(_, args)      => {
  V.assert(args && typeof args === 'object', 'Invalid invoice payload')
  V.assert(Number.isSafeInteger(args.amountMsat) && args.amountMsat > 0, 'Invalid amount')
  if (args.description != null) {
    V.assert(typeof args.description === 'string' && args.description.length <= 1000, 'Invalid description')
  }
  return nwc.makeInvoice(DB, args)
})
ipcMain.handle('decode-invoice',  (_, { bolt11 }) => {
  V.validateInvoice(bolt11)
  return nwc.decodeInvoice(bolt11)
})

// ── IPC: favorites ────────────────────────────────────────────────────────────
ipcMain.handle('get-favorites',   () => DB.getFavorites())
ipcMain.handle('add-favorite',    (_, args) => {
  V.assert(args && typeof args === 'object', 'Invalid favorite payload')
  V.assert(typeof args.url === 'string' && args.url.length <= 3000, 'Invalid URL')
  if (args.title != null) V.assert(typeof args.title === 'string' && args.title.length <= 300, 'Invalid title')
  if (args.favicon != null) V.assert(typeof args.favicon === 'string' && args.favicon.length <= 5000, 'Invalid favicon')
  return DB.addFavorite(args)
})
ipcMain.handle('remove-favorite', (_, { id }) => {
  V.assert(Number.isSafeInteger(Number(id)), 'Invalid favorite id')
  return DB.removeFavorite(id)
})

ipcMain.handle('rename-favorite', (_, { id, title }) => {
  V.assert(Number.isSafeInteger(Number(id)), 'Invalid favorite id')
  V.assert(typeof title === 'string' && title.trim().length > 0 && title.length <= 300, 'Invalid title')
  return DB.updateFavoriteTitle(Number(id), title.trim())
})

ipcMain.handle('move-favorite', (_, { id, parent_id }) => {
  V.assert(Number.isSafeInteger(Number(id)), 'Invalid favorite id')

  if (parent_id !== null && parent_id !== undefined) {
    V.assert(Number.isSafeInteger(Number(parent_id)), 'Invalid parent folder id')
  }

  return DB.moveFavorite(Number(id), parent_id === 'root' ? null : parent_id)
})

ipcMain.handle('export-favorites-html', () => {
  const favorites = DB.getFavorites()
  const byParent = {}

  for (const item of favorites) {
    const key = item.parent_id == null ? 'root' : String(item.parent_id)
    if (!byParent[key]) byParent[key] = []
    byParent[key].push(item)
  }

  for (const key of Object.keys(byParent)) {
    byParent[key].sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0))
  }

  const esc = (s = '') => String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

  const render = (parentId = null, depth = 1) => {
    const key = parentId == null ? 'root' : String(parentId)
    const items = byParent[key] || []
    const pad = '    '.repeat(depth)
    let out = `${pad}<DL><p>\n`

    for (const item of items) {
      if (Number(item.is_folder) === 1) {
        out += `${pad}    <DT><H3>${esc(item.title || 'Folder')}</H3>\n`
        out += render(item.id, depth + 1)
      } else if (item.url) {
        out += `${pad}    <DT><A HREF="${esc(item.url)}">${esc(item.title || item.url)}</A>\n`
      }
    }

    out += `${pad}</DL><p>\n`
    return out
  }

  const html = [
    '<!DOCTYPE NETSCAPE-Bookmark-file-1>',
    '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
    '<TITLE>Bookmarks</TITLE>',
    '<H1>Bookmarks</H1>',
    render(null, 0),
  ].join('\n')

  return { ok: true, html }
})

ipcMain.handle('import-favorites-html', (_, { html }) => {
  V.assert(typeof html === 'string' && html.length <= 10_000_000, 'Invalid bookmarks HTML')

  const results = []
  const stack = [null]
  let sortOrder = 0

  const tokenRe = /<DT>\s*<H3[^>]*>(.*?)<\/H3>|<DL><p>|<\/DL><p>|<DT>\s*<A[^>]+HREF="([^"]+)"[^>]*>(.*?)<\/A>/gis

  let match
  while ((match = tokenRe.exec(html)) !== null) {
    const folderTitle = match[1]?.replace(/<[^>]+>/g, '').trim()
    const url = match[2]?.trim()
    const title = match[3]?.replace(/<[^>]+>/g, '').trim()

    if (folderTitle) {
      try {
        const parentId = stack[stack.length - 1]
        const folder = DB.addFavorite({
          title: folderTitle,
          url: '',
          favicon: null,
          parent_id: parentId,
          is_folder: 1,
          sort_order: sortOrder++,
        })

        stack.push(folder.id)
        results.push({ type: 'folder', title: folderTitle })
      } catch (_) {}
      continue
    }

    if (match[0].toUpperCase().startsWith('</DL')) {
      if (stack.length > 1) stack.pop()
      continue
    }

    if (url && title && /^https?:\/\//i.test(url)) {
      try {
        DB.addFavorite({
          title,
          url,
          favicon: null,
          parent_id: stack[stack.length - 1],
          is_folder: 0,
          sort_order: sortOrder++,
        })

        results.push({ type: 'bookmark', url, title })
      } catch (_) {}
    }
  }

  return results
})

// ── IPC: cashu ────────────────────────────────────────────────────────────────
ipcMain.handle('cashu-get-balance', () => DB.cashuGetBalance())
ipcMain.handle('cashu-list-mints',  () => DB.cashuListMints())
ipcMain.handle('cashu-add-mint', (_, { url }) => {
  if (!url || typeof url !== 'string' || !url.startsWith('https://')) throw new Error('Invalid mint URL')
  return cashu.addMint(DB, { url })
})
ipcMain.handle('cashu-remove-mint',      (_, { url }) => {
  V.assert(typeof url === 'string' && url.length <= 3000, 'Invalid mint URL')
  return DB.cashuRemoveMint(url)
})
ipcMain.handle('cashu-mint-tokens',      (_, args) => {
  V.assert(args && typeof args === 'object', 'Invalid Cashu mint payload')
  V.assert(Number.isSafeInteger(Number(args.amount)) && Number(args.amount) > 0, 'Invalid amount')
  V.assert(typeof args.mintUrl === 'string' && args.mintUrl.length <= 3000, 'Invalid mint URL')
  return cashu.mintTokens(DB, args)
})
ipcMain.handle('cashu-check-mint-quote', (_, args) => {
  V.assert(args && typeof args === 'object', 'Invalid Cashu quote payload')
  V.assert(typeof args.quote === 'string' && args.quote.length <= 3000, 'Invalid quote')
  V.assert(Number.isSafeInteger(Number(args.amount)) && Number(args.amount) > 0, 'Invalid amount')
  V.assert(typeof args.mintUrl === 'string' && args.mintUrl.length <= 3000, 'Invalid mint URL')
  return cashu.checkMintQuote(DB, args)
})
ipcMain.handle('cashu-receive',          (_, args) => {
  V.assert(args && typeof args === 'object', 'Invalid Cashu receive payload')
  V.assert(typeof args.token === 'string' && args.token.length <= 200000, 'Invalid Cashu token')
  return cashu.receive(DB, args)
})

// ── IPC: devtools ─────────────────────────────────────────────────────────────
ipcMain.handle('open-devtools', () => {
  if (activeView) activeView.webContents.openDevTools()
  else mainWindow?.webContents.openDevTools()
})

// ── IPC: updates ─────────────────────────────────────────────────────────────
ipcMain.handle('get-app-version', () => app.getVersion())

ipcMain.handle('check-for-updates', async () => {
  const currentVersion = app.getVersion()

  try {
    const res = await fetch('https://api.github.com/repos/shadowbipnode/Zap-Browser/releases/latest', {
      headers: {
        'User-Agent': 'Zap-Browser',
        'Accept': 'application/vnd.github+json',
      },
    })

    if (!res.ok) {
      throw new Error(`GitHub returned ${res.status}`)
    }

    const release = await res.json()
    const latestVersion = String(release.tag_name || '').replace(/^v/, '')

    return {
      ok: true,
      currentVersion,
      latestVersion,
      updateAvailable: latestVersion && latestVersion !== currentVersion,
      releaseUrl: release.html_url || 'https://github.com/shadowbipnode/Zap-Browser/releases',
    }
  } catch (err) {
    return {
      ok: false,
      currentVersion,
      error: err.message || 'Unable to check for updates',
      releaseUrl: 'https://github.com/shadowbipnode/Zap-Browser/releases',
    }
  }
})

ipcMain.handle('open-releases-page', () => {
  shell.openExternal('https://github.com/shadowbipnode/Zap-Browser/releases')
  return { ok: true }
})

// ── IPC: history & data ───────────────────────────────────────────────────────
ipcMain.handle('get-history',   (_, { limit } = {}) => {
  const safeLimit = Number(limit || 100)
  V.assert(Number.isSafeInteger(safeLimit) && safeLimit > 0 && safeLimit <= 1000, 'Invalid history limit')
  return DB.getHistory(safeLimit)
})
ipcMain.handle('clear-history', () => DB.clearHistory())
ipcMain.handle('clear-cookies', async () => {
  await session.defaultSession.clearStorageData({
    storages: ['cookies', 'localstorage', 'sessionstorage', 'indexdb', 'websql', 'serviceworkers', 'cachestorage'],
  })
  return { ok: true }
})
ipcMain.handle('clear-cache', async () => {
  await session.defaultSession.clearCache()
  return { ok: true }
})
ipcMain.handle('reset-browser', () => {
  const dbPath = path.join(app.getPath('userData'), 'zap.db')
  try { require('fs').unlinkSync(dbPath) } catch (_) {}
  return { ok: true }
})

app.whenReady().then(createWindow)
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
