mod auth;
mod java;
mod download;
mod launcher;
mod mods;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            // Auth
            auth::login_offline,
            auth::login_microsoft_start,
            auth::login_microsoft_finish,
            auth::login_elyby,
            auth::login_elyby_start,

            // Java
            java::detect_java,
            java::download_java,

            // Download
            download::get_version_manifest,
            download::download_version,
            download::verify_file,
            download::get_download_progress,

            // Launcher
            launcher::launch_game,

            // Mods
            mods::search_modrinth,
            mods::install_mod,
            mods::list_installed_mods,
            mods::delete_mod,
            mods::search_shaders,
            mods::install_shader,
            mods::list_resource_packs,
            mods::install_resource_pack,
        ])
        .run(tauri::generate_context!())
        .expect("AMoon Launcher failed to start");
}
