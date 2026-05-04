import { create } from 'zustand'

export interface Tab {
  id: string
  url: string
  title: string
  favicon?: string
  loading: boolean
}

function makeTab(url = 'zap://newtab'): Tab {
  return {
    id: crypto.randomUUID(),
    url,
    title: url === 'zap://newtab' ? 'New Tab' : url,
    loading: false,
  }
}

const firstTab = makeTab('zap://newtab')

interface Store {
  tabs: Tab[]
  activeId: string
  addTab: (url?: string) => void
  closeTab: (id: string) => void
  setActive: (id: string) => void
  updateTab: (id: string, p: Partial<Tab>) => void
  navigate: (url: string) => void
}

export const useBrowser = create<Store>((set, get) => ({
  tabs: [firstTab],
  activeId: firstTab.id,

  addTab: (url) => {
    const t = makeTab(url)
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

  updateTab: (id, p) => set(s => ({
    tabs: s.tabs.map(t => t.id === id ? { ...t, ...p } : t),
  })),

  navigate: (url) => {
    const { activeId, updateTab } = get()
    if (activeId) updateTab(activeId, { url, loading: true })
  },
}))
