pub mod actions;
pub mod webhooks;
pub mod collaborators;
pub mod branches;

use reqwest::{Client, header};
use serde::Deserialize;
use crate::models::{Repo, Account, AppError, ReleaseInfo, ReleaseAsset};
use once_cell::sync::Lazy;
use std::sync::Mutex;


pub static ACTIVE_TOKEN: Lazy<Mutex<Option<String>>> = Lazy::new(|| Mutex::new(None));

pub fn set_token(token: String) {
    *ACTIVE_TOKEN.lock().unwrap() = Some(token);
}

pub fn get_token() -> Option<String> {
    ACTIVE_TOKEN.lock().unwrap().clone()
}

/// Extract a human-readable message from a raw response body (GitHub JSON or plain text).
fn extract_gh_message(status: reqwest::StatusCode, body: &str) -> String {
    if let Ok(v) = serde_json::from_str::<serde_json::Value>(body) {
        if let Some(msg) = v.get("message").and_then(|m| m.as_str()) {

            let errors = v.get("errors")
                .and_then(|e| e.as_array())
                .map(|arr| {
                    let parts: Vec<String> = arr.iter()
                        .filter_map(|e| e.get("message").and_then(|m| m.as_str()).map(|s| s.to_string()))
                        .collect();
                    if parts.is_empty() { String::new() } else { format!(" ({})", parts.join("; ")) }
                })
                .unwrap_or_default();
            return format!("{}{}", msg, errors);
        }
    }
    let snippet: String = body.chars().take(300).collect();
    format!("HTTP {}: {}", status, snippet)
}

/// Parse a response as JSON. On error status OR on a 200 that carries a GitHub error object,
/// returns a clean AppError with GitHub's own message instead of a cryptic serde/reqwest error.
pub(crate) async fn check_json<T: serde::de::DeserializeOwned>(resp: reqwest::Response) -> Result<T, AppError> {
    let status = resp.status();
    let body = resp.text().await.unwrap_or_default();
    if !status.is_success() {
        return Err(AppError { code: "API_ERROR".into(), message: extract_gh_message(status, &body) });
    }
    serde_json::from_str::<T>(&body).map_err(|_| {

        AppError { code: "API_ERROR".into(), message: extract_gh_message(status, &body) }
    })
}

/// Assert a response is successful; on failure extract GitHub's error message from the body.
pub(crate) async fn check_ok(resp: reqwest::Response) -> Result<(), AppError> {
    let status = resp.status();
    if status.is_success() { return Ok(()); }
    let body = resp.text().await.unwrap_or_default();
    Err(AppError { code: "API_ERROR".into(), message: extract_gh_message(status, &body) })
}

pub(crate) fn build_client(token: &str) -> Result<Client, AppError> {
    let mut headers = header::HeaderMap::new();
    headers.insert(
        header::AUTHORIZATION,
        header::HeaderValue::from_str(&format!("token {}", token))
            .map_err(|e| AppError::from(e.to_string()))?,
    );
    headers.insert(
        header::ACCEPT,
        header::HeaderValue::from_static("application/vnd.github.v3+json"),
    );
    headers.insert(
        "X-GitHub-Api-Version",
        header::HeaderValue::from_static("2022-11-28"),
    );
    Client::builder()
        .default_headers(headers)
        .user_agent("ZRepoManager/1.0")
        .build()
        .map_err(|e| AppError::from(e.to_string()))
}


#[derive(Deserialize)]
pub(crate) struct GitHubUser {
    id: u64,
    login: String,
    avatar_url: String,
    name: Option<String>,
}


#[derive(Deserialize)]
pub struct GitHubRepo {
    pub id: u64,
    pub name: String,
    pub full_name: String,
    pub owner: GitHubUser,
    pub description: Option<String>,
    pub private: bool,
    pub fork: bool,
    pub archived: bool,
    pub is_template: Option<bool>,
    pub language: Option<String>,
    pub stargazers_count: u32,
    pub forks_count: u32,
    pub open_issues_count: u32,
    pub size: u32,
    pub topics: Option<Vec<String>>,
    pub created_at: String,
    pub updated_at: String,
    pub pushed_at: Option<String>,
    pub html_url: String,
    pub default_branch: String,
    pub has_issues: bool,
    pub has_wiki: bool,
    pub visibility: Option<String>,
}

impl From<GitHubRepo> for Repo {
    fn from(r: GitHubRepo) -> Self {
        Repo {
            id: r.id.to_string(),
            name: r.name.clone(),
            full_name: r.full_name.clone(),
            owner: r.owner.login.clone(),
            description: r.description,
            private: r.private,
            fork: r.fork,
            archived: r.archived,
            is_template: r.is_template.unwrap_or(false),
            language: r.language,
            stars: r.stargazers_count,
            forks: r.forks_count,
            open_issues: r.open_issues_count,
            size_kb: r.size,
            topics: r.topics.unwrap_or_default(),
            created_at: r.created_at,
            updated_at: r.updated_at,
            pushed_at: r.pushed_at,
            html_url: r.html_url,
            default_branch: r.default_branch,
            has_issues: r.has_issues,
            has_wiki: r.has_wiki,
            visibility: r.visibility.unwrap_or_else(|| if r.private { "private".into() } else { "public".into() }),
            health: None,
            tags: vec![],
        }
    }
}

pub async fn validate_pat(token: &str) -> Result<Account, AppError> {
    let client = build_client(token)?;
    let resp = client
        .get("https://api.github.com/user")
        .send()
        .await?
        .error_for_status()
        .map_err(|e| AppError { code: "AUTH_FAILED".into(), message: e.to_string() })?;

    let user: GitHubUser = resp.json().await?;
    Ok(Account {
        id: user.id.to_string(),
        login: user.login,
        avatar_url: user.avatar_url,
        name: user.name,
        auth_type: "pat".into(),
        created_at: chrono::Utc::now().to_rfc3339(),
    })
}

pub async fn fetch_all_repos(token: &str) -> Result<Vec<Repo>, AppError> {
    let client = build_client(token)?;
    let mut all_repos: Vec<Repo> = Vec::new();
    let mut page = 1u32;

    loop {


        let url = format!("https://api.github.com/user/repos?per_page=100&page={}", page);
        let resp = client.get(&url).send().await?;

        if resp.status() == 429 {
            return Err(AppError { code: "RATE_LIMIT".into(), message: "GitHub API rate limit exceeded".into() });
        }

        let raw: Vec<GitHubRepo> = resp.error_for_status()?.json().await?;
        let count = raw.len();
        all_repos.extend(raw.into_iter().map(Repo::from));

        if count < 100 { break; }
        page += 1;
    }

    Ok(all_repos)
}

pub async fn delete_repo(token: &str, owner: &str, repo: &str) -> Result<(), AppError> {
    let client = build_client(token)?;
    client
        .delete(&format!("https://api.github.com/repos/{}/{}", owner, repo))
        .send()
        .await?
        .error_for_status()
        .map(|_| ())
        .map_err(|e| AppError { code: "API_ERROR".into(), message: e.to_string() })
}

pub async fn archive_repo(token: &str, owner: &str, repo: &str, archive: bool) -> Result<Repo, AppError> {
    let client = build_client(token)?;
    let body = serde_json::json!({ "archived": archive });
    let raw: GitHubRepo = client
        .patch(&format!("https://api.github.com/repos/{}/{}", owner, repo))
        .json(&body)
        .send()
        .await?
        .error_for_status()?
        .json()
        .await?;
    Ok(Repo::from(raw))
}

pub async fn set_visibility(token: &str, owner: &str, repo: &str, private: bool) -> Result<Repo, AppError> {
    let client = build_client(token)?;
    let body = serde_json::json!({ "private": private });
    let raw: GitHubRepo = client
        .patch(&format!("https://api.github.com/repos/{}/{}", owner, repo))
        .json(&body)
        .send()
        .await?
        .error_for_status()?
        .json()
        .await?;
    Ok(Repo::from(raw))
}

pub async fn rename_repo(token: &str, owner: &str, repo: &str, new_name: &str) -> Result<Repo, AppError> {
    let client = build_client(token)?;
    let body = serde_json::json!({ "name": new_name });
    let raw: GitHubRepo = client
        .patch(&format!("https://api.github.com/repos/{}/{}", owner, repo))
        .json(&body)
        .send()
        .await?
        .error_for_status()?
        .json()
        .await?;
    Ok(Repo::from(raw))
}

pub async fn update_topics(token: &str, owner: &str, repo: &str, topics: Vec<String>) -> Result<(), AppError> {
    let client = build_client(token)?;
    let body = serde_json::json!({ "names": topics });
    client
        .put(&format!("https://api.github.com/repos/{}/{}/topics", owner, repo))
        .json(&body)
        .send()
        .await?
        .error_for_status()
        .map(|_| ())
        .map_err(|e| AppError::from(e.to_string()))
}


#[derive(Deserialize)]
struct GitHubReadme {
    content: String,
    encoding: String,
}

/// Fetches a repo's README and returns decoded UTF-8 content.
pub async fn fetch_readme(token: &str, owner: &str, repo: &str) -> Result<String, AppError> {
    let client = build_client(token)?;
    let resp = client
        .get(&format!("https://api.github.com/repos/{}/{}/readme", owner, repo))
        .send()
        .await?;

    if resp.status().as_u16() == 404 {
        return Err(AppError { code: "NOT_FOUND".into(), message: "No README found".into() });
    }

    let readme: GitHubReadme = resp.error_for_status()?.json().await?;
    if readme.encoding == "base64" {

        let clean = readme.content.replace('\n', "").replace('\r', "");
        let decoded = base64_decode(&clean)?;
        String::from_utf8(decoded)
            .map_err(|e| AppError { code: "DECODE_ERROR".into(), message: e.to_string() })
    } else {
        Ok(readme.content)
    }
}

fn base64_decode(s: &str) -> Result<Vec<u8>, AppError> {


    const ALPHABET: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut table = [0u8; 256];
    for (i, &c) in ALPHABET.iter().enumerate() {
        table[c as usize] = i as u8;
    }
    let bytes = s.as_bytes();
    let mut out = Vec::with_capacity(bytes.len() * 3 / 4);
    let mut i = 0;
    while i + 3 < bytes.len() {
        if bytes[i] == b'=' { break; }
        let b0 = table[bytes[i] as usize] as u32;
        let b1 = table[bytes[i+1] as usize] as u32;
        let b2 = if bytes[i+2] == b'=' { 0 } else { table[bytes[i+2] as usize] as u32 };
        let b3 = if i+3 < bytes.len() && bytes[i+3] == b'=' { 0 } else if i+3 < bytes.len() { table[bytes[i+3] as usize] as u32 } else { 0 };
        let n = (b0 << 18) | (b1 << 12) | (b2 << 6) | b3;
        out.push(((n >> 16) & 0xFF) as u8);
        if bytes[i+2] != b'=' { out.push(((n >> 8) & 0xFF) as u8); }
        if i+3 < bytes.len() && bytes[i+3] != b'=' { out.push((n & 0xFF) as u8); }
        i += 4;
    }
    Ok(out)
}


#[derive(Deserialize)]
struct GitHubReleaseAsset {
    name: String,
    browser_download_url: String,
    size: u64,
    content_type: String,
}

#[derive(Deserialize)]
struct GitHubRelease {
    tag_name: String,
    name: Option<String>,
    body: Option<String>,
    published_at: Option<String>,
    html_url: String,
    assets: Vec<GitHubReleaseAsset>,
    prerelease: bool,
    draft: bool,
}

/// Fetches the latest release for a repo (returns None if no releases exist).
pub async fn fetch_latest_release(token: &str, owner: &str, repo: &str) -> Result<Option<ReleaseInfo>, AppError> {
    let client = build_client(token)?;
    let resp = client
        .get(&format!("https://api.github.com/repos/{}/{}/releases/latest", owner, repo))
        .send()
        .await?;

    if resp.status().as_u16() == 404 {
        return Ok(None);
    }

    let r: GitHubRelease = resp.error_for_status()?.json().await?;
    Ok(Some(ReleaseInfo {
        tag_name: r.tag_name,
        name: r.name,
        body: r.body,
        published_at: r.published_at,
        html_url: r.html_url,
        prerelease: r.prerelease,
        draft: r.draft,
        assets: r.assets.into_iter().map(|a| ReleaseAsset {
            name: a.name,
            download_url: a.browser_download_url,
            size: a.size,
            content_type: a.content_type,
        }).collect(),
    }))
}

/// Downloads a release asset binary and returns its bytes.
pub async fn download_asset(url: &str, token: &str) -> Result<Vec<u8>, AppError> {
    let client = build_client(token)?;
    let bytes = client
        .get(url)
        .header("Accept", "application/octet-stream")
        .send()
        .await?
        .error_for_status()?
        .bytes()
        .await?;
    Ok(bytes.to_vec())
}
