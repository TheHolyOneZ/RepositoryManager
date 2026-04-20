use crate::models::AppError;
use crate::github;
use crate::github::environments::{Environment, RepoSecret, RepoPublicKey};
use crate::commands::auth::get_active_token;
use crypto_box::{
    aead::{Aead, OsRng, generic_array::GenericArray},
    SalsaBox, PublicKey, SecretKey,
};
use blake2::{Blake2bVar, digest::{Update, VariableOutput}};
use base64::{engine::general_purpose, Engine};


fn encrypt_for_github(public_key_b64: &str, plaintext: &str) -> Result<String, AppError> {
    let pk_bytes = general_purpose::STANDARD.decode(public_key_b64)
        .map_err(|e| AppError::from(format!("Invalid public key encoding: {}", e)))?;
    let pk_arr: [u8; 32] = pk_bytes.try_into()
        .map_err(|_| AppError::from("Public key must be 32 bytes"))?;
    let recipient_pk = PublicKey::from(pk_arr);

    let ek_sk = SecretKey::generate(&mut OsRng);
    let ek_pk = ek_sk.public_key();


    let mut hasher = Blake2bVar::new(24)
        .map_err(|e| AppError::from(format!("Blake2b init failed: {}", e)))?;
    hasher.update(ek_pk.as_bytes());
    hasher.update(recipient_pk.as_bytes());
    let mut nonce_bytes = [0u8; 24];
    hasher.finalize_variable(&mut nonce_bytes)
        .map_err(|e| AppError::from(format!("Blake2b finalize failed: {}", e)))?;
    let nonce = *GenericArray::from_slice(&nonce_bytes);

    let salsa_box = SalsaBox::new(&recipient_pk, &ek_sk);
    let ciphertext = salsa_box.encrypt(&nonce, plaintext.as_bytes())
        .map_err(|e| AppError::from(format!("Encryption failed: {}", e)))?;

    let mut output = ek_pk.as_bytes().to_vec();
    output.extend_from_slice(&ciphertext);
    Ok(general_purpose::STANDARD.encode(&output))
}

#[tauri::command]
pub async fn gh_list_environments(owner: String, repo: String) -> Result<Vec<Environment>, AppError> {
    let token = get_active_token()?;
    github::environments::list_environments(&token, &owner, &repo).await
}

#[tauri::command]
pub async fn gh_create_environment(owner: String, repo: String, env_name: String) -> Result<Environment, AppError> {
    let token = get_active_token()?;
    github::environments::create_environment(&token, &owner, &repo, &env_name).await
}

#[tauri::command]
pub async fn gh_delete_environment(owner: String, repo: String, env_name: String) -> Result<(), AppError> {
    let token = get_active_token()?;
    github::environments::delete_environment(&token, &owner, &repo, &env_name).await
}

#[tauri::command]
pub async fn gh_list_repo_secrets(owner: String, repo: String) -> Result<Vec<RepoSecret>, AppError> {
    let token = get_active_token()?;
    github::environments::list_repo_secrets(&token, &owner, &repo).await
}

#[tauri::command]
pub async fn gh_list_env_secrets(owner: String, repo: String, env_name: String) -> Result<Vec<RepoSecret>, AppError> {
    let token = get_active_token()?;
    github::environments::list_env_secrets(&token, &owner, &repo, &env_name).await
}

#[tauri::command]
pub async fn gh_get_repo_public_key(owner: String, repo: String) -> Result<RepoPublicKey, AppError> {
    let token = get_active_token()?;
    github::environments::get_repo_public_key(&token, &owner, &repo).await
}

#[tauri::command]
pub async fn gh_create_repo_secret(owner: String, repo: String, name: String, plaintext: String) -> Result<(), AppError> {
    let token = get_active_token()?;
    let pk = github::environments::get_repo_public_key(&token, &owner, &repo).await?;
    let encrypted = encrypt_for_github(&pk.key, &plaintext)?;
    github::environments::create_or_update_repo_secret(&token, &owner, &repo, &name, &encrypted, &pk.key_id).await
}

#[tauri::command]
pub async fn gh_delete_repo_secret(owner: String, repo: String, name: String) -> Result<(), AppError> {
    let token = get_active_token()?;
    github::environments::delete_repo_secret(&token, &owner, &repo, &name).await
}

#[tauri::command]
pub async fn gh_create_env_secret(owner: String, repo: String, env_name: String, name: String, plaintext: String) -> Result<(), AppError> {
    let token = get_active_token()?;
    let pk = github::environments::get_env_public_key(&token, &owner, &repo, &env_name).await?;
    let encrypted = encrypt_for_github(&pk.key, &plaintext)?;
    github::environments::create_or_update_env_secret(&token, &owner, &repo, &env_name, &name, &encrypted, &pk.key_id).await
}

#[tauri::command]
pub async fn gh_delete_env_secret(owner: String, repo: String, env_name: String, name: String) -> Result<(), AppError> {
    let token = get_active_token()?;
    github::environments::delete_env_secret(&token, &owner, &repo, &env_name, &name).await
}

#[derive(serde::Deserialize)]
pub struct BulkSecretTarget {
    pub owner: String,
    pub repo: String,
}

#[derive(serde::Serialize)]
pub struct BulkSecretResult {
    pub repo: String,
    pub success: bool,
    pub error: Option<String>,
}

#[tauri::command]
pub async fn gh_bulk_set_secret(targets: Vec<BulkSecretTarget>, name: String, plaintext: String) -> Result<Vec<BulkSecretResult>, AppError> {
    let token = get_active_token()?;
    let mut results = Vec::new();
    for t in targets {
        let outcome: Result<(), AppError> = async {
            let pk = github::environments::get_repo_public_key(&token, &t.owner, &t.repo).await?;
            let encrypted = encrypt_for_github(&pk.key, &plaintext)?;
            github::environments::create_or_update_repo_secret(&token, &t.owner, &t.repo, &name, &encrypted, &pk.key_id).await
        }.await;
        results.push(BulkSecretResult {
            repo: format!("{}/{}", t.owner, t.repo),
            success: outcome.is_ok(),
            error: outcome.err().map(|e| e.message),
        });
    }
    Ok(results)
}
