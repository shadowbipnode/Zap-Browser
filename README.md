# ⚡ Zap Browser

> The first Bitcoin-native browser with integrated Lightning wallet, Cashu ecash, Liquid and native Nostr identity — privacy-first by design.

[![License: MIT](https://img.shields.io/badge/License-MIT-orange.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Linux%20%7C%20macOS%20%7C%20Windows-blue)](https://github.com/shadowbipnode/Zap-Browser)
[![Built with Electron](https://img.shields.io/badge/built%20with-Electron%2030-47848F)](https://electronjs.org)
[![Nostr](https://img.shields.io/badge/Nostr-NIP--07%20%7C%20NIP--47-purple)](https://nostr.com)
[![Bitcoin](https://img.shields.io/badge/Bitcoin-Lightning%20%7C%20Cashu%20%7C%20Liquid-F7931A)](https://bitcoin.org)

Zap Browser is an open-source desktop browser that unifies a full Chromium browsing engine with a native Bitcoin stack. One 24-word BIP39 seed derives your Lightning-compatible Nostr keypair, your Liquid wallet, and your Cashu ecash store. Privacy hardening — 106,000+ domain blocklist, WebRTC prevention, User-Agent rotation — is on by default and requires no extensions.

---

## Why Zap Browser

| Feature | Zap Browser | Brave | Firefox | Chrome |
|---------|-------------|-------|---------|--------|
| Native Lightning wallet | ✅ | ❌ | ❌ | ❌ |
| Native Cashu ecash | ✅ | ❌ | ❌ | ❌ |
| Native Nostr NIP-07 signer | ✅ | ❌ | ❌ | ❌ |
| Passwordless Nostr login | ✅ | ❌ | ❌ | ❌ |
| Value4Value micropayments | ✅ | ❌ | ❌ | ❌ |
| Ad block 106k+ domains | ✅ | ✅ | Extension | Extension |
| Native WebRTC block | ✅ | Partial | Extension | Extension |
| No account required | ✅ | ✅ | ✅ | ❌ |
| Fully open source | ✅ | Partial | ✅ | ❌ |
| No proprietary token | ✅ | ❌ BAT | ✅ | ✅ |

---

## Features

**Privacy & Security** — EasyList + EasyPrivacy + uBlock Origins parsed into 106,000+ domain block set, updated automatically every 24 hours. WebRTC disabled at both JS and permission-handler level. User-Agent rotated every session from a pool of real browser strings (Chrome, Firefox, Safari across Linux, Windows, macOS). Tracking headers stripped from every request. Push notifications and popups blocked by default. DNS over HTTPS via Cloudflare.

**Lightning (NWC)** — Connect any LND or CLN node via a `nostr+walletconnect://` connection string. Compatible with Alby, Zeus, Mutiny, Breez, Phoenix. Communication runs over a real WebSocket to the configured Nostr relay with NIP-47 ECDH encryption. Pay invoices, create invoices, check balance — all from inside the browser.

**Cashu Ecash** — Chaumian ecash wallet. The mint cannot link sends to receives. Multi-mint support. Tokens can be created and received offline. No blockchain, no public addresses, no transaction graph.

**Liquid L-BTC** — UI ready for confidential Liquid transactions. BIP39 key derivation in development.

**Nostr** — `window.nostr` injected into every page (NIP-07). Automatic login on Primal, Damus, Snort, Stacker News and any NIP-07 compatible site. Keypair derived deterministically from BIP39 seed via NIP-06. NIP-04 encrypted DMs supported. Visual indicator in toolbar when the current site supports Nostr login. nsec can be imported at any time from Settings. Private key never leaves the Electron main process and the browser never publishes to relays — it only signs locally.

**Value4Value** — Detects `<meta name="lightning">` tags in pages. One-click boost payments to creators. Configurable auto-pay (sats per minute while reading).

---

## Installation

**Debian / Ubuntu**
```bash
sudo dpkg -i zap-browser_0.2.0_amd64.deb
```

**RPM (Rocky Linux 9 / Fedora / RHEL)**
```bash
sudo rpm -i zap-browser-0.2.0.x86_64.rpm
```

**AppImage (any Linux)**
```bash
chmod +x ZapBrowser-0.2.0.AppImage && ./ZapBrowser-0.2.0.AppImage
```

**Build from source**
```bash
git clone https://github.com/shadowbipnode/Zap-Browser.git
cd Zap-Browser
npm install
./node_modules/.bin/electron-rebuild -f -w better-sqlite3
npm start
```

---

## First Launch

The onboarding wizard runs once on first launch. Choose between **Bitcoin + Privacy Mode** (generates or imports a 24-word BIP39 seed, derives Nostr keypair, sets up wallets) or **Standard Browser** (privacy hardening only, no wallet). After confirming your seed backup you optionally create or import a Nostr identity. The browser opens immediately after.

---

## Connect Your Lightning Node

Open Alby (alby.com) or Zeus on your node, go to Connections → Add new, copy the `nostr+walletconnect://` string, then paste it in the Zap Browser Wallet panel under the NWC tab.

---

## Architecture

```
src/
├── main/
│   ├── index.js        — Electron main, window, BrowserView, IPC
│   ├── db.js           — SQLite: wallet, nostr, cashu, history, favorites
│   ├── wallet.js       — BIP39 generation and derivation
│   ├── nostr.js        — NIP-06 keypair, NIP-07 local signer
│   ├── nwc.js          — NWC WebSocket, NIP-47 encrypt/decrypt
│   ├── blocklist.js    — EasyList/uBlock parser, 106k domain engine
│   ├── doh.js          — DNS over HTTPS
│   └── value4value.js  — V4V micropayment detection
├── preload/
│   ├── shell.js        — contextBridge: React ↔ main
│   └── webview.js      — window.nostr NIP-07 injection
└── renderer/
    ├── pages/
    │   ├── BrowserPage.tsx       — shell: toolbar, tabs, panels
    │   └── OnboardingPage.tsx    — first-launch wizard
    ├── components/
    │   ├── browser/              — NewTabPage, FavoritesPanel
    │   ├── wallet/               — WalletPanel (NWC, L-BTC, Cashu)
    │   ├── nostr/                — NostrPanel
    │   └── settings/             — SettingsPanel (EN/IT, history, reset)
    └── styles/globals.css        — design system: dark obsidian + Bitcoin amber
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Browser engine | Chromium via Electron 30 BrowserView |
| UI | React 18 + TypeScript + Vite |
| Seed | bip39 (BIP39 24-word mnemonic) |
| Lightning | NWC WebSocket — NIP-47 |
| Nostr | nostr-tools + native NIP-07 signer |
| Ecash | Cashu protocol |
| Storage | better-sqlite3 (local, no cloud) |
| Ad block | EasyList + EasyPrivacy + uBlock Origins |
| Crypto | @noble/hashes (audited) |

---

## Roadmap

| Version | Focus |
|---------|-------|
| v0.3 (current) | Browser, NWC Lightning, Nostr NIP-07, 106k adblock, V4V, EN/IT |
| v0.4 | Real Cashu-ts wallet, L-BTC via libwally, QR codes, LNURL |
| v0.5 | Real DoH, canvas fingerprint randomization, encrypted history |
| v0.6 | Optional Tor, Nostr DMs in-browser, Nostr feed on new tab |
| v0.7 | Chrome extension API subset, themes, Nostr bookmark sync |
| v1.0 | Public beta, signed builds, auto-update |

---

## Contributing

Priority areas: Cashu-ts real wallet integration, libwally-core FFI for L-BTC, real DoH at Electron level, canvas fingerprinting randomization, LNURL-pay/auth flows, QR code display, Tor binary bundle.

---

## Security

The BIP39 seed is never transmitted over the network. The Nostr private key never leaves the Electron main process. The SQLite database is local — no cloud sync, no telemetry, no crash reporting. The browser never publishes events to Nostr relays; it only signs locally on request from web pages. To report a vulnerability: open a private issue on GitHub.

---

## License

MIT — Free and Open Source. See [LICENSE](LICENSE).

*Not your keys, not your coins. Not your browser, not your privacy.*

**⚡ Built with Bitcoin. Powered by Nostr. Free forever.**

