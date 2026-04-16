use crate::models::AppError;
use crate::github;
use crate::commands::auth::get_active_token;
use crate::github::branches::{Branch, BranchProtection};

#[tauri::command]
pub async fn gh_list_branches(owner: String, repo: String, default_branch: String) -> Result<Vec<Branch>, AppError> {
    let token = get_active_token()?;
    github::branches::list_branches(&token, &owner, &repo, &default_branch).await
}

#[tauri::command]
pub async fn gh_get_branch_commit_date(owner: String, repo: String, sha: String) -> Result<Option<String>, AppError> {
    let token = get_active_token()?;
    github::branches::get_branch_commit_date(&token, &owner, &repo, &sha).await
}

#[tauri::command]
pub async fn gh_get_branch_protection(owner: String, repo: String, branch: String) -> Result<Option<BranchProtection>, AppError> {
    let token = get_active_token()?;
    github::branches::get_branch_protection(&token, &owner, &repo, &branch).await
}

#[tauri::command]
pub async fn gh_set_branch_protection(owner: String, repo: String, branch: String, protection: BranchProtection) -> Result<(), AppError> {
    let token = get_active_token()?;
    github::branches::set_branch_protection(&token, &owner, &repo, &branch, &protection).await
}

#[tauri::command]
pub async fn gh_remove_branch_protection(owner: String, repo: String, branch: String) -> Result<(), AppError> {
    let token = get_active_token()?;
    github::branches::remove_branch_protection(&token, &owner, &repo, &branch).await
}

#[tauri::command]
pub async fn gh_rename_default_branch(owner: String, repo: String, new_name: String) -> Result<(), AppError> {
    let token = get_active_token()?;
    github::branches::rename_default_branch(&token, &owner, &repo, &new_name).await
}

#[tauri::command]
pub async fn gh_create_branch(owner: String, repo: String, new_branch: String, from_branch: String) -> Result<(), AppError> {
    let token = get_active_token()?;
    github::branches::create_branch(&token, &owner, &repo, &new_branch, &from_branch).await
}

#[tauri::command]
pub async fn suggestions_refresh_from_branches(stale_repo_ids: Vec<String>, stale_repo_names: Vec<String>) -> Result<(), AppError> {
    crate::commands::repos::inject_stale_branch_suggestions(stale_repo_ids, stale_repo_names);
    Ok(())
}
