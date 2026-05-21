import { useEffect, useMemo, useState } from 'react'

interface Fav {
  id:number
  title:string
  url:string
  favicon?:string
  parent_id?:number|null
  is_folder?:number
  sort_order?:number
}

interface Props {
  onClose:()=>void
  onNavigate:(url:string)=>void
  onOpenNewTab?:(url:string)=>void
  currentUrl:string
  currentTitle:string
}

export default function FavoritesPanel({ onClose, onNavigate, currentUrl, currentTitle }: Props) {
  const [favs, setFavs] = useState<Fav[]>([])
  const [msg, setMsg] = useState('')
  const [search, setSearch] = useState('')
  const [selectedFolder, setSelectedFolder] = useState<string>('root')
  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({})
  const [activeActions, setActiveActions] = useState<number|null>(null)
  const [movingItem, setMovingItem] = useState<Fav|null>(null)
  const [moveTarget, setMoveTarget] = useState<string>('root')
  const [renamingItem, setRenamingItem] = useState<Fav|null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [manualOpen, setManualOpen] = useState(false)
  const [manualTitle, setManualTitle] = useState('')
  const [manualUrl, setManualUrl] = useState('')

  useEffect(() => { load() }, [])

  const load = () => {
    ;(window as any).zap?.getFavorites().then((items: Fav[]) => setFavs(items || []))
    window.dispatchEvent(new Event('favorites-updated'))
  }

  const folderOptions = useMemo(() => {
    return favs
      .filter(f => Number(f.is_folder) === 1)
      .sort((a,b) => String(a.title || '').localeCompare(String(b.title || '')))
  }, [favs])

  const byParent = useMemo(() => {
    const map: Record<string, Fav[]> = {}
    favs.forEach((f:any) => {
      const key = String(f.parent_id ?? 'root')
      if (!map[key]) map[key] = []
      map[key].push(f)
    })

    Object.keys(map).forEach(k => {
      map[k].sort((a:any,b:any) => {
        const af = Number(a.is_folder) === 1 ? 0 : 1
        const bf = Number(b.is_folder) === 1 ? 0 : 1
        if (af !== bf) return af - bf
        return Number(a.sort_order || 0) - Number(b.sort_order || 0)
      })
    })

    return map
  }, [favs])

  const saveCurrentPage = async () => {
    if (!currentUrl || currentUrl === 'zap://newtab') {
      setMsg('Apri prima una pagina')
      return
    }

    await (window as any).zap?.addFavorite({
      title: currentTitle || currentUrl,
      url: currentUrl,
      favicon: null,
      parent_id: selectedFolder === 'root' ? null : Number(selectedFolder),
    })

    setMsg('Preferito salvato')
    setTimeout(() => setMsg(''), 2000)
    load()
  }

  const saveManual = async () => {
    if (!manualTitle.trim() || !manualUrl.trim()) {
      setMsg('Inserisci titolo e URL')
      return
    }

    let u = manualUrl.trim()
    if (!u.startsWith('http')) u = 'https://' + u

    await (window as any).zap?.addFavorite({
      title: manualTitle.trim(),
      url: u,
      favicon: null,
      parent_id: selectedFolder === 'root' ? null : Number(selectedFolder),
    })

    setManualTitle('')
    setManualUrl('')
    setManualOpen(false)
    load()
  }

  const createFolder = async () => {
    const created = await (window as any).zap?.addFavorite({
      title: 'New folder',
      url: '',
      favicon: null,
      parent_id: selectedFolder === 'root' ? null : Number(selectedFolder),
      is_folder: 1,
      sort_order: Date.now(),
    })

    const fresh = await (window as any).zap?.getFavorites()
    setFavs(fresh || [])
    window.dispatchEvent(new Event('favorites-updated'))

    const folder = (fresh || []).find((f:Fav) => f.id === created?.id)
    if (folder) {
      setRenamingItem(folder)
      setRenameValue(folder.title || '')
    }
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

      setMsg(`Importati ${imported?.length || 0} preferiti`)
      setTimeout(() => setMsg(''), 3000)
      load()
    }
    input.click()
  }

  const remove = async (f: Fav) => {
    const isFolder = Number(f.is_folder) === 1
    const ok = window.confirm(
      isFolder
        ? `Delete folder "${f.title}" and all its contents?`
        : `Delete bookmark "${f.title || f.url}"?`
    )

    if (!ok) return

    await (window as any).zap?.removeFavorite({ id: f.id })
    load()
  }

  const rename = async () => {
    if (!renamingItem || !renameValue.trim()) return

    await (window as any).zap?.renameFavorite({
      id: renamingItem.id,
      title: renameValue.trim(),
    })

    setRenamingItem(null)
    setRenameValue('')
    load()
  }

  const move = async () => {
    if (!movingItem) return

    const result = await (window as any).zap?.moveFavorite({
      id: movingItem.id,
      parent_id: moveTarget === 'root' ? null : Number(moveTarget),
    })

    if (result?.ok === false) {
      setMsg(result.error || 'Move failed')
      setTimeout(() => setMsg(''), 3000)
      return
    }

    setMovingItem(null)
    setMoveTarget('root')
    load()
  }

  const openBookmark = (f: Fav) => {
    if (!f.url) return
    onNavigate(f.url)
    onClose()
  }

  const openContext = (e:any, f: Fav) => {
    e.preventDefault()
    e.stopPropagation()
    setActiveActions(prev => prev === f.id ? null : f.id)
  }

  const visibleMatches = (f: Fav) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return String(f.title || '').toLowerCase().includes(q) ||
      String(f.url || '').toLowerCase().includes(q)
  }

  const renderItems = (parentId:any, depth = 0): any[] => {
    const key = String(parentId ?? 'root')
    return (byParent[key] || []).flatMap((f: Fav) => {
      const isFolder = Number(f.is_folder) === 1
      const opened = !!openFolders[String(f.id)]
      const children = byParent[String(f.id)] || []

      if (!isFolder && !visibleMatches(f)) return []

      return [
        <div
          key={f.id}
          className="fav-item"
          onContextMenu={(e) => openContext(e, f)}
          onClick={() => {
            if (isFolder) {
              setOpenFolders(prev => ({ ...prev, [String(f.id)]: !prev[String(f.id)] }))
            } else {
              openBookmark(f)
            }
          }}
          style={{
            paddingLeft: 14 + depth * 14,
            cursor:'pointer',
            display:'flex',
            alignItems:'center',
            gap:8,
          }}
        >
          <span className="fav-ico">{isFolder ? (opened ? '📂' : '📁') : '🌐'}</span>

          <div className="fav-info" style={{minWidth:0}}>
            <div className="fav-title">
              {isFolder ? f.title : (f.title || f.url)}
            </div>
            <div className="fav-url">
              {isFolder ? `${children.length} item${children.length === 1 ? '' : 's'}` : f.url}
            </div>
          </div>

          <button
            className="fav-rm"
            title="More"
            onClick={(e) => openContext(e, f)}
          >
            ⋮
          </button>
        </div>,

        ...(activeActions === f.id ? [
          <div
            key={`actions-${f.id}`}
            style={{
              display:'flex',
              gap:6,
              paddingLeft: 14 + depth * 14,
              paddingTop:4,
              paddingBottom:8,
            }}
          >
            {!isFolder && (
              <button className="act-btn" onClick={(e) => { e.stopPropagation(); openBookmark(f) }}>
                Open
              </button>
            )}

            <button className="act-btn" onClick={(e) => {
              e.stopPropagation()
              setRenamingItem(f)
              setRenameValue(f.title || '')
              setActiveActions(null)
            }}>
              Rename
            </button>

            <button className="act-btn" onClick={(e) => {
              e.stopPropagation()
              setMovingItem(f)
              setMoveTarget(f.parent_id ? String(f.parent_id) : 'root')
              setActiveActions(null)
            }}>
              Move
            </button>

            <button className="act-btn" style={{color:'var(--red)'}} onClick={(e) => {
              e.stopPropagation()
              remove(f)
              setActiveActions(null)
            }}>
              Delete
            </button>
          </div>
        ] : []),

        ...(isFolder && opened ? renderItems(f.id, depth + 1) : []),
      ]
    })
  }

  return (
    <>
      <div className="panel-hd">
        <span className="panel-hd-title">⭐ Preferiti</span>
        <button className="panel-hd-close" onClick={onClose}>×</button>
      </div>

      <div className="panel-body">
        {msg && <div className="msg ok" style={{marginBottom:10}}>{msg}</div>}

        <div style={{padding:12,background:'var(--bg-3)',border:'1px solid var(--b0)',borderRadius:'var(--r-md)',marginBottom:12}}>
          <div style={{fontSize:12,fontWeight:800,marginBottom:8}}>Save current page</div>

          <select
            value={selectedFolder}
            onChange={(e) => setSelectedFolder(e.target.value)}
            style={{width:'100%',padding:'8px 10px',borderRadius:'var(--r-md)',background:'var(--bg-2)',color:'var(--t0)',border:'1px solid var(--b1)',fontSize:12,marginBottom:8}}
          >
            <option value="root">Save in: Root</option>
            {folderOptions.map(f => (
              <option key={f.id} value={String(f.id)}>📁 {f.title}</option>
            ))}
          </select>

          <div style={{display:'flex',gap:8}}>
            <button className="act-btn primary" onClick={saveCurrentPage}>⭐ Save page</button>
            <button className="act-btn" onClick={() => setManualOpen(v => !v)}>+ Manual</button>
            <button className="act-btn" onClick={createFolder}>📁 Folder</button>
          </div>

          {manualOpen && (
            <div style={{marginTop:10}}>
              <input
                value={manualTitle}
                onChange={e => setManualTitle(e.target.value)}
                placeholder="Title"
                style={{width:'100%',boxSizing:'border-box',marginBottom:6,padding:'8px 10px',borderRadius:'var(--r-md)',background:'var(--bg-2)',color:'var(--t0)',border:'1px solid var(--b1)'}}
              />
              <input
                value={manualUrl}
                onChange={e => setManualUrl(e.target.value)}
                placeholder="URL"
                style={{width:'100%',boxSizing:'border-box',marginBottom:8,padding:'8px 10px',borderRadius:'var(--r-md)',background:'var(--bg-2)',color:'var(--t0)',border:'1px solid var(--b1)'}}
              />
              <button className="act-btn primary" onClick={saveManual}>Save manual bookmark</button>
            </div>
          )}
        </div>

        <div style={{display:'flex',gap:8,marginBottom:10}}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search bookmarks..."
            style={{flex:1,padding:'8px 10px',borderRadius:'var(--r-md)',background:'var(--bg-2)',color:'var(--t0)',border:'1px solid var(--b1)',fontSize:12}}
          />
          <button className="act-btn" onClick={importHTML}>Import</button>
        </div>

        <div className="fav-list">
          {renderItems(null)}
        </div>
      </div>



      {renamingItem && (
        <div style={{position:'fixed',inset:0,zIndex:999999,background:'rgba(0,0,0,.45)',display:'flex',alignItems:'center',justifyContent:'center'}} onClick={() => setRenamingItem(null)}>
          <div style={{width:340,background:'var(--bg-1)',border:'1px solid var(--b1)',borderRadius:'var(--r-lg)',padding:16,boxShadow:'0 18px 50px rgba(0,0,0,.55)'}} onClick={e => e.stopPropagation()}>
            <div style={{fontSize:14,fontWeight:800,marginBottom:12}}>Rename</div>
            <input
              autoFocus
              value={renameValue}
              onChange={e => setRenameValue(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') rename()
                if (e.key === 'Escape') setRenamingItem(null)
              }}
              style={{width:'100%',boxSizing:'border-box',padding:'8px 10px',borderRadius:'var(--r-md)',background:'var(--bg-2)',color:'var(--t0)',border:'1px solid var(--b1)',marginBottom:14}}
            />
            <div style={{display:'flex',justifyContent:'flex-end',gap:8}}>
              <button className="act-btn" onClick={() => setRenamingItem(null)}>Cancel</button>
              <button className="act-btn primary" onClick={rename}>Save</button>
            </div>
          </div>
        </div>
      )}

      {movingItem && (
        <div style={{position:'fixed',inset:0,zIndex:999999,background:'rgba(0,0,0,.45)',display:'flex',alignItems:'center',justifyContent:'center'}} onClick={() => setMovingItem(null)}>
          <div style={{width:340,background:'var(--bg-1)',border:'1px solid var(--b1)',borderRadius:'var(--r-lg)',padding:16,boxShadow:'0 18px 50px rgba(0,0,0,.55)'}} onClick={e => e.stopPropagation()}>
            <div style={{fontSize:14,fontWeight:800,marginBottom:12}}>Move to folder</div>
            <div style={{fontSize:12,color:'var(--t2)',marginBottom:8,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
              {movingItem.title || movingItem.url}
            </div>
            <select
              value={moveTarget}
              onChange={e => setMoveTarget(e.target.value)}
              style={{width:'100%',padding:'8px 10px',borderRadius:'var(--r-md)',background:'var(--bg-2)',color:'var(--t0)',border:'1px solid var(--b1)',fontSize:12,marginBottom:14}}
            >
              <option value="root">Root</option>
              {folderOptions.filter(f => f.id !== movingItem.id).map(f => (
                <option key={f.id} value={String(f.id)}>📁 {f.title}</option>
              ))}
            </select>
            <div style={{display:'flex',justifyContent:'flex-end',gap:8}}>
              <button className="act-btn" onClick={() => setMovingItem(null)}>Cancel</button>
              <button className="act-btn primary" onClick={move}>Move</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
