# ⚡ Zap Browser

> A privacy-focused browser for Lightning, Cashu and Nostr workflows.

![Platform](https://img.shields.io/badge/platform-Linux%20%7C%20Windows-blue)
![Status](https://img.shields.io/badge/status-beta-orange)
![License](https://img.shields.io/badge/license-MIT-green)
![Lightning](https://img.shields.io/badge/Lightning-NWC%20%7C%20LNURL-F7931A)
![Cashu](https://img.shields.io/badge/Cashu-ecash-orange)
![Nostr](https://img.shields.io/badge/Nostr-NIP--07-purple)

Zap Browser is an experimental open-source desktop browser focused on privacy, Lightning payments, Cashu ecash and native Nostr identity.

Instead of relying on browser extensions, Zap integrates Lightning, Cashu and Nostr directly into the browsing experience while keeping everything local-first and privacy-oriented.

The browser includes native Nostr Wallet Connect support, NIP-07 signing, payment protocol detection, bookmark management, download management and built-in browser privacy protections without requiring third-party extensions.

Everything runs locally.

No accounts.  
No telemetry.  
No cloud sync.

---

# Current Status

Zap Browser is currently in active beta.

The browser is already usable for daily testing and experimentation, but it is still early-stage software and should not yet be considered production-ready for large funds or critical operational environments.

The current development focus is:

- Lightning UX
- Nostr identity integration
- browser privacy protections
- local-first architecture
- removing dependency on extensions
- browser-grade desktop UX

---

# What's New in v0.4.0-beta

Zap Browser v0.4.0-beta is focused on wallet/payment UX, bookmarks, downloads and privacy architecture improvements.

## Added

### Native payment protocol handling

Zap Browser can now detect and route:

- `lightning:`
- `lnurl:`
- `cashu:`
- `liquid:`
- `l-btc:`

directly into the browser payment flow.

### Lightning improvements

- Lightning invoice detection from address bar
- native Lightning payment popup flow
- LNURL detection flow
- better NWC integration handling

### Downloads Manager MVP

- Downloads side panel
- live progress tracking
- cancel active downloads
- completed/cancelled states
- open downloaded file
- show downloaded file in folder

### Bookmarks overhaul

- redesigned Favorites panel
- collapsible bookmark folders
- folder-based saving
- move bookmarks/folders
- rename bookmarks/folders
- recursive folder delete handling
- bookmark search
- HTML bookmark import support

### NIP-07 Permissions Center

- persistent Nostr permissions
- per-site revoke
- clear all permissions
- local signer visibility
- improved NIP-07 compatibility
- safer permission handling

### Privacy improvements

- Balanced Shields baseline
- reduced aggressive DOM manipulation
- reduced layout breakage
- safer overlay handling
- improved BrowserView compatibility

---

# Why Zap Browser

Most browsers treat Lightning, Cashu and Nostr as external add-ons.

Zap Browser tries a different approach:

- Lightning is integrated directly into the browser
- Nostr identity exists natively
- Cashu ecash is built in
- privacy protections are enabled by default
- permissions are handled locally
- sensitive data stays on-device

The goal is building a sovereign browser for Bitcoin, Lightning, Cashu and Nostr workflows instead of another extension-heavy Chromium fork.

---

# Core Features

## ⚡ Lightning / NWC

Connect a Lightning wallet or node using Nostr Wallet Connect.

Features:

- Pay invoices
- Create invoices
- Lightning invoice detection
- LNURL detection
- balance checks
- encrypted NIP-47 communication
- native payment popup flow

Compatible with wallets and tools supporting NWC.

---

## 🔗 LNURL

Zap Browser detects LNURL-style payment requests directly inside the browser.

Current v0.4 behavior:

- LNURL detection
- LNURL payment routing
- payment popup integration

Full LNURL-pay/auth flows are planned for future releases.

---

## 🥜 Cashu Ecash

Integrated Chaumian ecash support powered by Cashu.

Features:

- Cashu token detection
- token receive/send
- multi-mint support
- local wallet storage

---

## 🟣 Native Nostr Identity

Zap Browser injects native `window.nostr` support directly into pages.

Features:

- NIP-07 support
- persistent permissions
- per-site trust controls
- local-only signing
- session allow/deny
- permanent allow/deny
- relay overview
- nsec import/replacement
- local signer identity display

Zap Browser acts as a local signer.

The browser does not publish profile metadata automatically and does not modify remote Nostr profiles.

---

## ⭐ Bookmarks

Zap Browser includes a browser-style bookmark system.

Features:

- Favorites panel
- bookmarks bar
- folders
- folder-based bookmark saving
- rename bookmarks/folders
- move bookmarks/folders
- recursive delete support
- collapsible folders
- bookmark search
- import bookmarks from HTML

---

## ⬇ Downloads

Zap Browser includes a native Downloads MVP.

Features:

- downloads side panel
- live progress
- completed/cancelled states
- cancel active downloads
- open downloaded file
- show file in folder

Persistent download history is planned for future releases.

---

## 🛡️ Privacy Protections

Built-in protections include:

- network-level blocklist
- cosmetic filtering
- popup blocking
- conservative overlay handling
- sticky ad suppression
- WebRTC leak protection
- tracking header stripping
- User-Agent rotation
- local-only storage
- no telemetry

Zap Browser v0.4 introduces a Balanced Shields baseline focused on compatibility and reduced site breakage.

---

## 🎨 Themes

Zap Browser currently includes multiple built-in themes, including:

- Obsidian
- Graphite
- Midnight
- Neon Glass
- Sovereign Terminal
- Minimal Dark

Themes can be switched instantly from Settings.

---

## 🔄 Built-in Update Checker

Zap Browser can detect new releases directly from GitHub and notify users when updates are available.

The update system is local-only and does not send telemetry or analytics.

---

# Security Model

Zap Browser handles real money and private keys.

Because of this:

- private keys stay local
- Nostr signing happens locally
- NWC secrets remain encrypted locally
- no cloud sync exists
- no telemetry exists
- sensitive IPC channels are validated
- permissions are explicit
- Lightning payments require confirmation

Current protections include:

- AES-256-GCM encryption
- OS keychain integration
- local signer isolation
- blocked metadata signing
- strict NIP-07 permission flow

Zap Browser is still beta software.

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

Download either:

- installer `.exe`
- portable `.zip`

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

## Connect a Lightning Wallet

1. Open a wallet supporting Nostr Wallet Connect.
2. Create an NWC connection.
3. Copy the `nostr+walletconnect://` string.
4. Open Wallet inside Zap Browser.
5. Paste the connection string.
6. Start using Lightning directly from the browser.

---

# Roadmap

## v0.5 — Native Browser UX & Windowing

Planned focus:

- native Electron menus
- native child windows
- native bookmark popup
- native downloads popup/history
- native permission dialogs
- native autocomplete architecture
- removal of unstable React overlays above BrowserView

## v0.6 — Browser Core Abstraction

Planned focus:

- browser engine abstraction
- deeper tab/view architecture cleanup
- future portability research
- possible Tauri migration evaluation

---

# Contributing

Contributions, testing and security feedback are welcome.

Priority areas:

- privacy protections
- Electron hardening
- Lightning UX
- LNURL flows
- Cashu UX
- NIP-07 compatibility
- native browser UI architecture
- anti-fingerprinting research

---

# Security

Zap Browser is beta software.

Please treat it accordingly.

Security principles:

- private keys stay local
- NWC secrets are encrypted locally
- no automatic Nostr metadata publishing
- no telemetry
- explicit permission model
- local-first architecture

Please report vulnerabilities responsibly.

---

# License

MIT

---

> Not your browser, not your privacy.
