// Internazionalizzazione — Italiano e Inglese
type Lang = 'it' | 'en'

const translations = {
  it: {
    // Generale
    settings: 'Impostazioni',
    privacy: 'Privacy',
    lightning: 'Lightning',
    cashu: 'Cashu',
    nostr: 'Nostr',
    v4v: 'Value4Value',
    browser: 'Browser',
    about: 'Info',
    save: 'Salva',
    cancel: 'Annulla',
    close: 'Chiudi',
    add: 'Aggiungi',
    remove: 'Rimuovi',
    reset: 'Reset',
    confirm: 'Conferma',
    loading: 'Caricamento...',
    error: 'Errore',
    success: 'Successo',
    // Privacy
    adBlock: 'Ad & Tracker Blocking',
    adBlockDesc: 'domini bloccati in lista',
    webrtc: 'WebRTC Leak Prevention',
    webrtcDesc: 'Blocca perdite IP via WebRTC',
    doh: 'DNS over HTTPS',
    dohDesc: 'Query DNS cifrate via Cloudflare',
    uaRotate: 'User-Agent Auto-rotate',
    uaRotateDesc: 'Cambia UA ogni sessione',
    uaDefault: 'User-Agent Default',
    uaDefaultDesc: 'UA standard del sistema',
    blocked: 'Bloccati ora',
    listSize: 'Domini in lista',
    // Nostr
    nostrIdentity: 'Identità Nostr',
    nostrDesc: 'Zap Browser implementa NIP-07 nativamente.',
    importNsec: 'Importa nuova nsec',
    importNsecDesc: 'Sostituisce l\'identità attuale',
    nsecPlaceholder: 'nsec1...',
    nostrName: 'Nome utente',
    currentProfile: 'Profilo attuale',
    noProfile: 'Nessun profilo configurato',
    // Browser
    searchEngine: 'Motore di Ricerca',
    clearHistory: 'Cancella Cronologia',
    clearHistoryDesc: 'Rimuove tutta la cronologia di navigazione',
    clearCookies: 'Cancella Cookie',
    clearCookiesDesc: 'Rimuove tutti i cookie e dati di sessione',
    clearCache: 'Svuota Cache',
    clearCacheDesc: 'Libera spazio disco',
    clearAll: 'Cancella tutto',
    dangerZone: 'Zona Pericolosa',
    resetBrowser: 'Reset completo browser',
    resetBrowserDesc: 'Cancella il database locale. Il seed non viene recuperato.',
    resetConfirm: 'Sei sicuro? Questa azione cancellerà TUTTO — seed, wallet, profilo Nostr, impostazioni. Non è reversibile.',
    language: 'Lingua',
    history: 'Cronologia',
    noHistory: 'Nessuna cronologia',
    // History
    today: 'Oggi',
    yesterday: 'Ieri',
    // V4V
    v4vTitle: 'Value4Value',
    v4vDesc: 'Supporta i creator con micropagamenti Lightning.',
    autopay: 'Micropagamenti automatici',
    autopayDesc: 'sats al minuto ai creator V4V',
    boostAmount: 'Importo automatico (sats/min)',
  },
  en: {
    settings: 'Settings',
    privacy: 'Privacy',
    lightning: 'Lightning',
    cashu: 'Cashu',
    nostr: 'Nostr',
    v4v: 'Value4Value',
    browser: 'Browser',
    about: 'About',
    save: 'Save',
    cancel: 'Cancel',
    close: 'Close',
    add: 'Add',
    remove: 'Remove',
    reset: 'Reset',
    confirm: 'Confirm',
    loading: 'Loading...',
    error: 'Error',
    success: 'Success',
    adBlock: 'Ad & Tracker Blocking',
    adBlockDesc: 'domains blocked in list',
    webrtc: 'WebRTC Leak Prevention',
    webrtcDesc: 'Blocks IP leaks via WebRTC',
    doh: 'DNS over HTTPS',
    dohDesc: 'Encrypted DNS queries via Cloudflare',
    uaRotate: 'User-Agent Auto-rotate',
    uaRotateDesc: 'Changes UA every session',
    uaDefault: 'Default User-Agent',
    uaDefaultDesc: 'System default UA',
    blocked: 'Blocked now',
    listSize: 'Domains in list',
    nostrIdentity: 'Nostr Identity',
    nostrDesc: 'Zap Browser implements NIP-07 natively.',
    importNsec: 'Import new nsec',
    importNsecDesc: 'Replaces current identity',
    nsecPlaceholder: 'nsec1...',
    nostrName: 'Username',
    currentProfile: 'Current profile',
    noProfile: 'No profile configured',
    searchEngine: 'Search Engine',
    clearHistory: 'Clear History',
    clearHistoryDesc: 'Removes all browsing history',
    clearCookies: 'Clear Cookies',
    clearCookiesDesc: 'Removes all cookies and session data',
    clearCache: 'Clear Cache',
    clearCacheDesc: 'Frees disk space',
    clearAll: 'Clear all',
    dangerZone: 'Danger Zone',
    resetBrowser: 'Full browser reset',
    resetBrowserDesc: 'Deletes local database. Seed is not recoverable.',
    resetConfirm: 'Are you sure? This will delete EVERYTHING — seed, wallet, Nostr profile, settings. This is irreversible.',
    language: 'Language',
    history: 'History',
    noHistory: 'No history',
    today: 'Today',
    yesterday: 'Yesterday',
    v4vTitle: 'Value4Value',
    v4vDesc: 'Support creators with Lightning micropayments.',
    autopay: 'Automatic micropayments',
    autopayDesc: 'sats per minute to V4V creators',
    boostAmount: 'Auto amount (sats/min)',
  }
} as const

let currentLang: Lang = (localStorage.getItem('zap-lang') as Lang) || 'it'

export function t(key: keyof typeof translations.it): string {
  return (translations[currentLang] as any)[key] || (translations.it as any)[key] || key
}

export function getLang(): Lang { return currentLang }

export function setLang(lang: Lang) {
  currentLang = lang
  localStorage.setItem('zap-lang', lang)
  window.dispatchEvent(new Event('lang-changed'))
}

export function useLang() { return currentLang }
