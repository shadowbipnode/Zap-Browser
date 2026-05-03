// src/renderer/components/browser/NewTabPage.tsx
import { useState, KeyboardEvent } from 'react'

const LINKS = [
  { l:'Damus',     url:'https://damus.io',        i:'🟣' },
  { l:'Primal',    url:'https://primal.net',       i:'🟪' },
  { l:'Snort',     url:'https://snort.social',     i:'📡' },
  { l:'Stacker',   url:'https://stacker.news',     i:'📰' },
  { l:'Mempool',   url:'https://mempool.space',    i:'🔷' },
  { l:'LN Markets',url:'https://lnmarkets.com',    i:'📈' },
  { l:'Bitrefill', url:'https://bitrefill.com',    i:'🎁' },
  { l:'Robosats',  url:'https://robosats.com',     i:'🤖' },
]

export default function NewTabPage({ onNavigate }: { onNavigate: (url:string)=>void }) {
  const [q, setQ] = useState('')

  const go = (e: KeyboardEvent) => {
    if (e.key !== 'Enter' || !q.trim()) return
    onNavigate(q.trim())
    setQ('')
  }

  return (
    <div className="nt">
      <div className="nt-logo">
        <span className="nt-bolt">⚡</span>
        <div className="nt-name">Zap<em>Browser</em></div>
      </div>
      <div className="nt-search">
        <span style={{ fontSize:15 }}>🔍</span>
        <input
          placeholder="Cerca o inserisci URL, invoice Lightning, Cashu token..."
          value={q} onChange={e => setQ(e.target.value)} onKeyDown={go}
          autoFocus
        />
      </div>
      <div className="nt-grid">
        {LINKS.map(x => (
          <div key={x.url} className="nt-item" onClick={() => onNavigate(x.url)}>
            <span className="nt-item-ico">{x.i}</span>
            <span className="nt-item-lbl">{x.l}</span>
          </div>
        ))}
      </div>
      <div className="nt-footer">
        <span>🛡️ Ad blocking attivo</span>
        <span>🔌 WebRTC protetto</span>
        <span>🎭 UA in rotazione</span>
      </div>
    </div>
  )
}
