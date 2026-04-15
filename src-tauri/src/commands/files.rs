use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};

use crate::github;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct RepoFile {
    pub path: String,
    pub sha: String,
    pub size: u64,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(tag = "op", rename_all = "snake_case")]
pub enum FileOp {
    Delete { path: String },
    Rename { old_path: String, new_path: String },
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct FileOpsResult {
    pub commit_sha: String,
    pub commit_url: String,
    pub ops_applied: usize,
}

#[tauri::command]
pub async fn repo_get_tree(owner: String, repo: String, branch: String) -> Result<Vec<RepoFile>, String> {
    let token = github::get_token().ok_or("No active account")?;
    let client = reqwest::Client::new();
    let mut headers = reqwest::header::HeaderMap::new();
    headers.insert("Authorization", format!("Bearer {}", token).parse().unwrap());
    headers.insert("Accept", "application/vnd.github+json".parse().unwrap());
    headers.insert("X-GitHub-Api-Version", "2022-11-28".parse().unwrap());
    headers.insert("User-Agent", "ZRepoManager/0.1.0".parse().unwrap());

    let base_url = format!("https://api.github.com/repos/{}/{}", owner, repo);

    let ref_resp: serde_json::Value = client
        .get(format!("{}/git/ref/heads/{}", base_url, branch))
        .headers(headers.clone())
        .send().await.map_err(|e| e.to_string())?
        .json().await.map_err(|e| e.to_string())?;
    let head_sha = ref_resp["object"]["sha"].as_str().ok_or("Branch not found")?.to_string();

    let commit_resp: serde_json::Value = client
        .get(format!("{}/git/commits/{}", base_url, head_sha))
        .headers(headers.clone())
        .send().await.map_err(|e| e.to_string())?
        .json().await.map_err(|e| e.to_string())?;
    let tree_sha = commit_resp["tree"]["sha"].as_str().ok_or("No tree sha")?.to_string();

    let tree_resp: serde_json::Value = client
        .get(format!("{}/git/trees/{}?recursive=1", base_url, tree_sha))
        .headers(headers.clone())
        .send().await.map_err(|e| e.to_string())?
        .json().await.map_err(|e| e.to_string())?;

    if tree_resp["truncated"].as_bool().unwrap_or(false) {
        return Err("Repository tree is too large (truncated). Try a smaller repo.".to_string());
    }

    let files = tree_resp["tree"]
        .as_array()
        .ok_or("No tree array")?
        .iter()
        .filter(|e| e["type"].as_str() == Some("blob"))
        .map(|e| RepoFile {
            path: e["path"].as_str().unwrap_or("").to_string(),
            sha: e["sha"].as_str().unwrap_or("").to_string(),
            size: e["size"].as_u64().unwrap_or(0),
        })
        .collect();

    Ok(files)
}

#[tauri::command]
pub async fn repo_apply_file_ops(
    app: AppHandle,
    owner: String,
    repo: String,
    branch: String,
    ops: Vec<FileOp>,
    commit_message: String,
) -> Result<FileOpsResult, String> {
    let token = github::get_token().ok_or("No active account")?;
    let client = reqwest::Client::new();
    let mut headers = reqwest::header::HeaderMap::new();
    headers.insert("Authorization", format!("Bearer {}", token).parse().unwrap());
    headers.insert("Accept", "application/vnd.github+json".parse().unwrap());
    headers.insert("X-GitHub-Api-Version", "2022-11-28".parse().unwrap());
    headers.insert("User-Agent", "ZRepoManager/0.1.0".parse().unwrap());

    let base_url = format!("https://api.github.com/repos/{}/{}", owner, repo);
    let _ = app.emit("files://progress", serde_json::json!({ "status": "loading_tree" }));


    let ref_resp: serde_json::Value = client
        .get(format!("{}/git/ref/heads/{}", base_url, branch))
        .headers(headers.clone())
        .send().await.map_err(|e| e.to_string())?
        .json().await.map_err(|e| e.to_string())?;
    let head_sha = ref_resp["object"]["sha"].as_str().ok_or("Branch not found")?.to_string();

    let commit_resp: serde_json::Value = client
        .get(format!("{}/git/commits/{}", base_url, head_sha))
        .headers(headers.clone())
        .send().await.map_err(|e| e.to_string())?
        .json().await.map_err(|e| e.to_string())?;
    let base_tree_sha = commit_resp["tree"]["sha"].as_str().ok_or("No tree sha")?.to_string();


    let tree_resp: serde_json::Value = client
        .get(format!("{}/git/trees/{}?recursive=1", base_url, base_tree_sha))
        .headers(headers.clone())
        .send().await.map_err(|e| e.to_string())?
        .json().await.map_err(|e| e.to_string())?;

    let current_tree = tree_resp["tree"].as_array().ok_or("No tree")?.clone();


    let path_to_sha: std::collections::HashMap<String, String> = current_tree.iter()
        .filter(|e| e["type"].as_str() == Some("blob"))
        .map(|e| (
            e["path"].as_str().unwrap_or("").to_string(),
            e["sha"].as_str().unwrap_or("").to_string(),
        ))
        .collect();

    let _ = app.emit("files://progress", serde_json::json!({ "status": "building_tree" }));


    let mut new_entries: Vec<serde_json::Value> = Vec::new();

    let ops_applied = ops.len();

    for op in &ops {
        match op {
            FileOp::Delete { path } => {

                new_entries.push(serde_json::json!({
                    "path": path,
                    "mode": "100644",
                    "type": "blob",
                    "sha": serde_json::Value::Null,
                }));
            }
            FileOp::Rename { old_path, new_path } => {
                let sha = path_to_sha.get(old_path)
                    .ok_or_else(|| format!("File not found: {}", old_path))?;

                new_entries.push(serde_json::json!({
                    "path": old_path,
                    "mode": "100644",
                    "type": "blob",
                    "sha": serde_json::Value::Null,
                }));

                new_entries.push(serde_json::json!({
                    "path": new_path,
                    "mode": "100644",
                    "type": "blob",
                    "sha": sha,
                }));
            }
        }
    }

    let _ = app.emit("files://progress", serde_json::json!({ "status": "committing" }));


    let tree_create_resp = client
        .post(format!("{}/git/trees", base_url))
        .headers(headers.clone())
        .json(&serde_json::json!({ "base_tree": base_tree_sha, "tree": new_entries }))
        .send().await.map_err(|e| e.to_string())?;
    if !tree_create_resp.status().is_success() {
        let err: serde_json::Value = tree_create_resp.json().await.unwrap_or_default();
        return Err(format!("Tree creation failed: {}", err["message"].as_str().unwrap_or("unknown")));
    }
    let new_tree: serde_json::Value = tree_create_resp.json().await.map_err(|e| e.to_string())?;
    let new_tree_sha = new_tree["sha"].as_str().ok_or("No new tree sha")?.to_string();


    let commit_create_resp = client
        .post(format!("{}/git/commits", base_url))
        .headers(headers.clone())
        .json(&serde_json::json!({
            "message": commit_message,
            "tree": new_tree_sha,
            "parents": [head_sha],
        }))
        .send().await.map_err(|e| e.to_string())?;
    if !commit_create_resp.status().is_success() {
        let err: serde_json::Value = commit_create_resp.json().await.unwrap_or_default();
        return Err(format!("Commit failed: {}", err["message"].as_str().unwrap_or("unknown")));
    }
    let new_commit: serde_json::Value = commit_create_resp.json().await.map_err(|e| e.to_string())?;
    let new_commit_sha = new_commit["sha"].as_str().ok_or("No commit sha")?.to_string();
    let new_commit_url = new_commit["html_url"].as_str().unwrap_or("").to_string();


    let patch_resp = client
        .patch(format!("{}/git/refs/heads/{}", base_url, branch))
        .headers(headers.clone())
        .json(&serde_json::json!({ "sha": new_commit_sha, "force": false }))
        .send().await.map_err(|e| e.to_string())?;
    if !patch_resp.status().is_success() {
        let err: serde_json::Value = patch_resp.json().await.unwrap_or_default();
        return Err(format!("Ref update failed: {}", err["message"].as_str().unwrap_or("unknown")));
    }

    Ok(FileOpsResult { commit_sha: new_commit_sha, commit_url: new_commit_url, ops_applied })
}
