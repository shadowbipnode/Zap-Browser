// src/pages/OnboardingPage.tsx
import { useState } from 'react'
import { invoke } from '@tauri-apps/api/core'

type Step = 'welcome'|'seed'|'backup-confirm'|'nostr-choice'|'nostr-profile'|'done'
type Mode = 'bitcoin'|'normal'
type SeedMode = 'generate'|'import'
type NostrChoice = 'from-seed'|'import-nsec'|'skip'

export default function OnboardingPage({ onDone }: { onDone:()=>void }) {
  const [step,       setStep]       = useState<Step>('welcome')
  const [mode,       setMode]       = useState<Mode>('bitcoin')
  const [seedMode,   setSeedMode]   = useState<SeedMode>('generate')
  const [nostrCh,    setNostrCh]    = useState<NostrChoice>('from-seed')
  const [words,      setWords]      = useState<string[]>([])
  const [importW,    setImportW]    = useState('')
  const [importNsec, setImportNsec] = useState('')
  const [name,       setName]       = useState('')
  const [confirmed,  setConfirmed]  = useState(false)
  const [loading,    setLoading]    = useState(false)
  const [err,        setErr]        = useState('')
  const [seedHex,    setSeedHex]    = useState('')

  const steps: Step[] = mode==='bitcoin'
    ? ['welcome','seed','backup-confirm','nostr-choice','nostr-profile','done']
    : ['welcome','done']

  const idx = steps.indexOf(step)

  // ── Helpers ───────────────────────────────────────────────────────────────
  const genSeed = async () => {
    setLoading(true); setErr('')
    try { setWords(await invoke<string[]>('generate_mnemonic')) }
    catch(e:any) { setErr(String(e)) }
    setLoading(false)
  }

  const finalize = async (seedH: string, nc: NostrChoice) => {
    setLoading(true); setErr('')
    try {
      if (nc === 'from-seed' && seedH) {
        await invoke('create_profile', { seedHex: seedH, name: name || 'anon', about: null })
      } else if (nc === 'import-nsec') {
        await invoke('import_nsec', { nsec: importNsec, name: name || 'anon' })
      } else {
        await invoke('skip_nostr')
      }
      setStep('done')
      setTimeout(onDone, 1400)
    } catch(e:any) { setErr(String(e)) }
    setLoading(false)
  }

  // ── Handlers ──────────────────────────────────────────────────────────────
  const onWelcomeNext = async () => {
    if (mode === 'normal') {
      setLoading(true)
      try { await invoke('setup_wallet', { req:{words:[],password:'',mode:'normal'} }) }
      catch {}
      setLoading(false)
      setStep('done'); setTimeout(onDone,1200); return
    }
    setStep('seed')
    if (seedMode==='generate' && words.length===0) genSeed()
  }

  const onSeedNext = async () => {
    setErr('')
    if (seedMode === 'import') {
      const w = importW.trim().split(/\s+/)
      const ok = await invoke<boolean>('validate_mnemonic', {words:w})
      if (!ok) { setErr('Mnemonic non valido — ricontrolla le 24 parole'); return }
      setWords(w)
    }
    setLoading(true)
    try {
      const res = await invoke<{success:boolean; seed_hex?:string}>('setup_wallet', {
        req: { words: seedMode==='generate' ? words : importW.trim().split(/\s+/), password:'', mode:'bitcoin' }
      })
      setSeedHex(res.seed_hex || '')
    } catch(e:any) { setErr(String(e)); setLoading(false); return }
    setLoading(false)
    setStep('backup-confirm')
  }

  const onConfirmNext = () => { if (!confirmed) return; setStep('nostr-choice') }

  const onNostrChoiceNext = () => {
    if (nostrCh === 'skip') { finalize(seedHex, 'skip'); return }
    setStep('nostr-profile')
  }

  const onProfileNext = () => {
    if (!name.trim()) { setErr('Inserisci un nome utente'); return }
    if (nostrCh==='import-nsec' && !importNsec.trim()) { setErr("Inserisci la tua nsec"); return }
    finalize(seedHex, nostrCh)
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="ob-root">
      <div className="ob-glow" />
      <div className="ob-card">

        <div className="ob-logo">
          <span className="ob-bolt">⚡</span>
          <div className="ob-brand">Zap<em>Browser</em></div>
        </div>

        {/* Step dots */}
        {mode==='bitcoin' && step!=='done' && (
          <div className="ob-steps">
            {steps.slice(0,-1).map((s,i) => (
              <div key={s} className={`ob-dot ${i===idx?'cur':i<idx?'done':''}`} />
            ))}
          </div>
        )}

        {/* ── WELCOME ── */}
        {step==='welcome' && <>
          <h2 className="ob-h">Benvenuto su Zap Browser</h2>
          <p className="ob-p">Browser privacy-first con wallet Lightning (NWC), L-BTC, Cashu e identità Nostr nativa. Scegli come vuoi usarlo.</p>
          <div className="mode-cards">
            <div className={`mode-card ${mode==='bitcoin'?'sel':''}`} onClick={()=>setMode('bitcoin')}>
              <div className="mc-title">⚡ Modalità Bitcoin + Privacy</div>
              <div className="mc-desc">Seed da 24 parole → wallet NWC Lightning, L-BTC, Cashu e identità Nostr derivata. Privacy totale attiva di default.</div>
            </div>
            <div className={`mode-card ${mode==='normal'?'sel':''}`} onClick={()=>setMode('normal')}>
              <div className="mc-title">🌐 Modalità Browser Standard</div>
              <div className="mc-desc">Usa Zap come browser normale privacy-hardened (Tor Browser patches). No wallet, ad blocking e anti-fingerprinting attivi.</div>
            </div>
          </div>
          <button className="ob-btn primary" style={{marginTop:20}} onClick={onWelcomeNext} disabled={loading}>
            {loading ? 'Configurazione...' : 'Continua →'}
          </button>
        </>}

        {/* ── SEED ── */}
        {step==='seed' && <>
          <h2 className="ob-h">Seed del Wallet</h2>
          <p className="ob-p">24 parole che controllano la tua identità Nostr, il wallet L-BTC e i fondi Cashu. Non condividerle mai con nessuno.</p>
          <div style={{display:'flex',gap:7,marginBottom:14}}>
            <button className={`ob-btn ${seedMode==='generate'?'primary':'secondary'}`} style={{marginTop:0,flex:1}}
              onClick={()=>{ setSeedMode('generate'); if(!words.length) genSeed() }}>
              ✦ Genera nuova
            </button>
            <button className={`ob-btn ${seedMode==='import'?'primary':'secondary'}`} style={{marginTop:0,flex:1}}
              onClick={()=>setSeedMode('import')}>
              ↓ Importa esistente
            </button>
          </div>

          {seedMode==='generate' && (
            loading ? <p style={{textAlign:'center',color:'var(--t2)',padding:'24px 0'}}>Generazione...</p>
            : <>
              <div className="warn-box">
                <span className="warn-ico">⚠️</span>
                <span className="warn-text">Scrivi queste 24 parole su carta e conservale offline in modo sicuro. Non scattare screenshot.</span>
              </div>
              <div className="seed-grid">
                {words.map((w,i) => (
                  <div key={i} className="seed-word">
                    <span className="seed-n">{i+1}.</span>
                    <span className="seed-w">{w}</span>
                  </div>
                ))}
              </div>
              <button className="ob-btn ghost" onClick={genSeed} style={{marginTop:4}}>🔄 Rigenera</button>
            </>
          )}

          {seedMode==='import' && (
            <div className="field">
              <label>Inserisci le 24 parole (separate da spazio)</label>
              <textarea className="inp inp-mono" rows={5} placeholder="word1 word2 word3 ..."
                value={importW} onChange={e=>setImportW(e.target.value)} />
            </div>
          )}

          {err && <div className="msg err">{err}</div>}
          <button className="ob-btn primary" style={{marginTop:14}}
            disabled={loading || (seedMode==='generate' && !words.length)} onClick={onSeedNext}>
            {loading?'Salvando...':'Ho salvato la mia seed →'}
          </button>
          <button className="ob-btn ghost" onClick={()=>setStep('welcome')}>← Indietro</button>
        </>}

        {/* ── BACKUP CONFIRM ── */}
        {step==='backup-confirm' && <>
          <h2 className="ob-h">Conferma il Backup</h2>
          <p className="ob-p">Prima di continuare, conferma di aver salvato correttamente la tua seed phrase.</p>
          <div style={{background:'var(--bg-3)',border:'1px solid var(--b0)',borderRadius:'var(--r-md)',padding:18,marginBottom:18}}>
            {[
              ['📝','Scritta su carta?','Non salvarla digitalmente o in cloud'],
              ['🔒','In un posto sicuro offline?','Cassaforte, carta laminata raccomandata'],
              ['🤐','Mai condivisa con nessuno?','Nemmeno Zap Browser ti chiederà di nuovo'],
            ].map(([ico,t,d]) => (
              <div key={t} style={{display:'flex',alignItems:'center',gap:12,marginBottom:12}}>
                <span style={{fontSize:22}}>{ico}</span>
                <div>
                  <div style={{fontWeight:700,fontSize:13,color:'var(--t0)'}}>{t}</div>
                  <div style={{fontSize:11,color:'var(--t2)'}}>{d}</div>
                </div>
              </div>
            ))}
          </div>
          <label style={{display:'flex',alignItems:'center',gap:10,cursor:'pointer',marginBottom:16,fontSize:12.5,color:'var(--t1)'}}>
            <input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)} />
            Confermo di aver salvato la mia seed phrase da 24 parole
          </label>
          <button className="ob-btn primary" disabled={!confirmed} onClick={onConfirmNext}>Continua →</button>
          <button className="ob-btn ghost" onClick={()=>setStep('seed')}>← Indietro</button>
        </>}

        {/* ── NOSTR CHOICE ── */}
        {step==='nostr-choice' && <>
          <h2 className="ob-h">Identità Nostr</h2>
          <p className="ob-p">Nostr è un protocollo d'identità decentralizzato. Il browser agisce da firmatario NIP-07 nativo — nessuna estensione necessaria.</p>
          <div className="mode-cards">
            <div className={`mode-card ${nostrCh==='from-seed'?'sel':''}`} onClick={()=>setNostrCh('from-seed')}>
              <div className="mc-title">🌱 Crea dalla seed</div>
              <div className="mc-desc">Deriva un keypair Nostr dalla tua seed (NIP-06). Una seed, un'identità.</div>
            </div>
            <div className={`mode-card ${nostrCh==='import-nsec'?'sel':''}`} onClick={()=>setNostrCh('import-nsec')}>
              <div className="mc-title">🔑 Importa nsec esistente</div>
              <div className="mc-desc">Hai già un'identità Nostr? Importa la tua nsec per mantenerla.</div>
            </div>
            <div className={`mode-card ${nostrCh==='skip'?'sel':''}`} onClick={()=>setNostrCh('skip')}>
              <div className="mc-title">⏭ Salta per ora</div>
              <div className="mc-desc">I wallet funzionano comunque. Puoi configurare Nostr dopo nelle impostazioni.</div>
            </div>
          </div>
          <button className="ob-btn primary" style={{marginTop:18}} onClick={onNostrChoiceNext}>
            {nostrCh==='skip'?'Salta →':'Continua →'}
          </button>
          <button className="ob-btn ghost" onClick={()=>setStep('backup-confirm')}>← Indietro</button>
        </>}

        {/* ── NOSTR PROFILE ── */}
        {step==='nostr-profile' && <>
          <h2 className="ob-h">{nostrCh==='import-nsec'?'Importa chiave Nostr':'Crea il tuo profilo'}</h2>
          <p className="ob-p">
            {nostrCh==='import-nsec'
              ? 'Inserisci la tua nsec. La chiave verrà cifrata e conservata solo nel browser.'
              : 'Il keypair Nostr verrà derivato dalla tua seed (NIP-06, m/44\'/1237\'/0\'/0/0).'}
          </p>
          {nostrCh==='import-nsec' && (
            <div className="field">
              <label>Chiave nsec</label>
              <input className="inp inp-mono" type="password" placeholder="nsec1..."
                value={importNsec} onChange={e=>setImportNsec(e.target.value)} />
            </div>
          )}
          <div className="field">
            <label>Nome utente Nostr</label>
            <input className="inp" placeholder="satoshi" maxLength={32}
              value={name} onChange={e=>setName(e.target.value)} />
          </div>
          {err && <div className="msg err">{err}</div>}
          <button className="ob-btn primary" disabled={loading||!name.trim()} onClick={onProfileNext}>
            {loading?'Creazione...':'Crea identità →'}
          </button>
          <button className="ob-btn ghost" onClick={()=>setStep('nostr-choice')}>← Indietro</button>
        </>}

        {/* ── DONE ── */}
        {step==='done' && (
          <div style={{textAlign:'center',padding:'16px 0'}}>
            <div style={{fontSize:46,marginBottom:14}}>✅</div>
            <h2 className="ob-h">Pronto!</h2>
            <p className="ob-p" style={{marginBottom:20}}>Zap Browser è configurato. La tua privacy è protetta di default.</p>
            <div style={{background:'var(--bg-3)',border:'1px solid var(--b0)',borderRadius:'var(--r-md)',padding:14,textAlign:'left',marginBottom:18}}>
              {mode==='bitcoin' && <>
                {[
                  ['⚡','NWC Lightning — collega il tuo nodo nelle impostazioni'],
                  ['🔵','L-BTC — pronto a ricevere'],
                  ['🥜','Cashu — aggiungi mint nelle impostazioni'],
                ].map(([e,t])=>(
                  <div key={t} style={{display:'flex',gap:8,fontSize:12.5,marginBottom:6}}>
                    <span>{e}</span><span style={{color:'var(--t1)'}}>{t}</span>
                  </div>
                ))}
              </>}
              {[
                ['🛡️','Ad blocking — attivo'],
                ['🔌','WebRTC protection — attivo'],
                ['🎭','User-Agent rotation — attivo'],
                ['🔐','DNS over HTTPS — attivo'],
              ].map(([e,t])=>(
                <div key={t} style={{display:'flex',gap:8,fontSize:12.5,marginBottom:6}}>
                  <span>{e}</span><span style={{color:'var(--t1)'}}>{t}</span>
                </div>
              ))}
            </div>
            <div style={{color:'var(--t2)',fontSize:11.5}}>Avvio browser...</div>
          </div>
        )}
      </div>
    </div>
  )
}
