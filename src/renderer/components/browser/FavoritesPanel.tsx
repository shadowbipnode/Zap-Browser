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

interface ImportSource {
  id:string
  label:string
  browser:string
  profile?:string
  type:string
}

interface Props {
  onClose:()=>void
  onNavigate:(url:string)=>void
  onOpenNewTab?:(url:string)=>void
  currentUrl:string
  currentTitle:string
}

export default function FavoritesPanel({ onClose, onNavigate, onOpenNewTab, currentUrl, currentTitle }: Props) {
  const [favs, setFavs] = useState<Fav[]>([])
  const [msg, setMsg] = useState('')
  const [search, setSearch] = useState('')
  const [selectedFolder, setSelectedFolder] = useState<string>('root')
  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({})
  const [movingItem, setMovingItem] = useState<Fav|null>(null)
  const [moveTarget, setMoveTarget] = useState<string>('root')
  const [renamingItem, setRenamingItem] = useState<Fav|null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [manualOpen, setManualOpen] = useState(false)
  const [manualTitle, setManualTitle] = useState('')
  const [manualUrl, setManualUrl] = useState('')
  const [importSources, setImportSources] = useState<ImportSource[]>([])
  const [importingSource, setImportingSource] = useState<string|null>(null)
  const [draggedId, setDraggedId] = useState<number|null>(null)
  const [dropTarget, setDropTarget] = useState<{id:number|'root'; position:'before'|'after'|'inside'}|null>(null)

  useEffect(() => {
    load()
    detectImportSources()
  }, [])

  useEffect(() => {
    const reload = () => load()
    window.addEventListener('favorites-updated', reload)
    return () => window.removeEventListener('favorites-updated', reload)
  }, [])

  const load = (notify = false) => {
    ;(window as any).zap?.getFavorites().then((items: Fav[]) => {
      setFavs(items || [])
      if (notify) window.dispatchEvent(new Event('favorites-updated'))
    })
  }

  const detectImportSources = async () => {
    try {
      const sources = await (window as any).zap?.detectBookmarkImportSources?.()
      setImportSources(Array.isArray(sources) ? sources : [])
    } catch (_) {
      setImportSources([])
    }
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
      map[k].sort((a:any,b:any) =>
        Number(a.sort_order || 0) - Number(b.sort_order || 0) ||
        Number(a.id) - Number(b.id)
      )
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
    load(true)
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
    load(true)
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

      setMsg(`Imported ${imported?.importedBookmarks || 0} bookmarks, skipped ${imported?.skippedDuplicates || 0} duplicates`)
      setTimeout(() => setMsg(''), 3000)
      load(true)
    }
    input.click()
  }

  const importFromBrowser = async (source: ImportSource) => {
    setImportingSource(source.id)
    try {
      const res = await (window as any).zap?.importBookmarksFromBrowser?.({ sourceId: source.id })

      if (res?.ok === false) {
        setMsg(res.error || 'Import skipped')
      } else {
        setMsg(`Imported ${res?.importedBookmarks || 0} bookmarks from ${source.label}, skipped ${res?.skippedDuplicates || 0} duplicates`)
        load(true)
      }
    } catch (err:any) {
      setMsg(err?.message || 'Import failed')
    } finally {
      setImportingSource(null)
      setTimeout(() => setMsg(''), 4000)
    }
  }

  const exportHTML = async () => {
    const res = await (window as any).zap?.exportFavoritesHtml?.()
    if (!res?.html) return

    const blob = new Blob([res.html], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)

    const a = document.createElement('a')
    a.href = url
    a.download = 'zap-browser-bookmarks.html'
    document.body.appendChild(a)
    a.click()
    a.remove()

    URL.revokeObjectURL(url)

    setMsg('Bookmarks exported')
    setTimeout(() => setMsg(''), 3000)
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
    load(true)
  }

  const rename = async () => {
    if (!renamingItem || !renameValue.trim()) return

    await (window as any).zap?.renameFavorite({
      id: renamingItem.id,
      title: renameValue.trim(),
    })

    setRenamingItem(null)
    setRenameValue('')
    load(true)
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
    load(true)
  }

  const openBookmark = (f: Fav) => {
    if (!f.url) return
    onNavigate(f.url)
    onClose()
  }

  const openContext = (e:any, f: Fav) => {
    e.preventDefault()
    e.stopPropagation()
    ;(window as any).zap?.showBookmarkContextMenu?.(f)
  }

  const visibleMatches = (f: Fav) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return String(f.title || '').toLowerCase().includes(q) ||
      String(f.url || '').toLowerCase().includes(q)
  }

  const moveDraggedItem = async (parentId:number|null, index:number) => {
    if (draggedId == null) return

    const result = await (window as any).zap?.moveFavorite({
      id: draggedId,
      parent_id: parentId,
      index,
    })

    if (result?.ok === false) {
      setMsg(result.error || 'Move failed')
      setTimeout(() => setMsg(''), 3000)
    } else {
      load(true)
    }

    setDraggedId(null)
    setDropTarget(null)
  }

  const dropOnItem = async (target:Fav, position:'before'|'after'|'inside') => {
    if (draggedId == null || draggedId === target.id) return

    if (position === 'inside' && Number(target.is_folder) === 1) {
      const children = (byParent[String(target.id)] || []).filter(item => item.id !== draggedId)
      await moveDraggedItem(target.id, children.length)
      return
    }

    const parentId = target.parent_id == null ? null : Number(target.parent_id)
    const siblings = (byParent[String(parentId ?? 'root')] || []).filter(item => item.id !== draggedId)
    const targetIndex = siblings.findIndex(item => item.id === target.id)
    await moveDraggedItem(parentId, Math.max(0, targetIndex + (position === 'after' ? 1 : 0)))
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
          className={[
            'fav-item',
            draggedId === f.id ? 'dragging' : '',
            dropTarget?.id === f.id ? `drop-${dropTarget.position}` : '',
          ].filter(Boolean).join(' ')}
          draggable
          onDragStart={(e) => {
            setDraggedId(f.id)
            e.dataTransfer.effectAllowed = 'move'
            e.dataTransfer.setData('application/x-zap-favorite', String(f.id))
          }}
          onDragEnd={() => {
            setDraggedId(null)
            setDropTarget(null)
          }}
          onDragOver={(e) => {
            if (draggedId == null || draggedId === f.id) return
            e.preventDefault()
            e.stopPropagation()
            const rect = e.currentTarget.getBoundingClientRect()
            const ratio = (e.clientY - rect.top) / Math.max(1, rect.height)
            const position = isFolder && ratio > .25 && ratio < .75
              ? 'inside'
              : ratio < .5 ? 'before' : 'after'
            setDropTarget({ id: f.id, position })
          }}
          onDrop={async (e) => {
            e.preventDefault()
            e.stopPropagation()
            if (dropTarget?.id !== f.id) return
            await dropOnItem(f, dropTarget.position)
          }}
          onContextMenu={(e) => openContext(e, f)}
          onMouseDownCapture={(e) => {
            if (!isFolder && e.button === 1) {
              e.preventDefault()
              e.stopPropagation()

              if (onOpenNewTab) {
                onOpenNewTab(f.url)
              }
            }
          }}
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

        <div style={{padding:12,background:'var(--bg-3)',border:'1px solid var(--b0)',borderRadius:'var(--r-md)',marginBottom:12}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,marginBottom:8}}>
            <div style={{fontSize:12,fontWeight:800}}>Import from installed browsers</div>
            <button className="act-btn" onClick={detectImportSources}>Refresh</button>
          </div>

          {importSources.length > 0 ? (
            <div style={{display:'grid',gap:6}}>
              {importSources.map(source => (
                <button
                  key={source.id}
                  className="act-btn"
                  disabled={importingSource === source.id}
                  onClick={() => importFromBrowser(source)}
                  style={{justifyContent:'space-between',display:'flex',alignItems:'center'}}
                >
                  <span>{source.label}</span>
                  <span style={{color:'var(--t2)',fontSize:11}}>
                    {importingSource === source.id ? 'Importing...' : 'Import'}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div style={{fontSize:12,color:'var(--t2)',lineHeight:1.45}}>
              No supported installed browser profiles were detected on this system. You can still import bookmarks from an HTML file.
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
          <button className="act-btn" onClick={importHTML}>Import HTML</button>
          <button className="act-btn" onClick={exportHTML}>Export</button>
        </div>

        <div
          className={`fav-root-drop ${dropTarget?.id === 'root' ? 'active' : ''}`}
          onDragOver={(e) => {
            if (draggedId == null) return
            e.preventDefault()
            setDropTarget({ id:'root', position:'inside' })
          }}
          onDrop={async (e) => {
            e.preventDefault()
            const siblings = (byParent.root || []).filter(item => item.id !== draggedId)
            await moveDraggedItem(null, siblings.length)
          }}
        >
          Move to root
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
