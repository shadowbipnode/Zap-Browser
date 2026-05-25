'use strict'
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('zap', {
  portableStatus: () => ipcRenderer.invoke('portable-status'),
  portableSetupPassphrase: (a) => ipcRenderer.invoke('portable-setup-passphrase', a),
  portableUnlock: (a) => ipcRenderer.invoke('portable-unlock', a),

  // Window controls
  minimize: () => ipcRenderer.send('win-minimize'),
  maximize: () => ipcRenderer.send('win-maximize'),
  close:    () => ipcRenderer.send('win-close'),

  // Tab management
  tabCreate:   (a) => ipcRenderer.invoke('tab-create', a),
  tabSwitch:   (a) => ipcRenderer.invoke('tab-switch', a),
  tabClose:    (a) => ipcRenderer.invoke('tab-close', a),
  tabNavigate: (a) => ipcRenderer.invoke('tab-navigate', a),
  tabHome:     (a) => ipcRenderer.invoke('tab-home', a),
  tabBack:     (a) => ipcRenderer.invoke('tab-go-back', a),
  tabForward:  (a) => ipcRenderer.invoke('tab-go-forward', a),
  tabReload:   (a) => ipcRenderer.invoke('tab-reload', a),
  shellResize: (a) => ipcRenderer.invoke('shell-resize', a),

  // Privacy
  getPrivacy:       () => ipcRenderer.invoke('get-privacy'),
  setAdblock:       (a) => ipcRenderer.invoke('set-adblock', a),
  setWebRTC:        (a) => ipcRenderer.invoke('set-webrtc', a),
  setPopupBlock:    (a) => ipcRenderer.invoke('set-popup-block', a),
  setOverlayBlock:  (a) => ipcRenderer.invoke('set-overlay-block', a),
  setUAMode:        (a) => ipcRenderer.invoke('set-ua-mode', a),
  rotateUA:         () => ipcRenderer.invoke('rotate-ua'),
  getBlockedCount:  () => ipcRenderer.invoke('get-blocked-count'),
  getUAPool:        () => ipcRenderer.invoke('get-ua-pool'),
  setDoh:           (a) => ipcRenderer.invoke('set-doh', a),
  setTorProxy:      (a) => ipcRenderer.invoke('set-tor-proxy', a),
  showEditContextMenu: () => ipcRenderer.invoke('show-edit-context-menu'),
  showUAMenu: () => ipcRenderer.invoke('show-ua-menu'),
  getDownloadHistory: () => ipcRenderer.invoke('get-download-history'),
  clearDownloadHistory: () => ipcRenderer.invoke('clear-download-history'),
  getBlocklistInfo: () => ipcRenderer.invoke('get-blocklist-info'),

  // Value4Value
  v4vSendBoost:   (a) => ipcRenderer.invoke('v4v-send-boost', a),
  v4vSetAutopay:  (a) => ipcRenderer.invoke('v4v-set-autopay', a),
  v4vGetSettings: () => ipcRenderer.invoke('v4v-get-settings'),

  // Wallet setup
  isInitialized:    () => ipcRenderer.invoke('is-initialized'),
  generateMnemonic: () => ipcRenderer.invoke('generate-mnemonic'),
  validateMnemonic: (a) => ipcRenderer.invoke('validate-mnemonic', a),
  setupWallet:      (a) => ipcRenderer.invoke('setup-wallet', a),

 // Nostr
  nostrCreateProfile: (a) => ipcRenderer.invoke('nostr-create-profile', a),
  nostrImportNsec:    (a) => ipcRenderer.invoke('nostr-import-nsec', a),
  nostrSkip:          () => ipcRenderer.invoke('nostr-skip'),
  nostrGetProfile:    () => ipcRenderer.invoke('nostr-get-profile'),
  nostrListProfiles:  () => ipcRenderer.invoke('nostr-list-profiles'),
  nostrSetActiveProfile: (a) => ipcRenderer.invoke('nostr-set-active-profile', a),
  nostrRemoveProfileById: (a) => ipcRenderer.invoke('nostr-remove-profile-by-id', a),
  nostrRemoveProfile: () => ipcRenderer.invoke('nostr-remove-profile'),
  nostrListPermissions: () => ipcRenderer.invoke('nostr-list-permissions'),
  nostrClearPermissions: () => ipcRenderer.invoke('nostr-clear-permissions'),
  nostrRemovePermission: (a) =>
    ipcRenderer.invoke('nostr-remove-permission', a),
  nostrGetRelays:     () => ipcRenderer.invoke('nostr-get-relays'),
  nostrSignEvent:     (a) => ipcRenderer.invoke('nostr-sign-event', a),
  nostrGetPubkey:     () => ipcRenderer.invoke('nostr-get-pubkey'),

  // LNURL / Lightning Address
  lnurlIsLightningAddress: (a) => ipcRenderer.invoke('lnurl-is-lightning-address', a),
  lnurlFetchPayParams:    (a) => ipcRenderer.invoke('lnurl-fetch-pay-params', a),
  lnurlRequestInvoice:    (a) => ipcRenderer.invoke('lnurl-request-invoice', a),

  // NWC Lightning
  nwcConnect:     (a) => ipcRenderer.invoke('nwc-connect', a),
  nwcDisconnect:  () => ipcRenderer.invoke('nwc-disconnect'),
  nwcIsConnected: () => ipcRenderer.invoke('nwc-is-connected'),
  nwcGetBalance:  () => ipcRenderer.invoke('nwc-get-balance'),
  nwcPayInvoice:  (a) => ipcRenderer.invoke('nwc-pay-invoice', a),
  nwcMakeInvoice: (a) => ipcRenderer.invoke('nwc-make-invoice', a),
  decodeInvoice:  (a) => ipcRenderer.invoke('decode-invoice', a),

  // Favorites
  getFavorites:        () => ipcRenderer.invoke('get-favorites'),
  addFavorite:         (a) => ipcRenderer.invoke('add-favorite', a),
  removeFavorite:      (a) => ipcRenderer.invoke('remove-favorite', a),
  renameFavorite:      (a) => ipcRenderer.invoke('rename-favorite', a),
  moveFavorite:        (a) => ipcRenderer.invoke('move-favorite', a),
  importFavoritesHtml: (a) => ipcRenderer.invoke('import-favorites-html', a),
  exportFavoritesHtml: () => ipcRenderer.invoke('export-favorites-html'),

  // Cashu
  cashuGetBalance: () => ipcRenderer.invoke('cashu-get-balance'),
  cashuListMints:  () => ipcRenderer.invoke('cashu-list-mints'),
  cashuAddMint:    (a) => ipcRenderer.invoke('cashu-add-mint', a),
  cashuRemoveMint:     (a) => ipcRenderer.invoke('cashu-remove-mint', a),
  cashuMintTokens:     (a) => ipcRenderer.invoke('cashu-mint-tokens', a),
  cashuCheckMintQuote: (a) => ipcRenderer.invoke('cashu-check-mint-quote', a),
  cashuReceive:        (a) => ipcRenderer.invoke('cashu-receive', a),

  // Updates
  getAppVersion:    () => ipcRenderer.invoke('get-app-version'),
  checkForUpdates:  () => ipcRenderer.invoke('check-for-updates'),
  openReleasesPage: () => ipcRenderer.invoke('open-releases-page'),
  cancelDownload: (a) => ipcRenderer.invoke('download-cancel', a),
  openDownload: (a) => ipcRenderer.invoke('download-open', a),
  showDownloadInFolder: (a) => ipcRenderer.invoke('download-show-folder', a),
  showAddressSuggestions: (a) => ipcRenderer.invoke('address-suggestions-show', a),
  hideAddressSuggestions: () => ipcRenderer.invoke('address-suggestions-hide'),
  showBookmarkContextMenu: (a) => ipcRenderer.invoke('show-bookmark-context-menu', a),
  showBookmarkFolderPopup: (a) => ipcRenderer.invoke('show-bookmark-folder-popup', a),
  hideBookmarkFolderPopup: () => ipcRenderer.invoke('hide-bookmark-folder-popup'),
  showBookmarkFolderPopup: (a) => ipcRenderer.invoke('show-bookmark-folder-popup', a),
  hideBookmarkFolderPopup: () => ipcRenderer.invoke('hide-bookmark-folder-popup'),

  // Data management
  resetBrowser: () => ipcRenderer.invoke('reset-browser'),
  getHistory:   (a) => ipcRenderer.invoke('get-history', a),
  clearHistory: () => ipcRenderer.invoke('clear-history'),
  clearCookies: () => ipcRenderer.invoke('clear-cookies'),
  clearCache:   () => ipcRenderer.invoke('clear-cache'),
  openDevTools: () => ipcRenderer.invoke('open-devtools'),

  // Event subscriptions (allowlist prevents arbitrary IPC exposure)
  on: (channel, cb) => {
    const allowed = [
      'tab-updated', 'blocked-count', 'payment-detected', 'app-ready',
      'tab-switched', 'page-features', 'v4v-detected', 'blocklist-ready',
      'open-new-tab', 'tab-ready', 'popup-blocked',
      'download-started', 'download-updated', 'download-done',
      'address-suggestion-picked',
      'bookmark-open-new-tab',
      'bookmark-rename',
      'bookmark-delete',
      'bookmark-new-folder',
      'bookmark-new-folder-request',
      'bookmark-create-folder-request',
      'ua-mode-updated',
      'bookmark-folder-picked',
    ]
    if (allowed.includes(channel)) ipcRenderer.on(channel, (_, data) => {
      if (channel === 'bookmark-create-folder-request') {
        console.log('[DEBUG][preload] event received:', channel, data)
      }
      cb(data)
    })
  },
  off: (channel, cb) => ipcRenderer.removeListener(channel, cb),
})
