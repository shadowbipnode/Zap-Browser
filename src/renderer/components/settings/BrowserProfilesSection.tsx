import { useEffect, useState } from 'react'

interface BrowserProfile {
  id: string
  name: string
  is_default: number
  last_used_at: number
}

const z = () => (window as any).zap

export default function BrowserProfilesSection({ lang }: { lang: string }) {
  const [profiles, setProfiles] = useState<BrowserProfile[]>([])
  const [active, setActive] = useState<BrowserProfile | null>(null)
  const [newName, setNewName] = useState('')
  const [busyId, setBusyId] = useState('')
  const [error, setError] = useState('')

  const load = async () => {
    const [items, current] = await Promise.all([
      z()?.browserProfileList(),
      z()?.browserProfileActive(),
    ])
    setProfiles(items || [])
    setActive(current || null)
  }

  useEffect(() => {
    load().catch(err => setError(err?.message || String(err)))
  }, [])

  const createProfile = async () => {
    const name = newName.trim()
    if (!name) return

    setBusyId('create')
    setError('')
    try {
      await z()?.browserProfileCreate({ name })
      setNewName('')
      await load()
    } catch (err: any) {
      setError(err?.message || 'Failed to create profile')
    } finally {
      setBusyId('')
    }
  }

  const renameProfile = async (profile: BrowserProfile) => {
    const name = window.prompt(
      lang === 'it' ? 'Nuovo nome del profilo' : 'New profile name',
      profile.name,
    )?.trim()

    if (!name || name === profile.name) return

    setBusyId(profile.id)
    setError('')
    try {
      await z()?.browserProfileRename({ id: profile.id, name })
      await load()
    } catch (err: any) {
      setError(err?.message || 'Failed to rename profile')
    } finally {
      setBusyId('')
    }
  }

  const switchProfile = async (profile: BrowserProfile) => {
    if (active?.id === profile.id) return

    setBusyId(profile.id)
    setError('')
    try {
      const result = await z()?.browserProfileSetActive({ id: profile.id })
      const next = result?.profile || profile
      setActive(next)
      await load()
      window.dispatchEvent(new CustomEvent('browser-profile-changed', { detail: next }))
    } catch (err: any) {
      setError(err?.message || 'Failed to switch profile')
    } finally {
      setBusyId('')
    }
  }

  const deleteProfile = async (profile: BrowserProfile) => {
    const ok = window.confirm(
      lang === 'it'
        ? `Eliminare il profilo "${profile.name}" e i relativi dati dei siti e identità Nostr?`
        : `Delete "${profile.name}" and its site data and Nostr identities?`,
    )
    if (!ok) return

    setBusyId(profile.id)
    setError('')
    try {
      const result = await z()?.browserProfileDelete({ id: profile.id })
      await load()
      if (result?.was_active) {
        window.dispatchEvent(new CustomEvent('browser-profile-changed', {
          detail: result.active_profile,
        }))
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to delete profile')
    } finally {
      setBusyId('')
    }
  }

  return (
    <div style={{marginBottom:20}}>
      <div className="sec-title">
        {lang === 'it' ? 'Profili browser' : 'Browser profiles'}
      </div>
      <p style={{fontSize:11.5,color:'var(--t1)',lineHeight:1.55,marginBottom:12}}>
        {lang === 'it'
          ? 'Ogni profilo usa dati dei siti, cache, permessi e identità Nostr separati.'
          : 'Each profile uses separate site data, cache, permissions, and Nostr identities.'}
      </p>

      <div style={{display:'flex',gap:8,marginBottom:12}}>
        <input
          className="inp"
          value={newName}
          maxLength={120}
          placeholder={lang === 'it' ? 'Nome nuovo profilo' : 'New profile name'}
          onChange={event => setNewName(event.target.value)}
          onKeyDown={event => {
            if (event.key === 'Enter') createProfile()
          }}
        />
        <button
          className="act-btn primary"
          disabled={!newName.trim() || busyId === 'create'}
          onClick={createProfile}
        >
          {lang === 'it' ? 'Crea' : 'Create'}
        </button>
      </div>

      <div style={{border:'1px solid var(--b0)',borderRadius:'var(--r-md)',overflow:'hidden'}}>
        {profiles.map((profile, index) => {
          const isActive = active?.id === profile.id
          const isDefault = Number(profile.is_default) === 1

          return (
            <div
              key={profile.id}
              style={{
                display:'flex',
                alignItems:'center',
                gap:10,
                padding:'10px 11px',
                borderBottom:index === profiles.length - 1 ? 'none' : '1px solid var(--b0)',
                background:isActive ? 'var(--a-glow)' : 'var(--bg-3)',
              }}
            >
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:'flex',alignItems:'center',gap:6}}>
                  <span style={{fontSize:12.5,fontWeight:750,color:isActive ? 'var(--a)' : 'var(--t0)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                    {profile.name}
                  </span>
                  {isActive && (
                    <span style={{fontSize:9,fontWeight:800,color:'var(--a)',textTransform:'uppercase'}}>
                      {lang === 'it' ? 'Attivo' : 'Active'}
                    </span>
                  )}
                  {isDefault && (
                    <span style={{fontSize:9,color:'var(--t2)'}}>
                      {lang === 'it' ? 'Predefinito' : 'Default'}
                    </span>
                  )}
                </div>
              </div>

              {!isActive && (
                <button className="act-btn" disabled={!!busyId} onClick={() => switchProfile(profile)}>
                  {lang === 'it' ? 'Usa' : 'Switch'}
                </button>
              )}
              <button className="act-btn" disabled={!!busyId} onClick={() => renameProfile(profile)}>
                {lang === 'it' ? 'Rinomina' : 'Rename'}
              </button>
              {!isDefault && (
                <button
                  className="act-btn"
                  disabled={!!busyId}
                  style={{color:'#fca5a5'}}
                  onClick={() => deleteProfile(profile)}
                >
                  {lang === 'it' ? 'Elimina' : 'Delete'}
                </button>
              )}
            </div>
          )
        })}
      </div>

      {error && <div className="msg err" style={{marginTop:10}}>{error}</div>}
    </div>
  )
}
