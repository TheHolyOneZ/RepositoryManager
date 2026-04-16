use serde::{Deserialize, Serialize};
use crate::models::AppError;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebhookConfig {
    pub url: String,
    pub content_type: String,
    pub insecure_ssl: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Webhook {
    pub id: u64,
    pub name: String,
    pub active: bool,
    pub events: Vec<String>,
    pub config: WebhookConfig,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebhookDelivery {
    pub id: u64,
    pub guid: String,
    pub delivered_at: String,
    pub redelivery: bool,
    pub duration: f64,
    pub status: String,
    pub status_code: u32,
    pub event: String,
    pub action: Option<String>,
}

#[derive(Deserialize)]
struct WebhookRaw {
    id: u64, name: String, active: bool, events: Vec<String>,
    config: WebhookConfigRaw, created_at: String, updated_at: String,
}

#[derive(Deserialize)]
struct WebhookConfigRaw {
    url: Option<String>,
    content_type: Option<String>,
    insecure_ssl: Option<String>,
}

impl From<WebhookRaw> for Webhook {
    fn from(r: WebhookRaw) -> Self {
        Webhook {
            id: r.id, name: r.name, active: r.active, events: r.events,
            config: WebhookConfig {
                url: r.config.url.unwrap_or_default(),
                content_type: r.config.content_type.unwrap_or_else(|| "json".into()),
                insecure_ssl: r.config.insecure_ssl.unwrap_or_else(|| "0".into()),
            },
            created_at: r.created_at, updated_at: r.updated_at,
        }
    }
}

#[derive(Deserialize)]
struct DeliveryRaw {
    id: u64, guid: String, delivered_at: String, redelivery: bool,
    duration: f64, status: String, status_code: u32, event: String, action: Option<String>,
}

impl From<DeliveryRaw> for WebhookDelivery {
    fn from(r: DeliveryRaw) -> Self {
        WebhookDelivery {
            id: r.id, guid: r.guid, delivered_at: r.delivered_at, redelivery: r.redelivery,
            duration: r.duration, status: r.status, status_code: r.status_code,
            event: r.event, action: r.action,
        }
    }
}

pub async fn list_webhooks(token: &str, owner: &str, repo: &str) -> Result<Vec<Webhook>, AppError> {
    let client = super::build_client(token)?;
    let raw: Vec<WebhookRaw> = client
        .get(format!("https://api.github.com/repos/{}/{}/hooks?per_page=100", owner, repo))
        .send().await?.error_for_status()?.json().await?;
    Ok(raw.into_iter().map(Webhook::from).collect())
}

pub async fn create_webhook(
    token: &str, owner: &str, repo: &str,
    url: &str, events: Vec<String>, secret: Option<&str>, content_type: &str,
) -> Result<Webhook, AppError> {
    let client = super::build_client(token)?;
    let mut config = serde_json::json!({ "url": url, "content_type": content_type, "insecure_ssl": "0" });
    if let Some(s) = secret {
        config["secret"] = serde_json::Value::String(s.to_string());
    }
    let body = serde_json::json!({ "name": "web", "active": true, "events": events, "config": config });
    let raw: WebhookRaw = client
        .post(format!("https://api.github.com/repos/{}/{}/hooks", owner, repo))
        .json(&body).send().await?.error_for_status()?.json().await?;
    Ok(Webhook::from(raw))
}

pub async fn update_webhook(
    token: &str, owner: &str, repo: &str, hook_id: u64,
    url: &str, events: Vec<String>, secret: Option<&str>, content_type: &str, active: bool,
) -> Result<Webhook, AppError> {
    let client = super::build_client(token)?;
    let mut config = serde_json::json!({ "url": url, "content_type": content_type, "insecure_ssl": "0" });
    if let Some(s) = secret {
        config["secret"] = serde_json::Value::String(s.to_string());
    }
    let body = serde_json::json!({ "active": active, "events": events, "config": config });
    let raw: WebhookRaw = client
        .patch(format!("https://api.github.com/repos/{}/{}/hooks/{}", owner, repo, hook_id))
        .json(&body).send().await?.error_for_status()?.json().await?;
    Ok(Webhook::from(raw))
}

pub async fn delete_webhook(token: &str, owner: &str, repo: &str, hook_id: u64) -> Result<(), AppError> {
    let client = super::build_client(token)?;
    let resp = client
        .delete(format!("https://api.github.com/repos/{}/{}/hooks/{}", owner, repo, hook_id))
        .send().await?;
    super::check_ok(resp).await
}

pub async fn ping_webhook(token: &str, owner: &str, repo: &str, hook_id: u64) -> Result<(), AppError> {
    let client = super::build_client(token)?;
    let resp = client
        .post(format!("https://api.github.com/repos/{}/{}/hooks/{}/pings", owner, repo, hook_id))
        .send().await?;
    super::check_ok(resp).await
}

pub async fn list_webhook_deliveries(token: &str, owner: &str, repo: &str, hook_id: u64) -> Result<Vec<WebhookDelivery>, AppError> {
    let client = super::build_client(token)?;
    let raw: Vec<DeliveryRaw> = client
        .get(format!("https://api.github.com/repos/{}/{}/hooks/{}/deliveries?per_page=50", owner, repo, hook_id))
        .send().await?.error_for_status()?.json().await?;
    Ok(raw.into_iter().map(WebhookDelivery::from).collect())
}

pub async fn redeliver_webhook(token: &str, owner: &str, repo: &str, hook_id: u64, delivery_id: u64) -> Result<(), AppError> {
    let client = super::build_client(token)?;
    let resp = client
        .post(format!("https://api.github.com/repos/{}/{}/hooks/{}/deliveries/{}/attempts", owner, repo, hook_id, delivery_id))
        .send().await?;
    super::check_ok(resp).await
}
