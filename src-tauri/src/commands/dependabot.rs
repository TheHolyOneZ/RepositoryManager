use crate::models::AppError;
use crate::github;
use crate::github::dependabot::DependabotAlert;
use crate::commands::auth::get_active_token;

#[tauri::command]
pub async fn gh_list_dependabot_alerts(owner: String, repo: String, state: String, severity: Option<String>) -> Result<Vec<DependabotAlert>, AppError> {
    let token = get_active_token()?;
    github::dependabot::list_alerts(&token, &owner, &repo, &state, severity.as_deref()).await
}

#[tauri::command]
pub async fn gh_get_dependabot_enabled(owner: String, repo: String) -> Result<bool, AppError> {
    let token = get_active_token()?;
    github::dependabot::get_alerts_enabled(&token, &owner, &repo).await
}

#[tauri::command]
pub async fn gh_enable_dependabot(owner: String, repo: String) -> Result<(), AppError> {
    let token = get_active_token()?;
    github::dependabot::enable_alerts(&token, &owner, &repo).await
}

#[tauri::command]
pub async fn gh_disable_dependabot(owner: String, repo: String) -> Result<(), AppError> {
    let token = get_active_token()?;
    github::dependabot::disable_alerts(&token, &owner, &repo).await
}

#[tauri::command]
pub async fn gh_enable_security_fixes(owner: String, repo: String) -> Result<(), AppError> {
    let token = get_active_token()?;
    github::dependabot::enable_security_fixes(&token, &owner, &repo).await
}

#[tauri::command]
pub async fn gh_disable_security_fixes(owner: String, repo: String) -> Result<(), AppError> {
    let token = get_active_token()?;
    github::dependabot::disable_security_fixes(&token, &owner, &repo).await
}

#[derive(serde::Deserialize)]
pub struct SecurityScanTarget {
    pub owner: String,
    pub repo: String,
}

#[derive(serde::Serialize)]
pub struct RepoAlertSummary {
    pub repo_full_name: String,
    pub critical: u32,
    pub high: u32,
    pub medium: u32,
    pub low: u32,
    pub total: u32,
    pub error: Option<String>,
}

#[tauri::command]
pub async fn gh_portfolio_security_summary(targets: Vec<SecurityScanTarget>) -> Result<Vec<RepoAlertSummary>, AppError> {
    let token = get_active_token()?;
    let mut results = Vec::new();
    for t in targets {
        let outcome = github::dependabot::list_alerts(&token, &t.owner, &t.repo, "open", None).await;
        match outcome {
            Ok(alerts) => {
                let critical = alerts.iter().filter(|a| a.severity == "critical").count() as u32;
                let high = alerts.iter().filter(|a| a.severity == "high").count() as u32;
                let medium = alerts.iter().filter(|a| a.severity == "medium").count() as u32;
                let low = alerts.iter().filter(|a| a.severity == "low").count() as u32;
                results.push(RepoAlertSummary {
                    repo_full_name: format!("{}/{}", t.owner, t.repo),
                    critical, high, medium, low,
                    total: alerts.len() as u32,
                    error: None,
                });
            }
            Err(e) => {
                results.push(RepoAlertSummary {
                    repo_full_name: format!("{}/{}", t.owner, t.repo),
                    critical: 0, high: 0, medium: 0, low: 0, total: 0,
                    error: Some(e.message),
                });
            }
        }
    }
    Ok(results)
}
