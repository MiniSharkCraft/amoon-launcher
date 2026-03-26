// src-tauri/src/launcher.rs
// Launch Minecraft với classpath đầy đủ từ version JSON

use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::process::Command;
use crate::auth::Account;
use crate::download::{build_classpath, get_launch_info};

#[derive(Debug, Serialize, Deserialize)]
pub struct LaunchConfig {
    pub version_id:     String,
    pub game_dir:       String,
    pub java_path:      String,
    pub max_memory:     u32,        // MB
    pub min_memory:     u32,        // MB
    pub width:          u32,
    pub height:         u32,
    pub fullscreen:     bool,
    pub extra_jvm_args: Vec<String>,
}

#[tauri::command]
pub fn launch_game(config: LaunchConfig, account: Account) -> Result<String, String> {
    let game_path  = PathBuf::from(&config.game_dir);
    let version_id = &config.version_id;

    // Build classpath từ version JSON
    let classpath = build_classpath(&config.game_dir, version_id)?;

    // Lấy mainClass + game args từ version JSON
    let (main_class, raw_game_args) = get_launch_info(&config.game_dir, version_id)?;

    // Natives dir
    let natives_dir = game_path
        .join("versions").join(version_id)
        .join("natives");
    std::fs::create_dir_all(&natives_dir).ok();

    // Assets dir + index id
    let assets_dir  = game_path.join("assets");
    let asset_index = get_asset_index_id(&config.game_dir, version_id)
        .unwrap_or(version_id.clone());

    // ─── JVM Arguments ────────────────────────────────────────
    let mut jvm_args: Vec<String> = vec![
        format!("-Xmx{}m", config.max_memory),
        format!("-Xms{}m", config.min_memory),
        format!("-Djava.library.path={}", natives_dir.display()),
        format!("-Dminecraft.launcher.brand=AMoon"),
        format!("-Dminecraft.launcher.version=1.0.0"),

        // GC tuning
        "-XX:+UnlockExperimentalVMOptions".into(),
        "-XX:+UseG1GC".into(),
        "-XX:G1NewSizePercent=20".into(),
        "-XX:G1ReservePercent=20".into(),
        "-XX:MaxGCPauseMillis=50".into(),
        "-XX:G1HeapRegionSize=32m".into(),
        "-XX:+DisableExplicitGC".into(),
    ];

    // Extra JVM args từ user
    jvm_args.extend(config.extra_jvm_args.clone());

    // Classpath
    jvm_args.push("-cp".into());
    jvm_args.push(classpath);

    // Main class
    jvm_args.push(main_class.clone());

    // ─── Game Arguments ───────────────────────────────────────
    // Thay thế các placeholder trong game args
    let game_args: Vec<String> = raw_game_args.iter()
        .map(|arg| replace_placeholders(
            arg, &account, version_id,
            &config.game_dir,
            &assets_dir.to_string_lossy(),
            &asset_index,
            config.width, config.height,
        ))
        .collect();

    // Nếu không có game args từ JSON (rất cũ), tự build
    let final_game_args = if game_args.is_empty() {
        build_legacy_game_args(&account, version_id, &config, &assets_dir.to_string_lossy(), &asset_index)
    } else {
        game_args
    };

    jvm_args.extend(final_game_args);

    // Thêm fullscreen nếu cần
    if config.fullscreen {
        jvm_args.push("--fullscreen".into());
    }

    // ─── Spawn process ────────────────────────────────────────
    Command::new(&config.java_path)
        .args(&jvm_args)
        .current_dir(&config.game_dir)
        .spawn()
        .map_err(|e| format!("Không launch được game: {}", e))?;

    Ok(format!("Đã launch Minecraft {} 🐧", version_id))
}

// Thay thế placeholder ${...} trong game arguments
fn replace_placeholders(
    arg: &str,
    account: &Account,
    version_id: &str,
    game_dir: &str,
    assets_dir: &str,
    asset_index: &str,
    width: u32,
    height: u32,
) -> String {
    arg
        .replace("${auth_player_name}",   &account.username)
        .replace("${version_name}",        version_id)
        .replace("${game_directory}",      game_dir)
        .replace("${assets_root}",         assets_dir)
        .replace("${assets_index_name}",   asset_index)
        .replace("${auth_uuid}",           &account.uuid)
        .replace("${auth_access_token}",   &account.access_token)
        .replace("${user_type}", match account.account_type.as_str() { "microsoft" => "msa", "offline" => "offline", _ => "mojang" })
        .replace("${version_type}",        "release")
        .replace("${resolution_width}",    &width.to_string())
        .replace("${resolution_height}",   &height.to_string())
        .replace("${launcher_name}",       "AMoon")
        .replace("${launcher_version}",    "1.0.0")
        .replace("${natives_directory}",   &format!("{}/versions/{}/natives", game_dir, version_id))
        .replace("${classpath}",           "") // đã handle ở jvm args
}

// Legacy game args cho Minecraft < 1.13
fn build_legacy_game_args(
    account: &Account,
    version_id: &str,
    config: &LaunchConfig,
    assets_dir: &str,
    asset_index: &str,
) -> Vec<String> {
    vec![
        "--username".into(),     account.username.clone(),
        "--version".into(),      version_id.into(),
        "--gameDir".into(),      config.game_dir.clone(),
        "--assetsDir".into(),    assets_dir.into(),
        "--assetIndex".into(),   asset_index.into(),
        "--uuid".into(),         account.uuid.clone(),
        "--accessToken".into(),  account.access_token.clone(),
        "--userType".into(),     account.account_type.clone(),
        "--versionType".into(),  "release".into(),
        "--width".into(),        config.width.to_string(),
        "--height".into(),       config.height.to_string(),
    ]
}

// Lấy asset index id từ version JSON
fn get_asset_index_id(game_dir: &str, version_id: &str) -> Option<String> {
    let path = PathBuf::from(game_dir)
        .join("versions").join(version_id)
        .join(format!("{}.json", version_id));
    let content = std::fs::read_to_string(path).ok()?;
    let json: serde_json::Value = serde_json::from_str(&content).ok()?;
    json["assetIndex"]["id"].as_str().map(|s| s.to_string())
}
