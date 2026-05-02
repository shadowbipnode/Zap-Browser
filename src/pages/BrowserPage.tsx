// src/pages/BrowserPage.tsx
import { useState } from 'react'
import TabBar    from '../components/browser/TabBar'
import Toolbar   from '../components/browser/Toolbar'
import WebArea   from '../components/browser/WebArea'
import WalletPanel    from '../components/wallet/WalletPanel'
import NostrPanel     from '../components/nostr/NostrPanel'
import FavoritesPanel from '../components/browser/FavoritesPanel'
import SettingsPanel  from '../components/settings/SettingsPanel'

export type Panel = 'wallet'|'nostr'|'favorites'|'settings'|null

export default function BrowserPage() {
  const [panel, setPanel] = useState<Panel>(null)
  const toggle = (p: Panel) => setPanel(prev => prev===p ? null : p)

  return (
    <div className="app">
      <TabBar />
      <Toolbar panel={panel} onToggle={toggle} />
      <div className="app-body">
        <WebArea />
        {panel && (
          <div className="side-panel">
            {panel==='wallet'    && <WalletPanel    onClose={()=>setPanel(null)} />}
            {panel==='nostr'     && <NostrPanel     onClose={()=>setPanel(null)} />}
            {panel==='favorites' && <FavoritesPanel onClose={()=>setPanel(null)} />}
            {panel==='settings'  && <SettingsPanel  onClose={()=>setPanel(null)} />}
          </div>
        )}
      </div>
    </div>
  )
}
