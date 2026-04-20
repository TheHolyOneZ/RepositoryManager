use crate::models::AppError;
use crate::github;
use crate::github::deps_scanner::RepoDependencies;
use crate::commands::auth::get_active_token;

#[tauri::command]
pub async fn gh_scan_repo_deps(owner: String, repo: String) -> Result<RepoDependencies, AppError> {
    let token = get_active_token()?;
    github::deps_scanner::scan_repo(&token, &owner, &repo).await
}

#[derive(serde::Deserialize)]
pub struct DepsScanTarget { pub owner: String, pub repo: String }

#[tauri::command]
pub async fn gh_scan_multiple_repos_deps(targets: Vec<DepsScanTarget>) -> Result<Vec<RepoDependencies>, AppError> {
    let token = get_active_token()?;
    let mut results = Vec::new();
    for t in targets {
        match github::deps_scanner::scan_repo(&token, &t.owner, &t.repo).await {
            Ok(r) => results.push(r),
            Err(_e) => results.push(RepoDependencies {
                repo_full_name: format!("{}/{}", t.owner, t.repo),
                dependencies: vec![],
                files_found: vec![],
            }),
        }
    }
    Ok(results)
}
