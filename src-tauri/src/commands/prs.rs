use crate::models::AppError;
use crate::github;
use crate::github::prs::{PullRequest, PrFile, PrReview, PrComment};
use crate::commands::auth::get_active_token;

#[tauri::command]
pub async fn gh_list_pull_requests(owner: String, repo: String, state: String, per_page: u32) -> Result<Vec<PullRequest>, AppError> {
    let token = get_active_token()?;
    github::prs::list_pull_requests(&token, &owner, &repo, &state, per_page).await
}

#[tauri::command]
pub async fn gh_create_pull_request(
    owner: String, repo: String,
    title: String, body: String, head: String, base: String, draft: bool,
) -> Result<PullRequest, AppError> {
    let token = get_active_token()?;
    github::prs::create_pull_request(&token, &owner, &repo, &title, &body, &head, &base, draft).await
}

#[tauri::command]
pub async fn gh_update_pull_request(
    owner: String, repo: String, number: u64,
    state: Option<String>, title: Option<String>, body: Option<String>,
) -> Result<PullRequest, AppError> {
    let token = get_active_token()?;
    github::prs::update_pull_request(&token, &owner, &repo, number, state.as_deref(), title.as_deref(), body.as_deref()).await
}

#[tauri::command]
pub async fn gh_merge_pull_request(owner: String, repo: String, number: u64, merge_method: String) -> Result<(), AppError> {
    let token = get_active_token()?;
    github::prs::merge_pull_request(&token, &owner, &repo, number, &merge_method).await
}

#[tauri::command]
pub async fn gh_list_pr_files(owner: String, repo: String, number: u64) -> Result<Vec<PrFile>, AppError> {
    let token = get_active_token()?;
    github::prs::list_pr_files(&token, &owner, &repo, number).await
}

#[tauri::command]
pub async fn gh_list_pr_reviews(owner: String, repo: String, number: u64) -> Result<Vec<PrReview>, AppError> {
    let token = get_active_token()?;
    github::prs::list_pr_reviews(&token, &owner, &repo, number).await
}

#[tauri::command]
pub async fn gh_create_pr_review(owner: String, repo: String, number: u64, event: String, body: String) -> Result<PrReview, AppError> {
    let token = get_active_token()?;
    github::prs::create_pr_review(&token, &owner, &repo, number, &event, &body).await
}

#[tauri::command]
pub async fn gh_list_pr_comments(owner: String, repo: String, number: u64) -> Result<Vec<PrComment>, AppError> {
    let token = get_active_token()?;
    github::prs::list_pr_comments(&token, &owner, &repo, number).await
}

#[tauri::command]
pub async fn gh_create_pr_comment(owner: String, repo: String, number: u64, body: String) -> Result<PrComment, AppError> {
    let token = get_active_token()?;
    github::prs::create_pr_comment(&token, &owner, &repo, number, &body).await
}

#[tauri::command]
pub async fn gh_request_reviewers(owner: String, repo: String, number: u64, reviewers: Vec<String>) -> Result<(), AppError> {
    let token = get_active_token()?;
    github::prs::request_reviewers(&token, &owner, &repo, number, reviewers).await
}

#[tauri::command]
pub async fn gh_list_repo_branches_simple(owner: String, repo: String) -> Result<Vec<String>, AppError> {
    let token = get_active_token()?;
    github::prs::list_repo_branches_simple(&token, &owner, &repo).await
}

#[tauri::command]
pub async fn gh_list_repo_collaborators_simple(owner: String, repo: String) -> Result<Vec<String>, AppError> {
    let token = get_active_token()?;
    github::prs::list_repo_collaborators_simple(&token, &owner, &repo).await
}

#[tauri::command]
pub async fn gh_convert_pr_to_ready(owner: String, repo: String, number: u64) -> Result<PullRequest, AppError> {
    let token = get_active_token()?;
    github::prs::convert_pr_to_ready(&token, &owner, &repo, number).await
}

#[tauri::command]
pub async fn gh_add_pr_assignees(owner: String, repo: String, number: u64, assignees: Vec<String>) -> Result<(), AppError> {
    let token = get_active_token()?;
    github::prs::add_pr_assignees(&token, &owner, &repo, number, assignees).await
}

#[tauri::command]
pub async fn gh_remove_pr_assignees(owner: String, repo: String, number: u64, assignees: Vec<String>) -> Result<(), AppError> {
    let token = get_active_token()?;
    github::prs::remove_pr_assignees(&token, &owner, &repo, number, assignees).await
}

#[tauri::command]
pub async fn gh_remove_pr_label(owner: String, repo: String, number: u64, label: String) -> Result<(), AppError> {
    let token = get_active_token()?;
    github::prs::remove_pr_label(&token, &owner, &repo, number, &label).await
}

#[tauri::command]
pub async fn gh_set_pr_milestone(owner: String, repo: String, number: u64, milestone: Option<u64>) -> Result<(), AppError> {
    let token = get_active_token()?;
    github::prs::set_pr_milestone(&token, &owner, &repo, number, milestone).await
}
