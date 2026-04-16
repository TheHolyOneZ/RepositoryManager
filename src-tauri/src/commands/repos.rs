use crate::models::{Repo, CleanupSuggestion, AppError, RepoExportInput, ExportBatchResult, ExportItemResult};
use crate::github;
use crate::health;
use crate::commands::auth::get_active_token;
use std::sync::Mutex;
use once_cell::sync::Lazy;
use uuid::Uuid;
use strsim::normalized_levenshtein;


static REPO_CACHE: Lazy<Mutex<Vec<Repo>>> = Lazy::new(|| Mutex::new(Vec::new()));
static EXTRA_SUGGESTIONS: Lazy<Mutex<Vec<CleanupSuggestion>>> = Lazy::new(|| Mutex::new(Vec::new()));

pub fn inject_stale_branch_suggestions(repo_ids: Vec<String>, repo_names: Vec<String>) {
    let mut extras = EXTRA_SUGGESTIONS.lock().unwrap();
    extras.retain(|s| s.reason != "stale_branches");
    for (id, name) in repo_ids.into_iter().zip(repo_names.into_iter()) {
        extras.push(CleanupSuggestion {
            id: Uuid::new_v4().to_string(),
            repo_id: id,
            repo_name: name,
            reason: "stale_branches".into(),
            description: "Repository has branches with no commit activity in 90+ days".into(),
            suggested_action: "review".into(),
            priority: "low".into(),
        });
    }
}

#[tauri::command]
pub async fn repos_fetch_all(_account_id: String, force_refresh: bool) -> Result<Vec<Repo>, AppError> {
    let token = get_active_token()?;

    {
        let cache = REPO_CACHE.lock().unwrap();
        if !force_refresh && !cache.is_empty() {
            return Ok(cache.clone());
        }
    }

    let mut repos = github::fetch_all_repos(&token).await?;
    health::enrich_repos(&mut repos);

    {
        let mut cache = REPO_CACHE.lock().unwrap();
        *cache = repos.clone();
    }

    Ok(repos)
}

#[tauri::command]
pub async fn repos_get_suggestions() -> Result<Vec<CleanupSuggestion>, AppError> {
    let repos = REPO_CACHE.lock().unwrap().clone();
    let mut suggestions = Vec::new();


    let dead: Vec<&Repo> = repos.iter().filter(|r| {
        r.health.as_ref().map(|h| h.status == "dead").unwrap_or(false)
    }).collect();

    if !dead.is_empty() {
        suggestions.push(CleanupSuggestion {
            id: Uuid::new_v4().to_string(),
            repo_id: dead[0].id.clone(),
            repo_name: format!("{} repos", dead.len()),
            reason: "inactive".into(),
            description: format!("{} repos have had no activity for 6+ months", dead.len()),
            suggested_action: "archive".into(),
            priority: if dead.len() > 5 { "high".into() } else { "medium".into() },
        });
    }


    let empty: Vec<&Repo> = repos.iter().filter(|r| {
        r.health.as_ref().map(|h| h.status == "empty").unwrap_or(false)
    }).collect();

    if !empty.is_empty() {
        suggestions.push(CleanupSuggestion {
            id: Uuid::new_v4().to_string(),
            repo_id: empty[0].id.clone(),
            repo_name: format!("{} repos", empty.len()),
            reason: "empty".into(),
            description: format!("{} repos have no content", empty.len()),
            suggested_action: "delete".into(),
            priority: "medium".into(),
        });
    }


    let abandoned_forks: Vec<&Repo> = repos.iter().filter(|r| {
        r.fork && r.stars == 0 && r.health.as_ref().map(|h| h.status != "active").unwrap_or(true)
    }).collect();

    if !abandoned_forks.is_empty() {
        suggestions.push(CleanupSuggestion {
            id: Uuid::new_v4().to_string(),
            repo_id: abandoned_forks[0].id.clone(),
            repo_name: format!("{} forks", abandoned_forks.len()),
            reason: "abandoned_fork".into(),
            description: format!("{} inactive forks with no stars", abandoned_forks.len()),
            suggested_action: "delete".into(),
            priority: "low".into(),
        });
    }


    let names: Vec<(&str, &str)> = repos.iter().map(|r| (r.id.as_str(), r.name.as_str())).collect();
    for i in 0..names.len() {
        for j in (i+1)..names.len() {
            let sim = normalized_levenshtein(names[i].1, names[j].1);
            if sim > 0.85 && names[i].1 != names[j].1 {
                suggestions.push(CleanupSuggestion {
                    id: Uuid::new_v4().to_string(),
                    repo_id: names[i].0.to_string(),
                    repo_name: format!("{} & {}", names[i].1, names[j].1),
                    reason: "duplicate_name".into(),
                    description: format!("'{}' and '{}' have very similar names ({:.0}% similar)", names[i].1, names[j].1, sim * 100.0),
                    suggested_action: "review".into(),
                    priority: "low".into(),
                });
                break;
            }
        }
    }

    let extras = EXTRA_SUGGESTIONS.lock().unwrap().clone();
    suggestions.extend(extras);

    Ok(suggestions)
}

#[tauri::command]
pub async fn repos_apply_tag(repo_ids: Vec<String>, tag: String) -> Result<(), AppError> {
    let mut cache = REPO_CACHE.lock().unwrap();
    for repo in cache.iter_mut() {
        if repo_ids.contains(&repo.id) {
            if !repo.tags.contains(&tag) {
                repo.tags.push(tag.clone());
            }
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn repos_remove_tag(repo_ids: Vec<String>, tag: String) -> Result<(), AppError> {
    let mut cache = REPO_CACHE.lock().unwrap();
    for repo in cache.iter_mut() {
        if repo_ids.contains(&repo.id) {
            repo.tags.retain(|t| t != &tag);
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn repos_export(repo_ids: Vec<String>, format: String) -> Result<String, AppError> {
    let cache = REPO_CACHE.lock().unwrap();
    let repos: Vec<&Repo> = cache.iter().filter(|r| repo_ids.contains(&r.id)).collect();

    match format.as_str() {
        "json" => serde_json::to_string_pretty(&repos).map_err(AppError::from),
        "csv" => {
            let mut csv = "id,name,full_name,private,language,stars,forks,health,updated_at\n".to_string();
            for r in repos {
                csv.push_str(&format!(
                    "{},{},{},{},{},{},{},{},{}\n",
                    r.id, r.name, r.full_name, r.private,
                    r.language.as_deref().unwrap_or(""),
                    r.stars, r.forks,
                    r.health.as_ref().map(|h| h.status.as_str()).unwrap_or("unknown"),
                    r.updated_at
                ));
            }
            Ok(csv)
        }
        _ => Err(AppError { code: "INVALID_FORMAT".into(), message: "Format must be 'csv' or 'json'".into() }),
    }
}


fn parse_full_name(full_name: &str) -> (&str, &str) {
    let mut parts = full_name.splitn(2, '/');
    let owner = parts.next().unwrap_or("");
    let repo  = parts.next().unwrap_or(full_name);
    (owner, repo)
}

/// Export README.md files from a list of repos into dest_path/<repo_name>/README.md
#[tauri::command]
pub async fn export_readmes(items: Vec<RepoExportInput>, dest_path: String) -> Result<ExportBatchResult, AppError> {
    let token = get_active_token()?;
    let mut results = Vec::new();
    let mut succeeded = 0u32;
    let mut failed = 0u32;

    for item in items {
        let (owner, repo_name) = parse_full_name(&item.repo_full_name);
        let dir = format!("{}/{}", dest_path.trim_end_matches(['/', '\\']), item.repo_name);
        match github::fetch_readme(&token, owner, repo_name).await {
            Ok(content) => {
                let path = format!("{}/README.md", dir);
                match std::fs::create_dir_all(&dir).and_then(|_| std::fs::write(&path, content)) {
                    Ok(_) => {
                        succeeded += 1;
                        results.push(ExportItemResult { repo_name: item.repo_name, success: true, path: Some(path), error: None });
                    }
                    Err(e) => {
                        failed += 1;
                        results.push(ExportItemResult { repo_name: item.repo_name, success: false, path: None, error: Some(e.to_string()) });
                    }
                }
            }
            Err(e) => {
                failed += 1;
                results.push(ExportItemResult { repo_name: item.repo_name, success: false, path: None, error: Some(e.message) });
            }
        }
    }

    Ok(ExportBatchResult { results, succeeded, failed })
}

/// Fetch latest release info for a list of repos (no file download — metadata only).
#[tauri::command]
pub async fn fetch_releases(items: Vec<RepoExportInput>) -> Result<Vec<serde_json::Value>, AppError> {
    let token = get_active_token()?;
    let mut results = Vec::new();

    for item in items {
        let (owner, repo_name) = parse_full_name(&item.repo_full_name);
        match github::fetch_latest_release(&token, owner, repo_name).await {
            Ok(Some(release)) => {
                results.push(serde_json::json!({
                    "repo_name": item.repo_name,
                    "repo_full_name": item.repo_full_name,
                    "success": true,
                    "release": release,
                }));
            }
            Ok(None) => {
                results.push(serde_json::json!({
                    "repo_name": item.repo_name,
                    "repo_full_name": item.repo_full_name,
                    "success": false,
                    "error": "No releases found",
                }));
            }
            Err(e) => {
                results.push(serde_json::json!({
                    "repo_name": item.repo_name,
                    "repo_full_name": item.repo_full_name,
                    "success": false,
                    "error": e.message,
                }));
            }
        }
    }

    Ok(results)
}

/// Download release assets for repos into dest_path/<repo_name>/<asset_name>
#[tauri::command]
pub async fn export_release_assets(items: Vec<RepoExportInput>, dest_path: String) -> Result<ExportBatchResult, AppError> {
    let token = get_active_token()?;
    let mut results = Vec::new();
    let mut succeeded = 0u32;
    let mut failed = 0u32;

    for item in items {
        let (owner, repo_name) = parse_full_name(&item.repo_full_name);
        let dir = format!("{}/{}", dest_path.trim_end_matches(['/', '\\']), item.repo_name);

        match github::fetch_latest_release(&token, owner, repo_name).await {
            Ok(Some(release)) => {
                if release.assets.is_empty() {
                    failed += 1;
                    results.push(ExportItemResult {
                        repo_name: item.repo_name,
                        success: false,
                        path: None,
                        error: Some(format!("Release {} has no assets", release.tag_name)),
                    });
                    continue;
                }
                if let Err(e) = std::fs::create_dir_all(&dir) {
                    failed += 1;
                    results.push(ExportItemResult { repo_name: item.repo_name, success: false, path: None, error: Some(e.to_string()) });
                    continue;
                }

                let mut asset_paths = Vec::new();
                let mut asset_err: Option<String> = None;
                for asset in &release.assets {
                    match github::download_asset(&asset.download_url, &token).await {
                        Ok(bytes) => {
                            let path = format!("{}/{}", dir, asset.name);
                            if let Err(e) = std::fs::write(&path, bytes) {
                                asset_err = Some(e.to_string());
                                break;
                            }
                            asset_paths.push(path);
                        }
                        Err(e) => { asset_err = Some(e.message); break; }
                    }
                }
                if let Some(err) = asset_err {
                    failed += 1;
                    results.push(ExportItemResult { repo_name: item.repo_name, success: false, path: None, error: Some(err) });
                } else {
                    succeeded += 1;
                    results.push(ExportItemResult {
                        repo_name: item.repo_name, success: true,
                        path: Some(dir),
                        error: None,
                    });
                }
            }
            Ok(None) => {
                failed += 1;
                results.push(ExportItemResult { repo_name: item.repo_name, success: false, path: None, error: Some("No releases found".into()) });
            }
            Err(e) => {
                failed += 1;
                results.push(ExportItemResult { repo_name: item.repo_name, success: false, path: None, error: Some(e.message) });
            }
        }
    }

    Ok(ExportBatchResult { results, succeeded, failed })
}


/// Export full repo metadata (JSON) to dest_path/<repo_name>/repo.json
#[tauri::command]
pub async fn export_repo_metadata(items: Vec<RepoExportInput>, dest_path: String) -> Result<ExportBatchResult, AppError> {
    let cache = REPO_CACHE.lock().unwrap();
    let mut results = Vec::new();
    let mut succeeded = 0u32;
    let mut failed = 0u32;

    for item in items {
        let dir = format!("{}/{}", dest_path.trim_end_matches(['/', '\\']), item.repo_name);
        if let Some(repo) = cache.iter().find(|r| r.id == item.repo_id) {
            let path = format!("{}/repo.json", dir);
            match serde_json::to_string_pretty(repo)
                .map_err(|e| e.to_string())
                .and_then(|json| std::fs::create_dir_all(&dir).map(|_| json).map_err(|e| e.to_string()))
                .and_then(|json| std::fs::write(&path, json).map_err(|e| e.to_string()))
            {
                Ok(_) => { succeeded += 1; results.push(ExportItemResult { repo_name: item.repo_name, success: true, path: Some(path), error: None }); }
                Err(e) => { failed += 1; results.push(ExportItemResult { repo_name: item.repo_name, success: false, path: None, error: Some(e) }); }
            }
        } else {
            failed += 1;
            results.push(ExportItemResult { repo_name: item.repo_name, success: false, path: None, error: Some("Repo not in cache".into()) });
        }
    }

    Ok(ExportBatchResult { results, succeeded, failed })
}


#[derive(Debug, serde::Serialize, serde::Deserialize, Clone)]
pub struct LanguageStat {
    pub language: String,
    pub bytes: u64,
    pub percentage: f64,
}

/// Fetch language breakdown for a single repo from GitHub's languages API.
#[tauri::command]
pub async fn repo_get_languages(full_name: String) -> Result<Vec<LanguageStat>, AppError> {
    let token = get_active_token()?;
    let client = reqwest::Client::builder()
        .user_agent("ZRepoManager/1.0")
        .build()
        .map_err(|e| AppError::from(e.to_string()))?;

    let url = format!("https://api.github.com/repos/{}/languages", full_name);
    let map = client
        .get(&url)
        .header("Authorization", format!("token {}", token))
        .header("Accept", "application/vnd.github.v3+json")
        .header("X-GitHub-Api-Version", "2022-11-28")
        .send()
        .await
        .map_err(|e| AppError::from(e.to_string()))?
        .error_for_status()
        .map_err(|e| AppError { code: "GITHUB_API_ERROR".into(), message: e.to_string() })?
        .json::<std::collections::HashMap<String, u64>>()
        .await
        .map_err(|e| AppError::from(e.to_string()))?;

    let total: u64 = map.values().sum();
    let mut stats: Vec<LanguageStat> = map.into_iter().map(|(language, bytes)| {
        let percentage = if total > 0 { (bytes as f64 / total as f64) * 100.0 } else { 0.0 };
        LanguageStat { language, bytes, percentage }
    }).collect();
    stats.sort_by(|a, b| b.bytes.cmp(&a.bytes));
    Ok(stats)
}
