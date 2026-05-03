// src/renderer/components/browser/FavoritesPanel.tsx
import { useState, useEffect } from 'react'

interface Fav { id:number; title:string; url:string; favicon?:string }
interface Props { onClose:()=>void; onNavigate:(url:string)=>void }

export default function FavoritesPanel({ onClose, onNavigate }: Props) {
  const [favs,  setFavs]  = useState<Fav[]>([])
  const [title, setTitle] = useState('')
  const [url,   setUrl]   = useState('')
  const [add,   setAdd]   = useState(false)

  useEffect(() => { load() }, [])
  const load = () => window.zap?.getFavorites().then(setFavs)

  const saveCurrent = async () => {
    // Get current active tab info from DOM title
    const t = document.title || 'Pagina'
    await window.zap?.addFavorite({ title: t, url: '', favicon: null })
    load()
  }

  const saveManual = async () => {
    if (!title.trim() || !url.trim()) return
    await window.zap?.addFavorite({ title: title.trim(), url: url.trim(), favicon: null })
    setTitle(''); setUrl(''); setAdd(false); load()
  }

  const remove = async (id: number) => {
    await window.zap?.removeFavorite({ id }); load()
  }

  return (
    <>
      <div className="panel-hd">
        <span className="panel-hd-title">⭐ Preferiti</span>
        <button className="panel-hd-close" onClick={onClose}>×</button>
      </div>
      <div className="panel-body">
        <div className="act-row" style={{ marginBottom:14 }}>
          <button className="act-btn" onClick={() => setAdd(a => !a)}>+ Aggiungi</button>
        </div>
        {add && (
          <div style={{ padding:12, background:'var(--bg-3)', border:'1px solid var(--b0)', borderRadius:'var(--r-md)', marginBottom:12 }}>
            <div className="field"><label>Titolo</label>
              <input className="inp" value={title} onChange={e => setTitle(e.target.value)} /></div>
            <div className="field"><label>URL</label>
              <input className="inp" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://..." /></div>
            <div className="act-row">
              <button className="act-btn primary" onClick={saveManual}>Salva</button>
              <button className="act-btn" onClick={() => setAdd(false)}>Annulla</button>
            </div>
          </div>
        )}
        {favs.length === 0
          ? <p style={{ fontSize:12, color:'var(--t2)', textAlign:'center', padding:'24px 0' }}>Nessun preferito ancora.</p>
          : favs.map(f => (
            <div key={f.id} className="fav-item" onClick={() => { onNavigate(f.url); onClose() }}>
              <span className="fav-ico">🌐</span>
              <div className="fav-info">
                <div className="fav-title">{f.title}</div>
                <div className="fav-url">{f.url}</div>
              </div>
              <button className="fav-rm" onClick={e => { e.stopPropagation(); remove(f.id) }}>×</button>
            </div>
          ))
        }
      </div>
    </>
  )
}
