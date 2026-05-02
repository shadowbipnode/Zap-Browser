# ⚡ Zap Browser

Browser privacy-first con wallet Bitcoin nativi — Lightning (NWC), Liquid (L-BTC), Cashu ed identità Nostr integrata.

**Stack:** Tauri 2.0 (Rust) + React + TypeScript  
**Repo:** https://github.com/shadowbipnode/Zap-Browser-  
**Platform:** Linux · macOS · Windows

---

## Architettura

```
zap-browser/
├── src-tauri/src/       # Backend Rust (Tauri 2.0)
│   ├── main.rs          # Entry point, registrazione comandi
│   ├── db.rs            # SQLite cifrato (schema completo)
│   ├── wallet.rs        # BIP39, derivazione HD, preferiti
│   ├── lightning.rs     # NWC (Nostr Wallet Connect, NIP-47)
│   ├── liquid.rs        # L-BTC wallet (Liquid Network)
│   ├── cashu.rs         # Cashu ecash wallet
│   ├── nostr.rs         # Keypair NIP-06, firmatario NIP-07
│   └── privacy.rs       # UA rotation, WebRTC, ad block
├── src/                 # Frontend React + TypeScript
│   ├── pages/
│   │   ├── OnboardingPage.tsx   # Wizard primo avvio (6 step)
│   │   └── BrowserPage.tsx      # Shell principale browser
│   ├── components/
│   │   ├── browser/     # TabBar, Toolbar, WebArea, NewTabPage, Favorites
│   │   ├── wallet/      # WalletPanel (NWC + L-BTC + Cashu)
│   │   ├── nostr/       # NostrPanel (identità, relay, NIP-07)
│   │   └── settings/    # SettingsPanel (privacy, browser, info)
│   ├── store/           # Zustand state (tabs, navigazione)
│   └── styles/          # globals.css (design system completo)
├── firefox-profile/
│   └── user.js          # Privacy patches (Tor Browser / Arkenfox)
└── .github/workflows/
    └── build.yml        # CI: Ubuntu + macOS + Windows
```

---

## Primo avvio — Wizard (6 step)

```
1. Welcome       → Modalità Normal vs Bitcoin+Privacy
2. Seed          → Genera 24 parole BIP39 o importa esistente
3. Backup        → Conferma di aver salvato la seed
4. Nostr Choice  → Crea da seed (NIP-06) / importa nsec / salta
5. Nostr Profile → Nome utente
6. Done          → Browser avviato
```

**Derivazione dalla seed:**
- `m/44'/1237'/0'/0/0` → keypair Nostr (NIP-06)
- `m/84'/1776'/0'`     → wallet L-BTC (Liquid BIP84)
- Prove Cashu cifrate in SQLite

---

## Funzionalità

### 3 pulsanti privacy in toolbar (sempre visibili)
| Pulsante | Funzione | Stato |
|----------|----------|-------|
| 🛡️ Shield | Ad & tracker blocking + contatore bloccati | verde=on / rosso=off |
| 🔌 WebRTC | Blocca WebRTC per prevenire IP leak | verde=on / rosso=off |
| 🎭 UA | User-Agent: Auto-rotate / Default / Ruota ora | arancio=attivo |

### Wallet (pannello laterale, tab NWC / L-BTC / Cashu)
- **⚡ NWC** — incolla la stringa `nostr+walletconnect://` del tuo nodo LND/Alby/Zeus → saldo, invia invoice, genera invoice
- **🔵 L-BTC** — ricevi su indirizzo Liquid, invia L-BTC confidenziale
- **🥜 Cashu** — crea token, ricevi token, gestisci mint

### Nostr (pannello laterale)
- Profilo derivato dalla seed o nsec importata
- Firmatario NIP-07 nativo — **la chiave privata non lascia mai il backend Rust**
- Lista relay configurata (Damus, nos.lol, nostr.band…)

### Rilevamento automatico invoice/token in address bar
- Incolla un invoice `lnbc...` → badge "⚡ Invoice" + popup di pagamento
- Incolla un token `cashuA...` → badge "🥜 Cashu" + popup ricezione

### Privacy hardening (Firefox user.js)
- Arkenfox / Tor Browser patches: resistFingerprinting, WebGL, Canvas poison
- DNS over HTTPS obbligatorio (Cloudflare default, configurabile)
- Nessuna telemetria, nessun Safe Browsing call verso Google
- Cookie isolation (dFPI), referer policy stretta

---

## Setup su Ubuntu 24

```bash
# 1. Dipendenze di sistema
sudo apt update
sudo apt install -y curl git build-essential pkg-config \
  libssl-dev libwebkit2gtk-4.1-dev libgtk-3-dev \
  libayatana-appindicator3-dev librsvg2-dev

# 2. Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source ~/.cargo/env

# 3. Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# 4. Clona (oppure metti questi file nel tuo repo)
cd zap-browser

# 5. Installa dipendenze npm
npm install

# 6. Avvia in sviluppo
npm run tauri:dev

# 7. Build di produzione
npm run tauri:build
```

---

## Cosa è pronto vs cosa manca (TODO produzione)

### Pronto (architettura e UI completa)
- ✅ Wizard onboarding completo (6 step)
- ✅ Generazione e validazione mnemonic BIP39 (24 parole)
- ✅ Setup wallet + persistenza DB SQLite
- ✅ Toolbar con 3 pulsanti privacy (toggle + stato persistito)
- ✅ Address bar con rilevamento invoice/Cashu
- ✅ Invoice popup automatico con pulsante paga
- ✅ Pannello Wallet → NWC / L-BTC / Cashu
- ✅ NWC: parsing URI, salvataggio connessione in DB
- ✅ Pannello Nostr con profilo, relay, stato NIP-07
- ✅ Pannello Preferiti (salva/rimuovi)
- ✅ SettingsPanel completo (privacy, NWC, Cashu, Nostr, browser, info)
- ✅ New Tab Page con 8 quick link Bitcoin/Nostr
- ✅ Rotazione User-Agent (pool 8 UA reali)
- ✅ GitHub CI per Linux/macOS/Windows
- ✅ firefox-profile/user.js (Arkenfox/Tor Browser patches)

### Da implementare (produzione)
- [ ] **NWC WebSocket reale** — connessione al relay, encrypt/decrypt NIP-47 via secp256k1 ECDH
- [ ] **NIP-06 derivazione reale** — path `m/44'/1237'/0'/0/0` con HMAC-SHA512 BIP32
- [ ] **NIP-07 firma reale** — caricare nsec da DB, firmare eventi secp256k1
- [ ] **L-BTC wallet reale** — libwally-core FFI o BDK Liquid
- [ ] **Cashu wallet reale** — cashu-rs o cashu-ts via JS bridge
- [ ] **SQLCipher** — cifratura completa del DB con password utente
- [ ] **Ad block engine reale** — liste EasyList/uBlock, filtro a livello WebView
- [ ] **WebRTC block** — content script che sovrascrive RTCPeerConnection
- [ ] **QR code** — visualizzazione per receive (L-BTC, Cashu, invoice)
- [ ] **LNURL-pay / LNURL-auth** — gestione flussi lnurl
- [ ] **Firma NIP-07 con conferma UI** — dialog "Vuoi firmare questo evento?"
- [ ] **bech32 npub/nsec** — encode/decode reale (non placeholder)
- [ ] **Code signing** — firma app per macOS / Windows
- [ ] **Auto-update** — updater Tauri

---

## Licenza
MIT
