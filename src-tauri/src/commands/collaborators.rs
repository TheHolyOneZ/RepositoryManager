use crate::models::AppError;
use crate::github;
use crate::commands::auth::get_active_token;
use crate::github::collaborators::{Collaborator, PendingInvite};

#[tauri::command]
pub async fn gh_list_collaborators(owner: String, repo: String) -> Result<Vec<Collaborator>, AppError> {
    let token = get_active_token()?;
    github::collaborators::list_collaborators(&token, &owner, &repo).await
}

#[tauri::command]
pub async fn gh_add_collaborator(owner: String, repo: String, username: String, permission: String) -> Result<(), AppError> {
    let token = get_active_token()?;
    github::collaborators::add_collaborator(&token, &owner, &repo, &username, &permission).await
}

#[tauri::command]
pub async fn gh_remove_collaborator(owner: String, repo: String, username: String) -> Result<(), AppError> {
    let token = get_active_token()?;
    github::collaborators::remove_collaborator(&token, &owner, &repo, &username).await
}

#[tauri::command]
pub async fn gh_list_pending_invitations(owner: String, repo: String) -> Result<Vec<PendingInvite>, AppError> {
    let token = get_active_token()?;
    github::collaborators::list_pending_invitations(&token, &owner, &repo).await
}

#[tauri::command]
pub async fn gh_cancel_invitation(owner: String, repo: String, invitation_id: u64) -> Result<(), AppError> {
    let token = get_active_token()?;
    github::collaborators::cancel_invitation(&token, &owner, &repo, invitation_id).await
}
