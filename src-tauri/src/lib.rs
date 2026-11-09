mod db;

use std::path::PathBuf;

use tauri::Manager;

/// Writes text to a path the user picked in a save dialog (used for JSON export).
#[tauri::command]
fn save_text_file(path: PathBuf, contents: String) -> Result<(), String> {
    std::fs::write(path, contents).map_err(|e| e.to_string())
}

/// Writes bytes to a path the user picked in a save dialog (used for PDF sharing).
#[tauri::command]
fn save_binary_file(path: PathBuf, contents: Vec<u8>) -> Result<(), String> {
    std::fs::write(path, contents).map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&dir)?;
            let db = db::Db::open(&dir.join("mealrcord.db"))?;
            app.manage(db);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            db::db_query,
            db::db_batch,
            db::db_backup,
            db::db_restore,
            save_text_file,
            save_binary_file,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
