// src-tauri/src/auth.rs
// Authentication: Offline, Microsoft OAuth2, Ely.by OAuth2

use serde::{Deserialize, Serialize};
use uuid::Uuid;

// ─── Account struct ───────────────────────────────────────────────────────────
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Account {
    pub username: String,
    pub uuid: String,
    pub access_token: String,
    pub account_type: String, // "offline" | "microsoft" | "elyby"
}

// ─── Offline login ────────────────────────────────────────────────────────────
#[tauri::command]
pub fn login_offline(username: String) -> Result<Account, String> {
    if username.is_empty() {
        return Err("Username không được để trống!".into());
    }
    if username.len() > 16 {
        return Err("Username tối đa 16 ký tự!".into());
    }
    if !username.chars().all(|c| c.is_alphanumeric() || c == '_') {
        return Err("Username chỉ dùng chữ, số và dấu _".into());
    }

    // UUID v3 deterministic từ username
    let uuid = Uuid::new_v3(&Uuid::NAMESPACE_DNS, username.as_bytes()).to_string();

    Ok(Account {
        username,
        uuid,
        access_token: "0".into(),
        account_type: "offline".into(),
    })
}

// ─── Microsoft OAuth ──────────────────────────────────────────────────────────
// Flow: Browser → Microsoft login → redirect về localhost:8080 → lấy code → exchange token

const MS_CLIENT_ID: &str = "1e2277ca-2601-42b2-96ff-3a7f0be23d5f"; // AMoon Launcher Azure App
const MS_REDIRECT:  &str = "https://login.live.com/oauth20_desktop.srf";

#[derive(Debug, Serialize, Deserialize)]
pub struct MicrosoftAuthUrl {
    pub url: String,
    pub state: String,
}

// Bước 1: Tạo URL để mở browser
#[tauri::command]
pub fn login_microsoft_start() -> Result<MicrosoftAuthUrl, String> {
    use rand::Rng;
    let state: String = rand::thread_rng()
        .sample_iter(&rand::distributions::Alphanumeric)
        .take(16)
        .map(char::from)
        .collect();

    let url = format!(
        "https://login.live.com/oauth20_authorize.srf\
        ?client_id={}\
        &response_type=code\
        &redirect_uri={}\
        &scope=XboxLive.signin%20offline_access\
        &state={}",
        MS_CLIENT_ID,
        urlencoding::encode(MS_REDIRECT),
        state
    );

    // Mở browser
    open::that(&url).map_err(|e| e.to_string())?;

    Ok(MicrosoftAuthUrl { url, state })
}

// Bước 2: Nhận code từ user paste vào, exchange lấy Minecraft token
#[tauri::command]
pub async fn login_microsoft_finish(code: String) -> Result<Account, String> {
    let client = reqwest::Client::new();

    // 1. Exchange MS code → MS access token
    let ms_token = exchange_ms_code(&client, &code).await?;

    // 2. MS token → Xbox Live token
    let (xbl_token, user_hash) = auth_xbox_live(&client, &ms_token).await?;

    // 3. Xbox Live → XSTS token
    let xsts_token = auth_xsts(&client, &xbl_token).await?;

    // 4. XSTS → Minecraft token
    let (mc_token, uuid, username) = auth_minecraft(&client, &xsts_token, &user_hash).await?;

    Ok(Account {
        username,
        uuid,
        access_token: mc_token,
        account_type: "microsoft".into(),
    })
}

async fn exchange_ms_code(client: &reqwest::Client, code: &str) -> Result<String, String> {
    let params = [
        ("client_id",    MS_CLIENT_ID),
        ("code",         code),
        ("grant_type",   "authorization_code"),
        ("redirect_uri", MS_REDIRECT),
    ];

    let res: serde_json::Value = client
        .post("https://login.live.com/oauth20_token.srf")
        .form(&params)
        .send().await.map_err(|e| e.to_string())?
        .json().await.map_err(|e| e.to_string())?;

    res["access_token"].as_str()
        .ok_or("Không lấy được MS access token".into())
        .map(|s| s.to_string())
}

async fn auth_xbox_live(client: &reqwest::Client, ms_token: &str) -> Result<(String, String), String> {
    let body = serde_json::json!({
        "Properties": {
            "AuthMethod": "RPS",
            "SiteName": "user.auth.xboxlive.com",
            "RpsTicket": format!("d={}", ms_token)
        },
        "RelyingParty": "http://auth.xboxlive.com",
        "TokenType": "JWT"
    });

    let res: serde_json::Value = client
        .post("https://user.auth.xboxlive.com/user/authenticate")
        .json(&body)
        .send().await.map_err(|e| e.to_string())?
        .json().await.map_err(|e| e.to_string())?;

    let token = res["Token"].as_str()
        .ok_or("Không lấy được XBL token")?.to_string();
    let hash = res["DisplayClaims"]["xui"][0]["uhs"].as_str()
        .ok_or("Không lấy được user hash")?.to_string();

    Ok((token, hash))
}

async fn auth_xsts(client: &reqwest::Client, xbl_token: &str) -> Result<String, String> {
    let body = serde_json::json!({
        "Properties": {
            "SandboxId": "RETAIL",
            "UserTokens": [xbl_token]
        },
        "RelyingParty": "rp://api.minecraftservices.com/",
        "TokenType": "JWT"
    });

    let res: serde_json::Value = client
        .post("https://xsts.auth.xboxlive.com/xsts/authorize")
        .json(&body)
        .send().await.map_err(|e| e.to_string())?
        .json().await.map_err(|e| e.to_string())?;

    // Check XSTS errors
    if let Some(err) = res["XErr"].as_u64() {
        return Err(match err {
            2148916233 => "Tài khoản chưa có Xbox profile!".into(),
            2148916238 => "Tài khoản trẻ em cần phụ huynh cho phép!".into(),
            _ => format!("XSTS error: {}", err),
        });
    }

    res["Token"].as_str()
        .ok_or("Không lấy được XSTS token".into())
        .map(|s| s.to_string())
}

async fn auth_minecraft(
    client: &reqwest::Client,
    xsts_token: &str,
    user_hash: &str,
) -> Result<(String, String, String), String> {
    // Lấy Minecraft token
    let body = serde_json::json!({
        "identityToken": format!("XBL3.0 x={};{}", user_hash, xsts_token)
    });

    let mc_res: serde_json::Value = client
        .post("https://api.minecraftservices.com/authentication/login_with_xbox")
        .json(&body)
        .send().await.map_err(|e| e.to_string())?
        .json().await.map_err(|e| e.to_string())?;

    let mc_token = mc_res["access_token"].as_str()
        .ok_or("Không lấy được Minecraft token")?.to_string();

    // Lấy profile (username + uuid)
    let profile: serde_json::Value = client
        .get("https://api.minecraftservices.com/minecraft/profile")
        .bearer_auth(&mc_token)
        .send().await.map_err(|e| e.to_string())?
        .json().await.map_err(|e| e.to_string())?;

    let uuid     = profile["id"].as_str().ok_or("Không lấy được UUID")?.to_string();
    let username = profile["name"].as_str().ok_or("Không lấy được username")?.to_string();

    Ok((mc_token, uuid, username))
}

// ─── Ely.by OAuth PKCE ───────────────────────────────────────────────────────
// Ely.by desktop app dùng PKCE (không có client secret)
// Flow: tạo code_verifier → mở browser → user login → callback → exchange token

const ELYBY_CLIENT_ID: &str = "amoon-launcher";
const ELYBY_REDIRECT:  &str = "http://localhost:8080/elyby";

#[derive(Debug, Serialize, Deserialize)]
pub struct ElybyAuthUrl {
    pub url:           String,
    pub code_verifier: String, // lưu lại để dùng ở bước 2
}

// Bước 1: Tạo PKCE + mở browser
#[tauri::command]
pub fn login_elyby_start() -> Result<ElybyAuthUrl, String> {
    use rand::Rng;
    use base64::{Engine as _, engine::general_purpose::URL_SAFE_NO_PAD};

    // Tạo code_verifier ngẫu nhiên (43-128 ký tự)
    let code_verifier: String = rand::thread_rng()
        .sample_iter(&rand::distributions::Alphanumeric)
        .take(64)
        .map(char::from)
        .collect();

    // code_challenge = BASE64URL(SHA256(code_verifier))
    use sha1::Digest;
    let mut hasher = sha2::Sha256::new();
    hasher.update(code_verifier.as_bytes());
    let code_challenge = URL_SAFE_NO_PAD.encode(hasher.finalize());

    let state: String = rand::thread_rng()
        .sample_iter(&rand::distributions::Alphanumeric)
        .take(16)
        .map(char::from)
        .collect();

    let url = format!(
        "https://account.ely.by/oauth2/v1?client_id={}&redirect_uri={}&response_type=code&scope=account_info%20minecraft_server_session&code_challenge={}&code_challenge_method=S256&state={}",
        ELYBY_CLIENT_ID,
        urlencoding::encode(ELYBY_REDIRECT),
        code_challenge,
        state,
    );

    open::that(&url).map_err(|e| e.to_string())?;

    Ok(ElybyAuthUrl { url, code_verifier })
}

// Bước 2: Nhận code từ callback, exchange lấy token
#[tauri::command]
pub async fn login_elyby(code: String, code_verifier: String) -> Result<Account, String> {
    let client = reqwest::Client::new();

    // Exchange code → token dùng PKCE
    let params = [
        ("client_id",     ELYBY_CLIENT_ID),
        ("grant_type",    "authorization_code"),
        ("code",          code.as_str()),
        ("redirect_uri",  ELYBY_REDIRECT),
        ("code_verifier", code_verifier.as_str()),
    ];

    let res: serde_json::Value = client
        .post("https://account.ely.by/api/oauth2/v1/token")
        .form(&params)
        .send().await.map_err(|e| e.to_string())?
        .json().await.map_err(|e| e.to_string())?;

    if let Some(err) = res["error"].as_str() {
        return Err(match err {
            "invalid_request"     => "Invalid PKCE request!".into(),
            "invalid_grant"       => "Code đã hết hạn hoặc sai!".into(),
            "invalid_credentials" => "Sai username hoặc password!".into(),
            _ => format!("Ely.by error: {} — {}", err, res["error_description"].as_str().unwrap_or("")),
        });
    }

    let access_token = res["access_token"].as_str()
        .ok_or("Không lấy được access token")?.to_string();

    // Lấy profile
    let profile: serde_json::Value = client
        .get("https://account.ely.by/api/account/v1/info")
        .bearer_auth(&access_token)
        .send().await.map_err(|e| e.to_string())?
        .json().await.map_err(|e| e.to_string())?;

    let username = profile["username"].as_str()
        .ok_or("Không lấy được username")?.to_string();
    let uuid = profile["uuid"].as_str()
        .unwrap_or(&Uuid::new_v4().to_string())
        .to_string();

    Ok(Account {
        username,
        uuid,
        access_token,
        account_type: "elyby".into(),
    })
}
