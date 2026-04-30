#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod vault;
use tauri::{Manager, http::ResponseBuilder};
use reqwest::header::{HeaderMap, HeaderValue as ReqHeaderValue, USER_AGENT, ACCEPT, ACCEPT_LANGUAGE, CONNECTION};
use std::sync::{Arc, Mutex};
use std::collections::HashMap;

struct ProxyState {
    cookies: Mutex<HashMap<String, String>>,
}

fn main() {
    let state = Arc::new(ProxyState { cookies: Mutex::new(HashMap::new()) });

    tauri::Builder::default()
        .manage(state.clone())
        .register_uri_scheme_protocol("zap", move |app, request| {
            let uri = request.uri();
            if uri == "zap://home" { return ResponseBuilder::new().status(404).body(vec![]); }

            let https_uri = uri.replacen("zap://", "https://", 1);
            let state_handle = app.state::<Arc<ProxyState>>();

            // Client con supporto compressione e cookie automatici
            let client = reqwest::blocking::Client::builder()
                .cookie_store(true)
                .gzip(true)
                .build()
                .unwrap();

            let mut headers = HeaderMap::new();
            headers.insert(USER_AGENT, ReqHeaderValue::from_static("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"));
            headers.insert(ACCEPT, ReqHeaderValue::from_static("text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8"));
            headers.insert(ACCEPT_LANGUAGE, ReqHeaderValue::from_static("it-IT,it;q=0.9,en-US;q=0.8"));
            headers.insert(CONNECTION, ReqHeaderValue::from_static("keep-alive"));

            match client.get(&https_uri).headers(headers).send() {
                Ok(res) => {
                    let content_type = res.headers().get("content-type")
                        .and_then(|v| v.to_str().ok()).unwrap_or("text/html").to_string();
                    let body = res.bytes().unwrap_or_default().to_vec();

                    let final_body = if content_type.contains("text/html") {
                        let html = String::from_utf8_lossy(&body);
                        let script = r#"<script>
                            window.nostr = {
                                async getPublicKey() { return window.__TAURI__.invoke('get_nostr_pubkey'); },
                                async signEvent(e) { return window.__TAURI__.invoke('sign_nostr_event', { event: e }); }
                            };
                            document.addEventListener('click', e => {
                                let a = e.target.closest('a');
                                if (a && a.href && a.href.startsWith('http')) {
                                    e.preventDefault();
                                    window.parent.postMessage({ ext: 'zap-nav', url: a.href }, '*');
                                }
                            });
                        </script>"#;
                        html.replacen("<head>", &format!("<head>{}", script), 1).into_bytes()
                    } else { body };

                    ResponseBuilder::new().mimetype(&content_type).body(final_body)
                }
                Err(_) => ResponseBuilder::new().status(502).body(b"Offline".to_vec())
            }
        })
        .invoke_handler(tauri::generate_handler![
            vault::check_vault_exists, vault::unlock_sovereign_vault,
            vault::save_sovereign_data, vault::generate_entropy,
            vault::get_nostr_pubkey, vault::sign_nostr_event, vault::nuke_vault
        ])
        .run(tauri::generate_context!())
        .expect("error");
}