// src/components/browser/WebArea.tsx
import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { useBrowser } from '../../store/browserStore'
import NewTabPage from './NewTabPage'

interface Payment { type:'invoice'|'cashu'; value:string; amount?:number; desc?:string }

export default function WebArea() {
  const { tabs, activeId } = useBrowser()
  const active = tabs.find(t=>t.id===activeId)||tabs[0]
  const isNew = !active?.url || active.url==='zap://newtab'
  const [pay,    setPay]    = useState<Payment|null>(null)
  const [paying, setPaying] = useState(false)
  const [paid,   setPaid]   = useState(false)

  useEffect(()=>{
    const h = (e: Event) => {
      const {type,value} = (e as CustomEvent).detail
      if (type==='invoice') {
        invoke<{amountMsat:number;description:string}>('decode_invoice',{bolt11:value})
          .then(d=>setPay({type:'invoice',value,amount:Math.floor(d.amountMsat/1000),desc:d.description}))
          .catch(()=>setPay({type:'invoice',value}))
      } else {
        setPay({type:'cashu',value})
      }
    }
    window.addEventListener('zap-payment', h)
    return () => window.removeEventListener('zap-payment', h)
  },[])

  const doPay = async () => {
    if (!pay) return
    setPaying(true)
    try {
      if (pay.type==='invoice') await invoke('nwc_pay_invoice',{invoice:pay.value})
      else await invoke('cashu_receive_token',{token:pay.value})
      setPaid(true); setTimeout(()=>{setPay(null);setPaid(false)},2000)
    } catch(e){ console.error(e) }
    setPaying(false)
  }

  return (
    <div className="webview-area">
      {isNew
        ? <NewTabPage />
        : <iframe className="webview-frame" src={active?.url}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups" title="web" />
      }
      {pay && (
        <div className="inv-popup">
          <span className="inv-ico">{pay.type==='invoice'?'⚡':'🥜'}</span>
          <div className="inv-body">
            <div className="inv-type">{pay.type==='invoice'?'Lightning Invoice':'Cashu Token'}</div>
            {pay.amount && <div className="inv-sats">{pay.amount.toLocaleString()} <span style={{fontSize:13,fontWeight:400,color:'var(--t2)'}}>sats</span></div>}
            {pay.desc && <div className="inv-desc">{pay.desc}</div>}
          </div>
          <button className="inv-pay" onClick={doPay} disabled={paying||paid}>
            {paid?'✓ Fatto!':paying?'...':pay.type==='invoice'?'Paga ⚡':'Ricevi 🥜'}
          </button>
          <button className="inv-dismiss" onClick={()=>setPay(null)}>✕</button>
        </div>
      )}
    </div>
  )
}
