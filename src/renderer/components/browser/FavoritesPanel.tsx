import { useState, useEffect } from 'react'

interface Fav { id:number; title:string; url:string; favicon?:string; parent_id?:number|null; is_folder?:number; sort_order?:number }
interface Props {
  onClose:()=>void
  onNavigate:(url:string)=>void
  onOpenNewTab?:(url:string)=>void
  currentUrl:string
  currentTitle:string
}

export default function FavoritesPanel({ onClose, onNavigate, onOpenNewTab, currentUrl, currentTitle }: Props) {
  const [favs,  setFavs]  = useState<Fav[]>([])
  const [title, setTitle] = useState('')
  const [url,   setUrl]   = useState('')
  const [add,   setAdd]   = useState(false)
  const [msg,   setMsg]   = useState('')
  const [editingId, setEditingId] = useState<number|null>(null)
  const [editingTitle, setEditingTitle] = useState('')

  useEffect(() => { load() }, [])

  const load = () => {
    (window as any).zap?.getFavorites().then(setFavs)
    window.dispatchEvent(new Event('favorites-updated'))
  }

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

  const importHTML = async () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.html,.htm'
    input.onchange = async (e: any) => {
      const file = e.target.files[0]
      if (!file) return
      const text = await file.text()
      const imported = await (window as any).zap?.importFavoritesHtml({ html: text })
      setMsg(`Importati ${imported?.length || 0} preferiti!`)
      setTimeout(() => setMsg(''), 3000)
      load()
    }
    input.click()
  }

  const saveManual = async () => {
    if (!title.trim() || !url.trim()) { setMsg('Inserisci titolo e URL'); return }
    let u = url.trim()
    if (!u.startsWith('http')) u = 'https://' + u
    await (window as any).zap?.addFavorite({ title: title.trim(), url: u, favicon: null })
    setTitle(''); setUrl(''); setAdd(false); load()
  }

  const remove = async (f: Fav) => {
    const isFolder = !!f.is_folder
    const name = f.title || (isFolder ? 'this folder' : 'this bookmark')

    const confirmed = window.confirm(
      isFolder
        ? `Delete folder "${name}" and all its contents?`
        : `Delete bookmark "${name}"?`
    )

    if (!confirmed) return

    await (window as any).zap?.removeFavorite({ id: f.id })
    load()
  }

  const startRename = (f: Fav) => {
    setEditingId(f.id)
    setEditingTitle(f.title || '')
  }

  const saveRename = async () => {
    if (!editingId || !editingTitle.trim()) {
      setEditingId(null)
      setEditingTitle('')
      return
    }

    await (window as any).zap?.renameFavorite({
      id: editingId,
      title: editingTitle.trim()
    })

    setEditingId(null)
    setEditingTitle('')
    load()
  }

  const cancelRename = () => {
    setEditingId(null)
    setEditingTitle('')
  }

  const buildTree = (items: Fav[]) => {
    const byParent: Record<string, Fav[]> = {}

    items.forEach((f: any) => {
      const key = String(f.parent_id ?? 'root')
      if (!byParent[key]) byParent[key] = []
      byParent[key].push(f)
    })

    const renderItems = (parentId: any, depth = 0): any[] => {
      const key = String(parentId ?? 'root')
      return (byParent[key] || []).flatMap((f: any) => {
        const isFolder = Number(f.is_folder) === 1

        if (isFolder) {
          return [
            <div key={`folder-${f.id}`} className="fav-item" style={{ paddingLeft: 16 + depth * 14 }}>
              <span className="fav-ico">📁</span>
              <div className="fav-info">
                {editingId === f.id ? (
                  <input
                    autoFocus
                    value={editingTitle}
                    onChange={e => setEditingTitle(e.target.value)}
                    onBlur={saveRename}
                    onKeyDown={e => {
                      if (e.key === 'Enter') saveRename()
                      if (e.key === 'Escape') cancelRename()
                    }}
                    onClick={e => e.stopPropagation()}
                    style={{width:'100%',background:'var(--bg-2)',color:'var(--t0)',border:'1px solid var(--b1)',borderRadius:6,padding:'3px 6px'}}
                  />
                ) : (
                  <div className="fav-title" onDoubleClick={() => startRename(f)}>{f.title}</div>
                )}
                <div className="fav-url">Folder</div>
              </div>
              <button className="fav-rm"
                onClick={e => { e.stopPropagation(); remove(f) }}>×</button>
            </div>,
            ...renderItems(f.id, depth + 1)
          ]
        }

        return [
          <div key={f.id} className="fav-item"
            style={{ paddingLeft: 16 + depth * 14 }}
            onClick={() => {
              if (onOpenNewTab) onOpenNewTab(f.url)
              else onNavigate(f.url)
              onClose()
            }}>
            <span className="fav-ico">🌐</span>
            <div className="fav-info">
              {editingId === f.id ? (
                <input
                  autoFocus
                  value={editingTitle}
                  onChange={e => setEditingTitle(e.target.value)}
                  onBlur={saveRename}
                  onKeyDown={e => {
                    if (e.key === 'Enter') saveRename()
                    if (e.key === 'Escape') cancelRename()
                  }}
                  onClick={e => e.stopPropagation()}
                  style={{width:'100%',background:'var(--bg-2)',color:'var(--t0)',border:'1px solid var(--b1)',borderRadius:6,padding:'3px 6px'}}
                />
              ) : (
                <div className="fav-title" onDoubleClick={() => startRename(f)}>{f.title}</div>
              )}
              <div className="fav-url">{f.url}</div>
            </div>
            <button className="fav-rm"
              onClick={e => { e.stopPropagation(); remove(f) }}>×</button>
          </div>
        ]
      })
    }

    return renderItems(null)
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
          <button className="act-btn" onClick={importHTML}>
            📂 Importa HTML
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
          : buildTree(favs)
        }
      </div>
    </>
  )
}
