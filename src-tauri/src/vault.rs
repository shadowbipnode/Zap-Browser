use bip39::Mnemonic;
use std::fs;
use tauri::AppHandle;
use nostr::prelude::*;
use serde::Deserialize;

#[tauri::command]
pub fn check_vault_exists(app_handle: AppHandle) -> bool {
    if let Some(mut path) = app_handle.path_resolver().app_data_dir() {
        path.push("sovereign_vault.enc");
        path.exists()
    } else {
        false
    }
}

#[tauri::command]
pub fn unlock_sovereign_vault(password: &str, app_handle: AppHandle) -> Result<String, String> {
    if let Some(mut path) = app_handle.path_resolver().app_data_dir() {
        path.push("sovereign_vault.enc");
        let data = fs::read_to_string(&path).map_err(|_| "Errore di lettura del caveau.")?;
        
        // MOCK: Controllo rudimentale della password
        let prefix = format!("MOCK_ENCRYPTED_DATA({}):", password);
        if data.starts_with(&prefix) {
            let payload = data.replace(&prefix, "");
            Ok(payload) // Ritorna il JSON con seed, username e nsec al frontend
        } else {
            Err("Password errata o caveau corrotto.".into())
        }
    } else {
        Err("Impossibile trovare il percorso dati.".into())
    }
}

// Nuovo comando unificato: riceve un JSON dal frontend e lo salva
#[tauri::command]
pub fn save_sovereign_data(payload: &str, password: &str, app_handle: AppHandle) -> Result<(), String> {
    let mock_encrypted_data = format!("MOCK_ENCRYPTED_DATA({}):{}", password, payload);
    if let Some(mut path) = app_handle.path_resolver().app_data_dir() {
        fs::create_dir_all(&path).map_err(|_| "Failed to create secure directory.")?;
        path.push("sovereign_vault.enc");
        fs::write(&path, mock_encrypted_data).map_err(|_| "Failed to write vault.")?;
        Ok(())
    } else {
        Err("Failed to resolve application data path.".into())
    }
}

// Generatore di entropia grezza per Svelte
#[tauri::command]
pub fn generate_entropy() -> Result<String, String> {
    let mnemonic = Mnemonic::generate(24).map_err(|_| "Errore critico di entropia.")?;
    Ok(mnemonic.to_string())
}

// Definiamo la struttura per leggere il JSON che arriva dal frontend
#[derive(Deserialize)]
struct VaultData {
    seed: String,
    #[serde(rename = "customNsec")]
    custom_nsec: String,
}

// Funzione interna per estrarre la vera chiave crittografica
fn get_keys_from_vault(app_handle: &AppHandle) -> Result<Keys, String> {
    let mut path = app_handle.path_resolver().app_data_dir().ok_or("Errore percorso dati".to_string())?;
    path.push("sovereign_vault.enc");
    let data = std::fs::read_to_string(&path).map_err(|_| "Impossibile leggere il caveau".to_string())?;
    
    // Rimuoviamo il prefisso della password
    let parts: Vec<&str> = data.splitn(2, ':').collect();
    if parts.len() != 2 { return Err("Formato caveau corrotto".to_string()); }
    
    // CORREZIONE QUI: Usiamo .to_string() per aiutare il compilatore
    let vault: VaultData = serde_json::from_str(parts[1]).map_err(|_| "Errore parsing JSON".to_string())?;
    
    // Se c'è una nsec custom, usiamo quella. Altrimenti NIP-06 dalle 24 parole.
    if !vault.custom_nsec.is_empty() {
        Keys::parse(&vault.custom_nsec).map_err(|_| "Chiave nsec non valida".to_string())
    } else {
        Keys::from_mnemonic(&vault.seed, None).map_err(|_| "Errore derivazione NIP-06".to_string())
    }
}

// RESTITUISCE LA TUA VERA CHIAVE PUBBLICA!
#[tauri::command]
pub fn get_nostr_pubkey(app_handle: AppHandle) -> Result<String, String> {
    let keys = get_keys_from_vault(&app_handle)?;
    Ok(keys.public_key().to_hex()) // Ritorna l'hex esatto per il web
}

// LA FUNZIONE DI FIRMA (Per ora parziale in attesa di sbloccare le SPA)
#[tauri::command]
pub fn sign_nostr_event(event: serde_json::Value, app_handle: AppHandle) -> Result<serde_json::Value, String> {
    let keys = get_keys_from_vault(&app_handle)?;
    let mut signed_event = event.clone();
    
    signed_event["pubkey"] = serde_json::json!(keys.public_key().to_hex());
    signed_event["id"] = serde_json::json!("fake_id_12345678901234567890");
    signed_event["sig"] = serde_json::json!("fake_signature_1234567890");
    Ok(signed_event)
}