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

#[derive(Debug, Serialize, Deserialize)]
pub struct VersionDetail {
    pub id:          String,
    pub downloads:   Downloads,
    pub libraries:   Vec<Library>,
    #[serde(rename = "assetIndex")]
    pub asset_index: AssetIndex,
    #[serde(rename = "mainClass")]
    pub main_class:  String,
    pub arguments:   Option<serde_json::Value>,
    #[serde(rename = "minecraftArguments")]
    pub legacy_args: Option<String>, // 1.12 trở về dùng cái này
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Downloads {
    pub client: FileInfo,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FileInfo {
    pub url:  String,
    pub sha1: String,
    pub size: u64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Library {
    pub name:      String,
    pub downloads: Option<LibraryDownloads>,
    pub rules:     Option<Vec<Rule>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LibraryDownloads {
    pub artifact: Option<FileInfo>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Rule {
    pub action: String,
    pub os:     Option<OsRule>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct OsRule {
    pub name: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
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

    // 2. Fetch version detail JSON
    let detail: VersionDetail = client
        .get(&entry.url)
        .send().await.map_err(|e| e.to_string())?
        .json().await.map_err(|e| e.to_string())?;

    // Tính tổng số file cần download
    let lib_count = detail.libraries.iter()
        .filter(|l| should_download_library(l))
        .count() as u64;
    let total = 1 + lib_count + 1; // client.jar + libs + assets index
    set_progress(total, 0, "Starting...");

    // 3. Download client.jar
    let version_dir = game_path.join("versions").join(&version_id);
    fs::create_dir_all(&version_dir).map_err(|e| e.to_string())?;

    let client_jar = version_dir.join(format!("{}.jar", version_id));
    if !client_jar.exists() || !verify_sha1(&client_jar, &detail.downloads.client.sha1) {
        set_progress(total, 0, "Downloading client.jar...");
        download_file(&client, &detail.downloads.client.url, &client_jar).await?;
    }
    set_progress(total, 1, "client.jar done");

    // Lưu version JSON
    let version_json = version_dir.join(format!("{}.json", version_id));
    fs::write(&version_json, serde_json::to_string(&detail).unwrap())
        .map_err(|e| e.to_string())?;

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

    let index_file = indexes_dir.join(format!("{}.json", detail.asset_index.id));
    if !index_file.exists() {
        set_progress(total, completed, "Downloading asset index...");
        download_file(&client, &detail.asset_index.url, &index_file).await?;
    }

    // 6. Download assets
    let index_content = fs::read_to_string(&index_file).map_err(|e| e.to_string())?;
    let asset_objects: AssetObjects = serde_json::from_str(&index_content)
        .map_err(|e| e.to_string())?;

    let asset_total = asset_objects.objects.len() as u64;
    set_progress(asset_total, 0, "Downloading assets...");

    let mut asset_done = 0u64;
    for (_name, obj) in &asset_objects.objects {
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

// Download 1 file từ URL vào path
pub async fn download_file(client: &Client, url: &str, dest: &Path) -> Result<(), String> {
    let mut resp = client.get(url)
        .send().await.map_err(|e| e.to_string())?;

    let mut file = fs::File::create(dest).map_err(|e| e.to_string())?;

    while let Some(chunk) = resp.chunk().await.map_err(|e| e.to_string())? {
        file.write_all(&chunk).map_err(|e| e.to_string())?;
    }

    Ok(())
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

// Build classpath từ version JSON
pub fn build_classpath(game_dir: &str, version_id: &str) -> Result<String, String> {
    let game_path    = PathBuf::from(game_dir);
    let version_json = game_path.join("versions").join(version_id).join(format!("{}.json", version_id));

    let content = fs::read_to_string(&version_json)
        .map_err(|e| format!("Không đọc được version JSON: {}", e))?;
    let detail: VersionDetail = serde_json::from_str(&content)
        .map_err(|e| format!("Không parse được version JSON: {}", e))?;

    let separator = if cfg!(target_os = "windows") { ";" } else { ":" };
    let libs_dir  = game_path.join("libraries");

    let mut entries: Vec<String> = Vec::new();

    // Thêm libraries
    for lib in &detail.libraries {
        if !should_download_library(lib) { continue; }
        if let Some(downloads) = &lib.downloads {
            if let Some(_artifact) = &downloads.artifact {
                let lib_path = libs_dir.join(maven_to_path(&lib.name));
                if lib_path.exists() {
                    entries.push(lib_path.to_string_lossy().to_string());
                }
            }
        }
    }

    // Thêm client.jar cuối cùng
    let client_jar = game_path
        .join("versions").join(version_id)
        .join(format!("{}.jar", version_id));
    entries.push(client_jar.to_string_lossy().to_string());

    Ok(entries.join(separator))
}

// Lấy mainClass và game args từ version JSON
pub fn get_launch_info(game_dir: &str, version_id: &str) -> Result<(String, Vec<String>), String> {
    let game_path    = PathBuf::from(game_dir);
    let version_json = game_path.join("versions").join(version_id).join(format!("{}.json", version_id));

    let content = fs::read_to_string(&version_json)
        .map_err(|e| format!("Không đọc được version JSON: {}", e))?;
    let detail: VersionDetail = serde_json::from_str(&content)
        .map_err(|e| format!("Không parse được version JSON: {}", e))?;

    // Parse game arguments (1.13+ dùng arguments.game, cũ hơn dùng minecraftArguments)
    let mut game_args: Vec<String> = Vec::new();

    if let Some(args) = &detail.arguments {
        if let Some(game) = args["game"].as_array() {
            for arg in game {
                if let Some(s) = arg.as_str() {
                    game_args.push(s.to_string());
                }
                // Bỏ qua các conditional rules
            }
        }
    } else if let Some(legacy) = &detail.legacy_args {
        // 1.12 trở về: "--username ${auth_player_name} --version ${version_name} ..."
        game_args = legacy.split_whitespace().map(|s| s.to_string()).collect();
    }

    Ok((detail.main_class, game_args))
}
