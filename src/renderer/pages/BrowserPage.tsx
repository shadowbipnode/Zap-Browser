// src/renderer/pages/BrowserPage.tsx
import { useState, useEffect, useCallback, useRef } from 'react'
import { useBrowser } from '../store/browserStore'
import WalletPanel    from '../components/wallet/WalletPanel'
import NostrPanel     from '../components/nostr/NostrPanel'
import FavoritesPanel from '../components/browser/FavoritesPanel'
import SettingsPanel  from '../components/settings/SettingsPanel'
import NewTabPage     from '../components/browser/NewTabPage'
import DownloadsPanel from '../components/browser/DownloadsPanel'
import { useLang } from '../useLang'

export type Panel = 'wallet'|'nostr'|'favorites'|'settings'|'downloads'|null

interface TabState {
  title?: string; url?: string; loading?: boolean
  canGoBack?: boolean; canGoForward?: boolean
}

const CURRENT_PAGE_DRAG_TYPE = 'application/x-zap-current-page'

interface CurrentPageDrag {
  url: string
  title: string
  favicon?: string
}

function readCurrentPageDrag(dataTransfer: DataTransfer): CurrentPageDrag | null {
  try {
    const raw = dataTransfer.getData(CURRENT_PAGE_DRAG_TYPE)
    if (!raw) return null
    const page = JSON.parse(raw)
    if (!page || typeof page.url !== 'string' || !page.url) return null
    return {
      url: page.url,
      title: typeof page.title === 'string' && page.title ? page.title : page.url,
      favicon: typeof page.favicon === 'string' && page.favicon ? page.favicon : undefined,
    }
  } catch (_) {
    return null
  }
}

function hasCurrentPageDrag(dataTransfer: DataTransfer) {
  return Array.from(dataTransfer.types || []).includes(CURRENT_PAGE_DRAG_TYPE)
}

export default function BrowserPage() {
  const { L } = useLang()
  const { tabs, activeId, addTab, closeTab, setActive, reorderTabs, updateTab, navigate, resetTabs } = useBrowser()
  const [panel, setPanel]       = useState<Panel>(null)
  const [browserProfile, setBrowserProfile] = useState<any>(null)
  const [addrVal, setAddrVal]   = useState('')
  const [privacy, setPrivacy]   = useState<any>(null)
  const [uaDrop, setUaDrop]     = useState(false)
  const [blocked,  setBlocked]   = useState(0)
  const [favBar,      setFavBar]    = useState<any[]>([])
  const favBarRootIdRef = useRef<any>(null)
  const [showFavBar,  setShowFavBar] = useState(() => localStorage.getItem('showFavBar') !== 'false')
  const [favDropOpen, setFavDropOpen] = useState(false)
  const [favFolderOpen, setFavFolderOpen] = useState<any>(null)
  const [favContext, setFavContext] = useState<any>(null)
  const [favRename, setFavRename] = useState<any>(null)
  const [favRenameValue, setFavRenameValue] = useState('')
  const [dragFavoriteId, setDragFavoriteId] = useState<number | null>(null)
  const [dragCurrentPage, setDragCurrentPage] = useState(false)
  const [favoriteDrop, setFavoriteDrop] = useState<{ id: number | 'bar'; position: 'before' | 'after' | 'inside' } | null>(null)
  const [showBookmarkSave, setShowBookmarkSave] = useState(false)
  const [bookmarkFolder, setBookmarkFolder] = useState<string>('root')
  const [bookmarkTitle, setBookmarkTitle] = useState('')
  const [bookmarkNewFolderName, setBookmarkNewFolderName] = useState('')
  const [favBarMax, setFavBarMax] = useState(10)
  const [currentUA, setCurrentUA] = useState('')
  const [payment, setPayment]   = useState<any>(null)
  const [pageNostr, setPageNostr] = useState(false)
  const [v4vInfo,   setV4vInfo]   = useState<any>(null)
  const [blocklistSize, setBlocklistSize] = useState(0)
  const [paying, setPaying]       = useState(false)
  const [suggestions, setSuggestions] = useState<any[]>([])
  const [showSuggest, setShowSuggest] = useState(false)
  const [selectedSuggest, setSelectedSuggest] = useState(-1)
  const selectedSuggestRef = useRef(-1)
  const [appVersion, setAppVersion] = useState('')
  const [updateInfo, setUpdateInfo] = useState<any>(null)
  const [showUpdatePopup, setShowUpdatePopup] = useState(false)
  const [popupBlocked, setPopupBlocked] = useState<any>(null)
  const [paymentSuccess, setPaymentSuccess] = useState<any>(null)
  const [incomingPayment, setIncomingPayment] = useState<any>(null)
  const [downloads, setDownloads] = useState<any[]>([])
  const [downloadsOpen, setDownloadsOpen] = useState(false)
  const [sitePermOpen, setSitePermOpen] = useState(false)
  const [sitePermissions, setSitePermissions] = useState<any[]>([])
  const [dragTabId, setDragTabId] = useState<string | null>(null)
  const [findOpen, setFindOpen] = useState(false)
  const [findText, setFindText] = useState('')
  const findInputRef = useRef<HTMLInputElement | null>(null)
  const suppressIdentityClickRef = useRef(false)


  const activeTab = tabs.find(t => t.id === activeId) || tabs[0]
  const isNew = !activeTab?.url || activeTab.url === 'zap://newtab' || activeTab.url === '' || activeTab.url === ''

  const activeIdRef = useRef(activeId)

  const refreshFavorites = useCallback(async () => {
    const favorites = await window.zap?.getFavorites()
    setFavBar(favorites || [])
    window.dispatchEvent(new Event('favorites-updated'))
    return favorites || []
  }, [])

  const importBookmarksHtml = useCallback(() => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.html,.htm'
    input.onchange = async (event: any) => {
      const file = event.target.files?.[0]
      if (!file) return
      await window.zap?.importFavoritesHtml({ html: await file.text() })
      await refreshFavorites()
    }
    input.click()
  }, [refreshFavorites])

  const exportBookmarksHtml = useCallback(async () => {
    const result = await window.zap?.exportFavoritesHtml?.()
    if (!result?.html) return

    const blobUrl = URL.createObjectURL(new Blob([result.html], { type: 'text/html;charset=utf-8' }))
    const anchor = document.createElement('a')
    anchor.href = blobUrl
    anchor.download = 'zap-browser-bookmarks.html'
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(blobUrl)
  }, [])

  useEffect(() => {
    activeIdRef.current = activeId
  }, [activeId])

  useEffect(() => {
    if (!findOpen) return
    setTimeout(() => {
      findInputRef.current?.focus()
      findInputRef.current?.select()
    }, 0)
  }, [findOpen])

  useEffect(() => {
    window.zap?.getPrivacy().then(setPrivacy)
    window.zap?.browserProfileActive?.().then(setBrowserProfile)
    const loadFavBar = () => window.zap?.getFavorites().then((f: any[]) => setFavBar(f || []))
    loadFavBar()
    window.addEventListener('favorites-updated', loadFavBar)
    window.zap?.getUAPool().then((pool: string[]) => {
      if (pool && pool.length > 0) setCurrentUA(pool[Math.floor(Math.random() * pool.length)])
    })
    window.zap?.getBlockedCount().then(setBlocked)
    return () => window.removeEventListener('favorites-updated', loadFavBar)
  }, [])

  useEffect(() => {
    const onProfileChanged = (event: Event) => {
      const nextProfile = (event as CustomEvent).detail
      const tab = resetTabs()

      setBrowserProfile(nextProfile || null)
      window.zap?.getPrivacy().then(setPrivacy)
      setAddrVal('')
      setFindOpen(false)
      setFindText('')
      setPageNostr(false)
      setV4vInfo(null)
      setSitePermissions([])
      setSitePermOpen(false)
      setShowSuggest(false)

      window.zap?.tabCreate({ tabId: tab.id, private: false }).then(() => {
        window.zap?.tabHome({ tabId: tab.id })
      })
    }

    window.addEventListener('browser-profile-changed', onProfileChanged)
    return () => window.removeEventListener('browser-profile-changed', onProfileChanged)
  }, [resetTabs])

  useEffect(() => {
    const closeFavContext = () => setFavContext(null)
    const closeFavContextOnEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFavContext(null)
    }

    window.addEventListener('click', closeFavContext)
    window.addEventListener('keydown', closeFavContextOnEsc)

    return () => {
      window.removeEventListener('click', closeFavContext)
      window.removeEventListener('keydown', closeFavContextOnEsc)
    }
  }, [])

  const runFind = useCallback((text: string, forward = true, findNext = false) => {
    const tabId = activeIdRef.current
    if (!tabId || !text.trim()) return

    window.zap?.tabFind?.({
      tabId,
      text: text.trim(),
      forward,
      findNext,
    })
  }, [])

  const closeFindBar = useCallback(() => {
    const tabId = activeIdRef.current
    if (tabId) {
      window.zap?.tabStopFind?.({ tabId, action: 'clearSelection' })
    }
    setFindOpen(false)
  }, [])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const isFindShortcut = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f'

      if (isFindShortcut) {
        e.preventDefault()
        e.stopPropagation()
        setFindOpen(true)
        return
      }

      if (e.key === 'Escape' && findOpen) {
        e.preventDefault()
        closeFindBar()
      }
    }

    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [closeFindBar, findOpen])

  // Dynamic bookmarks bar capacity
  useEffect(() => {
    const calc = () => {
      const el = document.querySelector('[data-zap-favbar="1"]') as HTMLElement | null
      const w = el?.clientWidth || window.innerWidth || 1200
      const overflowReserve = 36
      const avgItem = 82
      const max = Math.max(4, Math.floor((w - overflowReserve) / avgItem))
      setFavBarMax(max)
    }

    calc()
    setTimeout(calc, 150)
    setTimeout(calc, 500)

    window.addEventListener('resize', calc)
    return () => window.removeEventListener('resize', calc)
  }, [favBar.length])

  // Load app version / update status
  useEffect(() => {
    window.zap?.getAppVersion?.().then(setAppVersion)
    window.zap?.checkForUpdates?.().then((info: any) => {
      setUpdateInfo(info)
      if (info?.ok && info?.updateAvailable) setShowUpdatePopup(true)
    }).catch(() => {})
  }, [])

  // Listen to events from main process
  useEffect(() => {
    const disposers: Array<() => void> = []
    const onZap = (channel: string, cb: (data: any) => void) => {
      const dispose = window.zap?.on?.(channel, cb)
      if (typeof dispose === 'function') disposers.push(dispose)
    }

    onZap('tab-updated', (data: any) => {
      let favicon = undefined
      try {
        if (data.url?.startsWith('http')) {
          favicon = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(new URL(data.url).hostname)}&sz=32`
        }
      } catch (_) {}

      updateTab(data.tabId, {
        title: data.title,
        url: data.url,
        favicon,
        loading: data.loading,
        canGoBack: data.canGoBack,
        canGoForward: data.canGoForward,
      })
      if (data.tabId === activeIdRef.current && data.url) setAddrVal(data.url)
    })
    onZap('blocked-count', (n: number) => setBlocked(n))
    onZap('privacy-updated', (state: any) => setPrivacy(state))
    onZap('ua-mode-updated', async () => {
      const p = await window.zap?.getPrivacy()
      setPrivacy(p)
      setUaDrop(false)
    })

    onZap('open-new-tab', ({ url }: any) => {
      const now = Date.now()
      const w = window as any

      if (url === w.__zapLastOpenNewTabUrl && now - (w.__zapLastOpenNewTabAt || 0) < 1200) {
        return
      }

      w.__zapLastOpenNewTabUrl = url
      w.__zapLastOpenNewTabAt = now

      handleNewTab(url)
    })
    onZap('payment-detected', (data: any) => setPayment(data))
    onZap('popup-blocked', (data: any) => {
      setPopupBlocked(data || {})
      setTimeout(() => setPopupBlocked(null), 4500)
    })

    window.zap?.getDownloadHistory?.().then((items:any[]) => {
      console.log('[Renderer] restored downloads', items)
      if (Array.isArray(items)) {
        setDownloads(items)
      }
    })

    onZap('download-started', (data: any) => {
      setDownloads(prev => [data, ...prev.filter(d => d.id !== data.id)])
      setDownloadsOpen(true)
    })

    onZap('download-updated', (data: any) => {
      setDownloads(prev => prev.map(d => d.id === data.id ? { ...d, ...data } : d))
    })

    onZap('download-done', (data: any) => {
      setDownloads(prev => prev.map(d => d.id === data.id ? { ...d, ...data } : d))
      setDownloadsOpen(true)

      try {
        new Notification('Download completed', {
          body: data?.path || 'File downloaded successfully',
        })
      } catch (_) {}
    })

    onZap('address-suggestion-picked', (data: any) => {
      if (!data?.url) return
      setAddrVal(data.url)
      setSuggestions([])
      setShowSuggest(false)
      selectedSuggestRef.current = -1
      setSelectedSuggest(-1)
      handleNavigate(data.url)
    })

    onZap('bookmark-open-new-tab', (bookmark: any) => {
      if (!bookmark?.url) return

      const now = Date.now()
      const w = window as any
      const key = `bookmark-open:${bookmark.url}`

      if (w.__zapLastBookmarkActionKey === key && now - (w.__zapLastBookmarkActionAt || 0) < 1200) {
        return
      }

      w.__zapLastBookmarkActionKey = key
      w.__zapLastBookmarkActionAt = now

      handleNewTab(bookmark.url)
    })

    onZap('bookmark-rename', (bookmark: any) => {
      setFavRename(bookmark)
      setFavRenameValue(bookmark?.title || '')
    })

    onZap('bookmark-delete', async (bookmark: any) => {
      if (!bookmark?.id) return

      const w = window as any
      const key = `bookmark-delete:${bookmark.id}`

      if (w.__zapBookmarkDeleteInProgress === key) {
        return
      }

      w.__zapBookmarkDeleteInProgress = key

      try {
        const isFolder = Number(bookmark.is_folder) === 1
        const name = bookmark.title || (isFolder ? 'this folder' : 'this bookmark')

        const ok = window.confirm(
          isFolder
            ? `Delete folder "${name}" and all its contents?`
            : `Delete bookmark "${name}"?`
        )

        if (!ok) return

        await window.zap?.removeFavorite({ id: Number(bookmark.id) })

        const f = await window.zap?.getFavorites()
        setFavBar(f || [])

        window.dispatchEvent(new Event('favorites-updated'))
      } finally {
        setTimeout(() => {
          if (w.__zapBookmarkDeleteInProgress === key) {
            w.__zapBookmarkDeleteInProgress = null
          }
        }, 800)
      }
    })

    onZap('bookmark-folder-picked', (item: any) => {
      const url = typeof item === 'string' ? item : item?.url

      if (!url) return

      window.zap?.hideBookmarkFolderPopup?.()
      handleNavigate(url)
    })

    onZap('bookmark-create-folder-request', async (data: any) => {
      console.log('[DEBUG][renderer] bookmark-create-folder-request received', data)
      console.log('[BookmarksBar] create folder request received')

      const title = window.prompt('Folder name', 'New folder')
      if (!title?.trim()) return

      const rootId = favBarRootIdRef.current ?? barRootId ?? null

      await window.zap?.addFavorite({
        title: title.trim(),
        url: '',
        favicon: null,
        parent_id: rootId,
        is_folder: 1,
        sort_order: Date.now(),
      })

      const f = await window.zap?.getFavorites()
      setFavBar(f || [])
      window.dispatchEvent(new Event('favorites-updated'))
    })

    const onPaymentSuccess = (e: any) => {
      setPaymentSuccess((e as CustomEvent).detail || {})
      setTimeout(() => setPaymentSuccess(null), 7000)
    }

    window.addEventListener('zap-payment-success', onPaymentSuccess)


    let lastKnownBalance: number | null = null
    let balanceWatcherTimer: ReturnType<typeof setInterval> | null = null

    const checkBalanceForIncoming = async () => {
      try {
        const connected = await window.zap?.nwcIsConnected?.()
        if (!connected) return

        const r = await window.zap?.nwcGetBalance?.()
        const newBalance = r?.balance || 0

        if (lastKnownBalance === null) {
          lastKnownBalance = newBalance
          return
        }

        if (newBalance > lastKnownBalance) {
          const received = newBalance - lastKnownBalance

          setIncomingPayment({ amount: received })

          setTimeout(() => {
            setIncomingPayment(null)
          }, 7000)
        }

        lastKnownBalance = newBalance
      } catch (_) {}
    }

    checkBalanceForIncoming()
    balanceWatcherTimer = setInterval(checkBalanceForIncoming, 10000)

    // Navigate from history/bookmarks
    const onNavigateTo = (e: any) => {
      handleNavigate((e as CustomEvent).detail)
      setPanel(null)
    }
    window.addEventListener('navigate-to', onNavigateTo)

    // Toggle bookmarks bar
    const onToggleFavBar = (e: any) => setShowFavBar((e as CustomEvent).detail)
    window.addEventListener('toggle-favbar', onToggleFavBar)

    return () => {
      disposers.forEach(dispose => {
        try { dispose() } catch (_) {}
      })
      if (balanceWatcherTimer) clearInterval(balanceWatcherTimer)
      window.removeEventListener('navigate-to', onNavigateTo)
      window.removeEventListener('toggle-favbar', onToggleFavBar)
      window.removeEventListener('zap-payment-success', onPaymentSuccess)
    }
  }, [activeId])

  // Sync address bar with active tab
  useEffect(() => {
    setAddrVal(activeTab?.url === 'zap://newtab' ? '' : activeTab?.url || '')
  }, [activeId, activeTab?.url])

  // Notify main of panel state for view resize
  useEffect(() => {
    const panelElement = document.querySelector('.side-panel') as HTMLElement | null
    const syncBrowserViewBounds = () => {
      window.zap?.shellResize({
        panelOpen: panel !== null,
        panelWidth: panelElement?.getBoundingClientRect().width || 0,
      })
    }

    syncBrowserViewBounds()

    const observer = panelElement && typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(syncBrowserViewBounds)
      : null

    if (panelElement) observer?.observe(panelElement)
    window.addEventListener('resize', syncBrowserViewBounds)

    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', syncBrowserViewBounds)
    }
  }, [panel, showSuggest, favFolderOpen, favDropOpen, favContext, showBookmarkSave, favRename])


  const getActiveOrigin = () => {
    try {
      const u = activeTab?.url || ''
      if (!u.startsWith('http://') && !u.startsWith('https://')) return null
      return new URL(u).origin
    } catch (_) {
      return null
    }
  }

  const openSitePermissions = async () => {
    const origin = getActiveOrigin()
    const perms = await window.zap?.nostrListPermissions()
    setSitePermissions((perms || []).filter((p: any) => p.origin === origin))
    setSitePermOpen(false)
    setPanel('nostr')
  }

  const revokeSitePermission = async (origin: string, action: string) => {
    await window.zap?.nostrRemovePermission({ origin, action })
    const perms = await window.zap?.nostrListPermissions()
    setSitePermissions((perms || []).filter((p: any) => p.origin === origin))
  }

  const togglePanel = (p: Panel) => setPanel(prev => prev === p ? null : p)

  // Create a new tab
  const handleNewTab = useCallback((url?: string, isPrivate = false) => {
    const id = crypto.randomUUID()
    const target = url || 'zap://newtab'

    addTab(target, id, isPrivate)
    setActive(id)
    setAddrVal(url || '')
    setShowSuggest(false)

    if (url && url !== 'zap://newtab') {
      updateTab(id, {
        url,
        title: L('Caricamento...','Loading...'),
        loading: true,
      })
    }

    window.zap?.tabCreate({ tabId: id, private: isPrivate }).then(() => {
      if (url && url !== 'zap://newtab') {
        window.zap?.tabNavigate({ tabId: id, url })
      } else {
        window.zap?.tabHome({ tabId: id })
        setTimeout(() => {
          document.querySelector<HTMLInputElement>('.addr-input')?.focus()
        }, 50)
      }
    })
  }, [addTab, setActive])

  // Switch tab
  const handleSwitchTab = useCallback((id: string) => {
    const tab = tabs.find(t => t.id === id)
    const url = (!tab?.url || tab.url === 'zap://newtab') ? '' : tab.url
    setActive(id)
    setAddrVal(url)
    setShowSuggest(false)
    // Solo switch — NON navigare di nuovo
    window.zap?.tabSwitch({ tabId: id })
  }, [setActive, tabs])

  // Close tab
  const handleCloseTab = useCallback((id: string) => {
    window.zap?.tabClose({ tabId: id })
    closeTab(id)
  }, [closeTab])

  // Navigate
  const handleNavigate = useCallback((url: string) => {
    const tabId = activeIdRef.current
    if (!tabId) return

    window.zap?.tabNavigate({ tabId, url }).then((res: any) => {
      if (res?.url) updateTab(tabId, { url: res.url, loading: true })
    })
  }, [updateTab])

  const handleAddrInput = async (val: string) => {
    setAddrVal(val)
    if (val.length < 2) { setSuggestions([]); setShowSuggest(false); window.zap?.hideAddressSuggestions?.(); return }
    try {
      const hist = await (window as any).zap?.getHistory({ limit: 500 }) || []
      const q = val.toLowerCase()
      // Dedup per dominio — mostra solo un risultato per dominio
      const seen = new Set<string>()
      const found: any[] = []
      for (const h of hist) {
        try {
          const domain = new URL(h.url).hostname
          if (!seen.has(domain) && (
            domain.toLowerCase().includes(q) ||
            h.title?.toLowerCase().includes(q) ||
            h.url?.toLowerCase().includes(q)
          )) {
            seen.add(domain)
            // Mostra homepage del dominio, non la pagina specifica
            const homeUrl = new URL(h.url).origin
            found.push({
              ...h,
              url: homeUrl,
              title: domain,
              favicon: `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=32`
            })
          }
        } catch(_) {}
        if (found.length >= 7) break
      }
      setSuggestions(found)
      setShowSuggest(false)
      selectedSuggestRef.current = found.length > 0 ? 0 : -1
      setSelectedSuggest(selectedSuggestRef.current)

      if (found.length > 0) {
        const el = document.activeElement as HTMLElement | null
        const rect = el?.getBoundingClientRect?.()

        if (rect) {
          await window.zap?.showAddressSuggestions?.({
            items: found,
            selectedIndex: selectedSuggestRef.current,
            x: window.screenX + rect.left,
            y: window.screenY + rect.bottom + 8,
            width: rect.width,
          })
        }
      } else {
        await window.zap?.hideAddressSuggestions?.()
      }
    } catch(e) { console.error('[history] errore:', e) }
  }

  const refreshNativeSuggestions = async (items:any[], selectedIndex:number) => {
    const el = document.activeElement as HTMLElement | null
    const rect = el?.getBoundingClientRect?.()

    if (!rect || !items.length) return

    await window.zap?.showAddressSuggestions?.({
      items,
      selectedIndex,
      x: window.screenX + rect.left,
      y: window.screenY + rect.bottom + 8,
      width: rect.width,
    })
  }

  const handleAddrKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setShowSuggest(false)
      selectedSuggestRef.current = -1
      setSelectedSuggest(-1)
      setSuggestions([])
      window.zap?.hideAddressSuggestions?.()
      return
    }

    if (suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        const next = selectedSuggestRef.current < suggestions.length - 1 ? selectedSuggestRef.current + 1 : 0
        selectedSuggestRef.current = next
        setSelectedSuggest(next)
        refreshNativeSuggestions(suggestions, next)
        return
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault()
        const next = selectedSuggestRef.current > 0 ? selectedSuggestRef.current - 1 : suggestions.length - 1
        selectedSuggestRef.current = next
        setSelectedSuggest(next)
        refreshNativeSuggestions(suggestions, next)
        return
      }

      if (e.key === 'Enter' && selectedSuggest >= 0) {
        e.preventDefault()
        const item = suggestions[selectedSuggestRef.current]
        if (item?.url) {
          setAddrVal(item.url)
          setShowSuggest(false)
          selectedSuggestRef.current = -1
          setSelectedSuggest(-1)
          setSuggestions([])
          window.zap?.hideAddressSuggestions?.()
          handleNavigate(item.url)
          return
        }
      }
    }

    if (e.key !== 'Enter') return

    setShowSuggest(false)
    setSelectedSuggest(-1)
    window.zap?.hideAddressSuggestions?.()

    const v = addrVal.trim()

    const lower = v.toLowerCase()

    if (lower.startsWith('lightning:')) {
      const payload = v.slice('lightning:'.length).trim()
      setPayment({
        type: payload.toLowerCase().startsWith('lnbc') || payload.toLowerCase().startsWith('lntb')
          ? 'invoice'
          : payload.toLowerCase().startsWith('lnurl')
            ? 'lnurl'
            : 'lightning',
        value: payload
      })
      return
    }

    if (lower.startsWith('cashu:')) {
      setPayment({ type: 'cashu', value: v.slice('cashu:'.length).trim() || v })
      return
    }

    if (lower.startsWith('liquid:') || lower.startsWith('l-btc:')) {
      setPayment({ type: 'liquid', value: v })
      return
    }

    if (lower.startsWith('lnurl:') || lower.startsWith('lnurlp:') || lower.startsWith('lnurlw:')) {
      setPayment({ type: 'lnurl', value: v.replace(/^lnurl:/i, '') })
      return
    }

    if (lower.startsWith('lnbc') || lower.startsWith('lntb')) {
      setPayment({ type: 'invoice', value: v })
      return
    }

    if (v.toLowerCase().startsWith('cashua')) {
      setPayment({ type: 'cashu', value: v })
      return
    }

    handleNavigate(v)
  }


  const handlePay = async () => {
    if (!payment) return
    setPaying(true)
    try {
      if (payment.type === 'invoice') await window.zap?.nwcPayInvoice({ invoice: payment.value })
      setPayment(null)
    } catch (e) { console.error(e) }
    setPaying(false)
  }

  const toggleAdblock = async () => {
    const enabled = !privacy?.adblock

    await window.zap?.setAdblock({ enabled })
    await window.zap?.setPopupBlock?.({ enabled })
    await window.zap?.setOverlayBlock?.({ enabled })

    const p = await window.zap?.getPrivacy()
    setPrivacy(p)

    window.zap?.tabReload?.({ tabId: activeId })
  }
  const toggleWebRTC = async () => {
    const p = await window.zap?.setWebRTC({ enabled: !privacy?.webrtc_protect })
    setPrivacy(p)
  }
  const setUAMode = async (mode: string) => {
    await window.zap?.setUAMode({ mode })
    const p = await window.zap?.getPrivacy()
    setPrivacy(p); setUaDrop(false)
  }

  const secIcon = () => {
    const u = activeTab?.url || ''

    if (u.startsWith('https')) return '🔒'
    if (u.startsWith('http:')) return '⚠️'

    return '⚡'
  }

  const currentOrigin = (() => {
    try {
      return new URL(activeTab?.url || '').origin
    } catch (_) {
      return null
    }
  })()

  const nostrAllowed = sitePermissions.some(
    (p:any) => p.origin === currentOrigin
  )

  const blockedRecently = !!popupBlocked

  return (
    <div className="app">
      {/* ── Custom titlebar ───────────────────────────────────────────── */}
      <div style={{
        height: 28, background: 'var(--bg0)',
        display: 'flex', alignItems: 'center',
        WebkitAppRegion: 'drag' as any,
        borderBottom: '1px solid var(--b0)',
        flexShrink: 0, padding: '0 12px',
      }}>
        <div style={{ flex:1, fontSize:11, fontWeight:700, color:'var(--t2)' }}>
          ⚡ Zap Browser
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8, WebkitAppRegion:'no-drag' as any }}>
          <button
            onClick={() => setPanel('settings')}
            title={updateInfo?.updateAvailable ? L('Aggiornamento disponibile','Update available') : L('Versione aggiornata','Up to date')}
            style={{
              height:20,
              padding:'0 9px',
              borderRadius:999,
              border:updateInfo?.updateAvailable ? '1px solid #facc15' : '1px solid #22c55e',
              background:updateInfo?.updateAvailable ? 'rgba(250,204,21,.12)' : 'rgba(34,197,94,.10)',
              color:updateInfo?.updateAvailable ? '#facc15' : '#22c55e',
              fontSize:10.5,
              fontWeight:800,
              cursor:'pointer',
              fontFamily:'var(--ff)',
              display:'flex',
              alignItems:'center',
              gap:5,
            }}
          >
            <span style={{
              width:6,
              height:6,
              borderRadius:'50%',
              background:updateInfo?.updateAvailable ? '#facc15' : '#22c55e',
              boxShadow:updateInfo?.updateAvailable ? '0 0 8px #facc15' : '0 0 8px #22c55e',
            }} />
            {updateInfo?.updateAvailable
              ? `v${appVersion || '...'} → v${updateInfo.latestVersion}`
              : `v${appVersion || '...'}`}
          </button>
          <button onClick={() => (window as any).zap?.openDevTools?.()}
            title="DevTools" style={{ background:'none', border:'none', color:'var(--t2)', fontSize:11, cursor:'pointer', padding:'0 2px', opacity:0.5 }}>🛠</button>
          <button onClick={() => window.zap?.minimize()}
            title={L('Minimizza','Minimize')} style={{ width:13, height:13, borderRadius:'50%', background:'#ffbd2e', border:'none', cursor:'pointer' }} />
          <button onClick={() => window.zap?.maximize()}
            title={L('Ingrandisci','Maximize')} style={{ width:13, height:13, borderRadius:'50%', background:'#27c93f', border:'none', cursor:'pointer' }} />
          <button onClick={() => window.zap?.close()}
            title={L('Chiudi','Close')} style={{ width:13, height:13, borderRadius:'50%', background:'#ff5f56', border:'none', cursor:'pointer' }} />
        </div>
      </div>

      {/* ── Tab bar ──────────────────────────────────────────────────── */}
      <div className="tabbar">
        {tabs.map(t => (
          <div
            key={t.id}
            draggable
            className={`tab ${t.id === activeId ? 'active' : ''} ${t.private ? 'private' : ''} ${dragTabId === t.id ? 'dragging' : ''}`}
            onDragStart={(e) => {
              setDragTabId(t.id)
              e.dataTransfer.effectAllowed = 'move'
              e.dataTransfer.setData('text/plain', t.id)
            }}
            onDragOver={(e) => {
              e.preventDefault()
              e.dataTransfer.dropEffect = 'move'
            }}
            onDrop={(e) => {
              e.preventDefault()
              const fromId = e.dataTransfer.getData('text/plain') || dragTabId
              if (fromId && fromId !== t.id) {
                reorderTabs(fromId, t.id)
              }
              setDragTabId(null)
            }}
            onDragEnd={() => setDragTabId(null)}
            onClick={() => handleSwitchTab(t.id)}
          >
            <span className="tab-icon">
              {t.private ? '🕶' : t.favicon ? (
                <img src={t.favicon} alt="" style={{width:14,height:14,borderRadius:3}} />
              ) : '🌐'}
            </span>
            <span className="tab-label">{t.private ? '🕶 PRIVATE · ' : ''}{t.loading ? L('Caricamento...','Loading...') : t.title || L('Nuova Scheda','New Tab')}</span>
            <button className="tab-x" onClick={e => { e.stopPropagation(); handleCloseTab(t.id) }}>×</button>
          </div>
        ))}
        <button className="tab-new" title="New tab" onClick={() => handleNewTab()}>+</button>
        <button className="tab-new private-newtab" title="New private tab" onClick={() => handleNewTab(undefined, true)}>🕶</button>
      </div>

      {activeTab?.private && (
        <div className="private-strip">
          <span>🕶 PRIVATE SESSION</span>
          <span>No history saved · isolated session</span>
        </div>
      )}

      {/* ── Toolbar ──────────────────────────────────────────────────── */}
      <div className="toolbar">
        <button className="navbtn" onClick={() => window.zap?.tabBack({ tabId: activeId })}>←</button>
        <button className="navbtn" onClick={() => window.zap?.tabForward({ tabId: activeId })}>→</button>
        <button className="navbtn" onClick={() => window.zap?.tabReload({ tabId: activeId })}>↻</button>

        {/* Address bar */}
        <button
          onClick={() => {
            setAddrVal('')
            updateTab(activeId, { url: 'zap://newtab', title: 'New Tab' })
            window.zap?.tabHome({ tabId: activeId })
          }}
          title="Home"
          style={{ background:'none', border:'none', cursor:'pointer', color:'var(--t2)', fontSize:14, padding:'0 4px', flexShrink:0 }}
        >🏠</button>

        <div style={{
          display:'flex',
          alignItems:'center',
          gap:6,
          marginRight:8,
          marginLeft:4,
          flexShrink:0,
        }}>
          {nostrAllowed && (
            <span
              title="NIP-07 allowed"
              style={{
                color:'var(--a)',
                fontSize:13,
                filter:'drop-shadow(0 0 6px rgba(245,166,35,.45))',
              }}
            >
              ⚡
            </span>
          )}

          {blockedRecently && (
            <span
              title="Popup blocked"
              style={{
                color:'var(--red)',
                fontSize:12,
              }}
            >
              🛡
            </span>
          )}
        </div>
        <div className="addr-wrap" style={{
          cursor:'text',
          position:'relative',
          border: nostrAllowed
            ? '1px solid rgba(245,166,35,.45)'
            : blockedRecently
              ? '1px solid rgba(248,113,113,.35)'
              : undefined,
          boxShadow: nostrAllowed
            ? '0 0 14px rgba(245,166,35,.12)'
            : undefined,
          borderRadius:'var(--r-pill)',
        }}>
          <button
            title="Site permissions"
            draggable={!isNew}
            onDragStart={(e) => {
              if (!activeTab?.url || isNew) {
                e.preventDefault()
                return
              }

              const page: CurrentPageDrag = {
                url: activeTab.url,
                title: activeTab.title || activeTab.url,
                favicon: activeTab.favicon,
              }

              suppressIdentityClickRef.current = true
              setDragCurrentPage(true)
              e.dataTransfer.effectAllowed = 'copy'
              e.dataTransfer.setData(CURRENT_PAGE_DRAG_TYPE, JSON.stringify(page))
              e.dataTransfer.setData('text/uri-list', page.url)
              e.dataTransfer.setData('text/plain', page.url)
            }}
            onDragEnd={() => {
              setDragCurrentPage(false)
              setFavoriteDrop(null)
              window.setTimeout(() => {
                suppressIdentityClickRef.current = false
              }, 0)
            }}
            onClick={(e) => {
              if (suppressIdentityClickRef.current) {
                e.preventDefault()
                e.stopPropagation()
                return
              }
              openSitePermissions()
            }}
            className={dragCurrentPage ? 'page-identity-button dragging' : 'page-identity-button'}
            style={{
              background:'none',
              border:'none',
              cursor: isNew ? 'pointer' : 'grab',
              color:'var(--t2)',
              fontSize:14,
              padding:0,
              marginRight:4,
            }}
          >
            {secIcon()}
          </button>
          <input className="addr-input"
            value={addrVal}
            onChange={e => handleAddrInput(e.target.value)}
            onKeyDown={handleAddrKey}
            onContextMenu={(e) => {
              e.preventDefault()
              e.stopPropagation()
              window.zap?.showEditContextMenu?.()
            }}
            onFocus={e => e.target.select()}
            placeholder={L('Cerca o inserisci URL, invoice Lightning, token Cashu...','Search or enter URL, Lightning invoice, Cashu token...')}
            spellCheck={false}
            autoFocus
          />
        </div>

        <button
          title="Save bookmark"
          onClick={() => {
            if (!activeTab?.url || activeTab.url === 'zap://newtab') return
            setBookmarkTitle(activeTab?.title || activeTab?.url || '')
            setBookmarkFolder('root')
            setBookmarkNewFolderName('')
            setShowBookmarkSave(true)
          }}
          style={{
            background:'none',
            border:'none',
            color:'var(--t2)',
            cursor:'pointer',
            fontSize:15,
            padding:'0 8px',
            flexShrink:0,
          }}
        >
          🔖
        </button>

        {/* Site permissions are shown inside the Nostr side panel */}

        {/* 3 privacy buttons */}
        <div className="priv-row">
          <button className={`priv-btn ${privacy?.adblock ? 'on' : 'off'}`} onClick={toggleAdblock}
            title="Ad & tracker blocking">
            🛡️ {blocked > 0 ? blocked.toLocaleString() : 'Block'}
          </button>
          <button className={`priv-btn ${privacy?.webrtc_protect ? 'on' : 'off'}`} onClick={toggleWebRTC}
            title="WebRTC leak prevention">
            🔌 WebRTC
          </button>
          <button
            className="priv-btn ua"
            onClick={() => window.zap?.showUAMenu?.()}
            title="User-Agent mode"
          >
            🎭 {privacy?.ua_mode === 'rotate' ? 'UA Auto' : 'UA Default'}
          </button>
        </div>

        {/* NIP-07 indicator */}
        {pageNostr && (
          <div title="Questo sito supporta login Nostr (NIP-07)" style={{
            display:'flex', alignItems:'center', gap:4,
            padding:'0 8px', height:29, borderRadius:'var(--r-sm)',
            background:'var(--green-bg)', border:'1px solid var(--green)',
            fontSize:11, fontWeight:700, color:'var(--green)', flexShrink:0,
          }}>
            🟣 NIP-07
          </div>
        )}

        {/* V4V indicator */}
        {v4vInfo?.supported && (
          <button
            title={`Questo sito supporta Value4Value\nClicca per inviare un boost`}
            onClick={() => window.zap?.v4vSendBoost({ amount: 21, message: '⚡ Zap!' })}
            style={{
              display:'flex', alignItems:'center', gap:4,
              padding:'0 8px', height:29, borderRadius:'var(--r-sm)',
              background:'var(--a-glow)', border:'1px solid var(--a)',
              fontSize:11, fontWeight:700, color:'var(--a)',
              cursor:'pointer', flexShrink:0,
            }}>
            💜 Boost
          </button>
        )}

        <button
          title={privacy?.tor_enabled ? 'Tor enabled' : 'Tor disabled'}
          onClick={async () => {
            try {
              await window.zap?.setTorProxy({
                enabled: !privacy?.tor_enabled,
                host: privacy?.tor_host || '127.0.0.1',
                port: privacy?.tor_port || 9050,
              })

              const p = await window.zap?.getPrivacy()
              setPrivacy(p)
            } catch (err) {
              console.error('[Tor] toggle failed', err)
              window.alert('Tor toggle failed')
            }
          }}
          style={{
            background: privacy?.tor_enabled ? 'rgba(168,85,247,.16)' : 'none',
            border: privacy?.tor_enabled ? '1px solid rgba(168,85,247,.45)' : 'none',
            color: privacy?.tor_enabled ? '#c084fc' : 'var(--t2)',
            cursor:'pointer',
            fontSize:16,
            padding:'4px 10px',
            borderRadius:999,
            flexShrink:0,
            transition:'all .18s ease',
          }}
        >
          🧅
        </button>

        <button
          title="Downloads"
          onClick={() => setPanel(panel === 'downloads' ? null : 'downloads')}
          style={{
            background:'none',
            border:'none',
            color: downloads.some(d => d.state === 'progressing') ? 'var(--a)' : 'var(--t2)',
            cursor:'pointer',
            fontSize:15,
            padding:'0 8px',
            flexShrink:0,
          }}
        >
          ⬇
        </button>

        {/* Panel buttons */}
        <div className="panel-btns">
          <button
            className={`panel-btn ${panel === 'settings' ? 'active' : ''}`}
            title={browserProfile?.name ? `Active profile: ${browserProfile.name}` : 'Browser profiles'}
            onClick={() => setPanel('settings')}
          >
            👤 {browserProfile?.name || 'Default'}
          </button>
          <button className={`panel-btn ${panel === 'wallet' ? 'active' : ''}`} onClick={() => togglePanel('wallet')}>⚡ Wallet</button>
          <button className={`panel-btn ${panel === 'nostr' ? 'active' : ''}`} onClick={() => togglePanel('nostr')}>🟣</button>
          <button className={`panel-btn ${panel === 'favorites' ? 'active' : ''}`} onClick={() => togglePanel('favorites')}>⭐</button>
          <button className={`panel-btn ${panel === 'settings' ? 'active' : ''}`} onClick={() => togglePanel('settings')}>⚙️</button>
        </div>
      </div>
      {findOpen && (
        <div className="find-bar">
          <span className="find-label">Find</span>
          <input
            ref={findInputRef}
            className="find-input"
            value={findText}
            onChange={(e) => {
              const value = e.target.value
              setFindText(value)
              runFind(value, true, false)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault()
                closeFindBar()
                return
              }

              if (e.key === 'Enter') {
                e.preventDefault()
                runFind(findText, !e.shiftKey, true)
              }
            }}
            spellCheck={false}
          />
          <button
            className="find-btn"
            title="Previous match"
            onClick={() => runFind(findText, false, true)}
          >
            ↑
          </button>
          <button
            className="find-btn"
            title="Next match"
            onClick={() => runFind(findText, true, true)}
          >
            ↓
          </button>
          <button className="find-btn" title="Close find" onClick={closeFindBar}>×</button>
        </div>
      )}
      {showBookmarkSave && (
        <div
          onClick={() => setShowBookmarkSave(false)}
          style={{
            position:'fixed',
            inset:0,
            zIndex:999999,
            background:'transparent',
            pointerEvents:'auto',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position:'absolute',
              top:88,
              right:92,
              width:360,
              background:'var(--bg-1)',
              border:'1px solid var(--b1)',
              borderRadius:'var(--r-lg)',
              boxShadow:'0 18px 50px rgba(0,0,0,.55)',
              padding:14,
              color:'var(--t0)',
            }}
          >
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
              <div style={{fontSize:14,fontWeight:800}}>⭐ Save bookmark</div>
              <button
                onClick={() => setShowBookmarkSave(false)}
                style={{background:'none',border:'none',color:'var(--t2)',cursor:'pointer',fontSize:16}}
              >×</button>
            </div>

            <div style={{marginBottom:10}}>
              <div style={{fontSize:11,color:'var(--t2)',marginBottom:5}}>Name</div>
              <input
                autoFocus
                value={bookmarkTitle}
                onChange={(e) => setBookmarkTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setShowBookmarkSave(false)
                }}
                style={{
                  width:'100%',
                  boxSizing:'border-box',
                  background:'var(--bg-2)',
                  color:'var(--t0)',
                  border:'1px solid var(--b1)',
                  borderRadius:'var(--r-md)',
                  padding:'8px 10px',
                  fontSize:12,
                  outline:'none',
                }}
              />
            </div>

            <div style={{marginBottom:10}}>
              <div style={{fontSize:11,color:'var(--t2)',marginBottom:5}}>Folder</div>
              <select
                value={bookmarkFolder}
                onChange={(e) => setBookmarkFolder(e.target.value)}
                style={{
                  width:'100%',
                  padding:'8px 10px',
                  borderRadius:'var(--r-md)',
                  background:'var(--bg-2)',
                  color:'var(--t0)',
                  border:'1px solid var(--b1)',
                  fontSize:12,
                }}
              >
                <option value="root">Root</option>
                <option value="__new__">+ New folder…</option>

                {favBar
                  .filter((f:any) => Number(f.is_folder) === 1)
                  .map((f:any) => (
                    <option key={f.id} value={String(f.id)}>
                      📁 {f.title}
                    </option>
                  ))}
              </select>
            </div>

            {bookmarkFolder === '__new__' && (
              <div style={{marginBottom:10}}>
                <div style={{fontSize:11,color:'var(--t2)',marginBottom:5}}>New folder name</div>
                <input
                  value={bookmarkNewFolderName}
                  onChange={(e) => setBookmarkNewFolderName(e.target.value)}
                  placeholder="Folder name"
                  style={{
                    width:'100%',
                    boxSizing:'border-box',
                    background:'var(--bg-2)',
                    color:'var(--t0)',
                    border:'1px solid var(--b1)',
                    borderRadius:'var(--r-md)',
                    padding:'8px 10px',
                    fontSize:12,
                    outline:'none',
                  }}
                />
              </div>
            )}

            <div style={{
              fontSize:10,
              color:'var(--t2)',
              whiteSpace:'nowrap',
              overflow:'hidden',
              textOverflow:'ellipsis',
              marginBottom:12,
              fontFamily:'var(--mono)',
            }}>
              {activeTab?.url}
            </div>

            <div style={{display:'flex',justifyContent:'flex-end',gap:8}}>
              <button
                onClick={() => setShowBookmarkSave(false)}
                style={{
                  padding:'7px 12px',
                  borderRadius:'var(--r-md)',
                  border:'1px solid var(--b1)',
                  background:'var(--bg-2)',
                  color:'var(--t0)',
                  cursor:'pointer',
                }}
              >
                Cancel
              </button>

              <button
                onClick={async () => {
                  if (!activeTab?.url || activeTab.url === 'zap://newtab') return

                  let parentId:any = bookmarkFolder === 'root'
                    ? null
                    : Number(bookmarkFolder)

                  if (bookmarkFolder === '__new__') {
                    const folderName = bookmarkNewFolderName.trim()
                    if (!folderName) return

                    console.log('[FavBar] creating folder', {
            ref: favBarRootIdRef.current,
            root: barRootId,
          })

          const created = await window.zap?.addFavorite({
                      title: folderName,
                      url: '',
                      favicon: null,
                      parent_id: null,
                      is_folder: 1,
                      sort_order: Date.now()
                    })

                    parentId = created?.id ?? null
                  }

                  await window.zap?.addFavorite({
                    title: bookmarkTitle.trim() || activeTab.title || activeTab.url,
                    url: activeTab.url,
                    favicon: null,
                    parent_id: parentId
                  })

                  const f = await window.zap?.getFavorites()
                  setFavBar(f || [])
                  window.dispatchEvent(new Event('favorites-updated'))

                  setShowBookmarkSave(false)
                }}
                style={{
                  padding:'7px 12px',
                  borderRadius:'var(--r-md)',
                  border:'1px solid var(--a)',
                  background:'var(--a)',
                  color:'#fff',
                  cursor:'pointer',
                  fontWeight:700,
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Bookmarks bar ────────────────────────────────────────── */}
      {showFavBar && favBar.length > 0 && (() => {
        const byParent: Record<string, any[]> = {}

        favBar.forEach((f:any) => {
          const key = String(f.parent_id ?? 'root')
          if (!byParent[key]) byParent[key] = []
          byParent[key].push(f)
        })

        const rootFolders = favBar.filter((f:any) =>
          !f.parent_id &&
          Number(f.is_folder) === 1 &&
          ['bookmarks bar', 'barra dei preferiti'].includes(String(f.title || '').toLowerCase())
        )

        const barRootId = rootFolders[0]?.id ?? null

        const rawBarItems = barRootId
          ? (byParent[String(barRootId)] || [])
          : favBar.filter((f:any) =>
              !f.parent_id &&
              !['bookmarks bar', 'barra dei preferiti'].includes(String(f.title || '').toLowerCase())
            )

        const barItems = [...rawBarItems].sort((a:any, b:any) =>
          Number(a.sort_order || 0) - Number(b.sort_order || 0) ||
          Number(a.id) - Number(b.id)
        )

        const createFolderInBar = async () => {
          try {
            console.log('[FavBar] plus/create folder clicked')

            let rootId = favBarRootIdRef.current ?? barRootId ?? null

            // If the bookmarks bar root is missing, create it once.
            if (!rootId) {
              const root = await window.zap?.addFavorite({
                title: 'Bookmarks Bar',
                url: '',
                favicon: null,
                parent_id: null,
                is_folder: 1,
                sort_order: 0,
              })

              rootId = root?.id ?? null
              favBarRootIdRef.current = rootId
            }

            const created = await window.zap?.addFavorite({
              title: 'New folder',
              url: '',
              favicon: null,
              parent_id: rootId,
              is_folder: 1,
              sort_order: Date.now(),
            })

            console.log('[FavBar] created folder result', created)

            const f = await window.zap?.getFavorites()
            setFavBar(f || [])
            window.dispatchEvent(new Event('favorites-updated'))

            const createdFolder = created?.id
              ? (f || []).find((item:any) => Number(item.id) === Number(created.id))
              : null

            if (createdFolder) {
              setFavRename(createdFolder)
              setFavRenameValue(createdFolder.title || 'New folder')
            } else {
              window.alert('Folder created, but could not open rename dialog.')
            }
          } catch (err:any) {
            console.error('[FavBar] create folder failed', err)
            window.alert('Create folder failed: ' + (err?.message || err))
          }
        }

        const handleEmptyBarAction = async () => {
          const result = await window.zap?.showBookmarkContextMenu?.(null)

          if (result?.action === 'new-bookmark') {
            setBookmarkTitle(activeTab?.title || activeTab?.url || '')
            setBookmarkFolder(barRootId == null ? 'root' : String(barRootId))
            setShowBookmarkSave(true)
          } else if (result?.action === 'new-folder') {
            await createFolderInBar()
          } else if (result?.action === 'import-bookmarks') {
            importBookmarksHtml()
          } else if (result?.action === 'export-bookmarks') {
            await exportBookmarksHtml()
          } else if (result?.action === 'refresh') {
            await refreshFavorites()
          }
        }

        const moveFavoriteTo = async (itemId: number, parentId: number | null, index: number) => {
          const result = await window.zap?.moveFavorite?.({
            id: itemId,
            parent_id: parentId,
            index,
          })

          if (result?.ok === false) {
            window.alert(result.error || 'Move failed')
          } else {
            await refreshFavorites()
          }

          setDragFavoriteId(null)
          setFavoriteDrop(null)
        }

        const addDraggedPage = async (page: CurrentPageDrag, parentId: number | null, index: number) => {
          const result = await window.zap?.addFavoriteAt?.({
            title: page.title || page.url,
            url: page.url,
            favicon: page.favicon || null,
            parent_id: parentId,
            index,
          })

          if (result?.ok === false) {
            window.alert(result.error || 'Could not create bookmark')
          } else {
            await refreshFavorites()
          }

          setDragCurrentPage(false)
          setFavoriteDrop(null)
        }

        const dropOnBarItem = async (
          target: any,
          position: 'before' | 'after' | 'inside',
          page: CurrentPageDrag | null,
        ) => {
          if (page) {
            if (position === 'inside' && Number(target.is_folder) === 1) {
              await addDraggedPage(page, Number(target.id), getChildren(target.id).length)
              return
            }

            const targetIndex = barItems.findIndex((item:any) => Number(item.id) === Number(target.id))
            await addDraggedPage(
              page,
              barRootId == null ? null : Number(barRootId),
              Math.max(0, targetIndex + (position === 'after' ? 1 : 0)),
            )
            return
          }

          if (dragFavoriteId == null || Number(target.id) === dragFavoriteId) return

          if (position === 'inside' && Number(target.is_folder) === 1) {
            await moveFavoriteTo(dragFavoriteId, Number(target.id), getChildren(target.id).length)
            return
          }

          const siblings = barItems.filter((item:any) => Number(item.id) !== dragFavoriteId)
          const targetIndex = siblings.findIndex((item:any) => Number(item.id) === Number(target.id))
          await moveFavoriteTo(
            dragFavoriteId,
            barRootId == null ? null : Number(barRootId),
            Math.max(0, targetIndex + (position === 'after' ? 1 : 0)),
          )
        }

        const visible = barItems.slice(0, favBarMax)
        const hidden  = barItems.slice(favBarMax)

        const getChildren = (id:any) => byParent[String(id)] || []

        const openFav = async (f:any, e?:any) => {
          if (Number(f.is_folder) === 1) {
            const children = getChildren(f.id)
            const rect = e?.currentTarget?.getBoundingClientRect?.()

            if (rect) {
              await window.zap?.showBookmarkFolderPopup?.({
                folder: f,
                items: children,
                x: window.screenX + rect.left,
                y: window.screenY + rect.bottom + 6,
              })
            }

            setFavFolderOpen(null)
            setFavDropOpen(false)
            return
          }

          handleNavigate(f.url)
          setFavFolderOpen(null)
          setFavDropOpen(false)
          window.zap?.hideBookmarkFolderPopup?.()
        }

        const renderMenuItems = (items:any[], depth = 0): any[] => {
          return items.flatMap((f:any) => {
            const isFolder = Number(f.is_folder) === 1
            const children = isFolder ? getChildren(f.id) : []

            return [
              <button
                key={`menu-${f.id}`}
                onClick={() => {
                  if (isFolder) return
                  handleNavigate(f.url)
                  setFavFolderOpen(null)
                  setFavDropOpen(false)
                }}
                onContextMenu={async (e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setFavContext({
                    x: e.clientX,
                    y: e.clientY,
                    item: f,
                    type: isFolder ? 'folder' : 'bookmark'
                  })
                  setFavDropOpen(false)
                }}
                onMouseDown={(e) => {
                  if (!isFolder && e.button === 1) {
                    e.preventDefault()
                    handleNewTab(f.url)
                    setFavFolderOpen(null)
                    setFavDropOpen(false)
                  }
                }}
                style={{
                  display:'flex',
                  alignItems:'center',
                  gap:6,
                  width:'100%',
                  textAlign:'left',
                  background:'none',
                  border:'none',
                  cursor: isFolder ? 'default' : 'pointer',
                  color:'var(--t0)',
                  fontSize:12,
                  padding:`7px 12px 7px ${12 + depth * 14}px`,
                  whiteSpace:'nowrap',
                  overflow:'hidden',
                  textOverflow:'ellipsis',
                }}
                onMouseEnter={e => (e.currentTarget.style.background='var(--bg-3)')}
                onMouseLeave={e => (e.currentTarget.style.background='none')}
              >
                <span>{isFolder ? '📁' : '🌐'}</span>
                <span style={{overflow:'hidden', textOverflow:'ellipsis'}}>{f.title || f.url}</span>
              </button>,
              ...(isFolder ? renderMenuItems(children, depth + 1) : [])
            ]
          })
        }

        return (
          <div
            data-zap-favbar="1"
            onContextMenu={async (e) => {
              const target = e.target as HTMLElement
              if (target.closest('[data-zap-favitem="1"]')) return

              e.preventDefault()
              e.stopPropagation()
              await handleEmptyBarAction()
              setFavFolderOpen(null)
              setFavDropOpen(false)
            }}
            onDragOver={(e) => {
              const currentPage = dragCurrentPage || hasCurrentPageDrag(e.dataTransfer)
              if (dragFavoriteId == null && !currentPage) return
              e.preventDefault()
              e.dataTransfer.dropEffect = currentPage ? 'copy' : 'move'
              setFavoriteDrop({ id: 'bar', position: 'inside' })
            }}
            onDrop={async (e) => {
              const page = readCurrentPageDrag(e.dataTransfer)
              if (dragFavoriteId == null && !page) return
              e.preventDefault()
              e.stopPropagation()
              if (page) {
                await addDraggedPage(
                  page,
                  barRootId == null ? null : Number(barRootId),
                  barItems.length,
                )
                return
              }
              const siblings = barItems.filter((item:any) => Number(item.id) !== dragFavoriteId)
              await moveFavoriteTo(
                dragFavoriteId,
                barRootId == null ? null : Number(barRootId),
                siblings.length,
              )
            }}
            className={favoriteDrop?.id === 'bar' ? 'bookmark-bar bookmark-drop-root' : 'bookmark-bar'}
            style={{
              display:'flex', alignItems:'center', gap:2,
              padding:'2px 8px', borderBottom:'1px solid var(--b0)',
              background:'var(--bg-1)', flexShrink:0,
              WebkitAppRegion:'no-drag' as any, height:28, position:'relative',
            }}
          >
            <button
              onClick={async () => {
                console.log('[FavBar] plus clicked')
                await createFolderInBar()
              }}
              title="Nuova cartella preferiti"
              style={{
                background:'none',
                border:'none',
                cursor:'pointer',
                color:'var(--t2)',
                fontSize:12,
                padding:'2px 7px',
                borderRadius:'var(--r-sm)',
                flexShrink:0,
              }}
              onMouseEnter={e => (e.currentTarget.style.background='var(--bg-3)')}
              onMouseLeave={e => (e.currentTarget.style.background='none')}
            >＋</button>

            {visible.map((f: any) => {
              const isFolder = Number(f.is_folder) === 1
              const children = isFolder ? getChildren(f.id) : []

              return (
                <div
                  key={f.id}
                  className={[
                    'bookmark-drag-item',
                    dragFavoriteId === Number(f.id) ? 'dragging' : '',
                    favoriteDrop?.id === Number(f.id) ? `drop-${favoriteDrop.position}` : '',
                  ].filter(Boolean).join(' ')}
                  style={{ position:'relative', flexShrink:0 }}
                  draggable
                  onDragStart={(e) => {
                    setDragFavoriteId(Number(f.id))
                    e.dataTransfer.effectAllowed = 'move'
                    e.dataTransfer.setData('application/x-zap-favorite', String(f.id))
                  }}
                  onDragEnd={() => {
                    setDragFavoriteId(null)
                    setFavoriteDrop(null)
                  }}
                  onDragOver={(e) => {
                    const currentPage = dragCurrentPage || hasCurrentPageDrag(e.dataTransfer)
                    if (!currentPage && (dragFavoriteId == null || dragFavoriteId === Number(f.id))) return
                    e.preventDefault()
                    e.stopPropagation()
                    e.dataTransfer.dropEffect = currentPage ? 'copy' : 'move'
                    const rect = e.currentTarget.getBoundingClientRect()
                    const ratio = (e.clientX - rect.left) / Math.max(1, rect.width)
                    const position = isFolder && ratio > .3 && ratio < .7
                      ? 'inside'
                      : ratio < .5 ? 'before' : 'after'
                    setFavoriteDrop({ id: Number(f.id), position })
                  }}
                  onDrop={async (e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    if (favoriteDrop?.id !== Number(f.id)) return
                    await dropOnBarItem(f, favoriteDrop.position, readCurrentPageDrag(e.dataTransfer))
                  }}
                >
                  <button
                    data-zap-favitem="1"
                    onClick={(e) => {
                      e.stopPropagation()
                      openFav(f, e)
                    }}
                    onContextMenu={async (e) => {
                      e.preventDefault()
                      e.stopPropagation()

                      window.zap?.showBookmarkContextMenu?.(f)

                      setFavFolderOpen(null)
                      setFavDropOpen(false)
                    }}
                    onMouseDown={(e) => {
                      if (!isFolder && e.button === 1) {
                        e.preventDefault()
                        handleNewTab(f.url)
                      }
                    }}
                    title={isFolder ? f.title : f.url}
                    style={{
                      background:'none', border:'none', cursor:'pointer',
                      color:'var(--t0)', fontSize:11, padding:'2px 7px',
                      borderRadius:'var(--r-sm)', whiteSpace:'nowrap',
                      display:'flex', alignItems:'center', gap:3, flexShrink:0,
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background='var(--bg-3)')}
                    onMouseLeave={e => (e.currentTarget.style.background='none')}
                  >
                    {isFolder ? '📁' : f.favicon ? (
                      <img className="bookmark-favicon" src={f.favicon} alt="" draggable={false} />
                    ) : '🌐'} {f.title?.slice(0, 18) || (() => { try { return new URL(f.url).hostname } catch(_) { return f.url } })()}
                  </button>


                </div>
              )
            })}

            {favContext && (
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  position:'fixed',
                  top:favContext.y,
                  left:favContext.x,
                  zIndex:10000,
                  minWidth:190,
                  background:'var(--bg-1)',
                  border:'1px solid var(--b1)',
                  borderRadius:'var(--r-md)',
                  boxShadow:'0 8px 32px rgba(0,0,0,.45)',
                  padding:'4px 0',
                  color:'var(--t0)',
                  fontSize:12,
                }}
              >
                {favContext.item && Number(favContext.item.is_folder) !== 1 && (
                  <button
                    onClick={() => {
                      handleNewTab(favContext.item.url)
                      setFavContext(null)
                    }}
                    style={{display:'block',width:'100%',textAlign:'left',padding:'7px 12px',background:'none',border:'none',color:'var(--t0)',cursor:'pointer'}}
                  >Open in new tab</button>
                )}

                {favContext.item && Number(favContext.item.is_folder) !== 1 && (
                  <button
                    onClick={async () => {
                      try { await navigator.clipboard.writeText(favContext.item.url || '') } catch (_) {}
                      setFavContext(null)
                    }}
                    style={{display:'block',width:'100%',textAlign:'left',padding:'7px 12px',background:'none',border:'none',color:'var(--t0)',cursor:'pointer'}}
                  >Copy URL</button>
                )}

                {favContext.item && (
                  <button
                    onClick={() => {
                      setFavRename(favContext.item)
                      setFavRenameValue(favContext.item.title || '')
                      setFavContext(null)
                    }}
                    style={{display:'block',width:'100%',textAlign:'left',padding:'7px 12px',background:'none',border:'none',color:'var(--t0)',cursor:'pointer'}}
                  >Rename</button>
                )}

                {favContext.item && (
                  <button
                    onClick={async () => {
                      const isFolder = Number(favContext.item.is_folder) === 1
                      const name = favContext.item.title || (isFolder ? 'this folder' : 'this bookmark')
                      const ok = window.confirm(
                        isFolder
                          ? `Delete folder "${name}" and all its contents?`
                          : `Delete bookmark "${name}"?`
                      )
                      if (!ok) {
                        setFavContext(null)
                        return
                      }
                      await window.zap?.removeFavorite({ id: favContext.item.id })
                      const f = await window.zap?.getFavorites()
                      setFavBar(f || [])
                      window.dispatchEvent(new Event('favorites-updated'))
                      setFavContext(null)
                    }}
                    style={{display:'block',width:'100%',textAlign:'left',padding:'7px 12px',background:'none',border:'none',color:'#ff6b6b',cursor:'pointer'}}
                  >Delete</button>
                )}

                {!favContext.item && (
                  <button
                    onClick={async () => {
                      await createFolderInBar()
                      setFavContext(null)
                    }}
                    style={{display:'block',width:'100%',textAlign:'left',padding:'7px 12px',background:'none',border:'none',color:'var(--t0)',cursor:'pointer'}}
                  >New folder</button>
                )}
              </div>
            )}

            {favRename && (
              <div
                style={{
                  position:'fixed',
                  inset:0,
                  zIndex:11000,
                  background:'rgba(0,0,0,.45)',
                  display:'flex',
                  alignItems:'center',
                  justifyContent:'center',
                }}
                onClick={() => setFavRename(null)}
              >
                <div
                  style={{
                    width:360,
                    background:'var(--bg-1)',
                    border:'1px solid var(--b1)',
                    borderRadius:'var(--r-lg)',
                    boxShadow:'0 12px 40px rgba(0,0,0,.5)',
                    padding:16,
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div style={{fontSize:14,fontWeight:700,marginBottom:10}}>
                    Rename {Number(favRename.is_folder) === 1 ? 'folder' : 'bookmark'}
                  </div>

                  <input
                    autoFocus
                    value={favRenameValue}
                    onChange={(e) => setFavRenameValue(e.target.value)}
                    onKeyDown={async (e) => {
                      if (e.key === 'Escape') setFavRename(null)
                      if (e.key === 'Enter' && favRenameValue.trim()) {
                        await window.zap?.renameFavorite({ id: favRename.id, title: favRenameValue.trim() })
                        const f = await window.zap?.getFavorites()
                        setFavBar(f || [])
                        window.dispatchEvent(new Event('favorites-updated'))
                        setFavRename(null)
                      }
                    }}
                    style={{
                      width:'100%',
                      boxSizing:'border-box',
                      background:'var(--bg-2)',
                      color:'var(--t0)',
                      border:'1px solid var(--b1)',
                      borderRadius:'var(--r-md)',
                      padding:'9px 10px',
                      fontSize:13,
                      outline:'none',
                    }}
                  />

                  <div style={{display:'flex',justifyContent:'flex-end',gap:8,marginTop:14}}>
                    <button
                      onClick={() => setFavRename(null)}
                      style={{padding:'7px 12px',borderRadius:'var(--r-md)',border:'1px solid var(--b1)',background:'var(--bg-2)',color:'var(--t0)',cursor:'pointer'}}
                    >Cancel</button>

                    <button
                      onClick={async () => {
                        if (!favRenameValue.trim()) return
                        await window.zap?.renameFavorite({ id: favRename.id, title: favRenameValue.trim() })
                        const f = await window.zap?.getFavorites()
                        setFavBar(f || [])
                        window.dispatchEvent(new Event('favorites-updated'))
                        setFavRename(null)
                      }}
                      style={{padding:'7px 12px',borderRadius:'var(--r-md)',border:'1px solid var(--a)',background:'var(--a)',color:'#fff',cursor:'pointer'}}
                    >Save</button>
                  </div>
                </div>
              </div>
            )}

            {hidden.length > 0 && (
              <div style={{ position:'relative', marginLeft:'auto', flexShrink:0 }}>
                <button
                  onClick={() => { setFavDropOpen(d => !d); setFavFolderOpen(null) }}
                  style={{
                    background:'none', border:'none', cursor:'pointer',
                    color:'var(--t2)', fontSize:12, padding:'2px 7px',
                    borderRadius:'var(--r-sm)',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background='var(--bg-3)')}
                  onMouseLeave={e => (e.currentTarget.style.background='none')}
                >»</button>

                {favDropOpen && (
                  <div style={{
                    position:'absolute', top:24, right:0, zIndex:9999,
                    background:'var(--bg-1)', border:'1px solid var(--b1)',
                    borderRadius:'var(--r-md)', boxShadow:'0 8px 32px rgba(0,0,0,.45)',
                    minWidth:260, maxHeight:360, overflowY:'auto', padding:'4px 0',
                  }}>
                    {renderMenuItems(hidden)}
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })()}


      {/* ── Browser body ─────────────────────────────────────────────── */}
      <div className="app-body">
        {/* New tab page (shown when tab is zap://newtab) */}
        {isNew && (
          <div style={{ flex:1, position:'relative' }}>
            <NewTabPage onNavigate={url => handleNavigate(url)} />
          </div>
        )}
        {/* When not new tab, BrowserView renders here (injected by Electron) */}
        {!isNew && <div style={{ flex:1 }} />}



      {/* Suggestions dropdown */}
        {showSuggest && (
          <div style={{
            position:'fixed',
            top:108,
            left:170,
            right:panel ? 340 : 24,
            background:'rgba(15,17,26,.96)',
            border:'1px solid var(--b1)',
            zIndex:999999,
            boxShadow:'0 18px 50px rgba(0,0,0,.55)',
            borderRadius:'18px',
            overflow:'hidden',
            backdropFilter:'blur(18px)',
            maxHeight:340,
            overflowY:'auto',
          }}>
            {suggestions.map((s: any, i: number) => (
              <div key={i} style={{
                display:'flex', alignItems:'center', gap:10,
                padding:'10px 16px',
                cursor:'pointer',
                borderBottom:'1px solid var(--b0)',
                background: selectedSuggest === i ? 'var(--bg-3)' : '',
              }}
                onMouseEnter={() => setSelectedSuggest(i)}
                onClick={()=>{ setShowSuggest(false); setSelectedSuggest(-1); setAddrVal(s.url); handleNavigate(s.url) }}
              >
                <img
                  src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(s.url)}&sz=32`}
                  alt=""
                  style={{
                    width:18,
                    height:18,
                    borderRadius:4,
                    flexShrink:0,
                    background:'rgba(255,255,255,.04)',
                  }}
                  onError={(e:any)=>{
                    e.currentTarget.style.display='none'
                  }}
                />

                <div style={{flex:1,overflow:'hidden'}}>
                  <div style={{fontSize:12.5,fontWeight:600,color:'var(--t0)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{s.title||s.url}</div>
                  <div style={{fontSize:10.5,color:'var(--t2)',fontFamily:'var(--mono)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{s.url}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Side panel */}
        {panel && (
          <div className={`side-panel ${panel === 'settings' ? 'settings-side-panel' : ''}`}>
            {panel === 'wallet'    && <WalletPanel    onClose={() => setPanel(null)} />}
            {panel === 'nostr'     && <NostrPanel     onClose={() => setPanel(null)} />}
            {panel === 'favorites' && <FavoritesPanel onClose={() => setPanel(null)} onNavigate={handleNavigate} onOpenNewTab={handleNewTab} currentUrl={activeTab?.url||''} currentTitle={activeTab?.title||''} />}
            {panel === 'settings'  && <SettingsPanel  onClose={() => setPanel(null)} />}
            {panel === 'downloads' && <DownloadsPanel downloads={downloads} onClose={() => setPanel(null)} />}
          </div>
        )}
      </div>

      {showUpdatePopup && updateInfo?.updateAvailable && (
        <div style={{
          position:'fixed',
          top:42,
          right:18,
          zIndex:999999,
          width:320,
          padding:14,
          background:'var(--bg-1)',
          border:'1px solid #facc15',
          borderRadius:'var(--r-md)',
          boxShadow:'0 18px 50px rgba(0,0,0,.55)',
          fontFamily:'var(--ff)',
        }}>
          <div style={{
            fontSize:13,
            fontWeight:900,
            color:'#facc15',
            marginBottom:6,
          }}>
            ⚡ {L('Aggiornamento disponibile','Update available')}
          </div>

          <div style={{
            fontSize:12,
            color:'var(--t1)',
            lineHeight:1.5,
            marginBottom:12,
          }}>
            {L(
              `Stai usando v${appVersion}. È disponibile v${updateInfo.latestVersion}.`,
              `You are using v${appVersion}. Version v${updateInfo.latestVersion} is available.`
            )}
          </div>

          <div style={{display:'flex',gap:8}}>
            <button
              className="act-btn primary"
              onClick={() => window.zap?.openReleasesPage?.()}
            >
              GitHub Releases
            </button>
            <button
              className="act-btn"
              onClick={() => setShowUpdatePopup(false)}
            >
              {L('Chiudi','Close')}
            </button>
          </div>
        </div>
      )}

      {incomingPayment && (
        <div style={{
          position:'fixed',
          bottom:180,
          right:24,
          zIndex:999999,
          width:280,
          padding:14,
          background:'var(--bg-1)',
          border:'1px solid var(--blue)',
          borderRadius:'var(--r-md)',
          boxShadow:'0 18px 50px rgba(0,0,0,.55)',
          fontFamily:'var(--ff)',
        }}>
          <div style={{
            fontSize:13,
            fontWeight:900,
            color:'var(--blue)',
            marginBottom:6,
          }}>
            ⚡ Payment received
          </div>

          <div style={{
            fontSize:22,
            fontWeight:900,
            color:'var(--t0)',
            marginBottom:4,
          }}>
            +{incomingPayment.amount.toLocaleString()} sats
          </div>
        </div>
      )}

      {paymentSuccess && (
        <div style={{
          position:'fixed',
          bottom:90,
          right:24,
          zIndex:999999,
          width:280,
          padding:14,
          background:'var(--bg-1)',
          border:'1px solid var(--green)',
          borderRadius:'var(--r-md)',
          boxShadow:'0 18px 50px rgba(0,0,0,.55)',
          fontFamily:'var(--ff)',
        }}>
          <div style={{fontSize:13,fontWeight:900,color:'var(--green)',marginBottom:6}}>
            ⚡ Payment sent
          </div>

          {paymentSuccess.amount && (
            <div style={{fontSize:22,fontWeight:900,color:'var(--t0)',marginBottom:8}}>
              {paymentSuccess.amount.toLocaleString()} sats
            </div>
          )}

          {paymentSuccess.preimage && (
            <div style={{fontSize:11,color:'var(--t2)',wordBreak:'break-all',lineHeight:1.4}}>
              preimage: {paymentSuccess.preimage.slice(0,24)}...
            </div>
          )}
        </div>
      )}

      {popupBlocked && (
        <div style={{
          position:'fixed',
          top:70,
          right:18,
          zIndex:999999,
          width:300,
          padding:12,
          background:'var(--bg-1)',
          border:'1px solid var(--green)',
          borderRadius:'var(--r-md)',
          boxShadow:'0 14px 40px rgba(0,0,0,.55)',
          fontFamily:'var(--ff)',
        }}>
          <div style={{fontSize:13,fontWeight:900,color:'var(--green)',marginBottom:5}}>
            🛡️ {L('Popup bloccato','Popup blocked')}
          </div>
          <div style={{fontSize:11.5,color:'var(--t1)',lineHeight:1.45,wordBreak:'break-all'}}>
            {popupBlocked.origin || popupBlocked.url || ''}
          </div>
        </div>
      )}

      {/* ── Payment popup ─────────────────────────────────────────────── */}
      {payment && (
        <div className="inv-popup">
          <span className="inv-ico">
            {payment.type === 'invoice' ? '⚡'
              : payment.type === 'cashu' ? '🥜'
              : payment.type === 'lnurl' ? '🔗'
              : payment.type === 'liquid' ? '💧'
              : '⚡'}
          </span>

          <div className="inv-body">
            <div className="inv-type">
              {payment.type === 'invoice' ? 'Lightning Invoice'
                : payment.type === 'cashu' ? 'Cashu Token'
                : payment.type === 'lnurl' ? 'LNURL Request'
                : payment.type === 'liquid' ? 'Liquid / L-BTC'
                : 'Lightning Request'}
            </div>

            {payment.amount && (
              <div className="inv-sats">{payment.amount.toLocaleString()} sats</div>
            )}

            {payment.type !== 'invoice' && payment.type !== 'cashu' && (
              <div style={{fontSize:11,color:'var(--t2)',marginTop:2}}>
                Detected, wallet flow coming soon
              </div>
            )}
          </div>

          {(payment.type === 'invoice' || payment.type === 'cashu') ? (
            <button className="inv-pay" onClick={handlePay} disabled={paying}>
              {paying ? '...' : payment.type === 'invoice' ? 'Paga ⚡' : 'Ricevi 🥜'}
            </button>
          ) : (
            <button
              className="inv-pay"
              onClick={() => setPayment(null)}
            >
              OK
            </button>
          )}

          <button className="inv-dismiss" onClick={() => setPayment(null)}>✕</button>
        </div>
      )}
    </div>
  )
}
