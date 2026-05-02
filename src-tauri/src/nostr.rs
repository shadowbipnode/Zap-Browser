// src-tauri/src/nostr.rs
// NIP-06: derive keypair from BIP39 seed  (m/44'/1237'/0'/0/0)
// NIP-07: browser acts as native signer — private key NEVER leaves Rust

use serde::{Deserialize, Serialize};
use rusqlite::params;
use crate::db::{DB, now};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NostrProfile {
    pub pubkey:     String,
    pub npub:       String,
    pub name:       Option<String>,
    pub about:      Option<String>,
    pub picture:    Option<String>,
    pub nip05:      Option<String>,
    pub lud16:      Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct NostrEvent {
    pub id:         Option<String>,
    pub pubkey:     String,
    pub created_at: u64,
    pub kind:       u32,
    pub tags:       Vec<Vec<String>>,
    pub content:    String,
    pub sig:        Option<String>,
}

// ─── Create profile from seed (NIP-06) ───────────────────────────────────────
#[tauri::command]
pub fn create_profile(seed_hex: String, name: String, about: Option<String>) -> Result<NostrProfile, String> {
    // Production: use nostr_sdk::Keys::from_mnemonic or manual NIP-06 derivation
    // m/44'/1237'/0'/0/0 via HMAC-SHA512 BIP32

    // Simplified: first 32 bytes of seed as secret key
    let seed_bytes = hex::decode(&seed_hex[..64.min(seed_hex.len())])
        .map_err(|e| e.to_string())?;
    let key_bytes: [u8; 32] = seed_bytes[..32].try_into().map_err(|_| "seed too short")?;

    let secp = secp256k1::Secp256k1::new();
    let sk = secp256k1::SecretKey::from_slice(&key_bytes)
        .map_err(|e| format!("invalid key: {e}"))?;
    let pk = secp256k1::PublicKey::from_secret_key(&secp, &sk);
    let pubkey_hex = hex::encode(&pk.serialize()[1..]); // x-only

    // bech32 npub (simplified)
    let npub = format!("npub1{}", &pubkey_hex[..32]);

    let nsec_hex = hex::encode(sk.secret_bytes());

    {
        let lock = DB.lock().unwrap();
        let conn = lock.as_ref().ok_or("DB not ready")?;
        conn.execute(
            "INSERT OR REPLACE INTO nostr_profile(id,pubkey,npub,encrypted_nsec,name,about,created_at) \
             VALUES(1,?1,?2,?3,?4,?5,?6)",
            params![pubkey_hex, npub, nsec_hex, name, about, now()],
        ).map_err(|e| e.to_string())?;
    }

    log::info!("[Nostr] Profile created npub={}", npub);
    Ok(NostrProfile { pubkey: pubkey_hex, npub, name: Some(name), about, picture: None, nip05: None, lud16: None })
}

// ─── Import existing nsec ──────────────────────────────────────────────────────
#[tauri::command]
pub fn import_nsec(nsec: String, name: Option<String>) -> Result<NostrProfile, String> {
    // Production: decode bech32 nsec, validate secp256k1
    let pubkey_hex = "imported_pubkey_placeholder".to_string();
    let npub       = "npub1imported_placeholder".to_string();

    {
        let lock = DB.lock().unwrap();
        let conn = lock.as_ref().ok_or("DB not ready")?;
        conn.execute(
            "INSERT OR REPLACE INTO nostr_profile(id,pubkey,npub,encrypted_nsec,name,created_at) \
             VALUES(1,?1,?2,?3,?4,?5)",
            params![pubkey_hex, npub, nsec, name, now()],
        ).map_err(|e| e.to_string())?;
    }

    Ok(NostrProfile { pubkey: pubkey_hex, npub, name, about: None, picture: None, nip05: None, lud16: None })
}

#[tauri::command]
pub fn skip_nostr() -> Result<(), String> {
    crate::db::set("nostr_skipped", "1").map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_profile() -> Result<Option<NostrProfile>, String> {
    let lock = DB.lock().unwrap();
    let conn = lock.as_ref().ok_or("DB not ready")?;
    let r = conn.query_row(
        "SELECT pubkey,npub,name,about,picture,nip05,lud16 FROM nostr_profile WHERE id=1",
        [],
        |r| Ok(NostrProfile {
            pubkey: r.get(0)?, npub: r.get(1)?,
            name: r.get(2)?, about: r.get(3)?,
            picture: r.get(4)?, nip05: r.get(5)?, lud16: r.get(6)?,
        }),
    ).ok();
    Ok(r)
}

#[tauri::command]
pub fn get_pubkey() -> Result<Option<String>, String> {
    Ok(get_profile()?.map(|p| p.pubkey))
}

#[tauri::command]
pub fn get_npub() -> Result<Option<String>, String> {
    Ok(get_profile()?.map(|p| p.npub))
}

/// NIP-07: sign event with stored private key — key stays in Rust, never in JS
#[tauri::command]
pub fn sign_event(mut event: NostrEvent) -> Result<NostrEvent, String> {
    log::info!("[NIP-07] Signing event kind={}", event.kind);
    // Production: load encrypted nsec → decrypt → secp256k1 sign → return signed event
    event.sig = Some("sig_placeholder_production_signs_here".to_string());
    event.id  = Some("id_placeholder".to_string());
    Ok(event)
}

#[tauri::command]
pub fn get_relays() -> Vec<String> {
    vec![
        "wss://relay.damus.io".to_string(),
        "wss://relay.nostr.band".to_string(),
        "wss://nos.lol".to_string(),
        "wss://relay.snort.social".to_string(),
        "wss://nostr.wine".to_string(),
    ]
}
