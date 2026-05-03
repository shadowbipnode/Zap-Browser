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
  const [blocked, setBlocked]   = useState(0)
  const [payment, setPayment]   = useState<any>(null)
  const [paying, setPaying]     = useState(false)

  // Init: crea il primo tab Electron al mount
  useEffect(() => {
    const firstTab = tabs[0]
    if (firstTab && !activeId) {
      setActive(firstTab.id)
      window.zap?.tabCreate({ tabId: firstTab.id, url: '' })
    }
  }, [])

  const activeTab = tabs.find(t => t.id === activeId) || tabs[0]
  const isNew = !activeTab?.url || activeTab.url === 'zap://newtab'

  // Load privacy settings
  useEffect(() => {
    window.zap?.getPrivacy().then(setPrivacy)
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
    setActive(id)
    window.zap?.tabCreate({ tabId: id, url: url || '' })
  }, [addTab, setActive])

  // Switch tab
  const handleSwitchTab = useCallback((id: string) => {
    setActive(id)
    window.zap?.tabSwitch({ tabId: id })
  }, [setActive])

  // Close tab
  const handleCloseTab = useCallback((id: string) => {
    window.zap?.tabClose({ tabId: id })
    closeTab(id)
  }, [closeTab])

  // Navigate
  const handleNavigate = useCallback((url: string) => {
    const tabId = activeId || tabs[0]?.id
    if (!tabId) return
    window.zap?.tabNavigate({ tabId, url }).then((res: any) => {
      if (res?.url) updateTab(tabId, { url: res.url, loading: true })
    })
  }, [activeId, tabs, updateTab])

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
        <div style={{ display:'flex', gap:6, WebkitAppRegion:'no-drag' as any }}>
          <button onClick={() => window.zap?.close()}
            style={{ width:12, height:12, borderRadius:'50%', background:'#ff5f56', border:'none', cursor:'pointer' }} />
          <button onClick={() => window.zap?.minimize()}
            style={{ width:12, height:12, borderRadius:'50%', background:'#ffbd2e', border:'none', cursor:'pointer' }} />
          <button onClick={() => window.zap?.maximize()}
            style={{ width:12, height:12, borderRadius:'50%', background:'#27c93f', border:'none', cursor:'pointer' }} />
        </div>
        <div style={{ flex:1, textAlign:'center', fontSize:11, fontWeight:700, color:'var(--t2)' }}>
          ⚡ Zap Browser
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
            {panel === 'favorites' && <FavoritesPanel onClose={() => setPanel(null)} onNavigate={handleNavigate} />}
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
