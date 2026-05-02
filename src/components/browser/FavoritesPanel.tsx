// src/components/browser/FavoritesPanel.tsx
import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { useBrowser } from '../../store/browserStore'

interface Fav { id:number; title:string; url:string; favicon?:string }

export default function FavoritesPanel({ onClose }: { onClose:()=>void }) {
  const [favs,  setFavs]  = useState<Fav[]>([])
  const [title, setTitle] = useState('')
  const [url,   setUrl]   = useState('')
  const [add,   setAdd]   = useState(false)
  const { navigate, tabs, activeId } = useBrowser()
  const active = tabs.find(t=>t.id===activeId)

  useEffect(()=>{ load() },[])
  const load = () => invoke<Fav[]>('get_favorites').then(setFavs).catch(console.error)

  const saveCurrent = async () => {
    if (!active) return
    await invoke('add_favorite',{title:active.title||active.url, url:active.url, favicon:null})
    load()
  }
  const saveManual = async () => {
    if (!title.trim()||!url.trim()) return
    await invoke('add_favorite',{title:title.trim(),url:url.trim(),favicon:null})
    setTitle(''); setUrl(''); setAdd(false); load()
  }
  const remove = async (id:number) => {
    await invoke('remove_favorite',{id}); load()
  }

  return (
    <>
      <div className="panel-hd">
        <span className="panel-hd-title">⭐ Preferiti</span>
        <button className="panel-hd-close" onClick={onClose}>×</button>
      </div>
      <div className="panel-body">
        <div className="act-row" style={{marginBottom:14}}>
          <button className="act-btn primary" onClick={saveCurrent}>⭐ Salva pagina</button>
          <button className="act-btn" onClick={()=>setAdd(a=>!a)}>+ Manuale</button>
        </div>
        {add && (
          <div style={{padding:12,background:'var(--bg-3)',border:'1px solid var(--b0)',borderRadius:'var(--r-md)',marginBottom:12}}>
            <div className="field"><label>Titolo</label><input className="inp" value={title} onChange={e=>setTitle(e.target.value)} /></div>
            <div className="field"><label>URL</label><input className="inp" value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://..." /></div>
            <div className="act-row">
              <button className="act-btn primary" onClick={saveManual}>Salva</button>
              <button className="act-btn" onClick={()=>setAdd(false)}>Annulla</button>
            </div>
          </div>
        )}
        {favs.length===0
          ? <p style={{fontSize:12,color:'var(--t2)',textAlign:'center',padding:'24px 0'}}>Nessun preferito ancora.</p>
          : favs.map(f=>(
              <div key={f.id} className="fav-item" onClick={()=>{navigate(f.url);onClose()}}>
                <span className="fav-ico">🌐</span>
                <div className="fav-info">
                  <div className="fav-title">{f.title}</div>
                  <div className="fav-url">{f.url}</div>
                </div>
                <button className="fav-rm" onClick={e=>{e.stopPropagation();remove(f.id)}}>×</button>
              </div>
            ))
        }
      </div>
    </>
  )
}
