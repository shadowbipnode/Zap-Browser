'use strict'

const { app, BrowserWindow, BrowserView, ipcMain, session, dialog } = require('electron')
const path = require('path')
const DB     = require('./db')
const wallet = require('./wallet')
const nostr  = require('./nostr')
const nwc    = require('./nwc')

const isDev  = !app.isPackaged
let mainWindow = null
let activeView = null  // UNA SOLA BrowserView attiva alla volta
const tabUrls  = new Map()  // tabId -> url corrente
let activeTabId = null

const SHELL_H = 114

const BLOCK_DOMAINS = new Set([
  'doubleclick.net','googlesyndication.com','googletagmanager.com',
  'google-analytics.com','facebook.net','fbcdn.net','criteo.com',
  'rubiconproject.com','pubmatic.com','openx.net','taboola.com',
  'outbrain.com','scorecardresearch.com','hotjar.com','moatads.com',
])

const UA_POOL = [
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64; rv:126.0) Gecko/20100101 Firefox/126.0',
]
let currentUA  = UA_POOL[0]
let blockedCount = 0

// ── Crea la BrowserView principale (una sola) ─────────────────────────────
function createMainView() {
  const view = new BrowserView({
    webPreferences: {
      preload: path.join(__dirname, '../preload/webview.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
    }
  })

  view.webContents.on('page-title-updated', (_, title) => {
    if (!activeTabId) return
    mainWindow?.webContents.send('tab-updated', {
      tabId: activeTabId, title, url: view.webContents.getURL()
    })
  })

  view.webContents.on('did-navigate', (_, url) => {
    if (!activeTabId) return
    tabUrls.set(activeTabId, url)
    mainWindow?.webContents.send('tab-updated', {
      tabId: activeTabId, url,
      canGoBack: view.webContents.canGoBack(),
      canGoForward: view.webContents.canGoForward(),
    })
  })

  view.webContents.on('did-start-loading', () => {
    if (activeTabId) mainWindow?.webContents.send('tab-updated', { tabId: activeTabId, loading: true })
  })

  view.webContents.on('did-stop-loading', () => {
    if (activeTabId) mainWindow?.webContents.send('tab-updated', {
      tabId: activeTabId, loading: false, url: view.webContents.getURL()
    })
  })

  view.webContents.setWindowOpenHandler(({ url }) => {
    view.webContents.loadURL(url)
    return { action: 'deny' }
  })

  return view
}

function showView() {
  if (!mainWindow || !activeView) return
  const views = mainWindow.getBrowserViews()
  if (!views.includes(activeView)) mainWindow.addBrowserView(activeView)
  const { width, height } = mainWindow.getBounds()
  activeView.setBounds({ x: 0, y: SHELL_H, width, height: height - SHELL_H })
  activeView.setAutoResize({ width: true, height: true })
}

function hideView() {
  if (!mainWindow || !activeView) return
  try { mainWindow.removeBrowserView(activeView) } catch(_) {}
}

// ── Privacy ───────────────────────────────────────────────────────────────
function setupPrivacy(ses) {
  ses.webRequest.onBeforeRequest({ urls: ['*://*/*'] }, (details, cb) => {
    const priv = DB.getPrivacy()
    if (!priv.adblock) return cb({})
    try {
      const host = new URL(details.url).hostname.replace(/^www\./, '')
      if ([...BLOCK_DOMAINS].some(d => host === d || host.endsWith('.' + d))) {
        blockedCount++
        mainWindow?.webContents.send('blocked-count', blockedCount)
        return cb({ cancel: true })
      }
    } catch(_) {}
    cb({})
  })
  ses.webRequest.onBeforeSendHeaders((details, cb) => {
    const headers = { ...details.requestHeaders }
    const priv = DB.getPrivacy()
    if (priv.ua_mode !== 'default') headers['User-Agent'] = currentUA
    delete headers['X-Forwarded-For']
    cb({ requestHeaders: headers })
  })
}

// ── Main window ───────────────────────────────────────────────────────────
function createWindow() {
  DB.init()

  mainWindow = new BrowserWindow({
    width: 1280, height: 800,
    minWidth: 900, minHeight: 600,
    frame: false,
    backgroundColor: '#0f0f12',
    webPreferences: {
      preload: path.join(__dirname, '../preload/shell.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  activeView = createMainView()
  setupPrivacy(session.defaultSession)

  mainWindow.on('resize', () => {
    if (activeTabId && tabUrls.get(activeTabId)) showView()
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:3000')
    // mainWindow.webContents.openDevTools({ mode: "detach" })
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'))
  }

  mainWindow.webContents.on('did-finish-load', () => {
    const initialized = DB.getSetting('initialized') === '1'
    mainWindow.webContents.send('app-ready', { initialized })
    if (initialized) nwc.reconnectFromDB(DB).catch(() => {})
  })
}

// ── IPC ───────────────────────────────────────────────────────────────────
ipcMain.on('win-minimize', () => mainWindow?.minimize())
ipcMain.on('win-maximize', () => mainWindow?.isMaximized() ? mainWindow.unmaximize() : mainWindow?.maximize())
ipcMain.on('win-close',    () => mainWindow?.close())

// Nuovo tab — nascondi view, imposta tab attivo
ipcMain.handle('tab-create', (_, { tabId }) => {
  tabUrls.set(tabId, '')
  activeTabId = tabId
  hideView()  // mostra new tab page (sfondo React)
  return { ok: true }
})

// Switch tab
ipcMain.handle('tab-switch', (_, { tabId }) => {
  activeTabId = tabId
  const url = tabUrls.get(tabId) || ''
  if (url && url !== 'zap://newtab') {
    // Naviga la view all'URL salvato di questo tab
    activeView.webContents.loadURL(url).catch(() => {})
    showView()
  } else {
    hideView()
  }
  return { ok: true }
})

// Naviga
ipcMain.handle('tab-navigate', async (_, { tabId, url }) => {
  let u = url.trim()
  if (!u.startsWith('http://') && !u.startsWith('https://')) {
    u = u.includes('.') && !u.includes(' ')
      ? 'https://' + u
      : 'https://duckduckgo.com/?q=' + encodeURIComponent(u)
  }
  activeTabId = tabId
  tabUrls.set(tabId, u)
  activeView.webContents.loadURL(u).catch(e => console.error(e))
  showView()
  return { ok: true, url: u }
})

// Chiudi tab
ipcMain.handle('tab-close', (_, { tabId }) => {
  tabUrls.delete(tabId)
  if (activeTabId === tabId) {
    hideView()
    activeTabId = null
  }
  return { ok: true }
})

ipcMain.handle('tab-go-back',    () => activeView?.webContents.goBack())
ipcMain.handle('tab-go-forward', () => activeView?.webContents.goForward())
ipcMain.handle('tab-reload',     () => activeView?.webContents.reload())
ipcMain.handle('shell-resize',   (_, args) => {
  if (!activeTabId || !tabUrls.get(activeTabId)) return
  if (!mainWindow || !activeView) return
  const { width, height } = mainWindow.getBounds()
  const panelW = args?.panelOpen ? 320 : 0
  activeView.setBounds({ x: 0, y: SHELL_H, width: width - panelW, height: height - SHELL_H })
})

// Privacy
ipcMain.handle('get-privacy',      () => DB.getPrivacy())
ipcMain.handle('set-adblock',      (_, { enabled }) => DB.setPrivacy('adblock', enabled ? 1 : 0))
ipcMain.handle('set-webrtc',       (_, { enabled }) => DB.setPrivacy('webrtc_protect', enabled ? 1 : 0))
ipcMain.handle('set-ua-mode',      (_, { mode }) => { DB.setPrivacy('ua_mode', mode); if (mode==='rotate') currentUA = UA_POOL[Math.floor(Math.random()*UA_POOL.length)]; return currentUA })
ipcMain.handle('rotate-ua',        () => { currentUA = UA_POOL[Math.floor(Math.random()*UA_POOL.length)]; return currentUA })
ipcMain.handle('get-blocked-count',() => blockedCount)
ipcMain.handle('get-ua-pool',      () => UA_POOL)

// Wallet
ipcMain.handle('is-initialized',    () => DB.getSetting('initialized') === '1')
ipcMain.handle('generate-mnemonic', () => wallet.generateMnemonic())
ipcMain.handle('validate-mnemonic', (_, { words }) => wallet.validateMnemonic(words))
ipcMain.handle('setup-wallet',      (_, args) => wallet.setupWallet(DB, args))

// Nostr
ipcMain.handle('nostr-create-profile', (_, args) => nostr.createProfile(DB, args))
ipcMain.handle('nostr-import-nsec',    (_, args) => nostr.importNsec(DB, args))
ipcMain.handle('nostr-skip',           () => DB.setSetting('nostr_skipped','1'))
ipcMain.handle('nostr-get-profile',    () => nostr.getProfile(DB))
ipcMain.handle('nostr-get-relays',     () => nostr.getRelays())
ipcMain.handle('nostr-sign-event',     (_, { event }) => nostr.signEvent(DB, event))
ipcMain.handle('nostr-get-pubkey',     () => nostr.getPubkey(DB))
ipcMain.handle('nostr-get-pubkey-nip07',  () => nostr.getPubkey(DB))
ipcMain.handle('nostr-sign-event-nip07', async (_, { event: e }) => nostr.signEvent(DB, e))
ipcMain.handle('nostr-get-relays-nip07',  () => nostr.getRelays())
ipcMain.handle('nostr-nip04-encrypt', async (_, { pubkey, text }) => {
  const { nip04 } = require('nostr-tools')
  const row = DB._db().prepare('SELECT encrypted_nsec FROM nostr_profile WHERE id=1').get()
  if (!row) throw new Error('No profile')
  return nip04.encrypt(row.encrypted_nsec, pubkey, text)
})
ipcMain.handle('nostr-nip04-decrypt', async (_, { pubkey, text }) => {
  const { nip04 } = require('nostr-tools')
  const row = DB._db().prepare('SELECT encrypted_nsec FROM nostr_profile WHERE id=1').get()
  if (!row) throw new Error('No profile')
  return nip04.decrypt(row.encrypted_nsec, pubkey, text)
})

// NWC
ipcMain.handle('nwc-connect',      (_, args) => nwc.connect(DB, args))
ipcMain.handle('nwc-disconnect',   () => nwc.disconnect(DB))
ipcMain.handle('nwc-is-connected', () => nwc.isConnected(DB))
ipcMain.handle('nwc-get-balance',  () => nwc.getBalance(DB))
ipcMain.handle('nwc-pay-invoice',  (_, { invoice }) => nwc.payInvoice(DB, invoice))
ipcMain.handle('nwc-make-invoice', (_, args) => nwc.makeInvoice(DB, args))
ipcMain.handle('decode-invoice',   (_, { bolt11 }) => nwc.decodeInvoice(bolt11))

// Reset browser
ipcMain.handle('reset-browser', () => {
  const dbPath = require('path').join(app.getPath('userData'), 'zap.db')
  try { require('fs').unlinkSync(dbPath) } catch(_) {}
  return { ok: true }
})

// Favorites
ipcMain.handle('get-favorites',   () => DB.getFavorites())
ipcMain.handle('add-favorite',    (_, args) => DB.addFavorite(args))
ipcMain.handle('remove-favorite', (_, { id }) => DB.removeFavorite(id))

// Cashu
ipcMain.handle('cashu-get-balance',  () => DB.cashuGetBalance())
ipcMain.handle('cashu-list-mints',   () => DB.cashuListMints())
ipcMain.handle('cashu-add-mint',     (_, { url }) => DB.cashuAddMint(url))
ipcMain.handle('cashu-remove-mint',  (_, { url }) => DB.cashuRemoveMint(url))

app.whenReady().then(createWindow)
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
