import { useState, useEffect } from 'react'

interface Fav { id:number; title:string; url:string; favicon?:string }
interface Props {
  onClose:()=>void
  onNavigate:(url:string)=>void
  currentUrl:string
  currentTitle:string
}

export default function FavoritesPanel({ onClose, onNavigate, currentUrl, currentTitle }: Props) {
  const [favs,  setFavs]  = useState<Fav[]>([])
  const [title, setTitle] = useState('')
  const [url,   setUrl]   = useState('')
  const [add,   setAdd]   = useState(false)
  const [msg,   setMsg]   = useState('')

  useEffect(() => { load() }, [])

  const load = () => (window as any).zap?.getFavorites().then(setFavs)

  const saveCurrentPage = async () => {
    if (!currentUrl || currentUrl === 'zap://newtab') {
      setMsg('Apri prima una pagina'); return
    }
    await (window as any).zap?.addFavorite({
      title: currentTitle || currentUrl,
      url:   currentUrl,
      favicon: null
    })
    setMsg('Aggiunto!')
    setTimeout(() => setMsg(''), 2000)
    load()
  }

  const saveManual = async () => {
    if (!title.trim() || !url.trim()) { setMsg('Inserisci titolo e URL'); return }
    let u = url.trim()
    if (!u.startsWith('http')) u = 'https://' + u
    await (window as any).zap?.addFavorite({ title: title.trim(), url: u, favicon: null })
    setTitle(''); setUrl(''); setAdd(false); load()
  }

  const remove = async (id: number) => {
    await (window as any).zap?.removeFavorite({ id }); load()
  }

  return (
    <>
      <div className="panel-hd">
        <span className="panel-hd-title">⭐ Preferiti</span>
        <button className="panel-hd-close" onClick={onClose}>×</button>
      </div>
      <div className="panel-body">
        {msg && <div className="msg ok" style={{marginBottom:10}}>{msg}</div>}

        <div className="act-row" style={{marginBottom:14}}>
          <button className="act-btn primary" onClick={saveCurrentPage}>
            ⭐ Aggiungi pagina corrente
          </button>
          <button className="act-btn" onClick={() => setAdd(a => !a)}>
            + Manuale
          </button>
        </div>

        {currentUrl && currentUrl !== 'zap://newtab' && (
          <div style={{
            padding:'8px 10px', background:'var(--bg-3)',
            border:'1px solid var(--b0)', borderRadius:'var(--r-sm)',
            marginBottom:12, fontSize:11, color:'var(--t2)',
          }}>
            <div style={{fontWeight:600,color:'var(--t0)',marginBottom:2}}>
              {currentTitle || currentUrl}
            </div>
            <div style={{fontFamily:'var(--mono)',fontSize:10,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
              {currentUrl}
            </div>
          </div>
        )}

        {add && (
          <div style={{padding:12,background:'var(--bg-3)',border:'1px solid var(--b0)',borderRadius:'var(--r-md)',marginBottom:12}}>
            <div className="field">
              <label>Titolo</label>
              <input className="inp" value={title} onChange={e=>setTitle(e.target.value)} placeholder="Nome del sito" />
            </div>
            <div className="field">
              <label>URL</label>
              <input className="inp" value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://..." />
            </div>
            <div className="act-row">
              <button className="act-btn primary" onClick={saveManual}>Salva</button>
              <button className="act-btn" onClick={() => setAdd(false)}>Annulla</button>
            </div>
          </div>
        )}

        {favs.length === 0
          ? <p style={{fontSize:12,color:'var(--t2)',textAlign:'center',padding:'24px 0'}}>
              Nessun preferito ancora.
            </p>
          : favs.map(f => (
            <div key={f.id} className="fav-item"
              onClick={() => { onNavigate(f.url); onClose() }}>
              <span className="fav-ico">🌐</span>
              <div className="fav-info">
                <div className="fav-title">{f.title}</div>
                <div className="fav-url">{f.url}</div>
              </div>
              <button className="fav-rm"
                onClick={e => { e.stopPropagation(); remove(f.id) }}>×</button>
            </div>
          ))
        }
      </div>
    </>
  )
}
