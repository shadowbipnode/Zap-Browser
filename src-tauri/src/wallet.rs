// src-tauri/src/wallet.rs
use anyhow::Result;
use bip39::{Language, Mnemonic};
use serde::{Deserialize, Serialize};
use rusqlite::params;
use crate::db::{self, DB, now};

// ─── Mnemonic ─────────────────────────────────────────────────────────────────

/// Generate a fresh 24-word BIP39 mnemonic
#[tauri::command]
pub fn generate_mnemonic() -> Result<Vec<String>, String> {
    Mnemonic::generate_in(Language::English, 24)
        .map(|m| m.word_iter().map(String::from).collect())
        .map_err(|e| e.to_string())
}

/// Validate an imported mnemonic (returns bool, never errors)
#[tauri::command]
pub fn validate_mnemonic(words: Vec<String>) -> bool {
    Mnemonic::parse_in(Language::English, &words.join(" ")).is_ok()
}

// ─── Setup ────────────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct SetupRequest {
    pub words: Vec<String>, // empty = normal mode
    pub password: String,
    pub mode: String,       // "bitcoin" | "normal"
}

#[derive(Debug, Serialize)]
pub struct SetupResult {
    pub success: bool,
    pub seed_hex: Option<String>, // passed to nostr/liquid derivation
}

#[tauri::command]
pub fn setup_wallet(req: SetupRequest) -> Result<SetupResult, String> {
    let (encrypted_seed, salt, seed_hex) = if req.mode == "bitcoin" && !req.words.is_empty() {
        let mnemonic = Mnemonic::parse_in(Language::English, &req.words.join(" "))
            .map_err(|e| format!("Invalid mnemonic: {e}"))?;

        let seed = mnemonic.to_seed(&req.password);
        let seed_hex = hex::encode(&seed);

        // TODO production: AES-GCM encrypt seed with PBKDF2(password, salt)
        let salt  = hex::encode(rand::random::<[u8;16]>());
        let enc   = hex::encode(&seed[..32]); // simplified placeholder
        (enc, salt, Some(seed_hex))
    } else {
        (String::new(), String::new(), None)
    };

    {
        let lock = DB.lock().unwrap();
        let conn = lock.as_ref().ok_or("DB not ready")?;
        conn.execute(
            "INSERT OR REPLACE INTO wallet(id,encrypted_seed,salt,mode,created_at) VALUES(1,?1,?2,?3,?4)",
            params![encrypted_seed, salt, req.mode, now()],
        ).map_err(|e| e.to_string())?;
        conn.execute(
            "INSERT OR REPLACE INTO settings(key,value) VALUES('initialized','1')",
            [],
        ).map_err(|e| e.to_string())?;
    }

    log::info!("Wallet initialized — mode:{}", req.mode);
    Ok(SetupResult { success: true, seed_hex })
}

#[tauri::command]
pub fn is_initialized() -> bool {
    db::get("initialized").map(|v| v == "1").unwrap_or(false)
}

#[tauri::command]
pub fn unlock_wallet(_password: String) -> bool {
    // TODO: decrypt seed, verify checksum
    true
}

// ─── Favorites ────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Clone)]
pub struct Favorite {
    pub id: i64,
    pub title: String,
    pub url: String,
    pub favicon: Option<String>,
    pub created_at: i64,
}

#[tauri::command]
pub fn add_favorite(title: String, url: String, favicon: Option<String>) -> Result<i64, String> {
    let lock = DB.lock().unwrap();
    let conn = lock.as_ref().ok_or("DB not ready")?;
    conn.execute(
        "INSERT INTO favorites(title,url,favicon,created_at) VALUES(?1,?2,?3,?4)",
        params![title, url, favicon, now()],
    ).map_err(|e| e.to_string())?;
    Ok(conn.last_insert_rowid())
}

#[tauri::command]
pub fn get_favorites() -> Result<Vec<Favorite>, String> {
    let lock = DB.lock().unwrap();
    let conn = lock.as_ref().ok_or("DB not ready")?;
    let mut st = conn.prepare(
        "SELECT id,title,url,favicon,created_at FROM favorites ORDER BY created_at DESC"
    ).map_err(|e| e.to_string())?;
    st.query_map([], |r| Ok(Favorite {
        id: r.get(0)?, title: r.get(1)?, url: r.get(2)?,
        favicon: r.get(3)?, created_at: r.get(4)?,
    })).map_err(|e| e.to_string())?
    .map(|r| r.map_err(|e| e.to_string())).collect()
}

#[tauri::command]
pub fn remove_favorite(id: i64) -> Result<(), String> {
    let lock = DB.lock().unwrap();
    let conn = lock.as_ref().ok_or("DB not ready")?;
    conn.execute("DELETE FROM favorites WHERE id=?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}
