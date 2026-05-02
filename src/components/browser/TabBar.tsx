// src/components/browser/TabBar.tsx
import { useBrowser } from '../../store/browserStore'
export default function TabBar() {
  const { tabs, activeId, setActive, closeTab, addTab } = useBrowser()
  return (
    <div className="tabbar">
      {tabs.map(t => (
        <div key={t.id} className={`tab ${t.id===activeId?'active':''}`} onClick={()=>setActive(t.id)}>
          <span className="tab-icon">{t.favicon||'🌐'}</span>
          <span className="tab-label">{t.loading?'Caricamento...':t.title}</span>
          <button className="tab-x" onClick={e=>{e.stopPropagation();closeTab(t.id)}}>×</button>
        </div>
      ))}
      <button className="tab-new" onClick={()=>addTab()} title="Nuova scheda">+</button>
    </div>
  )
}
