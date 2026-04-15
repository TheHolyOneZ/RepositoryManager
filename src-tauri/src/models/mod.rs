use serde::{Deserialize, Serialize};



#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Account {
    pub id: String,
    pub login: String,
    pub avatar_url: String,
    pub name: Option<String>,
    pub auth_type: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthToken {
    pub account: Account,
    pub scopes: Vec<String>,
}

/// Rust-side session (tokens live in memory here — not in browser persist).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitHubSession {
    pub accounts: Vec<Account>,
    pub active_account_id: Option<String>,
}


#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealthScore {
    pub status: String,
    pub score: u32,
    pub last_push_days: u32,
    pub commit_frequency: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Repo {
    pub id: String,
    pub name: String,
    pub full_name: String,
    pub owner: String,
    pub description: Option<String>,
    pub private: bool,
    pub fork: bool,
    pub archived: bool,
    pub is_template: bool,
    pub language: Option<String>,
    pub stars: u32,
    pub forks: u32,
    pub open_issues: u32,
    pub size_kb: u32,
    pub topics: Vec<String>,
    pub created_at: String,
    pub updated_at: String,
    pub pushed_at: Option<String>,
    pub html_url: String,
    pub default_branch: String,
    pub has_issues: bool,
    pub has_wiki: bool,
    pub visibility: String,
    pub health: Option<HealthScore>,
    pub tags: Vec<String>,
}


#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueueItem {
    pub id: String,
    pub repo_id: String,
    pub repo_name: String,
    pub repo_full_name: String,
    pub action: String,
    pub payload: serde_json::Value,
    pub status: String,
    pub error: Option<String>,
    pub started_at: Option<String>,
    pub completed_at: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueueItemInput {
    pub repo_id: String,
    pub repo_name: String,
    pub repo_full_name: String,
    pub action: String,
    pub payload: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueueState {
    pub items: Vec<QueueItem>,
    pub status: String,
    pub mode: String,
    pub grace_seconds_remaining: Option<u32>,
    pub current_item_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DryRunResult {
    pub repo_id: String,
    pub repo_name: String,
    pub action: String,
    pub would_succeed: bool,
    pub preview_message: String,
}


#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RepoExportInput {
    pub repo_id: String,
    pub repo_name: String,
    pub repo_full_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportItemResult {
    pub repo_name: String,
    pub success: bool,
    pub path: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportBatchResult {
    pub results: Vec<ExportItemResult>,
    pub succeeded: u32,
    pub failed: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReleaseAsset {
    pub name: String,
    pub download_url: String,
    pub size: u64,
    pub content_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReleaseInfo {
    pub tag_name: String,
    pub name: Option<String>,
    pub body: Option<String>,
    pub published_at: Option<String>,
    pub html_url: String,
    pub assets: Vec<ReleaseAsset>,
    pub prerelease: bool,
    pub draft: bool,
}


#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CleanupSuggestion {
    pub id: String,
    pub repo_id: String,
    pub repo_name: String,
    pub reason: String,
    pub description: String,
    pub suggested_action: String,
    pub priority: String,
}


#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OperationLog {
    pub id: String,
    pub repo_id: String,
    pub repo_name: String,
    pub action: String,
    pub status: String,
    pub error: Option<String>,
    pub executed_at: String,
}


#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppError {
    pub code: String,
    pub message: String,
}

impl std::fmt::Display for AppError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "[{}] {}", self.code, self.message)
    }
}

impl From<reqwest::Error> for AppError {
    fn from(e: reqwest::Error) -> Self {
        AppError { code: "HTTP_ERROR".into(), message: e.to_string() }
    }
}

impl From<serde_json::Error> for AppError {
    fn from(e: serde_json::Error) -> Self {
        AppError { code: "PARSE_ERROR".into(), message: e.to_string() }
    }
}

impl From<String> for AppError {
    fn from(s: String) -> Self {
        AppError { code: "ERROR".into(), message: s }
    }
}

impl From<&str> for AppError {
    fn from(s: &str) -> Self {
        AppError { code: "ERROR".into(), message: s.to_string() }
    }
}
