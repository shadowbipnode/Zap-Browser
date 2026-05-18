// src/renderer/pages/BrowserPage.tsx
import { useState, useEffect, useCallback } from 'react'
import { useBrowser } from '../store/browserStore'
import WalletPanel    from '../components/wallet/WalletPanel'
import NostrPanel     from '../components/nostr/NostrPanel'
import FavoritesPanel from '../components/browser/FavoritesPanel'
import SettingsPanel  from '../components/settings/SettingsPanel'
import NewTabPage     from '../components/browser/NewTabPage'
import { useLang } from '../useLang'

export type Panel = 'wallet'|'nostr'|'favorites'|'settings'|null

interface TabState {
  title?: string; url?: string; loading?: boolean
  canGoBack?: boolean; canGoForward?: boolean
}

export default function BrowserPage() {
  const { L } = useLang()
  const { tabs, activeId, addTab, closeTab, setActive, updateTab, navigate } = useBrowser()
  const [panel, setPanel]       = useState<Panel>(null)
  const [addrVal, setAddrVal]   = useState('')
  const [privacy, setPrivacy]   = useState<any>(null)
  const [uaDrop, setUaDrop]     = useState(false)
  const [blocked,  setBlocked]   = useState(0)
  const [favBar,      setFavBar]    = useState<any[]>([])
  const [showFavBar,  setShowFavBar] = useState(() => localStorage.getItem('showFavBar') !== 'false')
  const [favDropOpen, setFavDropOpen] = useState(false)
  const [currentUA, setCurrentUA] = useState('')
  const [payment, setPayment]   = useState<any>(null)
  const [pageNostr, setPageNostr] = useState(false)
  const [v4vInfo,   setV4vInfo]   = useState<any>(null)
  const [blocklistSize, setBlocklistSize] = useState(0)
  const [paying, setPaying]       = useState(false)
  const [suggestions, setSuggestions] = useState<any[]>([])
  const [showSuggest, setShowSuggest] = useState(false)
  const [appVersion, setAppVersion] = useState('')
  const [updateInfo, setUpdateInfo] = useState<any>(null)
  const [showUpdatePopup, setShowUpdatePopup] = useState(false)
  const [popupBlocked, setPopupBlocked] = useState<any>(null)
  const [paymentSuccess, setPaymentSuccess] = useState<any>(null)
  const [incomingPayment, setIncomingPayment] = useState<any>(null)
  const [sitePermOpen, setSitePermOpen] = useState(false)
  const [sitePermissions, setSitePermissions] = useState<any[]>([])

  const activeTab = tabs.find(t => t.id === activeId) || tabs[0]
  const isNew = !activeTab?.url || activeTab.url === 'zap://newtab' || activeTab.url === '' || activeTab.url === ''

  // Load privacy settings
  useEffect(() => {
    window.zap?.getPrivacy().then(setPrivacy)
    const loadFavBar = () => window.zap?.getFavorites().then((f: any[]) => setFavBar(f || []))
    loadFavBar()
    window.addEventListener('favorites-updated', loadFavBar)
    window.zap?.getUAPool().then((pool: string[]) => {
      if (pool && pool.length > 0) setCurrentUA(pool[Math.floor(Math.random() * pool.length)])
    })
    window.zap?.getBlockedCount().then(setBlocked)
    return () => window.removeEventListener('favorites-updated', loadFavBar)
  }, [])

  // Load app version / update status
  useEffect(() => {
    window.zap?.getAppVersion?.().then(setAppVersion)
    window.zap?.checkForUpdates?.().then((info: any) => {
      setUpdateInfo(info)
      if (info?.ok && info?.updateAvailable) setShowUpdatePopup(true)
    }).catch(() => {})
  }, [])

  // Listen to events from main process
  useEffect(() => {
    window.zap?.on('tab-updated', (data: any) => {
      updateTab(data.tabId, {
        title: data.title, url: data.url,
        loading: data.loading,
        canGoBack: data.canGoBack, canGoForward: data.canGoForward,
      })
      if (data.tabId === activeId && data.url) setAddrVal(data.url)
    })
    window.zap?.on('blocked-count', (n: number) => setBlocked(n))
    window.zap?.on('open-new-tab', ({ url }: any) => {
      handleNewTab(url)
    })
    window.zap?.on('payment-detected', (data: any) => setPayment(data))
    window.zap?.on('popup-blocked', (data: any) => {
      setPopupBlocked(data || {})
      setTimeout(() => setPopupBlocked(null), 4500)
    })

    const onPaymentSuccess = (e: any) => {
      setPaymentSuccess((e as CustomEvent).detail || {})
      setTimeout(() => setPaymentSuccess(null), 7000)
    }

    window.addEventListener('zap-payment-success', onPaymentSuccess)


    let lastKnownBalance: number | null = null
    let balanceWatcherTimer: ReturnType<typeof setInterval> | null = null

    const checkBalanceForIncoming = async () => {
      try {
        const connected = await window.zap?.nwcIsConnected?.()
        if (!connected) return

        const r = await window.zap?.nwcGetBalance?.()
        const newBalance = r?.balance || 0

        if (lastKnownBalance === null) {
          lastKnownBalance = newBalance
          return
        }

        if (newBalance > lastKnownBalance) {
          const received = newBalance - lastKnownBalance

          setIncomingPayment({ amount: received })

          setTimeout(() => {
            setIncomingPayment(null)
          }, 7000)
        }

        lastKnownBalance = newBalance
      } catch (_) {}
    }

    checkBalanceForIncoming()
    balanceWatcherTimer = setInterval(checkBalanceForIncoming, 10000)

    // Navigate from history/bookmarks
    const onNavigateTo = (e: any) => {
      handleNavigate((e as CustomEvent).detail)
      setPanel(null)
    }
    window.addEventListener('navigate-to', onNavigateTo)

    // Toggle bookmarks bar
    const onToggleFavBar = (e: any) => setShowFavBar((e as CustomEvent).detail)
    window.addEventListener('toggle-favbar', onToggleFavBar)

    return () => {
      if (balanceWatcherTimer) clearInterval(balanceWatcherTimer)
      window.removeEventListener('navigate-to', onNavigateTo)
      window.removeEventListener('toggle-favbar', onToggleFavBar)
      window.removeEventListener('zap-payment-success', onPaymentSuccess)
    }
  }, [activeId])

  // Sync address bar with active tab
  useEffect(() => {
    setAddrVal(activeTab?.url === 'zap://newtab' ? '' : activeTab?.url || '')
  }, [activeId, activeTab?.url])

  // Notify main of panel state for view resize
  useEffect(() => {
    window.zap?.shellResize({ panelOpen: panel !== null })
  }, [panel])


  const getActiveOrigin = () => {
    try {
      const u = activeTab?.url || ''
      if (!u.startsWith('http://') && !u.startsWith('https://')) return null
      return new URL(u).origin
    } catch (_) {
      return null
    }
  }

  const openSitePermissions = async () => {
    const origin = getActiveOrigin()
    const perms = await window.zap?.nostrListPermissions()
    setSitePermissions((perms || []).filter((p: any) => p.origin === origin))
    setSitePermOpen(false)
    setPanel('nostr')
  }

  const revokeSitePermission = async (origin: string, action: string) => {
    await window.zap?.nostrRemovePermission({ origin, action })
    const perms = await window.zap?.nostrListPermissions()
    setSitePermissions((perms || []).filter((p: any) => p.origin === origin))
  }

  const togglePanel = (p: Panel) => setPanel(prev => prev === p ? null : p)

  // Create a new tab
  const handleNewTab = useCallback((url?: string) => {
    const id = crypto.randomUUID()
    addTab(url || 'zap://newtab', id)
    setActive(id)
    setAddrVal(url || '')
    // Crea tab nel main e poi forza switch
    window.zap?.tabCreate({ tabId: id }).then(() => {
      window.zap?.tabSwitch({ tabId: id })
      if (url && url !== 'zap://newtab') {
        setTimeout(() => window.zap?.tabNavigate({ tabId: id, url }), 100)
      }
    })
  }, [addTab, setActive])

  // Switch tab
  const handleSwitchTab = useCallback((id: string) => {
    const tab = tabs.find(t => t.id === id)
    const url = (!tab?.url || tab.url === 'zap://newtab') ? '' : tab.url
    setActive(id)
    setAddrVal(url)
    setShowSuggest(false)
    // Solo switch — NON navigare di nuovo
    window.zap?.tabSwitch({ tabId: id })
  }, [setActive, tabs])

  // Close tab
  const handleCloseTab = useCallback((id: string) => {
    window.zap?.tabClose({ tabId: id })
    closeTab(id)
  }, [closeTab])

  // Navigate
  const handleNavigate = useCallback((url: string) => {
    if (!activeId) return
    window.zap?.tabNavigate({ tabId: activeId, url }).then((res: any) => {
      if (res?.url) updateTab(activeId, { url: res.url, loading: true })
    })
  }, [activeId, updateTab])

  const handleAddrInput = async (val: string) => {
    setAddrVal(val)
    if (val.length < 2) { setSuggestions([]); setShowSuggest(false); return }
    try {
      const hist = await (window as any).zap?.getHistory({ limit: 500 }) || []
      const q = val.toLowerCase()
      // Dedup per dominio — mostra solo un risultato per dominio
      const seen = new Set<string>()
      const found: any[] = []
      for (const h of hist) {
        try {
          const domain = new URL(h.url).hostname
          if (!seen.has(domain) && (
            domain.toLowerCase().includes(q) ||
            h.title?.toLowerCase().includes(q) ||
            h.url?.toLowerCase().includes(q)
          )) {
            seen.add(domain)
            // Mostra homepage del dominio, non la pagina specifica
            const homeUrl = new URL(h.url).origin
            found.push({ ...h, url: homeUrl, title: domain })
          }
        } catch(_) {}
        if (found.length >= 7) break
      }
      setSuggestions(found)
      setShowSuggest(found.length > 0)
    } catch(e) { console.error('[history] errore:', e) }
  }

  const handleAddrKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') { setShowSuggest(false); return }
    if (e.key !== 'Enter') return
    setShowSuggest(false)
    const v = addrVal.trim()
    // Detect Lightning invoice or Cashu token
    if (v.toLowerCase().startsWith('lnbc') || v.toLowerCase().startsWith('lntb')) {
      setPayment({ type: 'invoice', value: v })
      return
    }
    if (v.toLowerCase().startsWith('cashua')) {
      setPayment({ type: 'cashu', value: v })
      return
    }
    handleNavigate(v)
  }

  const handlePay = async () => {
    if (!payment) return
    setPaying(true)
    try {
      if (payment.type === 'invoice') await window.zap?.nwcPayInvoice({ invoice: payment.value })
      setPayment(null)
    } catch (e) { console.error(e) }
    setPaying(false)
  }

  const toggleAdblock = async () => {
    const p = await window.zap?.setAdblock({ enabled: !privacy?.adblock })
    setPrivacy(p)
  }
  const toggleWebRTC = async () => {
    const p = await window.zap?.setWebRTC({ enabled: !privacy?.webrtc_protect })
    setPrivacy(p)
  }
  const setUAMode = async (mode: string) => {
    await window.zap?.setUAMode({ mode })
    const p = await window.zap?.getPrivacy()
    setPrivacy(p); setUaDrop(false)
  }

  const secIcon = () => {
    const u = activeTab?.url || ''

    if (u.startsWith('https')) return '🔒'
    if (u.startsWith('http:')) return '⚠️'

    return '⚡'
  }

  const currentOrigin = (() => {
    try {
      return new URL(activeTab?.url || '').origin
    } catch (_) {
      return null
    }
  })()

  const nostrAllowed = sitePermissions.some(
    (p:any) => p.origin === currentOrigin
  )

  const blockedRecently = !!popupBlocked

  return (
    <div className="app">
      {/* ── Custom titlebar ───────────────────────────────────────────── */}
      <div style={{
        height: 28, background: 'var(--bg0)',
        display: 'flex', alignItems: 'center',
        WebkitAppRegion: 'drag' as any,
        borderBottom: '1px solid var(--b0)',
        flexShrink: 0, padding: '0 12px',
      }}>
        <div style={{ flex:1, fontSize:11, fontWeight:700, color:'var(--t2)' }}>
          ⚡ Zap Browser
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8, WebkitAppRegion:'no-drag' as any }}>
          <button
            onClick={() => setPanel('settings')}
            title={updateInfo?.updateAvailable ? L('Aggiornamento disponibile','Update available') : L('Versione aggiornata','Up to date')}
            style={{
              height:20,
              padding:'0 9px',
              borderRadius:999,
              border:updateInfo?.updateAvailable ? '1px solid #facc15' : '1px solid #22c55e',
              background:updateInfo?.updateAvailable ? 'rgba(250,204,21,.12)' : 'rgba(34,197,94,.10)',
              color:updateInfo?.updateAvailable ? '#facc15' : '#22c55e',
              fontSize:10.5,
              fontWeight:800,
              cursor:'pointer',
              fontFamily:'var(--ff)',
              display:'flex',
              alignItems:'center',
              gap:5,
            }}
          >
            <span style={{
              width:6,
              height:6,
              borderRadius:'50%',
              background:updateInfo?.updateAvailable ? '#facc15' : '#22c55e',
              boxShadow:updateInfo?.updateAvailable ? '0 0 8px #facc15' : '0 0 8px #22c55e',
            }} />
            {updateInfo?.updateAvailable
              ? `v${appVersion || '...'} → v${updateInfo.latestVersion}`
              : `v${appVersion || '...'}`}
          </button>
          <button onClick={() => (window as any).zap?.openDevTools?.()}
            title="DevTools" style={{ background:'none', border:'none', color:'var(--t2)', fontSize:11, cursor:'pointer', padding:'0 2px', opacity:0.5 }}>🛠</button>
          <button onClick={() => window.zap?.minimize()}
            title={L('Minimizza','Minimize')} style={{ width:13, height:13, borderRadius:'50%', background:'#ffbd2e', border:'none', cursor:'pointer' }} />
          <button onClick={() => window.zap?.maximize()}
            title={L('Ingrandisci','Maximize')} style={{ width:13, height:13, borderRadius:'50%', background:'#27c93f', border:'none', cursor:'pointer' }} />
          <button onClick={() => window.zap?.close()}
            title={L('Chiudi','Close')} style={{ width:13, height:13, borderRadius:'50%', background:'#ff5f56', border:'none', cursor:'pointer' }} />
        </div>
      </div>

      {/* ── Tab bar ──────────────────────────────────────────────────── */}
      <div className="tabbar">
        {tabs.map(t => (
          <div key={t.id} className={`tab ${t.id === activeId ? 'active' : ''}`}
            onClick={() => handleSwitchTab(t.id)}>
            <span className="tab-icon">🌐</span>
            <span className="tab-label">{t.loading ? L('Caricamento...','Loading...') : t.title || L('Nuova Scheda','New Tab')}</span>
            <button className="tab-x" onClick={e => { e.stopPropagation(); handleCloseTab(t.id) }}>×</button>
          </div>
        ))}
        <button className="tab-new" onClick={() => handleNewTab()}>+</button>
      </div>

      {/* ── Toolbar ──────────────────────────────────────────────────── */}
      <div className="toolbar">
        <button className="navbtn" onClick={() => window.zap?.tabBack({ tabId: activeId })}>←</button>
        <button className="navbtn" onClick={() => window.zap?.tabForward({ tabId: activeId })}>→</button>
        <button className="navbtn" onClick={() => window.zap?.tabReload({ tabId: activeId })}>↻</button>

        {/* Address bar */}
        <button
          onClick={() => {
            setAddrVal('')
            updateTab(activeId, { url: 'zap://newtab', title: 'New Tab' })
            window.zap?.tabHome({ tabId: activeId })
          }}
          title="Home"
          style={{ background:'none', border:'none', cursor:'pointer', color:'var(--t2)', fontSize:14, padding:'0 4px', flexShrink:0 }}
        >🏠</button>

        <div style={{
          display:'flex',
          alignItems:'center',
          gap:6,
          marginRight:8,
          marginLeft:4,
          flexShrink:0,
        }}>
          <span title={activeTab?.url?.startsWith('https') ? 'Secure HTTPS connection' : 'Non secure connection'}>
            {secIcon()}
          </span>

          {nostrAllowed && (
            <span
              title="NIP-07 allowed"
              style={{
                color:'var(--a)',
                fontSize:13,
                filter:'drop-shadow(0 0 6px rgba(245,166,35,.45))',
              }}
            >
              ⚡
            </span>
          )}

          {blockedRecently && (
            <span
              title="Popup blocked"
              style={{
                color:'var(--red)',
                fontSize:12,
              }}
            >
              🛡
            </span>
          )}
        </div>
        <div className="addr-wrap" style={{
          cursor:'text',
          position:'relative',
          border: nostrAllowed
            ? '1px solid rgba(245,166,35,.45)'
            : blockedRecently
              ? '1px solid rgba(248,113,113,.35)'
              : undefined,
          boxShadow: nostrAllowed
            ? '0 0 14px rgba(245,166,35,.12)'
            : undefined,
          borderRadius:'var(--r-pill)',
        }}>
          <button
            title="Site permissions"
            onClick={openSitePermissions}
            style={{
              background:'none',
              border:'none',
              cursor:'pointer',
              color:'var(--t2)',
              fontSize:14,
              padding:0,
              marginRight:4,
            }}
          >
            {secIcon()}
          </button>
          <input className="addr-input"
            value={addrVal}
            onChange={e => handleAddrInput(e.target.value)}
            onKeyDown={handleAddrKey}
            onFocus={e => e.target.select()}
            placeholder={L('Cerca o inserisci URL, invoice Lightning, token Cashu...','Search or enter URL, Lightning invoice, Cashu token...')}
            spellCheck={false}
            autoFocus
          />
        </div>

        {/* Site permissions are shown inside the Nostr side panel */}

        {/* 3 privacy buttons */}
        <div className="priv-row">
          <button className={`priv-btn ${privacy?.adblock ? 'on' : 'off'}`} onClick={toggleAdblock}
            title="Ad & tracker blocking">
            🛡️ {blocked > 0 ? blocked.toLocaleString() : 'Block'}
          </button>
          <button className={`priv-btn ${privacy?.webrtc_protect ? 'on' : 'off'}`} onClick={toggleWebRTC}
            title="WebRTC leak prevention">
            🔌 WebRTC
          </button>
          <div style={{ position:'relative' }}>
            <button className="priv-btn ua" onClick={() => setUaDrop(d => !d)}>
              🎭 {privacy?.ua_mode === 'rotate' ? 'UA Auto' : 'UA Default'}
            </button>
            {uaDrop && (
              <div className="ua-drop">
                <button className={`ua-opt ${privacy?.ua_mode === 'rotate' ? 'active' : ''}`}
                  onClick={() => setUAMode('rotate')}>🔄 Auto-rotate (consigliato)</button>
                <button className={`ua-opt ${privacy?.ua_mode === 'default' ? 'active' : ''}`}
                  onClick={() => setUAMode('default')}>🌐 Default browser</button>
                <div className="ua-sep" />
                <button className="ua-opt" onClick={async () => {
                  await window.zap?.rotateUA(); setUaDrop(false)
                }}>🎲 Ruota adesso</button>
              </div>
            )}
          </div>
        </div>

        {/* NIP-07 indicator */}
        {pageNostr && (
          <div title="Questo sito supporta login Nostr (NIP-07)" style={{
            display:'flex', alignItems:'center', gap:4,
            padding:'0 8px', height:29, borderRadius:'var(--r-sm)',
            background:'var(--green-bg)', border:'1px solid var(--green)',
            fontSize:11, fontWeight:700, color:'var(--green)', flexShrink:0,
          }}>
            🟣 NIP-07
          </div>
        )}

        {/* V4V indicator */}
        {v4vInfo?.supported && (
          <button
            title={`Questo sito supporta Value4Value\nClicca per inviare un boost`}
            onClick={() => window.zap?.v4vSendBoost({ amount: 21, message: '⚡ Zap!' })}
            style={{
              display:'flex', alignItems:'center', gap:4,
              padding:'0 8px', height:29, borderRadius:'var(--r-sm)',
              background:'var(--a-glow)', border:'1px solid var(--a)',
              fontSize:11, fontWeight:700, color:'var(--a)',
              cursor:'pointer', flexShrink:0,
            }}>
            💜 Boost
          </button>
        )}

        {/* Panel buttons */}
        <div className="panel-btns">
          <button className={`panel-btn ${panel === 'wallet' ? 'active' : ''}`} onClick={() => togglePanel('wallet')}>⚡ Wallet</button>
          <button className={`panel-btn ${panel === 'nostr' ? 'active' : ''}`} onClick={() => togglePanel('nostr')}>🟣</button>
          <button className={`panel-btn ${panel === 'favorites' ? 'active' : ''}`} onClick={() => togglePanel('favorites')}>⭐</button>
          <button className={`panel-btn ${panel === 'settings' ? 'active' : ''}`} onClick={() => togglePanel('settings')}>⚙️</button>
        </div>
      </div>

      {/* ── Bookmarks bar ────────────────────────────────────────── */}
      {showFavBar && favBar.length > 0 && (() => {
        const MAX = 10
        const visible = favBar.slice(0, MAX)
        const hidden  = favBar.slice(MAX)
        return (
          <div style={{
            display:'flex', alignItems:'center', gap:2,
            padding:'2px 8px', borderBottom:'1px solid var(--b0)',
            background:'var(--bg-1)', flexShrink:0,
            WebkitAppRegion:'no-drag' as any, height:28, position:'relative',
          }}>
            {visible.map((f: any) => (
              <button key={f.id} onClick={() => handleNavigate(f.url)}
                title={f.url}
                style={{
                  background:'none', border:'none', cursor:'pointer',
                  color:'var(--t0)', fontSize:11, padding:'2px 7px',
                  borderRadius:'var(--r-sm)', whiteSpace:'nowrap',
                  display:'flex', alignItems:'center', gap:3, flexShrink:0,
                }}
                onMouseEnter={e => (e.currentTarget.style.background='var(--bg-3)')}
                onMouseLeave={e => (e.currentTarget.style.background='none')}
              >
                🌐 {f.title?.slice(0, 18) || (() => { try { return new URL(f.url).hostname } catch(_) { return f.url } })()}
              </button>
            ))}
            {hidden.length > 0 && (
              <div style={{ position:'relative', marginLeft:'auto', flexShrink:0 }}>
                <button
                  onClick={() => setFavDropOpen(d => !d)}
                  style={{
                    background:'none', border:'none', cursor:'pointer',
                    color:'var(--t2)', fontSize:12, padding:'2px 7px',
                    borderRadius:'var(--r-sm)',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background='var(--bg-3)')}
                  onMouseLeave={e => (e.currentTarget.style.background='none')}
                >» {hidden.length}</button>
                {favDropOpen && (
                  <div style={{
                    position:'absolute', top:24, right:0, zIndex:9999,
                    background:'var(--bg-1)', border:'1px solid var(--b1)',
                    borderRadius:'var(--r-md)', boxShadow:'0 8px 32px rgba(0,0,0,.4)',
                    minWidth:220, maxHeight:300, overflowY:'auto',
                  }}>
                    {hidden.map((f: any) => (
                      <button key={f.id}
                        onClick={() => { handleNavigate(f.url); setFavDropOpen(false) }}
                        style={{
                          display:'block', width:'100%', textAlign:'left',
                          background:'none', border:'none', cursor:'pointer',
                          color:'var(--t0)', fontSize:12, padding:'8px 12px',
                          whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background='var(--bg-3)')}
                        onMouseLeave={e => (e.currentTarget.style.background='none')}
                      >
                        🌐 {f.title || f.url}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })()}

      {/* ── Browser body ─────────────────────────────────────────────── */}
      <div className="app-body">
        {/* New tab page (shown when tab is zap://newtab) */}
        {isNew && (
          <div style={{ flex:1, position:'relative' }}>
            <NewTabPage onNavigate={url => handleNavigate(url)} />
          </div>
        )}
        {/* When not new tab, BrowserView renders here (injected by Electron) */}
        {!isNew && <div style={{ flex:1 }} />}



      {/* Suggestions dropdown */}
        {showSuggest && (
          <div style={{
            position:'fixed', top:114, left:0, right:panel?320:0,
            background:'var(--bg-1)', border:'1px solid var(--b1)',
            zIndex:9999, boxShadow:'0 8px 32px rgba(0,0,0,.5)',
            maxHeight:320, overflowY:'auto',
          }}>
            {suggestions.map((s: any, i: number) => (
              <div key={i} style={{
                display:'flex', alignItems:'center', gap:10,
                padding:'9px 16px', cursor:'pointer',
                borderBottom:'1px solid var(--b0)',
              }}
                onMouseEnter={e=>(e.currentTarget.style.background='var(--bg-3)')}
                onMouseLeave={e=>(e.currentTarget.style.background='')}
                onClick={()=>{ setShowSuggest(false); setAddrVal(s.url); handleNavigate(s.url) }}
              >
                <span>🕑</span>
                <div style={{flex:1,overflow:'hidden'}}>
                  <div style={{fontSize:12.5,fontWeight:600,color:'var(--t0)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{s.title||s.url}</div>
                  <div style={{fontSize:10.5,color:'var(--t2)',fontFamily:'var(--mono)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{s.url}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Side panel */}
        {panel && (
          <div className="side-panel">
            {panel === 'wallet'    && <WalletPanel    onClose={() => setPanel(null)} />}
            {panel === 'nostr'     && <NostrPanel     onClose={() => setPanel(null)} />}
            {panel === 'favorites' && <FavoritesPanel onClose={() => setPanel(null)} onNavigate={handleNavigate} currentUrl={activeTab?.url||''} currentTitle={activeTab?.title||''} />}
            {panel === 'settings'  && <SettingsPanel  onClose={() => setPanel(null)} />}
          </div>
        )}
      </div>

      {showUpdatePopup && updateInfo?.updateAvailable && (
        <div style={{
          position:'fixed',
          top:42,
          right:18,
          zIndex:999999,
          width:320,
          padding:14,
          background:'var(--bg-1)',
          border:'1px solid #facc15',
          borderRadius:'var(--r-md)',
          boxShadow:'0 18px 50px rgba(0,0,0,.55)',
          fontFamily:'var(--ff)',
        }}>
          <div style={{
            fontSize:13,
            fontWeight:900,
            color:'#facc15',
            marginBottom:6,
          }}>
            ⚡ {L('Aggiornamento disponibile','Update available')}
          </div>

          <div style={{
            fontSize:12,
            color:'var(--t1)',
            lineHeight:1.5,
            marginBottom:12,
          }}>
            {L(
              `Stai usando v${appVersion}. È disponibile v${updateInfo.latestVersion}.`,
              `You are using v${appVersion}. Version v${updateInfo.latestVersion} is available.`
            )}
          </div>

          <div style={{display:'flex',gap:8}}>
            <button
              className="act-btn primary"
              onClick={() => window.zap?.openReleasesPage?.()}
            >
              GitHub Releases
            </button>
            <button
              className="act-btn"
              onClick={() => setShowUpdatePopup(false)}
            >
              {L('Chiudi','Close')}
            </button>
          </div>
        </div>
      )}

      {incomingPayment && (
        <div style={{
          position:'fixed',
          bottom:180,
          right:24,
          zIndex:999999,
          width:280,
          padding:14,
          background:'var(--bg-1)',
          border:'1px solid var(--blue)',
          borderRadius:'var(--r-md)',
          boxShadow:'0 18px 50px rgba(0,0,0,.55)',
          fontFamily:'var(--ff)',
        }}>
          <div style={{
            fontSize:13,
            fontWeight:900,
            color:'var(--blue)',
            marginBottom:6,
          }}>
            ⚡ Payment received
          </div>

          <div style={{
            fontSize:22,
            fontWeight:900,
            color:'var(--t0)',
            marginBottom:4,
          }}>
            +{incomingPayment.amount.toLocaleString()} sats
          </div>
        </div>
      )}

      {paymentSuccess && (
        <div style={{
          position:'fixed',
          bottom:90,
          right:24,
          zIndex:999999,
          width:280,
          padding:14,
          background:'var(--bg-1)',
          border:'1px solid var(--green)',
          borderRadius:'var(--r-md)',
          boxShadow:'0 18px 50px rgba(0,0,0,.55)',
          fontFamily:'var(--ff)',
        }}>
          <div style={{fontSize:13,fontWeight:900,color:'var(--green)',marginBottom:6}}>
            ⚡ Payment sent
          </div>

          {paymentSuccess.amount && (
            <div style={{fontSize:22,fontWeight:900,color:'var(--t0)',marginBottom:8}}>
              {paymentSuccess.amount.toLocaleString()} sats
            </div>
          )}

          {paymentSuccess.preimage && (
            <div style={{fontSize:11,color:'var(--t2)',wordBreak:'break-all',lineHeight:1.4}}>
              preimage: {paymentSuccess.preimage.slice(0,24)}...
            </div>
          )}
        </div>
      )}

      {popupBlocked && (
        <div style={{
          position:'fixed',
          top:70,
          right:18,
          zIndex:999999,
          width:300,
          padding:12,
          background:'var(--bg-1)',
          border:'1px solid var(--green)',
          borderRadius:'var(--r-md)',
          boxShadow:'0 14px 40px rgba(0,0,0,.55)',
          fontFamily:'var(--ff)',
        }}>
          <div style={{fontSize:13,fontWeight:900,color:'var(--green)',marginBottom:5}}>
            🛡️ {L('Popup bloccato','Popup blocked')}
          </div>
          <div style={{fontSize:11.5,color:'var(--t1)',lineHeight:1.45,wordBreak:'break-all'}}>
            {popupBlocked.origin || popupBlocked.url || ''}
          </div>
        </div>
      )}

      {/* ── Payment popup ─────────────────────────────────────────────── */}
      {payment && (
        <div className="inv-popup">
          <span className="inv-ico">{payment.type === 'invoice' ? '⚡' : '🥜'}</span>
          <div className="inv-body">
            <div className="inv-type">{payment.type === 'invoice' ? 'Lightning Invoice' : 'Cashu Token'}</div>
            {payment.amount && <div className="inv-sats">{payment.amount.toLocaleString()} sats</div>}
          </div>
          <button className="inv-pay" onClick={handlePay} disabled={paying}>
            {paying ? '...' : payment.type === 'invoice' ? 'Paga ⚡' : 'Ricevi 🥜'}
          </button>
          <button className="inv-dismiss" onClick={() => setPayment(null)}>✕</button>
        </div>
      )}
    </div>
  )
}
