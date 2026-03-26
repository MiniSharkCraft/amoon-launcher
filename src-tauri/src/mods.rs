// src-tauri/src/mods.rs
// Mod manager: Modrinth API, install mod/shader/resourcepack
// Support: Fabric mods, Forge mods, OptiFine, Iris Shaders, Resource packs

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use reqwest::Client;
use crate::download::download_file;

// ─── Modrinth structs ─────────────────────────────────────────────────────────
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ModrinthProject {
    pub project_id:   String,
    pub title:        String,
    pub description:  String,
    pub icon_url:     Option<String>,
    pub downloads:    u64,
    pub categories:   Vec<String>,
    pub versions:     Vec<String>,
    pub project_type: String, // "mod" | "modpack" | "shader" | "resourcepack"
    pub slug:         String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ModrinthVersion {
    pub id:             String,
    pub name:           String,
    pub version_number: String,
    pub game_versions:  Vec<String>,
    pub loaders:        Vec<String>,
    pub files:          Vec<ModrinthFile>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ModrinthFile {
    pub url:      String,
    pub filename: String,
    pub primary:  bool,
    pub size:     u64,
    pub hashes:   ModrinthHashes,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ModrinthHashes {
    pub sha1:   Option<String>,
    pub sha512: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct InstalledMod {
    pub name:         String,
    pub filename:     String,
    pub project_id:   Option<String>,
    pub mod_type:     String, // "mod" | "shader" | "resourcepack"
    pub enabled:      bool,
}

// ─── Search ───────────────────────────────────────────────────────────────────
#[tauri::command]
pub async fn search_modrinth(
    query: String,
    project_type: String, // "mod" | "modpack" | "shader" | "resourcepack"
    game_version: Option<String>,
    loader: Option<String>,
    limit: Option<u32>,
) -> Result<Vec<ModrinthProject>, String> {
    let client  = Client::new();
    let limit   = limit.unwrap_or(20);

    let mut facets = format!("[[\"project_type:{}\"]]", project_type);

    // Build facets với filter
    let mut facet_arr: Vec<String> = vec![
        format!("[\"project_type:{}\"]", project_type)
    ];
    if let Some(ver) = &game_version {
        facet_arr.push(format!("[\"versions:{}\"]", ver));
    }
    if let Some(ldr) = &loader {
        facet_arr.push(format!("[\"categories:{}\"]", ldr));
    }
    facets = format!("[{}]", facet_arr.join(","));

    let url = format!(
        "https://api.modrinth.com/v2/search?query={}&limit={}&facets={}",
        urlencoding::encode(&query),
        limit,
        urlencoding::encode(&facets),
    );

    let res: serde_json::Value = client.get(&url)
        .header("User-Agent", "AMoon-Launcher/1.0")
        .send().await.map_err(|e| e.to_string())?
        .json().await.map_err(|e| e.to_string())?;

    let hits = res["hits"].as_array()
        .ok_or("Không parse được kết quả")?;

    let projects: Vec<ModrinthProject> = hits.iter()
        .filter_map(|h| serde_json::from_value(h.clone()).ok())
        .collect();

    Ok(projects)
}

// Search shader riêng (project_type = "shader")
#[tauri::command]
pub async fn search_shaders(query: String, game_version: Option<String>) -> Result<Vec<ModrinthProject>, String> {
    search_modrinth(query, "shader".into(), game_version, None, Some(20)).await
}

// ─── Install mod ─────────────────────────────────────────────────────────────
#[tauri::command]
pub async fn install_mod(
    project_id: String,
    game_version: String,
    loader: String,       // "fabric" | "forge" | "neoforge" | "quilt"
    instance_dir: String, // thư mục instance
) -> Result<String, String> {
    let client = Client::new();

    // Lấy danh sách versions của project
    let versions_url = format!(
        "https://api.modrinth.com/v2/project/{}/version?game_versions=[\"{}\"]&loaders=[\"{}\"]",
        project_id, game_version, loader
    );

    let versions: Vec<ModrinthVersion> = client
        .get(&versions_url)
        .header("User-Agent", "AMoon-Launcher/1.0")
        .send().await.map_err(|e| e.to_string())?
        .json().await.map_err(|e| e.to_string())?;

    let version = versions.first()
        .ok_or(format!("Không tìm thấy version phù hợp cho {} {}", loader, game_version))?;

    let file = version.files.iter()
        .find(|f| f.primary)
        .or(version.files.first())
        .ok_or("Không có file nào để download")?;

    // Tạo thư mục mods
    let mods_dir = PathBuf::from(&instance_dir).join("mods");
    fs::create_dir_all(&mods_dir).map_err(|e| e.to_string())?;

    let dest = mods_dir.join(&file.filename);
    download_file(&client, &file.url, &dest).await?;

    Ok(format!("Đã cài {}", file.filename))
}

// ─── Install shader ───────────────────────────────────────────────────────────
#[tauri::command]
pub async fn install_shader(
    project_id: String,
    game_version: String,
    instance_dir: String,
) -> Result<String, String> {
    let client = Client::new();

    let versions_url = format!(
        "https://api.modrinth.com/v2/project/{}/version?game_versions=[\"{}\"]",
        project_id, game_version
    );

    let versions: Vec<ModrinthVersion> = client
        .get(&versions_url)
        .header("User-Agent", "AMoon-Launcher/1.0")
        .send().await.map_err(|e| e.to_string())?
        .json().await.map_err(|e| e.to_string())?;

    let version = versions.first()
        .ok_or("Không tìm thấy version phù hợp")?;

    let file = version.files.iter()
        .find(|f| f.primary)
        .or(version.files.first())
        .ok_or("Không có file nào")?;

    // Shaders vào shaderpacks/
    let shaders_dir = PathBuf::from(&instance_dir).join("shaderpacks");
    fs::create_dir_all(&shaders_dir).map_err(|e| e.to_string())?;

    let dest = shaders_dir.join(&file.filename);
    download_file(&client, &file.url, &dest).await?;

    Ok(format!("Đã cài shader {}", file.filename))
}

// ─── Install resource pack ────────────────────────────────────────────────────
#[tauri::command]
pub async fn install_resource_pack(
    project_id: String,
    game_version: String,
    instance_dir: String,
) -> Result<String, String> {
    let client = Client::new();

    let versions_url = format!(
        "https://api.modrinth.com/v2/project/{}/version?game_versions=[\"{}\"]",
        project_id, game_version
    );

    let versions: Vec<ModrinthVersion> = client
        .get(&versions_url)
        .header("User-Agent", "AMoon-Launcher/1.0")
        .send().await.map_err(|e| e.to_string())?
        .json().await.map_err(|e| e.to_string())?;

    let version = versions.first()
        .ok_or("Không tìm thấy version phù hợp")?;

    let file = version.files.iter()
        .find(|f| f.primary)
        .or(version.files.first())
        .ok_or("Không có file nào")?;

    // Resource packs vào resourcepacks/
    let rp_dir = PathBuf::from(&instance_dir).join("resourcepacks");
    fs::create_dir_all(&rp_dir).map_err(|e| e.to_string())?;

    let dest = rp_dir.join(&file.filename);
    download_file(&client, &file.url, &dest).await?;

    Ok(format!("Đã cài resource pack {}", file.filename))
}

// ─── List installed mods ──────────────────────────────────────────────────────
#[tauri::command]
pub fn list_installed_mods(instance_dir: String) -> Result<Vec<InstalledMod>, String> {
    let mut result = Vec::new();

    // Scan mods/
    scan_dir(&instance_dir, "mods", "mod", &mut result)?;
    // Scan shaderpacks/
    scan_dir(&instance_dir, "shaderpacks", "shader", &mut result)?;
    // Scan resourcepacks/
    scan_dir(&instance_dir, "resourcepacks", "resourcepack", &mut result)?;

    Ok(result)
}

fn scan_dir(
    instance_dir: &str,
    subdir: &str,
    mod_type: &str,
    result: &mut Vec<InstalledMod>,
) -> Result<(), String> {
    let dir = PathBuf::from(instance_dir).join(subdir);
    if !dir.exists() { return Ok(()); }

    for entry in fs::read_dir(&dir).map_err(|e| e.to_string())? {
        let entry    = entry.map_err(|e| e.to_string())?;
        let filename = entry.file_name().to_string_lossy().to_string();

        if !filename.ends_with(".jar") && !filename.ends_with(".zip") { continue; }

        let enabled = !filename.ends_with(".disabled");
        let clean_name = filename
            .trim_end_matches(".disabled")
            .trim_end_matches(".jar")
            .trim_end_matches(".zip")
            .to_string();

        result.push(InstalledMod {
            name:       clean_name,
            filename:   filename.clone(),
            project_id: None,
            mod_type:   mod_type.into(),
            enabled,
        });
    }
    Ok(())
}

// ─── Delete mod ───────────────────────────────────────────────────────────────
#[tauri::command]
pub fn delete_mod(instance_dir: String, filename: String, mod_type: String) -> Result<String, String> {
    let subdir = match mod_type.as_str() {
        "shader"       => "shaderpacks",
        "resourcepack" => "resourcepacks",
        _              => "mods",
    };

    let path = PathBuf::from(&instance_dir).join(subdir).join(&filename);
    fs::remove_file(&path).map_err(|e| e.to_string())?;
    Ok(format!("Đã xóa {}", filename))
}

// ─── List resource packs ──────────────────────────────────────────────────────
#[tauri::command]
pub fn list_resource_packs(instance_dir: String) -> Result<Vec<InstalledMod>, String> {
    let mut result = Vec::new();
    scan_dir(&instance_dir, "resourcepacks", "resourcepack", &mut result)?;
    Ok(result)
}
