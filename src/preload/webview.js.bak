// src/preload/webview.js — NIP-07 reale con dialogo conferma
'use strict'

const { contextBridge, ipcRenderer } = require('electron')

// Blocca WebRTC IP leak — sovrascrive RTCPeerConnection
const OrigRTC = window.RTCPeerConnection || window.webkitRTCPeerConnection
if (OrigRTC) {
  const FakeRTC = function(config) {
    // Rimuovi STUN/TURN servers per prevenire IP leak
    if (config && config.iceServers) config.iceServers = []
    return new OrigRTC(config)
  }
  FakeRTC.prototype = OrigRTC.prototype
  window.RTCPeerConnection = FakeRTC
  if (window.webkitRTCPeerConnection) window.webkitRTCPeerConnection = FakeRTC
}

// Esponi funzione per aprire nuovo tab (usata da auxclick iniettato)
contextBridge.exposeInMainWorld('__zapOpenNewTab', (url) => {
  ipcRenderer.invoke('open-in-new-tab', { url })
})

// Esponi window.nostr ai siti web (NIP-07)
contextBridge.exposeInMainWorld('nostr', {
  getPublicKey: () => ipcRenderer.invoke('nostr-get-pubkey-nip07'),

  signEvent: (event) => ipcRenderer.invoke('nostr-sign-event-nip07', { event }),

  getRelays: () => ipcRenderer.invoke('nostr-get-relays-nip07'),

  nip04: {
    encrypt: (pubkey, text) => ipcRenderer.invoke('nostr-nip04-encrypt', { pubkey, text }),
    decrypt: (pubkey, text) => ipcRenderer.invoke('nostr-nip04-decrypt', { pubkey, text }),
  }
})
