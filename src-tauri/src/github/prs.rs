use serde::{Deserialize, Serialize};
use crate::models::AppError;
use super::{build_client, check_json, check_ok};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PullRequest {
    pub id: u64,
    pub number: u64,
    pub title: String,
    pub body: Option<String>,
    pub state: String,
    pub draft: bool,
    pub html_url: String,
    pub head_ref: String,
    pub base_ref: String,
    pub user_login: String,
    pub user_avatar: String,
    pub created_at: String,
    pub updated_at: String,
    pub mergeable: Option<bool>,
    pub labels: Vec<PrLabel>,
    pub assignees: Vec<String>,
    pub requested_reviewers: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PrLabel {
    pub name: String,
    pub color: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PrFile {
    pub filename: String,
    pub status: String,
    pub additions: u32,
    pub deletions: u32,
    pub patch: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PrReview {
    pub id: u64,
    pub user_login: String,
    pub user_avatar: String,
    pub state: String,
    pub body: Option<String>,
    pub submitted_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PrComment {
    pub id: u64,
    pub user_login: String,
    pub user_avatar: String,
    pub body: String,
    pub created_at: String,
}

#[derive(Deserialize)]
struct PrRaw {
    id: u64, number: u64, title: String, body: Option<String>, state: String,
    draft: bool, html_url: String, created_at: String, updated_at: String,
    mergeable: Option<bool>,
    head: BranchRef, base: BranchRef,
    user: UserRaw,
    labels: Vec<LabelRaw>,
    assignees: Vec<UserRaw>,
    requested_reviewers: Vec<UserRaw>,
}

#[derive(Deserialize)]
struct BranchRef { #[serde(rename = "ref")] ref_name: String }

#[derive(Deserialize)]
struct UserRaw { login: String, avatar_url: String }

#[derive(Deserialize)]
struct LabelRaw { name: String, color: String }

#[derive(Deserialize)]
struct ReviewRaw {
    id: u64, state: String, body: Option<String>, submitted_at: Option<String>, user: UserRaw,
}

#[derive(Deserialize)]
struct CommentRaw { id: u64, body: String, created_at: String, user: UserRaw }

#[derive(Deserialize)]
struct BranchEntry { name: String }

#[derive(Deserialize)]
struct CollabEntry { login: String }

impl From<PrRaw> for PullRequest {
    fn from(r: PrRaw) -> Self {
        PullRequest {
            id: r.id, number: r.number, title: r.title, body: r.body,
            state: r.state, draft: r.draft, html_url: r.html_url,
            head_ref: r.head.ref_name, base_ref: r.base.ref_name,
            user_login: r.user.login, user_avatar: r.user.avatar_url,
            created_at: r.created_at, updated_at: r.updated_at, mergeable: r.mergeable,
            labels: r.labels.into_iter().map(|l| PrLabel { name: l.name, color: l.color }).collect(),
            assignees: r.assignees.into_iter().map(|u| u.login).collect(),
            requested_reviewers: r.requested_reviewers.into_iter().map(|u| u.login).collect(),
        }
    }
}

pub async fn list_pull_requests(token: &str, owner: &str, repo: &str, state: &str, per_page: u32) -> Result<Vec<PullRequest>, AppError> {
    let client = build_client(token)?;
    let raw: Vec<PrRaw> = check_json(
        client.get(format!("https://api.github.com/repos/{}/{}/pulls?state={}&per_page={}", owner, repo, state, per_page))
            .send().await?,
    ).await?;
    Ok(raw.into_iter().map(PullRequest::from).collect())
}

pub async fn create_pull_request(
    token: &str, owner: &str, repo: &str,
    title: &str, body: &str, head: &str, base: &str, draft: bool,
) -> Result<PullRequest, AppError> {
    let client = build_client(token)?;
    let payload = serde_json::json!({ "title": title, "body": body, "head": head, "base": base, "draft": draft });
    let raw: PrRaw = check_json(
        client.post(format!("https://api.github.com/repos/{}/{}/pulls", owner, repo))
            .json(&payload).send().await?,
    ).await?;
    Ok(PullRequest::from(raw))
}

pub async fn update_pull_request(
    token: &str, owner: &str, repo: &str, number: u64,
    state: Option<&str>, title: Option<&str>, body: Option<&str>,
) -> Result<PullRequest, AppError> {
    let client = build_client(token)?;
    let mut payload = serde_json::json!({});
    if let Some(s) = state { payload["state"] = serde_json::json!(s); }
    if let Some(t) = title { payload["title"] = serde_json::json!(t); }
    if let Some(b) = body { payload["body"] = serde_json::json!(b); }
    let raw: PrRaw = check_json(
        client.patch(format!("https://api.github.com/repos/{}/{}/pulls/{}", owner, repo, number))
            .json(&payload).send().await?,
    ).await?;
    Ok(PullRequest::from(raw))
}

pub async fn merge_pull_request(token: &str, owner: &str, repo: &str, number: u64, merge_method: &str) -> Result<(), AppError> {
    let client = build_client(token)?;
    check_ok(
        client.put(format!("https://api.github.com/repos/{}/{}/pulls/{}/merge", owner, repo, number))
            .json(&serde_json::json!({ "merge_method": merge_method })).send().await?,
    ).await
}

pub async fn list_pr_files(token: &str, owner: &str, repo: &str, number: u64) -> Result<Vec<PrFile>, AppError> {
    let client = build_client(token)?;
    check_json(
        client.get(format!("https://api.github.com/repos/{}/{}/pulls/{}/files?per_page=100", owner, repo, number))
            .send().await?,
    ).await
}

pub async fn list_pr_reviews(token: &str, owner: &str, repo: &str, number: u64) -> Result<Vec<PrReview>, AppError> {
    let client = build_client(token)?;
    let raw: Vec<ReviewRaw> = check_json(
        client.get(format!("https://api.github.com/repos/{}/{}/pulls/{}/reviews", owner, repo, number))
            .send().await?,
    ).await?;
    Ok(raw.into_iter().map(|r| PrReview {
        id: r.id, state: r.state, body: r.body, submitted_at: r.submitted_at,
        user_login: r.user.login, user_avatar: r.user.avatar_url,
    }).collect())
}

pub async fn create_pr_review(token: &str, owner: &str, repo: &str, number: u64, event: &str, body: &str) -> Result<PrReview, AppError> {
    let client = build_client(token)?;
    let raw: ReviewRaw = check_json(
        client.post(format!("https://api.github.com/repos/{}/{}/pulls/{}/reviews", owner, repo, number))
            .json(&serde_json::json!({ "event": event, "body": body })).send().await?,
    ).await?;
    Ok(PrReview { id: raw.id, state: raw.state, body: raw.body, submitted_at: raw.submitted_at,
        user_login: raw.user.login, user_avatar: raw.user.avatar_url })
}

pub async fn list_pr_comments(token: &str, owner: &str, repo: &str, number: u64) -> Result<Vec<PrComment>, AppError> {
    let client = build_client(token)?;
    let raw: Vec<CommentRaw> = check_json(
        client.get(format!("https://api.github.com/repos/{}/{}/issues/{}/comments?per_page=100", owner, repo, number))
            .send().await?,
    ).await?;
    Ok(raw.into_iter().map(|c| PrComment {
        id: c.id, body: c.body, created_at: c.created_at,
        user_login: c.user.login, user_avatar: c.user.avatar_url,
    }).collect())
}

pub async fn create_pr_comment(token: &str, owner: &str, repo: &str, number: u64, body: &str) -> Result<PrComment, AppError> {
    let client = build_client(token)?;
    let raw: CommentRaw = check_json(
        client.post(format!("https://api.github.com/repos/{}/{}/issues/{}/comments", owner, repo, number))
            .json(&serde_json::json!({ "body": body })).send().await?,
    ).await?;
    Ok(PrComment { id: raw.id, body: raw.body, created_at: raw.created_at,
        user_login: raw.user.login, user_avatar: raw.user.avatar_url })
}

pub async fn request_reviewers(token: &str, owner: &str, repo: &str, number: u64, reviewers: Vec<String>) -> Result<(), AppError> {
    let client = build_client(token)?;
    check_ok(
        client.post(format!("https://api.github.com/repos/{}/{}/pulls/{}/requested_reviewers", owner, repo, number))
            .json(&serde_json::json!({ "reviewers": reviewers })).send().await?,
    ).await
}

pub async fn list_repo_branches_simple(token: &str, owner: &str, repo: &str) -> Result<Vec<String>, AppError> {
    let client = build_client(token)?;
    let raw: Vec<BranchEntry> = check_json(
        client.get(format!("https://api.github.com/repos/{}/{}/branches?per_page=100", owner, repo))
            .send().await?,
    ).await?;
    Ok(raw.into_iter().map(|b| b.name).collect())
}

pub async fn list_repo_collaborators_simple(token: &str, owner: &str, repo: &str) -> Result<Vec<String>, AppError> {
    let client = build_client(token)?;
    let raw: Vec<CollabEntry> = check_json(
        client.get(format!("https://api.github.com/repos/{}/{}/collaborators?per_page=100", owner, repo))
            .send().await?,
    ).await?;
    Ok(raw.into_iter().map(|c| c.login).collect())
}

pub async fn convert_pr_to_ready(token: &str, owner: &str, repo: &str, number: u64) -> Result<PullRequest, AppError> {
    let client = build_client(token)?;
    let raw: PrRaw = check_json(
        client.patch(format!("https://api.github.com/repos/{}/{}/pulls/{}", owner, repo, number))
            .json(&serde_json::json!({ "draft": false })).send().await?,
    ).await?;
    Ok(PullRequest::from(raw))
}

pub async fn add_pr_assignees(token: &str, owner: &str, repo: &str, number: u64, assignees: Vec<String>) -> Result<(), AppError> {
    let client = build_client(token)?;
    check_ok(
        client.post(format!("https://api.github.com/repos/{}/{}/issues/{}/assignees", owner, repo, number))
            .json(&serde_json::json!({ "assignees": assignees })).send().await?,
    ).await
}

pub async fn remove_pr_assignees(token: &str, owner: &str, repo: &str, number: u64, assignees: Vec<String>) -> Result<(), AppError> {
    let client = build_client(token)?;
    check_ok(
        client.delete(format!("https://api.github.com/repos/{}/{}/issues/{}/assignees", owner, repo, number))
            .json(&serde_json::json!({ "assignees": assignees })).send().await?,
    ).await
}

pub async fn remove_pr_label(token: &str, owner: &str, repo: &str, number: u64, label: &str) -> Result<(), AppError> {
    let client = build_client(token)?;
    let encoded = label.replace(' ', "%20");
    check_ok(
        client.delete(format!("https://api.github.com/repos/{}/{}/issues/{}/labels/{}", owner, repo, number, encoded))
            .send().await?,
    ).await
}

pub async fn set_pr_milestone(token: &str, owner: &str, repo: &str, number: u64, milestone: Option<u64>) -> Result<(), AppError> {
    let client = build_client(token)?;
    let payload = match milestone {
        Some(m) => serde_json::json!({ "milestone": m }),
        None => serde_json::json!({ "milestone": null }),
    };
    check_ok(
        client.patch(format!("https://api.github.com/repos/{}/{}/issues/{}", owner, repo, number))
            .json(&payload).send().await?,
    ).await
}
