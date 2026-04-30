<script lang="ts">
  import { invoke } from "@tauri-apps/api/tauri";
  import { onMount } from "svelte";

  // --- STATI DELL'APPLICAZIONE ---
  // 'loading' -> 'welcome' -> 'setup' -> 'login' -> 'browser'
  let appState = 'loading'; 
  
  // --- DATI DEL CAVEAU SOVRANO ---
  let vaultData = {
    seed: "",
    username: "Anon",
    customNsec: "",
    hasPassword: false
  };
  let isSovereignMode = false;
  
  // --- VARIABILI UI ---
  let loginPassword = "";
  let setupPassword = "";
  let errorMsg = "";
  let isNostrModalOpen = false;
  let displayedPubkey = ""; // <-- ECCLA QUI! Variabile aggiunta

  // --- BROWSER STATES ---
  let urlInput = "zap://home"; 
  let currentUrl = urlInput;
  let searchQuery = "";
  let injectedHtml = ""; 
  let isLoading = false; 

  onMount(async () => {
    try {
      const exists = await invoke("check_vault_exists");
      if (exists) {
        // Proviamo a sbloccarlo senza password (se l'utente l'aveva disattivata)
        try {
          const payload: string = await invoke("unlock_sovereign_vault", { password: "" });
          vaultData = JSON.parse(payload);
          isSovereignMode = true;
          appState = 'browser';
        } catch (e) {
          // Ha una password, andiamo al login
          appState = 'login';
        }
      } else {
        appState = 'welcome';
      }
    } catch (e) {
      console.error(e);
      appState = 'welcome';
    }

    // NIP-07 Bridge Listener (Identico a prima)
    window.addEventListener('message', async (e) => {
      if (e.data && e.data.ext === 'zap-nostr') {
        let { id, method, params } = e.data;
        try {
          let result;
          if (method === 'getPublicKey') result = await invoke("get_nostr_pubkey");
          else if (method === 'signEvent') result = await invoke("sign_nostr_event", { event: params });
          else if (method === 'getRelays') result = { "wss://relay.damus.io": { read: true, write: true } };

          const iframe = document.querySelector('.web-frame') as HTMLIFrameElement;
          if (iframe && iframe.contentWindow) iframe.contentWindow.postMessage({ ext: 'zap-nostr-reply', id, result }, '*');
        } catch (error) { console.error("Nostr Bridge Error", error); }
      }
    });
  });

  // --- FUNZIONI DI SETUP & LOGIN ---
  function chooseStandard() {
    isSovereignMode = false;
    appState = 'browser';
  }

  async function chooseSovereign() {
    try {
      vaultData.seed = await invoke("generate_entropy");
      appState = 'setup';
    } catch (e) { errorMsg = e as string; }
  }

  async function finalizeSetup() {
    errorMsg = "";
    vaultData.hasPassword = setupPassword.length > 0;
    try {
      await invoke("save_sovereign_data", { 
        payload: JSON.stringify(vaultData), 
        password: setupPassword 
      });
      isSovereignMode = true;
      appState = 'browser';
    } catch (e) { errorMsg = e as string; }
  }

  async function unlockVault() {
    errorMsg = "";
    try {
      const payload: string = await invoke("unlock_sovereign_vault", { password: loginPassword });
      vaultData = JSON.parse(payload);
      isSovereignMode = true;
      appState = 'browser';
    } catch (e) { errorMsg = e as string; }
  }

  // --- FUNZIONI PANNELLO NOSTR (NIP-07) ---
  function toggleNostrModal() {
    if (!isSovereignMode) {
      alert("Devi attivare l'Identità Sovrana per usare Nostr.");
      return;
    }
    isNostrModalOpen = !isNostrModalOpen;
  }

  async function saveNostrSettings() {
    // Salva le modifiche all'nsec nel caveau in Rust
    try {
      // Usiamo la password di login che è in memoria (o stringa vuota se senza password)
      let currentPwd = vaultData.hasPassword ? loginPassword : "";
      if (appState === 'setup') currentPwd = setupPassword; // edge case
      
      await invoke("save_sovereign_data", { 
        payload: JSON.stringify(vaultData), 
        password: currentPwd 
      });
      isNostrModalOpen = false;
    } catch (e) { alert("Errore di salvataggio: " + e); }
  }

  // --- FUNZIONI BROWSER ---
  async function navigate(event?: Event) {
    if (event) event.preventDefault();
    let target = urlInput.trim();

    if (target.startsWith("[")) {
      const match = target.match(/\]\((.*?)\)/);
      target = (match && match[1]) ? match[1] : target.replace(/^\[/, '').replace(/\]$/, '');
    }

    if (target.startsWith("zap://")) {
      currentUrl = target; urlInput = target; injectedHtml = ""; return;
    }

    const hasSpaces = target.includes(" ");
    const hasDot = target.includes(".");
    const hasProtocol = target.startsWith("http://") || target.startsWith("https://");

    if ((hasSpaces || !hasDot) && !hasProtocol) {
      target = `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(target)}`;
    } else if (!hasProtocol) target = "https://" + target;

    currentUrl = target; urlInput = target;
    isLoading = true; injectedHtml = "";
    try {
      injectedHtml = await invoke("fetch_sovereign_page", { url: target });
    } catch (e) {
      injectedHtml = `<div style="font-family:sans-serif; padding:40px; color:red;"><h2>Connection Error</h2><p>${e}</p></div>`;
    } finally { isLoading = false; }
  }

  function performSearch() {
    if (searchQuery.trim()) { urlInput = searchQuery.trim(); navigate(); }
  }
</script>

<!-- ROUTER DELLE SCHERMATE -->
{#if appState === 'loading'}
  <div class="center-screen"><p>Inizializzazione Motore Cypherpunk...</p></div>

{:else if appState === 'welcome'}
  <main class="center-screen">
    <div class="card welcome-card">
      <img src="https://upload.wikimedia.org/wikipedia/commons/4/46/Bitcoin.svg" alt="Logo" class="logo-large" />
      <h1>Benvenuto in Zap Browser</h1>
      <p class="subtitle">Scegli come vuoi navigare in internet.</p>
      
      <div class="split-choices">
        <div class="choice-box">
          <h3>Navigazione Standard</h3>
          <p>Usa Zap come un browser normale. Veloce, privato, ma senza portafoglio o identità Web3.</p>
          <button class="secondary-btn" on:click={chooseStandard}>Inizia a Navigare</button>
        </div>
        <div class="choice-box highlighted">
          <h3>Identità Sovrana</h3>
          <p>Genera chiavi crittografiche per L-BTC e Nostr. Diventa proprietario dei tuoi dati.</p>
          <button class="primary-btn" on:click={chooseSovereign}>Crea Identità ➔</button>
        </div>
      </div>
    </div>
  </main>

{:else if appState === 'setup'}
  <main class="center-screen">
    <div class="card">
      <h2>Configurazione Sovrana</h2>
      <p class="description">Queste 24 parole controllano i tuoi fondi e la tua identità. <strong>Salvale offline.</strong></p>
      
      <div class="seed-grid">
        {#each vaultData.seed.split(" ") as word, i}
          <div class="word-badge"><span class="word-number">{i + 1}</span>{word}</div>
        {/each}
      </div>

      <div class="form-group">
        <label for="username">Nome Profilo Nostr</label>
        <input id="username" type="text" class="text-input" bind:value={vaultData.username} placeholder="es. Satoshi" />
      </div>

      <div class="form-group">
        <label for="pwd">Master Password (Opzionale ma consigliata)</label>
        <input id="pwd" type="password" class="text-input" bind:value={setupPassword} placeholder="Lascia vuoto per disattivare la password" />
      </div>

      <button class="primary-btn" on:click={finalizeSetup}>Salva Caveau & Entra</button>
      {#if errorMsg}<p class="error-msg">{errorMsg}</p>{/if}
    </div>
  </main>

{:else if appState === 'login'}
  <main class="center-screen">
    <div class="card login-card">
      <img src="https://upload.wikimedia.org/wikipedia/commons/4/46/Bitcoin.svg" alt="Logo" class="logo" />
      <h2>Caveau Bloccato</h2>
      <p class="description">Inserisci la tua password per decifrare le chiavi.</p>
      <form on:submit|preventDefault={unlockVault}>
        <input type="password" class="text-input" bind:value={loginPassword} placeholder="Master Password" autofocus />
        <button type="submit" class="primary-btn">Sblocca</button>
      </form>
      {#if errorMsg}<p class="error-msg">{errorMsg}</p>{/if}
    </div>
  </main>

{:else if appState === 'browser'}
  <div class="browser-container">
    <header class="browser-toolbar">
      <div class="nav-buttons">
        <button title="Home" on:click={() => { urlInput = "zap://home"; navigate(); }}>🏠</button>
        <button title="Refresh" on:click={() => navigate()}>⟳</button>
      </div>

      <form class="address-bar-form" on:submit|preventDefault={navigate}>
        <span class="lock-icon">🛡️</span>
        <input type="text" class="address-input" bind:value={urlInput} placeholder="Cerca nel web..." />
      </form>

      <div class="extension-buttons">
        <button class="wallet-btn" title="L-BTC Wallet">⚡</button>
        <button class="nostr-btn" title="Impostazioni Nostr" on:click={toggleNostrModal}>💜</button>
        <button class="settings-btn" title="Impostazioni">⚙️</button>
      </div>
    </header>

    <main class="web-view-area">
      {#if isLoading}<div class="loading-overlay">Intercettazione traffico in corso...</div>{/if}

      {#if currentUrl === 'zap://home'}
        <div class="start-page">
          <div class="start-content">
            <h1 class="start-title">Zap Browser</h1>
            <form class="search-form" on:submit|preventDefault={performSearch}>
              <input type="text" bind:value={searchQuery} placeholder="Cerca in modo sicuro..." class="search-input" autofocus />
              <button type="submit" class="search-btn">🔍</button>
            </form>
            <div class="quick-links">
              <div class="shortcut" on:click={() => { urlInput = "wikipedia.org"; navigate(); }}>📚 Wikipedia</div>
              <div class="shortcut" on:click={() => { urlInput = "mempool.space"; navigate(); }}>⛏️ Mempool</div>
            </div>
            
            <div class="nostr-test-box">
              <h3>💜 Test NIP-07 Sovrano</h3>
              <p>Clicca per testare la tua reale crittografia. Se funziona, vedrai la TUA vera Pubkey derivata dal caveau.</p>
              
              <button class="test-btn" on:click={async () => {
                try {
                  const pubkey = await invoke("get_nostr_pubkey");
                  displayedPubkey = pubkey; // Lo salviamo nella variabile
                } catch (e) { 
                  displayedPubkey = "Errore: " + e; 
                }
              }}>Richiedi Vera Pubkey</button>

              <!-- La chiave crittografica apparirà qui sotto -->
              {#if displayedPubkey}
                <div style="margin-top: 15px; padding: 15px; background: #fff; border-radius: 8px; border-left: 4px solid #7c3aed; word-break: break-all;">
                  <strong>La tua Identità (Hex):</strong><br>
                  <span style="font-family: monospace; color: #333;">{displayedPubkey}</span>
                </div>
              {/if}
            </div>
          </div>
        </div>
      {:else}
        <iframe srcdoc={injectedHtml} title="Web View" class="web-frame" sandbox="allow-scripts allow-same-origin allow-forms allow-popups"></iframe>
      {/if}
    </main>

    <!-- MODALE NOSTR (Si apre cliccando il cuore viola) -->
    {#if isNostrModalOpen}
      <div class="modal-backdrop" on:click={() => isNostrModalOpen = false}>
        <div class="modal-content" on:click|stopPropagation>
          <h2>Impostazioni Identità Nostr</h2>
          <div class="profile-header">
            <div class="avatar">💜</div>
            <div>
              <h3 style="margin:0;">{vaultData.username}</h3>
              <p style="margin:0; font-size:12px; color:#888;">Stato: {vaultData.customNsec ? 'Chiave Importata' : 'Derivazione Nativa NIP-06'}</p>
            </div>
          </div>
          
          <div class="form-group" style="margin-top: 20px;">
            <label for="nsec">Sostituisci Chiave Privata (nsec)</label>
            <p style="font-size: 13px; color: #555; margin-top:0;">Di default usiamo il seed a 24 parole. Se hai già un account Nostr, incolla qui la tua nsec per sovrascriverlo (Opzione C).</p>
            <input id="nsec" type="password" class="text-input" bind:value={vaultData.customNsec} placeholder="nsec1..." />
          </div>

          <div style="display: flex; gap: 10px; margin-top: 20px;">
            <button class="primary-btn" on:click={saveNostrSettings}>Salva e Chiudi</button>
          </div>
        </div>
      </div>
    {/if}
  </div>
{/if}

<style>
  :global(body) { background-color: #f3f4f6; color: #1f2937; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 0; padding: 0; width: 100vw; height: 100vh; overflow: hidden; }
  .center-screen { width: 100%; height: 100vh; display: flex; justify-content: center; align-items: center; background: #e5e7eb; }
  .card { background: #ffffff; border-radius: 12px; padding: 40px; box-shadow: 0 10px 25px rgba(0,0,0,0.1); width: 100%; max-width: 600px; }
  .welcome-card { max-width: 800px; text-align: center; }
  .logo-large { width: 64px; height: 64px; margin-bottom: 20px; }
  .split-choices { display: flex; gap: 20px; margin-top: 30px; text-align: left; }
  .choice-box { flex: 1; padding: 20px; border: 2px solid #e5e7eb; border-radius: 8px; display: flex; flex-direction: column; justify-content: space-between; }
  .choice-box.highlighted { border-color: #7c3aed; background: #f9f5ff; }
  .text-input { width: 100%; padding: 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px; margin-bottom: 16px; box-sizing: border-box; }
  .form-group { margin-bottom: 15px; text-align: left; }
  .form-group label { display: block; font-weight: 600; margin-bottom: 5px; font-size: 14px; }
  .primary-btn { background-color: #7c3aed; color: white; border: none; padding: 12px 24px; font-size: 15px; font-weight: 600; border-radius: 6px; cursor: pointer; width: 100%; }
  .primary-btn:hover { background-color: #6d28d9; }
  .secondary-btn { background-color: #4b5563; color: white; border: none; padding: 12px 24px; font-size: 15px; font-weight: 600; border-radius: 6px; cursor: pointer; width: 100%; }
  .seed-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 24px; }
  .word-badge { background-color: #f3f4f6; border: 1px solid #e5e7eb; padding: 6px 8px; border-radius: 4px; font-size: 13px; font-weight: bold;}
  .word-number { color: #9ca3af; font-size: 11px; margin-right: 5px; }
  .error-msg { color: #dc2626; margin-top: 16px; font-size: 14px; font-weight: bold; }

  /* BROWSER UI */
  .browser-container { display: flex; flex-direction: column; height: 100vh; width: 100vw; }
  .browser-toolbar { display: flex; align-items: center; padding: 8px 12px; background-color: #ffffff; border-bottom: 1px solid #cbd5e1; gap: 12px; height: 48px; box-sizing: border-box; }
  .nav-buttons button, .extension-buttons button { background: transparent; border: none; font-size: 18px; cursor: pointer; padding: 6px 10px; border-radius: 4px; transition: background-color 0.2s; }
  .nav-buttons button:hover, .extension-buttons button:hover { background-color: #f1f5f9; }
  .address-bar-form { flex-grow: 1; display: flex; align-items: center; background-color: #f1f5f9; border-radius: 20px; padding: 4px 16px; }
  .address-input { flex-grow: 1; border: none; background: transparent; outline: none; font-size: 14px; padding: 4px 0; font-family: inherit; margin-left: 8px; }
  .web-view-area { flex-grow: 1; background-color: #ffffff; position: relative; }
  .web-frame { width: 100%; height: 100%; border: none; display: block; }
  .loading-overlay { position: absolute; top: 10px; left: 50%; transform: translateX(-50%); background: #7c3aed; color: white; padding: 6px 16px; border-radius: 20px; font-size: 12px; font-weight: bold; box-shadow: 0 2px 10px rgba(0,0,0,0.3); z-index: 10; }

  /* START PAGE */
  .start-page { width: 100%; height: 100%; display: flex; justify-content: center; align-items: center; }
  .start-content { text-align: center; max-width: 600px; width: 100%; padding: 20px; }
  .start-title { font-size: 42px; font-weight: 800; margin-bottom: 40px; }
  .search-form { display: flex; gap: 10px; margin-bottom: 40px; }
  .search-input { flex-grow: 1; padding: 16px 24px; font-size: 16px; border-radius: 30px; border: 1px solid #d1d5db; outline: none; }
  .search-btn { padding: 0 24px; border-radius: 30px; border: none; background-color: #7c3aed; color: white; font-size: 18px; cursor: pointer; }
  .quick-links { display: flex; justify-content: center; gap: 15px; }
  .shortcut { padding: 12px 20px; background-color: #f3f4f6; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; }
  
  /* TEST BOX */
  .nostr-test-box { margin-top: 40px; padding: 20px; background-color: #f3e8ff; border: 1px solid #d8b4fe; border-radius: 12px; color: #4c1d95; text-align: left; }
  .nostr-test-box h3 { margin-top: 0; font-size: 18px; }
  .nostr-test-box p { font-size: 14px; margin-bottom: 15px; }
  .test-btn { background-color: #7c3aed; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 14px; }

  /* MODALE NOSTR */
  .modal-backdrop { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center; z-index: 1000; }
  .modal-content { background: white; padding: 30px; border-radius: 12px; width: 400px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1); }
  .profile-header { display: flex; align-items: center; gap: 15px; background: #f9f5ff; padding: 15px; border-radius: 8px; border: 1px solid #e9d5ff; }
  .avatar { width: 40px; height: 40px; background: #7c3aed; color: white; display: flex; justify-content: center; align-items: center; border-radius: 50%; font-size: 20px; }
</style>