use bip39::Mnemonic;
use std::fs;
use tauri::AppHandle;

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

// I mock del NIP-07 rimangono per ora
#[tauri::command]
pub fn get_nostr_pubkey() -> Result<String, String> {
    Ok("a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2".into())
}

#[tauri::command]
pub fn sign_nostr_event(event: serde_json::Value) -> Result<serde_json::Value, String> {
    let mut signed_event = event.clone();
    signed_event["pubkey"] = serde_json::json!("a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2");
    signed_event["id"] = serde_json::json!("fake_id_12345678901234567890");
    signed_event["sig"] = serde_json::json!("fake_signature_1234567890");
    Ok(signed_event)
}