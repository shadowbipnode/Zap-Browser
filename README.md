# ⚡ Zap Browser

> A privacy-focused sovereign browser with native Lightning, Cashu and Nostr workflows.

[![Sponsor](https://img.shields.io/badge/Sponsor-GitHub%20Sponsors-pink?logo=github-sponsors)](https://github.com/sponsors/shadowbipnode)

![Platform](https://img.shields.io/badge/platform-Linux%20%7C%20Windows-blue)
![Status](https://img.shields.io/badge/status-beta-orange)
![License](https://img.shields.io/badge/license-MIT-green)
![Lightning](https://img.shields.io/badge/Lightning-NWC%20%7C%20LNURL-F7931A)
![Cashu](https://img.shields.io/badge/Cashu-ecash-orange)
![Nostr](https://img.shields.io/badge/Nostr-NIP--07-purple)
![Privacy](https://img.shields.io/badge/privacy-Tor%20%7C%20Private%20Tabs%20%7C%20Anti--Fingerprinting-7c3aed)

Zap Browser is an open-source desktop browser focused on privacy, Lightning payments, Cashu ecash and native Nostr identity.

It is designed for users who want a local-first browser where Bitcoin, Lightning, Nostr and privacy workflows are built in instead of bolted on through third-party extensions.

Everything runs locally.

No accounts.  
No telemetry.  
No cloud sync.

---

# Current Status

Zap Browser is currently in active beta.

It is usable for testing and daily experimentation, but it should still be treated as early-stage software. Do not store life-changing funds or highly sensitive operational secrets in beta builds.

The current focus is:

- native browser UX
- privacy hardening
- Tor integration
- anti-fingerprinting protections
- Nostr identity and NIP-07 permissions
- Lightning / NWC payments
- Cashu ecash workflows
- local-first encrypted storage

---

# What's New in v0.5.0-beta

Zap Browser v0.5.0-beta is a major privacy, browser UX and architecture release.

This release moves Zap Browser closer to a real daily-testable privacy browser instead of a simple Electron wrapper.

## Browser UX

- Native multi-tab browser architecture
- Drag-and-drop tab reordering
- Improved tab switching stability
- Reduced unwanted page reloads
- Better loading state handling
- Native address bar autocomplete popup
- Native menus and popup windows replacing fragile React overlays
- Improved page stability on ad-heavy and CMP-heavy websites
- Reduced cookie/CMP flicker during page load

## Privacy

- Ephemeral private tabs
- Isolated private sessions
- No private history persistence
- Private session cache/storage cleanup
- Tor support inside private tabs
- Hardened Tor proxy handling across default and private sessions
- WebRTC leak protection
- User-Agent rotation
- Session-based anti-fingerprinting profiles
- Canvas, WebGL and navigator fingerprint mitigations
- Network-level early blocking for common ad/CMP providers
- Improved popup and overlay blocking

## Nostr

- Multi-profile Nostr identity support
- Active profile switching
- Persistent NIP-07 permission storage
- Per-site allow / deny / revoke controls
- Local signing isolation
- NIP-04 encrypt/decrypt permission flow
- Safer Nostr permission handling

## Bookmarks

- Browser-style bookmarks bar
- Bookmark folders
- Folder-based bookmark saving
- Rename and delete support
- Recursive folder handling
- Bookmark import/export
- Legacy bookmark migration support

## Downloads

- Persistent download history
- Native downloads panel
- Live progress tracking
- Completed/cancelled states
- Open downloaded file
- Show file in folder
- Clear download history

## Portable Security Backend

- Portable mode detection via `.portable`
- Portable profile storage under `zap-data/`
- Passphrase-derived runtime encryption key support
- PBKDF2-SHA256 salt/verifier flow
- Backend APIs for portable setup and unlock
- Foundation for encrypted portable builds

---

# Why Zap Browser

Most browsers treat Lightning, Cashu and Nostr as external add-ons.

Zap Browser takes a different approach:

- Lightning is integrated directly into the browser
- Nostr identity exists natively
- Cashu ecash support is built in
- privacy protections are enabled by default
- permissions are handled locally
- sensitive data stays on-device

The goal is to build a sovereign browser for Bitcoin, Lightning, Cashu, Nostr and privacy workflows.

---

# Core Features

## ⚡ Lightning / NWC

Connect a Lightning wallet or node using Nostr Wallet Connect.

Features:

- Pay invoices
- Create invoices
- Lightning invoice detection
- LNURL detection
- Balance checks
- Encrypted NIP-47 communication
- Native payment popup flow
- Local encrypted NWC secret storage

---

## 🔗 LNURL

Zap Browser detects LNURL-style payment requests directly inside the browser.

Current behavior:

- LNURL detection
- LNURL payment routing
- Payment popup integration
- Lightning Address support

---

## 🥜 Cashu Ecash

Integrated Chaumian ecash support powered by Cashu.

Features:

- Cashu token detection
- Token receive/send
- Multi-mint support
- Local wallet storage

---

## 🟣 Native Nostr Identity

Zap Browser injects native `window.nostr` support directly into pages.

Features:

- NIP-07 support
- Multi-profile identity management
- Active profile switching
- Persistent per-site permissions
- Per-site revoke
- Local-only signing
- Session allow/deny
- Permanent allow/deny
- Local signer visibility
- NIP-04 permission flow

Zap Browser acts as a local signer.

The browser does not publish profile metadata automatically and does not modify remote Nostr profiles.

---

## ⭐ Bookmarks

Zap Browser includes a browser-style bookmark system.

Features:

- Bookmarks bar
- Favorites panel
- Folders
- Folder-based saving
- Rename bookmarks/folders
- Move bookmarks/folders
- Recursive delete support
- Bookmark search
- Import/export support
- Legacy migration support

---

## ⬇ Downloads

Zap Browser includes persistent download management.

Features:

- Downloads panel
- Live progress
- Completed/cancelled states
- Cancel active downloads
- Open downloaded file
- Show file in folder
- Persistent download history
- Clear download history

---

## 🛡️ Privacy Protections

Built-in protections include:

- Network-level blocklist
- Cosmetic filtering
- Early ad/CMP blocking
- Popup blocking
- Overlay blocking
- Sticky ad suppression
- WebRTC leak protection
- Tracking header stripping
- User-Agent rotation
- Session-based fingerprint profiles
- Canvas anti-fingerprinting
- WebGL mitigation
- Navigator property normalization
- Private tabs
- Tor proxy routing
- No telemetry

Zap Browser uses a compatibility-first privacy baseline. The goal is to reduce tracking while keeping websites usable.

---

## 🧅 Tor Support

Zap Browser can route browsing traffic through a local SOCKS Tor proxy.

Current Tor features:

- Toggle Tor routing from the browser UI
- Configurable SOCKS host/port
- Default session Tor routing
- Private tab Tor routing
- Proxy reset when Tor is disabled
- Shared proxy policy across existing tab sessions

Tor must be running locally, usually on:

127.0.0.1:9050

---

## 🕶 Private Tabs

Private tabs use isolated browser sessions.

Private mode behavior:

- Separate Electron session partition
- No private browsing history persistence
- Cache/storage cleanup on close
- Tor routing supported
- Visible private tab indicator
- Private session UI banner

---

## 🧬 Anti-Fingerprinting

Zap Browser includes early anti-fingerprinting protections.

Current protections include:

- Session-based fingerprint profiles
- Platform normalization
- Hardware concurrency spoofing
- Device memory spoofing
- Timezone spoofing
- Language normalization
- WebDriver masking
- Media device reduction
- Canvas mitigation
- WebGL debug renderer mitigation

This is an MVP privacy layer, not a Tor Browser replacement.

---

## 🔐 Portable Mode

Portable mode is designed for USB and offline environments.

When a `.portable` marker exists, Zap Browser stores user data under:

zap-data/

Portable backend support includes:

- Portable profile path
- Passphrase-derived runtime key
- Salt/verifier configuration
- Local encrypted wallet/Nostr/NWC compatibility

Future work will add a dedicated unlock UI, auto-lock and stronger full-profile encryption.

---

## 🎨 Themes

Zap Browser includes multiple built-in themes, including:

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

Security principles:

- Private keys stay local
- Nostr signing happens locally
- NWC secrets remain encrypted locally
- Wallet seed data is encrypted locally
- No cloud sync
- No telemetry
- Explicit permission model
- Lightning payments require confirmation
- Sensitive IPC channels are validated

Current protections include:

- AES-256-GCM encryption
- OS keychain integration
- Runtime key support for portable mode
- Local signer isolation
- NIP-07 permission flow
- Private session isolation

Zap Browser is still beta software.

Do not store life-changing funds inside the browser.

---

# Installation

## Linux AppImage

chmod +x Zap-Browser.AppImage
./Zap-Browser.AppImage

## Debian / Ubuntu

sudo dpkg -i zap-browser.deb

## Fedora / Rocky / RHEL

sudo rpm -Uvh zap-browser.rpm

## Windows

Download either:

- installer `.exe`
- portable `.zip`

from the GitHub Releases page.

---

# Build From Source

git clone https://github.com/shadowbipnode/Zap-Browser.git
cd Zap-Browser

npm install

./node_modules/.bin/electron-rebuild -f -w better-sqlite3

npm start

---

# Quick Start

## Connect a Lightning Wallet

1. Open a wallet supporting Nostr Wallet Connect.
2. Create an NWC connection.
3. Copy the `nostr+walletconnect://` string.
4. Open Wallet inside Zap Browser.
5. Paste the connection string.
6. Start using Lightning directly from the browser.

## Use Nostr

1. Import or create a Nostr identity.
2. Open a NIP-07 compatible website.
3. Approve or deny permission requests.
4. Manage permissions locally from Zap Browser.

## Use Tor

1. Start Tor locally.
2. Enable Tor from Zap Browser.
3. Test with `https://check.torproject.org`.

---

# Roadmap

## v0.6 — Browser Core Hardening

Planned focus:

- deeper BrowserView/session cleanup
- stronger fingerprint profile system
- screen/font normalization
- improved WebGL consistency
- portable unlock UI
- encrypted portable profile UX
- improved Tor diagnostics
- better update/install migration handling

## Future Research

- stronger browser engine abstraction
- optional SQLCipher/full DB encryption
- Argon2id portable KDF
- advanced Cashu wallet flows
- deeper Nostr app compatibility
- improved privacy test reporting

---

# Contributing

Contributions, testing and security feedback are welcome.

Priority areas:

- privacy protections
- Electron hardening
- Tor routing
- anti-fingerprinting research
- Lightning UX
- LNURL flows
- Cashu UX
- NIP-07 compatibility
- native browser UI architecture
- Linux and Windows packaging

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
