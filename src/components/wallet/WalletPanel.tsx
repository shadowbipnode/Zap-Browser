// src/components/wallet/WalletPanel.tsx
import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'

type WTab = 'nwc'|'lbtc'|'cashu'
interface Mint { url:string; name?:string; balance:number; active:boolean }

export default function WalletPanel({ onClose }: { onClose:()=>void }) {
  const [tab, setTab] = useState<WTab>('nwc')
  return (
    <>
      <div className="panel-hd">
        <span className="panel-hd-title">⚡ Wallet</span>
        <button className="panel-hd-close" onClick={onClose}>×</button>
      </div>
      <div className="panel-body">
        <div className="w-tabs">
          {(['nwc','lbtc','cashu'] as WTab[]).map(t=>(
            <button key={t} className={`w-tab ${tab===t?'active':''}`} onClick={()=>setTab(t)}>
              {t==='nwc'?'⚡ NWC':t==='lbtc'?'🔵 L-BTC':'🥜 Cashu'}
            </button>
          ))}
        </div>
        {tab==='nwc'  && <NWCTab />}
        {tab==='lbtc' && <LBTCTab />}
        {tab==='cashu'&& <CashuTab />}
      </div>
    </>
  )
}

/* ─── NWC ─────────────────────────────────────────────────────────────────── */
function NWCTab() {
  const [connected, setConnected] = useState(false)
  const [balance,   setBalance]   = useState(0)
  const [action,    setAction]    = useState<'connect'|'send'|'receive'|null>(null)
  const [nwcUri,    setNwcUri]    = useState('')
  const [name,      setName]      = useState('')
  const [invoice,   setInvoice]   = useState('')
  const [amount,    setAmount]    = useState('')
  const [desc,      setDesc]      = useState('')
  const [genInv,    setGenInv]    = useState('')
  const [loading,   setLoading]   = useState(false)
  const [msg,       setMsg]       = useState('')
  const [msgKind,   setMsgKind]   = useState<'ok'|'err'>('ok')

  useEffect(()=>{
    invoke<boolean>('nwc_is_connected').then(ok=>{
      setConnected(ok)
      if (ok) invoke<number>('nwc_get_balance').then(setBalance).catch(()=>{})
    }).catch(()=>{})
  },[])

  const show = (m:string,k:'ok'|'err'='ok') => { setMsg(m); setMsgKind(k) }

  const connect = async () => {
    setLoading(true); setMsg('')
    try {
      await invoke('nwc_connect',{nwcUri,name:name||'Il mio nodo'})
      setConnected(true); setAction(null); show('Connesso! ✓')
      invoke<number>('nwc_get_balance').then(setBalance).catch(()=>{})
    } catch(e:any) { show(String(e),'err') }
    setLoading(false)
  }

  const pay = async () => {
    setLoading(true); setMsg('')
    try {
      await invoke('nwc_pay_invoice',{invoice})
      show('Pagato! ⚡'); setInvoice(''); setAction(null)
    } catch(e:any) { show(String(e),'err') }
    setLoading(false)
  }

  const mkInvoice = async () => {
    setLoading(true); setMsg('')
    try {
      const inv = await invoke<string>('nwc_make_invoice',{amountMsat:parseInt(amount)*1000,description:desc})
      setGenInv(inv)
    } catch(e:any) { show(String(e),'err') }
    setLoading(false)
  }

  if (!connected) return (
    <div>
      <div className="nwc-bar disconnected">🔌 Nessun nodo connesso</div>
      <p style={{fontSize:12,color:'var(--t1)',lineHeight:1.65,marginBottom:14}}>
        Connetti il tuo nodo Lightning via NWC (Nostr Wallet Connect). Compatibile con Alby, Zeus, Mutiny e qualsiasi wallet NWC.
      </p>
      {action!=='connect'
        ? <button className="act-btn" onClick={()=>setAction('connect')}>Connetti nodo →</button>
        : <>
            <div className="field"><label>NWC Connection String</label>
              <textarea className="inp inp-mono" rows={3} placeholder="nostr+walletconnect://..."
                value={nwcUri} onChange={e=>setNwcUri(e.target.value)} /></div>
            <div className="field"><label>Nome (opzionale)</label>
              <input className="inp" placeholder="Il mio Alby" value={name} onChange={e=>setName(e.target.value)} /></div>
            {msg && <div className={`msg ${msgKind}`}>{msg}</div>}
            <div className="act-row">
              <button className="act-btn primary" disabled={loading||!nwcUri} onClick={connect}>
                {loading?'Connessione...':'Connetti ⚡'}
              </button>
              <button className="act-btn" onClick={()=>setAction(null)}>Annulla</button>
            </div>
          </>
      }
    </div>
  )

  const sats = Math.floor(balance/1000)
  return (
    <div>
      <div className="nwc-bar connected">⚡ Nodo connesso</div>
      <div className="bal-card">
        <div className="bal-lbl">Saldo Lightning</div>
        <div className="bal-num">{sats.toLocaleString()}</div>
        <div className="bal-unit">sats</div>
      </div>
      <div className="act-row">
        <button className="act-btn" onClick={()=>setAction('send')}>↑ Invia</button>
        <button className="act-btn" onClick={()=>setAction('receive')}>↓ Invoice</button>
      </div>
      {action==='send' && <>
        <div className="field"><label>Invoice Lightning</label>
          <textarea className="inp inp-mono" rows={4} placeholder="lnbc..."
            value={invoice} onChange={e=>setInvoice(e.target.value)} /></div>
        {msg && <div className={`msg ${msgKind}`}>{msg}</div>}
        <div className="act-row">
          <button className="act-btn primary" disabled={loading||!invoice} onClick={pay}>
            {loading?'Pagando...':'Paga ⚡'}
          </button>
          <button className="act-btn" onClick={()=>setAction(null)}>Annulla</button>
        </div>
      </>}
      {action==='receive' && <>
        <div className="field"><label>Importo (sats)</label>
          <input className="inp" type="number" placeholder="1000" value={amount} onChange={e=>setAmount(e.target.value)} /></div>
        <div className="field"><label>Descrizione</label>
          <input className="inp" placeholder="Opzionale" value={desc} onChange={e=>setDesc(e.target.value)} /></div>
        <div className="act-row">
          <button className="act-btn primary" disabled={loading||!amount} onClick={mkInvoice}>
            {loading?'Creazione...':'Crea Invoice'}
          </button>
          <button className="act-btn" onClick={()=>setAction(null)}>Annulla</button>
        </div>
        {genInv && <>
          <div className="copy-box">{genInv}</div>
          <button className="act-btn" style={{marginTop:6}} onClick={()=>navigator.clipboard.writeText(genInv)}>
            📋 Copia Invoice
          </button>
        </>}
        {msg && <div className={`msg ${msgKind}`}>{msg}</div>}
      </>}
    </div>
  )
}

/* ─── L-BTC ────────────────────────────────────────────────────────────────── */
function LBTCTab() {
  const [action, setAction] = useState<'send'|'receive'|null>(null)
  const [addr,   setAddr]   = useState('')
  const [amount, setAmount] = useState('')
  const [myAddr, setMyAddr] = useState('')
  const [loading,setLoading]= useState(false)
  const [msg,    setMsg]    = useState('')
  const [msgK,   setMsgK]   = useState<'ok'|'err'>('ok')

  const show = (m:string,k:'ok'|'err'='ok') => {setMsg(m);setMsgK(k)}

  const getAddr = async () => {
    setLoading(true)
    try { setMyAddr(await invoke<string>('lbtc_get_address')) }
    catch(e:any) { show(String(e),'err') }
    setLoading(false)
  }
  const send = async () => {
    setLoading(true); setMsg('')
    try {
      const txid = await invoke<string>('lbtc_send',{address:addr,amountSat:parseInt(amount)})
      show(`Inviato! TXID: ${txid.slice(0,10)}...`)
      setAction(null)
    } catch(e:any) { show(String(e),'err') }
    setLoading(false)
  }

  return (
    <div>
      <div className="bal-card">
        <div className="bal-lbl">Liquid Bitcoin</div>
        <div className="bal-num">0.00000000</div>
        <div className="bal-unit">L-BTC</div>
      </div>
      <p style={{fontSize:11,color:'var(--t2)',textAlign:'center',marginBottom:12}}>
        🔒 Transazioni confidenziali — importi e asset nascosti on-chain
      </p>
      <div className="act-row">
        <button className="act-btn" onClick={()=>setAction('send')}>↑ Invia</button>
        <button className="act-btn" onClick={()=>{setAction('receive');getAddr()}}>↓ Ricevi</button>
      </div>
      {action==='send'&&<>
        <div className="field"><label>Indirizzo Liquid</label><input className="inp" placeholder="ex1q..." value={addr} onChange={e=>setAddr(e.target.value)} /></div>
        <div className="field"><label>Importo (satoshi)</label><input className="inp" type="number" value={amount} onChange={e=>setAmount(e.target.value)} /></div>
        {msg&&<div className={`msg ${msgK}`}>{msg}</div>}
        <div className="act-row">
          <button className="act-btn primary" disabled={loading||!addr||!amount} onClick={send}>{loading?'Invio...':'Invia 🔵'}</button>
          <button className="act-btn" onClick={()=>setAction(null)}>Annulla</button>
        </div>
      </>}
      {action==='receive'&&<>
        {loading?<p style={{fontSize:12,color:'var(--t2)'}}>Generazione...</p>
        :myAddr&&<>
          <div className="copy-box">{myAddr}</div>
          <p style={{fontSize:10.5,color:'var(--t2)',marginTop:6}}>Indirizzo confidenziale — chi invia non può vedere il tuo saldo</p>
          <button className="act-btn" style={{marginTop:8}} onClick={()=>navigator.clipboard.writeText(myAddr)}>📋 Copia indirizzo</button>
        </>}
        <button className="act-btn" style={{marginTop:8}} onClick={()=>setAction(null)}>Chiudi</button>
      </>}
    </div>
  )
}

/* ─── Cashu ─────────────────────────────────────────────────────────────────── */
function CashuTab() {
  const [mints,  setMints]  = useState<Mint[]>([])
  const [bal,    setBal]    = useState(0)
  const [action, setAction] = useState<'send'|'receive'|'mints'|null>(null)
  const [amount, setAmount] = useState('')
  const [token,  setToken]  = useState('')
  const [newMint,setNewMint]= useState('')
  const [genTok, setGenTok] = useState('')
  const [loading,setLoading]= useState(false)
  const [msg,    setMsg]    = useState('')
  const [msgK,   setMsgK]   = useState<'ok'|'err'>('ok')

  useEffect(()=>{
    invoke<Mint[]>('cashu_list_mints').then(setMints).catch(()=>{})
    invoke<number>('cashu_get_balance').then(setBal).catch(()=>{})
  },[])

  const show=(m:string,k:'ok'|'err'='ok')=>{setMsg(m);setMsgK(k)}
  const reload=()=>{
    invoke<Mint[]>('cashu_list_mints').then(setMints).catch(()=>{})
    invoke<number>('cashu_get_balance').then(setBal).catch(()=>{})
  }

  const sendTok=async()=>{
    setLoading(true);setMsg('')
    try { setGenTok(await invoke<string>('cashu_send_token',{amount:parseInt(amount),mintUrl:null})); setAmount('') }
    catch(e:any){show(String(e),'err')}
    setLoading(false)
  }
  const recvTok=async()=>{
    setLoading(true);setMsg('')
    try{
      const n=await invoke<number>('cashu_receive_token',{token})
      show(`Ricevuti ${n} sats! 🥜`); setToken(''); setAction(null); reload()
    }catch(e:any){show(String(e),'err')}
    setLoading(false)
  }
  const addMint=async()=>{
    setLoading(true)
    try{await invoke('cashu_add_mint',{url:newMint});setNewMint('');reload()}
    catch(e:any){show(String(e),'err')}
    setLoading(false)
  }

  return(
    <div>
      <div className="bal-card">
        <div className="bal-lbl">Cashu Ecash</div>
        <div className="bal-num">{bal.toLocaleString()}</div>
        <div className="bal-unit">sats</div>
      </div>
      <p style={{fontSize:11,color:'var(--t2)',textAlign:'center',marginBottom:12}}>
        🥜 Ecash Chaumiano — privato, offline, non tracciabile
      </p>
      <div className="act-row">
        <button className="act-btn" onClick={()=>setAction('send')}>↑ Invia</button>
        <button className="act-btn" onClick={()=>setAction('receive')}>↓ Ricevi</button>
        <button className="act-btn" onClick={()=>setAction('mints')}>🏦 Mint</button>
      </div>
      {action==='send'&&<>
        <div className="field"><label>Importo (sats)</label><input className="inp" type="number" value={amount} onChange={e=>setAmount(e.target.value)} /></div>
        <div className="act-row">
          <button className="act-btn primary" disabled={loading||!amount} onClick={sendTok}>{loading?'Creazione...':'Crea Token'}</button>
          <button className="act-btn" onClick={()=>setAction(null)}>Annulla</button>
        </div>
        {genTok&&<><div className="copy-box">{genTok}</div>
          <button className="act-btn" style={{marginTop:6}} onClick={()=>navigator.clipboard.writeText(genTok)}>📋 Copia Token</button></>}
        {msg&&<div className={`msg ${msgK}`}>{msg}</div>}
      </>}
      {action==='receive'&&<>
        <div className="field"><label>Token Cashu</label>
          <textarea className="inp inp-mono" rows={4} placeholder="cashuA..." value={token} onChange={e=>setToken(e.target.value)} /></div>
        {msg&&<div className={`msg ${msgK}`}>{msg}</div>}
        <div className="act-row">
          <button className="act-btn primary" disabled={loading||!token} onClick={recvTok}>{loading?'Ricezione...':'Ricevi 🥜'}</button>
          <button className="act-btn" onClick={()=>setAction(null)}>Annulla</button>
        </div>
      </>}
      {action==='mints'&&<>
        {mints.length===0?<p style={{fontSize:12,color:'var(--t2)',marginBottom:10}}>Nessun mint configurato.</p>
        :mints.map(m=>(
          <div key={m.url} style={{display:'flex',alignItems:'center',gap:8,padding:'8px 0',borderBottom:'1px solid var(--b0)'}}>
            <span style={{width:5,height:5,borderRadius:'50%',background:m.active?'var(--green)':'var(--t2)',display:'block',flexShrink:0}}/>
            <div style={{flex:1}}>
              <div style={{fontSize:12,fontWeight:600,color:'var(--t0)'}}>{m.name||m.url.replace('https://','')}</div>
              <div style={{fontSize:10,color:'var(--t2)',fontFamily:'var(--mono)'}}>{m.balance} sats</div>
            </div>
          </div>
        ))}
        <div className="field" style={{marginTop:10}}><label>Aggiungi Mint</label>
          <input className="inp" placeholder="https://mint.example.com/..." value={newMint} onChange={e=>setNewMint(e.target.value)} /></div>
        <div className="act-row">
          <button className="act-btn primary" disabled={loading||!newMint} onClick={addMint}>Aggiungi</button>
          <button className="act-btn" onClick={()=>setAction(null)}>Chiudi</button>
        </div>
        {msg&&<div className={`msg ${msgK}`}>{msg}</div>}
      </>}
    </div>
  )
}
