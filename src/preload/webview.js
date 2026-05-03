// src/preload/webview.js
'use strict'
// This preload runs inside each BrowserView (web tab)
// It bridges NIP-07 calls back to main via ipcRenderer

const { ipcRenderer } = require('electron')

// Bridge for NIP-07 calls triggered by injected script
window.__zap_ipc = (method, data) => {
  return ipcRenderer.invoke('nostr-' + method.replace('nostr_',''), data ? { event: data } : undefined)
}

window.__zap_payment = (data) => {
  ipcRenderer.send('payment-from-page', data)
}
