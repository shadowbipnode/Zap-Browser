'use strict'

const { contextBridge, ipcRenderer } = require('electron')

// Prevent WebRTC from leaking the real IP address by removing ICE servers.
// This means WebRTC still works (e.g. for video calls) but won't reveal the
// user's IP to arbitrary third-party STUN servers.
const OrigRTC = window.RTCPeerConnection || window.webkitRTCPeerConnection
if (OrigRTC) {
  const PrivateRTC = function (config) {
    if (config && config.iceServers) config.iceServers = []
    return new OrigRTC(config)
  }
  PrivateRTC.prototype = OrigRTC.prototype
  window.RTCPeerConnection = PrivateRTC
  if (window.webkitRTCPeerConnection) window.webkitRTCPeerConnection = PrivateRTC
}

// Allow pages to open links in a new tab via middle-click (handled in main)
contextBridge.exposeInMainWorld('__zapOpenNewTab', (url) => {
  ipcRenderer.invoke('open-in-new-tab', { url })
})

// Expose window.nostr (NIP-07) so Nostr web apps can request signatures
// without ever seeing the private key.
contextBridge.exposeInMainWorld('nostr', {
  getPublicKey: ()             => ipcRenderer.invoke('nostr-get-pubkey-nip07'),
  signEvent:    (event)        => ipcRenderer.invoke('nostr-sign-event-nip07', { event }),
  getRelays:    ()             => ipcRenderer.invoke('nostr-get-relays-nip07'),
  nip04: {
    encrypt: (pubkey, text) => ipcRenderer.invoke('nostr-nip04-encrypt', { pubkey, text }),
    decrypt: (pubkey, text) => ipcRenderer.invoke('nostr-nip04-decrypt', { pubkey, text }),
  },
})
