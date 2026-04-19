use crate::models::AppError;
use crate::github;
use crate::github::issues::{Issue, IssueComment, Label, Milestone};
use crate::commands::auth::get_active_token;

#[tauri::command]
pub async fn gh_list_issues(owner: String, repo: String, state: String, per_page: u32) -> Result<Vec<Issue>, AppError> {
    let token = get_active_token()?;
    github::issues::list_issues(&token, &owner, &repo, &state, per_page).await
}

#[tauri::command]
pub async fn gh_create_issue(
    owner: String, repo: String,
    title: String, body: String, labels: Vec<String>, assignees: Vec<String>, milestone: Option<u64>,
) -> Result<Issue, AppError> {
    let token = get_active_token()?;
    github::issues::create_issue(&token, &owner, &repo, &title, &body, labels, assignees, milestone).await
}

#[tauri::command]
pub async fn gh_update_issue(
    owner: String, repo: String, number: u64,
    state: Option<String>, title: Option<String>, body: Option<String>,
) -> Result<Issue, AppError> {
    let token = get_active_token()?;
    github::issues::update_issue(&token, &owner, &repo, number, state.as_deref(), title.as_deref(), body.as_deref()).await
}

#[tauri::command]
pub async fn gh_list_issue_comments(owner: String, repo: String, number: u64) -> Result<Vec<IssueComment>, AppError> {
    let token = get_active_token()?;
    github::issues::list_issue_comments(&token, &owner, &repo, number).await
}

#[tauri::command]
pub async fn gh_create_issue_comment(owner: String, repo: String, number: u64, body: String) -> Result<IssueComment, AppError> {
    let token = get_active_token()?;
    github::issues::create_issue_comment(&token, &owner, &repo, number, &body).await
}

#[tauri::command]
pub async fn gh_list_labels(owner: String, repo: String) -> Result<Vec<Label>, AppError> {
    let token = get_active_token()?;
    github::issues::list_labels(&token, &owner, &repo).await
}

#[tauri::command]
pub async fn gh_create_label(owner: String, repo: String, name: String, color: String, description: String) -> Result<Label, AppError> {
    let token = get_active_token()?;
    github::issues::create_label(&token, &owner, &repo, &name, &color, &description).await
}

#[tauri::command]
pub async fn gh_list_milestones(owner: String, repo: String) -> Result<Vec<Milestone>, AppError> {
    let token = get_active_token()?;
    github::issues::list_milestones(&token, &owner, &repo).await
}

#[tauri::command]
pub async fn gh_add_labels_to_issue(owner: String, repo: String, number: u64, labels: Vec<String>) -> Result<(), AppError> {
    let token = get_active_token()?;
    github::issues::add_labels_to_issue(&token, &owner, &repo, number, labels).await
}

#[tauri::command]
pub async fn gh_set_issue_milestone(owner: String, repo: String, number: u64, milestone_number: u64) -> Result<(), AppError> {
    let token = get_active_token()?;
    github::issues::set_issue_milestone(&token, &owner, &repo, number, milestone_number).await
}
