// src/renderer/App.tsx
import { useState, useEffect } from 'react'
import OnboardingPage from './pages/OnboardingPage'
import BrowserPage    from './pages/BrowserPage'

type State = 'boot' | 'onboarding' | 'browser'

declare global {
  interface Window { zap: any }
}

export default function App() {
  const [state, setState] = useState<State>('boot')

  useEffect(() => {
    // Listen for app-ready from main
    window.zap?.on('app-ready', ({ initialized }: any) => {
      setState(initialized ? 'browser' : 'onboarding')
    })
    // Fallback check
    window.zap?.isInitialized().then((ok: boolean) => {
      setState(ok ? 'browser' : 'onboarding')
    }).catch(() => setState('onboarding'))
  }, [])

  if (state === 'boot') return (
    <div style={{ height:'100vh', display:'flex', alignItems:'center',
      justifyContent:'center', background:'var(--bg0)', fontSize:40 }}>⚡</div>
  )
  if (state === 'onboarding') return <OnboardingPage onDone={() => setState('browser')} />
  return <BrowserPage />
}
