// src-tauri/src/lightning.rs
// Nostr Wallet Connect (NWC) — NIP-47
// URI format: nostr+walletconnect://<wallet_pubkey>?relay=<relay>&secret=<secret>

use serde::{Deserialize, Serialize};
use rusqlite::params;
use url::Url;
use crate::db::{DB, now};

// ─── Types ────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NwcConnection {
    pub id:            i64,
    pub name:          String,
    pub relay_url:     String,
    pub wallet_pubkey: String,
    pub active:        bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DecodedInvoice {
    pub payment_request: String,
    pub amount_msat:     u64,
    pub description:     String,
    pub expiry:          u64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PayResult {
    pub success:  bool,
    pub preimage: Option<String>,
    pub fee_msat: Option<u64>,
    pub error:    Option<String>,
}

// ─── NWC URI parser ───────────────────────────────────────────────────────────

struct NwcUri { pubkey: String, relay: String, secret: String }

fn parse_nwc(uri: &str) -> Result<NwcUri, String> {
    let stripped = uri.trim()
        .strip_prefix("nostr+walletconnect://")
        .or_else(|| uri.trim().strip_prefix("nwc://"))
        .ok_or("Invalid NWC URI scheme — must start with nostr+walletconnect://")?;

    let fake = format!("nwc://{stripped}");
    let parsed = Url::parse(&fake).map_err(|e| e.to_string())?;
    let pubkey = parsed.host_str().ok_or("Missing pubkey")?.to_string();

    let mut relay  = String::new();
    let mut secret = String::new();
    for (k, v) in parsed.query_pairs() {
        match k.as_ref() {
            "relay"  => relay  = v.to_string(),
            "secret" => secret = v.to_string(),
            _ => {}
        }
    }
    if relay.is_empty()  { return Err("Missing relay param".into()); }
    if secret.is_empty() { return Err("Missing secret param".into()); }
    Ok(NwcUri { pubkey, relay, secret })
}

// ─── Commands ─────────────────────────────────────────────────────────────────

#[tauri::command]
pub fn nwc_connect(nwc_uri: String, name: String) -> Result<NwcConnection, String> {
    let parsed = parse_nwc(&nwc_uri)?;
    log::info!("[NWC] Connecting to relay: {}", parsed.relay);

    // Production: open WebSocket to relay, send get_info NIP-47 request to verify
    {
        let lock = DB.lock().unwrap();
        let conn = lock.as_ref().ok_or("DB not ready")?;
        conn.execute("UPDATE nwc_connections SET active=0", [])
            .map_err(|e| e.to_string())?;
        conn.execute(
            "INSERT INTO nwc_connections(name,relay_url,wallet_pubkey,secret,active,created_at) \
             VALUES(?1,?2,?3,?4,1,?5)",
            params![name, parsed.relay, parsed.pubkey, parsed.secret, now()],
        ).map_err(|e| e.to_string())?;
        let id = conn.last_insert_rowid();
        return Ok(NwcConnection { id, name, relay_url: parsed.relay, wallet_pubkey: parsed.pubkey, active: true });
    }
}

#[tauri::command]
pub fn nwc_disconnect() -> Result<(), String> {
    let lock = DB.lock().unwrap();
    let conn = lock.as_ref().ok_or("DB not ready")?;
    conn.execute("UPDATE nwc_connections SET active=0", []).map_err(|e| e.to_string())?;
    log::info!("[NWC] Disconnected");
    Ok(())
}

#[tauri::command]
pub fn nwc_is_connected() -> bool {
    let lock = DB.lock().unwrap();
    let conn = match lock.as_ref() { Some(c) => c, None => return false };
    conn.query_row(
        "SELECT COUNT(*) FROM nwc_connections WHERE active=1",
        [], |r| r.get::<_,i64>(0),
    ).unwrap_or(0) > 0
}

#[tauri::command]
pub async fn nwc_get_balance() -> Result<u64, String> {
    if !nwc_is_connected() { return Err("NWC not connected".into()); }
    // Production:
    //   1. Load connection (relay, wallet_pubkey, secret)
    //   2. Encrypt NIP-47 {method:"get_balance"} with ECDH(secret, wallet_pubkey)
    //   3. Publish encrypted kind:23194 event to relay
    //   4. Wait for kind:23195 response, decrypt, parse balance
    log::info!("[NWC] get_balance (stub)");
    Ok(0) // stub
}

#[tauri::command]
pub async fn nwc_pay_invoice(invoice: String) -> Result<PayResult, String> {
    if !nwc_is_connected() { return Err("NWC not connected".into()); }
    log::info!("[NWC] pay_invoice length={}", invoice.len());
    // Production: NIP-47 pay_invoice request → response with preimage
    Ok(PayResult { success: true, preimage: Some("preimage_hex".into()), fee_msat: Some(1), error: None })
}

#[tauri::command]
pub async fn nwc_make_invoice(amount_msat: u64, description: String) -> Result<String, String> {
    if !nwc_is_connected() { return Err("NWC not connected".into()); }
    log::info!("[NWC] make_invoice {}msat", amount_msat);
    Ok(format!("lnbc{}n1stub_invoice", amount_msat / 1000))
}

#[tauri::command]
pub fn decode_invoice(bolt11: String) -> Result<DecodedInvoice, String> {
    // Production: lightning-invoice crate or bolt11 decode
    Ok(DecodedInvoice {
        payment_request: bolt11,
        amount_msat: 1_000_000,
        description: "Payment".into(),
        expiry: 3600,
    })
}
