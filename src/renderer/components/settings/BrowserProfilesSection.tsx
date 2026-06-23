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
  const [editingId, setEditingId] = useState('')
  const [editingName, setEditingName] = useState('')
  const [busyId, setBusyId] = useState('')
  const [error, setError] = useState('')

  const copy = lang === 'it'
    ? {
        title: 'Profili browser',
        description: 'Ogni profilo mantiene separati dati dei siti, cache, permessi e identità Nostr.',
        active: 'Profilo attivo',
        activeHint: 'Le nuove schede usano questo profilo.',
        createPlaceholder: 'Nome nuovo profilo',
        create: 'Crea profilo',
        default: 'Predefinito',
        current: 'Attivo',
        switch: 'Passa a questo profilo',
        rename: 'Rinomina',
        save: 'Salva',
        cancel: 'Annulla',
        delete: 'Elimina',
        switchConfirm: (name: string) => `Passare al profilo "${name}"?\n\nLe schede correnti verranno chiuse per evitare di mescolare le sessioni.`,
        deleteConfirm: (name: string, isActive: boolean) => `Eliminare definitivamente il profilo "${name}"?\n\nVerranno rimossi dati dei siti, cache, permessi e identità Nostr.${isActive ? '\n\nPoiché è il profilo attivo, Zap Browser passerà al profilo predefinito.' : ''}`,
        empty: 'Nessun profilo disponibile.',
      }
    : {
        title: 'Browser profiles',
        description: 'Each profile keeps site data, cache, permissions, and Nostr identities separate.',
        active: 'Active profile',
        activeHint: 'New tabs use this profile.',
        createPlaceholder: 'New profile name',
        create: 'Create profile',
        default: 'Default',
        current: 'Active',
        switch: 'Switch to this profile',
        rename: 'Rename',
        save: 'Save',
        cancel: 'Cancel',
        delete: 'Delete',
        switchConfirm: (name: string) => `Switch to "${name}"?\n\nCurrent tabs will close so sessions from different profiles are not mixed.`,
        deleteConfirm: (name: string, isActive: boolean) => `Permanently delete "${name}"?\n\nIts site data, cache, permissions, and Nostr identities will be removed.${isActive ? '\n\nBecause it is active, Zap Browser will switch to the default profile.' : ''}`,
        empty: 'No profiles available.',
      }

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

  const beginRename = (profile: BrowserProfile) => {
    setEditingId(profile.id)
    setEditingName(profile.name)
    setError('')
  }

  const renameProfile = async (profile: BrowserProfile) => {
    const name = editingName.trim()
    if (!name || name === profile.name) {
      setEditingId('')
      setEditingName('')
      return
    }

    setBusyId(profile.id)
    setError('')
    try {
      await z()?.browserProfileRename({ id: profile.id, name })
      setEditingId('')
      setEditingName('')
      await load()
    } catch (err: any) {
      setError(err?.message || 'Failed to rename profile')
    } finally {
      setBusyId('')
    }
  }

  const switchProfile = async (profile: BrowserProfile) => {
    if (active?.id === profile.id || !window.confirm(copy.switchConfirm(profile.name))) return

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
    const isActive = active?.id === profile.id
    if (!window.confirm(copy.deleteConfirm(profile.name, isActive))) return

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
    <div className="profile-manager">
      <div className="settings-page-title">{copy.title}</div>
      <p className="settings-page-description">{copy.description}</p>

      {active && (
        <div className="profile-active-card">
          <div className="profile-avatar">{active.name.slice(0, 1).toUpperCase()}</div>
          <div className="profile-active-copy">
            <span>{copy.active}</span>
            <strong>{active.name}</strong>
            <small>{copy.activeHint}</small>
          </div>
          {Number(active.is_default) === 1 && <span className="settings-badge">{copy.default}</span>}
        </div>
      )}

      <div className="profile-create-row">
        <input
          className="inp"
          value={newName}
          maxLength={120}
          placeholder={copy.createPlaceholder}
          disabled={!!busyId}
          onChange={event => setNewName(event.target.value)}
          onKeyDown={event => {
            if (event.key === 'Enter') createProfile()
          }}
        />
        <button
          className="act-btn primary"
          disabled={!newName.trim() || !!busyId}
          onClick={createProfile}
        >
          {busyId === 'create' ? '…' : copy.create}
        </button>
      </div>

      <div className="profile-list">
        {profiles.length === 0 && <div className="settings-empty">{copy.empty}</div>}
        {profiles.map(profile => {
          const isActive = active?.id === profile.id
          const isDefault = Number(profile.is_default) === 1
          const isEditing = editingId === profile.id
          const isBusy = busyId === profile.id

          return (
            <div key={profile.id} className={`profile-row ${isActive ? 'active' : ''}`}>
              <div className="profile-row-main">
                <div className="profile-avatar small">{profile.name.slice(0, 1).toUpperCase()}</div>
                <div className="profile-details">
                  {isEditing ? (
                    <input
                      className="inp"
                      autoFocus
                      maxLength={120}
                      value={editingName}
                      onChange={event => setEditingName(event.target.value)}
                      onKeyDown={event => {
                        if (event.key === 'Enter') renameProfile(profile)
                        if (event.key === 'Escape') setEditingId('')
                      }}
                    />
                  ) : (
                    <>
                      <strong>{profile.name}</strong>
                      <div className="profile-badges">
                        {isActive && <span className="settings-badge accent">{copy.current}</span>}
                        {isDefault && <span className="settings-badge">{copy.default}</span>}
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="profile-actions">
                {isEditing ? (
                  <>
                    <button className="act-btn primary" disabled={!editingName.trim() || isBusy} onClick={() => renameProfile(profile)}>
                      {copy.save}
                    </button>
                    <button className="act-btn" disabled={isBusy} onClick={() => setEditingId('')}>
                      {copy.cancel}
                    </button>
                  </>
                ) : (
                  <>
                    {!isActive && (
                      <button className="act-btn primary" disabled={!!busyId} onClick={() => switchProfile(profile)}>
                        {copy.switch}
                      </button>
                    )}
                    <button className="act-btn" disabled={!!busyId} onClick={() => beginRename(profile)}>
                      {copy.rename}
                    </button>
                    {!isDefault && (
                      <button className="act-btn danger" disabled={!!busyId} onClick={() => deleteProfile(profile)}>
                        {copy.delete}
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {error && <div className="msg err">{error}</div>}
    </div>
  )
}
