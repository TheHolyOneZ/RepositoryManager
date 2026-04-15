use crate::models::{Account, AuthToken, AppError, GitHubSession};
use crate::github;
use std::sync::Mutex;
use std::path::PathBuf;
use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};


static ACCOUNTS: Lazy<Mutex<Vec<(Account, String)>>> = Lazy::new(|| Mutex::new(Vec::new()));
pub static ACTIVE_ACCOUNT_ID: Lazy<Mutex<Option<String>>> = Lazy::new(|| Mutex::new(None));
static SESSION_LOADED: Lazy<Mutex<bool>> = Lazy::new(|| Mutex::new(false));


static CRED_PATH: Lazy<Mutex<Option<PathBuf>>> = Lazy::new(|| Mutex::new(None));


/// What we persist to disk. Tokens are stored in plain text inside the
/// OS-specific app data directory (e.g. %APPDATA%\ZRepoManager on Windows,
/// ~/.local/share/ZRepoManager on Linux, ~/Library/Application Support/ZRepoManager
/// on macOS). The directory is user-private by OS convention.
#[derive(Debug, Serialize, Deserialize, Default)]
struct PersistedSession {
    accounts: Vec<Account>,
    /// account_id → token
    tokens: std::collections::HashMap<String, String>,
    active_account_id: Option<String>,
}


fn cred_path() -> Option<PathBuf> {
    CRED_PATH.lock().unwrap().clone()
}

fn load_persisted() -> PersistedSession {
    let path = match cred_path() {
        Some(p) => p,
        None => return PersistedSession::default(),
    };
    let bytes = match std::fs::read(&path) {
        Ok(b) => b,
        Err(_) => return PersistedSession::default(),
    };
    serde_json::from_slice(&bytes).unwrap_or_default()
}

fn save_persisted(session: &PersistedSession) {
    let path = match cred_path() {
        Some(p) => p,
        None => return,
    };

    if let Some(parent) = path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    if let Ok(json) = serde_json::to_vec_pretty(session) {
        let _ = std::fs::write(&path, json);


        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let _ = std::fs::set_permissions(
                &path,
                std::fs::Permissions::from_mode(0o600),
            );
        }
    }
}

/// Persist the current in-memory state to disk.
fn flush_to_disk() {
    let accounts = ACCOUNTS.lock().unwrap();
    let active = ACTIVE_ACCOUNT_ID.lock().unwrap().clone();

    let mut session = PersistedSession {
        active_account_id: active,
        ..Default::default()
    };
    for (account, token) in accounts.iter() {
        session.accounts.push(account.clone());
        session.tokens.insert(account.id.clone(), token.clone());
    }
    drop(accounts);
    save_persisted(&session);
}


/// Called once from lib.rs setup hook with the resolved credentials path.
pub fn init_session(cred_file_path: PathBuf) {
    *CRED_PATH.lock().unwrap() = Some(cred_file_path);
    restore_session();
}

pub fn restore_session() {
    let mut loaded = SESSION_LOADED.lock().unwrap();
    if *loaded {
        return;
    }
    *loaded = true;
    drop(loaded);

    let session = load_persisted();
    if session.accounts.is_empty() {
        return;
    }

    let mut runtime = ACCOUNTS.lock().unwrap();
    for account in &session.accounts {
        if let Some(token) = session.tokens.get(&account.id) {
            runtime.push((account.clone(), token.clone()));
        }
    }


    let active_id = session
        .active_account_id
        .as_deref()
        .and_then(|id| runtime.iter().find(|(a, _)| a.id == id).map(|(a, _)| a.id.clone()))
        .or_else(|| runtime.first().map(|(a, _)| a.id.clone()));

    if let Some(ref id) = active_id {
        if let Some((_, token)) = runtime.iter().find(|(a, _)| &a.id == id) {
            github::set_token(token.clone());
        }
    }

    *ACTIVE_ACCOUNT_ID.lock().unwrap() = active_id;
}


#[derive(Debug, Serialize, Deserialize)]
pub struct DeviceFlowStart {
    pub device_code: String,
    pub user_code: String,
    pub verification_uri: String,
    pub expires_in: u32,
    pub interval: u32,
}

#[derive(Debug, Deserialize)]
struct GitHubDeviceCodeResponse {
    device_code: String,
    user_code: String,
    verification_uri: String,
    expires_in: u32,
    interval: u32,
}

#[derive(Debug, Deserialize)]
struct GitHubTokenResponse {
    access_token: Option<String>,
    error: Option<String>,
    error_description: Option<String>,
}

#[tauri::command]
pub async fn github_auth_start() -> Result<String, AppError> {
    Ok("Use github_device_flow_start with your OAuth App client_id.".into())
}

#[tauri::command]
pub async fn github_auth_callback(_code: String, _state: String) -> Result<AuthToken, AppError> {
    Err(AppError { code: "NOT_IMPLEMENTED".into(), message: "Use device flow instead.".into() })
}

#[tauri::command]
pub async fn github_device_flow_start(client_id: String) -> Result<DeviceFlowStart, AppError> {
    let client = reqwest::Client::builder()
        .user_agent("ZRepoManager/1.0")
        .build()
        .map_err(|e| AppError::from(e.to_string()))?;

    let resp: GitHubDeviceCodeResponse = client
        .post("https://github.com/login/device/code")
        .header("Accept", "application/json")
        .form(&[
            ("client_id", client_id.as_str()),
            ("scope", "repo delete_repo read:user"),
        ])
        .send()
        .await?
        .error_for_status()
        .map_err(|e| AppError { code: "DEVICE_FLOW_ERROR".into(), message: e.to_string() })?
        .json()
        .await?;

    Ok(DeviceFlowStart {
        device_code: resp.device_code,
        user_code: resp.user_code,
        verification_uri: resp.verification_uri,
        expires_in: resp.expires_in,
        interval: resp.interval,
    })
}

#[tauri::command]
pub async fn github_device_flow_poll(
    client_id: String,
    device_code: String,
    interval_secs: u32,
) -> Result<Account, AppError> {
    let client = reqwest::Client::builder()
        .user_agent("ZRepoManager/1.0")
        .build()
        .map_err(|e| AppError::from(e.to_string()))?;

    let mut wait_secs = interval_secs.clamp(1, 600) as u64;

    for attempt in 0..120 {
        if attempt > 0 {
            tokio::time::sleep(tokio::time::Duration::from_secs(wait_secs)).await;
        }

        let resp: GitHubTokenResponse = client
            .post("https://github.com/login/oauth/access_token")
            .header("Accept", "application/json")
            .form(&[
                ("client_id", client_id.as_str()),
                ("device_code", device_code.as_str()),
                ("grant_type", "urn:ietf:params:oauth:grant-type:device_code"),
            ])
            .send()
            .await?
            .json()
            .await?;

        if let Some(token) = resp.access_token {
            let account = github::validate_pat(&token).await?;
            github::set_token(token.clone());

            {
                let mut accounts = ACCOUNTS.lock().unwrap();
                accounts.retain(|(a, _)| a.id != account.id);
                accounts.push((account.clone(), token));
                let mut active = ACTIVE_ACCOUNT_ID.lock().unwrap();
                if active.is_none() {
                    *active = Some(account.id.clone());
                }
            }
            flush_to_disk();
            return Ok(account);
        }

        match resp.error.as_deref() {
            Some("authorization_pending") => continue,
            Some("slow_down") => { wait_secs = (wait_secs + 5).min(600); continue; }
            Some("expired_token") => return Err(AppError { code: "DEVICE_EXPIRED".into(), message: "Device code expired. Please start over.".into() }),
            Some("access_denied")  => return Err(AppError { code: "ACCESS_DENIED".into(),  message: "You denied access. Please try again.".into() }),
            Some(other) => return Err(AppError { code: "DEVICE_ERROR".into(), message: resp.error_description.unwrap_or_else(|| other.to_string()) }),
            None => continue,
        }
    }

    Err(AppError { code: "TIMEOUT".into(), message: "Authorization timed out. Please start over.".into() })
}

#[tauri::command]
pub async fn github_add_pat(token: String, _label: String) -> Result<Account, AppError> {
    let account = github::validate_pat(&token).await?;
    github::set_token(token.clone());

    {
        let mut accounts = ACCOUNTS.lock().unwrap();
        accounts.retain(|(a, _)| a.id != account.id);
        accounts.push((account.clone(), token));
        let mut active = ACTIVE_ACCOUNT_ID.lock().unwrap();
        if active.is_none() {
            *active = Some(account.id.clone());
        }
    }
    flush_to_disk();
    Ok(account)
}

#[tauri::command]
pub async fn github_list_accounts() -> Result<Vec<Account>, AppError> {
    let accounts = ACCOUNTS.lock().unwrap();
    Ok(accounts.iter().map(|(a, _)| a.clone()).collect())
}

#[tauri::command]
pub async fn github_get_session() -> Result<GitHubSession, AppError> {

    restore_session();

    let accounts_lock = ACCOUNTS.lock().unwrap();
    let accounts: Vec<Account> = accounts_lock.iter().map(|(a, _)| a.clone()).collect();
    drop(accounts_lock);
    let active_account_id = ACTIVE_ACCOUNT_ID.lock().unwrap().clone();

    Ok(GitHubSession { accounts, active_account_id })
}

#[tauri::command]
pub async fn github_switch_account(account_id: String) -> Result<(), AppError> {
    let accounts = ACCOUNTS.lock().unwrap();
    let found = accounts.iter().find(|(a, _)| a.id == account_id);
    if let Some((_, token)) = found {
        github::set_token(token.clone());
        drop(accounts);
        *ACTIVE_ACCOUNT_ID.lock().unwrap() = Some(account_id);
        flush_to_disk();
        Ok(())
    } else {
        Err(AppError { code: "NOT_FOUND".into(), message: "Account not found".into() })
    }
}

#[tauri::command]
pub async fn github_logout(account_id: String) -> Result<(), AppError> {
    {
        let mut accounts = ACCOUNTS.lock().unwrap();
        accounts.retain(|(a, _)| a.id != account_id);
        let mut active = ACTIVE_ACCOUNT_ID.lock().unwrap();
        if active.as_deref() == Some(&account_id) {
            let new_active = accounts.first().map(|(a, _)| a.id.clone());
            if let Some(ref id) = new_active {
                if let Some((_, token)) = accounts.iter().find(|(a, _)| &a.id == id) {
                    github::set_token(token.clone());
                }
            }
            *active = new_active;
        }
    }
    flush_to_disk();
    Ok(())
}

pub fn get_active_token() -> Result<String, AppError> {
    github::get_token().ok_or_else(|| AppError {
        code: "NO_AUTH".into(),
        message: "No GitHub account connected. Please add an account in Settings.".into(),
    })
}
