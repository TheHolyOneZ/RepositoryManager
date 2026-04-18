use base64::{engine::general_purpose, Engine as _};
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
    headers.insert("User-Agent", "ZRepoManager/0.3.0".parse().unwrap());

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
    headers.insert("User-Agent", "ZRepoManager/0.3.0".parse().unwrap());

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

#[tauri::command]
pub fn read_text_file(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct FileContent {
    pub content: String,
    pub sha: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct FileUpdateResult {
    pub commit_sha: String,
    pub commit_url: String,
}

#[tauri::command]
pub async fn repo_get_file_content(
    owner: String,
    repo: String,
    path: String,
    ref_name: String,
) -> Result<FileContent, String> {
    let token = github::get_token().ok_or("No active account")?;
    let client = reqwest::Client::new();
    let mut headers = reqwest::header::HeaderMap::new();
    headers.insert("Authorization", format!("Bearer {}", token).parse().unwrap());
    headers.insert("Accept", "application/vnd.github+json".parse().unwrap());
    headers.insert("X-GitHub-Api-Version", "2022-11-28".parse().unwrap());
    headers.insert("User-Agent", "ZRepoManager/0.3.0".parse().unwrap());

    let url = format!(
        "https://api.github.com/repos/{}/{}/contents/{}?ref={}",
        owner, repo, path, ref_name
    );

    let resp: serde_json::Value = client
        .get(&url)
        .headers(headers)
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json()
        .await
        .map_err(|e| e.to_string())?;

    if let Some(msg) = resp["message"].as_str() {
        return Err(msg.to_string());
    }

    let sha = resp["sha"].as_str().ok_or("No sha field")?.to_string();
    let raw = resp["content"].as_str().ok_or("No content field")?;
    let cleaned: String = raw.chars().filter(|c| !c.is_whitespace()).collect();

    let content = if cleaned.is_empty() {
        String::new()
    } else {
        let decoded = general_purpose::STANDARD
            .decode(&cleaned)
            .map_err(|e| format!("Base64 decode error: {}", e))?;
        String::from_utf8(decoded).unwrap_or_else(|_| "[Binary file — cannot display]".to_string())
    };

    Ok(FileContent { content, sha })
}

#[tauri::command]
pub async fn repo_update_file_content(
    owner: String,
    repo: String,
    branch: String,
    path: String,
    content: String,
    sha: String,
    commit_message: String,
) -> Result<FileUpdateResult, String> {
    let token = github::get_token().ok_or("No active account")?;
    let client = reqwest::Client::new();
    let mut headers = reqwest::header::HeaderMap::new();
    headers.insert("Authorization", format!("Bearer {}", token).parse().unwrap());
    headers.insert("Accept", "application/vnd.github+json".parse().unwrap());
    headers.insert("X-GitHub-Api-Version", "2022-11-28".parse().unwrap());
    headers.insert("User-Agent", "ZRepoManager/0.3.0".parse().unwrap());

    let encoded = general_purpose::STANDARD.encode(content.as_bytes());
    let url = format!("https://api.github.com/repos/{}/{}/contents/{}", owner, repo, path);

    let resp = client
        .put(&url)
        .headers(headers)
        .json(&serde_json::json!({
            "message": commit_message,
            "content": encoded,
            "sha": sha,
            "branch": branch,
        }))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !resp.status().is_success() {
        let err: serde_json::Value = resp.json().await.unwrap_or_default();
        return Err(format!("Update failed: {}", err["message"].as_str().unwrap_or("unknown")));
    }

    let result: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    let commit_sha = result["commit"]["sha"].as_str().ok_or("No commit sha")?.to_string();
    let commit_url = result["commit"]["html_url"].as_str().unwrap_or("").to_string();

    Ok(FileUpdateResult { commit_sha, commit_url })
}

#[tauri::command]
pub fn open_editor_window(
    app: AppHandle,
    owner: String,
    repo: String,
    branch: String,
) -> Result<(), String> {
    use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};

    let label = format!("editor-{}-{}", owner, repo).replace('/', "--");

    if let Some(win) = app.get_webview_window(&label) {
        let _ = win.set_focus();
        return Ok(());
    }

    let url = format!("/editor?owner={}&repo={}&branch={}", owner, repo, branch);

    WebviewWindowBuilder::new(&app, &label, WebviewUrl::App(url.into()))
        .title(format!("{}/{} — Editor", owner, repo))
        .inner_size(1400.0, 900.0)
        .min_inner_size(900.0, 600.0)
        .build()
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn repo_get_artifact_download_url(
    owner: String,
    repo: String,
    artifact_id: u64,
) -> Result<String, String> {
    let token = github::get_token().ok_or("No active account")?;
    let client = reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .map_err(|e| e.to_string())?;

    let mut headers = reqwest::header::HeaderMap::new();
    headers.insert("Authorization", format!("Bearer {}", token).parse().unwrap());
    headers.insert("Accept", "application/vnd.github+json".parse().unwrap());
    headers.insert("X-GitHub-Api-Version", "2022-11-28".parse().unwrap());
    headers.insert("User-Agent", "ZRepoManager/0.3.0".parse().unwrap());

    let url = format!(
        "https://api.github.com/repos/{}/{}/actions/artifacts/{}/zip",
        owner, repo, artifact_id
    );

    let resp = client
        .get(&url)
        .headers(headers)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let location = resp
        .headers()
        .get("location")
        .ok_or("No redirect URL — artifact may have expired")?
        .to_str()
        .map_err(|e| e.to_string())?
        .to_string();

    Ok(location)
}

#[tauri::command]
pub async fn repo_create_workflow(
    owner: String,
    repo: String,
    branch: String,
    filename: String,
    content: String,
    commit_message: String,
) -> Result<FileUpdateResult, String> {
    let token = github::get_token().ok_or("No active account")?;
    let client = reqwest::Client::new();
    let mut headers = reqwest::header::HeaderMap::new();
    headers.insert("Authorization", format!("Bearer {}", token).parse().unwrap());
    headers.insert("Accept", "application/vnd.github+json".parse().unwrap());
    headers.insert("X-GitHub-Api-Version", "2022-11-28".parse().unwrap());
    headers.insert("User-Agent", "ZRepoManager/0.3.0".parse().unwrap());

    let base_url = format!("https://api.github.com/repos/{}/{}", owner, repo);


    let ref_resp = client
        .get(format!("{}/git/ref/heads/{}", base_url, branch))
        .headers(headers.clone())
        .send().await.map_err(|e| e.to_string())?;
    if !ref_resp.status().is_success() {
        let status = ref_resp.status().as_u16();
        let err: serde_json::Value = ref_resp.json().await.unwrap_or_default();
        let msg = err["message"].as_str().unwrap_or("unknown");
        return Err(format!("Branch '{}' not found in {}/{} (HTTP {}): {}", branch, owner, repo, status, msg));
    }
    let ref_json: serde_json::Value = ref_resp.json().await.map_err(|e| e.to_string())?;
    let head_sha = ref_json["object"]["sha"].as_str().ok_or("No HEAD sha")?.to_string();


    let commit_resp: serde_json::Value = client
        .get(format!("{}/git/commits/{}", base_url, head_sha))
        .headers(headers.clone())
        .send().await.map_err(|e| e.to_string())?
        .json().await.map_err(|e| e.to_string())?;
    let base_tree_sha = commit_resp["tree"]["sha"].as_str().ok_or("No tree sha")?.to_string();


    let encoded = general_purpose::STANDARD.encode(content.as_bytes());
    let blob_resp = client
        .post(format!("{}/git/blobs", base_url))
        .headers(headers.clone())
        .json(&serde_json::json!({ "content": encoded, "encoding": "base64" }))
        .send().await.map_err(|e| e.to_string())?;
    if !blob_resp.status().is_success() {
        let err: serde_json::Value = blob_resp.json().await.unwrap_or_default();
        return Err(format!("Failed to create blob: {}", err["message"].as_str().unwrap_or("unknown")));
    }
    let blob_json: serde_json::Value = blob_resp.json().await.map_err(|e| e.to_string())?;
    let blob_sha = blob_json["sha"].as_str().ok_or("No blob sha")?.to_string();


    let file_path = format!(".github/workflows/{}", filename);
    let tree_resp = client
        .post(format!("{}/git/trees", base_url))
        .headers(headers.clone())
        .json(&serde_json::json!({
            "base_tree": base_tree_sha,
            "tree": [{ "path": file_path, "mode": "100644", "type": "blob", "sha": blob_sha }],
        }))
        .send().await.map_err(|e| e.to_string())?;
    if !tree_resp.status().is_success() {
        let status = tree_resp.status().as_u16();
        let err: serde_json::Value = tree_resp.json().await.unwrap_or_default();
        let msg = err["message"].as_str().unwrap_or("unknown");
        if status == 404 || status == 403 {
            return Err(format!(
                "Permission denied writing to .github/workflows/ in {}/{}. Your token needs the 'workflow' scope. \
                Go to GitHub → Settings → Developer Settings → Personal Access Tokens and add the 'workflow' scope, \
                then re-authenticate in ZRepoManager.",
                owner, repo
            ));
        }
        return Err(format!("Failed to create tree (HTTP {}): {}", status, msg));
    }
    let tree_json: serde_json::Value = tree_resp.json().await.map_err(|e| e.to_string())?;
    let new_tree_sha = tree_json["sha"].as_str().ok_or("No new tree sha")?.to_string();


    let new_commit_resp = client
        .post(format!("{}/git/commits", base_url))
        .headers(headers.clone())
        .json(&serde_json::json!({
            "message": commit_message,
            "tree": new_tree_sha,
            "parents": [head_sha],
        }))
        .send().await.map_err(|e| e.to_string())?;
    if !new_commit_resp.status().is_success() {
        let err: serde_json::Value = new_commit_resp.json().await.unwrap_or_default();
        return Err(format!("Failed to create commit: {}", err["message"].as_str().unwrap_or("unknown")));
    }
    let new_commit: serde_json::Value = new_commit_resp.json().await.map_err(|e| e.to_string())?;
    let new_commit_sha = new_commit["sha"].as_str().ok_or("No commit sha")?.to_string();
    let new_commit_url = new_commit["html_url"].as_str().unwrap_or("").to_string();


    let patch_resp = client
        .patch(format!("{}/git/refs/heads/{}", base_url, branch))
        .headers(headers.clone())
        .json(&serde_json::json!({ "sha": new_commit_sha, "force": false }))
        .send().await.map_err(|e| e.to_string())?;
    if !patch_resp.status().is_success() {
        let status = patch_resp.status().as_u16();
        let err: serde_json::Value = patch_resp.json().await.unwrap_or_default();
        let msg = err["message"].as_str().unwrap_or("unknown");
        if status == 403 || status == 404 || msg.to_lowercase().contains("workflow") || msg.to_lowercase().contains("scope") {
            return Err(format!(
                "Permission denied pushing to {}/{}. Your token needs the 'workflow' scope. \
                Go to GitHub → Settings → Developer Settings → Personal Access Tokens, add 'workflow' scope, then re-authenticate.",
                owner, repo
            ));
        }
        return Err(format!("Failed to update branch ref (HTTP {}): {}", status, msg));
    }

    Ok(FileUpdateResult { commit_sha: new_commit_sha, commit_url: new_commit_url })
}

#[tauri::command]
pub async fn repo_delete_file(
    owner: String,
    repo: String,
    branch: String,
    path: String,
    commit_message: String,
) -> Result<(), String> {
    let token = github::get_token().ok_or("No active account")?;
    let client = reqwest::Client::new();
    let mut headers = reqwest::header::HeaderMap::new();
    headers.insert("Authorization", format!("Bearer {}", token).parse().unwrap());
    headers.insert("Accept", "application/vnd.github+json".parse().unwrap());
    headers.insert("X-GitHub-Api-Version", "2022-11-28".parse().unwrap());
    headers.insert("User-Agent", "ZRepoManager/0.3.0".parse().unwrap());

    let url = format!("https://api.github.com/repos/{}/{}/contents/{}", owner, repo, path);


    let meta_resp: serde_json::Value = client
        .get(&url)
        .headers(headers.clone())
        .query(&[("ref", branch.as_str())])
        .send().await.map_err(|e| e.to_string())?
        .json().await.map_err(|e| e.to_string())?;

    if let Some(msg) = meta_resp["message"].as_str() {
        return Err(format!("File not found: {}", msg));
    }
    let sha = meta_resp["sha"].as_str().ok_or("No file sha")?.to_string();


    let del_resp = client
        .delete(&url)
        .headers(headers)
        .json(&serde_json::json!({
            "message": commit_message,
            "sha": sha,
            "branch": branch,
        }))
        .send().await.map_err(|e| e.to_string())?;

    if !del_resp.status().is_success() {
        let err: serde_json::Value = del_resp.json().await.unwrap_or_default();
        return Err(format!("Delete failed: {}", err["message"].as_str().unwrap_or("unknown")));
    }

    Ok(())
}
