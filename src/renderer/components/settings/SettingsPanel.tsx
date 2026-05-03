import { useState, useEffect } from 'react'

type Sec = 'privacy'|'nwc'|'cashu'|'nostr'|'browser'|'about'

export default function SettingsPanel({ onClose }: { onClose:()=>void }) {
  const [sec, setSec] = useState<Sec>('privacy')
  const [priv, setPriv] = useState<any>(null)

  useEffect(() => { window.zap?.getPrivacy().then(setPriv) }, [])

  const toggle = async (k: string) => {
    if (!priv) return
    if (k === 'adblock') {
      const p = await window.zap?.setAdblock({ enabled: !priv.adblock })
      setPriv(p)
    } else {
      const p = await window.zap?.setWebRTC({ enabled: !priv.webrtc_protect })
      setPriv(p)
    }
  }

  const SECS: {id:Sec; l:string}[] = [
    {id:'privacy',l:'🔒 Privacy'},
    {id:'nwc',    l:'⚡ Lightning'},
    {id:'cashu',  l:'🥜 Cashu'},
    {id:'nostr',  l:'🟣 Nostr'},
    {id:'browser',l:'🌐 Browser'},
    {id:'about',  l:'ℹ️ Info'},
  ]

  return (
    <>
      <div className="panel-hd">
        <span className="panel-hd-title">⚙️ Impostazioni</span>
        <button className="panel-hd-close" onClick={onClose}>×</button>
      </div>
      <div style={{ display:'flex', height:'calc(100% - 53px)' }}>
        <div style={{ width:124, borderRight:'1px solid var(--b0)', padding:'8px 5px', flexShrink:0 }}>
          {SECS.map(s => (
            <button key={s.id} onClick={() => setSec(s.id)} style={{
              display:'block', width:'100%', textAlign:'left',
              padding:'8px 9px', border:'none', borderRadius:'var(--r-sm)',
              background: sec===s.id ? 'var(--a-glow)' : 'none',
              color: sec===s.id ? 'var(--a)' : 'var(--t1)',
              fontFamily:'var(--ff)', fontSize:11.5, fontWeight:600,
              cursor:'pointer', marginBottom:2, transition:'all .12s',
            }}>{s.l}</button>
          ))}
        </div>
        <div style={{ flex:1, overflow:'auto', padding:14 }}>
          {sec==='privacy' && priv && <>
            <div className="sec-title">Protezione Privacy</div>
            <div className="toggle-row">
              <div><div className="toggle-label">🛡️ Ad & Tracker Blocking</div><div className="toggle-desc">Blocca pubblicità e tracker</div></div>
              <div className={`toggle ${priv.adblock ? 'on' : ''}`} onClick={() => toggle('adblock')} />
            </div>
            <div className="toggle-row">
              <div><div className="toggle-label">🔌 WebRTC Leak Prevention</div><div className="toggle-desc">Previene perdite IP</div></div>
              <div className={`toggle ${priv.webrtc_protect ? 'on' : ''}`} onClick={() => toggle('webrtc')} />
            </div>
            <div className="toggle-row">
              <div><div className="toggle-label">🔐 DNS over HTTPS</div><div className="toggle-desc">Cloudflare</div></div>
              <div className={`toggle ${priv.doh_enabled ? 'on' : ''}`} />
            </div>
          </>}
          {sec==='nwc' && <>
            <div className="sec-title">Nostr Wallet Connect</div>
            <p style={{ fontSize:12, color:'var(--t1)', lineHeight:1.7, marginBottom:14 }}>
              Connetti il tuo nodo Lightning via NWC. Compatibile con Alby, Zeus, Mutiny.
            </p>
            {['1. Apri Alby o Zeus sul tuo nodo','2. Vai in Connections → Aggiungi nuova','3. Copia la stringa nostr+walletconnect://','4. Incollala nel pannello Wallet → NWC'].map((s,i) => (
              <div key={i} style={{ fontSize:12, color:'var(--t1)', marginBottom:6 }}>{s}</div>
            ))}
          </>}
          {sec==='about' && <>
            <div style={{ textAlign:'center', padding:'18px 0' }}>
              <div style={{ fontSize:38, marginBottom:8 }}>⚡</div>
              <div style={{ fontSize:19, fontWeight:800, color:'var(--t0)', marginBottom:4 }}>Zap Browser</div>
              <div style={{ fontSize:11.5, color:'var(--t2)', marginBottom:20 }}>v0.2.0 — Electron</div>
            </div>
            {[
              ['Engine','Chromium (Electron BrowserView)'],
              ['Lightning','NWC (Nostr Wallet Connect, NIP-47)'],
              ['Cashu','Chaumian ecash'],
              ['Nostr','NIP-07 native signer, NIP-06 key derivation'],
              ['Privacy','Ad block + WebRTC block + UA rotation'],
              ['Licenza','MIT — Open Source'],
            ].map(([k,v]) => (
              <div key={k} style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid var(--b0)', fontSize:12 }}>
                <span style={{ color:'var(--t2)', fontWeight:600 }}>{k}</span>
                <span style={{ color:'var(--t1)', textAlign:'right', maxWidth:175 }}>{v}</span>
              </div>
            ))}
          </>}
          {(sec==='cashu'||sec==='nostr'||sec==='browser') && (
            <p style={{ fontSize:12, color:'var(--t1)', lineHeight:1.7 }}>
              Configurazione disponibile nei pannelli dedicati.
            </p>
          )}
        </div>
      </div>
    </>
  )
}
