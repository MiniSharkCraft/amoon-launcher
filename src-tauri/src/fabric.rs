// src-tauri/src/fabric.rs
// Fabric mod loader installer

use std::fs;
use std::path::PathBuf;
use reqwest::Client;
use crate::download::{download_file, maven_to_path};

const FABRIC_META: &str = "https://meta.fabricmc.net/v2";

// Install Fabric cho 1 MC version → trả về version ID để dùng khi launch
// vd: "fabric-loader-0.16.9-1.21.4"
#[tauri::command]
pub async fn install_fabric(
    mc_version: String,
    game_dir:   String,
) -> Result<String, String> {
    let client = Client::new();

    // 1. Lấy danh sách loader versions
    let loaders_url = format!("{}/versions/loader/{}", FABRIC_META, mc_version);
    let loaders: Vec<serde_json::Value> = client
        .get(&loaders_url)
        .header("User-Agent", "AMoon-Launcher/1.0")
        .send().await.map_err(|e| e.to_string())?
        .json().await
        .map_err(|_| format!("Fabric không hỗ trợ Minecraft {}", mc_version))?;

    let loader_entry = loaders.iter()
        .find(|v| v["loader"]["stable"].as_bool().unwrap_or(false))
        .or(loaders.first())
        .ok_or("Không tìm thấy Fabric loader phù hợp")?;

    let loader_version = loader_entry["loader"]["version"]
        .as_str().ok_or("Không lấy được loader version")?;

    let fabric_id = format!("fabric-loader-{}-{}", loader_version, mc_version);

    // Check đã install chưa
    let version_dir = PathBuf::from(&game_dir)
        .join("versions").join(&fabric_id);
    let json_path = version_dir.join(format!("{}.json", fabric_id));
    if json_path.exists() {
        return Ok(fabric_id); // Already installed
    }

    // 2. Lấy Fabric profile JSON
    let profile_url = format!(
        "{}/versions/loader/{}/{}/profile/json",
        FABRIC_META, mc_version, loader_version
    );
    let profile_bytes = client
        .get(&profile_url)
        .header("User-Agent", "AMoon-Launcher/1.0")
        .send().await.map_err(|e| e.to_string())?
        .bytes().await.map_err(|e| e.to_string())?;

    // 3. Lưu version JSON
    fs::create_dir_all(&version_dir).map_err(|e| e.to_string())?;
    fs::write(&json_path, &profile_bytes).map_err(|e| e.to_string())?;

    // 4. Tạo empty jar (Fabric dùng vanilla jar qua inheritsFrom)
    let jar_path = version_dir.join(format!("{}.jar", fabric_id));
    if !jar_path.exists() {
        fs::write(&jar_path, b"").map_err(|e| e.to_string())?;
    }

    // 5. Download Fabric libraries
    let profile: serde_json::Value = serde_json::from_slice(&profile_bytes)
        .map_err(|e| e.to_string())?;

    let libs_dir = PathBuf::from(&game_dir).join("libraries");
    fs::create_dir_all(&libs_dir).map_err(|e| e.to_string())?;

    if let Some(libraries) = profile["libraries"].as_array() {
        for lib in libraries {
            let name = match lib["name"].as_str() { Some(n) => n, None => continue };
            let base_url = lib["url"].as_str().unwrap_or("https://repo1.maven.org/maven2/");

            let rel_path = maven_to_path(name);
            let lib_path = libs_dir.join(&rel_path);

            if lib_path.exists() { continue; }
            if let Some(p) = lib_path.parent() {
                fs::create_dir_all(p).map_err(|e| e.to_string())?;
            }

            let rel_str = rel_path.to_string_lossy().replace('\\', "/");
            let url = format!("{}/{}", base_url.trim_end_matches('/'), rel_str);

            // Non-fatal: bỏ qua nếu fail download 1 lib
            if let Err(_) = download_file(&client, &url, &lib_path).await {
                let _ = fs::remove_file(&lib_path);
            }
        }
    }

    Ok(fabric_id)
}

// Kiểm tra Fabric đã install cho version này chưa
#[tauri::command]
pub fn is_fabric_installed(mc_version: String, game_dir: String) -> bool {
    let dir = PathBuf::from(&game_dir).join("versions");
    let Ok(rd) = fs::read_dir(&dir) else { return false; };
    rd.flatten().any(|e| {
        let name = e.file_name().to_string_lossy().to_string();
        name.contains("fabric-loader") && name.ends_with(&mc_version)
    })
}
