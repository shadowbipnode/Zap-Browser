'use strict'
const { app, BrowserWindow, BrowserView, ipcMain, session, dialog, shell } = require('electron')
const path   = require('path')
const DB     = require('./db')
const wallet = require('./wallet')
const nostr  = require('./nostr')
const nwc    = require('./nwc')
const bl     = require('./blocklist')
const doh    = require('./doh')
const v4v    = require('./value4value')
const cashu  = require('./cashu')
const lnurl  = require('./lnurl')
const V = require('./validate')

const isDev = !app.isPackaged

let mainWindow  = null
let activeView  = null
const tabUrls   = new Map()
let activeTabId = null
let isSwitching = false

// Shell height: titlebar(32) + tabbar(36) + toolbar(46) + bookmarks bar(28)
const SHELL_H = 142

const UA_POOL = [
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64; rv:126.0) Gecko/20100101 Firefox/126.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
]
let currentUA = UA_POOL[Math.floor(Math.random() * UA_POOL.length)]
const nostrSessionPermissions = new Map()

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

  nostrSessionPermissions.set(key, 'deny')
  return false
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

  view.webContents.on('page-title-updated', (_, title) => {
    if (!activeTabId) return
    mainWindow?.webContents.send('tab-updated', {
      tabId: activeTabId,
      title,
      url: view.webContents.getURL(),
    })
  })

  view.webContents.on('did-navigate', async (_, url) => {
    if (!activeTabId) return
    tabUrls.set(activeTabId, url)
    mainWindow?.webContents.send('tab-updated', {
      tabId: activeTabId,
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
      mainWindow?.webContents.send('tab-updated', { tabId: activeTabId, loading: true })
    }
  })

  view.webContents.on('did-stop-loading', () => {
    if (!activeTabId) return
    const url   = view.webContents.getURL()
    const title = view.webContents.getTitle()
    mainWindow?.webContents.send('tab-updated', { tabId: activeTabId, loading: false, url, title })
    if (url && !url.startsWith('chrome://') && !url.startsWith('devtools://')) {
      DB.addHistory(url, title)
    }
  })

  // Popup / new-window protection.
  // Same-origin links may open in the current tab.
  // Cross-origin windows are usually popups/popunders/interstitial ads and are blocked.
  view.webContents.setWindowOpenHandler(({ url, disposition }) => {
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

  // Suppress the browser's unload dialog so closing a tab is never blocked
  view.webContents.on('will-prevent-unload', (e) => e.preventDefault())

  function injectOverlayProtection() {
    if (!DB.getPrivacy().adblock) return

    view.webContents.executeJavaScript(`
      (function() {
        function zapKillAdSkins() {
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
                /(ad|adv|ads|banner|pubblic|sponsor|campaign|autoligure|volkswagen|promo)/i.test(bg)
              ) {
                el.style.backgroundImage = 'none';
                el.style.background = 'transparent';
              }
            });
          }
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

        function zapKillAggressiveOverlays() {
          zapKillAdSkins();
          zapKillAdElements();

          const selectors = [
            '[class*="overlay"]',
            '[id*="overlay"]',
            '[class*="modal"]',
            '[id*="modal"]',
            '[class*="popup"]',
            '[id*="popup"]',
            '[class*="interstitial"]',
            '[id*="interstitial"]',
            '[class*="advert"]',
            '[id*="advert"]',
            '[class*="banner"]',
            '[id*="banner"]',
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
                el.remove();
              }
            });
          }

          document.body.style.overflow = '';
          document.documentElement.style.overflow = '';
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
            subtree: true,
            attributes: true,
            attributeFilter: ['style', 'class']
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

function showView() {
  if (!mainWindow || !activeView) return
  if (!mainWindow.getBrowserViews().includes(activeView)) {
    mainWindow.addBrowserView(activeView)
  }
  const { width, height } = mainWindow.getBounds()
  activeView.setBounds({ x: 0, y: SHELL_H, width, height: height - SHELL_H })
  activeView.setAutoResize({ width: true, height: true })
}

function hideView() {
  if (!mainWindow || !activeView) return
  try { mainWindow.removeBrowserView(activeView) } catch (_) {}
}

function setupPrivacy(ses) {
  ses.webRequest.onBeforeRequest({ urls: ['*://*/*'] }, (details, cb) => {
    const priv = DB.getPrivacy()
    if (!priv.adblock) return cb({})

    // Never block static assets — doing so breaks page rendering
    const passThrough = ['image', 'imageset', 'font', 'media', 'stylesheet']
    if (passThrough.includes(details.resourceType)) return cb({})

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

  bl.init((size) => {
    mainWindow?.webContents.send('blocklist-ready', { size })
  })

  mainWindow.on('resize', () => {
    if (activeTabId && tabUrls.get(activeTabId)) showView()
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
  showView()
  activeView.webContents.loadURL('about:blank').catch(() => {})
  return { ok: true }
})

ipcMain.handle('tab-switch', (_, { tabId }) => {
  activeTabId = tabId
  const url = tabUrls.get(tabId) || ''
  if (url && url !== 'zap://newtab') {
    showView()
    const current = activeView.webContents.getURL()
    if (current !== url) {
      isSwitching = true
      activeView.webContents.loadURL(url)
        .catch(() => {})
        .finally(() => { isSwitching = false })
    }
  } else {
    hideView()
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
  showView()
  await new Promise(r => setTimeout(r, 50))
  activeView.webContents.loadURL(u).catch(() => {})
  return { ok: true, url: u }
})

ipcMain.handle('tab-close', (_, { tabId }) => {
  tabUrls.delete(tabId)
  if (activeTabId === tabId) { hideView(); activeTabId = null }
  return { ok: true }
})

ipcMain.handle('tab-home', (_, { tabId }) => {
  activeTabId = tabId
  tabUrls.set(tabId, '')
  hideView()
  return { ok: true }
})

ipcMain.handle('tab-go-back',  () => activeView?.webContents.goBack())
ipcMain.handle('tab-go-forward', () => activeView?.webContents.goForward())
ipcMain.handle('tab-reload',   () => activeView?.webContents.reload())

ipcMain.handle('shell-resize', (_, args) => {
  if (!activeTabId || !tabUrls.get(activeTabId) || !mainWindow || !activeView) return

  const { width, height } = mainWindow.getBounds()

  const suggestionsOffset = args?.suggestionsOpen ? 320 : 0

  activeView.setBounds({
    x: 0,
    y: SHELL_H + suggestionsOffset,
    width: width - (args?.panelOpen ? 320 : 0),
    height: height - SHELL_H - suggestionsOffset,
  })
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
ipcMain.handle('import-favorites-html', (_, { html }) => {
  const results = []
  const linkRe  = /<A[^>]+HREF="([^"]+)"[^>]*>([^<]+)<\/A>/gi
  let match
  while ((match = linkRe.exec(html)) !== null) {
    const url   = match[1].trim()
    const title = match[2].trim()
    if (url.startsWith('http') && title) {
      try {
        DB._db()
          .prepare('INSERT OR IGNORE INTO favorites(url,title,favicon,created_at) VALUES(?,?,NULL,?)')
          .run(url, title, Math.floor(Date.now() / 1000))
        results.push({ url, title })
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
