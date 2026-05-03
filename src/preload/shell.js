// src/preload/shell.js
'use strict'

const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('zap', {
  // Window controls
  minimize:    () => ipcRenderer.send('win-minimize'),
  maximize:    () => ipcRenderer.send('win-maximize'),
  close:       () => ipcRenderer.send('win-close'),

  // Tab management
  tabCreate:   (args) => ipcRenderer.invoke('tab-create', args),
  tabSwitch:   (args) => ipcRenderer.invoke('tab-switch', args),
  tabClose:    (args) => ipcRenderer.invoke('tab-close', args),
  tabNavigate: (args) => ipcRenderer.invoke('tab-navigate', args),
  tabBack:     (args) => ipcRenderer.invoke('tab-go-back', args),
  tabForward:  (args) => ipcRenderer.invoke('tab-go-forward', args),
  tabReload:   (args) => ipcRenderer.invoke('tab-reload', args),
  shellResize: (args) => ipcRenderer.invoke('shell-resize', args),

  // Privacy
  getPrivacy:     () => ipcRenderer.invoke('get-privacy'),
  setAdblock:     (args) => ipcRenderer.invoke('set-adblock', args),
  setWebRTC:      (args) => ipcRenderer.invoke('set-webrtc', args),
  setUAMode:      (args) => ipcRenderer.invoke('set-ua-mode', args),
  rotateUA:       () => ipcRenderer.invoke('rotate-ua'),
  getBlockedCount:() => ipcRenderer.invoke('get-blocked-count'),
  getUAPool:      () => ipcRenderer.invoke('get-ua-pool'),

  // Wallet
  isInitialized:  () => ipcRenderer.invoke('is-initialized'),
  generateMnemonic: () => ipcRenderer.invoke('generate-mnemonic'),
  validateMnemonic: (args) => ipcRenderer.invoke('validate-mnemonic', args),
  setupWallet:    (args) => ipcRenderer.invoke('setup-wallet', args),

  // Nostr
  nostrCreateProfile: (args) => ipcRenderer.invoke('nostr-create-profile', args),
  nostrImportNsec:    (args) => ipcRenderer.invoke('nostr-import-nsec', args),
  nostrSkip:          () => ipcRenderer.invoke('nostr-skip'),
  nostrGetProfile:    () => ipcRenderer.invoke('nostr-get-profile'),
  nostrGetRelays:     () => ipcRenderer.invoke('nostr-get-relays'),
  nostrSignEvent:     (args) => ipcRenderer.invoke('nostr-sign-event', args),
  nostrGetPubkey:     () => ipcRenderer.invoke('nostr-get-pubkey'),

  // NWC Lightning
  nwcConnect:      (args) => ipcRenderer.invoke('nwc-connect', args),
  nwcDisconnect:   () => ipcRenderer.invoke('nwc-disconnect'),
  nwcIsConnected:  () => ipcRenderer.invoke('nwc-is-connected'),
  nwcGetBalance:   () => ipcRenderer.invoke('nwc-get-balance'),
  nwcPayInvoice:   (args) => ipcRenderer.invoke('nwc-pay-invoice', args),
  nwcMakeInvoice:  (args) => ipcRenderer.invoke('nwc-make-invoice', args),
  decodeInvoice:   (args) => ipcRenderer.invoke('decode-invoice', args),

  // Favorites
  getFavorites:   () => ipcRenderer.invoke('get-favorites'),
  addFavorite:    (args) => ipcRenderer.invoke('add-favorite', args),
  removeFavorite: (args) => ipcRenderer.invoke('remove-favorite', args),

  // Cashu
  cashuGetBalance:  () => ipcRenderer.invoke('cashu-get-balance'),
  cashuListMints:   () => ipcRenderer.invoke('cashu-list-mints'),
  cashuAddMint:     (args) => ipcRenderer.invoke('cashu-add-mint', args),
  cashuRemoveMint:  (args) => ipcRenderer.invoke('cashu-remove-mint', args),

  resetBrowser: () => ipcRenderer.invoke('reset-browser'),

  // Events from main → renderer
  on: (channel, cb) => {
    const allowed = ['tab-updated','blocked-count','payment-detected','app-ready','tab-switched']
    if (allowed.includes(channel)) ipcRenderer.on(channel, (_, data) => cb(data))
  },
  off: (channel, cb) => ipcRenderer.removeListener(channel, cb),
})
