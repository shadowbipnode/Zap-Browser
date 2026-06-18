import { useState, useEffect } from 'react'
import { t, getLang, setLang } from '../../i18n'
import { THEMES, getTheme, setTheme, ThemeName } from '../../theme'
import BrowserProfilesSection from './BrowserProfilesSection'

const z = () => (window as any).zap
type Sec = 'privacy'|'lightning'|'cashu'|'nostr'|'v4v'|'browser'|'history'|'about'

export default function SettingsPanel({ onClose }: { onClose:()=>void }) {
  const [sec,    setSec]   = useState<Sec>('privacy')
  const [priv,   setPriv]  = useState<any>(null)
  const [bl,     setBl]    = useState<any>(null)
  const [v4vS,   setV4vS]  = useState<any>(null)
  const [lang,   setLangS] = useState(getLang())
  const [appVersion, setAppVersion] = useState('')
  const [updateInfo, setUpdateInfo] = useState<any>(null)
  const [checkingUpdate, setCheckingUpdate] = useState(false)
  const [theme, setThemeS] = useState<ThemeName>(getTheme())
  const [, forceUpdate]    = useState(0)

  useEffect(() => {
    z()?.getPrivacy().then(setPriv)
    z()?.getBlocklistInfo().then(setBl)
    z()?.v4vGetSettings().then(setV4vS)
    z()?.getAppVersion?.().then(setAppVersion)
    const h = () => { setLangS(getLang()); forceUpdate(n=>n+1) }
    window.addEventListener('lang-changed', h)
    return () => window.removeEventListener('lang-changed', h)
  }, [])

  const togglePriv = async (key: string) => {
    if (key==='adblock')  { await z()?.setAdblock({enabled:!priv?.adblock}) }
    else if (key==='webrtc') { await z()?.setWebRTC({enabled:!priv?.webrtc_protect}) }
    else if (key==='popup_block') { await z()?.setPopupBlock({enabled:!priv?.popup_block}) }
    else if (key==='overlay_block') { await z()?.setOverlayBlock({enabled:!priv?.overlay_block}) }
    else if (key==='doh')    { await z()?.setDoh({enabled:!priv?.dohEnabled}) }
    z()?.getPrivacy().then(setPriv)
  }

  const TR = ({label,desc,on,onToggle}:{label:string;desc:string;on:boolean;onToggle:()=>void}) => (
    <div className="toggle-row">
      <div><div className="toggle-label">{label}</div><div className="toggle-desc">{desc}</div></div>
      <div className={`toggle ${on?'on':''}`} onClick={onToggle} />
    </div>
  )

  const SECS: {id:Sec;l:string}[] = [
    {id:'privacy',  l:'🔒 '+t('privacy')},
    {id:'lightning',l:'⚡ '+t('lightning')},
    {id:'cashu',    l:'🥜 '+t('cashu')},
    {id:'nostr',    l:'🟣 '+t('nostr')},
    {id:'v4v',      l:'💜 '+t('v4v')},
    {id:'history',  l:'🕑 '+t('history')},
    {id:'browser',  l:'🌐 '+t('browser')},
    {id:'about',    l:'ℹ️ '+t('about')},
  ]

  const checkUpdates = async () => {
    setCheckingUpdate(true)
    setUpdateInfo(null)
    try {
      const info = await z()?.checkForUpdates?.()
      setUpdateInfo(info)
    } catch (e:any) {
      setUpdateInfo({
        ok: false,
        error: String(e?.message || e),
      })
    }
    setCheckingUpdate(false)
  }

  return (
    <>
      <div className="panel-hd">
        <span className="panel-hd-title">⚙️ {t('settings')}</span>
        <button className="panel-hd-close" onClick={onClose}>×</button>
      </div>
      <div style={{display:'flex',height:'calc(100% - 53px)'}}>
        <div style={{width:150,borderRight:'1px solid var(--b0)',padding:'8px 5px',flexShrink:0,overflowY:'auto'}}>
          {SECS.map(s=>(
            <button key={s.id} onClick={()=>setSec(s.id)} style={{
              display:'block',width:'100%',textAlign:'left',padding:'8px 9px',
              border:'none',borderRadius:'var(--r-sm)',marginBottom:2,
              background:sec===s.id?'var(--a-glow)':'none',
              color:sec===s.id?'var(--a)':'var(--t1)',
              fontFamily:'var(--ff)',fontSize:11.5,fontWeight:600,cursor:'pointer',
            }}>{s.l}</button>
          ))}

          {/* Theme selector */}
          <div style={{marginTop:16,padding:'0 5px'}}>
            <div style={{fontSize:9.5,fontWeight:700,color:'var(--t2)',textTransform:'uppercase',letterSpacing:'.08em',marginBottom:6}}>
              Theme
            </div>
            {THEMES.map(th=>(
              <button key={th.id} onClick={()=>{
                setTheme(th.id)
                setThemeS(th.id)
              }} style={{
                display:'block',width:'100%',textAlign:'left',
                padding:'6px 9px',border:'none',borderRadius:'var(--r-sm)',marginBottom:2,
                background:theme===th.id?'var(--a-glow)':'none',
                color:theme===th.id?'var(--a)':'var(--t1)',
                fontFamily:'var(--ff)',fontSize:10.5,fontWeight:700,cursor:'pointer',
              }}>{th.label}</button>
            ))}
          </div>

          {/* Language selector */}
          <div style={{marginTop:16,padding:'0 5px'}}>
            <div style={{fontSize:9.5,fontWeight:700,color:'var(--t2)',textTransform:'uppercase',letterSpacing:'.08em',marginBottom:6}}>
              {t('language')}
            </div>
            {(['it','en'] as const).map(l=>(
              <button key={l} onClick={()=>{setLang(l);setLangS(l)}} style={{
                display:'block',width:'100%',textAlign:'left',
                padding:'6px 9px',border:'none',borderRadius:'var(--r-sm)',marginBottom:2,
                background:lang===l?'var(--a-glow)':'none',
                color:lang===l?'var(--a)':'var(--t1)',
                fontFamily:'var(--ff)',fontSize:11,fontWeight:600,cursor:'pointer',
              }}>{l==='it'?'🇮🇹 Italiano':'🇬🇧 English'}</button>
            ))}
          </div>
        </div>

        <div style={{flex:1,overflow:'auto',padding:12}}>

          {sec==='privacy' && priv && <>
            <div className="sec-title">{t('privacy')}</div>
            <TR label={`🛡️ ${t('adBlock')}`}
                desc={bl?.ready ? `${bl.size?.toLocaleString()||0} ${t('adBlockDesc')} — ${bl.count||0} ${t('blocked')}` : t('loading')}
                on={!!priv.adblock} onToggle={()=>togglePriv('adblock')} />
            <TR label={`🔌 ${t('webrtc')}`} desc={t('webrtcDesc')} on={!!priv.webrtc_protect} onToggle={()=>togglePriv('webrtc')} />
            <TR label={`🔐 ${t('doh')}`} desc={t('dohDesc')} on={!!priv.dohEnabled} onToggle={()=>togglePriv('doh')} />
            <TR
              label={`🧅 ${lang==='it' ? 'Tor / SOCKS5 Proxy' : 'Tor / SOCKS5 Proxy'}`}
              desc={priv.tor_enabled
                ? `${lang==='it' ? 'Instradamento via' : 'Routing via'} ${priv.tor_host || '127.0.0.1'}:${priv.tor_port || 9050}`
                : (lang==='it'
                  ? 'Disattivato. Usa un proxy SOCKS5 locale, es. Tor su 127.0.0.1:9050.'
                  : 'Disabled. Use a local SOCKS5 proxy, e.g. Tor on 127.0.0.1:9050.')
              }
              on={!!priv.tor_enabled}
              onToggle={async () => {
                await z()?.setTorProxy({
                  enabled: !priv.tor_enabled,
                  host: priv.tor_host || '127.0.0.1',
                  port: priv.tor_port || 9050,
                })
                z()?.getPrivacy().then(setPriv)
              }}
            />
            <div className="sec-title" style={{marginTop:18}}>User-Agent</div>
            <TR label={`🔄 ${t('uaRotate')}`} desc={t('uaRotateDesc')} on={priv.ua_mode==='rotate'}
              onToggle={async()=>{ await z()?.setUAMode({mode:'rotate'}); z()?.getPrivacy().then(setPriv) }} />
            <TR label={`🌐 ${t('uaDefault')}`} desc={t('uaDefaultDesc')} on={priv.ua_mode==='default'}
              onToggle={async()=>{ await z()?.setUAMode({mode:'default'}); z()?.getPrivacy().then(setPriv) }} />
            <div className="sec-title" style={{marginTop:18}}>Stats</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr',gap:8}}>
              {[[t('blocked'),(bl?.count||0).toLocaleString()],[t('listSize'),(bl?.size||0).toLocaleString()]].map(([k,v])=>(
                <div key={k} style={{padding:12,background:'var(--bg-3)',border:'1px solid var(--b0)',borderRadius:'var(--r-sm)',textAlign:'center'}}>
                  <div style={{fontSize:15,fontWeight:800,color:'var(--a)'}}>{v}</div>
                  <div style={{fontSize:10,color:'var(--t2)',marginTop:2}}>{k}</div>
                </div>
              ))}
            </div>
          </>}

          {sec==='lightning' && <>
            <div className="sec-title">Nostr Wallet Connect</div>
            <p style={{fontSize:12,color:'var(--t1)',lineHeight:1.7,marginBottom:14}}>
              {lang==='it'
                ? 'Connetti il tuo nodo Lightning via NWC. Compatibile con Alby, Zeus, Mutiny, Breez, Phoenix.'
                : 'Connect your Lightning node via NWC. Compatible with Alby, Zeus, Mutiny, Breez, Phoenix.'}
            </p>
            <div style={{background:'var(--bg-3)',border:'1px solid var(--b0)',borderRadius:'var(--r-md)',padding:13}}>
              {(lang==='it'
                ? ['1. Apri Alby.com o Zeus sul tuo nodo','2. Vai in Connections → Aggiungi nuova','3. Copia la stringa nostr+walletconnect://','4. Incollala nel pannello Wallet → NWC']
                : ['1. Open Alby.com or Zeus on your node','2. Go to Connections → Add new','3. Copy the nostr+walletconnect:// string','4. Paste it in Wallet panel → NWC tab']
              ).map((s,i)=>(
                <div key={i} style={{fontSize:12,color:'var(--t1)',marginBottom:5,display:'flex',gap:8}}>
                  <span style={{color:'var(--a)',fontWeight:700}}>{i+1}.</span><span>{s.slice(3)}</span>
                </div>
              ))}
            </div>
          </>}

          {sec==='cashu' && <>
            <div className="sec-title">Cashu Ecash</div>
            <p style={{fontSize:12,color:'var(--t1)',lineHeight:1.7,marginBottom:14}}>
              {lang==='it'
                ? 'Cashu è un protocollo di ecash Chaumiano. I token sono completamente privati.'
                : 'Cashu is a Chaumian ecash protocol. Tokens are completely private.'}
            </p>
            <div style={{background:'var(--green-bg)',border:'1px solid var(--green)',borderRadius:'var(--r-sm)',padding:11}}>
              <div style={{fontSize:11.5,fontWeight:700,color:'var(--green)',marginBottom:4}}>
                {lang==='it'?'Mint consigliati':'Recommended mints'}
              </div>
              {['Minibits','LNbits Legend','Coinos'].map(m=>(
                <div key={m} style={{fontSize:11,color:'var(--green)',marginBottom:2}}>• {m}</div>
              ))}
            </div>
          </>}

          {sec==='nostr' && <NostrSettings lang={lang} />}

          {sec==='v4v' && <>
            <div className="sec-title">{t('v4vTitle')}</div>
            <p style={{fontSize:12,color:'var(--t1)',lineHeight:1.7,marginBottom:14}}>{t('v4vDesc')}</p>
            {v4vS && <>
              <TR label={`💜 ${t('autopay')}`} desc={`${v4vS.amount} ${t('autopayDesc')}`}
                on={v4vS.enabled} onToggle={async()=>{ await z()?.v4vSetAutopay({enabled:!v4vS.enabled}); z()?.v4vGetSettings().then(setV4vS) }} />
              <div className="field" style={{marginTop:14}}>
                <label>{t('boostAmount')}</label>
                <input className="inp" type="number" defaultValue={v4vS.amount}
                  onBlur={async e=>{ await z()?.v4vSetAutopay({amount:parseInt(e.target.value)}); z()?.v4vGetSettings().then(setV4vS) }} />
              </div>
            </>}
          </>}

          {sec==='history' && <HistorySection lang={lang} />}

          {sec==='browser' && <>
            <BrowserProfilesSection lang={lang} />

            <div className="sec-title">{t('searchEngine')}</div>
            <select className="inp" style={{marginBottom:16}}>
              <option>DuckDuckGo</option>
              <option>Kagi</option>
              <option>Brave Search</option>
              <option>SearXNG</option>
            </select>

            <div className="sec-title">{lang==='it'?'Dati browser':'Browser data'}</div>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',
              padding:'10px 0',borderBottom:'1px solid var(--b0)',marginBottom:8}}>
              <div>
                <div style={{fontSize:13,fontWeight:600,color:'var(--t0)'}}>
                  {lang==='it'?'Barra preferiti':'Bookmarks bar'}
                </div>
                <div style={{fontSize:11,color:'var(--t2)'}}>
                  {lang==='it'?'Mostra barra sotto la barra indirizzi':'Show bar below address bar'}
                </div>
              </div>
              <button onClick={() => {
                const cur = localStorage.getItem('showFavBar') !== 'false'
                localStorage.setItem('showFavBar', String(!cur))
                window.dispatchEvent(new CustomEvent('toggle-favbar', { detail: !cur }))
              }} style={{
                padding:'4px 12px', borderRadius:'var(--r-sm)', cursor:'pointer',
                border:'1px solid var(--b1)', fontSize:11, fontWeight:600,
                background: localStorage.getItem('showFavBar') !== 'false' ? 'var(--amber)' : 'var(--bg-3)',
                color: localStorage.getItem('showFavBar') !== 'false' ? '#000' : 'var(--t2)',
              }}>
                {localStorage.getItem('showFavBar') !== 'false' ? (lang==='it'?'Attiva':'On') : (lang==='it'?'Disattiva':'Off')}
              </button>
            </div>
            {[
              {label:t('clearHistory'), desc:t('clearHistoryDesc'), action:()=>z()?.clearHistory()},

              {label:t('clearCookies'), desc:t('clearCookiesDesc'), action:()=>z()?.clearCookies()},
              {label:t('clearCache'),   desc:t('clearCacheDesc'),   action:()=>z()?.clearCache()},
            ].map(item=>(
              <div key={item.label} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 0',borderBottom:'1px solid var(--b0)'}}>
                <div>
                  <div style={{fontSize:12.5,fontWeight:600,color:'var(--t0)'}}>{item.label}</div>
                  <div style={{fontSize:11,color:'var(--t2)'}}>{item.desc}</div>
                </div>
                <button onClick={async()=>{ await item.action(); alert(lang==='it'?'Fatto!':'Done!') }}
                  style={{padding:'6px 12px',border:'1px solid var(--b1)',background:'var(--bg-3)',color:'var(--t1)',borderRadius:'var(--r-sm)',cursor:'pointer',fontFamily:'var(--ff)',fontSize:11,fontWeight:600}}>
                  {t('clearAll')}
                </button>
              </div>
            ))}

            <div className="sec-title" style={{marginTop:20}}>{t('dangerZone')}</div>
            <button onClick={async()=>{
              const ok = window.confirm(t('resetConfirm'))
              if (!ok) return
              await z()?.resetBrowser()
              window.location.reload()
            }} style={{
              width:'100%',padding:'10px',border:'1px solid var(--red)',
              background:'var(--red-bg)',color:'var(--red)',
              borderRadius:'var(--r-sm)',cursor:'pointer',
              fontFamily:'var(--ff)',fontSize:13,fontWeight:700,marginBottom:8,
            }}>🗑️ {t('resetBrowser')}</button>
            <p style={{fontSize:11,color:'var(--t2)'}}>{t('resetBrowserDesc')}</p>
          </>}

          {sec==='about' && <>
            <div style={{textAlign:'center',padding:'16px 0 20px'}}>
              <div style={{fontSize:40,marginBottom:8}}>⚡</div>
              <div style={{fontSize:20,fontWeight:800,color:'var(--t0)',letterSpacing:'-.03em'}}>
                Zap<span style={{color:'var(--a)'}}>Browser</span>
              </div>
              <div style={{fontSize:11.5,color:'var(--t2)',marginTop:4}}>
                v{appVersion || 'unknown'}-beta
              </div>
            </div>

            <div style={{
              padding:12,
              background:'var(--bg-3)',
              border:'1px solid var(--b0)',
              borderRadius:'var(--r-md)',
              marginBottom:14,
            }}>
              <div className="sec-title" style={{marginBottom:8}}>
                {lang==='it'?'Aggiornamenti':'Updates'}
              </div>

              <div style={{fontSize:12,color:'var(--t1)',lineHeight:1.6,marginBottom:10}}>
                {updateInfo
                  ? updateInfo.ok
                    ? updateInfo.updateAvailable
                      ? (lang==='it'
                          ? `Nuova versione disponibile: v${updateInfo.latestVersion}`
                          : `New version available: v${updateInfo.latestVersion}`)
                      : (lang==='it'
                          ? 'Zap Browser è aggiornato.'
                          : 'Zap Browser is up to date.')
                    : (lang==='it'
                        ? `Controllo aggiornamenti non riuscito: ${updateInfo.error}`
                        : `Update check failed: ${updateInfo.error}`)
                  : (lang==='it'
                      ? 'Controlla se è disponibile una nuova versione.'
                      : 'Check whether a new version is available.')}
              </div>

              <div className="act-row">
                <button className="act-btn primary" disabled={checkingUpdate} onClick={checkUpdates}>
                  {checkingUpdate
                    ? (lang==='it'?'Controllo...':'Checking...')
                    : (lang==='it'?'Controlla aggiornamenti':'Check for updates')}
                </button>
                <button className="act-btn" onClick={() => z()?.openReleasesPage?.()}>
                  GitHub Releases
                </button>
              </div>
            </div>

            {[
              ['Version', appVersion || 'unknown'],
              ['Engine','Chromium via Electron BrowserView'],
              ['Lightning','NWC — Nostr Wallet Connect (NIP-47)'],
              ['Ecash','Cashu — Chaumian ecash'],
              ['Nostr','NIP-07 native signer + granular permissions'],
              ['Privacy',`EasyList + EasyPrivacy + uBlock (${(bl?.size||0).toLocaleString()} ${lang==='it'?'domini':'domains'})`],
              ['License','MIT — Free and Open Source'],
              ['Repo','github.com/shadowbipnode/Zap-Browser'],
            ].map(([k,v])=>(
              <div key={k} style={{display:'flex',justifyContent:'space-between',padding:'8px 0',borderBottom:'1px solid var(--b0)',fontSize:12}}>
                <span style={{color:'var(--t2)',fontWeight:600}}>{k}</span>
                <span style={{color:'var(--t1)',textAlign:'right',maxWidth:130, overflow:'hidden', textOverflow:'ellipsis', wordBreak:'break-word'}}>{v}</span>
              </div>
            ))}
          </>}
        </div>
      </div>
    </>
  )
}

// ── Nostr Settings Component ──────────────────────────────────────────────
function NostrSettings({ lang }: { lang: string }) {
  const [profile,  setProfile]  = useState<any>(null)
  const [nsec,     setNsec]     = useState('')
  const [name,     setName]     = useState('')
  const [loading,  setLoading]  = useState(false)
  const [msg,      setMsg]      = useState('')
  const [msgK,     setMsgK]     = useState<'ok'|'err'>('ok')
  const [showImport, setShowImport] = useState(false)

  useEffect(() => {
    z()?.nostrGetProfile().then(setProfile)
  }, [])

  const importNsec = async () => {
    if (!nsec.trim()) return
    setLoading(true); setMsg('')
    try {
      await z()?.nostrImportNsec({ nsec: nsec.trim(), name: name || profile?.name || null })
      // Ricarica profilo dal DB
      const updated = await z()?.nostrGetProfile()
      setProfile(updated)
      setMsg(lang==='it'?'Identità importata con successo! Riavvia il browser per usarla su tutti i siti.':'Identity imported successfully! Restart browser to use it on all sites.')
      setMsgK('ok')
      setNsec(''); setShowImport(false)
    } catch(e: any) {
      setMsg(String(e)); setMsgK('err')
    }
    setLoading(false)
  }

  return (
    <div>
      <div className="sec-title">{lang==='it'?'Profilo attuale':'Current profile'}</div>
      {profile ? (
        <div className="nostr-card" style={{marginBottom:16}}>
          <div className="nostr-av">👤</div>
          <div>
            <div className="nostr-name">{profile.name||profile.npub?.slice(0,22) + '...'}</div>
            <div className="nostr-npub">{profile.npub?.slice(0,24)}...</div>
          </div>
        </div>
      ) : (
        <p style={{fontSize:12,color:'var(--t2)',marginBottom:16}}>
          {lang==='it'?'Nessun profilo configurato':'No profile configured'}
        </p>
      )}

      <div className="sec-title">{lang==='it'?'Importa nuova nsec':'Import new nsec'}</div>
      <p style={{fontSize:11.5,color:'var(--t1)',marginBottom:12,lineHeight:1.6}}>
        {lang==='it'
          ? 'Importa una chiave Nostr esistente. Sostituirà il profilo attuale e pubblicherà i metadati sui relay.'
          : 'Import an existing Nostr key. Will replace the local signing identity used by Zap Browser. No metadata or profile changes will be published to Nostr relays.'}
      </p>

      {!showImport ? (
        <button className="act-btn" onClick={()=>setShowImport(true)}>
          🔑 {lang==='it'?'Importa nsec':'Import nsec'}
        </button>
      ) : (
        <div style={{padding:12,background:'var(--bg-3)',border:'1px solid var(--b0)',borderRadius:'var(--r-md)'}}>
          <div className="field">
            <label>{lang==='it'?'Chiave nsec':'nsec key'}</label>
            <input className="inp inp-mono" type="password" placeholder="nsec1..."
              value={nsec} onChange={e=>setNsec(e.target.value)} />
          </div>
          <div className="field">
            <label>{lang==='it'?'Nome utente (opzionale)':'Username (optional)'}</label>
            <input className="inp" placeholder={profile?.name||'satoshi'}
              value={name} onChange={e=>setName(e.target.value)} />
          </div>
          {msg && <div className={`msg ${msgK}`}>{msg}</div>}
          <div className="act-row">
            <button className="act-btn primary" disabled={loading||!nsec.trim()} onClick={importNsec}>
              {loading?(lang==='it'?'Importazione...':'Importing...'):(lang==='it'?'Importa':'Import')}
            </button>
            <button className="act-btn" onClick={()=>{setShowImport(false);setNsec('');setMsg('')}}>
              {lang==='it'?'Annulla':'Cancel'}
            </button>
          </div>
        </div>
      )}

      <div className="sec-title" style={{marginTop:16}}>Relay</div>
      {['wss://relay.shadowbip.com','wss://relay.damus.io','wss://relay.nostr.band','wss://nos.lol','wss://relay.snort.social','wss://nostr.wine'].map(r=>(
        <div key={r} className="relay-row">
          <span className="relay-dot"/>
          <span className="relay-url">{r}</span>
        </div>
      ))}
    </div>
  )
}

// ── History Component ─────────────────────────────────────────────────────
function HistorySection({ lang }: { lang: string }) {
  const [history, setHistory] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    z()?.getHistory({ limit: 200 }).then((h: any[]) => { setHistory(h||[]); setLoading(false) })
  }, [])

  const clear = async () => {
    const ok = window.confirm(lang==='it'?'Cancellare tutta la cronologia?':'Clear all history?')
    if (!ok) return
    await z()?.clearHistory()
    setHistory([])
  }

  const formatDate = (ts: number) => {
    const d = new Date(ts * 1000)
    const now = new Date()
    const diff = Math.floor((now.getTime() - d.getTime()) / 86400000)
    if (diff === 0) return lang==='it'?'Oggi':'Today'
    if (diff === 1) return lang==='it'?'Ieri':'Yesterday'
    return d.toLocaleDateString(lang==='it'?'it-IT':'en-US')
  }

  // Raggruppa per giorno
  const grouped: Record<string, any[]> = {}
  for (const item of history) {
    const day = formatDate(item.visited_at)
    if (!grouped[day]) grouped[day] = []
    grouped[day].push(item)
  }

  return (
    <div>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14}}>
        <div className="sec-title" style={{margin:0}}>{lang==='it'?'Cronologia':'History'}</div>
        {history.length > 0 && (
          <button onClick={clear} style={{
            padding:'5px 10px',border:'1px solid var(--red)',background:'var(--red-bg)',
            color:'var(--red)',borderRadius:'var(--r-sm)',cursor:'pointer',
            fontFamily:'var(--ff)',fontSize:11,fontWeight:600,
          }}>🗑️ {lang==='it'?'Cancella tutto':'Clear all'}</button>
        )}
      </div>

      {loading && <p style={{fontSize:12,color:'var(--t2)'}}>{lang==='it'?'Caricamento...':'Loading...'}</p>}

      {!loading && history.length === 0 && (
        <p style={{fontSize:12,color:'var(--t2)',textAlign:'center',padding:'24px 0'}}>
          {lang==='it'?'Nessuna cronologia':'No history'}
        </p>
      )}

      {Object.entries(grouped).map(([day, items]) => (
        <div key={day}>
          <div style={{fontSize:10,fontWeight:700,color:'var(--t2)',textTransform:'uppercase',letterSpacing:'.08em',padding:'10px 0 6px'}}>{day}</div>
          {items.map((item, i) => (
            <div key={i} style={{
              display:'flex',alignItems:'center',gap:10,padding:'8px 0',
              borderBottom:'1px solid var(--b0)',cursor:'pointer',
            }}
              onClick={()=>{
                // Naviga alla pagina
                const event = new CustomEvent('navigate-to', { detail: item.url })
                window.dispatchEvent(event)
              }}
            >
              <span style={{fontSize:14,flexShrink:0}}>🌐</span>
              <div style={{flex:1,overflow:'hidden'}}>
                <div style={{fontSize:12.5,fontWeight:600,color:'var(--t0)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
                  {item.title||item.url}
                </div>
                <div style={{fontSize:10,color:'var(--t2)',fontFamily:'var(--mono)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
                  {item.url}
                </div>
              </div>
              <div style={{fontSize:10,color:'var(--t2)',flexShrink:0}}>
                {new Date(item.visited_at*1000).toLocaleTimeString(lang==='it'?'it-IT':'en-US',{hour:'2-digit',minute:'2-digit'})}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
