import { useEffect, useState } from 'react'
import { t, getLang, setLang } from '../../i18n'
import { THEMES, getTheme, setTheme, ThemeName } from '../../theme'
import BrowserProfilesSection from './BrowserProfilesSection'

const z = () => (window as any).zap

type Sec =
  | 'adblock' | 'webrtc' | 'dns' | 'tor' | 'user-agent' | 'fingerprint'
  | 'lightning' | 'cashu' | 'v4v'
  | 'nostr-identity' | 'nostr-relays' | 'nostr-permissions' | 'nip07'
  | 'profiles' | 'bookmarks' | 'history' | 'downloads' | 'startup'
  | 'theme' | 'language' | 'layout' | 'about'

interface NavGroup {
  label: string
  items: Array<{ id: Sec; label: string }>
}

function PageHeading({ title, description }: { title: string; description?: string }) {
  return (
    <div className="settings-page-heading">
      <div className="settings-page-title">{title}</div>
      {description && <p className="settings-page-description">{description}</p>}
    </div>
  )
}

function ToggleRow({ label, desc, on, onToggle }: {
  label: string
  desc: string
  on: boolean
  onToggle: () => void
}) {
  return (
    <div className="toggle-row">
      <div>
        <div className="toggle-label">{label}</div>
        <div className="toggle-desc">{desc}</div>
      </div>
      <button
        type="button"
        className={`toggle ${on ? 'on' : ''}`}
        aria-pressed={on}
        aria-label={label}
        onClick={onToggle}
      />
    </div>
  )
}

export default function SettingsPanel({ onClose }: { onClose: () => void }) {
  const [sec, setSec] = useState<Sec>('adblock')
  const [priv, setPriv] = useState<any>(null)
  const [bl, setBl] = useState<any>(null)
  const [v4vS, setV4vS] = useState<any>(null)
  const [lang, setLangS] = useState(getLang())
  const [appVersion, setAppVersion] = useState('')
  const [updateInfo, setUpdateInfo] = useState<any>(null)
  const [checkingUpdate, setCheckingUpdate] = useState(false)
  const [theme, setThemeS] = useState<ThemeName>(getTheme())
  const [, forceUpdate] = useState(0)

  const italian = lang === 'it'
  const refreshPrivacy = () => z()?.getPrivacy().then(setPriv)

  useEffect(() => {
    refreshPrivacy()
    z()?.getBlocklistInfo().then(setBl)
    z()?.v4vGetSettings().then(setV4vS)
    z()?.getAppVersion?.().then(setAppVersion)
    const handleLanguage = () => {
      setLangS(getLang())
      forceUpdate(value => value + 1)
    }
    const handleProfile = () => refreshPrivacy()
    const disposePrivacy = z()?.on?.('privacy-updated', setPriv)
    window.addEventListener('lang-changed', handleLanguage)
    window.addEventListener('browser-profile-changed', handleProfile)
    return () => {
      window.removeEventListener('lang-changed', handleLanguage)
      window.removeEventListener('browser-profile-changed', handleProfile)
      if (typeof disposePrivacy === 'function') disposePrivacy()
    }
  }, [])

  const togglePrivacy = async (key: string) => {
    if (key === 'adblock') await z()?.setAdblock({ enabled: !priv?.adblock })
    if (key === 'webrtc') await z()?.setWebRTC({ enabled: !priv?.webrtc_protect })
    if (key === 'doh') await z()?.setDoh({ enabled: !priv?.dohEnabled })
    await refreshPrivacy()
  }

  const groups: NavGroup[] = [
    {
      label: italian ? 'Privacy e sicurezza' : 'Privacy & Security',
      items: [
        { id: 'adblock', label: 'Ad Blocker' },
        { id: 'webrtc', label: 'WebRTC' },
        { id: 'dns', label: 'DNS' },
        { id: 'tor', label: 'Tor' },
        { id: 'user-agent', label: 'User Agent' },
        { id: 'fingerprint', label: 'Fingerprint' },
      ],
    },
    {
      label: 'Bitcoin',
      items: [
        { id: 'lightning', label: 'Lightning' },
        { id: 'cashu', label: 'Cashu' },
        { id: 'v4v', label: 'Value4Value' },
      ],
    },
    {
      label: 'Nostr',
      items: [
        { id: 'nostr-identity', label: italian ? 'Identità' : 'Identity' },
        { id: 'nostr-relays', label: 'Relays' },
        { id: 'nostr-permissions', label: italian ? 'Permessi' : 'Permissions' },
        { id: 'nip07', label: 'NIP-07' },
      ],
    },
    {
      label: 'Browser',
      items: [
        { id: 'profiles', label: italian ? 'Profili' : 'Profiles' },
        { id: 'bookmarks', label: italian ? 'Preferiti' : 'Bookmarks' },
        { id: 'history', label: italian ? 'Cronologia' : 'History' },
        { id: 'downloads', label: 'Downloads' },
        { id: 'startup', label: italian ? 'Avvio' : 'Startup' },
      ],
    },
    {
      label: italian ? 'Aspetto' : 'Appearance',
      items: [
        { id: 'theme', label: italian ? 'Tema' : 'Theme' },
        { id: 'language', label: italian ? 'Lingua' : 'Language' },
        { id: 'layout', label: 'Layout' },
      ],
    },
  ]

  const checkUpdates = async () => {
    setCheckingUpdate(true)
    setUpdateInfo(null)
    try {
      setUpdateInfo(await z()?.checkForUpdates?.())
    } catch (error: any) {
      setUpdateInfo({ ok: false, error: String(error?.message || error) })
    } finally {
      setCheckingUpdate(false)
    }
  }

  return (
    <div className="settings-panel">
      <div className="panel-hd">
        <span className="panel-hd-title">⚙️ {t('settings')}</span>
        <button className="panel-hd-close" onClick={onClose}>×</button>
      </div>

      <div className="settings-shell">
        <nav className="settings-nav" aria-label={t('settings')}>
          {groups.map(group => (
            <div className="settings-nav-group" key={group.label}>
              <div className="settings-nav-heading">{group.label}</div>
              {group.items.map(item => (
                <button
                  key={item.id}
                  className={`settings-nav-item ${sec === item.id ? 'active' : ''}`}
                  onClick={() => setSec(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          ))}
          <div className="settings-nav-group">
            <button
              className={`settings-nav-item standalone ${sec === 'about' ? 'active' : ''}`}
              onClick={() => setSec('about')}
            >
              {t('about')}
            </button>
          </div>
        </nav>

        <main className="settings-content">
          {sec === 'adblock' && priv && (
            <>
              <PageHeading
                title="Ad Blocker"
                description={italian ? 'Blocca pubblicità e tracker usando le liste integrate.' : 'Block ads and trackers with the integrated filter lists.'}
              />
              <ToggleRow
                label={t('adBlock')}
                desc={bl?.ready
                  ? `${bl.size?.toLocaleString() || 0} ${t('adBlockDesc')} — ${bl.count || 0} ${t('blocked')}`
                  : t('loading')}
                on={!!priv.adblock}
                onToggle={() => togglePrivacy('adblock')}
              />
              <div className="settings-stat-grid">
                {[
                  [t('blocked'), (bl?.count || 0).toLocaleString()],
                  [t('listSize'), (bl?.size || 0).toLocaleString()],
                ].map(([label, value]) => (
                  <div className="settings-stat" key={label}>
                    <strong>{value}</strong>
                    <span>{label}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {sec === 'webrtc' && priv && (
            <>
              <PageHeading
                title="WebRTC"
                description={italian ? 'Riduce il rischio che WebRTC esponga indirizzi IP locali o pubblici.' : 'Reduce the risk of WebRTC exposing local or public IP addresses.'}
              />
              <ToggleRow
                label={t('webrtc')}
                desc={t('webrtcDesc')}
                on={!!priv.webrtc_protect}
                onToggle={() => togglePrivacy('webrtc')}
              />
            </>
          )}

          {sec === 'dns' && priv && (
            <>
              <PageHeading
                title="DNS"
                description={italian ? 'Configura la protezione delle richieste DNS.' : 'Configure DNS request protection.'}
              />
              <ToggleRow
                label={t('doh')}
                desc={t('dohDesc')}
                on={!!priv.dohEnabled}
                onToggle={() => togglePrivacy('doh')}
              />
            </>
          )}

          {sec === 'tor' && priv && (
            <>
              <PageHeading
                title="Tor"
                description={italian ? 'Instrada il traffico attraverso un proxy SOCKS5 locale esistente.' : 'Route traffic through an existing local SOCKS5 proxy.'}
              />
              <ToggleRow
                label="Tor / SOCKS5 Proxy"
                desc={priv.tor_enabled
                  ? `${italian ? 'Instradamento via' : 'Routing via'} ${priv.tor_host || '127.0.0.1'}:${priv.tor_port || 9050}`
                  : (italian ? 'Disattivato. Predefinito: 127.0.0.1:9050.' : 'Disabled. Default: 127.0.0.1:9050.')}
                on={!!priv.tor_enabled}
                onToggle={async () => {
                  await z()?.setTorProxy({
                    enabled: !priv.tor_enabled,
                    host: priv.tor_host || '127.0.0.1',
                    port: priv.tor_port || 9050,
                  })
                  await refreshPrivacy()
                }}
              />
              <div className="settings-note">
                {italian ? 'Zap Browser non avvia Tor: il proxy deve essere già in esecuzione.' : 'Zap Browser does not start Tor; the proxy must already be running.'}
              </div>
            </>
          )}

          {sec === 'user-agent' && priv && (
            <>
              <PageHeading
                title="User Agent"
                description={italian ? 'Scegli come Zap Browser presenta il browser ai siti.' : 'Choose how Zap Browser identifies the browser to websites.'}
              />
              <ToggleRow
                label={t('uaRotate')}
                desc={t('uaRotateDesc')}
                on={priv.ua_mode === 'rotate'}
                onToggle={async () => {
                  await z()?.setUAMode({ mode: 'rotate' })
                  await refreshPrivacy()
                }}
              />
              <ToggleRow
                label={t('uaDefault')}
                desc={t('uaDefaultDesc')}
                on={priv.ua_mode === 'default'}
                onToggle={async () => {
                  await z()?.setUAMode({ mode: 'default' })
                  await refreshPrivacy()
                }}
              />
            </>
          )}

          {sec === 'fingerprint' && (
            <>
              <PageHeading
                title="Fingerprint"
                description={italian ? 'Protezione anti-fingerprinting integrata.' : 'Built-in anti-fingerprinting protection.'}
              />
              <div className="settings-info-card">
                <strong>{italian ? 'Protezione attiva' : 'Protection enabled'}</strong>
                <p>
                  {italian
                    ? 'Zap Browser normalizza segnali ad alta entropia come canvas, audio, schermo e timezone. Non ci sono controlli configurabili in questa versione.'
                    : 'Zap Browser normalizes high-entropy signals such as canvas, audio, screen, and timezone. There are no configurable controls in this version.'}
                </p>
              </div>
            </>
          )}

          {sec === 'lightning' && (
            <>
              <PageHeading
                title="Lightning"
                description={italian ? 'Connetti un wallet Lightning tramite Nostr Wallet Connect.' : 'Connect a Lightning wallet through Nostr Wallet Connect.'}
              />
              <div className="settings-info-card">
                <strong>Nostr Wallet Connect (NIP-47)</strong>
                {(italian
                  ? ['Apri Alby o Zeus sul tuo nodo.', 'Crea una nuova connessione.', 'Copia la stringa nostr+walletconnect://.', 'Incollala nel pannello Wallet → NWC.']
                  : ['Open Alby or Zeus on your node.', 'Create a new connection.', 'Copy the nostr+walletconnect:// string.', 'Paste it in Wallet → NWC.']
                ).map((step, index) => <p key={step}>{index + 1}. {step}</p>)}
              </div>
            </>
          )}

          {sec === 'cashu' && (
            <>
              <PageHeading
                title="Cashu"
                description={italian ? 'Gestisci ecash Chaumiano dal pannello Wallet.' : 'Manage Chaumian ecash from the Wallet panel.'}
              />
              <div className="settings-info-card success">
                <strong>{italian ? 'Mint comunemente usati' : 'Commonly used mints'}</strong>
                <p>Minibits · LNbits Legend · Coinos</p>
              </div>
            </>
          )}

          {sec === 'v4v' && (
            <>
              <PageHeading title={t('v4vTitle')} description={t('v4vDesc')} />
              {v4vS && (
                <>
                  <ToggleRow
                    label={t('autopay')}
                    desc={`${v4vS.amount} ${t('autopayDesc')}`}
                    on={!!v4vS.enabled}
                    onToggle={async () => {
                      await z()?.v4vSetAutopay({ enabled: !v4vS.enabled })
                      setV4vS(await z()?.v4vGetSettings())
                    }}
                  />
                  <div className="field settings-field">
                    <label>{t('boostAmount')}</label>
                    <input
                      className="inp"
                      type="number"
                      min={1}
                      defaultValue={v4vS.amount}
                      onBlur={async event => {
                        await z()?.v4vSetAutopay({ amount: parseInt(event.target.value) })
                        setV4vS(await z()?.v4vGetSettings())
                      }}
                    />
                  </div>
                </>
              )}
            </>
          )}

          {sec === 'nostr-identity' && <NostrIdentitySection lang={lang} />}
          {sec === 'nostr-relays' && <NostrRelaysSection lang={lang} />}
          {sec === 'nostr-permissions' && <NostrPermissionsSection lang={lang} />}

          {sec === 'nip07' && (
            <>
              <PageHeading
                title="NIP-07"
                description={italian ? 'Firma eventi Nostr nei siti senza esporre la chiave privata.' : 'Sign Nostr events on websites without exposing the private key.'}
              />
              <div className="settings-info-card">
                <strong>{italian ? 'Signer nativo' : 'Native signer'}</strong>
                <p>
                  {italian
                    ? 'I siti devono richiedere il permesso prima di leggere la chiave pubblica o firmare. Le decisioni sono isolate per profilo browser.'
                    : 'Sites must request permission before reading the public key or signing. Decisions are isolated per browser profile.'}
                </p>
              </div>
            </>
          )}

          {sec === 'profiles' && <BrowserProfilesSection lang={lang} />}
          {sec === 'bookmarks' && <BookmarksSection lang={lang} />}
          {sec === 'history' && <HistorySection lang={lang} />}
          {sec === 'downloads' && <DownloadsSection lang={lang} />}

          {sec === 'startup' && (
            <>
              <PageHeading
                title={italian ? 'Avvio' : 'Startup'}
                description={italian ? 'Impostazioni generali per nuove sessioni e dati browser.' : 'General settings for new sessions and browser data.'}
              />
              <div className="field settings-field">
                <label>{t('searchEngine')}</label>
                <select className="inp">
                  <option>DuckDuckGo</option>
                  <option>Kagi</option>
                  <option>Brave Search</option>
                  <option>SearXNG</option>
                </select>
              </div>
              <BrowserDataSection lang={lang} />
            </>
          )}

          {sec === 'theme' && (
            <>
              <PageHeading
                title={italian ? 'Tema' : 'Theme'}
                description={italian ? 'Scegli l’aspetto di Zap Browser.' : 'Choose the appearance of Zap Browser.'}
              />
              <div className="settings-choice-grid">
                {THEMES.map(item => (
                  <button
                    key={item.id}
                    className={`settings-choice ${theme === item.id ? 'active' : ''}`}
                    onClick={() => {
                      setTheme(item.id)
                      setThemeS(item.id)
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </>
          )}

          {sec === 'language' && (
            <>
              <PageHeading
                title={t('language')}
                description={italian ? 'Scegli la lingua dell’interfaccia.' : 'Choose the interface language.'}
              />
              <div className="settings-choice-grid">
                {(['it', 'en'] as const).map(item => (
                  <button
                    key={item}
                    className={`settings-choice ${lang === item ? 'active' : ''}`}
                    onClick={() => {
                      setLang(item)
                      setLangS(item)
                    }}
                  >
                    {item === 'it' ? '🇮🇹 Italiano' : '🇬🇧 English'}
                  </button>
                ))}
              </div>
            </>
          )}

          {sec === 'layout' && (
            <>
              <PageHeading
                title="Layout"
                description={italian ? 'Controlla gli elementi visibili nell’interfaccia.' : 'Control which elements are visible in the interface.'}
              />
              <BookmarksBarToggle lang={lang} />
            </>
          )}

          {sec === 'about' && (
            <AboutSection
              lang={lang}
              appVersion={appVersion}
              blocklistSize={bl?.size || 0}
              updateInfo={updateInfo}
              checkingUpdate={checkingUpdate}
              onCheckUpdates={checkUpdates}
            />
          )}
        </main>
      </div>
    </div>
  )
}

function NostrIdentitySection({ lang }: { lang: string }) {
  const italian = lang === 'it'
  const [profile, setProfile] = useState<any>(null)
  const [nsec, setNsec] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [messageKind, setMessageKind] = useState<'ok' | 'err'>('ok')
  const [showImport, setShowImport] = useState(false)

  useEffect(() => {
    z()?.nostrGetProfile().then(setProfile)
  }, [])

  const importNsec = async () => {
    if (!nsec.trim()) return
    setLoading(true)
    setMessage('')
    try {
      await z()?.nostrImportNsec({ nsec: nsec.trim(), name: name || profile?.name || null })
      setProfile(await z()?.nostrGetProfile())
      setMessage(italian ? 'Identità importata.' : 'Identity imported.')
      setMessageKind('ok')
      setNsec('')
      setName('')
      setShowImport(false)
    } catch (error: any) {
      setMessage(error?.message || String(error))
      setMessageKind('err')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <PageHeading
        title={italian ? 'Identità Nostr' : 'Nostr identity'}
        description={italian ? 'L’identità Nostr attiva è isolata nel profilo browser corrente.' : 'The active Nostr identity is isolated to the current browser profile.'}
      />
      {profile ? (
        <div className="nostr-card">
          <div className="nostr-av">👤</div>
          <div>
            <div className="nostr-name">{profile.name || `${profile.npub?.slice(0, 22)}...`}</div>
            <div className="nostr-npub">{profile.npub?.slice(0, 30)}...</div>
          </div>
        </div>
      ) : (
        <div className="settings-empty">{italian ? 'Nessuna identità configurata in questo profilo.' : 'No identity configured in this profile.'}</div>
      )}

      {!showImport ? (
        <button className="act-btn settings-primary-action" onClick={() => setShowImport(true)}>
          🔑 {italian ? 'Importa nsec' : 'Import nsec'}
        </button>
      ) : (
        <div className="settings-form-card">
          <div className="field">
            <label>{italian ? 'Chiave nsec' : 'nsec key'}</label>
            <input className="inp inp-mono" type="password" placeholder="nsec1..." value={nsec} onChange={event => setNsec(event.target.value)} />
          </div>
          <div className="field">
            <label>{italian ? 'Nome (opzionale)' : 'Name (optional)'}</label>
            <input className="inp" value={name} onChange={event => setName(event.target.value)} />
          </div>
          <div className="settings-note">
            {italian
              ? 'La chiave viene salvata localmente in forma cifrata. Non vengono pubblicati metadati sui relay.'
              : 'The key is stored locally in encrypted form. No profile metadata is published to relays.'}
          </div>
          <div className="act-row">
            <button className="act-btn primary" disabled={loading || !nsec.trim()} onClick={importNsec}>
              {loading ? '…' : (italian ? 'Importa' : 'Import')}
            </button>
            <button className="act-btn" onClick={() => {
              setShowImport(false)
              setNsec('')
              setMessage('')
            }}>
              {t('cancel')}
            </button>
          </div>
        </div>
      )}
      {message && <div className={`msg ${messageKind}`}>{message}</div>}
    </>
  )
}

function NostrRelaysSection({ lang }: { lang: string }) {
  const relays = [
    'wss://relay.shadowbip.com',
    'wss://relay.damus.io',
    'wss://relay.nostr.band',
    'wss://nos.lol',
    'wss://relay.snort.social',
    'wss://nostr.wine',
  ]
  return (
    <>
      <PageHeading
        title="Relays"
        description={lang === 'it' ? 'Relay Nostr configurati per Zap Browser.' : 'Nostr relays configured for Zap Browser.'}
      />
      <div className="settings-list-card">
        {relays.map(relay => (
          <div key={relay} className="relay-row">
            <span className="relay-dot" />
            <span className="relay-url">{relay}</span>
          </div>
        ))}
      </div>
    </>
  )
}

function NostrPermissionsSection({ lang }: { lang: string }) {
  const italian = lang === 'it'
  const [permissions, setPermissions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = async () => {
    try {
      setPermissions(await z()?.nostrListPermissions() || [])
      setError('')
    } catch (loadError: any) {
      setError(loadError?.message || String(loadError))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  return (
    <>
      <PageHeading
        title={italian ? 'Permessi Nostr' : 'Nostr permissions'}
        description={italian ? 'Decisioni NIP-07 salvate per il profilo browser attivo.' : 'Saved NIP-07 decisions for the active browser profile.'}
      />
      {loading && <div className="settings-empty">{t('loading')}</div>}
      {!loading && permissions.length === 0 && (
        <div className="settings-empty">{italian ? 'Nessun permesso salvato.' : 'No saved permissions.'}</div>
      )}
      <div className="settings-list-card">
        {permissions.map(permission => (
          <div className="permission-row" key={`${permission.origin}:${permission.action}`}>
            <div>
              <strong>{permission.origin}</strong>
              <span>{permission.action} · {permission.decision}</span>
            </div>
            <button
              className="act-btn danger"
              onClick={async () => {
                await z()?.nostrRemovePermission({ origin: permission.origin, action: permission.action })
                await load()
              }}
            >
              {italian ? 'Revoca' : 'Revoke'}
            </button>
          </div>
        ))}
      </div>
      {permissions.length > 0 && (
        <button
          className="act-btn danger settings-primary-action"
          onClick={async () => {
            if (!window.confirm(italian ? 'Cancellare tutti i permessi NIP-07 salvati?' : 'Clear all saved NIP-07 permissions?')) return
            await z()?.nostrClearPermissions()
            await load()
          }}
        >
          {italian ? 'Cancella tutti i permessi' : 'Clear all permissions'}
        </button>
      )}
      {error && <div className="msg err">{error}</div>}
    </>
  )
}

function BookmarksBarToggle({ lang }: { lang: string }) {
  const [visible, setVisible] = useState(localStorage.getItem('showFavBar') !== 'false')
  const italian = lang === 'it'

  return (
    <ToggleRow
      label={italian ? 'Barra preferiti' : 'Bookmarks bar'}
      desc={italian ? 'Mostra la barra sotto la barra degli indirizzi.' : 'Show the bar below the address bar.'}
      on={visible}
      onToggle={() => {
        const next = !visible
        setVisible(next)
        localStorage.setItem('showFavBar', String(next))
        window.dispatchEvent(new CustomEvent('toggle-favbar', { detail: next }))
      }}
    />
  )
}

function BookmarksSection({ lang }: { lang: string }) {
  const italian = lang === 'it'
  const [count, setCount] = useState(0)

  useEffect(() => {
    z()?.getFavorites().then((items: any[]) => setCount(items?.length || 0))
  }, [])

  return (
    <>
      <PageHeading
        title={italian ? 'Preferiti' : 'Bookmarks'}
        description={italian ? 'Gestisci visibilità e accesso ai preferiti salvati.' : 'Manage visibility and access to saved bookmarks.'}
      />
      <div className="settings-info-card">
        <strong>{count} {italian ? 'preferiti salvati' : 'saved bookmarks'}</strong>
        <p>{italian ? 'Usa il pulsante Preferiti nella barra degli strumenti per aggiungere, importare, organizzare o rimuovere elementi.' : 'Use the Bookmarks toolbar button to add, import, organize, or remove items.'}</p>
      </div>
      <BookmarksBarToggle lang={lang} />
    </>
  )
}

function HistorySection({ lang }: { lang: string }) {
  const italian = lang === 'it'
  const [history, setHistory] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    z()?.getHistory({ limit: 200 }).then((items: any[]) => {
      setHistory(items || [])
      setLoading(false)
    })
  }, [])

  const clear = async () => {
    if (!window.confirm(italian ? 'Cancellare tutta la cronologia?' : 'Clear all history?')) return
    await z()?.clearHistory()
    setHistory([])
  }

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp * 1000)
    const days = Math.floor((Date.now() - date.getTime()) / 86400000)
    if (days === 0) return italian ? 'Oggi' : 'Today'
    if (days === 1) return italian ? 'Ieri' : 'Yesterday'
    return date.toLocaleDateString(italian ? 'it-IT' : 'en-US')
  }

  const grouped: Record<string, any[]> = {}
  history.forEach(item => {
    const day = formatDate(item.visited_at)
    grouped[day] = grouped[day] || []
    grouped[day].push(item)
  })

  return (
    <>
      <div className="settings-heading-row">
        <PageHeading title={italian ? 'Cronologia' : 'History'} description={italian ? 'Pagine visitate nel profilo corrente.' : 'Pages visited in the current profile.'} />
        {history.length > 0 && <button className="act-btn danger" onClick={clear}>{italian ? 'Cancella tutto' : 'Clear all'}</button>}
      </div>
      {loading && <div className="settings-empty">{t('loading')}</div>}
      {!loading && history.length === 0 && <div className="settings-empty">{t('noHistory')}</div>}
      {Object.entries(grouped).map(([day, items]) => (
        <div className="history-group" key={day}>
          <div className="settings-list-heading">{day}</div>
          {items.map((item, index) => (
            <button
              className="history-row"
              key={`${item.url}:${item.visited_at}:${index}`}
              onClick={() => window.dispatchEvent(new CustomEvent('navigate-to', { detail: item.url }))}
            >
              <span>🌐</span>
              <div>
                <strong>{item.title || item.url}</strong>
                <small>{item.url}</small>
              </div>
              <time>{new Date(item.visited_at * 1000).toLocaleTimeString(italian ? 'it-IT' : 'en-US', { hour: '2-digit', minute: '2-digit' })}</time>
            </button>
          ))}
        </div>
      ))}
    </>
  )
}

function DownloadsSection({ lang }: { lang: string }) {
  const italian = lang === 'it'
  const [downloads, setDownloads] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setDownloads(await z()?.getDownloadHistory?.() || [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  return (
    <>
      <div className="settings-heading-row">
        <PageHeading title="Downloads" description={italian ? 'Cronologia dei download.' : 'Download history.'} />
        {downloads.length > 0 && (
          <button
            className="act-btn danger"
            onClick={async () => {
              if (!window.confirm(italian ? 'Cancellare la cronologia dei download?' : 'Clear download history?')) return
              await z()?.clearDownloadHistory?.()
              await load()
            }}
          >
            {italian ? 'Cancella' : 'Clear'}
          </button>
        )}
      </div>
      {loading && <div className="settings-empty">{t('loading')}</div>}
      {!loading && downloads.length === 0 && <div className="settings-empty">{italian ? 'Nessun download.' : 'No downloads.'}</div>}
      <div className="settings-list-card">
        {downloads.map(download => (
          <div className="download-settings-row" key={download.id}>
            <span>⬇</span>
            <div>
              <strong>{download.fileName || download.filename || 'download'}</strong>
              <small>{download.state || (italian ? 'Completato' : 'Completed')}</small>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

function BrowserDataSection({ lang }: { lang: string }) {
  const italian = lang === 'it'
  const actions = [
    { label: t('clearHistory'), desc: t('clearHistoryDesc'), action: () => z()?.clearHistory() },
    { label: t('clearCookies'), desc: t('clearCookiesDesc'), action: () => z()?.clearCookies() },
    { label: t('clearCache'), desc: t('clearCacheDesc'), action: () => z()?.clearCache() },
  ]

  return (
    <>
      <div className="sec-title settings-subtitle">{italian ? 'Dati browser' : 'Browser data'}</div>
      {actions.map(item => (
        <div className="settings-action-row" key={item.label}>
          <div>
            <strong>{item.label}</strong>
            <span>{item.desc}</span>
          </div>
          <button
            className="act-btn"
            onClick={async () => {
              if (!window.confirm(`${item.label}?`)) return
              await item.action()
              window.alert(italian ? 'Fatto.' : 'Done.')
            }}
          >
            {t('clearAll')}
          </button>
        </div>
      ))}
      <div className="sec-title settings-subtitle">{t('dangerZone')}</div>
      <button
        className="act-btn danger settings-danger-action"
        onClick={async () => {
          if (!window.confirm(t('resetConfirm'))) return
          await z()?.resetBrowser()
          window.location.reload()
        }}
      >
        🗑️ {t('resetBrowser')}
      </button>
      <p className="settings-page-description">{t('resetBrowserDesc')}</p>
    </>
  )
}

function AboutSection({ lang, appVersion, blocklistSize, updateInfo, checkingUpdate, onCheckUpdates }: {
  lang: string
  appVersion: string
  blocklistSize: number
  updateInfo: any
  checkingUpdate: boolean
  onCheckUpdates: () => void
}) {
  const italian = lang === 'it'
  const updateText = updateInfo
    ? updateInfo.ok
      ? updateInfo.updateAvailable
        ? (italian ? `Nuova versione disponibile: v${updateInfo.latestVersion}` : `New version available: v${updateInfo.latestVersion}`)
        : (italian ? 'Zap Browser è aggiornato.' : 'Zap Browser is up to date.')
      : (italian ? `Controllo non riuscito: ${updateInfo.error}` : `Update check failed: ${updateInfo.error}`)
    : (italian ? 'Controlla se è disponibile una nuova versione.' : 'Check whether a new version is available.')

  return (
    <>
      <div className="about-brand">
        <span>⚡</span>
        <strong>Zap<em>Browser</em></strong>
        <small>v{appVersion || 'unknown'}-beta</small>
      </div>
      <div className="settings-info-card">
        <strong>{italian ? 'Aggiornamenti' : 'Updates'}</strong>
        <p>{updateText}</p>
        <div className="act-row">
          <button className="act-btn primary" disabled={checkingUpdate} onClick={onCheckUpdates}>
            {checkingUpdate ? (italian ? 'Controllo…' : 'Checking…') : (italian ? 'Controlla aggiornamenti' : 'Check for updates')}
          </button>
          <button className="act-btn" onClick={() => z()?.openReleasesPage?.()}>GitHub Releases</button>
        </div>
      </div>
      <div className="about-details">
        {[
          ['Version', appVersion || 'unknown'],
          ['Engine', 'Chromium via Electron BrowserView'],
          ['Lightning', 'NWC — NIP-47'],
          ['Ecash', 'Cashu'],
          ['Nostr', 'NIP-07 native signer'],
          ['Privacy', `${blocklistSize.toLocaleString()} ${italian ? 'domini' : 'domains'}`],
          ['License', 'MIT'],
          ['Repo', 'github.com/shadowbipnode/Zap-Browser'],
        ].map(([label, value]) => (
          <div key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
    </>
  )
}
