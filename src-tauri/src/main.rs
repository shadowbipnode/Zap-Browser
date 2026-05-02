// src-tauri/src/main.rs
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod db;
mod wallet;
mod lightning;
mod liquid;
mod cashu;
mod nostr;
mod privacy;

use tauri::Manager;

pub fn run() {
    env_logger::init();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .setup(|app| {
            let app_dir = app.path().app_data_dir()
                .expect("cannot resolve app data dir");
            std::fs::create_dir_all(&app_dir).ok();
            db::init(&app_dir).expect("DB init failed");
            log::info!("⚡ Zap Browser starting — data dir: {:?}", app_dir);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // ── Onboarding / Wallet ──────────────────────────────────────────
            wallet::is_initialized,
            wallet::generate_mnemonic,
            wallet::validate_mnemonic,
            wallet::setup_wallet,
            wallet::unlock_wallet,
            // ── Nostr ────────────────────────────────────────────────────────
            nostr::create_profile,
            nostr::import_nsec,
            nostr::skip_nostr,
            nostr::get_profile,
            nostr::get_pubkey,
            nostr::get_npub,
            nostr::sign_event,
            nostr::get_relays,
            // ── NWC (Lightning via Nostr Wallet Connect) ─────────────────────
            lightning::nwc_connect,
            lightning::nwc_disconnect,
            lightning::nwc_is_connected,
            lightning::nwc_get_balance,
            lightning::nwc_pay_invoice,
            lightning::nwc_make_invoice,
            lightning::decode_invoice,
            // ── Liquid L-BTC ─────────────────────────────────────────────────
            liquid::lbtc_get_balance,
            liquid::lbtc_get_address,
            liquid::lbtc_send,
            liquid::lbtc_get_transactions,
            // ── Cashu ────────────────────────────────────────────────────────
            cashu::cashu_get_balance,
            cashu::cashu_list_mints,
            cashu::cashu_add_mint,
            cashu::cashu_remove_mint,
            cashu::cashu_send_token,
            cashu::cashu_receive_token,
            cashu::cashu_melt,
            // ── Privacy ──────────────────────────────────────────────────────
            privacy::get_privacy_status,
            privacy::set_adblock,
            privacy::set_webrtc_protection,
            privacy::get_useragents,
            privacy::set_useragent,
            privacy::rotate_useragent,
            privacy::get_blocked_count,
            // ── Favorites ────────────────────────────────────────────────────
            wallet::add_favorite,
            wallet::get_favorites,
            wallet::remove_favorite,
        ])
        .run(tauri::generate_context!())
        .expect("error running Zap Browser");
}

fn main() { run(); }
