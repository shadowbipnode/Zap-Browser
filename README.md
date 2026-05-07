# ⚡ Zap Browser

> The first Bitcoin-native browser with integrated Lightning wallet, Cashu ecash, Liquid and native Nostr identity — privacy-first by design.

[![License: MIT](https://img.shields.io/badge/License-MIT-orange.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Linux-blue)](https://github.com/shadowbipnode/Zap-Browser)
[![Built with Electron](https://img.shields.io/badge/built%20with-Electron%2030-47848F)](https://electronjs.org)
[![Nostr](https://img.shields.io/badge/Nostr-NIP--07%20%7C%20NIP--47-purple)](https://nostr.com)
[![Bitcoin](https://img.shields.io/badge/Bitcoin-Lightning%20%7C%20Cashu%20%7C%20Liquid-F7931A)](https://bitcoin.org)

Zap Browser is an open-source desktop browser that unifies a full Chromium browsing engine with a native Bitcoin stack. One 24-word BIP39 seed derives your Lightning-compatible Nostr keypair, your Liquid wallet, and your Cashu ecash store. Privacy hardening — 106,000+ domain blocklist, cosmetic ad filtering, WebRTC prevention, User-Agent rotation — is on by default and requires no extensions.

---

## Why Zap Browser

| Feature | Zap Browser | Brave | Firefox | Chrome |
|---------|-------------|-------|---------|--------|
| Native Lightning wallet (NWC) | ✅ | ❌ | ❌ | ❌ |
| Native Cashu ecash | ✅ | ❌ | ❌ | ❌ |
| Native Nostr NIP-07 signer | ✅ | ❌ | ❌ | ❌ |
| Passwordless Nostr login | ✅ | ❌ | ❌ | ❌ |
| Value4Value micropayments | ✅ | ❌ | ❌ | ❌ |
| Ad block 106k+ domains | ✅ | ✅ | Extension | Extension |
| Cosmetic ad filtering 12k rules | ✅ | ✅ | Extension | Extension |
| Native WebRTC block | ✅ | Partial | Extension | Extension |
| Private key encrypted at rest | ✅ | ✅ | ✅ | ❌ |
| Bookmarks bar + HTML import | ✅ | ✅ | ✅ | ✅ |
| Clickable history | ✅ | ✅ | ✅ | ✅ |
| No account required | ✅ | ✅ | ✅ | ❌ |
| Fully open source | ✅ | Partial | ✅ | ❌ |
| No proprietary token | ✅ | ❌ BAT | ✅ | ✅ |

---

## Features

### Privacy & Security

- **106,000+ domain blocklist** — EasyList + EasyPrivacy + uBlock Origins, parsed and applied at the network layer. Updated automatically every 24 hours. No extension required.
- **12,000+ cosmetic CSS rules** — hide ad containers even when the domain is not in the blocklist.
- **WebRTC IP leak prevention** — disabled at both JS override and Electron permission-handler level. Verified no-leak on browserleaks.com.
- **User-Agent rotation** — randomised every session from a pool of real Chrome, Firefox and Safari strings across Linux, Windows and macOS.
- **Permissions blocked by default** — camera, microphone, geolocation, push notifications.
- **Tracking headers stripped** — `X-Forwarded-For`, `Via`, `From` removed from every outgoing request.
- **Service Worker cache cleared on startup** — prevents fingerprinting via stale cached assets.
- **No telemetry, no crash reporting, no cloud sync** — SQLite local only.
- **SSL certificates** — standard Chromium validation. Self-signed certs are not silently accepted.

### Key storage

The Nostr private key and BIP39 seed are **encrypted at rest** using AES-256-GCM. The encryption key is stored in the OS keychain (libsecret on Linux, Keychain on macOS) and never written to disk in plaintext. The private key never leaves the Electron main process and is never transmitted over the network.

### Lightning (NWC)

Connect any LND or CLN node via a `nostr+walletconnect://` connection string. Compatible with Alby, Zeus, LNbits, Blink, Coinos. Communication runs over a real WebSocket to the configured Nostr relay with NIP-47 ECDH encryption. Pay invoices, create invoices, check balance, disconnect — all from inside the browser.

### Cashu Ecash

Chaumian ecash wallet powered by cashu-ts. Mint tokens directly from a Lightning invoice. Multi-mint support. Receive tokens from other wallets. No blockchain, no public addresses, no transaction graph. The mint cannot link sends to receives.

### Nostr

`window.nostr` injected into every page (NIP-07). Automatic login on Primal, Damus, Snort, Stacker News and any NIP-07 compatible site. Keypair derived deterministically from BIP39 seed via NIP-06. NIP-04 encrypted DMs supported. Visual indicator in toolbar when the current site supports Nostr login. nsec importable at any time from Settings. The browser only signs locally — it never publishes events to relays on its own.

### Value4Value

Detects `<meta name="lightning">` tags. One-click boost payments to creators. Configurable auto-pay (sats per minute while reading).

### Bookmarks & History

Bookmarks bar below the address bar with overflow dropdown. Import bookmarks from any browser via HTML export (Chrome/Firefox/Edge/Safari). Clickable browsing history grouped by day. Toggle bookmarks bar from Settings.

---

## Security notes

The following issues were addressed in v0.3.4 following community feedback:

| Issue | Status |
|-------|--------|
| SSL certificate bypass (accepted any cert including MitM) | **Fixed** — standard Chromium validation |
| `confirm()` forced to return `true` (broke legitimate dialogs) | **Fixed** — browser dialogs work normally |
| Private key stored in plaintext in SQLite | **Fixed** — AES-256-GCM + OS keychain |
| BIP39 seed stored in plaintext in SQLite | **Fixed** — AES-256-GCM + OS keychain |
| Duplicate IPC handler registration | **Fixed** |
| NIP-04 encrypt/decrypt using raw stored bytes instead of decrypted key | **Fixed** |
| No input validation on sensitive IPC channels | **Fixed** — type and format checks added |
| Debug `console.log` with internal data in production build | **Fixed** |

Remaining known limitations (tracked in roadmap):

- JS dialogs (`alert`, `confirm`, `prompt`) are currently suppressed browser-wide. A proper per-site permission system is planned for v0.4.
- Seed encryption uses the OS keychain; on systems without libsecret the fallback is an in-process key (not persisted). Full keychain support across distros is in progress.

---

## Installation

**Debian / Ubuntu**
```bash
sudo dpkg -i zap-browser-0.3.4.deb
```

**RPM (Rocky Linux 9 / Fedora / RHEL)**
```bash
sudo rpm -Uvh --force zap-browser-0.3.4.rpm
```

**AppImage (any Linux)**
```bash
chmod +x zap-browser-0.3.4.AppImage && ./zap-browser-0.3.4.AppImage
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

Open Alby, Zeus, or LNbits, go to Connections → NWC → Add new, copy the `nostr+walletconnect://` string, then paste it in Zap Browser → Wallet → NWC → Connect.

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
│   ├── cashu.js        — Cashu ecash wallet (cashu-ts)
│   ├── keychain.js     — AES-256-GCM encryption + OS keychain
│   ├── blocklist.js    — EasyList/uBlock parser, 106k domain + 12k cosmetic
│   ├── doh.js          — DNS over HTTPS
│   └── value4value.js  — V4V micropayment detection
├── preload/
│   ├── shell.js        — contextBridge: React ↔ main
│   └── webview.js      — window.nostr NIP-07 injection + WebRTC override
└── renderer/
    ├── pages/
    │   ├── BrowserPage.tsx       — shell: toolbar, tabs, bookmarks bar, panels
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
| Ecash | cashu-ts (Cashu protocol) |
| Storage | better-sqlite3 (local, no cloud) |
| Key encryption | AES-256-GCM + libsecret (OS keychain) |
| Ad block | EasyList + EasyPrivacy + uBlock Origins |
| Crypto | @noble/hashes (audited) |

---

## Roadmap

| Version | Focus |
|---------|-------|
| v0.3.4 (current) | NWC Lightning ✅, Cashu mint+receive ✅, key encryption at rest ✅, security fixes ✅ |
| v0.4 | L-BTC via libwally, QR codes, LNURL-pay/auth, real DoH, per-site JS dialog permissions |
| v0.5 | Canvas fingerprint randomization, encrypted history, proxy HTTP/SOCKS |
| v0.6 | Windows build, optional Tor, Nostr DMs in-browser |
| v0.7 | Chrome extension API subset, themes, Nostr bookmark sync |
| v1.0 | Public release, signed builds, auto-update |

---

## Feedback & Contributing

**This is an early beta — your feedback matters.**

- 🐛 **Found a bug?** [Open an issue](https://github.com/shadowbipnode/Zap-Browser/issues/new?template=bug_report.md)
- 💡 **Have an idea?** [Start a discussion](https://github.com/shadowbipnode/Zap-Browser/discussions)
- ⭐ **Like the project?** Star the repo — it helps visibility
- 🔧 **Want to contribute?** Priority areas: L-BTC libwally FFI, real DoH, canvas fingerprinting, LNURL flows, QR codes, Tor bundle, Windows build

*This is genuinely early — some things are rough. I'd rather ship and learn than wait for perfection.*

---

## Security

The BIP39 seed and Nostr private key are encrypted at rest with AES-256-GCM. The encryption key lives in the OS keychain and is never written to disk. Neither the seed nor the private key is ever transmitted over the network. The SQLite database is local — no cloud sync, no telemetry, no crash reporting. The browser never publishes events to Nostr relays; it only signs locally on request from web pages. To report a vulnerability: open a private issue on GitHub.

---

## License

MIT — Free and Open Source. See [LICENSE](LICENSE).

*Not your keys, not your coins. Not your browser, not your privacy.*

**⚡ Built with Bitcoin. Powered by Nostr. Free forever.**
