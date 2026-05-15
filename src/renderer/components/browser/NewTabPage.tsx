import { useState, KeyboardEvent } from 'react'
import { useLang } from '../../useLang'

const LINKS = [
  { l:'Damus',      url:'https://damus.io',           bg:'#1a1033', i:'🟣' },
  { l:'Primal',     url:'https://primal.net',          bg:'#1a1033', i:'🟪' },
  { l:'Snort',      url:'https://snort.social',        bg:'#0d1f2d', i:'📡' },
  { l:'Stacker',    url:'https://stacker.news',        bg:'#1a1a0d', i:'📰' },
  { l:'Mempool',    url:'https://mempool.space',       bg:'#0d1f2d', i:'🔷' },
  { l:'LN Markets', url:'https://lnmarkets.com',       bg:'#0d1a0d', i:'📈' },
  { l:'Bitrefill',  url:'https://bitrefill.com',       bg:'#1a0d1a', i:'🎁' },
  { l:'Robosats',   url:'https://robosats.com',        bg:'#0d1a1a', i:'🤖' },
  { l:'ShadowBip',  url:'https://shadowbip.com',       bg:'#1a1200', i:'⚡' },
]

export default function NewTabPage({ onNavigate }: { onNavigate: (url:string)=>void }) {
  const { L } = useLang()
  const [q, setQ] = useState('')
  const go = (e: KeyboardEvent) => {
    if (e.key !== 'Enter' || !q.trim()) return
    onNavigate(q.trim())
    setQ('')
  }
  return (
    <div style={{
      flex:1, minHeight:'100%',
      background:'linear-gradient(160deg,#0d1b3e 0%,#0a1628 50%,#060d1a 100%)',
      display:'flex', flexDirection:'column', alignItems:'center',
      justifyContent:'center', padding:'40px 20px', position:'relative', overflow:'hidden',
      fontFamily:'system-ui,sans-serif',
    }}>
      {/* Circuiti SVG */}
      <svg style={{position:'absolute',top:0,left:0,width:'100%',height:'100%',opacity:0.2,pointerEvents:'none'}}
        viewBox="0 0 1400 800" preserveAspectRatio="xMidYMid slice">
        <g stroke="#4a90d9" strokeWidth="1" fill="none">
          <line x1="0" y1="120" x2="280" y2="120"/><line x1="280" y1="120" x2="280" y2="200"/>
          <line x1="280" y1="200" x2="420" y2="200"/><circle cx="280" cy="120" r="3" fill="#4a90d9"/>
          <circle cx="420" cy="200" r="3" fill="#4a90d9"/>
          <line x1="1100" y1="80" x2="1400" y2="80"/><line x1="1100" y1="80" x2="1100" y2="160"/>
          <line x1="1100" y1="160" x2="980" y2="160"/><circle cx="1100" cy="80" r="3" fill="#4a90d9"/>
          <line x1="0" y1="450" x2="160" y2="450"/><line x1="160" y1="450" x2="160" y2="560"/>
          <line x1="160" y1="560" x2="80" y2="560"/><circle cx="160" cy="450" r="3" fill="#4a90d9"/>
          <line x1="1240" y1="500" x2="1400" y2="500"/><line x1="1240" y1="500" x2="1240" y2="620"/>
          <circle cx="1240" cy="500" r="3" fill="#4a90d9"/>
          <line x1="580" y1="0" x2="580" y2="80"/><line x1="580" y1="80" x2="700" y2="80"/>
          <circle cx="580" cy="80" r="3" fill="#4a90d9"/>
          <line x1="820" y1="700" x2="820" y2="800"/><line x1="820" y1="700" x2="700" y2="700"/>
          <circle cx="820" cy="700" r="3" fill="#4a90d9"/>
          <line x1="140" y1="280" x2="260" y2="280"/><line x1="260" y1="280" x2="260" y2="360"/>
          <circle cx="260" cy="360" r="3" fill="#f5a623" opacity="0.7"/>
          <line x1="1140" y1="380" x2="1260" y2="380"/><line x1="1260" y1="380" x2="1260" y2="460"/>
          <circle cx="1260" cy="460" r="3" fill="#f5a623" opacity="0.7"/>
          <line x1="400" y1="620" x2="520" y2="620"/><line x1="520" y1="620" x2="520" y2="700"/>
          <circle cx="520" cy="700" r="3" fill="#f5a623" opacity="0.5"/>
          <line x1="900" y1="160" x2="1020" y2="160"/><line x1="1020" y1="160" x2="1020" y2="240"/>
          <circle cx="1020" cy="240" r="3" fill="#4a90d9"/>
        </g>
      </svg>

      {/* Logo */}
      <div style={{display:'flex',flexDirection:'column',alignItems:'center',marginBottom:32,zIndex:1}}>
        <span style={{fontSize:80,lineHeight:1,marginBottom:8,filter:'drop-shadow(0 0 24px #f5a623)'}}>⚡</span>
        <div style={{fontSize:30,fontWeight:700,letterSpacing:8,color:'#fff',textTransform:'uppercase' as any}}>
          ZAP <span style={{color:'#f5a623'}}>BROWSER</span>
        </div>
      </div>

      {/* Search */}
      <div style={{
        display:'flex', alignItems:'center', gap:10,
        background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.15)',
        borderRadius:32, padding:'12px 20px', width:'100%', maxWidth:580,
        marginBottom:36, zIndex:1,
      }}>
        <span style={{color:'rgba(255,255,255,0.4)',fontSize:14}}>🔍</span>
        <input
          style={{background:'none',border:'none',outline:'none',color:'#fff',fontSize:14,width:'100%'}}
          placeholder={L('Cerca o inserisci URL, Invoice Lightning, Cashu Token...','Search or enter URL, Lightning invoice, Cashu token...')}
          value={q} onChange={e => setQ(e.target.value)} onKeyDown={go} autoFocus
        />
      </div>

      {/* Grid */}
      <div style={{
        display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12,
        maxWidth:580, width:'100%', zIndex:1, marginBottom:32,
      }}>
        {LINKS.map(x => (
          <div key={x.url}
            onClick={() => onNavigate(x.url)}
            style={{
              background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)',
              borderRadius:12, padding:'16px 8px 12px',
              display:'flex', flexDirection:'column', alignItems:'center', gap:8,
              cursor:'pointer', transition:'background 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background='rgba(245,166,35,0.12)')}
            onMouseLeave={e => (e.currentTarget.style.background='rgba(255,255,255,0.05)')}
          >
            <div style={{width:40,height:40,borderRadius:10,background:x.bg,display:'flex',alignItems:'center',justifyContent:'center',fontSize:20}}>
              {x.i}
            </div>
            <span style={{fontSize:11,color:'rgba(255,255,255,0.7)',fontWeight:500}}>{x.l}</span>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{display:'flex',gap:20,fontSize:11,color:'rgba(255,255,255,0.35)',zIndex:1}}>
        <span><span style={{color:'#f5a623'}}>● </span>Ad blocking attivo</span>
        <span><span style={{color:'#4a90d9'}}>● </span>WebRTC protetto</span>
        <span><span style={{color:'#a78bfa'}}>● </span>UA in rotazione</span>
      </div>
    </div>
  )
}
