// src/preload/webview.js — NIP-07 reale con dialogo conferma
'use strict'

const { contextBridge, ipcRenderer } = require('electron')

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
