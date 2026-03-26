// src-tauri/src/download.rs
// Download game files từ Mojang: client.jar, libraries, assets

use serde::{Deserialize, Serialize};
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use sha1::{Sha1, Digest};
use reqwest::Client;

// ─── Progress tracking ────────────────────────────────────────────────────────
#[derive(Debug, Clone, Serialize)]
pub struct DownloadProgress {
    pub total:     u64,
    pub completed: u64,
    pub current:   String,
}

lazy_static::lazy_static! {
    static ref PROGRESS: Arc<Mutex<DownloadProgress>> = Arc::new(Mutex::new(
        DownloadProgress { total: 0, completed: 0, current: String::new() }
    ));
}

fn set_progress(total: u64, completed: u64, current: &str) {
    let mut p = PROGRESS.lock().unwrap();
    p.total     = total;
    p.completed = completed;
    p.current   = current.to_string();
}

#[tauri::command]
pub fn get_download_progress() -> DownloadProgress {
    PROGRESS.lock().unwrap().clone()
}

// ─── Mojang structs ───────────────────────────────────────────────────────────
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct VersionManifest {
    pub latest:   LatestVersions,
    pub versions: Vec<VersionEntry>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LatestVersions {
    pub release:  String,
    pub snapshot: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct VersionEntry {
    pub id:   String,
    #[serde(rename = "type")]
    pub version_type: String,
    pub url:  String,
    pub sha1: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct VersionDetail {
    pub id:           String,
    pub downloads:    Option<Downloads>,   // Fabric không có field này
    pub libraries:    Vec<Library>,
    #[serde(rename = "assetIndex")]
    pub asset_index:  Option<AssetIndex>,  // Fabric không có field này
    #[serde(rename = "mainClass")]
    pub main_class:   String,
    pub arguments:    Option<serde_json::Value>,
    #[serde(rename = "minecraftArguments")]
    pub legacy_args:  Option<String>,
    #[serde(rename = "inheritsFrom")]
    pub inherits_from: Option<String>,     // Fabric/Forge dùng để extend vanilla
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Downloads {
    pub client: FileInfo,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FileInfo {
    pub url:  String,
    pub sha1: String,
    pub size: u64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Library {
    pub name:      String,
    pub downloads: Option<LibraryDownloads>,
    pub rules:     Option<Vec<Rule>>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LibraryDownloads {
    pub artifact: Option<FileInfo>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Rule {
    pub action: String,
    pub os:     Option<OsRule>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct OsRule {
    pub name: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AssetIndex {
    pub id:   String,
    pub url:  String,
    pub sha1: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AssetObjects {
    pub objects: std::collections::HashMap<String, AssetObject>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AssetObject {
    pub hash: String,
    pub size: u64,
}

// ─── Commands ─────────────────────────────────────────────────────────────────

/// Kiểm tra version đã được install đầy đủ chưa (có .jar + .json)
#[tauri::command]
pub fn is_version_installed(version_id: String, game_dir: String) -> bool {
    let base = PathBuf::from(&game_dir).join("versions").join(&version_id);
    base.join(format!("{}.jar", version_id)).exists()
        && base.join(format!("{}.json", version_id)).exists()
}

#[tauri::command]
pub async fn get_version_manifest() -> Result<VersionManifest, String> {
    let client = Client::new();
    let manifest: VersionManifest = client
        .get("https://launchermeta.mojang.com/mc/game/version_manifest_v2.json")
        .send().await.map_err(|e| e.to_string())?
        .json().await.map_err(|e| e.to_string())?;
    Ok(manifest)
}

// Download toàn bộ 1 version: client.jar + libraries + assets
#[tauri::command]
pub async fn download_version(version_id: String, game_dir: String) -> Result<String, String> {
    let client = Client::new();
    let game_path = PathBuf::from(&game_dir);

    // 1. Fetch version manifest để lấy URL của version detail
    let manifest: VersionManifest = client
        .get("https://launchermeta.mojang.com/mc/game/version_manifest_v2.json")
        .send().await.map_err(|e| e.to_string())?
        .json().await.map_err(|e| e.to_string())?;

    let entry = manifest.versions.iter()
        .find(|v| v.id == version_id)
        .ok_or(format!("Không tìm thấy version {}", version_id))?;

    // 2. Fetch version detail JSON — save raw bytes để giữ toàn bộ fields gốc
    let version_dir = game_path.join("versions").join(&version_id);
    fs::create_dir_all(&version_dir).map_err(|e| e.to_string())?;
    let version_json = version_dir.join(format!("{}.json", version_id));

    let raw_bytes = client
        .get(&entry.url)
        .send().await.map_err(|e| e.to_string())?
        .bytes().await.map_err(|e| e.to_string())?;
    fs::write(&version_json, &raw_bytes).map_err(|e| e.to_string())?;

    let detail: VersionDetail = serde_json::from_slice(&raw_bytes)
        .map_err(|e| e.to_string())?;

    // Tính tổng số file cần download
    let lib_count = detail.libraries.iter()
        .filter(|l| should_download_library(l))
        .count() as u64;
    let total = 1 + lib_count + 1; // client.jar + libs + assets index
    set_progress(total, 0, "Starting...");

    // 3. Download client.jar
    let client_jar = version_dir.join(format!("{}.jar", version_id));
    if let Some(dl) = &detail.downloads {
        if !client_jar.exists() || !verify_sha1(&client_jar, &dl.client.sha1) {
            set_progress(total, 0, "Downloading client.jar...");
            download_file(&client, &dl.client.url, &client_jar).await?;
        }
    }
    set_progress(total, 1, "client.jar done");

    // 4. Download libraries
    let libs_dir = game_path.join("libraries");
    fs::create_dir_all(&libs_dir).map_err(|e| e.to_string())?;

    let mut completed = 1u64;
    for lib in &detail.libraries {
        if !should_download_library(lib) { continue; }
        if let Some(downloads) = &lib.downloads {
            if let Some(artifact) = &downloads.artifact {
                let lib_path = libs_dir.join(maven_to_path(&lib.name));
                if let Some(parent) = lib_path.parent() {
                    fs::create_dir_all(parent).map_err(|e| e.to_string())?;
                }
                if !lib_path.exists() || !verify_sha1(&lib_path, &artifact.sha1) {
                    set_progress(total, completed, &format!("Downloading {}", lib.name));
                    download_file(&client, &artifact.url, &lib_path).await?;
                }
                completed += 1;
                set_progress(total, completed, &lib.name);
            }
        }
    }

    // 5. Download asset index
    let assets_dir     = game_path.join("assets");
    let indexes_dir    = assets_dir.join("indexes");
    let objects_dir    = assets_dir.join("objects");
    fs::create_dir_all(&indexes_dir).map_err(|e| e.to_string())?;
    fs::create_dir_all(&objects_dir).map_err(|e| e.to_string())?;

    let asset_index = detail.asset_index.as_ref()
        .ok_or("Version JSON thiếu assetIndex")?;
    let index_file = indexes_dir.join(format!("{}.json", asset_index.id));
    if !index_file.exists() {
        set_progress(total, completed, "Downloading asset index...");
        download_file(&client, &asset_index.url, &index_file).await?;
    }

    // 6. Download assets
    let index_content = fs::read_to_string(&index_file).map_err(|e| e.to_string())?;
    let asset_objects: AssetObjects = serde_json::from_str(&index_content)
        .map_err(|e| e.to_string())?;

    let asset_total = asset_objects.objects.len() as u64;
    set_progress(asset_total, 0, "Downloading assets...");

    let mut asset_done = 0u64;
    for (_name, obj) in &asset_objects.objects {
        if obj.hash.len() < 2 { continue; } // skip malformed hash
        let prefix  = &obj.hash[..2];
        let obj_dir = objects_dir.join(prefix);
        fs::create_dir_all(&obj_dir).map_err(|e| e.to_string())?;

        let obj_path = obj_dir.join(&obj.hash);
        if !obj_path.exists() {
            let url = format!("https://resources.download.minecraft.net/{}/{}", prefix, obj.hash);
            download_file(&client, &url, &obj_path).await?;
        }
        asset_done += 1;
        if asset_done % 50 == 0 {
            set_progress(asset_total, asset_done, &format!("Assets: {}/{}", asset_done, asset_total));
        }
    }

    set_progress(total, total, "Done!");
    Ok(format!("Download {} hoàn tất!", version_id))
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Download 1 file từ URL vào path — xóa file nếu lỗi giữa chừng
pub async fn download_file(client: &Client, url: &str, dest: &Path) -> Result<(), String> {
    let mut resp = client.get(url)
        .send().await.map_err(|e| e.to_string())?;

    let mut file = fs::File::create(dest).map_err(|e| e.to_string())?;

    let result = async {
        while let Some(chunk) = resp.chunk().await.map_err(|e| e.to_string())? {
            file.write_all(&chunk).map_err(|e| e.to_string())?;
        }
        Ok::<(), String>(())
    }.await;

    if result.is_err() {
        let _ = fs::remove_file(dest); // cleanup partial file
    }
    result
}

// Verify SHA1 của file
pub fn verify_sha1(path: &Path, expected: &str) -> bool {
    let Ok(data) = fs::read(path) else { return false; };
    let mut hasher = Sha1::new();
    hasher.update(&data);
    format!("{:x}", hasher.finalize()) == expected
}

#[tauri::command]
pub fn verify_file(file_path: String, expected_sha1: String) -> Result<bool, String> {
    Ok(verify_sha1(Path::new(&file_path), &expected_sha1))
}

// Convert maven coordinate → file path
// vd: "org.lwjgl:lwjgl:3.3.3" → "org/lwjgl/lwjgl/3.3.3/lwjgl-3.3.3.jar"
pub fn maven_to_path(coord: &str) -> PathBuf {
    let parts: Vec<&str> = coord.split(':').collect();
    if parts.len() < 3 { return PathBuf::from(coord); }

    let group   = parts[0].replace('.', "/");
    let artifact = parts[1];
    let version  = parts[2];
    let classifier = parts.get(3).copied().unwrap_or("");

    let filename = if classifier.is_empty() {
        format!("{}-{}.jar", artifact, version)
    } else {
        format!("{}-{}-{}.jar", artifact, version, classifier)
    };

    PathBuf::from(group).join(artifact).join(version).join(filename)
}

// Kiểm tra có nên download library này không (filter theo OS)
pub fn should_download_library(lib: &Library) -> bool {
    let Some(rules) = &lib.rules else { return true; };

    let current_os = if cfg!(target_os = "windows") { "windows" }
                     else if cfg!(target_os = "macos") { "osx" }
                     else { "linux" };

    let mut allowed = false;
    for rule in rules {
        let os_match = rule.os.as_ref()
            .map(|os| os.name.as_deref() == Some(current_os))
            .unwrap_or(true);

        if os_match {
            allowed = rule.action == "allow";
        }
    }
    allowed
}

// Helper: load version JSON string
pub fn load_version_json(game_dir: &str, version_id: &str) -> Result<String, String> {
    let path = PathBuf::from(game_dir)
        .join("versions").join(version_id)
        .join(format!("{}.json", version_id));
    fs::read_to_string(&path)
        .map_err(|e| format!("Không đọc được {}.json: {}", version_id, e))
}

// Helper: add a library's path to entries if it exists
fn push_lib(libs_dir: &Path, lib: &Library, entries: &mut Vec<String>) {
    if !should_download_library(lib) { return; }
    // Mojang-style: has downloads.artifact
    if let Some(dl) = &lib.downloads {
        if dl.artifact.is_some() {
            let p = libs_dir.join(maven_to_path(&lib.name));
            if p.exists() { entries.push(p.to_string_lossy().to_string()); }
        }
    } else {
        // Fabric/Forge style: just name, no downloads field
        let p = libs_dir.join(maven_to_path(&lib.name));
        if p.exists() { entries.push(p.to_string_lossy().to_string()); }
    }
}

// Build classpath từ version JSON — hỗ trợ inheritsFrom (Fabric/Forge)
pub fn build_classpath(game_dir: &str, version_id: &str) -> Result<String, String> {
    let game_path = PathBuf::from(game_dir);
    let libs_dir  = game_path.join("libraries");
    let separator = if cfg!(target_os = "windows") { ";" } else { ":" };
    let mut entries: Vec<String> = Vec::new();

    let content = load_version_json(game_dir, version_id)?;
    let detail: VersionDetail = serde_json::from_str(&content)
        .map_err(|e| format!("Không parse được version JSON: {}", e))?;

    if let Some(parent_id) = &detail.inherits_from {
        // Loader (Fabric/Forge): load parent vanilla libs first
        if let Ok(parent_content) = load_version_json(game_dir, parent_id) {
            if let Ok(parent) = serde_json::from_str::<VersionDetail>(&parent_content) {
                for lib in &parent.libraries { push_lib(&libs_dir, lib, &mut entries); }
                // Parent's client.jar (vanilla jar)
                let jar = game_path.join("versions").join(parent_id).join(format!("{}.jar", parent_id));
                if jar.exists() { entries.push(jar.to_string_lossy().to_string()); }
            }
        }
        // Loader's own libs (fabric-loader, intermediary, etc.)
        for lib in &detail.libraries { push_lib(&libs_dir, lib, &mut entries); }
    } else {
        // Vanilla: just its own libs + client.jar
        for lib in &detail.libraries { push_lib(&libs_dir, lib, &mut entries); }
        let jar = game_path.join("versions").join(version_id).join(format!("{}.jar", version_id));
        entries.push(jar.to_string_lossy().to_string());
    }

    Ok(entries.join(separator))
}

fn extract_game_args(detail: &VersionDetail) -> Vec<String> {
    let mut args: Vec<String> = Vec::new();
    if let Some(a) = &detail.arguments {
        if let Some(game) = a["game"].as_array() {
            for arg in game {
                if let Some(s) = arg.as_str() { args.push(s.to_string()); }
            }
        }
    } else if let Some(legacy) = &detail.legacy_args {
        args = legacy.split_whitespace().map(|s| s.to_string()).collect();
    }
    args
}

// Lấy mainClass + game args — hỗ trợ inheritsFrom
pub fn get_launch_info(game_dir: &str, version_id: &str) -> Result<(String, Vec<String>), String> {
    let content = load_version_json(game_dir, version_id)?;
    let detail: VersionDetail = serde_json::from_str(&content)
        .map_err(|e| format!("Không parse được version JSON: {}", e))?;

    // mainClass: dùng của version hiện tại (Fabric override vanilla)
    let main_class = detail.main_class.clone();

    // game args: nếu inheritsFrom thì lấy từ parent (Fabric không có game args)
    let game_args = if let Some(parent_id) = &detail.inherits_from {
        load_version_json(game_dir, parent_id)
            .ok()
            .and_then(|c| serde_json::from_str::<VersionDetail>(&c).ok())
            .map(|p| extract_game_args(&p))
            .unwrap_or_default()
    } else {
        extract_game_args(&detail)
    };

    Ok((main_class, game_args))
}
