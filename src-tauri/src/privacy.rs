// src-tauri/src/privacy.rs
use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicU64, Ordering};
use rusqlite::params;
use crate::db::DB;

pub static BLOCKED_COUNT: AtomicU64 = AtomicU64::new(0);

/// Realistic UA pool — all from Firefox / Chrome / Safari on common platforms
const UA_POOL: &[&str] = &[
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:126.0) Gecko/20100101 Firefox/126.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14.5; rv:126.0) Gecko/20100101 Firefox/126.0",
    "Mozilla/5.0 (X11; Linux x86_64; rv:126.0) Gecko/20100101 Firefox/126.0",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 Edg/125.0.0.0",
    "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:126.0) Gecko/20100101 Firefox/126.0",
];

fn random_ua() -> String {
    UA_POOL[(rand::random::<u8>() as usize) % UA_POOL.len()].to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PrivacyStatus {
    pub adblock:          bool,
    pub webrtc_protect:   bool,
    pub ua_mode:          String,   // "rotate" | "custom" | "default"
    pub current_ua:       String,
    pub doh_enabled:      bool,
    pub doh_provider:     String,
    pub blocked_count:    u64,
}

#[tauri::command]
pub fn get_privacy_status() -> Result<PrivacyStatus, String> {
    let lock = DB.lock().unwrap();
    let conn = lock.as_ref().ok_or("DB not ready")?;
    let (adblock, webrtc, ua_mode, custom_ua, doh, doh_prov): (i32,i32,String,Option<String>,i32,String) =
        conn.query_row(
            "SELECT adblock,webrtc_protect,ua_mode,custom_ua,doh_enabled,doh_provider FROM privacy_settings WHERE id=1",
            [], |r| Ok((r.get(0)?,r.get(1)?,r.get(2)?,r.get(3)?,r.get(4)?,r.get(5)?)),
        ).map_err(|e| e.to_string())?;

    let current_ua = match ua_mode.as_str() {
        "custom"  => custom_ua.unwrap_or_else(random_ua),
        "rotate"  => random_ua(),
        _         => UA_POOL[0].to_string(),
    };

    Ok(PrivacyStatus {
        adblock: adblock == 1, webrtc_protect: webrtc == 1,
        ua_mode, current_ua, doh_enabled: doh == 1, doh_provider: doh_prov,
        blocked_count: BLOCKED_COUNT.load(Ordering::Relaxed),
    })
}

#[tauri::command]
pub fn set_adblock(enabled: bool) -> Result<(), String> {
    let lock = DB.lock().unwrap();
    let conn = lock.as_ref().ok_or("DB not ready")?;
    conn.execute("UPDATE privacy_settings SET adblock=?1 WHERE id=1", params![enabled as i32])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn set_webrtc_protection(enabled: bool) -> Result<(), String> {
    let lock = DB.lock().unwrap();
    let conn = lock.as_ref().ok_or("DB not ready")?;
    conn.execute("UPDATE privacy_settings SET webrtc_protect=?1 WHERE id=1", params![enabled as i32])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn get_useragents() -> Vec<String> {
    UA_POOL.iter().map(|s| s.to_string()).collect()
}

#[tauri::command]
pub fn set_useragent(mode: String, custom: Option<String>) -> Result<String, String> {
    let lock = DB.lock().unwrap();
    let conn = lock.as_ref().ok_or("DB not ready")?;
    conn.execute("UPDATE privacy_settings SET ua_mode=?1,custom_ua=?2 WHERE id=1",
        params![mode, custom.clone()]).map_err(|e| e.to_string())?;
    let ua = match mode.as_str() {
        "custom" => custom.unwrap_or_else(random_ua),
        "rotate" => random_ua(),
        _        => UA_POOL[0].to_string(),
    };
    Ok(ua)
}

#[tauri::command]
pub fn rotate_useragent() -> String { random_ua() }

#[tauri::command]
pub fn get_blocked_count() -> u64 { BLOCKED_COUNT.load(Ordering::Relaxed) }

pub fn bump_blocked() { BLOCKED_COUNT.fetch_add(1, Ordering::Relaxed); }
