// src-tauri/src/files.rs
// File browser: list, read, delete, open

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;
use base64::{Engine as _, engine::general_purpose::STANDARD};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FileEntry {
    pub name:     String,
    pub path:     String,
    pub size:     u64,
    pub modified: u64, // unix timestamp secs
    pub ext:      String,
    pub is_dir:   bool,
}

// List files (+ optionally dirs) in a folder, filtered by extension list
// extensions = [] → return all
#[tauri::command]
pub fn list_dir_files(
    dir_path:   String,
    extensions: Vec<String>, // e.g. ["jar","zip","jar.disabled"]
    include_dirs: bool,
) -> Vec<FileEntry> {
    let dir = PathBuf::from(&dir_path);
    if !dir.exists() { return vec![]; }

    let mut entries: Vec<FileEntry> = vec![];

    let Ok(rd) = fs::read_dir(&dir) else { return vec![]; };

    for item in rd.flatten() {
        let meta  = item.metadata().ok();
        let is_d  = meta.as_ref().map(|m| m.is_dir()).unwrap_or(false);

        if is_d {
            if !include_dirs { continue; }
        } else {
            let name = item.file_name().to_string_lossy().to_string();
            // Extension check — support compound exts like "jar.disabled"
            if !extensions.is_empty() {
                let lower = name.to_lowercase();
                let matched = extensions.iter().any(|e| lower.ends_with(&format!(".{}", e)));
                if !matched { continue; }
            }
        }

        let name = item.file_name().to_string_lossy().to_string();
        let ext  = {
            let lower = name.to_lowercase();
            if lower.ends_with(".jar.disabled") { "jar.disabled".to_string() }
            else if lower.ends_with(".zip.disabled") { "zip.disabled".to_string() }
            else {
                Path::new(&name).extension()
                    .and_then(|e| e.to_str())
                    .unwrap_or("")
                    .to_lowercase()
            }
        };

        let size     = meta.as_ref().map(|m| if m.is_dir() { 0 } else { m.len() }).unwrap_or(0);
        let modified = meta.and_then(|m| m.modified().ok())
            .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
            .map(|d| d.as_secs())
            .unwrap_or(0);

        entries.push(FileEntry {
            path: item.path().to_string_lossy().to_string(),
            name,
            size,
            modified,
            ext,
            is_dir: is_d,
        });
    }

    entries.sort_by(|a, b| b.modified.cmp(&a.modified));
    entries
}

// Read a text file (logs, configs)
#[tauri::command]
pub fn read_text_file(file_path: String) -> Result<String, String> {
    // Limit to 500KB to avoid blocking UI
    let path = PathBuf::from(&file_path);
    let meta = fs::metadata(&path).map_err(|e| e.to_string())?;
    if meta.len() > 512 * 1024 {
        // Read last 500KB only
        use std::io::{Read, Seek, SeekFrom};
        let mut file = fs::File::open(&path).map_err(|e| e.to_string())?;
        let skip = meta.len().saturating_sub(512 * 1024);
        file.seek(SeekFrom::Start(skip)).map_err(|e| e.to_string())?;
        let mut buf = String::new();
        file.read_to_string(&mut buf).map_err(|e| e.to_string())?;
        Ok(format!("... (showing last 500KB)\n\n{}", buf))
    } else {
        fs::read_to_string(&path).map_err(|e| e.to_string())
    }
}

// Read an image file as base64 data URL
#[tauri::command]
pub fn read_image_base64(file_path: String) -> Result<String, String> {
    let path  = PathBuf::from(&file_path);
    let bytes = fs::read(&path).map_err(|e| e.to_string())?;
    let ext   = path.extension().and_then(|e| e.to_str()).unwrap_or("png").to_lowercase();
    let mime  = match ext.as_str() {
        "jpg" | "jpeg" => "image/jpeg",
        "gif"          => "image/gif",
        "bmp"          => "image/bmp",
        _              => "image/png",
    };
    Ok(format!("data:{};base64,{}", mime, STANDARD.encode(&bytes)))
}

// Delete a single file
#[tauri::command]
pub fn delete_file(file_path: String) -> Result<String, String> {
    let path = PathBuf::from(&file_path);
    let name = path.file_name().unwrap_or_default().to_string_lossy().to_string();
    if path.is_dir() {
        fs::remove_dir_all(&path).map_err(|e| e.to_string())?;
    } else {
        fs::remove_file(&path).map_err(|e| e.to_string())?;
    }
    Ok(format!("Đã xóa {}", name))
}

// Open a file or folder with system default app / file manager
#[tauri::command]
pub fn open_path(path: String) -> Result<(), String> {
    open::that(&path).map_err(|e| e.to_string())
}

// ─── World Backup ──────────────────────────────────────────────────────────────

// Backup một world → zip vào thư mục backups/
#[tauri::command]
pub fn backup_world(
    game_dir:   String,
    world_name: String,
) -> Result<String, String> {
    use std::io::Write;
    use zip::write::FileOptions;
    use zip::CompressionMethod;

    let saves_dir  = PathBuf::from(&game_dir).join("saves");
    let world_dir  = saves_dir.join(&world_name);
    if !world_dir.exists() {
        return Err(format!("World '{}' không tồn tại", world_name));
    }

    let backups_dir = PathBuf::from(&game_dir).join("backups");
    fs::create_dir_all(&backups_dir).map_err(|e| e.to_string())?;

    // Tên file: worldName_YYYYMMDD_HHMMSS.zip
    let ts = std::time::SystemTime::now()
        .duration_since(UNIX_EPOCH).unwrap_or_default().as_secs();
    let backup_name = format!("{}_backup_{}.zip", world_name, ts);
    let backup_path = backups_dir.join(&backup_name);

    let file    = fs::File::create(&backup_path).map_err(|e| e.to_string())?;
    let mut zip = zip::ZipWriter::new(file);
    let opts: FileOptions<()> = FileOptions::default().compression_method(CompressionMethod::Deflated);

    add_dir_to_zip(&mut zip, &world_dir, &world_dir, &opts)
        .map_err(|e| e.to_string())?;
    zip.finish().map_err(|e| e.to_string())?;

    Ok(backup_name)
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

// List backup files cho một game_dir
#[tauri::command]
pub fn list_backups(game_dir: String) -> Vec<FileEntry> {
    let backups_dir = PathBuf::from(&game_dir).join("backups");
    if !backups_dir.exists() { return vec![]; }

    let mut entries: Vec<FileEntry> = vec![];
    if let Ok(rd) = fs::read_dir(&backups_dir) {
        for item in rd.flatten() {
            let name = item.file_name().to_string_lossy().to_string();
            if !name.ends_with(".zip") { continue; }
            let meta     = item.metadata().ok();
            let size     = meta.as_ref().map(|m| m.len()).unwrap_or(0);
            let modified = meta.and_then(|m| m.modified().ok())
                .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
                .map(|d| d.as_secs()).unwrap_or(0);
            entries.push(FileEntry {
                path: item.path().to_string_lossy().to_string(),
                name, size, modified, ext: "zip".into(), is_dir: false,
            });
        }
    }
    entries.sort_by(|a, b| b.modified.cmp(&a.modified));
    entries
}
