// src/components/settings/SettingsPanel.tsx
import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'

interface Privacy { adblock:boolean; webrtcProtect:boolean; uaMode:string; currentUa:string; dohEnabled:boolean; dohProvider:string; blockedCount:number }
type Sec = 'privacy'|'nwc'|'cashu'|'nostr'|'browser'|'about'

export default function SettingsPanel({ onClose }: { onClose:()=>void }) {
  const [sec,    setSec]   = useState<Sec>('privacy')
  const [priv,   setPriv]  = useState<Privacy|null>(null)

  useEffect(()=>{
    invoke<Privacy>('get_privacy_status').then(setPriv).catch(console.error)
  },[])

  const toggle = async (k:'adblock'|'webrtcProtect') => {
    if (!priv) return
    if (k==='adblock') {
      await invoke('set_adblock',{enabled:!priv.adblock})
      setPriv(p=>p?{...p,adblock:!p.adblock}:p)
    } else {
      await invoke('set_webrtc_protection',{enabled:!priv.webrtcProtect})
      setPriv(p=>p?{...p,webrtcProtect:!p.webrtcProtect}:p)
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
      <div style={{display:'flex',height:'calc(100% - 53px)'}}>
        {/* Left nav */}
        <div style={{width:124,borderRight:'1px solid var(--b0)',padding:'8px 5px',flexShrink:0}}>
          {SECS.map(s=>(
            <button key={s.id} onClick={()=>setSec(s.id)} style={{
              display:'block',width:'100%',textAlign:'left',
              padding:'8px 9px',border:'none',borderRadius:'var(--r-sm)',
              background:sec===s.id?'var(--a-glow)':'none',
              color:sec===s.id?'var(--a)':'var(--t1)',
              fontFamily:'var(--ff)',fontSize:11.5,fontWeight:600,
              cursor:'pointer',marginBottom:2,transition:'all .12s',
            }}>{s.l}</button>
          ))}
        </div>

        {/* Content */}
        <div style={{flex:1,overflow:'auto',padding:14}}>

          {sec==='privacy' && priv && <>
            <div className="sec-title">Protezione Privacy</div>
            <div className="toggle-row">
              <div className="toggle-info">
                <div className="toggle-label">🛡️ Ad & Tracker Blocking</div>
                <div className="toggle-desc">{priv.blockedCount.toLocaleString()} bloccati questa sessione</div>
              </div>
              <div className={`toggle ${priv.adblock?'on':''}`} onClick={()=>toggle('adblock')} />
            </div>
            <div className="toggle-row">
              <div className="toggle-info">
                <div className="toggle-label">🔌 WebRTC Leak Prevention</div>
                <div className="toggle-desc">Previene perdite IP via WebRTC</div>
              </div>
              <div className={`toggle ${priv.webrtcProtect?'on':''}`} onClick={()=>toggle('webrtcProtect')} />
            </div>
            <div className="toggle-row">
              <div className="toggle-info">
                <div className="toggle-label">🔐 DNS over HTTPS</div>
                <div className="toggle-desc">{priv.dohProvider.replace('https://','').split('/')[0]}</div>
              </div>
              <div className={`toggle ${priv.dohEnabled?'on':''}`} />
            </div>
            <div className="sec-title" style={{marginTop:18}}>User-Agent</div>
            {[
              {m:'rotate',  l:'🔄 Auto-rotate', d:'Cambia ogni sessione, si mimetizza'},
              {m:'default', l:'🌐 Default',      d:'Usa UA del sistema'},
            ].map(o=>(
              <div key={o.m} className="toggle-row">
                <div className="toggle-info">
                  <div className="toggle-label">{o.l}</div>
                  <div className="toggle-desc">{o.d}</div>
                </div>
                <div className={`toggle ${priv.uaMode===o.m?'on':''}`}
                  onClick={async()=>{
                    const ua=await invoke<string>('set_useragent',{mode:o.m,custom:null})
                    setPriv(p=>p?{...p,uaMode:o.m,currentUa:ua}:p)
                  }}/>
              </div>
            ))}
            <div className="sec-title" style={{marginTop:18}}>UA Corrente</div>
            <div style={{fontFamily:'var(--mono)',fontSize:9.5,color:'var(--t2)',lineHeight:1.6,wordBreak:'break-word',
              padding:'8px 10px',background:'var(--bg-3)',borderRadius:'var(--r-sm)'}}>
              {priv.currentUa}
            </div>
          </>}

          {sec==='nwc' && <>
            <div className="sec-title">Nostr Wallet Connect</div>
            <p style={{fontSize:12,color:'var(--t1)',lineHeight:1.7,marginBottom:14}}>
              Connetti il tuo nodo Lightning tramite NWC. Compatibile con Alby, Zeus, Mutiny e qualsiasi nodo NWC.
            </p>
            <div style={{background:'var(--bg-3)',border:'1px solid var(--b0)',borderRadius:'var(--r-md)',padding:13,marginBottom:14}}>
              <div style={{fontSize:10,fontWeight:700,color:'var(--t2)',marginBottom:8}}>COME OTTENERE LA NWC STRING</div>
              {['1. Apri Alby o Zeus sul tuo nodo','2. Vai in Connections → Aggiungi nuova','3. Copia la stringa nostr+walletconnect://','4. Incollala nel pannello Wallet → NWC'].map((s,i)=>(
                <div key={i} style={{fontSize:12,color:'var(--t1)',marginBottom:4}}>{s}</div>
              ))}
            </div>
          </>}

          {sec==='cashu' && <>
            <div className="sec-title">Cashu Ecash</div>
            <p style={{fontSize:12,color:'var(--t1)',lineHeight:1.7,marginBottom:14}}>
              Cashu è un protocollo di ecash Chaumiano su Lightning. I token sono totalmente privati — il mint non può collegare invii e ricezioni.
            </p>
            <div className="sec-title">Mint di default</div>
            {[
              {u:'https://mint.minibits.cash/Bitcoin',n:'Minibits'},
              {u:'https://legend.lnbits.com/cashu/api/v1/4gr9Xcmz3XEkUNwiBiQGoC',n:'LNbits Legend'},
            ].map(m=>(
              <div key={m.u} style={{display:'flex',alignItems:'center',gap:8,padding:'9px 0',borderBottom:'1px solid var(--b0)'}}>
                <span style={{width:5,height:5,borderRadius:'50%',background:'var(--green)',display:'block'}}/>
                <div style={{flex:1}}>
                  <div style={{fontSize:12,fontWeight:600,color:'var(--t0)'}}>{m.n}</div>
                  <div style={{fontSize:10,color:'var(--t2)',fontFamily:'var(--mono)'}}>{m.u.replace('https://','')}</div>
                </div>
              </div>
            ))}
            <p style={{fontSize:11,color:'var(--t2)',marginTop:12,lineHeight:1.6}}>
              ⚠️ I mint custodiscono il tuo ecash. Usa solo mint di cui ti fidi.
            </p>
          </>}

          {sec==='nostr' && <>
            <div className="sec-title">Nostr Identity</div>
            <p style={{fontSize:12,color:'var(--t1)',lineHeight:1.7,marginBottom:14}}>
              Zap Browser agisce da firmatario NIP-07 nativo. I siti possono richiedere firme per l'autenticazione — la chiave privata non lascia mai il browser.
            </p>
            <div className="toggle-row">
              <div className="toggle-info">
                <div className="toggle-label">Conferma ogni firma</div>
                <div className="toggle-desc">Chiedi prima di firmare ogni evento</div>
              </div>
              <div className="toggle on"/>
            </div>
          </>}

          {sec==='browser' && <>
            <div className="sec-title">Motore di Ricerca</div>
            <select className="inp" style={{marginBottom:14}}>
              <option>DuckDuckGo (consigliato)</option>
              <option>Kagi (privato, a pagamento)</option>
              <option>Brave Search</option>
              <option>SearXNG (self-hosted)</option>
            </select>
            <div className="sec-title">Pagina iniziale</div>
            <input className="inp" defaultValue="zap://newtab" style={{marginBottom:14}} />
            <div className="sec-title">Firefox user.js</div>
            <p style={{fontSize:12,color:'var(--t1)',lineHeight:1.65}}>
              Zap Browser applica l'Arkenfox user.js (stessa sorgente di Tor Browser, senza Tor). Blocca il fingerprinting, disabilita la telemetria e impone impostazioni privacy rigide.
            </p>
          </>}

          {sec==='about' && <>
            <div style={{textAlign:'center',padding:'18px 0'}}>
              <div style={{fontSize:38,marginBottom:8}}>⚡</div>
              <div style={{fontSize:19,fontWeight:800,color:'var(--t0)',marginBottom:4}}>Zap Browser</div>
              <div style={{fontSize:11.5,color:'var(--t2)',marginBottom:20}}>v0.1.0-alpha</div>
            </div>
            {[
              ['Licenza','MIT — Free and Open Source'],
              ['Engine','WebKit/WebView + Firefox user.js hardening'],
              ['Lightning','NWC (Nostr Wallet Connect, NIP-47)'],
              ['Liquid','libwally-core / Elements'],
              ['Cashu','cashu-ts (Chaumian ecash)'],
              ['Nostr','nostr-sdk + Rust NIP-07 signer'],
              ['Privacy','Arkenfox user.js (Tor Browser patches)'],
              ['Repository','github.com/shadowbipnode/Zap-Browser-'],
            ].map(([k,v])=>(
              <div key={k} style={{display:'flex',justifyContent:'space-between',padding:'8px 0',borderBottom:'1px solid var(--b0)',fontSize:12}}>
                <span style={{color:'var(--t2)',fontWeight:600}}>{k}</span>
                <span style={{color:'var(--t1)',textAlign:'right',maxWidth:175}}>{v}</span>
              </div>
            ))}
          </>}
        </div>
      </div>
    </>
  )
}
