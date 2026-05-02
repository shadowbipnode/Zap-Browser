// src/store/browserStore.ts
import { create } from 'zustand'

export interface Tab { id:string; url:string; title:string; favicon?:string; loading:boolean }

const make = (url='zap://newtab'): Tab => ({
  id: crypto.randomUUID(), url, title: url==='zap://newtab' ? 'New Tab' : url, loading: false
})

interface Store {
  tabs: Tab[]; activeId: string | null
  addTab: (url?:string)=>void
  closeTab: (id:string)=>void
  setActive: (id:string)=>void
  updateTab: (id:string, p:Partial<Tab>)=>void
  navigate: (url:string)=>void
}

export const useBrowser = create<Store>((set,get) => ({
  tabs: [make()], activeId: null,
  addTab: (url) => { const t=make(url); set(s=>({tabs:[...s.tabs,t], activeId:t.id})) },
  closeTab: (id) => set(s => {
    const tabs = s.tabs.filter(t=>t.id!==id)
    if (!tabs.length) tabs.push(make())
    return { tabs, activeId: s.activeId===id ? tabs[tabs.length-1].id : s.activeId }
  }),
  setActive: (id) => set({activeId: id}),
  updateTab: (id,p) => set(s=>({tabs: s.tabs.map(t=>t.id===id?{...t,...p}:t)})),
  navigate: (url) => {
    const {activeId, updateTab} = get()
    if (activeId) {
      let u = url.trim()
      if (!u.startsWith('http') && !u.startsWith('zap://') && !u.startsWith('ipfs://'))
        u = u.includes('.') ? `https://${u}` : `https://duckduckgo.com/?q=${encodeURIComponent(u)}`
      updateTab(activeId, {url:u, loading:true, title:u})
    }
  }
}))
