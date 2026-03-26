// src-tauri/src/modpack.rs
// .mrpack import + mod updater

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::io::Read;
use reqwest::Client;
use crate::download::download_file;

#[derive(Debug, Serialize, Deserialize)]
struct MrpackIndex {
    pub name:            String,
    #[serde(rename = "versionId")]
    pub version_id:      String,
    pub files:           Vec<MrpackFile>,
    pub dependencies:    serde_json::Value,
}

#[derive(Debug, Serialize, Deserialize)]
struct MrpackFile {
    pub path:     String,
    pub downloads: Vec<String>,
    pub hashes:   serde_json::Value,
    #[serde(rename = "fileSize")]
    pub file_size: Option<u64>,
    pub env:      Option<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ImportResult {
    pub name:        String,
    pub mc_version:  String,
    pub loader:      String,
    pub mods_count:  usize,
}

/// Import a .mrpack modpack file into game_dir
#[tauri::command]
pub async fn import_mrpack(
    mrpack_path: String,
    game_dir:    String,
) -> Result<ImportResult, String> {
    let client = Client::new();

    // Open zip
    let file = fs::File::open(&mrpack_path).map_err(|e| e.to_string())?;
    let mut zip = zip::ZipArchive::new(file).map_err(|e| e.to_string())?;

    // Read modrinth.index.json
    let index: MrpackIndex = {
        let mut entry = zip.by_name("modrinth.index.json")
            .map_err(|_| "Invalid .mrpack: missing modrinth.index.json")?;
        let mut buf = String::new();
        entry.read_to_string(&mut buf).map_err(|e| e.to_string())?;
        serde_json::from_str(&buf).map_err(|e| e.to_string())?
    };

    // Parse loader + mc version from dependencies
    let deps = &index.dependencies;
    let mc_version = deps["minecraft"].as_str().unwrap_or("").to_string();
    let loader = if deps["fabric-loader"].is_string() { "fabric" }
        else if deps["quilt-loader"].is_string() { "quilt" }
        else if deps["forge"].is_string() { "forge" }
        else { "vanilla" }.to_string();

    let game_path = PathBuf::from(&game_dir);
    fs::create_dir_all(&game_path).map_err(|e| e.to_string())?;

    // Extract overrides/ folder → game_dir
    let names: Vec<String> = zip.file_names().map(|s| s.to_string()).collect();
    for name in &names {
        if !name.starts_with("overrides/") { continue; }
        let rel = &name["overrides/".len()..];
        if rel.is_empty() { continue; }
        if rel.contains("..") { continue; }
        let dest = game_path.join(rel);
        if name.ends_with('/') {
            fs::create_dir_all(&dest).map_err(|e| e.to_string())?;
        } else {
            if let Some(p) = dest.parent() { fs::create_dir_all(p).map_err(|e| e.to_string())?; }
            let mut entry = zip.by_name(name).map_err(|e| e.to_string())?;
            let mut buf = Vec::new();
            entry.read_to_end(&mut buf).map_err(|e| e.to_string())?;
            fs::write(&dest, &buf).map_err(|e| e.to_string())?;
        }
    }

    // Download mods from files list
    let mut mods_count = 0;
    for mf in &index.files {
        // Skip server-only files
        if let Some(env) = &mf.env {
            if env["client"].as_str() == Some("unsupported") { continue; }
        }
        if mf.path.contains("..") { continue; }
        let dest = game_path.join(&mf.path);
        if dest.exists() { mods_count += 1; continue; }
        if let Some(p) = dest.parent() { fs::create_dir_all(p).map_err(|e| e.to_string())?; }

        let mut downloaded = false;
        for url in &mf.downloads {
            if download_file(&client, url, &dest).await.is_ok() {
                downloaded = true;
                break;
            }
        }
        if downloaded { mods_count += 1; }
        else { let _ = fs::remove_file(&dest); }
    }

    Ok(ImportResult { name: index.name, mc_version, loader, mods_count })
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ModUpdateInfo {
    pub filename:    String,
    pub project_id:  String,
    pub current:     String,
    pub latest:      String,
    pub update_url:  String,
    pub has_update:  bool,
}

/// Check for mod updates via Modrinth hash lookup
#[tauri::command]
pub async fn check_mod_updates(
    instance_dir: String,
    game_version: String,
    loader:       String,
) -> Result<Vec<ModUpdateInfo>, String> {
    let mods_dir = PathBuf::from(&instance_dir).join("mods");
    if !mods_dir.exists() { return Ok(vec![]); }

    let client = Client::new();
    let mut results: Vec<ModUpdateInfo> = vec![];

    // Collect all .jar files
    let entries: Vec<_> = fs::read_dir(&mods_dir)
        .map_err(|e| e.to_string())?
        .flatten()
        .filter(|e| {
            let n = e.file_name().to_string_lossy().to_string();
            n.ends_with(".jar")
        })
        .collect();

    // Compute SHA512 hashes and bulk-lookup on Modrinth
    let mut hashes: std::collections::HashMap<String, String> = std::collections::HashMap::new();
    for entry in &entries {
        let path = entry.path();
        let data = fs::read(&path).unwrap_or_default();
        use sha2::Digest;
        let hash = format!("{:x}", sha2::Sha512::digest(&data));
        hashes.insert(hash, entry.file_name().to_string_lossy().to_string());
    }

    if hashes.is_empty() { return Ok(vec![]); }

    // POST /versions_files — hash lookup
    let body = serde_json::json!({
        "hashes": hashes.keys().collect::<Vec<_>>(),
        "algorithm": "sha512"
    });
    let lookup: serde_json::Value = match client
        .post("https://api.modrinth.com/v2/version_files")
        .header("User-Agent", "AMoon-Launcher/1.0")
        .json(&body)
        .send().await
    {
        Ok(r) => r.json().await.unwrap_or(serde_json::json!({})),
        Err(_) => return Ok(vec![]),
    };

    // For each found mod, check latest version
    for (hash, filename) in &hashes {
        let version_obj = match lookup.get(hash) {
            Some(v) => v,
            None => continue,
        };
        let project_id = match version_obj["project_id"].as_str() {
            Some(id) => id.to_string(),
            None => continue,
        };
        let current_ver = version_obj["version_number"].as_str().unwrap_or("").to_string();

        // Get latest version for this game_version + loader
        let versions_url = format!(
            "https://api.modrinth.com/v2/project/{}/version?game_versions=[\"{}\"]&loaders=[\"{}\"]",
            project_id, game_version, loader
        );
        let versions: Vec<serde_json::Value> = match client
            .get(&versions_url)
            .header("User-Agent", "AMoon-Launcher/1.0")
            .send().await
        {
            Ok(r) => r.json().await.unwrap_or_default(),
            Err(_) => continue,
        };

        if let Some(latest) = versions.first() {
            let latest_ver = latest["version_number"].as_str().unwrap_or("").to_string();
            let has_update = latest_ver != current_ver && !latest_ver.is_empty();
            let update_url = latest["files"].as_array()
                .and_then(|f| f.iter().find(|x| x["primary"].as_bool().unwrap_or(false)))
                .and_then(|f| f["url"].as_str())
                .unwrap_or("")
                .to_string();

            results.push(ModUpdateInfo {
                filename: filename.clone(),
                project_id,
                current: current_ver,
                latest: latest_ver,
                update_url,
                has_update,
            });
        }
    }

    Ok(results)
}

/// Update a single mod — download new version, delete old
#[tauri::command]
pub async fn update_mod(
    instance_dir: String,
    old_filename: String,
    update_url:   String,
    new_filename: String,
) -> Result<String, String> {
    let client = Client::new();
    let mods_dir = PathBuf::from(&instance_dir).join("mods");
    let new_path = mods_dir.join(&new_filename);

    download_file(&client, &update_url, &new_path).await
        .map_err(|e| e.to_string())?;

    // Remove old file if different name
    if old_filename != new_filename {
        let old_path = mods_dir.join(&old_filename);
        let _ = fs::remove_file(&old_path);
    }

    Ok(format!("Updated {} → {}", old_filename, new_filename))
}
