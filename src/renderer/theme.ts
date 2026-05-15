export type ThemeName = 'amber' | 'glass' | 'minimal' | 'sovereign'

export const THEMES: { id: ThemeName; label: string; desc: string }[] = [
  { id: 'amber',     label: 'Amber Dark',     desc: 'Classic Bitcoin-inspired dark theme' },
  { id: 'glass',     label: 'Neon Glass',     desc: 'Premium Nostr glassmorphism theme' },
  { id: 'minimal',   label: 'Minimal Pro',    desc: 'Clean professional browser look' },
  { id: 'sovereign', label: 'Sovereign Dark', desc: 'Terminal-style privacy power-user theme' },
]

export function getTheme(): ThemeName {
  const saved = localStorage.getItem('zap-theme') as ThemeName | null
  if (saved && THEMES.some(t => t.id === saved)) return saved
  return 'amber'
}

export function setTheme(theme: ThemeName) {
  localStorage.setItem('zap-theme', theme)
  document.documentElement.setAttribute('data-theme', theme)
  window.dispatchEvent(new Event('theme-changed'))
}

export function applyTheme() {
  document.documentElement.setAttribute('data-theme', getTheme())
}
