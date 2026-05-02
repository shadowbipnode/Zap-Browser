// src-tauri/src/cashu.rs
use serde::{Deserialize, Serialize};
use rusqlite::params;
use crate::db::{DB, now};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CashuMint { pub url: String, pub name: Option<String>, pub balance: u64, pub active: bool }

#[tauri::command]
pub fn cashu_get_balance() -> u64 {
    let lock = DB.lock().unwrap();
    let conn = match lock.as_ref() { Some(c) => c, None => return 0 };
    conn.query_row(
        "SELECT COALESCE(SUM(amount),0) FROM cashu_proofs WHERE spent=0",
        [], |r| r.get::<_,i64>(0),
    ).unwrap_or(0) as u64
}

#[tauri::command]
pub fn cashu_list_mints() -> Result<Vec<CashuMint>, String> {
    let lock = DB.lock().unwrap();
    let conn = lock.as_ref().ok_or("DB not ready")?;
    let mut st = conn.prepare("SELECT url,name,active FROM cashu_mints").map_err(|e| e.to_string())?;
    st.query_map([], |r| Ok(CashuMint {
        url: r.get(0)?, name: r.get(1)?, balance: 0,
        active: r.get::<_,i32>(2)? == 1,
    })).map_err(|e| e.to_string())?
    .map(|r| r.map_err(|e| e.to_string())).collect()
}

#[tauri::command]
pub fn cashu_add_mint(url: String) -> Result<CashuMint, String> {
    let lock = DB.lock().unwrap();
    let conn = lock.as_ref().ok_or("DB not ready")?;
    conn.execute("INSERT OR IGNORE INTO cashu_mints(url,active,added_at) VALUES(?1,1,?2)",
        params![url, now()]).map_err(|e| e.to_string())?;
    Ok(CashuMint { url, name: None, balance: 0, active: true })
}

#[tauri::command]
pub fn cashu_remove_mint(url: String) -> Result<(), String> {
    let lock = DB.lock().unwrap();
    let conn = lock.as_ref().ok_or("DB not ready")?;
    conn.execute("DELETE FROM cashu_mints WHERE url=?1", params![url]).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn cashu_send_token(amount: u64, _mint_url: Option<String>) -> Result<String, String> {
    log::info!("[Cashu] send_token {}sat", amount);
    // Production: cashu-ts via JS bridge or cashu-rs FFI
    Ok("cashuAeyJ0b2tlbiI6W3sibWludCI6Imh0dHBzOi8vbWludC5leGFtcGxlLmNvbSIsInByb29mcyI6W119XX0=".to_string())
}

#[tauri::command]
pub fn cashu_receive_token(token: String) -> Result<u64, String> {
    log::info!("[Cashu] receive_token len={}", token.len());
    Ok(0) // production: swap proofs at mint, store in DB
}

#[tauri::command]
pub fn cashu_melt(token: String, invoice: String) -> Result<bool, String> {
    log::info!("[Cashu] melt token→lightning invoice");
    Ok(true)
}
