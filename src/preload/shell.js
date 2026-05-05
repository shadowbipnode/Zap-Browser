'use strict'
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('zap', {
  minimize:    () => ipcRenderer.send('win-minimize'),
  maximize:    () => ipcRenderer.send('win-maximize'),
  close:       () => ipcRenderer.send('win-close'),

  tabCreate:   (a) => ipcRenderer.invoke('tab-create', a),
  tabSwitch:   (a) => ipcRenderer.invoke('tab-switch', a),
  tabClose:    (a) => ipcRenderer.invoke('tab-close', a),
  tabNavigate: (a) => ipcRenderer.invoke('tab-navigate', a),
  tabBack:     (a) => ipcRenderer.invoke('tab-go-back', a),
  tabForward:  (a) => ipcRenderer.invoke('tab-go-forward', a),
  tabReload:   (a) => ipcRenderer.invoke('tab-reload', a),
  shellResize: (a) => ipcRenderer.invoke('shell-resize', a),

  getPrivacy:      () => ipcRenderer.invoke('get-privacy'),
  setAdblock:      (a) => ipcRenderer.invoke('set-adblock', a),
  setWebRTC:       (a) => ipcRenderer.invoke('set-webrtc', a),
  setUAMode:       (a) => ipcRenderer.invoke('set-ua-mode', a),
  rotateUA:        () => ipcRenderer.invoke('rotate-ua'),
  getBlockedCount: () => ipcRenderer.invoke('get-blocked-count'),
  getUAPool:       () => ipcRenderer.invoke('get-ua-pool'),
  setDoh:          (a) => ipcRenderer.invoke('set-doh', a),
  getBlocklistInfo:() => ipcRenderer.invoke('get-blocklist-info'),

  v4vSendBoost:   (a) => ipcRenderer.invoke('v4v-send-boost', a),
  v4vSetAutopay:  (a) => ipcRenderer.invoke('v4v-set-autopay', a),
  v4vGetSettings: () => ipcRenderer.invoke('v4v-get-settings'),

  isInitialized:    () => ipcRenderer.invoke('is-initialized'),
  generateMnemonic: () => ipcRenderer.invoke('generate-mnemonic'),
  validateMnemonic: (a) => ipcRenderer.invoke('validate-mnemonic', a),
  setupWallet:      (a) => ipcRenderer.invoke('setup-wallet', a),

  nostrCreateProfile: (a) => ipcRenderer.invoke('nostr-create-profile', a),
  nostrImportNsec:    (a) => ipcRenderer.invoke('nostr-import-nsec', a),
  nostrSkip:          () => ipcRenderer.invoke('nostr-skip'),
  nostrGetProfile:    () => ipcRenderer.invoke('nostr-get-profile'),
  nostrGetRelays:     () => ipcRenderer.invoke('nostr-get-relays'),
  nostrSignEvent:     (a) => ipcRenderer.invoke('nostr-sign-event', a),
  nostrGetPubkey:     () => ipcRenderer.invoke('nostr-get-pubkey'),

  nwcDisconnect: () => ipcRenderer.invoke('nwc-disconnect'),
  nwcConnect:      (a) => ipcRenderer.invoke('nwc-connect', a),
  nwcDisconnect:   () => ipcRenderer.invoke('nwc-disconnect'),
  nwcIsConnected:  () => ipcRenderer.invoke('nwc-is-connected'),
  nwcGetBalance:   () => ipcRenderer.invoke('nwc-get-balance'),
  nwcPayInvoice:   (a) => ipcRenderer.invoke('nwc-pay-invoice', a),
  nwcMakeInvoice:  (a) => ipcRenderer.invoke('nwc-make-invoice', a),
  decodeInvoice:   (a) => ipcRenderer.invoke('decode-invoice', a),

  getFavorites:   () => ipcRenderer.invoke('get-favorites'),
  addFavorite:    (a) => ipcRenderer.invoke('add-favorite', a),
  importFavoritesHtml: (a) => ipcRenderer.invoke('import-favorites-html', a),
  removeFavorite: (a) => ipcRenderer.invoke('remove-favorite', a),

  cashuGetBalance:  () => ipcRenderer.invoke('cashu-get-balance'),
  cashuListMints:   () => ipcRenderer.invoke('cashu-list-mints'),
  cashuAddMint:     (a) => ipcRenderer.invoke('cashu-add-mint', a),
  cashuRemoveMint:  (a) => ipcRenderer.invoke('cashu-remove-mint', a),

  resetBrowser:  () => ipcRenderer.invoke('reset-browser'),
  getHistory:    (args) => ipcRenderer.invoke('get-history', args),
  clearHistory:  () => ipcRenderer.invoke('clear-history'),
  clearCookies:  () => ipcRenderer.invoke('clear-cookies'),
  clearCache:    () => ipcRenderer.invoke('clear-cache'),
  openDevTools: () => ipcRenderer.invoke('open-devtools'),

  on: (channel, cb) => {
    const allowed = [
      'tab-updated','blocked-count','payment-detected','app-ready',
      'tab-switched','page-features','v4v-detected','blocklist-ready','open-new-tab','tab-ready'
    ]
    if (allowed.includes(channel)) ipcRenderer.on(channel, (_, data) => cb(data))
  },
  off: (channel, cb) => ipcRenderer.removeListener(channel, cb),
})
