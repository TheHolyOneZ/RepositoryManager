use serde::{Deserialize, Serialize};
use crate::models::AppError;
use super::{build_client, check_json, check_ok};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Label {
    pub name: String,
    pub color: String,
    pub description: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Milestone {
    pub id: u64,
    pub number: u64,
    pub title: String,
    pub open_issues: u32,
    pub closed_issues: u32,
    pub due_on: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Issue {
    pub id: u64,
    pub number: u64,
    pub title: String,
    pub body: Option<String>,
    pub state: String,
    pub html_url: String,
    pub user_login: String,
    pub user_avatar: String,
    pub created_at: String,
    pub updated_at: String,
    pub comments: u32,
    pub labels: Vec<Label>,
    pub assignees: Vec<String>,
    pub milestone_title: Option<String>,
    pub milestone_number: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IssueComment {
    pub id: u64,
    pub user_login: String,
    pub user_avatar: String,
    pub body: String,
    pub created_at: String,
}

#[derive(Deserialize)]
struct IssueRaw {
    id: u64, number: u64, title: String, body: Option<String>, state: String,
    html_url: String, created_at: String, updated_at: String, comments: u32,
    labels: Vec<Label>, user: UserRaw,
    assignees: Vec<UserRaw>,
    milestone: Option<MilestoneRef>,
    pull_request: Option<serde_json::Value>,
}

#[derive(Deserialize)]
struct UserRaw { login: String, avatar_url: String }

#[derive(Deserialize)]
struct MilestoneRef { title: String, number: u64 }

#[derive(Deserialize)]
struct CommentRaw {
    id: u64, body: String, created_at: String, user: UserRaw,
}

impl From<IssueRaw> for Issue {
    fn from(r: IssueRaw) -> Self {
        Issue {
            id: r.id, number: r.number, title: r.title, body: r.body,
            state: r.state, html_url: r.html_url,
            user_login: r.user.login, user_avatar: r.user.avatar_url,
            created_at: r.created_at, updated_at: r.updated_at, comments: r.comments,
            labels: r.labels,
            assignees: r.assignees.into_iter().map(|u| u.login).collect(),
            milestone_title: r.milestone.as_ref().map(|m| m.title.clone()),
            milestone_number: r.milestone.map(|m| m.number),
        }
    }
}

pub async fn list_issues(token: &str, owner: &str, repo: &str, state: &str, per_page: u32) -> Result<Vec<Issue>, AppError> {
    let client = build_client(token)?;
    let url = format!(
        "https://api.github.com/repos/{}/{}/issues?state={}&per_page={}&pulls=false",
        owner, repo, state, per_page
    );
    let raw: Vec<IssueRaw> = check_json(client.get(&url).send().await?).await?;
    Ok(raw.into_iter().filter(|r| r.pull_request.is_none()).map(Issue::from).collect())
}

pub async fn create_issue(
    token: &str, owner: &str, repo: &str,
    title: &str, body: &str, labels: Vec<String>, assignees: Vec<String>, milestone: Option<u64>,
) -> Result<Issue, AppError> {
    let client = build_client(token)?;
    let mut payload = serde_json::json!({ "title": title, "body": body, "labels": labels, "assignees": assignees });
    if let Some(m) = milestone { payload["milestone"] = serde_json::json!(m); }
    let raw: IssueRaw = check_json(
        client.post(format!("https://api.github.com/repos/{}/{}/issues", owner, repo))
            .json(&payload).send().await?,
    ).await?;
    Ok(Issue::from(raw))
}

pub async fn update_issue(
    token: &str, owner: &str, repo: &str, number: u64, state: Option<&str>, title: Option<&str>, body: Option<&str>,
) -> Result<Issue, AppError> {
    let client = build_client(token)?;
    let mut payload = serde_json::json!({});
    if let Some(s) = state { payload["state"] = serde_json::json!(s); }
    if let Some(t) = title { payload["title"] = serde_json::json!(t); }
    if let Some(b) = body { payload["body"] = serde_json::json!(b); }
    let raw: IssueRaw = check_json(
        client.patch(format!("https://api.github.com/repos/{}/{}/issues/{}", owner, repo, number))
            .json(&payload).send().await?,
    ).await?;
    Ok(Issue::from(raw))
}

pub async fn list_issue_comments(token: &str, owner: &str, repo: &str, number: u64) -> Result<Vec<IssueComment>, AppError> {
    let client = build_client(token)?;
    let raw: Vec<CommentRaw> = check_json(
        client.get(format!("https://api.github.com/repos/{}/{}/issues/{}/comments?per_page=100", owner, repo, number))
            .send().await?,
    ).await?;
    Ok(raw.into_iter().map(|c| IssueComment {
        id: c.id, body: c.body, created_at: c.created_at,
        user_login: c.user.login, user_avatar: c.user.avatar_url,
    }).collect())
}

pub async fn create_issue_comment(token: &str, owner: &str, repo: &str, number: u64, body: &str) -> Result<IssueComment, AppError> {
    let client = build_client(token)?;
    let raw: CommentRaw = check_json(
        client.post(format!("https://api.github.com/repos/{}/{}/issues/{}/comments", owner, repo, number))
            .json(&serde_json::json!({ "body": body })).send().await?,
    ).await?;
    Ok(IssueComment { id: raw.id, body: raw.body, created_at: raw.created_at, user_login: raw.user.login, user_avatar: raw.user.avatar_url })
}

pub async fn list_labels(token: &str, owner: &str, repo: &str) -> Result<Vec<Label>, AppError> {
    let client = build_client(token)?;
    check_json(
        client.get(format!("https://api.github.com/repos/{}/{}/labels?per_page=100", owner, repo))
            .send().await?,
    ).await
}

pub async fn create_label(token: &str, owner: &str, repo: &str, name: &str, color: &str, description: &str) -> Result<Label, AppError> {
    let client = build_client(token)?;
    check_json(
        client.post(format!("https://api.github.com/repos/{}/{}/labels", owner, repo))
            .json(&serde_json::json!({ "name": name, "color": color, "description": description }))
            .send().await?,
    ).await
}

pub async fn list_milestones(token: &str, owner: &str, repo: &str) -> Result<Vec<Milestone>, AppError> {
    let client = build_client(token)?;
    check_json(
        client.get(format!("https://api.github.com/repos/{}/{}/milestones?state=open&per_page=100", owner, repo))
            .send().await?,
    ).await
}

pub async fn add_labels_to_issue(token: &str, owner: &str, repo: &str, number: u64, labels: Vec<String>) -> Result<(), AppError> {
    let client = build_client(token)?;
    check_ok(
        client.post(format!("https://api.github.com/repos/{}/{}/issues/{}/labels", owner, repo, number))
            .json(&serde_json::json!({ "labels": labels })).send().await?,
    ).await
}

pub async fn set_issue_milestone(token: &str, owner: &str, repo: &str, number: u64, milestone_number: u64) -> Result<(), AppError> {
    let client = build_client(token)?;
    check_ok(
        client.patch(format!("https://api.github.com/repos/{}/{}/issues/{}", owner, repo, number))
            .json(&serde_json::json!({ "milestone": milestone_number })).send().await?,
    ).await
}
