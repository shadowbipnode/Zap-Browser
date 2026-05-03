import { useState, useEffect } from 'react'

interface Profile { pubkey:string; npub:string; name?:string; about?:string; picture?:string; nip05?:string }

export default function NostrPanel({ onClose }: { onClose:()=>void }) {
  const [profile, setProfile] = useState<Profile|null>(null)
  const [relays,  setRelays]  = useState<string[]>([])

  useEffect(() => {
    ;(window as any).zap?.nostrGetProfile().then(setProfile)
    ;(window as any).zap?.nostrGetRelays().then((r: any) => setRelays(Object.keys(r || {})))
  }, [])

  return (
    <>
      <div className="panel-hd">
        <span className="panel-hd-title">🟣 Nostr</span>
        <button className="panel-hd-close" onClick={onClose}>×</button>
      </div>
      <div className="panel-body">
        {!profile ? (
          <p style={{ fontSize:12.5, color:'var(--t1)', lineHeight:1.65 }}>
            Nessuna identità Nostr configurata.
          </p>
        ) : <>
          <div className="nostr-card">
            <div className="nostr-av">
              {profile.picture
                ? <img src={profile.picture} alt="" style={{width:'100%',height:'100%',borderRadius:'50%'}} />
                : '👤'}
            </div>
            <div>
              <div className="nostr-name">{profile.name || 'Anonimo'}</div>
              <div className="nostr-npub">{profile.npub?.slice(0,24)}...</div>
              {profile.nip05 && (
                <div style={{ fontSize:11, color:'var(--green)', marginTop:2 }}>✓ {profile.nip05}</div>
              )}
            </div>
          </div>

          <div style={{
            padding:12, background:'var(--bg-3)', border:'1px solid var(--b0)',
            borderRadius:'var(--r-md)', marginBottom:14
          }}>
            <div className="sec-title" style={{ marginBottom:8 }}>NIP-07 Browser Signer</div>
            <p style={{ fontSize:11.5, color:'var(--t1)', lineHeight:1.65, marginBottom:10 }}>
              Accedi a qualsiasi sito Nostr con un click. La chiave privata non lascia mai il browser.
            </p>
            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
              <span style={{ width:6, height:6, borderRadius:'50%', background:'var(--green)', display:'block' }} />
              <span style={{ fontSize:12, color:'var(--green)', fontWeight:600 }}>Attivo — pronto a firmare</span>
            </div>
          </div>

          <div className="sec-title">Relay ({relays.length})</div>
          {relays.map(r => (
            <div key={r} className="relay-row">
              <span className="relay-dot" />
              <span className="relay-url">{r}</span>
            </div>
          ))}

          <button style={{
            width:'100%', marginTop:14, padding:'9px',
            border:'1px solid var(--b1)', background:'none',
            color:'var(--t1)', borderRadius:'var(--r-sm)',
            cursor:'pointer', fontFamily:'var(--ff)', fontSize:12,
          }} onClick={() => navigator.clipboard.writeText(profile.pubkey)}>
            📋 Copia pubkey
          </button>
        </>}
      </div>
    </>
  )
}
