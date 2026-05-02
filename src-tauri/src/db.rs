// src-tauri/src/db.rs
// Encrypted SQLite via rusqlite (production: swap to SQLCipher)

use anyhow::Result;
use rusqlite::{Connection, params};
use std::{path::Path, sync::Mutex};

pub static DB: Mutex<Option<Connection>> = Mutex::new(None);

pub fn init(app_dir: &Path) -> Result<()> {
    let path = app_dir.join("zap.db");
    let conn = Connection::open(&path)?;

    conn.execute_batch("
        PRAGMA journal_mode = WAL;
        PRAGMA foreign_keys = ON;

        CREATE TABLE IF NOT EXISTS settings (
            key   TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS wallet (
            id              INTEGER PRIMARY KEY,
            encrypted_seed  TEXT NOT NULL,
            salt            TEXT NOT NULL,
            mode            TEXT NOT NULL DEFAULT 'bitcoin',
            created_at      INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS nostr_profile (
            id              INTEGER PRIMARY KEY,
            pubkey          TEXT NOT NULL,
            npub            TEXT NOT NULL,
            encrypted_nsec  TEXT,
            name            TEXT,
            about           TEXT,
            picture         TEXT,
            nip05           TEXT,
            lud16           TEXT,
            created_at      INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS cashu_mints (
            url         TEXT PRIMARY KEY,
            name        TEXT,
            active      INTEGER NOT NULL DEFAULT 1,
            added_at    INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS cashu_proofs (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            mint_url    TEXT NOT NULL,
            amount      INTEGER NOT NULL,
            secret      TEXT NOT NULL UNIQUE,
            c           TEXT NOT NULL,
            keyset_id   TEXT NOT NULL,
            spent       INTEGER NOT NULL DEFAULT 0,
            created_at  INTEGER NOT NULL,
            FOREIGN KEY (mint_url) REFERENCES cashu_mints(url)
        );

        CREATE TABLE IF NOT EXISTS favorites (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            title       TEXT NOT NULL,
            url         TEXT NOT NULL,
            favicon     TEXT,
            created_at  INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS nwc_connections (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            name        TEXT NOT NULL,
            relay_url   TEXT NOT NULL,
            wallet_pubkey TEXT NOT NULL,
            secret      TEXT NOT NULL,
            active      INTEGER NOT NULL DEFAULT 1,
            created_at  INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS privacy_settings (
            id              INTEGER PRIMARY KEY,
            adblock         INTEGER NOT NULL DEFAULT 1,
            webrtc_protect  INTEGER NOT NULL DEFAULT 1,
            ua_mode         TEXT    NOT NULL DEFAULT 'rotate',
            custom_ua       TEXT,
            doh_enabled     INTEGER NOT NULL DEFAULT 1,
            doh_provider    TEXT    NOT NULL DEFAULT 'https://cloudflare-dns.com/dns-query'
        );

        INSERT OR IGNORE INTO privacy_settings (id) VALUES (1);
    ")?;

    *DB.lock().unwrap() = Some(conn);
    log::info!("DB ready at {:?}", path);
    Ok(())
}

/// Helpers
pub fn get(key: &str) -> Option<String> {
    let lock = DB.lock().unwrap();
    let conn = lock.as_ref()?;
    conn.query_row("SELECT value FROM settings WHERE key=?1", params![key], |r| r.get(0)).ok()
}

pub fn set(key: &str, value: &str) -> Result<()> {
    let lock = DB.lock().unwrap();
    let conn = lock.as_ref().ok_or_else(|| anyhow::anyhow!("DB not init"))?;
    conn.execute("INSERT OR REPLACE INTO settings(key,value) VALUES(?1,?2)", params![key,value])?;
    Ok(())
}

pub fn now() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH).unwrap().as_secs() as i64
}
