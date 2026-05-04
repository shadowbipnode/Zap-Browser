// src/renderer/pages/BrowserPage.tsx
import { useState, useEffect, useCallback } from 'react'
import { useBrowser } from '../store/browserStore'
import WalletPanel    from '../components/wallet/WalletPanel'
import NostrPanel     from '../components/nostr/NostrPanel'
import FavoritesPanel from '../components/browser/FavoritesPanel'
import SettingsPanel  from '../components/settings/SettingsPanel'
import NewTabPage     from '../components/browser/NewTabPage'

export type Panel = 'wallet'|'nostr'|'favorites'|'settings'|null

interface TabState {
  title?: string; url?: string; loading?: boolean
  canGoBack?: boolean; canGoForward?: boolean
}

export default function BrowserPage() {
  const { tabs, activeId, addTab, closeTab, setActive, updateTab, navigate } = useBrowser()
  const [panel, setPanel]       = useState<Panel>(null)
  const [addrVal, setAddrVal]   = useState('')
  const [privacy, setPrivacy]   = useState<any>(null)
  const [uaDrop, setUaDrop]     = useState(false)
  const [blocked,  setBlocked]   = useState(0)
  const [currentUA, setCurrentUA] = useState('')
  const [payment, setPayment]   = useState<any>(null)
  const [pageNostr, setPageNostr] = useState(false)
  const [v4vInfo,   setV4vInfo]   = useState<any>(null)
  const [blocklistSize, setBlocklistSize] = useState(0)
  const [paying, setPaying]     = useState(false)

  const activeTab = tabs.find(t => t.id === activeId) || tabs[0]
  const isNew = !activeTab?.url || activeTab.url === 'zap://newtab' || activeTab.url === '' || activeTab.url === ''

  // Load privacy settings
  useEffect(() => {
    window.zap?.getPrivacy().then(setPrivacy)
    window.zap?.getUAPool().then((pool: string[]) => {
      if (pool && pool.length > 0) setCurrentUA(pool[Math.floor(Math.random() * pool.length)])
    })
    window.zap?.getBlockedCount().then(setBlocked)
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
    window.zap?.on('payment-detected', (data: any) => setPayment(data))
  }, [activeId])

  // Sync address bar with active tab
  useEffect(() => {
    setAddrVal(activeTab?.url === 'zap://newtab' ? '' : activeTab?.url || '')
  }, [activeId, activeTab?.url])

  // Notify main of panel state for view resize
  useEffect(() => {
    window.zap?.shellResize({ panelOpen: panel !== null })
  }, [panel])

  const togglePanel = (p: Panel) => setPanel(prev => prev === p ? null : p)

  // Create a new tab
  const handleNewTab = useCallback((url?: string) => {
    const id = crypto.randomUUID()
    addTab(url || 'zap://newtab')
    window.zap?.tabCreate({ tabId: id, url: url || '' })
    setActive(id)
  }, [addTab, setActive])

  // Switch tab
  const handleSwitchTab = useCallback((id: string) => {
    const tab = tabs.find(t => t.id === id)
    const url = (!tab?.url || tab.url === 'zap://newtab') ? '' : tab.url
    setActive(id)
    setAddrVal(url)
    window.zap?.tabSwitch({ tabId: id, url })
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

  const handleAddrKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return
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
          <button onClick={() => (window as any).zap?.openDevTools?.()}
            title="DevTools" style={{ background:'none', border:'none', color:'var(--t2)', fontSize:11, cursor:'pointer', padding:'0 2px', opacity:0.5 }}>🛠</button>
          <button onClick={() => window.zap?.minimize()}
            title="Minimizza" style={{ width:13, height:13, borderRadius:'50%', background:'#ffbd2e', border:'none', cursor:'pointer' }} />
          <button onClick={() => window.zap?.maximize()}
            title="Ingrandisci" style={{ width:13, height:13, borderRadius:'50%', background:'#27c93f', border:'none', cursor:'pointer' }} />
          <button onClick={() => window.zap?.close()}
            title="Chiudi" style={{ width:13, height:13, borderRadius:'50%', background:'#ff5f56', border:'none', cursor:'pointer' }} />
        </div>
      </div>

      {/* ── Tab bar ──────────────────────────────────────────────────── */}
      <div className="tabbar">
        {tabs.map(t => (
          <div key={t.id} className={`tab ${t.id === activeId ? 'active' : ''}`}
            onClick={() => handleSwitchTab(t.id)}>
            <span className="tab-icon">🌐</span>
            <span className="tab-label">{t.loading ? 'Caricamento...' : t.title || 'Nuova Scheda'}</span>
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
        <div className="addr-wrap" style={{ cursor:'text' }}>
          <span className="addr-icon">{secIcon()}</span>
          <input className="addr-input"
            value={addrVal}
            onChange={e => setAddrVal(e.target.value)}
            onKeyDown={handleAddrKey}
            onFocus={e => e.target.select()}
            placeholder="Cerca o inserisci URL, invoice Lightning, token Cashu..."
            spellCheck={false}
          />
        </div>

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
