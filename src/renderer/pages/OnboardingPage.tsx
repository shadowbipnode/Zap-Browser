// src/renderer/pages/OnboardingPage.tsx
import { useState } from 'react'

type Step = 'welcome'|'seed'|'backup'|'nostr-choice'|'nostr-profile'|'done'
type Mode = 'bitcoin'|'normal'
type SeedMode = 'generate'|'import'
type NostrChoice = 'from-seed'|'import-nsec'|'skip'

export default function OnboardingPage({ onDone }: { onDone:()=>void }) {
  const [step, setStep] = useState<Step>('welcome')
  const [mode, setMode] = useState<Mode>('bitcoin')
  const [seedMode, setSeedMode] = useState<SeedMode>('generate')
  const [nostrCh, setNostrCh] = useState<NostrChoice>('from-seed')
  const [words, setWords] = useState<string[]>([])
  const [importW, setImportW] = useState('')
  const [importNsec, setImportNsec] = useState('')
  const [name, setName] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const [seedHex, setSeedHex] = useState('')

  const steps: Step[] = mode==='bitcoin'
    ? ['welcome','seed','backup','nostr-choice','nostr-profile','done']
    : ['welcome','done']
  const idx = steps.indexOf(step)

  const genSeed = async () => {
    setLoading(true); setErr('')
    try { const m = await (window as any).zap.generateMnemonic(); setWords(typeof m === "string" ? m.split(" ") : m) }
    catch(e: any) { setErr(String(e)) }
    setLoading(false)
  }

  const finalize = async (nc: NostrChoice) => {
    setLoading(true); setErr('')
    try {
      if (nc==='from-seed' && seedHex) await (window as any).zap.nostrCreateProfile({ seedHex, name: name||'anon', about: null })
      else if (nc==='import-nsec') await (window as any).zap.nostrImportNsec({ nsec: importNsec, name: name||'anon' })
      else await (window as any).zap.nostrSkip()
      setStep('done')
      setTimeout(onDone, 1400)
    } catch(e: any) { setErr(String(e)) }
    setLoading(false)
  }

  const onWelcomeNext = async () => {
    if (mode==='normal') {
      await (window as any).zap.setupWallet({ words:[], password:'', mode:'normal' })
      setStep('done'); setTimeout(onDone, 1200); return
    }
    setStep('seed')
    if (seedMode==='generate' && words.length===0) genSeed()
  }

  const onSeedNext = async () => {
    setErr('')
    const w = seedMode==='import' ? importW.trim().split(/\s+/) : words
    if (seedMode==='import') {
      const ok = await (window as any).zap.validateMnemonic({ words: w })
      if (!ok) { setErr('Mnemonic non valido'); return }
      setWords(w)
    }
    setLoading(true)
    try {
      const res = await (window as any).zap.setupWallet({ words: w, password:'', mode:'bitcoin' })
      setSeedHex(res.seedHex || '')
    } catch(e: any) { setErr(String(e)); setLoading(false); return }
    setLoading(false)
    setStep('backup')
  }

  return (
    <div className="ob-root">
      <div className="ob-glow" />
      <div className="ob-card">
        <div className="ob-logo">
          <span className="ob-bolt">⚡</span>
          <div className="ob-brand">Zap<em>Browser</em></div>
        </div>
        {mode==='bitcoin' && step!=='done' && (
          <div className="ob-steps">
            {steps.slice(0,-1).map((s,i) => (
              <div key={s} className={`ob-dot ${i===idx?'cur':i<idx?'done':''}`} />
            ))}
          </div>
        )}

        {step==='welcome' && <>
          <h2 className="ob-h">Benvenuto su Zap Browser</h2>
          <p className="ob-p">Browser privacy-first con Lightning (NWC), L-BTC, Cashu e Nostr nativo.</p>
          <div className="mode-cards">
            <div className={`mode-card ${mode==='bitcoin'?'sel':''}`} onClick={() => setMode('bitcoin')}>
              <div className="mc-title">⚡ Bitcoin + Privacy Mode</div>
              <div className="mc-desc">Seed 24 parole → wallet completo + identità Nostr. Privacy totale di default.</div>
            </div>
            <div className={`mode-card ${mode==='normal'?'sel':''}`} onClick={() => setMode('normal')}>
              <div className="mc-title">🌐 Browser Standard</div>
              <div className="mc-desc">Browser privacy-hardened senza wallet. Ad blocking attivo.</div>
            </div>
          </div>
          <button className="ob-btn primary" style={{ marginTop:20 }} onClick={onWelcomeNext} disabled={loading}>
            {loading ? 'Configurazione...' : 'Continua →'}
          </button>
        </>}

        {step==='seed' && <>
          <h2 className="ob-h">Seed del Wallet</h2>
          <p className="ob-p">24 parole che controllano identità Nostr, L-BTC e Cashu. Non condividerle mai.</p>
          <div style={{ display:'flex', gap:7, marginBottom:14 }}>
            <button className={`ob-btn ${seedMode==='generate'?'primary':'secondary'}`} style={{ marginTop:0, flex:1 }}
              onClick={() => { setSeedMode('generate'); if(!words.length) genSeed() }}>✦ Genera nuova</button>
            <button className={`ob-btn ${seedMode==='import'?'primary':'secondary'}`} style={{ marginTop:0, flex:1 }}
              onClick={() => setSeedMode('import')}>↓ Importa</button>
          </div>
          {seedMode==='generate' && (loading
            ? <p style={{ textAlign:'center', color:'var(--t2)', padding:'24px 0' }}>Generazione...</p>
            : <>
              <div className="warn-box">
                <span className="warn-ico">⚠️</span>
                <span className="warn-text">Scrivi queste 24 parole su carta offline. Non scattare screenshot.</span>
              </div>
              <div className="seed-grid">
                {words.map((w,i) => (
                  <div key={i} className="seed-word">
                    <span className="seed-n">{i+1}.</span>
                    <span className="seed-w">{w}</span>
                  </div>
                ))}
              </div>
              <button className="ob-btn ghost" onClick={genSeed} style={{ marginTop:4 }}>🔄 Rigenera</button>
            </>
          )}
          {seedMode==='import' && (
            <div className="field"><label>Inserisci le 24 parole</label>
              <textarea className="inp inp-mono" rows={5} placeholder="word1 word2 ..."
                value={importW} onChange={e => setImportW(e.target.value)} /></div>
          )}
          {err && <div className="msg err">{err}</div>}
          <button className="ob-btn primary" style={{ marginTop:14 }}
            disabled={loading||(seedMode==='generate'&&!words.length)} onClick={onSeedNext}>
            {loading ? 'Salvando...' : 'Ho salvato la seed →'}
          </button>
          <button className="ob-btn ghost" onClick={() => setStep('welcome')}>← Indietro</button>
        </>}

        {step==='backup' && <>
          <h2 className="ob-h">Conferma Backup</h2>
          <p className="ob-p">Conferma di aver salvato la tua seed phrase prima di continuare.</p>
          <label style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer', margin:'20px 0', fontSize:12.5, color:'var(--t1)' }}>
            <input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />
            Confermo di aver salvato la mia seed phrase da 24 parole
          </label>
          <button className="ob-btn primary" disabled={!confirmed} onClick={() => setStep('nostr-choice')}>Continua →</button>
          <button className="ob-btn ghost" onClick={() => setStep('seed')}>← Indietro</button>
        </>}

        {step==='nostr-choice' && <>
          <h2 className="ob-h">Identità Nostr</h2>
          <p className="ob-p">Il browser agisce da firmatario NIP-07 nativo — nessuna estensione necessaria.</p>
          <div className="mode-cards">
            {[
              {v:'from-seed', t:'🌱 Crea dalla seed', d:'Deriva keypair Nostr dalla tua seed (NIP-06).'},
              {v:'import-nsec', t:'🔑 Importa nsec', d:'Hai già un\'identità Nostr? Importa la tua nsec.'},
              {v:'skip', t:'⏭ Salta', d:'Configura Nostr dopo nelle impostazioni.'},
            ].map(o => (
              <div key={o.v} className={`mode-card ${nostrCh===o.v?'sel':''}`} onClick={() => setNostrCh(o.v as NostrChoice)}>
                <div className="mc-title">{o.t}</div>
                <div className="mc-desc">{o.d}</div>
              </div>
            ))}
          </div>
          <button className="ob-btn primary" style={{ marginTop:18 }}
            onClick={() => { if(nostrCh==='skip') finalize('skip'); else setStep('nostr-profile') }}>
            {nostrCh==='skip' ? 'Salta →' : 'Continua →'}
          </button>
          <button className="ob-btn ghost" onClick={() => setStep('backup')}>← Indietro</button>
        </>}

        {step==='nostr-profile' && <>
          <h2 className="ob-h">{nostrCh==='import-nsec' ? 'Importa chiave Nostr' : 'Crea profilo'}</h2>
          <p className="ob-p">{nostrCh==='import-nsec' ? 'La chiave viene cifrata e conservata solo nel browser.' : 'Il keypair sarà derivato dalla tua seed (NIP-06).'}</p>
          {nostrCh==='import-nsec' && (
            <div className="field"><label>Chiave nsec</label>
              <input className="inp inp-mono" type="password" placeholder="nsec1..."
                value={importNsec} onChange={e => setImportNsec(e.target.value)} /></div>
          )}
          <div className="field"><label>Nome utente Nostr</label>
            <input className="inp" placeholder="satoshi" maxLength={32}
              value={name} onChange={e => setName(e.target.value)} /></div>
          {err && <div className="msg err">{err}</div>}
          <button className="ob-btn primary" disabled={loading||!name.trim()} onClick={() => finalize(nostrCh)}>
            {loading ? 'Creazione...' : 'Crea identità →'}
          </button>
          <button className="ob-btn ghost" onClick={() => setStep('nostr-choice')}>← Indietro</button>
        </>}

        {step==='done' && (
          <div style={{ textAlign:'center', padding:'16px 0' }}>
            <div style={{ fontSize:46, marginBottom:14 }}>✅</div>
            <h2 className="ob-h">Pronto!</h2>
            <p className="ob-p" style={{ marginBottom:20 }}>Zap Browser è configurato. La tua privacy è protetta.</p>
            <div style={{ color:'var(--t2)', fontSize:11.5 }}>Avvio browser...</div>
          </div>
        )}
      </div>
    </div>
  )
}
