// src/main/index.js
'use strict'

const { app, BrowserWindow, BrowserView, ipcMain, session, dialog } = require('electron')
const path  = require('path')
const fs    = require('fs')
const DB    = require('./db')
const wallet = require('./wallet')
const nostr  = require('./nostr')
const nwc    = require('./nwc')
const privacy = require('./privacy')

const isDev = !app.isPackaged
let mainWindow = null
// Map<tabId, BrowserView>
const views = new Map()
let activeTabId = null

// ── Blocklist (caricata da file o usata inline) ────────────────────────────
const BLOCK_DOMAINS = new Set([
  'doubleclick.net','googlesyndication.com','googletagmanager.com',
  'googletagservices.com','google-analytics.com','facebook.net',
  'fbcdn.net','ads.twitter.com','adservice.google.com',
  'amazon-adsystem.com','scorecardresearch.com','outbrain.com',
  'taboola.com','criteo.com','adsrvr.org','rubiconproject.com',
  'pubmatic.com','openx.net','moatads.com','hotjar.com',
  'mouseflow.com','fullstory.com','mixpanel.com','amplitude.com',
])

// ── User-Agent pool ────────────────────────────────────────────────────────
const UA_POOL = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:126.0) Gecko/20100101 Firefox/126.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14.4; rv:126.0) Gecko/20100101 Firefox/126.0',
  'Mozilla/5.0 (X11; Linux x86_64; rv:126.0) Gecko/20100101 Firefox/126.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0',
]

let currentUA = UA_POOL[Math.floor(Math.random() * UA_POOL.length)]
let blockedCount = 0

// ── Privacy: intercept requests ───────────────────────────────────────────
function setupPrivacy(ses) {
  ses.webRequest.onBeforeRequest({ urls: ['*://*/*'] }, (details, cb) => {
    const privSettings = DB.getPrivacy()
    if (!privSettings.adblock) return cb({})

    try {
      const url = new URL(details.url)
      const host = url.hostname.replace(/^www\./, '')
      if (BLOCK_DOMAINS.has(host) || [...BLOCK_DOMAINS].some(d => host.endsWith('.' + d))) {
        blockedCount++
        mainWindow?.webContents.send('blocked-count', blockedCount)
        return cb({ cancel: true })
      }
    } catch (_) {}
    cb({})
  })

  // Rotate User-Agent
  ses.webRequest.onBeforeSendHeaders((details, cb) => {
    const privSettings = DB.getPrivacy()
    const headers = { ...details.requestHeaders }
    if (privSettings.ua_mode !== 'default') {
      headers['User-Agent'] = currentUA
    }
    // Strip tracking headers
    delete headers['X-Forwarded-For']
    delete headers['Via']
    cb({ requestHeaders: headers })
  })
}

// ── WebRTC block via JS injection ─────────────────────────────────────────
const WEBRTC_BLOCK_SCRIPT = `
(function() {
  const priv = window.__zapPrivacy;
  if (!priv || !priv.webrtc) return;
  const noop = function() { return { close: function(){} }; };
  window.RTCPeerConnection = noop;
  window.webkitRTCPeerConnection = noop;
  window.mozRTCPeerConnection = noop;
  Object.defineProperty(navigator, 'getUserMedia', { value: undefined });
  Object.defineProperty(navigator, 'webkitGetUserMedia', { value: undefined });
})();
`

// ── NIP-07 inject script ──────────────────────────────────────────────────
const NIP07_SCRIPT = `
(function() {
  if (window.nostr) return;
  window.nostr = {
    getPublicKey: () => window.__zap_ipc('nostr_get_pubkey'),
    signEvent: (event) => window.__zap_ipc('nostr_sign_event', event),
    getRelays: () => window.__zap_ipc('nostr_get_relays'),
    nip04: {
      encrypt: (pk, text) => window.__zap_ipc('nostr_nip04_encrypt', { pk, text }),
      decrypt: (pk, text) => window.__zap_ipc('nostr_nip04_decrypt', { pk, text }),
    }
  };
})();
`

// ── BrowserView management ────────────────────────────────────────────────
function createView(tabId, url) {
  const privSettings = DB.getPrivacy()
  const view = new BrowserView({
    webPreferences: {
      preload: path.join(__dirname, '../preload/webview.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
      // Block WebRTC at Chromium level
      enableWebSQL: false,
    }
  })

  view.webContents.on('did-finish-load', () => {
    // Inject privacy scripts
    const priv = DB.getPrivacy()
    view.webContents.executeJavaScript(`window.__zapPrivacy = ${JSON.stringify({ webrtc: priv.webrtc_protect })};`)
    view.webContents.executeJavaScript(WEBRTC_BLOCK_SCRIPT)
    view.webContents.executeJavaScript(NIP07_SCRIPT)
  })

  view.webContents.on('page-title-updated', (_, title) => {
    mainWindow?.webContents.send('tab-updated', { tabId, title, url: view.webContents.getURL() })
  })

  view.webContents.on('did-navigate', (_, navUrl) => {
    mainWindow?.webContents.send('tab-updated', {
      tabId, url: navUrl,
      canGoBack: view.webContents.canGoBack(),
      canGoForward: view.webContents.canGoForward(),
    })
    // Detect Lightning invoice or Cashu token in URL
    if (navUrl.startsWith('lightning:') || navUrl.match(/lnbc[0-9]/i)) {
      mainWindow?.webContents.send('payment-detected', { type: 'invoice', value: navUrl })
    }
  })

  view.webContents.on('did-start-loading', () => {
    mainWindow?.webContents.send('tab-updated', { tabId, loading: true })
  })
  view.webContents.on('did-stop-loading', () => {
    mainWindow?.webContents.send('tab-updated', { tabId, loading: false })
  })

  // Scan page for invoices/tokens
  view.webContents.on('did-finish-load', () => {
    view.webContents.executeJavaScript(`
      (function() {
        const text = document.body ? document.body.innerText : '';
        const invoiceMatch = text.match(/lnbc[a-z0-9]{20,}/i);
        const cashuMatch = text.match(/cashuA[A-Za-z0-9+/=]{20,}/);
        if (invoiceMatch) window.__zap_payment({ type: 'invoice', value: invoiceMatch[0] });
        if (cashuMatch) window.__zap_payment({ type: 'cashu', value: cashuMatch[0] });
      })();
    `).catch(() => {})
  })

  views.set(tabId, view)
  if (url && url !== 'zap://newtab') {
    view.webContents.loadURL(url)
  }
  return view
}

function showView(tabId, url) {
  if (!mainWindow) return
  // Rimuovi tutte le view
  for (const [id, view] of views) {
    mainWindow.removeBrowserView(view)
  }
  // Se newtab, non mostrare nessun BrowserView
  if (!url || url === '' || url === 'zap://newtab') {
    activeTabId = tabId
    return
  }
  const view = views.get(tabId)
  if (!view) return
  mainWindow.addBrowserView(view)
  activeTabId = tabId
  resizeActiveView()
}

function resizeActiveView() {
  if (!mainWindow || !activeTabId) return
  const view = views.get(activeTabId)
  if (!view) return
  const bounds = mainWindow.getBounds()
  // Shell UI height: tabbar(36) + toolbar(50) = 86px
  view.setBounds({ x: 0, y: 114, width: bounds.width, height: bounds.height - 114 })
  view.setAutoResize({ width: true, height: true })
}

// ── Create main window ────────────────────────────────────────────────────
function createWindow() {
  DB.init()

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    frame: false,        // custom titlebar
    titleBarStyle: 'hidden',
    backgroundColor: '#0f0f12',
    webPreferences: {
      preload: path.join(__dirname, '../preload/shell.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  setupPrivacy(session.defaultSession)

  mainWindow.on('resize', resizeActiveView)

  if (isDev) {
    mainWindow.loadURL('http://localhost:3000')
    // mainWindow.webContents.openDevTools({ mode: "detach" })
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'))
  }

  mainWindow.webContents.on('did-finish-load', () => {
    // Send initial state
    const initialized = DB.getSetting('initialized') === '1'
    mainWindow.webContents.send('app-ready', { initialized })
  })
}

// ── IPC handlers ──────────────────────────────────────────────────────────

// Window controls
ipcMain.on('win-minimize', () => mainWindow?.minimize())
ipcMain.on('win-maximize', () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize()
  else mainWindow?.maximize()
})
ipcMain.on('win-close', () => mainWindow?.close())

// Tab management
ipcMain.handle('tab-create', (_, { tabId, url }) => {
  createView(tabId, url)
  showView(tabId, url)
  return { ok: true }
})

ipcMain.handle('tab-switch', (_, { tabId, url }) => {
  showView(tabId, url)
  return { ok: true }
})

ipcMain.handle('tab-close', (_, { tabId }) => {
  const view = views.get(tabId)
  if (view) {
    mainWindow?.removeBrowserView(view)
    view.webContents.destroy()
    views.delete(tabId)
  }
  return { ok: true }
})

ipcMain.handle('tab-navigate', (_, { tabId, url }) => {
  const view = views.get(tabId)
  if (!view) return { ok: false }
  let u = url.trim()
  if (!u.startsWith('http://') && !u.startsWith('https://') && !u.startsWith('file://')) {
    if (u.includes('.') && !u.includes(' ')) u = 'https://' + u
    else u = 'https://duckduckgo.com/?q=' + encodeURIComponent(u)
  }
  view.webContents.loadURL(u)
  // Mostra il BrowserView quando navighiamo
  mainWindow.addBrowserView(view)
  activeTabId = tabId
  resizeActiveView()
  return { ok: true, url: u }
})

ipcMain.handle('tab-go-back', (_, { tabId }) => {
  views.get(tabId)?.webContents.goBack()
})
ipcMain.handle('tab-go-forward', (_, { tabId }) => {
  views.get(tabId)?.webContents.goForward()
})
ipcMain.handle('tab-reload', (_, { tabId }) => {
  views.get(tabId)?.webContents.reload()
})

// Navigation — show/hide webview when panel open
ipcMain.handle('shell-resize', (_, { panelOpen }) => {
  if (!mainWindow || !activeTabId) return
  const view = views.get(activeTabId)
  if (!view) return
  const bounds = mainWindow.getBounds()
  const panelW = panelOpen ? 320 : 0
  view.setBounds({ x: 0, y: 114, width: bounds.width - panelW, height: bounds.height - 114 })
})

// Privacy
ipcMain.handle('get-privacy',          () => DB.getPrivacy())
ipcMain.handle('set-adblock',          (_, { enabled }) => DB.setPrivacy('adblock', enabled ? 1 : 0))
ipcMain.handle('set-webrtc',           (_, { enabled }) => DB.setPrivacy('webrtc_protect', enabled ? 1 : 0))
ipcMain.handle('set-ua-mode',          (_, { mode }) => {
  DB.setPrivacy('ua_mode', mode)
  if (mode === 'rotate') currentUA = UA_POOL[Math.floor(Math.random() * UA_POOL.length)]
  return currentUA
})
ipcMain.handle('rotate-ua',            () => {
  currentUA = UA_POOL[Math.floor(Math.random() * UA_POOL.length)]
  return currentUA
})
ipcMain.handle('get-blocked-count',    () => blockedCount)
ipcMain.handle('get-ua-pool',          () => UA_POOL)

// Wallet / Seed
ipcMain.handle('is-initialized',       () => DB.getSetting('initialized') === '1')
ipcMain.handle('generate-mnemonic',    () => wallet.generateMnemonic())
ipcMain.handle('validate-mnemonic',    (_, { words }) => wallet.validateMnemonic(words))
ipcMain.handle('setup-wallet',         (_, args) => wallet.setupWallet(DB, args))

// Nostr
ipcMain.handle('nostr-create-profile', (_, args) => nostr.createProfile(DB, args))
ipcMain.handle('nostr-import-nsec',    (_, args) => nostr.importNsec(DB, args))
ipcMain.handle('nostr-skip',           () => DB.setSetting('nostr_skipped', '1'))
ipcMain.handle('nostr-get-profile',    () => nostr.getProfile(DB))
ipcMain.handle('nostr-get-relays',     () => nostr.getRelays())
ipcMain.handle('nostr-sign-event',     (_, { event }) => nostr.signEvent(DB, event))
ipcMain.handle('nostr-get-pubkey',     () => nostr.getPubkey(DB))

// NWC Lightning
ipcMain.handle('nwc-connect',          (_, args) => nwc.connect(DB, args))
ipcMain.handle('nwc-disconnect',       () => nwc.disconnect(DB))
ipcMain.handle('nwc-is-connected',     () => nwc.isConnected(DB))
ipcMain.handle('nwc-get-balance',      () => nwc.getBalance(DB))
ipcMain.handle('nwc-pay-invoice',      (_, { invoice }) => nwc.payInvoice(DB, invoice))
ipcMain.handle('nwc-make-invoice',     (_, args) => nwc.makeInvoice(DB, args))
ipcMain.handle('decode-invoice',       (_, { bolt11 }) => nwc.decodeInvoice(bolt11))

// Favorites
ipcMain.handle('get-favorites',        () => DB.getFavorites())
ipcMain.handle('add-favorite',         (_, args) => DB.addFavorite(args))
ipcMain.handle('remove-favorite',      (_, { id }) => DB.removeFavorite(id))

// Cashu
ipcMain.handle('cashu-get-balance',    () => DB.cashuGetBalance())
ipcMain.handle('cashu-list-mints',     () => DB.cashuListMints())
ipcMain.handle('cashu-add-mint',       (_, { url }) => DB.cashuAddMint(url))
ipcMain.handle('cashu-remove-mint',    (_, { url }) => DB.cashuRemoveMint(url))

app.whenReady().then(createWindow)
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
