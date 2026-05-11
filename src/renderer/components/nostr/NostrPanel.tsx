import { useState, useEffect } from 'react'

interface Profile {
  pubkey: string
  npub: string
  name?: string
  nip05?: string
}

export default function NostrPanel({ onClose }: { onClose:()=>void }) {
  const [profile, setProfile] = useState<Profile|null>(null)
  const [relays,  setRelays]  = useState<string[]>([])
  const [showImport, setShowImport] = useState(false)
  const [nsec, setNsec] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const load = async () => {
    const p = await window.zap?.nostrGetProfile()
    setProfile(p || null)
    const r = await window.zap?.nostrGetRelays()
    setRelays(Object.keys(r || {}))
  }

  useEffect(() => {
    load()
  }, [])

  const handleImport = async () => {
    setError('')
    const clean = nsec.trim()

    if (!clean) {
      setError('Insert an nsec or hex private key.')
      return
    }

    setBusy(true)
    try {
      await window.zap?.nostrImportNsec({
        nsec: clean,
        name: name.trim() || 'anon',
      })

      setNsec('')
      setName('')
      setShowImport(false)

      await load()
    } catch (err: any) {
      setError(err?.message || 'Failed to import Nostr identity.')
    } finally {
      setBusy(false)
    }
  }

  const handleDisconnect = async () => {
    const ok = window.confirm(
      'Disconnect the current Nostr identity from Zap Browser?\\n\\nThis removes the encrypted local profile from this browser. Make sure you have your nsec backup.'
    )

    if (!ok) return

    setBusy(true)
    setError('')

    try {
      await window.zap?.nostrRemoveProfile()
      setProfile(null)
      setShowImport(true)
    } catch (err: any) {
      setError(err?.message || 'Failed to disconnect profile.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="panel-hd">
        <span className="panel-hd-title">🟣 Nostr</span>
        <button className="panel-hd-close" onClick={onClose}>×</button>
      </div>

      <div className="panel-body">
        {!profile ? (
          <>
            <p style={{ fontSize:12.5, color:'var(--t1)', lineHeight:1.65 }}>
              Nessuna identità Nostr configurata.
            </p>

            <button
              style={{
                width:'100%',
                marginTop:12,
                padding:'10px',
                border:'1px solid var(--a)',
                background:'var(--a-glow)',
                color:'var(--a)',
                borderRadius:'var(--r-sm)',
                cursor:'pointer',
                fontFamily:'var(--ff)',
                fontSize:12,
                fontWeight:700,
              }}
              onClick={() => setShowImport(true)}
            >
              Import Nostr identity
            </button>
          </>
        ) : (
          <>
            <div className="nostr-card">
              <div className="nostr-av">👤</div>
              <div>
                <div className="nostr-name">{profile.name || 'Anonimo'}</div>
                <div className="nostr-npub">{profile.npub?.slice(0,22)}...</div>
                {profile.nip05 && (
                  <div style={{ fontSize:11, color:'var(--green)', marginTop:2 }}>
                    ✓ {profile.nip05}
                  </div>
                )}
              </div>
            </div>

            <div style={{
              padding:12,
              background:'var(--bg-3)',
              border:'1px solid var(--b0)',
              borderRadius:'var(--r-md)',
              marginBottom:14,
            }}>
              <div className="sec-title" style={{ marginBottom:8 }}>
                NIP-07 Browser Signer
              </div>
              <p style={{ fontSize:11.5, color:'var(--t1)', lineHeight:1.65, marginBottom:10 }}>
                Ogni sito può richiedere la tua firma Nostr per il login. La chiave privata non lascia mai il browser.
              </p>
              <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                <span style={{
                  width:6,
                  height:6,
                  borderRadius:'50%',
                  background:'var(--green)',
                  display:'block',
                }} />
                <span style={{ fontSize:12, color:'var(--green)', fontWeight:600 }}>
                  Attivo — pronto a firmare
                </span>
              </div>
            </div>

            <div className="sec-title">Relay ({relays.length})</div>

            {relays.map(r => (
              <div key={r} className="relay-row">
                <span className="relay-dot" />
                <span className="relay-url">{r}</span>
              </div>
            ))}

            <button
              style={{
                width:'100%',
                marginTop:14,
                padding:'9px',
                border:'1px solid var(--b1)',
                background:'none',
                color:'var(--t1)',
                borderRadius:'var(--r-sm)',
                cursor:'pointer',
                fontFamily:'var(--ff)',
                fontSize:12,
              }}
              onClick={() => navigator.clipboard.writeText(profile.pubkey)}
            >
              📋 Copia pubkey
            </button>

            <button
              style={{
                width:'100%',
                marginTop:8,
                padding:'9px',
                border:'1px solid var(--b1)',
                background:'none',
                color:'var(--t1)',
                borderRadius:'var(--r-sm)',
                cursor:'pointer',
                fontFamily:'var(--ff)',
                fontSize:12,
              }}
              onClick={() => setShowImport(v => !v)}
            >
              🔁 Import / replace identity
            </button>

            <button
              style={{
                width:'100%',
                marginTop:8,
                padding:'9px',
                border:'1px solid #7f1d1d',
                background:'rgba(127,29,29,.15)',
                color:'#fca5a5',
                borderRadius:'var(--r-sm)',
                cursor:'pointer',
                fontFamily:'var(--ff)',
                fontSize:12,
              }}
              disabled={busy}
              onClick={handleDisconnect}
            >
              Disconnect profile
            </button>
          </>
        )}

        {showImport && (
          <div style={{
            marginTop:16,
            padding:12,
            background:'var(--bg-3)',
            border:'1px solid var(--b0)',
            borderRadius:'var(--r-md)',
          }}>
            <div className="sec-title" style={{ marginBottom:8 }}>
              Import Nostr identity
            </div>

            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Profile name"
              style={{
                width:'100%',
                marginBottom:8,
                padding:'9px',
                border:'1px solid var(--b1)',
                background:'var(--bg-1)',
                color:'var(--t0)',
                borderRadius:'var(--r-sm)',
                fontFamily:'var(--ff)',
                fontSize:12,
              }}
            />

            <textarea
              value={nsec}
              onChange={e => setNsec(e.target.value)}
              placeholder="nsec... or hex private key"
              rows={4}
              style={{
                width:'100%',
                padding:'9px',
                border:'1px solid var(--b1)',
                background:'var(--bg-1)',
                color:'var(--t0)',
                borderRadius:'var(--r-sm)',
                fontFamily:'var(--mono)',
                fontSize:11,
                resize:'vertical',
              }}
            />

            {error && (
              <div style={{
                marginTop:8,
                color:'#fca5a5',
                fontSize:11.5,
                lineHeight:1.4,
              }}>
                {error}
              </div>
            )}

            <button
              style={{
                width:'100%',
                marginTop:10,
                padding:'9px',
                border:'1px solid var(--a)',
                background:'var(--a-glow)',
                color:'var(--a)',
                borderRadius:'var(--r-sm)',
                cursor:'pointer',
                fontFamily:'var(--ff)',
                fontSize:12,
                fontWeight:700,
              }}
              disabled={busy}
              onClick={handleImport}
            >
              {busy ? 'Importing...' : 'Import identity'}
            </button>
          </div>
        )}
      </div>
    </>
  )
}