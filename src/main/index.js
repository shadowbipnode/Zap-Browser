'use strict'
const { app, BrowserWindow, BrowserView, ipcMain, session, dialog } = require('electron')
const path = require('path')
const DB   = require('./db')
const wallet = require('./wallet')
const nostr  = require('./nostr')
const nwc    = require('./nwc')
const bl     = require('./blocklist')
const doh    = require('./doh')
const v4v    = require('./value4value')

const isDev = !app.isPackaged
let mainWindow  = null
let activeView  = null
const tabUrls   = new Map()
let activeTabId = null
const SHELL_H   = 114

const UA_POOL = [
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64; rv:126.0) Gecko/20100101 Firefox/126.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
]
let currentUA = UA_POOL[0]

function createMainView() {
  const view = new BrowserView({
    webPreferences: {
      preload: path.join(__dirname, '../preload/webview.js'),
      contextIsolation: true, nodeIntegration: false, webSecurity: true,
    }
  })
  view.webContents.on('page-title-updated', (_, title) => {
    if (!activeTabId) return
    mainWindow?.webContents.send('tab-updated', { tabId: activeTabId, title, url: view.webContents.getURL() })
  })
  view.webContents.on('did-navigate', async (_, url) => {
    if (!activeTabId) return
    tabUrls.set(activeTabId, url)
    mainWindow?.webContents.send('tab-updated', {
      tabId: activeTabId, url,
      canGoBack: view.webContents.canGoBack(),
      canGoForward: view.webContents.canGoForward(),
    })
    setTimeout(async () => {
      try {
        const hasNostr = await view.webContents.executeJavaScript('!!(window.nostr)')
        mainWindow?.webContents.send('page-features', { nostr: hasNostr, url })
        const v4vInfo = await v4v.checkPage(url, view.webContents)
        if (v4vInfo.supported) mainWindow?.webContents.send('v4v-detected', v4vInfo)
      } catch(_) {}
    }, 1500)
  })
  view.webContents.on('did-start-loading', () => {
    if (activeTabId) mainWindow?.webContents.send('tab-updated', { tabId: activeTabId, loading: true })
  })
  view.webContents.on('did-stop-loading', () => {
    if (!activeTabId) return
    const url = view.webContents.getURL()
    const title = view.webContents.getTitle()
    mainWindow?.webContents.send('tab-updated', { tabId: activeTabId, loading: false, url, title })
    // Salva in history
    if (url && !url.startsWith('chrome://') && !url.startsWith('devtools://')) {
      DB.addHistory(url, title)
    }
  })
  // Blocca popup e finestre nuove
  view.webContents.setWindowOpenHandler(({ url }) => {
    // Naviga nel tab corrente invece di aprire popup
    view.webContents.loadURL(url)
    return { action: 'deny' }
  })

  // Blocca dialog JavaScript (alert, confirm, prompt) da siti spam
  view.webContents.on('will-prevent-unload', (e) => e.preventDefault())
  return view
}

function showView() {
  if (!mainWindow || !activeView) return
  const views = mainWindow.getBrowserViews()
  if (!views.includes(activeView)) {
    mainWindow.addBrowserView(activeView)
    }
  const { width, height } = mainWindow.getBounds()
  const bounds = { x:0, y:SHELL_H, width, height: height-SHELL_H }
  activeView.setBounds(bounds)
  activeView.setAutoResize({ width:true, height:true })
}

function hideView() {
  if (!mainWindow || !activeView) return
  try { mainWindow.removeBrowserView(activeView); console.log('[hideView] rimossa') } catch(e) { console.log('[hideView] errore:', e.message) }
}

function setupPrivacy(ses) {
  ses.webRequest.onBeforeRequest({ urls:['*://*/*'] }, (details, cb) => {
    const priv = DB.getPrivacy()
    if (!priv.adblock) return cb({})
    if (bl.shouldBlock(details.url)) {
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
    if (priv.webrtc_protect && permission === 'media') return cb(false)
    if (permission === 'notifications') return cb(false)
    cb(true)
  })
}

function createWindow() {
  DB.init()
  v4v.init(nwc)
  mainWindow = new BrowserWindow({
    width:1280, height:800, minWidth:900, minHeight:600,
    frame:false, backgroundColor:'#0f0f12',
    webPreferences: {
      preload: path.join(__dirname, '../preload/shell.js'),
      contextIsolation:true, nodeIntegration:false,
    },
  })
  activeView = createMainView()
  setupPrivacy(session.defaultSession)
  bl.init((size) => {
    mainWindow?.webContents.send('blocklist-ready', { size })
    console.log(`[Blocklist] ${size.toLocaleString()} domini pronti`)
  })
  mainWindow.on('resize', () => { if (activeTabId && tabUrls.get(activeTabId)) showView() })
  if (isDev) {
    mainWindow.loadURL('http://localhost:3000')
    // mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'))
  }
  mainWindow.once('ready-to-show', () => {
    mainWindow.maximize()
    mainWindow.show()
  })

  mainWindow.webContents.on('did-finish-load', () => {
    const initialized = DB.getSetting('initialized') === '1'
    mainWindow.webContents.send('app-ready', { initialized })
    if (initialized) nwc.reconnectFromDB(DB).catch(() => {})
  })
}

// Window
ipcMain.on('win-minimize', () => mainWindow?.minimize())
ipcMain.on('win-maximize', () => mainWindow?.isMaximized() ? mainWindow.unmaximize() : mainWindow?.maximize())
ipcMain.on('win-close',    () => mainWindow?.close())

// Tabs
ipcMain.handle('tab-create', (_, { tabId }) => {
  tabUrls.set(tabId, '')
  activeTabId = tabId
  if (mainWindow && activeView) {
    try { mainWindow.removeBrowserView(activeView); console.log('[tab-create] view rimossa') } catch(e) { console.log('[tab-create] errore rimozione:', e.message) }
  }
  return { ok:true }
})
ipcMain.handle('tab-switch', (_, { tabId }) => {
  const url = tabUrls.get(tabId) || ''
  activeTabId = tabId
  if (url && url !== 'zap://newtab') {
    showView()
    setTimeout(() => activeView.webContents.loadURL(url).catch(() => {}), 50)
  } else {
    hideView()
  }
  return { ok:true }
})
ipcMain.handle('tab-navigate', async (_, { tabId, url }) => {
  let u = url.trim()
  if (!u.startsWith('http://') && !u.startsWith('https://'))
    u = u.includes('.') && !u.includes(' ') ? 'https://'+u : 'https://duckduckgo.com/?q='+encodeURIComponent(u)
  activeTabId = tabId
  tabUrls.set(tabId, u)
  // showView PRIMA del loadURL — critico su Linux
  showView()
  // Piccola pausa per garantire che la view sia attaccata alla finestra
  await new Promise(r => setTimeout(r, 50))
  activeView.webContents.loadURL(u).catch(e => console.error('[tab-navigate] loadURL error:', e))
  return { ok:true, url:u }
})
ipcMain.handle('tab-close', (_, { tabId }) => {
  tabUrls.delete(tabId)
  if (activeTabId===tabId) { hideView(); activeTabId=null }
  return { ok:true }
})
ipcMain.handle('tab-go-back',    () => activeView?.webContents.goBack())
ipcMain.handle('tab-go-forward', () => activeView?.webContents.goForward())
ipcMain.handle('tab-reload',     () => activeView?.webContents.reload())
ipcMain.handle('shell-resize',   (_, args) => {
  if (!activeTabId || !tabUrls.get(activeTabId) || !mainWindow || !activeView) return
  const { width, height } = mainWindow.getBounds()
  activeView.setBounds({ x:0, y:SHELL_H, width: width-(args?.panelOpen?320:0), height:height-SHELL_H })
})

// Privacy
ipcMain.handle('get-privacy', () => ({
  ...DB.getPrivacy(), blockedCount: bl.getBlockedCount(),
  blocklistSize: bl.getListSize(), blocklistReady: bl.isReady(), dohEnabled: doh.isEnabled(),
}))
ipcMain.handle('set-adblock',      (_, {enabled}) => DB.setPrivacy('adblock', enabled?1:0))
ipcMain.handle('set-webrtc',       (_, {enabled}) => DB.setPrivacy('webrtc_protect', enabled?1:0))
ipcMain.handle('set-ua-mode',      (_, {mode}) => { DB.setPrivacy('ua_mode',mode); if(mode==='rotate') currentUA=UA_POOL[Math.floor(Math.random()*UA_POOL.length)]; return currentUA })
ipcMain.handle('rotate-ua',        () => { currentUA=UA_POOL[Math.floor(Math.random()*UA_POOL.length)]; return currentUA })
ipcMain.handle('get-blocked-count',() => bl.getBlockedCount())
ipcMain.handle('get-ua-pool',      () => UA_POOL)
ipcMain.handle('set-doh',          (_, {enabled, provider}) => { doh.setEnabled(enabled); if(provider) doh.setProvider(provider); DB.setPrivacy('doh_enabled',enabled?1:0); return {ok:true} })
ipcMain.handle('get-blocklist-info',() => ({ size:bl.getListSize(), ready:bl.isReady(), count:bl.getBlockedCount() }))

// V4V
ipcMain.handle('v4v-send-boost',  (_, {amount,message}) => v4v.sendBoost(DB,amount,message))
ipcMain.handle('v4v-set-autopay', (_, {enabled,amount}) => { v4v.setAutoPayEnabled(enabled); if(amount) v4v.setAutoPayAmount(amount); return {ok:true} })
ipcMain.handle('v4v-get-settings',() => ({ enabled:v4v.isAutoPayEnabled(), amount:v4v.getAutoPayAmount() }))

// Wallet
ipcMain.handle('is-initialized',    () => DB.getSetting('initialized')==='1')
ipcMain.handle('generate-mnemonic', () => wallet.generateMnemonic())
ipcMain.handle('validate-mnemonic', (_, {words}) => wallet.validateMnemonic(words))
ipcMain.handle('setup-wallet',      (_, args) => wallet.setupWallet(DB, args))

// Nostr
ipcMain.handle('nostr-create-profile',   (_, args) => nostr.createProfile(DB, args))
ipcMain.handle('nostr-import-nsec',      (_, args) => nostr.importNsec(DB, args))
ipcMain.handle('nostr-skip',             () => DB.setSetting('nostr_skipped','1'))
ipcMain.handle('nostr-get-profile',      () => nostr.getProfile(DB))
ipcMain.handle('nostr-get-relays',       () => nostr.getRelays())
ipcMain.handle('nostr-sign-event',       (_, {event}) => nostr.signEvent(DB, event))
ipcMain.handle('nostr-get-pubkey',       () => nostr.getPubkey(DB))
ipcMain.handle('nostr-get-pubkey-nip07', () => nostr.getPubkey(DB))
ipcMain.handle('nostr-sign-event-nip07', async (_, {event:e}) => nostr.signEvent(DB, e))
ipcMain.handle('nostr-get-relays-nip07', () => nostr.getRelays())
ipcMain.handle('nostr-nip04-encrypt', async (_, {pubkey,text}) => {
  const {nip04} = require('nostr-tools')
  const row = DB._db().prepare('SELECT encrypted_nsec FROM nostr_profile WHERE id=1').get()
  if (!row) throw new Error('No profile')
  return nip04.encrypt(row.encrypted_nsec, pubkey, text)
})
ipcMain.handle('nostr-nip04-decrypt', async (_, {pubkey,text}) => {
  const {nip04} = require('nostr-tools')
  const row = DB._db().prepare('SELECT encrypted_nsec FROM nostr_profile WHERE id=1').get()
  if (!row) throw new Error('No profile')
  return nip04.decrypt(row.encrypted_nsec, pubkey, text)
})

// NWC
ipcMain.handle('nwc-connect',      (_, args) => nwc.connect(DB, args))
ipcMain.handle('nwc-disconnect',   () => nwc.disconnect(DB))
ipcMain.handle('nwc-is-connected', () => nwc.isConnected(DB))
ipcMain.handle('nwc-get-balance',  () => nwc.getBalance(DB))
ipcMain.handle('nwc-pay-invoice',  (_, {invoice}) => nwc.payInvoice(DB, invoice))
ipcMain.handle('nwc-make-invoice', (_, args) => nwc.makeInvoice(DB, args))
ipcMain.handle('decode-invoice',   (_, {bolt11}) => nwc.decodeInvoice(bolt11))

// Favorites
ipcMain.handle('get-favorites',   () => DB.getFavorites())
ipcMain.handle('add-favorite',    (_, args) => DB.addFavorite(args))
ipcMain.handle('remove-favorite', (_, {id}) => DB.removeFavorite(id))

// Cashu
ipcMain.handle('cashu-get-balance',  () => DB.cashuGetBalance())
ipcMain.handle('cashu-list-mints',   () => DB.cashuListMints())
ipcMain.handle('cashu-add-mint',     (_, {url}) => DB.cashuAddMint(url))
ipcMain.handle('cashu-remove-mint',  (_, {url}) => DB.cashuRemoveMint(url))

// DevTools
ipcMain.handle('open-devtools', () => {
  if (activeView) activeView.webContents.openDevTools()
  else mainWindow?.webContents.openDevTools()
})

// History
ipcMain.handle('get-history',   (_, {limit} = {}) => DB.getHistory(limit || 100))
ipcMain.handle('clear-history', () => DB.clearHistory())
ipcMain.handle('clear-cookies', async () => {
  await session.defaultSession.clearStorageData({ storages: ['cookies','localstorage','sessionstorage','indexdb','websql','serviceworkers','cachestorage'] })
  return { ok: true }
})
ipcMain.handle('clear-cache', async () => {
  await session.defaultSession.clearCache()
  return { ok: true }
})

// Reset
ipcMain.handle('reset-browser', () => {
  const dbPath = path.join(app.getPath('userData'), 'zap.db')
  try { require('fs').unlinkSync(dbPath) } catch(_) {}
  return { ok:true }
})

app.whenReady().then(createWindow)
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
