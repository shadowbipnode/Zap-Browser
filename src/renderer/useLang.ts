import { useEffect, useState } from 'react'
import { getLang } from './i18n'

export function useLang() {
  const [lang, setLangState] = useState(getLang())

  useEffect(() => {
    const handler = () => setLangState(getLang())
    window.addEventListener('lang-changed', handler)
    return () => window.removeEventListener('lang-changed', handler)
  }, [])

  const L = (it: string, en: string) => lang === 'it' ? it : en

  return { lang, L }
}
