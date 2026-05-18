# ⚡ Zap Browser

> A privacy-focused browser for Bitcoin, Lightning and Nostr workflows.

![Platform](https://img.shields.io/badge/platform-Linux%20%7C%20Windows-blue)
![Status](https://img.shields.io/badge/status-beta-orange)
![License](https://img.shields.io/badge/license-MIT-green)
![Bitcoin](https://img.shields.io/badge/Bitcoin-Lightning%20%7C%20Cashu-F7931A)
![Nostr](https://img.shields.io/badge/Nostr-NIP--07-purple)

Zap Browser is an experimental open-source browser that combines Chromium browsing with native Bitcoin, Lightning and Nostr tooling.

Instead of relying on extensions, Zap integrates Lightning via Nostr Wallet Connect (NWC), native NIP-07 identity support, Cashu ecash, popup and tracker protection, local-first encrypted storage and built-in privacy hardening.

Everything runs locally.

No accounts.
No telemetry.
No cloud sync.

---

# Current Status

Zap Browser is currently in active beta.

The project is focused on:

* privacy-first browsing
* Lightning workflows
* Nostr identity integration
* local-first security
* reducing extension dependency

The browser is already usable for daily testing, but security hardening and architecture improvements are still ongoing.

This is not production-ready software for large funds.

---

# Why Zap Browser

Most browsers treat Bitcoin, Lightning and Nostr as external add-ons.

Zap Browser tries a different approach:

* Lightning is integrated directly into the browser
* Nostr identity exists natively
* popup and tracker protection is built-in
* permissions are handled locally
* privacy protections do not require extensions
* all sensitive data stays on-device

The goal is building a sovereign operational browser instead of another extension-heavy Chromium fork.

---

# Core Features

## ⚡ Lightning (NWC)

Connect any Lightning node using Nostr Wallet Connect.

Compatible with:

* Alby
* Zeus
* LNbits
* Blink
* Coinos

Features:

* Pay invoices
* Create invoices
* Lightning Address support
* Balance checks
* Encrypted NIP-47 communication

---

## 🟣 Native Nostr Identity

Zap Browser injects native `window.nostr` support directly into pages.

Features:

* NIP-07 support
* Persistent permissions
* Per-site trust controls
* Local-only signing
* NIP-06 deterministic key derivation
* nsec import/replacement
* Visual trust indicators

The browser never publishes events automatically.

---

## 🪙 Cashu Ecash

Integrated Chaumian ecash wallet powered by Cashu.

Features:

* Multi-mint support
* Token receive/send
* Mint directly from Lightning
* Local wallet storage
* No blockchain tracking

---

## 🛡️ Privacy Protections

Built-in protections enabled by default:

* 106k+ blocked domains
* Cosmetic filtering
* Popup/interstitial blocking
* WebRTC leak protection
* Tracking header stripping
* User-Agent rotation
* Permissions denied by default
* Local-only storage
* No telemetry

No extensions required.

---

## 🎨 Themes

Zap Browser currently includes:

* Obsidian
* Graphite
* Midnight

Themes can be changed instantly from Settings.

---

## 🔄 Built-in Update Checker

The browser can detect new releases directly from GitHub and notify users when updates are available.

---

# Security Model

Zap Browser handles real money and private keys.

Because of this:

* sensitive data is encrypted at rest
* keys stay local
* Nostr signing happens locally
* no cloud sync exists
* IPC hardening is ongoing
* permission systems are being expanded continuously

Current encryption:

* AES-256-GCM
* OS keychain integration (libsecret / Keychain)

This project is still beta software.
Do not store life-changing funds inside the browser.

---

# Installation

## Linux AppImage

```bash
chmod +x Zap-Browser.AppImage
./Zap-Browser.AppImage
```

## Debian / Ubuntu

```bash
sudo dpkg -i zap-browser.deb
```

## Fedora / Rocky / RHEL

```bash
sudo rpm -Uvh zap-browser.rpm
```

## Windows

Download:

* installer `.exe`
* portable `.zip`

from the GitHub Releases page.

---

# Build From Source

```bash
git clone https://github.com/shadowbipnode/Zap-Browser.git
cd Zap-Browser

npm install

./node_modules/.bin/electron-rebuild -f -w better-sqlite3

npm start
```

---

# Quick Start

## Connect a Lightning Node

1. Open Alby / Zeus / LNbits
2. Create an NWC connection
3. Copy the `nostr+walletconnect://` string
4. Open Wallet → NWC inside Zap Browser
5. Paste connection string

Done.

---

# Roadmap

## v0.3.7-beta

* IPC hardening
* Wallet confirmation UX
* SECURITY.md
* Better popup protections
* README cleanup

## v0.4

* LNURL-pay/auth
* QR code support
* Real DoH
* Better site permissions

## v0.5

* Encrypted history
* Fingerprinting protections
* Ephemeral/private tabs
* SOCKS/HTTP proxy support

## v0.6

* Optional Tor mode
* Hardware wallet research
* Local relay experiments

---

# Contributing

Contributions, testing and security feedback are welcome.

Priority areas:

* privacy protections
* Electron hardening
* Lightning UX
* LNURL flows
* security review
* anti-fingerprinting
* wallet isolation

---

# Security

A dedicated `SECURITY.md` policy is planned.

Until then:

* avoid storing large funds
* treat the browser as beta software
* report vulnerabilities responsibly

---

# License

MIT

---

> Not your browser, not your privacy.

