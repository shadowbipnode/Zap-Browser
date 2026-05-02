// src/components/browser/Toolbar.tsx
import { useState, useEffect, useRef, KeyboardEvent } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { useBrowser } from '../../store/browserStore'
import type { Panel } from '../../pages/BrowserPage'

interface Privacy {
  adblock: boolean; webrtcProtect: boolean
  uaMode: string; currentUa: string
  dohEnabled: boolean; blockedCount: number
}

const detect = (v: string) => {
  const l = v.toLowerCase().trim()
  if (l.startsWith('lnbc')||l.startsWith('lntb')) return 'invoice'
  if (l.startsWith('cashua')||l.startsWith('cashu')) return 'cashu'
  return 'url'
}

interface Props { panel: Panel; onToggle: (p:Panel)=>void }

export default function Toolbar({ panel, onToggle }: Props) {
  const { tabs, activeId, navigate } = useBrowser()
  const active = tabs.find(t=>t.id===activeId)
  const [val,    setVal]    = useState(active?.url||'')
  const [kind,   setKind]   = useState<'invoice'|'cashu'|'url'>('url')
  const [priv,   setPriv]   = useState<Privacy|null>(null)
  const [uaDrop, setUaDrop] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(()=>{ setVal(active?.url||'') },[active?.url])
  useEffect(()=>{
    invoke<Privacy>('get_privacy_status').then(setPriv).catch(console.error)
  },[])

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setVal(e.target.value); setKind(detect(e.target.value) as any)
  }
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key!=='Enter') return
    const k = detect(val)
    if (k==='invoice'||k==='cashu') {
      window.dispatchEvent(new CustomEvent('zap-payment',{detail:{type:k,value:val}}))
    } else {
      navigate(val)
    }
    setKind('url')
  }

  const toggleAdblock = async () => {
    if (!priv) return
    await invoke('set_adblock',{enabled:!priv.adblock})
    setPriv(p=>p?{...p,adblock:!p.adblock}:p)
  }
  const toggleWebRTC = async () => {
    if (!priv) return
    await invoke('set_webrtc_protection',{enabled:!priv.webrtcProtect})
    setPriv(p=>p?{...p,webrtcProtect:!p.webrtcProtect}:p)
  }
  const setUAMode = async (m:string) => {
    const ua = await invoke<string>('set_useragent',{mode:m,custom:null})
    setPriv(p=>p?{...p,uaMode:m,currentUa:ua}:p)
    setUaDrop(false)
  }
  const rotateUA = async () => {
    const ua = await invoke<string>('rotate_useragent')
    setPriv(p=>p?{...p,currentUa:ua}:p)
    setUaDrop(false)
  }

  const secIcon = () => {
    const url = active?.url||''
    if (url.startsWith('https')) return '🔒'
    if (url.startsWith('http:')) return '⚠️'
    return '⚡'
  }

  return (
    <div className="toolbar">
      {/* Nav buttons */}
      <button className="navbtn" title="Indietro">←</button>
      <button className="navbtn" title="Avanti">→</button>
      <button className="navbtn" title="Aggiorna">↻</button>

      {/* Address bar */}
      <div className={`addr-wrap ${kind!=='url'?`detect-${kind}`:''}`} onClick={()=>inputRef.current?.focus()}>
        <span className="addr-icon">{secIcon()}</span>
        <input ref={inputRef} className="addr-input"
          value={val} onChange={onChange} onKeyDown={onKey}
          onFocus={e=>e.target.select()}
          placeholder="Cerca o inserisci URL, invoice Lightning, token Cashu..."
          spellCheck={false} autoCorrect="off" autoCapitalize="off"
        />
        {kind==='invoice' && <span className="detect-chip invoice">⚡ Invoice</span>}
        {kind==='cashu'   && <span className="detect-chip cashu">🥜 Cashu</span>}
      </div>

      {/* ── 3 Privacy buttons ── */}
      <div className="priv-row">
        {/* 1. Ad block */}
        <button
          className={`priv-btn ${priv?.adblock?'on':'off'}`}
          onClick={toggleAdblock}
          title={`Ad blocking: ${priv?.adblock?'ON':'OFF'}\n${priv?.blockedCount?.toLocaleString()||0} bloccati`}
        >
          🛡️ {priv?.blockedCount?priv.blockedCount.toLocaleString():'Block'}
        </button>

        {/* 2. WebRTC */}
        <button
          className={`priv-btn ${priv?.webrtcProtect?'on':'off'}`}
          onClick={toggleWebRTC}
          title="WebRTC leak prevention"
        >
          🔌 WebRTC
        </button>

        {/* 3. User-Agent */}
        <div style={{position:'relative'}}>
          <button className="priv-btn ua" onClick={()=>setUaDrop(d=>!d)}
            title={`User-Agent: ${priv?.uaMode||'rotate'}\n${priv?.currentUa||''}`}>
            🎭 {priv?.uaMode==='rotate'?'UA Auto':priv?.uaMode==='custom'?'UA Custom':'UA Default'}
          </button>
          {uaDrop && (
            <div className="ua-drop">
              {[
                {m:'rotate', l:'🔄 Auto-rotate (consigliato)'},
                {m:'default', l:'🌐 Default browser'},
              ].map(o=>(
                <button key={o.m} className={`ua-opt ${priv?.uaMode===o.m?'active':''}`}
                  onClick={()=>setUAMode(o.m)}>{o.l}</button>
              ))}
              <div className="ua-sep"/>
              <button className="ua-opt" onClick={rotateUA}>🎲 Ruota adesso</button>
            </div>
          )}
        </div>
      </div>

      {/* Panel buttons */}
      <div className="panel-btns">
        <button className={`panel-btn ${panel==='wallet'?'active':''}`}    onClick={()=>onToggle('wallet')}>⚡ Wallet</button>
        <button className={`panel-btn ${panel==='nostr'?'active':''}`}     onClick={()=>onToggle('nostr')}>🟣</button>
        <button className={`panel-btn ${panel==='favorites'?'active':''}`} onClick={()=>onToggle('favorites')}>⭐</button>
        <button className={`panel-btn ${panel==='settings'?'active':''}`}  onClick={()=>onToggle('settings')}>⚙️</button>
      </div>
    </div>
  )
}
