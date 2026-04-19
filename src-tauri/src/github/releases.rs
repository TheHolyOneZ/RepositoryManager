use serde::{Deserialize, Serialize};
use crate::models::AppError;
use super::{build_client, check_json, check_ok};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReleaseAssetFull {
    pub id: u64,
    pub name: String,
    pub size: u64,
    pub download_count: u64,
    pub browser_download_url: String,
    pub content_type: String,
    pub state: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Release {
    pub id: u64,
    pub tag_name: String,
    pub name: Option<String>,
    pub body: Option<String>,
    pub draft: bool,
    pub prerelease: bool,
    pub html_url: String,
    pub created_at: String,
    pub published_at: Option<String>,
    pub upload_url: String,
    pub assets: Vec<ReleaseAssetFull>,
    pub author_login: String,
}

#[derive(Deserialize)]
struct ReleaseRaw {
    id: u64,
    tag_name: String,
    name: Option<String>,
    body: Option<String>,
    draft: bool,
    prerelease: bool,
    html_url: String,
    created_at: String,
    published_at: Option<String>,
    upload_url: String,
    assets: Vec<ReleaseAssetFull>,
    author: AuthorRaw,
}

#[derive(Deserialize)]
struct AuthorRaw { login: String }

impl From<ReleaseRaw> for Release {
    fn from(r: ReleaseRaw) -> Self {
        Release {
            id: r.id, tag_name: r.tag_name, name: r.name, body: r.body,
            draft: r.draft, prerelease: r.prerelease, html_url: r.html_url,
            created_at: r.created_at, published_at: r.published_at,
            upload_url: r.upload_url, assets: r.assets, author_login: r.author.login,
        }
    }
}

pub async fn list_releases(token: &str, owner: &str, repo: &str) -> Result<Vec<Release>, AppError> {
    let client = build_client(token)?;
    let raw: Vec<ReleaseRaw> = check_json(
        client.get(format!("https://api.github.com/repos/{}/{}/releases?per_page=30", owner, repo))
            .send().await?,
    ).await?;
    Ok(raw.into_iter().map(Release::from).collect())
}

pub async fn get_latest_release(token: &str, owner: &str, repo: &str) -> Result<Option<Release>, AppError> {
    let client = build_client(token)?;
    let resp = client
        .get(format!("https://api.github.com/repos/{}/{}/releases/latest", owner, repo))
        .send().await?;
    if resp.status().as_u16() == 404 { return Ok(None); }
    let raw: ReleaseRaw = check_json(resp).await?;
    Ok(Some(Release::from(raw)))
}

pub async fn create_release(
    token: &str, owner: &str, repo: &str,
    tag_name: &str, name: &str, body: &str,
    draft: bool, prerelease: bool, target_commitish: &str,
) -> Result<Release, AppError> {
    let client = build_client(token)?;
    let payload = serde_json::json!({
        "tag_name": tag_name, "name": name, "body": body,
        "draft": draft, "prerelease": prerelease, "target_commitish": target_commitish,
    });
    let raw: ReleaseRaw = check_json(
        client.post(format!("https://api.github.com/repos/{}/{}/releases", owner, repo))
            .json(&payload).send().await?,
    ).await?;
    Ok(Release::from(raw))
}

pub async fn update_release(
    token: &str, owner: &str, repo: &str, release_id: u64,
    tag_name: &str, name: &str, body: &str, draft: bool, prerelease: bool,
) -> Result<Release, AppError> {
    let client = build_client(token)?;
    let payload = serde_json::json!({
        "tag_name": tag_name, "name": name, "body": body,
        "draft": draft, "prerelease": prerelease,
    });
    let raw: ReleaseRaw = check_json(
        client.patch(format!("https://api.github.com/repos/{}/{}/releases/{}", owner, repo, release_id))
            .json(&payload).send().await?,
    ).await?;
    Ok(Release::from(raw))
}

pub async fn delete_release(token: &str, owner: &str, repo: &str, release_id: u64) -> Result<(), AppError> {
    let client = build_client(token)?;
    check_ok(
        client.delete(format!("https://api.github.com/repos/{}/{}/releases/{}", owner, repo, release_id))
            .send().await?,
    ).await
}

pub async fn upload_release_asset(
    token: &str, owner: &str, repo: &str, release_id: u64,
    local_path: &str, asset_name: &str,
) -> Result<ReleaseAssetFull, AppError> {
    let bytes = std::fs::read(local_path)
        .map_err(|e| AppError { code: "IO_ERROR".into(), message: e.to_string() })?;
    let url = format!(
        "https://uploads.github.com/repos/{}/{}/releases/{}/assets?name={}",
        owner, repo, release_id, asset_name
    );
    let client = build_client(token)?;
    check_json(
        client.post(&url)
            .header("Content-Type", "application/octet-stream")
            .body(bytes)
            .send().await?,
    ).await
}

pub async fn delete_release_asset(token: &str, owner: &str, repo: &str, asset_id: u64) -> Result<(), AppError> {
    let client = build_client(token)?;
    check_ok(
        client.delete(format!("https://api.github.com/repos/{}/{}/releases/assets/{}", owner, repo, asset_id))
            .send().await?,
    ).await
}
