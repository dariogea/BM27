//! BM27 desktop shell.
//!
//! The game itself is the web app in `apps/web`: the simulation runs in a Web Worker inside the
//! system web view. This crate only opens the window and provides native file dialogs, so that
//! saves are real files on the player's disk.

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .run(tauri::generate_context!())
        .expect("error while running BM27");
}
