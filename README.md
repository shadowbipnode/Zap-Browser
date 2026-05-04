# ⚡ Zap Browser

> Il primo browser Bitcoin-nativo con wallet Lightning, Cashu, Liquid e identità Nostr integrata — privacy-first by design.

[![License: MIT](https://img.shields.io/badge/License-MIT-orange.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Linux%20%7C%20macOS%20%7C%20Windows-blue)](https://github.com/shadowbipnode/Zap-Browser)
[![Built with Electron](https://img.shields.io/badge/built%20with-Electron%2030-47848F)](https://electronjs.org)
[![Nostr](https://img.shields.io/badge/Nostr-NIP--07%20%7C%20NIP--47-purple)](https://nostr.com)

---

## Cos'è Zap Browser?

Zap Browser è un browser desktop open-source che unisce:

- **🌐 Browser Chromium completo** — navigazione reale, tab, back/forward, ad blocking
- **⚡ Lightning nativo** — connetti il tuo nodo LND via NWC (Nostr Wallet Connect)
- **🥜 Cashu ecash** — portafoglio ecash Chaumiano, completamente privato e offline
- **🔵 Liquid L-BTC** — transazioni confidenziali sulla rete Liquid
- **🟣 Nostr NIP-07** — accedi a qualsiasi sito Nostr con un click, senza password
- **🛡️ Privacy integrata** — 300.000+ domini bloccati, WebRTC off, UA rotation
- **💜 Value4Value** — micropagamenti automatici ai creator che navighi

**Una seed da 24 parole → wallet Lightning + L-BTC + Cashu + identità Nostr. Le tue chiavi, il tuo browser.**

---

## Perché Zap Browser è diverso

| Feature | Zap Browser | Brave | Firefox | Chrome |
|---------|-------------|-------|---------|--------|
| Lightning wallet nativo | ✅ | ❌ | ❌ | ❌ |
| Cashu ecash nativo | ✅ | ❌ | ❌ | ❌ |
| Nostr NIP-07 nativo | ✅ | ❌ | ❌ | ❌ |
| Login senza password | ✅ NIP-07 | ❌ | ❌ | ❌ |
| Value4Value micropagamenti | ✅ | ❌ | ❌ | ❌ |
| Ad block 300k+ domini | ✅ | ✅ | Ext. | Ext. |
| WebRTC block nativo | ✅ | Parz. | Ext. | Ext. |
| Nessun account richiesto | ✅ | ✅ | ✅ | ❌ |
| Open source completo | ✅ | Parz. | ✅ | ❌ |
| Crypto proprietaria | ❌ | BAT ⚠️ | ❌ | ❌ |

---

## Funzionalità

### 🛡️ Privacy & Sicurezza

- **Ad & Tracker Blocking** — Liste EasyList, EasyPrivacy e uBlock Origins (300.000+ domini) scaricate e aggiornate automaticamente ogni 24h
- **WebRTC Leak Prevention** — blocca perdite IP sia a livello applicativo che con permission handler nativo
- **User-Agent Rotation** — cambia UA ogni sessione tra un pool di browser reali (Firefox, Chrome, Safari su diversi OS)
- **Header stripping** — rimuove `X-Forwarded-For`, `Via`, `From` da ogni richiesta
- **Notifiche bloccate** — nessun sito può inviare notifiche push senza permesso esplicito
- **Popup bloccati** — link aperti nel tab corrente, mai in nuove finestre
- **DNS over HTTPS** — query DNS cifrate via Cloudflare (configurabile)

### ⚡ Lightning (NWC)

- Connetti il tuo nodo LND/CLN via stringa `nostr+walletconnect://`
- Compatibile con **Alby, Zeus, Mutiny, Breez, Phoenix**
- WebSocket reale verso relay Nostr, encrypt/decrypt NIP-47 con ECDH
- Paga invoice direttamente dalla barra degli indirizzi
- Crea invoice per ricevere pagamenti
- Saldo del nodo visibile in tempo reale

### 🥜 Cashu Ecash

- Portafoglio ecash Chaumiano — il mint non può collegare invii e ricezioni
- Supporto multi-mint
- Crea e ricevi token offline
- Completamente privato — nessuna blockchain, nessun indirizzo pubblico

### 🔵 Liquid L-BTC

- Wallet per transazioni confidenziali
- Importi e asset nascosti on-chain
- Derivazione chiavi da seed BIP39 (in sviluppo)

### 🟣 Nostr

- **NIP-07** — `window.nostr` iniettato in ogni pagina, login automatico su Primal, Damus, Snort, Stacker News e qualsiasi sito Nostr
- **NIP-06** — keypair derivato deterministicamente dalla seed BIP39 (`m/44'/1237'/0'/0/0`)
- **NIP-04** — DM cifrati supportati
- **NIP-47** — firmatario NWC integrato
- Indicatore visuale 🟣 NIP-07 in toolbar quando il sito corrente supporta Nostr
- Pubblicazione automatica profilo kind:0 su tutti i relay configurati
- Relay personalizzabile (default: relay.shadowbip.com + relay pubblici)

### 💜 Value4Value

- Riconosce automaticamente meta tag V4V nelle pagine (`<meta name="lightning">`)
- Micropagamenti ai creator con un click (Boost)
- Autopay configurabile (X sats/minuto mentre leggi)
- Il futuro del supporto ai creator senza pubblicità

---

## Screenshot

```
┌────────────────────────────────────────────────────────────────────────────┐
│ ●  ●  ●  ⚡ Zap Browser                                          _ □ ×  │
├───────┬────────────────────────────────────────────────────────────────────┤
│ ⚡ New Tab  │ 🟣 Damus    │ 📰 Stacker News    │ +                         │
├─────────────────────────────────────────────────────────────────────────────┤
│ ← → ↻  🔒 damus.io              🛡️ 2,847  🔌 WebRTC  🎭 UA Auto  🟣 NIP-07 │
│                                                    ⚡ Wallet  🟣  ⭐  ⚙️  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                    │ ⚡ Wallet              │
│           [Contenuto sito web reale]               │ ┌──┬──┬──┐            │
│                                                    │ │NWC│L-BTC│Cashu│      │
│    ╔══════════════════════════════════════╗        │ └──┴──┴──┘            │
│    ║ ⚡ Lightning Invoice Rilevato         ║        │ Saldo Lightning        │
│    ║ 21,000 sats                           ║        │ 847,291 sats          │
│    ║ Stacker News — mancia articolo        ║        │ ● Nodo connesso NWC   │
│    ║              [Paga ⚡]  [✕]           ║        │                       │
│    ╚══════════════════════════════════════╝        │ [↑ Invia] [↓ Invoice] │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Installazione

### Ubuntu 24 / Debian

```bash
# Dipendenze
sudo apt update
sudo apt install -y curl git build-essential

# Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Clone e avvio
git clone https://github.com/shadowbipnode/Zap-Browser.git
cd Zap-Browser
npm install
./node_modules/.bin/electron-rebuild -f -w better-sqlite3
npm start
```

### macOS

```bash
brew install node git
git clone https://github.com/shadowbipnode/Zap-Browser.git
cd Zap-Browser
npm install
npm start
```

### Windows

```powershell
# Installa Node.js 20 da nodejs.org
git clone https://github.com/shadowbipnode/Zap-Browser.git
cd Zap-Browser
npm install
npm start
```

---

## Primo Avvio — Onboarding

```
1. Welcome
   ├── Modalità Bitcoin + Privacy  ← consigliata
   └── Browser Standard

2. Seed (solo Bitcoin mode)
   ├── Genera 24 parole BIP39  ← nuova identità
   └── Importa seed esistente

3. Conferma Backup
   └── Conferma di aver salvato la seed offline

4. Nostr Identity
   ├── Crea da seed (NIP-06)  ← una seed, un'identità
   ├── Importa nsec esistente
   └── Salta

5. Nome utente Nostr

6. Pronto → browser avviato
```

**Derivazione dalla seed:**
- `HMAC-SHA256(seed, "Nostr seed")` → keypair Nostr
- `m/84'/1776'/0'` → L-BTC wallet (Liquid BIP84)
- Prove Cashu cifrate in SQLite locale

---

## Connettere il Nodo Lightning

1. Apri **Alby** (alby.com) o **Zeus** sul tuo nodo
2. Vai in **Connections → Aggiungi nuova connessione**
3. Copia la stringa `nostr+walletconnect://...`
4. In Zap Browser → pannello **⚡ Wallet** → tab **NWC**
5. Incolla la stringa → **Connetti**

Il browser ora può pagare invoice Lightning direttamente, creare invoice per ricevere, e vedere il saldo del tuo nodo.

---

## Architettura

```
zap-browser/
├── src/
│   ├── main/                    # Processo principale Electron (Node.js)
│   │   ├── index.js             # Entry point, gestione finestre e IPC
│   │   ├── db.js                # SQLite locale (wallet, nostr, cashu, preferiti)
│   │   ├── wallet.js            # BIP39 seed generation e derivazione
│   │   ├── nostr.js             # NIP-06 keypair, NIP-07 signer, pubblicazione relay
│   │   ├── nwc.js               # NWC WebSocket reale (NIP-47 encrypt/decrypt)
│   │   ├── blocklist.js         # EasyList/uBlock parser e motore di blocco
│   │   ├── doh.js               # DNS over HTTPS
│   │   └── value4value.js       # Micropagamenti V4V ai creator
│   ├── preload/
│   │   ├── shell.js             # Bridge React ↔ main (contextBridge)
│   │   └── webview.js           # NIP-07 window.nostr injected in ogni pagina
│   └── renderer/                # React + TypeScript (UI)
│       ├── pages/
│       │   ├── BrowserPage.tsx  # Shell browser (toolbar, tab, pannelli)
│       │   └── OnboardingPage.tsx # Wizard primo avvio
│       ├── components/
│       │   ├── browser/         # TabBar, NewTabPage, FavoritesPanel
│       │   ├── wallet/          # WalletPanel (NWC, L-BTC, Cashu)
│       │   ├── nostr/           # NostrPanel
│       │   └── settings/        # SettingsPanel completo
│       └── styles/
│           └── globals.css      # Design system (dark obsidian + Bitcoin amber)
└── package.json
```

---

## Stack Tecnologico

| Layer | Tecnologia | Motivo |
|-------|-----------|--------|
| Browser engine | **Chromium** via Electron BrowserView | Standard industry, massima compatibilità |
| App shell | **Electron 30** | Cross-platform nativo |
| UI | **React 18 + TypeScript** | Iterazione rapida |
| Seed/Keys | **bip39** | Standard BIP39 24 parole |
| Lightning | **NWC WebSocket** (NIP-47) | Connetti il tuo nodo, nessuna custodia |
| Nostr | **nostr-tools** + signer nativo | NIP-07 senza estensioni |
| Ecash | **Cashu protocol** | Privacy massima, offline-capable |
| Storage | **better-sqlite3** | Veloce, locale, no cloud |
| Ad block | **EasyList + uBlock** | 300k+ domini, aggiornamento auto |
| Crypto | **@noble/hashes** | Implementazioni auditate |

---

## Privacy — Come Funziona

### Ad Blocking
Le liste vengono scaricate da EasyList e uBlockOrigin, parsate in un Set di ~300.000 domini e caricate in memoria. Ogni richiesta HTTP viene controllata prima di essere inviata — se il dominio è nella lista, viene bloccata prima che raggiunga la rete. Nessun DNS query trapela per i domini bloccati.

### WebRTC Protection
Il codice JavaScript `RTCPeerConnection` viene sovrascritto in ogni pagina caricata, impedendo a qualsiasi sito di rilevare il tuo IP reale tramite WebRTC. In aggiunta, il permission handler di Electron blocca le richieste di accesso ai media device.

### User-Agent Rotation
Ad ogni sessione viene scelto casualmente uno UA da un pool di browser reali (Chrome, Firefox, Safari su Linux, Windows, macOS). Questo rende difficile il fingerprinting basato su UA e UA-mismatch detection.

### NIP-07 Signer
La chiave privata Nostr non lascia mai il processo principale di Electron. Quando un sito chiede `window.nostr.signEvent()`, la richiesta viaggia via IPC al processo main, che firma l'evento con la chiave memorizzata localmente e restituisce solo l'evento firmato — mai la chiave privata.

---

## Roadmap

| Versione | Feature |
|---------|---------|
| v0.3 (attuale) | Browser funzionante, NWC reale, Nostr NIP-07, Ad block 300k+ domini, V4V |
| v0.4 | Cashu-ts reale, L-BTC wallet via libwally, QR code, LNURL-pay/auth |
| v0.5 | DoH reale integrato, Canvas fingerprint randomization, cronologia cifrata |
| v0.6 | Tor integrato opzionale, DM Nostr in-browser (NIP-04 UI), feed Nostr new tab |
| v0.7 | Extension API compatibile (subset Chrome), temi, bookmark sync via Nostr |
| v1.0 | Beta pubblica, build firmate, auto-update, AppImage/DMG/NSIS |

---

## Contribuire

Contributi benvenuti. Le aree prioritarie sono:

1. **Cashu-ts integration** — wallet ecash reale
2. **libwally-core FFI** — L-BTC wallet funzionante  
3. **DoH a livello Electron** — intercettazione DNS reale
4. **Canvas fingerprinting** — randomizzazione canvas API
5. **LNURL-pay / LNURL-auth** — flussi LNURL completi
6. **QR code display** — per indirizzi receive
7. **Tor integration** — bundle tor binary

```bash
git clone https://github.com/shadowbipnode/Zap-Browser.git
cd Zap-Browser
npm install
./node_modules/.bin/electron-rebuild -f -w better-sqlite3
npm start
```

---

## Sicurezza

- La seed BIP39 non viene mai trasmessa in rete
- La chiave privata Nostr non lascia mai il processo main
- Il DB SQLite è locale — nessun cloud, nessun sync
- Nessun telemetry, nessun crash report, nessun analytics
- Per segnalare vulnerabilità: apri una issue privata su GitHub

---

## Licenza

MIT — Free and Open Source. Vedi [LICENSE](LICENSE).

---

*Not your keys, not your coins. Not your browser, not your privacy.*

**⚡ Built with Bitcoin. Powered by Nostr. Free forever.**
