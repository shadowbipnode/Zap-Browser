'use strict'
const { app, BrowserWindow, BrowserView, ipcMain, session, dialog, shell, Notification } = require('electron')
const portable = require('./portable')
const path   = require('path')
const fs     = require('fs')
const os     = require('os')
const crypto = require('crypto')
const DB     = require('./db')
const wallet = require('./wallet')
const nostr  = require('./nostr')
const nwc    = require('./nwc')
const bl     = require('./blocklist')
const cosmetic = require('./cosmetic')
const overlayProtection = require('./overlayProtection')
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
const profileContext = require('./browser/profileContext')

const {
  showBookmarkContextMenu,
} = require('./ui/bookmarkMenus')

const {
  showBookmarkFolderPopup,
  hideBookmarkFolderPopup,
} = require('./ui/bookmarkFolderPopup')



const isDev = !app.isPackaged
const ZAP_DEBUG = process.env.ZAP_DEBUG === '1'


app.commandLine.appendSwitch(
  'disable-features',
  [
    'UserAgentClientHint',
    'AcceptCHFrame',
    'MediaRouter',
    'OptimizationHints',
    'AutofillServerCommunication',
    'PrivacySandboxSettings4',
  ].join(',')
)

app.commandLine.appendSwitch('disable-rtc-smoothness-algorithm')

app.commandLine.appendSwitch(
  'js-flags',
  '--random-seed=1157259157'
)

app.commandLine.appendSwitch(
  'force-dark-mode'
)




app.commandLine.appendSwitch(
  'disable-features',
  [
    'UserAgentClientHint',
    'AcceptCHFrame',
    'MediaRouter',
    'OptimizationHints',
    'AutofillServerCommunication',
    'PrivacySandboxSettings4',
  ].join(',')
)

app.commandLine.appendSwitch('disable-rtc-smoothness-algorithm')

app.commandLine.appendSwitch(
  'js-flags',
  '--random-seed=1157259157'
)

app.commandLine.appendSwitch('force-dark-mode')



let mainWindow  = null
let activeView  = null
const tabViews  = new Map()
const tabUrls   = new Map()
const tabMeta   = new Map()
const tabErrorPages = new Map()
let activeTabId = null
let navigationOwnerTabId = null
let isSwitching = false
let shellLayout = { panelWidth: 0 }
const activeDownloads = new Map()
const lastTabUpdates = new Map()
const configuredSessions = new Set()
const configuredSessionProfileIds = new Map()
const privacySessions = new Set()
const downloadSessions = new Set()
const webContentsProfileIds = new Map()

const FINGERPRINT_PROFILES = [
  {
    name: 'linux-chrome-utc',
    platform: 'Linux x86_64',
    hardwareConcurrency: 4,
    deviceMemory: 4,
    timezone: 'UTC',
    timezoneOffset: 0,
    language: 'en-US',
    languages: ['en-US', 'en'],
    webglVendor: 'Google Inc.',
    webglRenderer: 'ANGLE (Intel, Mesa Intel UHD Graphics, OpenGL 4.6)',
  },
  {
    name: 'linux-chrome-eu',
    platform: 'Linux x86_64',
    hardwareConcurrency: 8,
    deviceMemory: 8,
    timezone: 'Europe/Rome',
    timezoneOffset: -120,
    language: 'en-US',
    languages: ['en-US', 'en'],
    webglVendor: 'Google Inc.',
    webglRenderer: 'ANGLE (Intel, Mesa Intel UHD Graphics, OpenGL 4.6)',
  },
  {
    name: 'windows-chrome-utc',
    platform: 'Win32',
    hardwareConcurrency: 8,
    deviceMemory: 8,
    timezone: 'UTC',
    timezoneOffset: 0,
    language: 'en-US',
    languages: ['en-US', 'en'],
    webglVendor: 'Google Inc.',
    webglRenderer: 'ANGLE (Intel, Intel(R) UHD Graphics Direct3D11 vs_5_0 ps_5_0)',
  },
  {
    name: 'mac-chrome-utc',
    platform: 'MacIntel',
    hardwareConcurrency: 8,
    deviceMemory: 8,
    timezone: 'UTC',
    timezoneOffset: 0,
    language: 'en-US',
    languages: ['en-US', 'en'],
    webglVendor: 'Google Inc.',
    webglRenderer: 'ANGLE (Apple, ANGLE Metal Renderer: Apple M1)',
  },
]

const fingerprintProfile =
  FINGERPRINT_PROFILES[Math.floor(Math.random() * FINGERPRINT_PROFILES.length)]

console.log('[Fingerprint] active profile:', fingerprintProfile.name)

let addressSuggestWindow = null


const UA_POOL = [
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64; rv:126.0) Gecko/20100101 Firefox/126.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
]
let currentUA = UA_POOL[Math.floor(Math.random() * UA_POOL.length)]
const nostrSessionPermissions = new Map()

function getActiveBrowserProfile() {
  return DB.getActiveBrowserProfile() || { id: 'default', name: 'Default', is_default: 1 }
}

function getBrowserProfileForTab(tabId) {
  const meta = tabMeta.get(tabId) || {}
  return DB.getBrowserProfileById(meta.profileId) || getActiveBrowserProfile()
}

function getProfileSession(profile) {
  return profileContext.getPersistentSession(session, profile?.id)
}

function getPrivateSession(profile, tabId) {
  return profileContext.getPrivateSession(session, profile?.id, tabId)
}

function getBrowserProfileIdForSession(ses) {
  return configuredSessionProfileIds.get(ses) || 'default'
}

function getPrivacyForSession(ses) {
  return DB.getPrivacy(getBrowserProfileIdForSession(ses))
}

function setUserAgentForSession(ses) {
  const priv = getPrivacyForSession(ses)
  ses.setUserAgent(priv?.ua_mode === 'default' ? '' : currentUA)
}

function setUserAgentForConfiguredSessions() {
  for (const ses of configuredSessions) {
    try { setUserAgentForSession(ses) } catch (_) {}
  }
}

function configureBrowserSession(ses, profile = null) {
  if (!ses) return ses

  configuredSessions.add(ses)
  configuredSessionProfileIds.set(ses, profile?.id || getBrowserProfileIdForSession(ses))
  setUserAgentForSession(ses)
  setupPrivacy(ses)
  setupDownloads(ses)
  applyProxyToSession(ses).catch(() => {})

  return ses
}

function forgetBrowserProfileSessions(profileId) {
  for (const [ses, configuredProfileId] of configuredSessionProfileIds.entries()) {
    if (configuredProfileId !== profileId) continue
    configuredSessionProfileIds.delete(ses)
    configuredSessions.delete(ses)
    privacySessions.delete(ses)
    downloadSessions.delete(ses)
  }
}

function getTabSession(tabId, isPrivate = false, profile = null) {
  const targetProfile = profile || getBrowserProfileForTab(tabId)
  const ses = isPrivate
    ? getPrivateSession(targetProfile, tabId)
    : getProfileSession(targetProfile)

  return configureBrowserSession(ses, targetProfile)
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function makeNavigationErrorHtml({ url, errorCode, errorDescription }) {
  const safeUrl = escapeHtml(url || '')
  const safeDescription = escapeHtml(errorDescription || 'Navigation failed')
  const safeCode = escapeHtml(errorCode)

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Page unavailable</title>
<style>
  :root {
    color-scheme: dark;
    font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    background: #0f1117;
    color: #f4f4f5;
  }
  body {
    margin: 0;
    min-height: 100vh;
    display: grid;
    place-items: center;
    background:
      radial-gradient(circle at 15% 10%, rgba(245,166,35,.11), transparent 28rem),
      #0f1117;
  }
  main {
    width: min(680px, calc(100vw - 48px));
    border: 1px solid rgba(255,255,255,.10);
    border-radius: 12px;
    background: rgba(21,23,32,.92);
    box-shadow: 0 24px 70px rgba(0,0,0,.45);
    padding: 28px;
  }
  h1 { margin: 0 0 10px; font-size: 24px; line-height: 1.2; }
  p { margin: 0 0 16px; color: #a1a1aa; line-height: 1.5; }
  code {
    display: block;
    margin: 14px 0 18px;
    padding: 12px;
    border-radius: 8px;
    overflow-wrap: anywhere;
    background: rgba(255,255,255,.06);
    color: #fbbf24;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 12px;
  }
  .actions { display: flex; gap: 10px; flex-wrap: wrap; }
  button {
    height: 34px;
    border: 1px solid rgba(245,166,35,.55);
    border-radius: 8px;
    background: rgba(245,166,35,.16);
    color: #fbbf24;
    font-weight: 800;
    cursor: pointer;
    padding: 0 14px;
  }
  button.secondary {
    border-color: rgba(255,255,255,.16);
    background: rgba(255,255,255,.06);
    color: #e4e4e7;
  }
</style>
</head>
<body>
  <main>
    <h1>This page could not be loaded</h1>
    <p>The main frame failed before a page could render. You can retry, edit the address bar, or navigate somewhere else.</p>
    <code>${safeDescription} (${safeCode})<br>${safeUrl}</code>
    <div class="actions">
      <button onclick="location.href=${escapeHtml(JSON.stringify(url || ''))}">Retry</button>
      <button class="secondary" onclick="history.back()">Back</button>
    </div>
  </main>
</body>
</html>`
}

function isNavigationErrorPageUrl(url) {
  return typeof url === 'string' && url.startsWith('data:text/html;charset=utf-8,')
}

function showNavigationErrorPage(view, tabId, url, errorCode, errorDescription) {
  if (!view || view.webContents.isDestroyed() || !tabId || !url || isNavigationErrorPageUrl(url)) return

  tabUrls.set(tabId, url)
  tabErrorPages.set(tabId, {
    url,
    errorCode,
    errorDescription,
  })

  sendTabUpdated(tabId, {
    loading: false,
    url,
    title: errorDescription || 'Page unavailable',
    canGoBack: view.webContents.canGoBack(),
    canGoForward: view.webContents.canGoForward(),
  })

  if (navigationOwnerTabId === tabId) {
    navigationOwnerTabId = null
  }

  const html = makeNavigationErrorHtml({ url, errorCode, errorDescription })
  view.webContents.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`).catch(() => {})
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

function getIpcBrowserProfileId(ipcEvent) {
  const senderId = ipcEvent.sender?.id
  if (senderId && webContentsProfileIds.has(senderId)) {
    return webContentsProfileIds.get(senderId)
  }

  for (const [tabId, view] of tabViews.entries()) {
    if (view?.webContents?.id === senderId) {
      const profileId = getBrowserProfileForTab(tabId).id
      webContentsProfileIds.set(senderId, profileId)
      return profileId
    }
  }

  return getActiveBrowserProfile().id
}

async function disposeTab(tabId) {
  tabUrls.delete(tabId)
  tabErrorPages.delete(tabId)
  lastTabUpdates.delete(tabId)

  const meta = tabMeta.get(tabId) || {}
  tabMeta.delete(tabId)

  const view = tabViews.get(tabId)
  if (view) {
    try { hideView(mainWindow, view) } catch (_) {}

    if (meta.private) {
      try { await profileContext.clearSessionStorage(view.webContents.session) } catch (_) {}
    }

    try { webContentsProfileIds.delete(view.webContents.id) } catch (_) {}
    try { view.webContents.destroy() } catch (_) {}
    tabViews.delete(tabId)
  }

  if (activeTabId === tabId) {
    activeView = null
    activeTabId = null
  }
}

async function disposeAllTabs() {
  for (const tabId of [...new Set([...tabMeta.keys(), ...tabViews.keys(), ...tabUrls.keys()])]) {
    await disposeTab(tabId)
  }

  activeView = null
  activeTabId = null
  navigationOwnerTabId = null
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
  const browserProfileId = getIpcBrowserProfileId(ipcEvent)
  const key = `${browserProfileId}:${origin}:${action}`

  const sessionDecision = nostrSessionPermissions.get(key)

  if (sessionDecision === 'allow') {
    return true
  }

  if (sessionDecision === 'deny') {
    return false
  }

  const stored = DB.getNostrPermission(origin, action, browserProfileId)

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
    DB.setNostrPermission(origin, action, 'allow', browserProfileId)
    return true
  }

  if (result.response === 2) {
    DB.setNostrPermission(origin, action, 'deny', browserProfileId)
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

function getTorProxyConfig(browserProfileId = null) {
  const priv = DB.getPrivacy(browserProfileId)
  const enabled = Number(priv?.tor_enabled) === 1
  const host = String(priv?.tor_host || '127.0.0.1').trim()
  const port = Number(priv?.tor_port || 9050)

  if (!enabled) return { enabled: false }

  if (!host || !Number.isSafeInteger(port) || port < 1 || port > 65535) {
    return { enabled: false, error: 'Invalid Tor/SOCKS proxy settings' }
  }

  return {
    enabled: true,
    host,
    port,
    config: {
      proxyRules: `socks5://${host}:${port}`,
      proxyBypassRules: [
        '<-loopback>',
        'localhost',
        '127.0.0.1',
        '::1',
        'localhost:3000',
        '127.0.0.1:3000',
      ].join(';'),
    },
  }
}

async function applyProxyToSession(ses) {
  const tor = getTorProxyConfig(getBrowserProfileIdForSession(ses))

  if (tor.error) return { ok: false, error: tor.error }

  if (!tor.enabled) {
    await ses.setProxy({ proxyRules: '' })
    await ses.forceReloadProxyConfig()
    return { ok: true, enabled: false }
  }

  await ses.setProxy(tor.config)
  await ses.forceReloadProxyConfig()

  return { ok: true, enabled: true, host: tor.host, port: tor.port }
}

async function applyNetworkProxy() {
  configuredSessions.add(session.defaultSession)

  let result = await applyProxyToSession(session.defaultSession)

  for (const ses of configuredSessions) {
    try {
      result = await applyProxyToSession(ses)
    } catch (_) {}
  }

  for (const view of tabViews.values()) {
    try {
      if (!view?.webContents?.isDestroyed()) {
        await applyProxyToSession(view.webContents.session)
      }
    } catch (_) {}
  }

  return result
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


function injectAntiFingerprint(view) {
  if (!view || view.webContents.isDestroyed()) return

  const fp = fingerprintProfile

  const code = `
    (() => {
      const fp = ${JSON.stringify(fp)}

      const spoof = (obj, prop, value) => {
        try {
          Object.defineProperty(obj, prop, {
            get: () => value,
            configurable: true
          })
        } catch (_) {}
      }

      spoof(Navigator.prototype, 'platform', fp.platform)
      spoof(navigator, 'platform', fp.platform)

      spoof(Navigator.prototype, 'hardwareConcurrency', fp.hardwareConcurrency)
      spoof(navigator, 'hardwareConcurrency', fp.hardwareConcurrency)

      spoof(Navigator.prototype, 'deviceMemory', fp.deviceMemory)
      spoof(navigator, 'deviceMemory', fp.deviceMemory)

      spoof(Navigator.prototype, 'language', fp.language)
      spoof(navigator, 'language', fp.language)

      spoof(Navigator.prototype, 'languages', fp.languages)
      spoof(navigator, 'languages', fp.languages)

      spoof(Navigator.prototype, 'webdriver', false)
      spoof(navigator, 'webdriver', false)

      try {
        Date.prototype.getTimezoneOffset = function () {
          return fp.timezoneOffset
        }
      } catch (_) {}

      try {
        const ro = Intl.DateTimeFormat.prototype.resolvedOptions
        Intl.DateTimeFormat.prototype.resolvedOptions = function () {
          const r = ro.apply(this, arguments)
          r.timeZone = fp.timezone
          return r
        }
      } catch (_) {}

      try {
        if (navigator.mediaDevices) {
          navigator.mediaDevices.enumerateDevices = async () => []
        }
      } catch (_) {}

      try {
        const ge = WebGLRenderingContext.prototype.getExtension
        WebGLRenderingContext.prototype.getExtension = function(name) {
          if (String(name).toLowerCase() === 'webgl_debug_renderer_info') return null
          return ge.apply(this, arguments)
        }

        const gp = WebGLRenderingContext.prototype.getParameter
        WebGLRenderingContext.prototype.getParameter = function(param) {
          if (param === 37445) return fp.webglVendor
          if (param === 37446) return fp.webglRenderer
          return gp.apply(this, arguments)
        }
      } catch (_) {}

      try {
        const ge2 = WebGL2RenderingContext.prototype.getExtension
        WebGL2RenderingContext.prototype.getExtension = function(name) {
          if (String(name).toLowerCase() === 'webgl_debug_renderer_info') return null
          return ge2.apply(this, arguments)
        }

        const gp2 = WebGL2RenderingContext.prototype.getParameter
        WebGL2RenderingContext.prototype.getParameter = function(param) {
          if (param === 37445) return fp.webglVendor
          if (param === 37446) return fp.webglRenderer
          return gp2.apply(this, arguments)
        }
      } catch (_) {}

      window.__zapAntiFingerprint = true
      window.__zapFingerprintProfile = fp.name
    })()
  `

  view.webContents.executeJavaScript(code, true).catch(() => {})
}


function createMainView(tabId = null, isPrivate = false, profile = null) {
  const viewTabId = tabId
  const viewProfile = profile || getBrowserProfileForTab(tabId)
  const viewSession = getTabSession(tabId, isPrivate, viewProfile)

  const view = new BrowserView({
    webPreferences: {
      preload: path.join(__dirname, '../preload/webview.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
      session: viewSession,
    }
  })

  webContentsProfileIds.set(view.webContents.id, viewProfile.id)

  view.webContents.on('dom-ready', () => injectAntiFingerprint(view))
  view.webContents.on('did-finish-load', () => injectAntiFingerprint(view))
  view.webContents.on('did-frame-finish-load', () => injectAntiFingerprint(view))

  view.webContents.on('console-message', (_event, level, message) => {
    if (!ZAP_DEBUG) return
    if (String(message).includes('[ZapAds]') || String(message).includes('[ZapCosmetic]')) {
      console.log(`[webview] ${message}`)
    }
  })

  view.webContents.on('page-title-updated', (_, title) => {
    const ownerTabId = viewTabId || navigationOwnerTabId || activeTabId
    if (!ownerTabId) return
    sendTabUpdated(ownerTabId, {
      title,
      url: view.webContents.getURL(),
    })
  })

  view.webContents.on('did-navigate', async (_, url) => {
    const ownerTabId = viewTabId || navigationOwnerTabId || activeTabId
    if (!ownerTabId) return
    tabErrorPages.delete(ownerTabId)
    tabUrls.set(ownerTabId, url)
    sendTabUpdated(ownerTabId, {
      url,
      title: view.webContents.getTitle(),
      loading: false,
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
    const ownerTabId = viewTabId || navigationOwnerTabId || activeTabId
    if (ownerTabId && !isSwitching) {
      sendTabUpdated(ownerTabId, { loading: true })
    }
  })

  view.webContents.on('did-stop-loading', () => {
    const ownerTabId = viewTabId || navigationOwnerTabId || activeTabId
    if (!ownerTabId) return

    const currentUrl = view.webContents.getURL()
    const errorPage = tabErrorPages.get(ownerTabId)
    const url   = errorPage && isNavigationErrorPageUrl(currentUrl) ? errorPage.url : currentUrl
    const title = view.webContents.getTitle()

    sendTabUpdated(ownerTabId, { loading: false, url, title })

    const meta = tabMeta.get(ownerTabId) || {}
    if (!meta.private && url && !url.startsWith('chrome://') && !url.startsWith('devtools://')) {
      DB.addHistory(url, title)
    }

    if (navigationOwnerTabId === ownerTabId) {
      navigationOwnerTabId = null
    }
  })

  view.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    if (!isMainFrame || errorCode === -3) return

    const ownerTabId = viewTabId || navigationOwnerTabId || activeTabId
    if (!ownerTabId) return

    const failedUrl = validatedURL || view.webContents.getURL() || ''

    try {
      sendTabUpdated(ownerTabId, {
        loading: false,
        url: failedUrl,
        title: errorDescription ? `Navigation error: ${errorDescription}` : 'Navigation error',
      })
    } catch (_) {}

    if (navigationOwnerTabId === ownerTabId) {
      navigationOwnerTabId = null
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

    const priv = DB.getPrivacy(viewProfile.id)
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
    const priv = DB.getPrivacy(viewProfile.id)
    if (!priv.adblock) return

    view.webContents.executeJavaScript(cosmetic.getCosmeticScript()).catch(() => {})

    if (overlayProtection.shouldEnableOverlayProtection(priv)) {
      view.webContents.executeJavaScript(overlayProtection.getOverlayProtectionScript()).catch(() => {})
    }
  }

  view.webContents.on('dom-ready', injectOverlayProtection)

  // Inject cosmetic ad-hiding CSS after each page load
  view.webContents.on('did-finish-load', () => {
    if (!DB.getPrivacy(viewProfile.id).adblock) return
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
  if (privacySessions.has(ses)) return
  privacySessions.add(ses)

  ses.webRequest.onBeforeRequest({ urls: ['*://*/*'] }, (details, cb) => {
    const priv = getPrivacyForSession(ses)
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

    const compatibilityPatterns = [
      'quantcast',
      'qc-cmp',
      'didomi',
      'onetrust',
      'cookiebot',
      'iubenda',
      'privacy-mgmt',
      'privacycenter',
      'cmp.',
      '/cmp/',
      'consent',
      'consensu',
      'fundingchoices',
      'sourcepoint',
      'sp-prod',
      'trustarc',
      'cookielaw',
      'cookie-law',
      'cookieconsent',
      'tinypass',
      'piano.io'
    ]

    const requestUrl = details.url.toLowerCase()
    if (compatibilityPatterns.some(pattern => requestUrl.includes(pattern))) {
      return cb({})
    }

    const earlyBlockPatterns = [
      'adsystem',
      'doubleclick',
      'googlesyndication',
      'adservice.google',
      'amazon-adsystem',
      'criteo',
      'rubiconproject',
      'pubmatic',
      'openx',
      'taboola',
      'outbrain'
    ]

    if (earlyBlockPatterns.some(p => requestUrl.includes(p))) {
      bl.incrementBlocked()
      mainWindow?.webContents.send('blocked-count', bl.getBlockedCount())
      return cb({ cancel: true })
    }

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
    const priv = getPrivacyForSession(ses)
    if (priv.ua_mode !== 'default') headers['User-Agent'] = currentUA
    delete headers['X-Forwarded-For']
    delete headers['Via']
    delete headers['From']
    cb({ requestHeaders: headers })
  })

  ses.setPermissionRequestHandler((wc, permission, cb) => {
    const priv = getPrivacyForSession(ses)
    // Block media if WebRTC protection is on; always block notifications
    if (priv.webrtc_protect && permission === 'media') return cb(false)
    if (permission === 'notifications') return cb(false)
    cb(true)
  })
}

function setupDownloads(ses) {
  if (downloadSessions.has(ses)) return
  downloadSessions.add(ses)

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

  activeView = null

  configureBrowserSession(session.defaultSession, DB.getBrowserProfileById('default'))
  applyNetworkProxy().catch(err => console.error('[Proxy] apply failed', err))

  bl.init((size) => {
    mainWindow?.webContents.send('blocklist-ready', { size })
  })

  mainWindow.on('resize', () => {
    if (activeTabId && tabUrls.get(activeTabId)) {
      resizeView(mainWindow, activeView, shellLayout)
    }
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


// ── IPC: portable mode ────────────────────────────────────────────────────────
ipcMain.handle('portable-status', () => ({
  portable: portable.isPortableMode(),
  configured: portable.hasPortableConfig(),
}))

ipcMain.handle('portable-setup-passphrase', (_, { passphrase }) => {
  return portable.setupPassphrase(passphrase)
})

ipcMain.handle('portable-unlock', (_, { passphrase }) => {
  return portable.unlock(passphrase)
})

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

// ── IPC: browser profiles ────────────────────────────────────────────────────
ipcMain.handle('browser-profile-active', () => DB.getActiveBrowserProfile())
ipcMain.handle('browser-profile-list', () => DB.listBrowserProfiles())
ipcMain.handle('browser-profile-create', (_, { name }) => {
  V.assert(typeof name === 'string' && name.trim().length > 0 && name.length <= 120, 'Invalid profile name')
  return DB.createBrowserProfile({ name: name.trim() })
})
ipcMain.handle('browser-profile-rename', (_, { id, name }) => {
  V.assert(typeof id === 'string' && id.length > 0 && id.length <= 120, 'Invalid profile id')
  V.assert(typeof name === 'string' && name.trim().length > 0 && name.length <= 120, 'Invalid profile name')
  return DB.renameBrowserProfile(id, name.trim())
})
ipcMain.handle('browser-profile-set-active', async (_, { id }) => {
  V.assert(typeof id === 'string' && id.length > 0 && id.length <= 120, 'Invalid profile id')
  const current = getActiveBrowserProfile()

  if (current.id === id) {
    return { ok: true, changed: false, profile: current }
  }

  await disposeAllTabs()
  const profile = DB.setActiveBrowserProfile(id)
  const priv = DB.getPrivacy(profile.id)
  doh.setEnabled(Number(priv.doh_enabled) === 1)
  setUserAgentForConfiguredSessions()
  await applyNetworkProxy()
  mainWindow?.webContents.send('privacy-updated', getPrivacyState())

  return { ok: true, changed: true, profile }
})
ipcMain.handle('browser-profile-delete', async (_, { id }) => {
  V.assert(typeof id === 'string' && id.length > 0 && id.length <= 120, 'Invalid profile id')
  const profile = DB.getBrowserProfileById(id)
  V.assert(profile, 'Browser profile not found')
  V.assert(Number(profile.is_default) !== 1, 'The default profile cannot be deleted')

  if (getActiveBrowserProfile().id === profile.id) {
    await disposeAllTabs()
  }

  const profileSession = getProfileSession(profile)
  try { await profileContext.clearSessionStorage(profileSession) } catch (_) {}
  forgetBrowserProfileSessions(profile.id)

  const result = DB.deleteBrowserProfile(profile.id)
  if (result.was_active) {
    const priv = DB.getPrivacy(result.active_profile.id)
    doh.setEnabled(Number(priv.doh_enabled) === 1)
    setUserAgentForConfiguredSessions()
    await applyNetworkProxy()
    mainWindow?.webContents.send('privacy-updated', getPrivacyState())
  }
  return result
})

// ── IPC: tabs ─────────────────────────────────────────────────────────────────
ipcMain.handle('tab-create', (_, { tabId, private: isPrivate = false }) => {
  const profile = getActiveBrowserProfile()

  tabUrls.set(tabId, '')
  tabMeta.set(tabId, { private: !!isPrivate, profileId: profile.id })
  activeTabId = tabId

  if (!tabViews.has(tabId)) {
    tabViews.set(tabId, createMainView(tabId, !!isPrivate, profile))
  }

  if (activeView) hideView(mainWindow, activeView)
  activeView = tabViews.get(tabId)

  // Empty tabs are rendered by the React shell, not BrowserView.
  hideView(mainWindow, activeView)

  return { ok: true, profileId: profile.id }
})

ipcMain.handle('tab-switch', (_, { tabId }) => {
  activeTabId = tabId
  const url = tabUrls.get(tabId) || ''

  if (!url || url === 'zap://newtab') {
    if (activeView) hideView(mainWindow, activeView)
    activeView = tabViews.get(tabId) || null
    return { ok: true }
  }

  let view = tabViews.get(tabId)
  if (!view) {
    const meta = tabMeta.get(tabId) || {}
    view = createMainView(tabId, !!meta.private, getBrowserProfileForTab(tabId))
    tabViews.set(tabId, view)
  }

  if (activeView && activeView !== view) hideView(mainWindow, activeView)
  activeView = view
  showView(mainWindow, activeView, shellLayout)

  const current = activeView.webContents.getURL()
  if (!current || current === 'about:blank') {
    isSwitching = true
    navigationOwnerTabId = tabId
    view.webContents.loadURL(url)
      .catch((err) => {
        showNavigationErrorPage(view, tabId, url, err?.errno || 'LOAD_FAILED', err?.message || 'Navigation failed')
      })
      .finally(() => { isSwitching = false })
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

  let view = tabViews.get(tabId)
  if (!view) {
    const meta = tabMeta.get(tabId) || {}
    view = createMainView(tabId, !!meta.private, getBrowserProfileForTab(tabId))
    tabViews.set(tabId, view)
  }

  activeTabId = tabId
  navigationOwnerTabId = tabId
  tabErrorPages.delete(tabId)
  tabUrls.set(tabId, u)

  if (activeView && activeView !== view) hideView(mainWindow, activeView)
  activeView = view
  showView(mainWindow, activeView, shellLayout)

  await new Promise(r => setTimeout(r, 50))
  view.webContents.loadURL(u).catch((err) => {
    showNavigationErrorPage(view, tabId, u, err?.errno || 'LOAD_FAILED', err?.message || 'Navigation failed')
  })

  return { ok: true, url: u }
})

ipcMain.handle('tab-close', async (_, { tabId }) => {
  await disposeTab(tabId)
  return { ok: true }
})

ipcMain.handle('tab-home', (_, { tabId }) => {
  activeTabId = tabId
  tabUrls.set(tabId, '')
  tabErrorPages.delete(tabId)

  const view = tabViews.get(tabId)
  if (view) hideView(mainWindow, view)

  if (activeView === view) activeView = null

  return { ok: true }
})

ipcMain.handle('tab-go-back',  () => activeView?.webContents.goBack())
ipcMain.handle('tab-go-forward', () => activeView?.webContents.goForward())
ipcMain.handle('tab-reload',   () => activeView?.webContents.reload())

ipcMain.handle('tab-find', (_, { tabId, text, forward = true, findNext = false } = {}) => {
  if (!tabId || tabId !== activeTabId) return { ok: false, error: 'Inactive tab' }
  if (typeof text !== 'string' || text.length === 0 || text.length > 500) {
    return { ok: false, error: 'Invalid search text' }
  }

  const view = tabViews.get(tabId)
  if (!view || view.webContents.isDestroyed()) return { ok: false, error: 'Tab not available' }

  view.webContents.findInPage(text, {
    forward: !!forward,
    findNext: !!findNext,
  })

  return { ok: true }
})

ipcMain.handle('tab-stop-find', (_, { tabId, action = 'clearSelection' } = {}) => {
  if (!tabId || tabId !== activeTabId) return { ok: false, error: 'Inactive tab' }

  const view = tabViews.get(tabId)
  if (!view || view.webContents.isDestroyed()) return { ok: false, error: 'Tab not available' }

  view.webContents.stopFindInPage(action)
  return { ok: true }
})

ipcMain.handle('shell-resize', (_, args) => {
  shellLayout = {
    panelWidth: Number.isFinite(Number(args?.panelWidth))
      ? Math.max(0, Number(args.panelWidth))
      : (args?.panelOpen ? 320 : 0),
  }
  if (!activeTabId || !tabUrls.get(activeTabId)) return
  resizeView(mainWindow, activeView, shellLayout)
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
        setUserAgentForConfiguredSessions()
        mainWindow?.webContents.send('ua-mode-updated', { mode: 'rotate', ua: currentUA })
        publishPrivacyUpdated()
      },
    },
    {
      label: 'Default browser',
      type: 'radio',
      checked: current === 'default',
      click: () => {
        DB.setPrivacy('ua_mode', 'default')
        setUserAgentForConfiguredSessions()
        mainWindow?.webContents.send('ua-mode-updated', { mode: 'default', ua: '' })
        publishPrivacyUpdated()
      },
    },
    { type: 'separator' },
    {
      label: 'Rotate now',
      click: () => {
        currentUA = UA_POOL[Math.floor(Math.random() * UA_POOL.length)]
        setUserAgentForConfiguredSessions()
        mainWindow?.webContents.send('ua-mode-updated', { mode: 'rotate', ua: currentUA })
        publishPrivacyUpdated()
      },
    },
  ])

  menu.popup({ window: mainWindow })
  return { ok: true }
})

// ── IPC: privacy ──────────────────────────────────────────────────────────────
function getPrivacyState() {
  const priv = DB.getPrivacy()
  return {
    ...priv,
    blockedCount:   bl.getBlockedCount(),
    blocklistSize:  bl.getListSize(),
    blocklistReady: bl.isReady(),
    dohEnabled:     Number(priv.doh_enabled) === 1,
  }
}

function publishPrivacyUpdated() {
  const state = getPrivacyState()
  mainWindow?.webContents.send('privacy-updated', state)
  return state
}

ipcMain.handle('get-privacy', () => getPrivacyState())
ipcMain.handle('set-adblock',  (_, { enabled }) => {
  DB.setPrivacy('adblock', enabled ? 1 : 0)
  return publishPrivacyUpdated()
})
ipcMain.handle('set-webrtc',   (_, { enabled }) => {
  DB.setPrivacy('webrtc_protect', enabled ? 1 : 0)
  return publishPrivacyUpdated()
})
ipcMain.handle('set-popup-block', (_, { enabled }) => {
  DB.setPrivacy('popup_block', enabled ? 1 : 0)
  return publishPrivacyUpdated()
})
ipcMain.handle('set-overlay-block', (_, { enabled }) => {
  DB.setPrivacy('overlay_block', enabled ? 1 : 0)
  return publishPrivacyUpdated()
})
ipcMain.handle('set-ua-mode',  (_, { mode }) => {
  DB.setPrivacy('ua_mode', mode)
  if (mode === 'rotate') currentUA = UA_POOL[Math.floor(Math.random() * UA_POOL.length)]
  setUserAgentForConfiguredSessions()
  publishPrivacyUpdated()
  return currentUA
})
ipcMain.handle('rotate-ua', () => {
  currentUA = UA_POOL[Math.floor(Math.random() * UA_POOL.length)]
  setUserAgentForConfiguredSessions()
  publishPrivacyUpdated()
  return currentUA
})
ipcMain.handle('get-blocked-count',  () => bl.getBlockedCount())
ipcMain.handle('get-ua-pool',        () => UA_POOL)
ipcMain.handle('set-doh', (_, { enabled, provider }) => {
  doh.setEnabled(enabled)
  if (provider) doh.setProvider(provider)
  DB.setPrivacy('doh_enabled', enabled ? 1 : 0)
  if (provider) DB.setPrivacy('doh_provider', provider)
  return publishPrivacyUpdated()
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

  const result = await applyNetworkProxy()
  publishPrivacyUpdated()
  return result
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
  return nostr.createProfile(DB, args, getActiveBrowserProfile().id)
})
ipcMain.handle('nostr-import-nsec',    (_, args) => {
  V.validateNsec(args?.nsec)

  if (args?.name) {
    V.assert(typeof args.name === 'string' && args.name.length <= 120, 'Invalid name')
  }

  return nostr.importNsec(DB, args, getActiveBrowserProfile().id)
})
ipcMain.handle('nostr-skip',           () => DB.setSetting('nostr_skipped', '1'))
ipcMain.handle('nostr-get-profile',    () => nostr.getProfile(DB, getActiveBrowserProfile().id))
ipcMain.handle('nostr-list-profiles',  () => nostr.listProfiles(DB, getActiveBrowserProfile().id))
ipcMain.handle('nostr-set-active-profile', (_, { id }) => {
  V.assert(Number.isSafeInteger(Number(id)), 'Invalid profile id')
  return nostr.setActiveProfile(DB, Number(id), getActiveBrowserProfile().id)
})
ipcMain.handle('nostr-remove-profile-by-id', (_, { id }) => {
  V.assert(Number.isSafeInteger(Number(id)), 'Invalid profile id')
  return nostr.removeProfileById(DB, Number(id), getActiveBrowserProfile().id)
})
ipcMain.handle('nostr-remove-profile', () => nostr.removeProfile(DB, getActiveBrowserProfile().id))
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
  return nostr.signEvent(DB, event, getActiveBrowserProfile().id)
})
ipcMain.handle('nostr-get-pubkey',     () => nostr.getPubkey(DB, getActiveBrowserProfile().id))
// NIP-07 aliases — same implementation, separate IPC channels for clarity
ipcMain.handle('nostr-get-pubkey-nip07', async (ipcEvent) => {
  const allowed = await confirmNostrPermission(ipcEvent, 'getPublicKey', null)

  if (!allowed) {
    throw new Error('Nostr public key request denied by user')
  }

  return nostr.getPubkey(DB, getIpcBrowserProfileId(ipcEvent))
})
ipcMain.handle('nostr-sign-event-nip07', async (ipcEvent, { event: e }) => {
  V.validateNostrEvent(e)

  const allowed = await confirmNostrPermission(ipcEvent, 'signEvent', e)

  if (!allowed) {
    throw new Error('Nostr signing request denied by user')
  }

  return nostr.signEvent(DB, e, getIpcBrowserProfileId(ipcEvent))
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
  const browserProfileId = getIpcBrowserProfileId(ipcEvent)
  const row = DB._db()
    .prepare('SELECT encrypted_nsec FROM nostr_profile WHERE browser_profile_id=? AND active=1 ORDER BY last_used_at DESC, id DESC LIMIT 1')
    .get(browserProfileId)

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
  const browserProfileId = getIpcBrowserProfileId(ipcEvent)
  const row = DB._db()
    .prepare('SELECT encrypted_nsec FROM nostr_profile WHERE browser_profile_id=? AND active=1 ORDER BY last_used_at DESC, id DESC LIMIT 1')
    .get(browserProfileId)

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

function decodeBookmarkText(value) {
  return String(value || '')
    .replace(/<[^>]+>/g, '')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&amp;/gi, '&')
    .trim()
}

function makeBookmarkSourceId(filePath) {
  return crypto.createHash('sha256').update(filePath).digest('hex').slice(0, 16)
}

function pathExists(filePath) {
  try {
    return !!filePath && fs.existsSync(filePath)
  } catch (_) {
    return false
  }
}

function readJsonFile(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function normalizeBookmarkUrl(url) {
  const value = String(url || '').trim()
  if (!/^https?:\/\//i.test(value)) return ''
  return value
}

function parseChromeBookmarkNode(node) {
  if (!node || typeof node !== 'object') return null

  if (node.type === 'url') {
    const url = normalizeBookmarkUrl(node.url)
    if (!url) return null
    return {
      type: 'bookmark',
      title: String(node.name || url).trim() || url,
      url,
    }
  }

  if (node.type === 'folder') {
    const children = Array.isArray(node.children)
      ? node.children.map(parseChromeBookmarkNode).filter(Boolean)
      : []

    if (!children.length && !String(node.name || '').trim()) return null

    return {
      type: 'folder',
      title: String(node.name || 'Folder').trim() || 'Folder',
      children,
    }
  }

  return null
}

function parseChromeBookmarksFile(filePath) {
  const data = readJsonFile(filePath)
  const roots = data?.roots || {}
  const nodes = []

  for (const key of ['bookmark_bar', 'other', 'synced']) {
    const parsed = parseChromeBookmarkNode(roots[key])
    if (parsed) nodes.push(parsed)
  }

  return nodes
}

function parseFirefoxBookmarksFile(filePath) {
  const Database = require('better-sqlite3')
  const tmpPath = path.join(os.tmpdir(), `zap-firefox-bookmarks-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}.sqlite`)

  try {
    fs.copyFileSync(filePath, tmpPath)
    const places = new Database(tmpPath, { readonly: true, fileMustExist: true })

    try {
      const rows = places.prepare(`
        SELECT
          b.id,
          b.parent,
          b.type,
          COALESCE(NULLIF(b.title, ''), p.title, p.url, 'Folder') AS title,
          b.position,
          p.url
        FROM moz_bookmarks b
        LEFT JOIN moz_places p ON p.id=b.fk
        WHERE b.type IN (1, 2)
        ORDER BY b.parent ASC, b.position ASC, b.id ASC
      `).all()

      const byParent = new Map()
      const byId = new Map()

      for (const row of rows) {
        byId.set(row.id, row)
        const key = row.parent == null ? 'root' : String(row.parent)
        if (!byParent.has(key)) byParent.set(key, [])
        byParent.get(key).push(row)
      }

      const toNode = (row) => {
        if (Number(row.type) === 1) {
          const url = normalizeBookmarkUrl(row.url)
          if (!url) return null
          return {
            type: 'bookmark',
            title: String(row.title || url).trim() || url,
            url,
          }
        }

        const children = (byParent.get(String(row.id)) || [])
          .map(toNode)
          .filter(Boolean)

        if (!children.length) return null

        return {
          type: 'folder',
          title: String(row.title || 'Folder').trim() || 'Folder',
          children,
        }
      }

      const rootChildren = (byParent.get('1') || [])
        .filter(row => Number(row.type) === 2)
        .map(toNode)
        .filter(Boolean)

      if (rootChildren.length) return rootChildren

      return rows
        .filter(row => Number(row.type) === 2 && !byId.has(row.parent))
        .map(toNode)
        .filter(Boolean)
    } finally {
      places.close()
    }
  } finally {
    try { fs.unlinkSync(tmpPath) } catch (_) {}
  }
}

function parseBookmarksHtml(html) {
  const root = []
  const stack = [{ children: root }]
  const tokenRe = /<DT>\s*<H3[^>]*>(.*?)<\/H3>|<\/DL\s*>|<DT>\s*<A[^>]+HREF=(["'])(.*?)\2[^>]*>(.*?)<\/A>/gis

  let match
  while ((match = tokenRe.exec(html)) !== null) {
    const folderTitle = decodeBookmarkText(match[1])
    const url = normalizeBookmarkUrl(match[3])
    const title = decodeBookmarkText(match[4])

    if (folderTitle) {
      const folder = {
        type: 'folder',
        title: folderTitle,
        children: [],
      }
      stack[stack.length - 1].children.push(folder)
      stack.push(folder)
      continue
    }

    if (match[0].toUpperCase().startsWith('</DL')) {
      if (stack.length > 1) stack.pop()
      continue
    }

    if (url) {
      stack[stack.length - 1].children.push({
        type: 'bookmark',
        title: title || url,
        url,
      })
    }
  }

  return root
}

function importBookmarkNodes(nodes, options = {}) {
  const favorites = DB.getFavorites()
  const existingUrls = new Set(
    favorites
      .filter(item => Number(item.is_folder) !== 1 && item.url)
      .map(item => String(item.url).trim().toLowerCase())
  )
  const folderByParentAndTitle = new Map()

  for (const item of favorites) {
    if (Number(item.is_folder) !== 1) continue
    const key = `${item.parent_id ?? 'root'}:${String(item.title || '').trim().toLowerCase()}`
    if (!folderByParentAndTitle.has(key)) folderByParentAndTitle.set(key, item.id)
  }

  let importedBookmarks = 0
  let importedFolders = 0
  let skippedDuplicates = 0
  let sortOrder = Date.now()

  const ensureFolder = (title, parentId) => {
    const safeTitle = String(title || 'Folder').trim() || 'Folder'
    const key = `${parentId ?? 'root'}:${safeTitle.toLowerCase()}`
    const existing = folderByParentAndTitle.get(key)
    if (existing) return existing

    const folder = DB.addFavorite({
      title: safeTitle,
      url: '',
      favicon: null,
      parent_id: parentId,
      is_folder: 1,
      sort_order: sortOrder++,
    })

    folderByParentAndTitle.set(key, folder.id)
    importedFolders++
    return folder.id
  }

  const rootParent = options.rootTitle
    ? ensureFolder(options.rootTitle, null)
    : null

  const walk = (items, parentId) => {
    for (const item of items || []) {
      if (!item) continue

      if (item.type === 'folder') {
        const folderId = ensureFolder(item.title, parentId)
        walk(item.children || [], folderId)
        continue
      }

      if (item.type !== 'bookmark') continue

      const url = normalizeBookmarkUrl(item.url)
      if (!url) continue

      const key = url.toLowerCase()
      if (existingUrls.has(key)) {
        skippedDuplicates++
        continue
      }

      DB.addFavorite({
        title: String(item.title || url).trim() || url,
        url,
        favicon: null,
        parent_id: parentId,
        is_folder: 0,
        sort_order: sortOrder++,
      })

      existingUrls.add(key)
      importedBookmarks++
    }
  }

  walk(nodes, rootParent)

  return {
    ok: true,
    importedBookmarks,
    importedFolders,
    skippedDuplicates,
  }
}

function chromiumProfileDirs(userDataDir) {
  if (!pathExists(userDataDir)) return []

  let entries = []
  try {
    entries = fs.readdirSync(userDataDir, { withFileTypes: true })
  } catch (_) {
    return []
  }

  return entries
    .filter(entry => entry.isDirectory() && (entry.name === 'Default' || /^Profile \d+$/i.test(entry.name)))
    .map(entry => ({
      profileName: entry.name,
      filePath: path.join(userDataDir, entry.name, 'Bookmarks'),
    }))
    .filter(item => pathExists(item.filePath))
}

function readFirefoxProfiles(baseDir) {
  const iniPath = path.join(baseDir, 'profiles.ini')
  if (!pathExists(iniPath)) return []

  let ini = ''
  try {
    ini = fs.readFileSync(iniPath, 'utf8')
  } catch (_) {
    return []
  }

  const sections = ini.split(/\n\s*\n/g)
  const profiles = []

  for (const section of sections) {
    if (!/^\s*\[Profile\d+\]/m.test(section)) continue

    const get = (key) => section.match(new RegExp(`^${key}=(.*)$`, 'mi'))?.[1]?.trim()
    const profilePath = get('Path')
    if (!profilePath) continue

    const isRelative = get('IsRelative') !== '0'
    const name = get('Name') || path.basename(profilePath)
    const dir = isRelative ? path.join(baseDir, profilePath) : profilePath
    const filePath = path.join(dir, 'places.sqlite')

    if (pathExists(filePath)) {
      profiles.push({ profileName: name, filePath })
    }
  }

  return profiles
}

function detectBookmarkSources() {
  const home = os.homedir()
  const platform = process.platform
  const sources = []
  const addSource = (source) => {
    sources.push({
      id: makeBookmarkSourceId(source.filePath),
      ...source,
    })
  }

  const chromiumBases = []

  if (platform === 'linux') {
    const config = process.env.XDG_CONFIG_HOME || path.join(home, '.config')
    chromiumBases.push(
      { browser: 'Chrome', base: path.join(config, 'google-chrome') },
      { browser: 'Chromium', base: path.join(config, 'chromium') },
      { browser: 'Brave', base: path.join(config, 'BraveSoftware', 'Brave-Browser') },
      { browser: 'Edge', base: path.join(config, 'microsoft-edge') },
      { browser: 'Vivaldi', base: path.join(config, 'vivaldi') }
    )
  }

  if (platform === 'win32') {
    const local = process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local')
    chromiumBases.push(
      { browser: 'Chrome', base: path.join(local, 'Google', 'Chrome', 'User Data') },
      { browser: 'Chromium', base: path.join(local, 'Chromium', 'User Data') },
      { browser: 'Brave', base: path.join(local, 'BraveSoftware', 'Brave-Browser', 'User Data') },
      { browser: 'Edge', base: path.join(local, 'Microsoft', 'Edge', 'User Data') },
      { browser: 'Vivaldi', base: path.join(local, 'Vivaldi', 'User Data') }
    )
  }

  for (const item of chromiumBases) {
    for (const profile of chromiumProfileDirs(item.base)) {
      addSource({
        type: 'chromium',
        browser: item.browser,
        profile: profile.profileName,
        label: `${item.browser} (${profile.profileName})`,
        filePath: profile.filePath,
      })
    }
  }

  const firefoxBases = []
  if (platform === 'linux') firefoxBases.push(path.join(home, '.mozilla', 'firefox'))
  if (platform === 'win32') {
    const roaming = process.env.APPDATA || path.join(home, 'AppData', 'Roaming')
    firefoxBases.push(path.join(roaming, 'Mozilla', 'Firefox'))
  }

  for (const base of firefoxBases) {
    for (const profile of readFirefoxProfiles(base)) {
      addSource({
        type: 'firefox',
        browser: 'Firefox',
        profile: profile.profileName,
        label: `Firefox (${profile.profileName})`,
        filePath: profile.filePath,
      })
    }
  }

  return sources
}

function loadBookmarkSource(source) {
  if (source.type === 'chromium') return parseChromeBookmarksFile(source.filePath)
  if (source.type === 'firefox') return parseFirefoxBookmarksFile(source.filePath)
  throw new Error('Unsupported source')
}

// ── IPC: favorites ────────────────────────────────────────────────────────────
ipcMain.handle('get-favorites',   () => DB.getFavorites())
ipcMain.handle('add-favorite',    (_, args) => {
  V.assert(args && typeof args === 'object', 'Invalid favorite payload')
  V.assert(typeof args.url === 'string' && args.url.length <= 3000, 'Invalid URL')
  if (args.title != null) V.assert(typeof args.title === 'string' && args.title.length <= 300, 'Invalid title')
  if (args.favicon != null) V.assert(typeof args.favicon === 'string' && args.favicon.length <= 5000, 'Invalid favicon')
  return DB.addFavorite(args)
})
ipcMain.handle('add-favorite-at', (_, args) => {
  V.assert(args && typeof args === 'object', 'Invalid favorite payload')
  V.assert(typeof args.url === 'string' && args.url.length > 0 && args.url.length <= 3000, 'Invalid URL')
  V.assert(typeof args.title === 'string' && args.title.length <= 300, 'Invalid title')
  if (args.favicon != null) V.assert(typeof args.favicon === 'string' && args.favicon.length <= 5000, 'Invalid favicon')
  if (args.parent_id !== null && args.parent_id !== undefined) {
    V.assert(Number.isSafeInteger(Number(args.parent_id)), 'Invalid parent folder id')
  }
  if (args.index !== null && args.index !== undefined) {
    V.assert(Number.isSafeInteger(Number(args.index)) && Number(args.index) >= 0, 'Invalid favorite position')
  }

  return DB.addFavoriteAt({
    title: args.title.trim() || args.url,
    url: args.url,
    favicon: args.favicon || null,
    parent_id: args.parent_id === 'root' ? null : args.parent_id,
  }, args.index === null || args.index === undefined ? null : Number(args.index))
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

ipcMain.handle('move-favorite', (_, { id, parent_id, index }) => {
  V.assert(Number.isSafeInteger(Number(id)), 'Invalid favorite id')

  if (parent_id !== null && parent_id !== undefined) {
    V.assert(Number.isSafeInteger(Number(parent_id)), 'Invalid parent folder id')
  }
  if (index !== null && index !== undefined) {
    V.assert(Number.isSafeInteger(Number(index)) && Number(index) >= 0, 'Invalid favorite position')
  }

  return DB.moveFavorite(
    Number(id),
    parent_id === 'root' ? null : parent_id,
    index === null || index === undefined ? null : Number(index),
  )
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

  return importBookmarkNodes(parseBookmarksHtml(html))
})

ipcMain.handle('detect-bookmark-import-sources', () => {
  return detectBookmarkSources().map(({ filePath, ...source }) => source)
})

ipcMain.handle('import-bookmarks-from-browser', (_, { sourceId }) => {
  V.assert(typeof sourceId === 'string' && /^[0-9a-f]{16}$/.test(sourceId), 'Invalid bookmark source')

  const source = detectBookmarkSources().find(item => item.id === sourceId)
  if (!source) return { ok: false, error: 'Bookmark source not available' }

  try {
    const nodes = loadBookmarkSource(source)
    return {
      ...importBookmarkNodes(nodes, {
        rootTitle: `${source.browser} ${source.profile || 'Bookmarks'}`.trim(),
      }),
      source: {
        id: source.id,
        label: source.label,
        browser: source.browser,
        profile: source.profile,
      },
    }
  } catch (err) {
    return {
      ok: false,
      error: err?.message || 'Bookmark import failed',
      source: {
        id: source.id,
        label: source.label,
        browser: source.browser,
        profile: source.profile,
      },
    }
  }
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
  const activeProfile = getActiveBrowserProfile()
  const activeSession = configureBrowserSession(getProfileSession(activeProfile), activeProfile)
  await activeSession.clearStorageData({ storages: profileContext.PROFILE_STORAGE_TYPES })
  await activeSession.flushStorageData()

  return { ok: true }
})
ipcMain.handle('clear-cache', async () => {
  const activeProfile = getActiveBrowserProfile()
  const activeSession = configureBrowserSession(getProfileSession(activeProfile), activeProfile)
  await activeSession.clearCache()

  return { ok: true }
})
ipcMain.handle('reset-browser', () => {
  const dbPath = path.join(app.getPath('userData'), 'zap.db')
  try { require('fs').unlinkSync(dbPath) } catch (_) {}
  return { ok: true }
})

portable.applyPortableUserDataPath()

app.whenReady().then(createWindow)
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
