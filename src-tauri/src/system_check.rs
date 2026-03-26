// src-tauri/src/system_check.rs
use serde::Serialize;
use sysinfo::{Disks, System};

#[derive(Debug, Clone, Serialize)]
pub struct SystemInfo {
    pub os:            String,
    pub arch:          String,
    pub total_ram_mb:  u64,
    pub free_ram_mb:   u64,
    pub free_disk_mb:  u64,
    pub cpu_count:     usize,
    pub cpu_name:      String,
    pub meets_min:     bool,  // RAM ≥ 2GB + disk ≥ 1GB
    pub meets_rec:     bool,  // RAM ≥ 4GB + disk ≥ 4GB
}

#[tauri::command]
pub fn check_system(game_dir: String) -> SystemInfo {
    let mut sys = System::new_all();
    sys.refresh_all();

    let total_ram_mb = sys.total_memory()     / 1024 / 1024;
    let free_ram_mb  = sys.available_memory() / 1024 / 1024;

    let cpu_count = sys.cpus().len();
    let cpu_name  = sys.cpus().first()
        .map(|c| c.brand().trim().to_string())
        .unwrap_or_else(|| "Unknown CPU".to_string());

    // Free disk — tìm partition chứa game_dir, fallback là partition lớn nhất
    let disks = Disks::new_with_refreshed_list();
    let game_dir_abs = std::fs::canonicalize(&game_dir)
        .unwrap_or_else(|_| std::path::PathBuf::from(&game_dir));

    let free_disk_mb = disks
        .iter()
        .filter(|d| game_dir_abs.starts_with(d.mount_point()))
        .map(|d| d.available_space() / 1024 / 1024)
        .next()
        .unwrap_or_else(|| {
            disks.iter()
                .map(|d| d.available_space() / 1024 / 1024)
                .max()
                .unwrap_or(0)
        });

    let os = if cfg!(target_os = "windows") { "windows" }
             else if cfg!(target_os = "macos")   { "macos" }
             else                                  { "linux" };

    let arch = if cfg!(target_arch = "x86_64")    { "x86_64" }
               else if cfg!(target_arch = "aarch64") { "aarch64" }
               else                                   { "unknown" };

    let meets_min = total_ram_mb >= 2048 && free_disk_mb >= 1024;
    let meets_rec = total_ram_mb >= 4096 && free_disk_mb >= 4096;

    SystemInfo {
        os:           os.to_string(),
        arch:         arch.to_string(),
        total_ram_mb,
        free_ram_mb,
        free_disk_mb,
        cpu_count,
        cpu_name,
        meets_min,
        meets_rec,
    }
}
