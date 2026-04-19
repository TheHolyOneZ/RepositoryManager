use crate::models::{Repo, AppError};
use crate::github;
use crate::commands::auth::get_active_token;
use crate::github::build_client;

#[tauri::command]
pub async fn action_delete_repo(owner: String, repo: String) -> Result<(), AppError> {
    let token = get_active_token()?;
    github::delete_repo(&token, &owner, &repo).await
}

#[tauri::command]
pub async fn action_archive_repo(owner: String, repo: String, archive: bool) -> Result<Repo, AppError> {
    let token = get_active_token()?;
    github::archive_repo(&token, &owner, &repo, archive).await
}

#[tauri::command]
pub async fn action_set_visibility(owner: String, repo: String, private: bool) -> Result<Repo, AppError> {
    let token = get_active_token()?;
    github::set_visibility(&token, &owner, &repo, private).await
}

#[tauri::command]
pub async fn action_rename_repo(owner: String, repo: String, new_name: String) -> Result<Repo, AppError> {
    let token = get_active_token()?;
    github::rename_repo(&token, &owner, &repo, &new_name).await
}

#[tauri::command]
pub async fn action_update_topics(owner: String, repo: String, topics: Vec<String>) -> Result<(), AppError> {
    let token = get_active_token()?;
    github::update_topics(&token, &owner, &repo, topics).await
}

#[tauri::command]
pub async fn action_star_repo(owner: String, repo: String) -> Result<(), AppError> {
    let token = get_active_token()?;
    let client = build_client(&token)?;
    crate::github::check_ok(
        client.put(format!("https://api.github.com/user/starred/{}/{}", owner, repo))
            .header("Content-Length", "0").send().await?,
    ).await
}

#[tauri::command]
pub async fn action_unstar_repo(owner: String, repo: String) -> Result<(), AppError> {
    let token = get_active_token()?;
    let client = build_client(&token)?;
    crate::github::check_ok(
        client.delete(format!("https://api.github.com/user/starred/{}/{}", owner, repo))
            .send().await?,
    ).await
}

#[tauri::command]
pub async fn action_transfer_repo(owner: String, repo: String, new_owner: String) -> Result<(), AppError> {
    let token = get_active_token()?;

    use reqwest::{Client, header};
    let client = Client::builder()
        .default_headers({
            let mut h = header::HeaderMap::new();
            h.insert(header::AUTHORIZATION, header::HeaderValue::from_str(&format!("token {}", token)).unwrap());
            h.insert(header::ACCEPT, header::HeaderValue::from_static("application/vnd.github.v3+json"));
            h
        })
        .user_agent("ZRepoManager/1.0")
        .build()
        .map_err(|e| AppError::from(e.to_string()))?;

    let body = serde_json::json!({ "new_owner": new_owner });
    client
        .post(&format!("https://api.github.com/repos/{}/{}/transfer", owner, repo))
        .json(&body)
        .send()
        .await?
        .error_for_status()
        .map(|_| ())
        .map_err(|e| AppError::from(e.to_string()))
}
