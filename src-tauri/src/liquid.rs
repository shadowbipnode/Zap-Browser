// src-tauri/src/liquid.rs
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LiquidAsset {
    pub asset_id:  String,
    pub name:      String,
    pub ticker:    String,
    pub balance:   u64,
    pub precision: u8,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LiquidTx {
    pub txid:         String,
    pub amount:       i64,
    pub ticker:       String,
    pub confirmed:    bool,
    pub timestamp:    u64,
}

/// L-BTC asset id (mainnet)
const LBTC_ASSET: &str = "6f0279e9ed041c3d710a9f57d0c02928416460c4b722ae3457a11eec381c526d";

#[tauri::command]
pub fn lbtc_get_balance() -> Vec<LiquidAsset> {
    // Production: libwally-core or bdk-liquid scan UTXO set
    vec![LiquidAsset {
        asset_id: LBTC_ASSET.to_string(),
        name: "Liquid Bitcoin".to_string(),
        ticker: "L-BTC".to_string(),
        balance: 0,
        precision: 8,
    }]
}

#[tauri::command]
pub fn lbtc_get_address() -> Result<String, String> {
    // Production: derive next unused confidential address from xpub
    Ok("ex1qzap_placeholder_address_not_real".to_string())
}

#[tauri::command]
pub fn lbtc_send(address: String, amount_sat: u64) -> Result<String, String> {
    log::info!("[Liquid] send {}sat → {}", amount_sat, address);
    Ok("txid_placeholder".to_string())
}

#[tauri::command]
pub fn lbtc_get_transactions() -> Vec<LiquidTx> { vec![] }
