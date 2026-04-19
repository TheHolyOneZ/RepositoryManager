use crate::models::AppError;
use crate::github;
use crate::github::releases::{Release, ReleaseAssetFull};
use crate::commands::auth::get_active_token;

#[tauri::command]
pub async fn gh_list_releases(owner: String, repo: String) -> Result<Vec<Release>, AppError> {
    let token = get_active_token()?;
    github::releases::list_releases(&token, &owner, &repo).await
}

#[tauri::command]
pub async fn gh_get_latest_release(owner: String, repo: String) -> Result<Option<Release>, AppError> {
    let token = get_active_token()?;
    github::releases::get_latest_release(&token, &owner, &repo).await
}

#[tauri::command]
pub async fn gh_create_release(
    owner: String, repo: String,
    tag_name: String, name: String, body: String,
    draft: bool, prerelease: bool, target_commitish: String,
) -> Result<Release, AppError> {
    let token = get_active_token()?;
    github::releases::create_release(&token, &owner, &repo, &tag_name, &name, &body, draft, prerelease, &target_commitish).await
}

#[tauri::command]
pub async fn gh_update_release(
    owner: String, repo: String, release_id: u64,
    tag_name: String, name: String, body: String, draft: bool, prerelease: bool,
) -> Result<Release, AppError> {
    let token = get_active_token()?;
    github::releases::update_release(&token, &owner, &repo, release_id, &tag_name, &name, &body, draft, prerelease).await
}

#[tauri::command]
pub async fn gh_delete_release(owner: String, repo: String, release_id: u64) -> Result<(), AppError> {
    let token = get_active_token()?;
    github::releases::delete_release(&token, &owner, &repo, release_id).await
}

#[tauri::command]
pub async fn gh_upload_release_asset(
    owner: String, repo: String, release_id: u64,
    local_path: String, asset_name: String,
) -> Result<ReleaseAssetFull, AppError> {
    let token = get_active_token()?;
    github::releases::upload_release_asset(&token, &owner, &repo, release_id, &local_path, &asset_name).await
}

#[tauri::command]
pub async fn gh_delete_release_asset(owner: String, repo: String, asset_id: u64) -> Result<(), AppError> {
    let token = get_active_token()?;
    github::releases::delete_release_asset(&token, &owner, &repo, asset_id).await
}
