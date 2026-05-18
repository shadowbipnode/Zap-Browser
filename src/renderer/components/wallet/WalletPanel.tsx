import { useState, useEffect } from 'react'
import { useLang } from '../../useLang'
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
  const { L } = useLang()
  const [connected,setConnected]=useState(false)
  const [balance,setBalance]=useState(0)
  const [action,setAction]=useState<'connect'|'send'|'receive'|null>(null)
  const [nwcUri,setNwcUri]=useState('')
  const [name,setName]=useState('')
  const [invoice,setInvoice]=useState('')
  const [sendAmount,setSendAmount]=useState('')
  const [sendComment,setSendComment]=useState('')
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

  const isLightningAddress=(v:string)=>/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.trim())

  const pay=async()=>{
    const target=invoice.trim()
    setLoading(true);setMsg('')

    try{
      if(isLightningAddress(target)){
        const sats=parseInt(sendAmount)
        if(!Number.isFinite(sats)||sats<=0) throw new Error(L('Inserisci un importo valido in sats','Enter a valid amount in sats'))

        const params=await zap()?.lnurlFetchPayParams({address:target})
        const amountMsat=sats*1000

        if(amountMsat<params.minSendable||amountMsat>params.maxSendable){
          throw new Error(`${L('Importo fuori range','Amount out of range')}. Min ${Math.ceil(params.minSendable/1000)} sats, max ${Math.floor(params.maxSendable/1000)} sats`)
        }

        const commentAllowed = Number(params.commentAllowed || 0)
        const cleanComment = sendComment.trim()

        const inv=await zap()?.lnurlRequestInvoice({
          callback:params.callback,
          amountMsat,
          comment:commentAllowed > 0 && cleanComment
            ? cleanComment.slice(0, commentAllowed)
            : undefined
        })

        const payResult = await zap()?.nwcPayInvoice({invoice:inv.invoice})

        window.dispatchEvent(new CustomEvent('zap-payment-success', {
          detail: {
            amount: sats,
            preimage: payResult?.preimage || null,
          }
        }))
      }else{
        const decoded = await zap()?.decodeInvoice?.({ bolt11: target })
        const payResult = await zap()?.nwcPayInvoice({invoice:target})

        window.dispatchEvent(new CustomEvent('zap-payment-success', {
          detail: {
            amount: decoded?.amountMsat
              ? Math.floor(decoded.amountMsat / 1000)
              : null,
            preimage: payResult?.preimage || null,
          }
        }))
      }

      const br = await zap()?.nwcGetBalance?.()
      if (br?.balance != null) setBalance(br.balance)

      show(L('Pagato! ⚡','Paid! ⚡'))
      setInvoice('')
      setSendAmount('')
      setSendComment('')
      setAction(null)
    }
    catch(e:any){show(String(e?.message||e),'err')}
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
      <p style={{fontSize:12,color:'var(--t1)',lineHeight:1.65,marginBottom:14}}>{L('Connetti il tuo nodo Lightning via NWC. Compatibile con Alby, Zeus, Mutiny.','Connect your Lightning node via NWC. Compatible with Alby, Zeus, Mutiny.')}</p>
      {action!=='connect'
        ? <button className="act-btn" onClick={()=>setAction('connect')}>{L('Connetti nodo →','Connect node →')}</button>
        : <>
            <div className="field"><label>NWC Connection String</label>
              <textarea className="inp inp-mono" rows={3} placeholder="nostr+walletconnect://..." value={nwcUri} onChange={e=>setNwcUri(e.target.value)}/></div>
            <div className="field"><label>Nome</label>
              <input className="inp" placeholder="Il mio Alby" value={name} onChange={e=>setName(e.target.value)}/></div>
            {msg&&<div className={`msg ${msgK}`}>{msg}</div>}
            <div className="act-row">
              <button className="act-btn primary" disabled={loading||!nwcUri} onClick={connect}>{loading ? L('Connessione...','Connecting...') : L('Connetti ⚡','Connect ⚡')}</button>
              <button className="act-btn" onClick={()=>setAction(null)}>{L('Annulla','Cancel')}</button>
            </div>
          </>
      }
    </div>
  )

  return (
    <div>
      <div className="nwc-bar connected" style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <span>⚡ {L('Nodo connesso','Node connected')}</span>
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
        <div className="bal-lbl">{L('Saldo Lightning','Lightning balance')}</div>
        <div className="bal-num">{balance.toLocaleString()}</div>
        <div className="bal-unit">sats</div>
      </div>
      <div className="act-row">
        <button className="act-btn" onClick={()=>setAction('send')}>↑ {L('Invia','Send')}</button>
        <button className="act-btn" onClick={()=>setAction('receive')}>↓ Invoice</button>
      </div>
      {action==='send'&&<>
        <div className="field"><label>{L('Invoice Lightning o Lightning Address','Lightning invoice or Lightning Address')}</label>
          <textarea className="inp inp-mono" rows={3} placeholder="lnbc... or name@domain.com" value={invoice} onChange={e=>setInvoice(e.target.value)}/></div>

        {isLightningAddress(invoice)&&<>
          <div className="field"><label>{L('Importo (sats)','Amount (sats)')}</label>
            <input className="inp" type="number" min="1" placeholder="21" value={sendAmount} onChange={e=>setSendAmount(e.target.value)}/></div>
          <div className="field"><label>{L('Commento opzionale','Optional comment')}</label>
            <input className="inp" placeholder="Zap from Zap Browser" value={sendComment} onChange={e=>setSendComment(e.target.value)}/></div>
        </>}

        {msg&&<div className={`msg ${msgK}`}>{msg}</div>}
        <div className="act-row">
          <button className="act-btn primary" disabled={loading||!invoice||isLightningAddress(invoice)&&!sendAmount} onClick={pay}>{loading ? L('Pagando...','Paying...') : L('Paga ⚡','Pay ⚡')}</button>
          <button className="act-btn" onClick={()=>setAction(null)}>{L('Annulla','Cancel')}</button>
        </div>
      </>}
      {action==='receive'&&<>
        <div className="field"><label>{L('Importo (sats)','Amount (sats)')}</label><input className="inp" type="number" value={amount} onChange={e=>setAmount(e.target.value)}/></div>
        <div className="field"><label>Descrizione</label><input className="inp" value={desc} onChange={e=>setDesc(e.target.value)}/></div>
        <div className="act-row">
          <button className="act-btn primary" disabled={loading||!amount} onClick={mkInv}>{loading ? L('Creazione...','Creating...') : L('Crea Invoice','Create invoice')}</button>
          <button className="act-btn" onClick={()=>setAction(null)}>{L('Annulla','Cancel')}</button>
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
  const { L } = useLang()
  const [mints,setMints]=useState<Mint[]>([])
  const [bal,setBal]=useState(0)
  const [action,setAction]=useState<'mints'|'deposit'|'receive'|null>(null)
  const [newMint,setNewMint]=useState('')
  const [loading,setLoading]=useState(false)
  const [msg,setMsg]=useState('')
  const [msgK,setMsgK]=useState('ok')
  const [depositAmount,setDepositAmount]=useState('')
  const [depositInvoice,setDepositInvoice]=useState('')
  const [depositQuote,setDepositQuote]=useState('')
  const [depositMint,setDepositMint]=useState('')
  const [receiveToken,setReceiveToken]=useState('')

  useEffect(()=>{ zap()?.cashuListMints().then(setMints); zap()?.cashuGetBalance().then(setBal) },[])
  const reload=()=>{ zap()?.cashuListMints().then(setMints); zap()?.cashuGetBalance().then(setBal) }

  const addMint=async()=>{
    setLoading(true)
    try{ await zap()?.cashuAddMint({url:newMint}); setNewMint(''); reload() }
    catch(e:any){setMsg(String(e))}
    setLoading(false)
  }

  const show=(m:string,k='ok')=>{setMsg(m);setMsgK(k);setTimeout(()=>setMsg(''),4000)}

  const startDeposit=async()=>{
    if (!depositAmount || !depositMint) return
    setLoading(true)
    try{
      const r = await (window as any).zap?.cashuMintTokens({amount:parseInt(depositAmount), mintUrl:depositMint})
      setDepositInvoice(r.invoice)
      setDepositQuote(r.quote)
    } catch(e:any){show(String(e),'err')}
    setLoading(false)
  }

  const checkDeposit=async()=>{
    setLoading(true)
    try{
      const r = await (window as any).zap?.cashuCheckMintQuote({quote:depositQuote, amount:parseInt(depositAmount), mintUrl:depositMint})
      if (r?.ok){ show('Ricevuto! '+r.amount+' sats'); reload(); setAction(null) }
      else show(L('Invoice non ancora pagata — riprova','Invoice not paid yet — retry'),'err')
    } catch(e:any){show(String(e),'err')}
    setLoading(false)
  }

  const doReceive=async()=>{
    setLoading(true)
    try{
      const r = await (window as any).zap?.cashuReceive({token:receiveToken})
      show('Ricevuto '+r.amount+' sats!'); reload(); setReceiveToken(''); setAction(null)
    } catch(e:any){show(String(e),'err')}
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
        <button className="act-btn" onClick={()=>setAction('deposit')}>⚡ Mint da Lightning</button>
        <button className="act-btn" onClick={()=>setAction('receive')}>📥 Ricevi Token</button>
        <button className="act-btn" onClick={()=>setAction('mints')}>🏦 Mint</button>
      </div>
      {action==='deposit'&&<>
        <div className="field"><label>Mint</label>
          <select className="inp" value={depositMint} onChange={e=>setDepositMint(e.target.value)}>
            <option value="">Seleziona mint...</option>
            {mints.map(m=><option key={m.url} value={m.url}>{m.url.replace('https://','')}</option>)}
          </select>
        </div>
        <div className="field"><label>{L('Importo (sats)','Amount (sats)')}</label>
          <input className="inp" type="number" min="1" placeholder="10" value={depositAmount} onChange={e=>setDepositAmount(e.target.value)}/>
        </div>
        {!depositInvoice && <div className="act-row">
          <button className="act-btn primary" disabled={loading||!depositAmount||!depositMint} onClick={startDeposit}>{loading ? '...' : L('Genera Invoice','Generate invoice')}</button>
          <button className="act-btn" onClick={()=>setAction(null)}>{L('Annulla','Cancel')}</button>
        </div>}
        {depositInvoice && <>
          <div className="field"><label>📋 Copia questa invoice e pagala dal tuo wallet Lightning</label>
            <textarea className="inp inp-mono" rows={3} readOnly value={depositInvoice}
              onClick={e=>(e.target as any).select()}/>
          </div>
          <div className="act-row">
            <button className="act-btn primary" disabled={loading} onClick={checkDeposit}>{loading?'...':'✓ Ho pagato'}</button>
            <button className="act-btn" onClick={()=>{setAction(null);setDepositInvoice('');setDepositQuote('')}}>{L('Annulla','Cancel')}</button>
          </div>
        </>}
      </>}
      {action==='receive'&&<>
        <div className="field"><label>Token Cashu (cashuA...)</label>
          <textarea className="inp inp-mono" rows={3} placeholder="cashuA..." value={receiveToken}
            onChange={e=>setReceiveToken(e.target.value)}/>
        </div>
        <div className="act-row">
          <button className="act-btn primary" disabled={loading||!receiveToken} onClick={doReceive}>{loading?'...':'Ricevi'}</button>
          <button className="act-btn" onClick={()=>setAction(null)}>{L('Annulla','Cancel')}</button>
        </div>
      </>}
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
        {msg&&<div className={`msg ${msgK}`}>{msg}</div>}
      </>}
    </div>
  )
}
