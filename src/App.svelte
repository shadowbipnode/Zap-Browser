<script lang="ts">
  import { invoke } from "@tauri-apps/api/tauri";
  import { onMount } from "svelte";

  let appState = 'loading'; 
  let vaultData = { seed: "", username: "Anon", customNsec: "", hasPassword: false };
  let tabs = [{ id: 1, title: 'Home', url: 'zap://home', active: true }];
  let activeTabId = 1;
  let urlInput = ""; 

  // Icone Privacy (Stato)
  let p_shield = true, p_cookie = true, p_ghost = true;

  onMount(async () => {
    const exists = await invoke("check_vault_exists");
    if (exists) {
      try {
        const payload: string = await invoke("unlock_sovereign_vault", { password: "" });
        vaultData = JSON.parse(payload);
        appState = 'browser';
      } catch (e) { appState = 'login'; }
    } else { appState = 'welcome'; }
    window.addEventListener('message', e => { if (e.data.ext === 'zap-nav') { urlInput = e.data.url; navigate(); } });
  });

  function navigate() {
    let target = urlInput.trim();
    if (!target || target === 'zap://home') {
      tabs = tabs.map(t => t.id === activeTabId ? { ...t, url: 'zap://home', title: 'Home' } : t);
      return;
    }
    if (!target.includes('.') || target.includes(' ')) {
      target = `https://duckduckgo.com/?q=${encodeURIComponent(target)}`;
    } else if (!target.startsWith('http')) { target = 'https://' + target; }
    
    const proxyUrl = target.replace('https://', 'zap://').replace('http://', 'zap://');
    tabs = tabs.map(t => t.id === activeTabId ? { ...t, url: proxyUrl, title: target.split('/')[2] || target } : t);
    urlInput = target;
  }

  function addTab() {
    const newId = Date.now();
    tabs = [...tabs.map(t => ({...t, active: false})), { id: newId, title: 'Home', url: 'zap://home', active: true }];
    activeTabId = newId; urlInput = "";
  }

  function switchTab(id) {
    activeTabId = id;
    tabs = tabs.map(t => ({ ...t, active: t.id === id }));
    const active = tabs.find(t => t.id === id);
    urlInput = active.url === 'zap://home' ? '' : active.url.replace('zap://', 'https://');
  }

  function closeTab(id, e) {
    e.stopPropagation(); if (tabs.length === 1) return;
    tabs = tabs.filter(t => t.id !== id);
    if (activeTabId === id) switchTab(tabs[0].id);
  }
</script>

{#if appState === 'browser'}
  <div class="app">
    <div class="tabs">
      {#each tabs as tab}
        <div class="tab {tab.active ? 'active' : ''}" on:mousedown={() => switchTab(tab.id)}>
          <span>{tab.title}</span>
          <button on:mousedown={(e) => closeTab(tab.id, e)}>×</button>
        </div>
      {/each}
      <button class="new-tab" on:click={addTab}>+</button>
    </div>

    <div class="toolbar">
      <button on:click={() => {urlInput=""; navigate();}}>🏠</button>
      <button on:click={navigate}>⟳</button>
      <form class="bar" on:submit|preventDefault={navigate}>
        <input bind:value={urlInput} placeholder="DuckDuckGo Search..." />
      </form>
      <div class="icons">
        <button class:on={p_shield} on:click={()=>p_shield=!p_shield}>🛡</button>
        <button class:on={p_cookie} on:click={()=>p_cookie=!p_cookie}>🍪</button>
        <button class:on={p_ghost} on:click={()=>p_ghost=!p_ghost}>👻</button>
        <button class="heart">💜</button>
      </div>
    </div>

    <div class="view-container">
      {#each tabs as tab}
        <div class="view {tab.active ? 'show' : ''}">
          {#if tab.url === 'zap://home'}
            <div class="home">
              <div class="logo">Zap</div>
              <input bind:value={urlInput} on:keydown={e => e.key === 'Enter' && navigate()} placeholder="Search the sovereign web..." />
            </div>
          {:else}
            <iframe src={tab.url} title="web"></iframe>
          {/if}
        </div>
      {/each}
    </div>
  </div>
{/if}

<style>
  :global(body) { margin: 0; background: #0b0b0e; color: white; font-family: sans-serif; }
  .app { display: flex; flex-direction: column; height: 100vh; }
  
  .tabs { display: flex; background: #000; padding: 4px 6px 0; gap: 4px; height: 32px; align-items: flex-end; }
  .tab { background: #1a1a1c; color: #777; padding: 4px 10px; border-radius: 6px 6px 0 0; font-size: 11px; cursor: pointer; min-width: 100px; display: flex; justify-content: space-between; }
  .tab.active { background: #16161a; color: white; border-bottom: 2px solid #7c3aed; }
  .tab button { background: none; border: none; color: inherit; cursor: pointer; }
  .new-tab { background: none; border: none; color: #555; cursor: pointer; font-size: 18px; }

  .toolbar { height: 48px; background: #16161a; display: flex; align-items: center; padding: 0 12px; gap: 12px; border-bottom: 1px solid #222; }
  .toolbar button { background: none; border: none; color: #aaa; cursor: pointer; font-size: 16px; }
  .bar { flex: 1; background: #000; border-radius: 20px; padding: 4px 16px; border: 1px solid #2d2d35; }
  .bar input { width: 100%; background: transparent; border: none; color: white; outline: none; font-size: 13px; }
  
  .icons { display: flex; gap: 6px; }
  .icons button { opacity: 0.3; transition: 0.2s; }
  .icons button.on { opacity: 1; color: #7c3aed; }

  .view-container { flex: 1; position: relative; }
  .view { position: absolute; inset: 0; display: none; }
  .view.show { display: block; }
  iframe { width: 100%; height: 100%; border: none; background: white; }

  .home { height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #0b0b0e; padding-bottom: 100px; }
  .logo { font-size: 120px; font-weight: 900; color: #7c3aed; margin-bottom: 40px; }
  .home input { width: 500px; background: #16161a; border: 2px solid #2d2d35; padding: 16px 24px; border-radius: 40px; color: white; font-size: 16px; outline: none; text-align: center; }
</style>