// src-tauri/src/instance.rs
// Instance management: clone, export, get resource pack icon

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::io::Read;
use base64::{Engine as _, engine::general_purpose::STANDARD};

// ─── Instance clone ──────────────────────────────────────────────────────────

/// Copy an instance folder to a new location
#[tauri::command]
pub fn clone_instance(
    src_dir:  String,
    dest_dir: String,
) -> Result<String, String> {
    let src  = PathBuf::from(&src_dir);
    let dest = PathBuf::from(&dest_dir);

    if !src.exists() {
        return Err(format!("Source '{}' không tồn tại", src_dir));
    }
    if dest.exists() {
        return Err(format!("Destination '{}' đã tồn tại", dest_dir));
    }

    copy_dir_recursive(&src, &dest).map_err(|e| e.to_string())?;
    Ok(format!("Đã clone instance → {}", dest_dir))
}

fn copy_dir_recursive(src: &Path, dest: &Path) -> std::io::Result<()> {
    fs::create_dir_all(dest)?;
    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let ty    = entry.file_type()?;
        let dest_path = dest.join(entry.file_name());
        if ty.is_dir() {
            copy_dir_recursive(&entry.path(), &dest_path)?;
        } else {
            fs::copy(entry.path(), dest_path)?;
        }
    }
    Ok(())
}

// ─── Instance export ─────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
pub struct ExportOptions {
    pub include_mods:   bool,
    pub include_saves:  bool,
    pub include_config: bool,
    pub include_logs:   bool,
}

/// Export an instance to a .zip file
#[tauri::command]
pub fn export_instance(
    game_dir:    String,
    output_path: String,
    options:     ExportOptions,
) -> Result<String, String> {
    use std::io::Write;

    let src = PathBuf::from(&game_dir);
    if !src.exists() {
        return Err(format!("Game dir '{}' không tồn tại", game_dir));
    }

    let file    = fs::File::create(&output_path).map_err(|e| e.to_string())?;
    let mut zip = zip::ZipWriter::new(file);
    let opts: zip::write::FileOptions<()> = zip::write::FileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated);

    let subdirs: Vec<&str> = {
        let mut v = vec![];
        if options.include_mods   { v.push("mods"); v.push("shaderpacks"); v.push("resourcepacks"); }
        if options.include_saves  { v.push("saves"); }
        if options.include_config { v.push("config"); v.push("options.txt"); }
        if options.include_logs   { v.push("logs"); }
        v
    };

    for sub in subdirs {
        let sub_path = src.join(sub);
        if !sub_path.exists() { continue; }
        if sub_path.is_dir() {
            add_dir_to_zip(&mut zip, &src, &sub_path, &opts)
                .map_err(|e| e.to_string())?;
        } else {
            // single file like options.txt
            let rel = sub_path.strip_prefix(&src).unwrap_or(Path::new(sub));
            let rel_str = rel.to_string_lossy().replace('\\', "/");
            zip.start_file(&rel_str, opts).map_err(|e| e.to_string())?;
            let data = fs::read(&sub_path).map_err(|e| e.to_string())?;
            zip.write_all(&data).map_err(|e| e.to_string())?;
        }
    }

    zip.finish().map_err(|e| e.to_string())?;
    Ok(format!("Exported → {}", output_path))
}

fn add_dir_to_zip(
    zip:     &mut zip::ZipWriter<fs::File>,
    base:    &Path,
    current: &Path,
    opts:    &zip::write::FileOptions<()>,
) -> Result<(), Box<dyn std::error::Error>> {
    use std::io::Write;
    for entry in fs::read_dir(current)? {
        let entry = entry?;
        let path  = entry.path();
        let rel   = path.strip_prefix(base)?;
        let rel_str = rel.to_string_lossy().replace('\\', "/");

        if path.is_dir() {
            zip.add_directory::<_, ()>(format!("{}/", rel_str), Default::default())?;
            add_dir_to_zip(zip, base, &path, opts)?;
        } else {
            zip.start_file(&rel_str, *opts)?;
            let data = fs::read(&path)?;
            zip.write_all(&data)?;
        }
    }
    Ok(())
}

// ─── Resource pack icon ───────────────────────────────────────────────────────

/// Read pack.png from a resource pack zip as base64 data URL
#[tauri::command]
pub fn get_resource_pack_icon(pack_path: String) -> Result<String, String> {
    let file = fs::File::open(&pack_path).map_err(|e| e.to_string())?;
    let mut zip = zip::ZipArchive::new(file).map_err(|e| e.to_string())?;

    let mut entry = zip.by_name("pack.png")
        .map_err(|_| "No pack.png in this resource pack")?;

    let mut buf = Vec::new();
    entry.read_to_end(&mut buf).map_err(|e| e.to_string())?;

    Ok(format!("data:image/png;base64,{}", STANDARD.encode(&buf)))
}

// ─── Disk usage ───────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
pub struct DiskUsage {
    pub total_mb:     u64,
    pub mods_mb:      u64,
    pub assets_mb:    u64,
    pub saves_mb:     u64,
    pub libraries_mb: u64,
    pub other_mb:     u64,
}

#[tauri::command]
pub fn get_disk_usage(game_dir: String) -> DiskUsage {
    let base = PathBuf::from(&game_dir);
    let dir_size = |sub: &str| -> u64 {
        dir_size_bytes(&base.join(sub)) / (1024 * 1024)
    };

    let mods_mb      = dir_size("mods");
    let assets_mb    = dir_size("assets");
    let saves_mb     = dir_size("saves");
    let libraries_mb = dir_size("libraries");
    let total_mb     = dir_size_bytes(&base) / (1024 * 1024);
    let other_mb     = total_mb.saturating_sub(mods_mb + assets_mb + saves_mb + libraries_mb);

    DiskUsage { total_mb, mods_mb, assets_mb, saves_mb, libraries_mb, other_mb }
}

fn dir_size_bytes(path: &Path) -> u64 {
    if !path.exists() { return 0; }
    if path.is_file() { return fs::metadata(path).map(|m| m.len()).unwrap_or(0); }
    let Ok(rd) = fs::read_dir(path) else { return 0; };
    rd.flatten().map(|e| dir_size_bytes(&e.path())).sum()
}
