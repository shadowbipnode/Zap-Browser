// src/App.tsx
import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import OnboardingPage from './pages/OnboardingPage'
import BrowserPage from './pages/BrowserPage'
import './styles/globals.css'

type State = 'boot' | 'onboarding' | 'browser'

export default function App() {
  const [state, setState] = useState<State>('boot')

  useEffect(() => {
    invoke<boolean>('is_initialized')
      .then(ok => setState(ok ? 'browser' : 'onboarding'))
      .catch(() => setState('onboarding'))
  }, [])

  if (state === 'boot') return (
    <div style={{ height:'100vh', display:'flex', alignItems:'center', justifyContent:'center',
      background:'var(--bg-0)', fontSize:36 }}>⚡</div>
  )
  if (state === 'onboarding') return <OnboardingPage onDone={() => setState('browser')} />
  return <BrowserPage />
}
