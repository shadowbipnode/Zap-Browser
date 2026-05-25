import { create } from 'zustand'

export interface Tab {
  id: string
  url: string
  title: string
  favicon?: string
  loading: boolean
  private?: boolean
}

function makeTab(url = 'zap://newtab', id?: string, isPrivate = false): Tab {
  return {
    id: id || crypto.randomUUID(),
    url,
    title: url === 'zap://newtab' ? 'New Tab' : url,
    loading: false,
    private: isPrivate,
  }
}

const firstTab = makeTab('zap://newtab')

interface Store {
  tabs: Tab[]
  activeId: string
  addTab: (url?: string, id?: string, isPrivate?: boolean) => void
  closeTab: (id: string) => void
  setActive: (id: string) => void
  reorderTabs: (fromId: string, toId: string) => void
  updateTab: (id: string, p: Partial<Tab>) => void
  navigate: (url: string) => void
}

export const useBrowser = create<Store>((set, get) => ({
  tabs: [firstTab],
  activeId: firstTab.id,

  addTab: (url, id, isPrivate = false) => {
    const t = makeTab(url, id, isPrivate)
    set(s => ({ tabs: [...s.tabs, t], activeId: t.id }))
  },

  closeTab: (id) => set(s => {
    const tabs = s.tabs.filter(t => t.id !== id)
    if (!tabs.length) {
      const t = makeTab()
      return { tabs: [t], activeId: t.id }
    }
    return {
      tabs,
      activeId: s.activeId === id ? tabs[tabs.length - 1].id : s.activeId,
    }
  }),

  setActive: (id) => set({ activeId: id }),

  reorderTabs: (fromId, toId) => set(s => {
    const fromIndex = s.tabs.findIndex(t => t.id === fromId)
    const toIndex = s.tabs.findIndex(t => t.id === toId)

    if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return s

    const tabs = [...s.tabs]
    const [moved] = tabs.splice(fromIndex, 1)
    tabs.splice(toIndex, 0, moved)

    return { tabs }
  }),

  updateTab: (id, p) => set(s => ({
    tabs: s.tabs.map(t => t.id === id ? { ...t, ...p } : t),
  })),

  navigate: (url) => {
    const { activeId, updateTab } = get()
    if (activeId) updateTab(activeId, { url, loading: true })
  },
}))
