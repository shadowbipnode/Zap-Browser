import { useState, useEffect } from 'react'
type WTab = 'nwc'|'lbtc'|'cashu'
interface Mint { url:string; name?:string; balance:number; active:boolean }
const zap = () => (window as any).zap

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
          {(['nwc','lbtc','cashu'] as WTab[]).map(t => (
            <button key={t} className={`w-tab ${tab===t?'active':''}`} onClick={() => setTab(t)}>
              {t==='nwc'?'⚡ NWC':t==='lbtc'?'🔵 L-BTC':'🥜 Cashu'}
            </button>
          ))}
        </div>
        {tab==='nwc'   && <NWCTab />}
        {tab==='lbtc'  && <LBTCTab />}
        {tab==='cashu' && <CashuTab />}
      </div>
    </>
  )
}

function NWCTab() {
  const [connected,setConnected]=useState(false)
  const [balance,setBalance]=useState(0)
  const [action,setAction]=useState<'connect'|'send'|'receive'|null>(null)
  const [nwcUri,setNwcUri]=useState('')
  const [name,setName]=useState('')
  const [invoice,setInvoice]=useState('')
  const [amount,setAmount]=useState('')
  const [desc,setDesc]=useState('')
  const [genInv,setGenInv]=useState('')
  const [loading,setLoading]=useState(false)
  const [msg,setMsg]=useState('')
  const [msgK,setMsgK]=useState<'ok'|'err'>('ok')
  const show=(m:string,k:'ok'|'err'='ok')=>{setMsg(m);setMsgK(k)}

  useEffect(()=>{
    zap()?.nwcIsConnected().then((ok:boolean)=>{
      setConnected(ok)
      if(ok) zap()?.nwcGetBalance().then((r:any)=>setBalance(r?.balance||0))
    })
  },[])

  const connect=async()=>{
    setLoading(true);setMsg('')
    try{ await zap()?.nwcConnect({nwcUri,name:name||'Il mio nodo'}); setConnected(true); setAction(null); show('Connesso! ✓') }
    catch(e:any){show(String(e),'err')}
    setLoading(false)
  }
  const pay=async()=>{
    setLoading(true);setMsg('')
    try{ await zap()?.nwcPayInvoice({invoice}); show('Pagato! ⚡'); setInvoice(''); setAction(null) }
    catch(e:any){show(String(e),'err')}
    setLoading(false)
  }
  const mkInv=async()=>{
    setLoading(true);setMsg('')
    try{ const r=await zap()?.nwcMakeInvoice({amountMsat:parseInt(amount)*1000,description:desc}); setGenInv(r?.invoice||'') }
    catch(e:any){show(String(e),'err')}
    setLoading(false)
  }

  if(!connected) return (
    <div>
      <div className="nwc-bar disconnected">🔌 Nessun nodo connesso</div>
      <p style={{fontSize:12,color:'var(--t1)',lineHeight:1.65,marginBottom:14}}>Connetti il tuo nodo Lightning via NWC. Compatibile con Alby, Zeus, Mutiny.</p>
      {action!=='connect'
        ? <button className="act-btn" onClick={()=>setAction('connect')}>Connetti nodo →</button>
        : <>
            <div className="field"><label>NWC Connection String</label>
              <textarea className="inp inp-mono" rows={3} placeholder="nostr+walletconnect://..." value={nwcUri} onChange={e=>setNwcUri(e.target.value)}/></div>
            <div className="field"><label>Nome</label>
              <input className="inp" placeholder="Il mio Alby" value={name} onChange={e=>setName(e.target.value)}/></div>
            {msg&&<div className={`msg ${msgK}`}>{msg}</div>}
            <div className="act-row">
              <button className="act-btn primary" disabled={loading||!nwcUri} onClick={connect}>{loading?'Connessione...':'Connetti ⚡'}</button>
              <button className="act-btn" onClick={()=>setAction(null)}>Annulla</button>
            </div>
          </>
      }
    </div>
  )

  return (
    <div>
      <div className="nwc-bar connected" style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <span>⚡ Nodo connesso</span>
        <button onClick={async()=>{
          await (window as any).zap?.nwcDisconnect?.()
          setConnected(false)
          setBalance(0)
        }} style={{
          background:'none',border:'1px solid var(--red)',color:'var(--red)',
          borderRadius:'var(--r-sm)',padding:'2px 8px',cursor:'pointer',fontSize:11
        }}>✕ Disconnetti</button>
      </div>
      <div className="bal-card">
        <div className="bal-lbl">Saldo Lightning</div>
        <div className="bal-num">{balance.toLocaleString()}</div>
        <div className="bal-unit">sats</div>
      </div>
      <div className="act-row">
        <button className="act-btn" onClick={()=>setAction('send')}>↑ Invia</button>
        <button className="act-btn" onClick={()=>setAction('receive')}>↓ Invoice</button>
      </div>
      {action==='send'&&<>
        <div className="field"><label>Invoice Lightning</label>
          <textarea className="inp inp-mono" rows={4} placeholder="lnbc..." value={invoice} onChange={e=>setInvoice(e.target.value)}/></div>
        {msg&&<div className={`msg ${msgK}`}>{msg}</div>}
        <div className="act-row">
          <button className="act-btn primary" disabled={loading||!invoice} onClick={pay}>{loading?'Pagando...':'Paga ⚡'}</button>
          <button className="act-btn" onClick={()=>setAction(null)}>Annulla</button>
        </div>
      </>}
      {action==='receive'&&<>
        <div className="field"><label>Importo (sats)</label><input className="inp" type="number" value={amount} onChange={e=>setAmount(e.target.value)}/></div>
        <div className="field"><label>Descrizione</label><input className="inp" value={desc} onChange={e=>setDesc(e.target.value)}/></div>
        <div className="act-row">
          <button className="act-btn primary" disabled={loading||!amount} onClick={mkInv}>{loading?'Creazione...':'Crea Invoice'}</button>
          <button className="act-btn" onClick={()=>setAction(null)}>Annulla</button>
        </div>
        {genInv&&<><div className="copy-box">{genInv}</div>
          <button className="act-btn" style={{marginTop:6}} onClick={()=>navigator.clipboard.writeText(genInv)}>📋 Copia</button></>}
      </>}
    </div>
  )
}

function LBTCTab() {
  return (
    <div>
      <div className="bal-card">
        <div className="bal-lbl">Liquid Bitcoin</div>
        <div className="bal-num">0.00000000</div>
        <div className="bal-unit">L-BTC</div>
      </div>
      <p style={{fontSize:11,color:'var(--t2)',textAlign:'center',marginTop:8}}>🔒 Transazioni confidenziali on-chain</p>
      <p style={{fontSize:12,color:'var(--t1)',marginTop:14,lineHeight:1.6}}>Integrazione L-BTC in sviluppo — richiede libwally-core.</p>
    </div>
  )
}

function CashuTab() {
  const [mints,setMints]=useState<Mint[]>([])
  const [bal,setBal]=useState(0)
  const [action,setAction]=useState<'mints'|null>(null)
  const [newMint,setNewMint]=useState('')
  const [loading,setLoading]=useState(false)
  const [msg,setMsg]=useState('')

  useEffect(()=>{ zap()?.cashuListMints().then(setMints); zap()?.cashuGetBalance().then(setBal) },[])
  const reload=()=>{ zap()?.cashuListMints().then(setMints); zap()?.cashuGetBalance().then(setBal) }

  const addMint=async()=>{
    setLoading(true)
    try{ await zap()?.cashuAddMint({url:newMint}); setNewMint(''); reload() }
    catch(e:any){setMsg(String(e))}
    setLoading(false)
  }

  return (
    <div>
      <div className="bal-card">
        <div className="bal-lbl">Cashu Ecash</div>
        <div className="bal-num">{bal.toLocaleString()}</div>
        <div className="bal-unit">sats</div>
      </div>
      <p style={{fontSize:11,color:'var(--t2)',textAlign:'center',marginBottom:12}}>🥜 Ecash Chaumiano — privato e non tracciabile</p>
      <div className="act-row">
        <button className="act-btn" onClick={()=>setAction('mints')}>🏦 Gestisci Mint</button>
      </div>
      {action==='mints'&&<>
        {mints.map(m=>(
          <div key={m.url} style={{display:'flex',alignItems:'center',gap:8,padding:'8px 0',borderBottom:'1px solid var(--b0)'}}>
            <span style={{width:5,height:5,borderRadius:'50%',background:'var(--green)',display:'block'}}/>
            <div style={{flex:1,fontSize:12,color:'var(--t0)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{m.url.replace('https://','')}</div>
            <button style={{background:'none',border:'none',color:'var(--red)',cursor:'pointer'}}
              onClick={()=>{ zap()?.cashuRemoveMint({url:m.url}); reload() }}>×</button>
          </div>
        ))}
        <div className="field" style={{marginTop:10}}><label>Aggiungi Mint</label>
          <input className="inp" placeholder="https://mint.minibits.cash/Bitcoin" value={newMint} onChange={e=>setNewMint(e.target.value)}/></div>
        <div className="act-row">
          <button className="act-btn primary" disabled={loading||!newMint} onClick={addMint}>Aggiungi</button>
          <button className="act-btn" onClick={()=>setAction(null)}>Chiudi</button>
        </div>
        {msg&&<div className="msg err">{msg}</div>}
      </>}
    </div>
  )
}
