use crate::models::AppError;
use crate::github;
use crate::commands::auth::get_active_token;
use crate::github::webhooks::{Webhook, WebhookDelivery};

#[tauri::command]
pub async fn gh_list_webhooks(owner: String, repo: String) -> Result<Vec<Webhook>, AppError> {
    let token = get_active_token()?;
    github::webhooks::list_webhooks(&token, &owner, &repo).await
}

#[tauri::command]
pub async fn gh_create_webhook(
    owner: String, repo: String, url: String,
    events: Vec<String>, secret: Option<String>, content_type: String,
) -> Result<Webhook, AppError> {
    let token = get_active_token()?;
    github::webhooks::create_webhook(&token, &owner, &repo, &url, events, secret.as_deref(), &content_type).await
}

#[tauri::command]
pub async fn gh_update_webhook(
    owner: String, repo: String, hook_id: u64,
    url: String, events: Vec<String>, secret: Option<String>, content_type: String, active: bool,
) -> Result<Webhook, AppError> {
    let token = get_active_token()?;
    github::webhooks::update_webhook(&token, &owner, &repo, hook_id, &url, events, secret.as_deref(), &content_type, active).await
}

#[tauri::command]
pub async fn gh_delete_webhook(owner: String, repo: String, hook_id: u64) -> Result<(), AppError> {
    let token = get_active_token()?;
    github::webhooks::delete_webhook(&token, &owner, &repo, hook_id).await
}

#[tauri::command]
pub async fn gh_ping_webhook(owner: String, repo: String, hook_id: u64) -> Result<(), AppError> {
    let token = get_active_token()?;
    github::webhooks::ping_webhook(&token, &owner, &repo, hook_id).await
}

#[tauri::command]
pub async fn gh_list_webhook_deliveries(owner: String, repo: String, hook_id: u64) -> Result<Vec<WebhookDelivery>, AppError> {
    let token = get_active_token()?;
    github::webhooks::list_webhook_deliveries(&token, &owner, &repo, hook_id).await
}

#[tauri::command]
pub async fn gh_redeliver_webhook(owner: String, repo: String, hook_id: u64, delivery_id: u64) -> Result<(), AppError> {
    let token = get_active_token()?;
    github::webhooks::redeliver_webhook(&token, &owner, &repo, hook_id, delivery_id).await
}
