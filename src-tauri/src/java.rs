// src-tauri/src/java.rs
// Detect Java có sẵn + download Adoptium JRE

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct JavaInfo {
    pub path:          String,
    pub version:       String,
    pub major_version: u32,
}

// ─── Detect Java ─────────────────────────────────────────────────────────────
#[tauri::command]
pub fn detect_java() -> Result<JavaInfo, String> {
    // Danh sách các path có thể có Java
    let candidates = get_java_candidates();

    for candidate in candidates {
        if let Ok(info) = probe_java(&candidate) {
            return Ok(info);
        }
    }

    Err("Không tìm thấy Java trên máy!".into())
}

fn probe_java(path: &str) -> Result<JavaInfo, String> {
    let output = Command::new(path)
        .arg("-version")
        .output()
        .map_err(|e| e.to_string())?;

    // Java in version ra stderr
    let version_str = String::from_utf8_lossy(&output.stderr).to_string();
    let version     = parse_java_version(&version_str)
        .ok_or("Không parse được version")?;
    let major       = parse_major_version(&version);

    Ok(JavaInfo {
        path: path.to_string(),
        version,
        major_version: major,
    })
}

fn get_java_candidates() -> Vec<String> {
    let mut candidates = vec!["java".to_string()];

    // Thêm path từ JAVA_HOME env
    if let Ok(java_home) = std::env::var("JAVA_HOME") {
        let bin = if cfg!(target_os = "windows") {
            format!("{}\\bin\\java.exe", java_home)
        } else {
            format!("{}/bin/java", java_home)
        };
        candidates.push(bin);
    }

    // Check trong thư mục .amoon/java (Java tao download về)
    if let Ok(home) = std::env::var("HOME").or(std::env::var("USERPROFILE")) {
        for ver in [21u32, 17, 11, 8] {
            let amoon_java = if cfg!(target_os = "windows") {
                format!("{}\\.amoon\\java\\java-{}\\bin\\java.exe", home, ver)
            } else {
                format!("{}/.amoon/java/java-{}/bin/java", home, ver)
            };
            candidates.push(amoon_java);
        }
    }

    // Linux common paths
    #[cfg(target_os = "linux")]
    {
        for ver in ["21", "17", "11", "8"] {
            candidates.push(format!("/usr/lib/jvm/java-{}-openjdk-amd64/bin/java", ver));
            candidates.push(format!("/usr/lib/jvm/java-{}/bin/java", ver));
        }
        candidates.push("/usr/bin/java".to_string());
    }

    // macOS common paths
    #[cfg(target_os = "macos")]
    {
        candidates.push("/usr/local/opt/openjdk/bin/java".to_string());
        candidates.push("/Library/Java/JavaVirtualMachines/temurin-21.jdk/Contents/Home/bin/java".to_string());
    }

    candidates
}

fn parse_java_version(output: &str) -> Option<String> {
    // openjdk version "21.0.3" 2024-04-16
    let line  = output.lines().next()?;
    let start = line.find('"')? + 1;
    let end   = line.rfind('"')?;
    if start >= end { return None; }
    Some(line[start..end].to_string())
}

fn parse_major_version(version: &str) -> u32 {
    let parts: Vec<&str> = version.split('.').collect();
    if parts[0] == "1" {
        // Java 8: 1.8.0_xxx
        parts.get(1).and_then(|v| v.parse().ok()).unwrap_or(8)
    } else {
        // Java 11+: 17.0.x
        parts[0].parse().unwrap_or(17)
    }
}

// ─── Download Java ────────────────────────────────────────────────────────────
// Dùng Adoptium API để download JRE phù hợp với OS + arch

#[tauri::command]
pub async fn download_java(version: u32) -> Result<JavaInfo, String> {
    let client = reqwest::Client::new();

    let os = if cfg!(target_os = "windows") { "windows" }
             else if cfg!(target_os = "macos") { "mac" }
             else { "linux" };

    let arch = if cfg!(target_arch = "x86_64") { "x64" }
               else if cfg!(target_arch = "aarch64") { "aarch64" }
               else { "x64" };

    // Adoptium API: lấy URL download JRE mới nhất
    let api_url = format!(
        "https://api.adoptium.net/v3/assets/latest/{}/hotspot?architecture={}&image_type=jre&os={}&vendor=eclipse",
        version, arch, os
    );

    let assets: Vec<serde_json::Value> = client
        .get(&api_url)
        .send().await.map_err(|e| e.to_string())?
        .json().await.map_err(|e| e.to_string())?;

    let asset = assets.first().ok_or("Không tìm thấy Java phù hợp")?;
    let download_url = asset["binary"]["package"]["link"]
        .as_str().ok_or("Không lấy được URL download")?;
    let _checksum = asset["binary"]["package"]["checksum"]
        .as_str().unwrap_or("").to_string();

    // Xác định thư mục cài
    let install_dir = get_java_install_dir(version)?;
    fs::create_dir_all(&install_dir).map_err(|e| e.to_string())?;

    // Download file
    let ext = if cfg!(target_os = "windows") { "zip" } else { "tar.gz" };
    let archive_path = install_dir.join(format!("java-{}.{}", version, ext));

    let mut resp = client.get(download_url)
        .send().await.map_err(|e| e.to_string())?;
    let mut file = fs::File::create(&archive_path).map_err(|e| e.to_string())?;
    use std::io::Write;
    while let Some(chunk) = resp.chunk().await.map_err(|e| e.to_string())? {
        file.write_all(&chunk).map_err(|e| e.to_string())?;
    }

    // Extract
    let java_dir = install_dir.join(format!("java-{}", version));
    if cfg!(target_os = "windows") {
        extract_zip(&archive_path, &java_dir)?;
    } else {
        extract_targz(&archive_path, &java_dir)?;
    }

    // Xóa archive sau khi extract
    let _ = fs::remove_file(&archive_path);

    // Tìm java binary trong thư mục vừa extract
    let java_bin = find_java_binary(&java_dir)?;

    // Set executable permission trên Linux/Mac
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mut perms = fs::metadata(&java_bin).map_err(|e| e.to_string())?.permissions();
        perms.set_mode(0o755);
        fs::set_permissions(&java_bin, perms).map_err(|e| e.to_string())?;
    }

    // Probe để lấy version info
    probe_java(&java_bin.to_string_lossy())
        .map_err(|e| format!("Java đã download nhưng không chạy được: {}", e))
}

fn get_java_install_dir(_version: u32) -> Result<PathBuf, String> {
    let home = std::env::var("HOME")
        .or(std::env::var("USERPROFILE"))
        .map_err(|_| "Không tìm được home dir")?;
    Ok(PathBuf::from(home).join(".amoon").join("java"))
}

fn extract_zip(archive: &Path, dest: &Path) -> Result<(), String> {
    let file    = fs::File::open(archive).map_err(|e| e.to_string())?;
    let mut zip = zip::ZipArchive::new(file).map_err(|e| e.to_string())?;

    for i in 0..zip.len() {
        let mut entry = zip.by_index(i).map_err(|e| e.to_string())?;
        // Strip top-level dir (jdk-21.0.x+7-jre → strip prefix)
        let name  = entry.name().to_string();
        let parts: Vec<&str> = name.splitn(2, '/').collect();
        if parts.len() < 2 || parts[1].is_empty() { continue; }

        let rel = parts[1];
        // Zip slip guard: skip paths with ".." components
        if rel.contains("..") { continue; }
        let out = dest.join(rel);
        if entry.is_dir() {
            fs::create_dir_all(&out).map_err(|e| e.to_string())?;
        } else {
            if let Some(p) = out.parent() { fs::create_dir_all(p).map_err(|e| e.to_string())?; }
            let mut f = fs::File::create(&out).map_err(|e| e.to_string())?;
            std::io::copy(&mut entry, &mut f).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

fn extract_targz(archive: &Path, dest: &Path) -> Result<(), String> {
    let file    = fs::File::open(archive).map_err(|e| e.to_string())?;
    let gz      = flate2::read::GzDecoder::new(file);
    let mut tar = tar::Archive::new(gz);

    fs::create_dir_all(dest).map_err(|e| e.to_string())?;

    for entry in tar.entries().map_err(|e| e.to_string())? {
        let mut entry = entry.map_err(|e| e.to_string())?;
        let path      = entry.path().map_err(|e| e.to_string())?;

        // Strip top-level dir
        let parts: Vec<_> = path.components().collect();
        if parts.len() < 2 { continue; }
        let stripped: PathBuf = parts[1..].iter().collect();
        // Tar slip guard: skip paths with ".." components
        if stripped.components().any(|c| c.as_os_str() == "..") { continue; }
        let out = dest.join(stripped);

        if entry.header().entry_type().is_dir() {
            fs::create_dir_all(&out).map_err(|e| e.to_string())?;
        } else {
            if let Some(p) = out.parent() { fs::create_dir_all(p).map_err(|e| e.to_string())?; }
            entry.unpack(&out).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

fn find_java_binary(dir: &Path) -> Result<PathBuf, String> {
    let bin = if cfg!(target_os = "windows") { "java.exe" } else { "java" };

    // Tìm trong bin/
    let direct = dir.join("bin").join(bin);
    if direct.exists() { return Ok(direct); }

    // Walk 2 levels sâu nếu có nested dir
    for entry in fs::read_dir(dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let candidate = entry.path().join("bin").join(bin);
        if candidate.exists() { return Ok(candidate); }
    }

    Err("Không tìm thấy java binary sau khi extract".into())
}
