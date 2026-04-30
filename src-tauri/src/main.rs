#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod vault;

#[tauri::command]
async fn fetch_sovereign_page(url: String) -> Result<String, String> {
    let response = reqwest::get(&url).await.map_err(|e| e.to_string())?;
    let html = response.text().await.map_err(|e| e.to_string())?;
    
    // CYPHER-HACK: Il nostro payload NIP-07
    let nip07_script = r#"
    <script>
      window.nostr = {
        _requests: {}, _id: 0,
        async getPublicKey() { return this._call('getPublicKey'); },
        async signEvent(event) { return this._call('signEvent', event); },
        async getRelays() { return this._call('getRelays'); },
        _call(method, params) {
          return new Promise((resolve, reject) => {
            let id = ++this._id;
            this._requests[id] = { resolve, reject };
            window.parent.postMessage({ ext: 'zap-nostr', id, method, params }, '*');
          });
        }
      };
      // Ascolta le risposte dal nostro browser
      window.addEventListener('message', (e) => {
        if (e.data && e.data.ext === 'zap-nostr-reply') {
          let req = window.nostr._requests[e.data.id];
          if (req) {
            if (e.data.error) req.reject(new Error(e.data.error));
            else req.resolve(e.data.result);
            delete window.nostr._requests[e.data.id];
          }
        }
      });
    </script>
    "#;

    let base_tag = format!("<base href=\"{}\">\n{}", url, nip07_script);
    let injected_html = html.replacen("<head>", &format!("<head>\n{}", base_tag), 1);
    
    Ok(injected_html)
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            vault::check_vault_exists,
            vault::unlock_sovereign_vault,
            vault::save_sovereign_data, // Nuovo comando per salvare JSON
            vault::generate_entropy,    // Nuovo comando per generare le parole
            vault::get_nostr_pubkey,
            vault::sign_nostr_event,
            fetch_sovereign_page
        ])
        .run(tauri::generate_context!())
        .expect("Fatal error starting Sovereign Browser");
}