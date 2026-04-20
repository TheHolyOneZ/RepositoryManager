use serde::{Deserialize, Serialize};
use crate::models::AppError;
use super::{build_client, check_json, check_ok};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Environment {
    pub name: String,
    pub protection_rules: Vec<ProtectionRule>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProtectionRule {
    pub id: u64,
    #[serde(rename = "type")]
    pub rule_type: String,
    pub wait_timer: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RepoSecret {
    pub name: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RepoPublicKey {
    pub key_id: String,
    pub key: String,
}

#[derive(Deserialize)]
struct EnvListRaw { environments: Vec<EnvRaw> }

#[derive(Deserialize)]
struct EnvRaw {
    name: String,
    protection_rules: Option<Vec<ProtRuleRaw>>,
}

#[derive(Deserialize)]
struct ProtRuleRaw {
    id: u64,
    #[serde(rename = "type")]
    rule_type: String,
    wait_timer: Option<u32>,
}

#[derive(Deserialize)]
struct SecretsListRaw { secrets: Vec<RepoSecret> }

fn map_env(e: EnvRaw) -> Environment {
    Environment {
        name: e.name,
        protection_rules: e.protection_rules.unwrap_or_default().into_iter().map(|r| ProtectionRule {
            id: r.id, rule_type: r.rule_type, wait_timer: r.wait_timer,
        }).collect(),
    }
}

pub async fn list_environments(token: &str, owner: &str, repo: &str) -> Result<Vec<Environment>, AppError> {
    let client = build_client(token)?;
    let raw: EnvListRaw = check_json(
        client.get(&format!("https://api.github.com/repos/{}/{}/environments?per_page=100", owner, repo))
            .send().await?
    ).await?;
    Ok(raw.environments.into_iter().map(map_env).collect())
}

pub async fn create_environment(token: &str, owner: &str, repo: &str, env_name: &str) -> Result<Environment, AppError> {
    let client = build_client(token)?;
    let raw: EnvRaw = check_json(
        client.put(&format!("https://api.github.com/repos/{}/{}/environments/{}", owner, repo, env_name))
            .json(&serde_json::json!({})).send().await?
    ).await?;
    Ok(map_env(raw))
}

pub async fn delete_environment(token: &str, owner: &str, repo: &str, env_name: &str) -> Result<(), AppError> {
    let client = build_client(token)?;
    check_ok(client.delete(&format!("https://api.github.com/repos/{}/{}/environments/{}", owner, repo, env_name)).send().await?).await
}

pub async fn list_repo_secrets(token: &str, owner: &str, repo: &str) -> Result<Vec<RepoSecret>, AppError> {
    let client = build_client(token)?;
    let raw: SecretsListRaw = check_json(
        client.get(&format!("https://api.github.com/repos/{}/{}/actions/secrets?per_page=100", owner, repo))
            .send().await?
    ).await?;
    Ok(raw.secrets)
}

pub async fn list_env_secrets(token: &str, owner: &str, repo: &str, env_name: &str) -> Result<Vec<RepoSecret>, AppError> {
    let client = build_client(token)?;
    let raw: SecretsListRaw = check_json(
        client.get(&format!("https://api.github.com/repos/{}/{}/environments/{}/secrets?per_page=100", owner, repo, env_name))
            .send().await?
    ).await?;
    Ok(raw.secrets)
}

pub async fn get_repo_public_key(token: &str, owner: &str, repo: &str) -> Result<RepoPublicKey, AppError> {
    let client = build_client(token)?;
    check_json(client.get(&format!("https://api.github.com/repos/{}/{}/actions/secrets/public-key", owner, repo)).send().await?).await
}

pub async fn get_env_public_key(token: &str, owner: &str, repo: &str, env_name: &str) -> Result<RepoPublicKey, AppError> {
    let client = build_client(token)?;
    check_json(client.get(&format!("https://api.github.com/repos/{}/{}/environments/{}/secrets/public-key", owner, repo, env_name)).send().await?).await
}

pub async fn create_or_update_repo_secret(token: &str, owner: &str, repo: &str, name: &str, encrypted_value: &str, key_id: &str) -> Result<(), AppError> {
    let client = build_client(token)?;
    check_ok(
        client.put(&format!("https://api.github.com/repos/{}/{}/actions/secrets/{}", owner, repo, name))
            .json(&serde_json::json!({ "encrypted_value": encrypted_value, "key_id": key_id }))
            .send().await?
    ).await
}

pub async fn delete_repo_secret(token: &str, owner: &str, repo: &str, name: &str) -> Result<(), AppError> {
    let client = build_client(token)?;
    check_ok(client.delete(&format!("https://api.github.com/repos/{}/{}/actions/secrets/{}", owner, repo, name)).send().await?).await
}

pub async fn create_or_update_env_secret(token: &str, owner: &str, repo: &str, env_name: &str, name: &str, encrypted_value: &str, key_id: &str) -> Result<(), AppError> {
    let client = build_client(token)?;
    check_ok(
        client.put(&format!("https://api.github.com/repos/{}/{}/environments/{}/secrets/{}", owner, repo, env_name, name))
            .json(&serde_json::json!({ "encrypted_value": encrypted_value, "key_id": key_id }))
            .send().await?
    ).await
}

pub async fn delete_env_secret(token: &str, owner: &str, repo: &str, env_name: &str, name: &str) -> Result<(), AppError> {
    let client = build_client(token)?;
    check_ok(client.delete(&format!("https://api.github.com/repos/{}/{}/environments/{}/secrets/{}", owner, repo, env_name, name)).send().await?).await
}
