use serde::{Deserialize, Serialize};
use std::path::Path;
use tauri::{AppHandle, Emitter};

use crate::github;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    pub size: u64,
    pub is_dir: bool,
    pub children: Vec<FileEntry>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct UploadFileInput {
    pub local_path: String,
    pub repo_path: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct UploadProgress {
    pub file: String,
    pub status: String,
    pub done: usize,
    pub total: usize,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct UploadResult {
    pub commit_sha: String,
    pub commit_url: String,
    pub files_uploaded: usize,
}

fn read_dir_recursive(dir: &Path, base: &Path) -> Vec<FileEntry> {
    let mut entries = Vec::new();
    let Ok(read) = std::fs::read_dir(dir) else { return entries; };
    let mut items: Vec<_> = read.filter_map(|e| e.ok()).collect();
    items.sort_by_key(|e| {
        let is_file = e.file_type().map(|t| t.is_file()).unwrap_or(false);
        (is_file as u8, e.file_name())
    });
    for entry in items {
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();
        let rel_path = path.strip_prefix(base).unwrap_or(&path).to_string_lossy().replace('\\', "/");
        if name.starts_with('.') { continue; }
        let is_dir = path.is_dir();
        let size = if is_dir { 0 } else { std::fs::metadata(&path).map(|m| m.len()).unwrap_or(0) };
        let children = if is_dir { read_dir_recursive(&path, base) } else { vec![] };
        entries.push(FileEntry { name, path: rel_path, size, is_dir, children });
    }
    entries
}

#[tauri::command]
pub async fn read_local_dir(path: String) -> Result<Vec<FileEntry>, String> {
    let dir = std::path::PathBuf::from(&path);
    if !dir.is_dir() {
        return Err(format!("Not a directory: {}", path));
    }
    Ok(read_dir_recursive(&dir, &dir))
}

#[tauri::command]
pub async fn upload_files_to_repo(
    app: AppHandle,
    owner: String,
    repo: String,
    branch: String,
    target_path: String,
    files: Vec<UploadFileInput>,
    commit_message: String,
) -> Result<UploadResult, String> {
    let token = github::get_token().ok_or("No active account — add a GitHub account first")?;
    let client = reqwest::Client::new();
    let total = files.len();

    let emit_progress = |file: &str, status: &str, done: usize| {
        let _ = app.emit("upload://progress", UploadProgress {
            file: file.to_string(),
            status: status.to_string(),
            done,
            total,
        });
    };

    let base_url = format!("https://api.github.com/repos/{}/{}", owner, repo);
    let headers = {
        let mut h = reqwest::header::HeaderMap::new();
        h.insert("Authorization", format!("Bearer {}", token).parse().unwrap());
        h.insert("Accept", "application/vnd.github+json".parse().unwrap());
        h.insert("X-GitHub-Api-Version", "2022-11-28".parse().unwrap());
        h.insert("User-Agent", "ZRepoManager/0.3.0".parse().unwrap());
        h
    };

    let ref_resp = client
        .get(format!("{}/git/ref/heads/{}", base_url, branch))
        .headers(headers.clone())
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !ref_resp.status().is_success() {
        return Err(format!("Branch '{}' not found: {}", branch, ref_resp.status()));
    }
    let ref_json: serde_json::Value = ref_resp.json().await.map_err(|e| e.to_string())?;
    let head_sha = ref_json["object"]["sha"].as_str().ok_or("No HEAD sha")?.to_string();

    let commit_resp = client
        .get(format!("{}/git/commits/{}", base_url, head_sha))
        .headers(headers.clone())
        .send()
        .await
        .map_err(|e| e.to_string())?;
    let commit_json: serde_json::Value = commit_resp.json().await.map_err(|e| e.to_string())?;
    let base_tree_sha = commit_json["tree"]["sha"].as_str().ok_or("No tree sha")?.to_string();

    let mut tree_items: Vec<serde_json::Value> = Vec::new();

    for (i, file) in files.iter().enumerate() {
        emit_progress(&file.repo_path, "uploading", i);

        let content = std::fs::read(&file.local_path)
            .map_err(|e| format!("Cannot read {}: {}", file.local_path, e))?;
        let encoded = base64_encode(&content);

        let blob_resp = client
            .post(format!("{}/git/blobs", base_url))
            .headers(headers.clone())
            .json(&serde_json::json!({ "content": encoded, "encoding": "base64" }))
            .send()
            .await
            .map_err(|e| e.to_string())?;
        if !blob_resp.status().is_success() {
            let err: serde_json::Value = blob_resp.json().await.unwrap_or_default();
            return Err(format!("Blob creation failed for {}: {}", file.repo_path, err["message"].as_str().unwrap_or("unknown")));
        }
        let blob_json: serde_json::Value = blob_resp.json().await.map_err(|e| e.to_string())?;
        let blob_sha = blob_json["sha"].as_str().ok_or("No blob sha")?.to_string();

        let repo_full_path = if target_path.is_empty() || target_path == "/" {
            file.repo_path.clone()
        } else {
            format!("{}/{}", target_path.trim_matches('/'), file.repo_path)
        };

        tree_items.push(serde_json::json!({
            "path": repo_full_path,
            "mode": "100644",
            "type": "blob",
            "sha": blob_sha,
        }));

        emit_progress(&file.repo_path, "done", i + 1);
    }

    let tree_resp = client
        .post(format!("{}/git/trees", base_url))
        .headers(headers.clone())
        .json(&serde_json::json!({ "base_tree": base_tree_sha, "tree": tree_items }))
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !tree_resp.status().is_success() {
        let err: serde_json::Value = tree_resp.json().await.unwrap_or_default();
        return Err(format!("Tree creation failed: {}", err["message"].as_str().unwrap_or("unknown")));
    }
    let tree_json: serde_json::Value = tree_resp.json().await.map_err(|e| e.to_string())?;
    let new_tree_sha = tree_json["sha"].as_str().ok_or("No new tree sha")?.to_string();

    let commit_resp2 = client
        .post(format!("{}/git/commits", base_url))
        .headers(headers.clone())
        .json(&serde_json::json!({
            "message": commit_message,
            "tree": new_tree_sha,
            "parents": [head_sha],
        }))
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !commit_resp2.status().is_success() {
        let err: serde_json::Value = commit_resp2.json().await.unwrap_or_default();
        return Err(format!("Commit creation failed: {}", err["message"].as_str().unwrap_or("unknown")));
    }
    let new_commit: serde_json::Value = commit_resp2.json().await.map_err(|e| e.to_string())?;
    let new_commit_sha = new_commit["sha"].as_str().ok_or("No commit sha")?.to_string();
    let new_commit_url = new_commit["html_url"].as_str().unwrap_or("").to_string();

    let patch_resp = client
        .patch(format!("{}/git/refs/heads/{}", base_url, branch))
        .headers(headers.clone())
        .json(&serde_json::json!({ "sha": new_commit_sha, "force": false }))
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !patch_resp.status().is_success() {
        let err: serde_json::Value = patch_resp.json().await.unwrap_or_default();
        return Err(format!("Ref update failed: {}", err["message"].as_str().unwrap_or("unknown")));
    }

    Ok(UploadResult {
        commit_sha: new_commit_sha,
        commit_url: new_commit_url,
        files_uploaded: total,
    })
}

fn base64_encode(data: &[u8]) -> String {
    const CHARS: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = String::with_capacity((data.len() + 2) / 3 * 4);
    for chunk in data.chunks(3) {
        let b0 = chunk[0] as usize;
        let b1 = if chunk.len() > 1 { chunk[1] as usize } else { 0 };
        let b2 = if chunk.len() > 2 { chunk[2] as usize } else { 0 };
        out.push(CHARS[b0 >> 2] as char);
        out.push(CHARS[((b0 & 3) << 4) | (b1 >> 4)] as char);
        if chunk.len() > 1 { out.push(CHARS[((b1 & 0xf) << 2) | (b2 >> 6)] as char); } else { out.push('='); }
        if chunk.len() > 2 { out.push(CHARS[b2 & 0x3f] as char); } else { out.push('='); }
    }
    out
}
