use crate::models::{QueueItem, QueueItemInput, QueueState, DryRunResult, AppError};
use std::sync::{Arc};
use once_cell::sync::Lazy;
use tokio::sync::Mutex as AsyncMutex;
use uuid::Uuid;
use chrono::Utc;

static QUEUE: Lazy<Arc<AsyncMutex<Vec<QueueItem>>>> =
    Lazy::new(|| Arc::new(AsyncMutex::new(Vec::new())));
static QUEUE_STATUS: Lazy<Arc<AsyncMutex<String>>> =
    Lazy::new(|| Arc::new(AsyncMutex::new("idle".to_string())));
static QUEUE_MODE: Lazy<Arc<AsyncMutex<String>>> =
    Lazy::new(|| Arc::new(AsyncMutex::new("fast".to_string())));

#[tauri::command]
pub async fn queue_add_items(items: Vec<QueueItemInput>) -> Result<Vec<QueueItem>, AppError> {
    let mut queue = QUEUE.lock().await;
    let now = Utc::now().to_rfc3339();
    let new_items: Vec<QueueItem> = items.into_iter().map(|inp| QueueItem {
        id: Uuid::new_v4().to_string(),
        repo_id: inp.repo_id,
        repo_name: inp.repo_name,
        repo_full_name: inp.repo_full_name,
        action: inp.action,
        payload: inp.payload,
        status: "pending".into(),
        error: None,
        started_at: None,
        completed_at: None,
        created_at: now.clone(),
    }).collect();
    queue.extend(new_items.clone());
    Ok(new_items)
}

#[tauri::command]
pub async fn queue_get_state() -> Result<QueueState, AppError> {
    let items = QUEUE.lock().await.clone();
    let status = QUEUE_STATUS.lock().await.clone();
    let mode = QUEUE_MODE.lock().await.clone();
    Ok(QueueState {
        items,
        status,
        mode,
        grace_seconds_remaining: None,
        current_item_id: None,
    })
}

#[tauri::command]
pub async fn queue_clear(keep_pending: bool) -> Result<(), AppError> {
    let mut q = QUEUE.lock().await;
    if keep_pending {
        q.retain(|i| i.status == "pending");
    } else {
        q.clear();
    }
    Ok(())
}

#[tauri::command]
pub async fn queue_start(
    app: tauri::AppHandle,
    mode: String,
    grace_seconds: u32,
) -> Result<(), AppError> {

    {
        let current = QUEUE_STATUS.lock().await.clone();
        if current == "running" || current == "grace" || current == "paused" {
            return Err(AppError { code: "QUEUE_BUSY".into(), message: "Queue is already running".into() });
        }
    }


    {
        let mut q = QUEUE.lock().await;
        q.retain(|i| i.status == "pending");
    }

    *QUEUE_MODE.lock().await = mode.clone();

    let token = crate::commands::auth::get_active_token()?;

    if grace_seconds > 0 {
        *QUEUE_STATUS.lock().await = "grace".to_string();
        let app_clone = app.clone();
        let queue_clone = Arc::clone(&QUEUE);
        let status_clone = Arc::clone(&QUEUE_STATUS);

        tokio::spawn(async move {
            use tauri::Emitter;
            for remaining in (0..grace_seconds).rev() {
                tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;


                if status_clone.lock().await.as_str() == "idle" {

                    return;
                }

                let _ = app_clone.emit("queue:grace-tick", serde_json::json!({
                    "seconds_remaining": remaining
                }));
            }


            if status_clone.lock().await.as_str() == "idle" {
                return;
            }

            *status_clone.lock().await = "running".to_string();
            execute_queue(app_clone, queue_clone, status_clone, token).await;
        });
    } else {
        *QUEUE_STATUS.lock().await = "running".to_string();
        let app_clone = app.clone();
        let queue_clone = Arc::clone(&QUEUE);
        let status_clone = Arc::clone(&QUEUE_STATUS);

        tokio::spawn(async move {
            execute_queue(app_clone, queue_clone, status_clone, token).await;
        });
    }

    Ok(())
}

async fn execute_queue(
    app: tauri::AppHandle,
    queue: Arc<tokio::sync::Mutex<Vec<QueueItem>>>,
    status: Arc<tokio::sync::Mutex<String>>,
    token: String,
) {
    use tauri::Emitter;
    use crate::github;

    let mut completed = 0u32;
    let mut failed = 0u32;
    let skipped = 0u32;

    loop {

        let current_status = status.lock().await.clone();
        if current_status == "paused" {
            tokio::time::sleep(tokio::time::Duration::from_millis(300)).await;
            continue;
        }
        if current_status == "idle" {
            break;
        }


        let item = {
            let q = queue.lock().await;
            q.iter().find(|i| i.status == "pending").cloned()
        };

        let Some(item) = item else { break };


        {
            let mut q = queue.lock().await;
            if let Some(i) = q.iter_mut().find(|i| i.id == item.id) {
                i.status = "processing".to_string();
                i.started_at = Some(Utc::now().to_rfc3339());
            }
        }
        let _ = app.emit("queue:item-started", serde_json::json!({
            "item_id": item.id,
            "repo_name": item.repo_name,
            "action": item.action
        }));


        let parts: Vec<&str> = item.repo_full_name.splitn(2, '/').collect();
        let (owner, repo_name) = if parts.len() == 2 {
            (parts[0], parts[1])
        } else {
            (&item.repo_name[..], &item.repo_name[..])
        };


        let result: Result<(), AppError> = match item.action.as_str() {
            "delete"     => github::delete_repo(&token, owner, repo_name).await,
            "archive"    => github::archive_repo(&token, owner, repo_name, true).await.map(|_| ()),
            "unarchive"  => github::archive_repo(&token, owner, repo_name, false).await.map(|_| ()),
            "set_private"=> github::set_visibility(&token, owner, repo_name, true).await.map(|_| ()),
            "set_public" => github::set_visibility(&token, owner, repo_name, false).await.map(|_| ()),
            _ => Err(AppError {
                code: "UNKNOWN_ACTION".into(),
                message: format!("Unknown action: {}", item.action),
            }),
        };

        match result {
            Ok(_) => {
                completed += 1;
                {
                    let mut q = queue.lock().await;
                    if let Some(i) = q.iter_mut().find(|i| i.id == item.id) {
                        i.status = "completed".to_string();
                        i.completed_at = Some(Utc::now().to_rfc3339());
                    }
                }
                let _ = app.emit("queue:item-completed", serde_json::json!({
                    "item_id": item.id,
                    "repo_name": item.repo_name
                }));
            }
            Err(e) => {
                failed += 1;
                {
                    let mut q = queue.lock().await;
                    if let Some(i) = q.iter_mut().find(|i| i.id == item.id) {
                        i.status = "failed".to_string();
                        i.error = Some(e.message.clone());
                    }
                }
                let _ = app.emit("queue:item-failed", serde_json::json!({
                    "item_id": item.id,
                    "repo_name": item.repo_name,
                    "error": e.message
                }));
            }
        }


        tokio::time::sleep(tokio::time::Duration::from_millis(400)).await;
    }

    *status.lock().await = "done".to_string();
    let _ = app.emit("queue:finished", serde_json::json!({
        "completed": completed,
        "failed": failed,
        "skipped": skipped
    }));
}


#[tauri::command]
pub async fn queue_pause(app: tauri::AppHandle) -> Result<(), AppError> {
    use tauri::Emitter;
    *QUEUE_STATUS.lock().await = "paused".to_string();
    let _ = app.emit("queue:paused", serde_json::json!({}));
    Ok(())
}

#[tauri::command]
pub async fn queue_resume(app: tauri::AppHandle) -> Result<(), AppError> {
    use tauri::Emitter;
    *QUEUE_STATUS.lock().await = "running".to_string();
    let _ = app.emit("queue:resumed", serde_json::json!({}));
    Ok(())
}

#[tauri::command]
pub async fn queue_cancel(app: tauri::AppHandle) -> Result<(), AppError> {
    use tauri::Emitter;

    *QUEUE_STATUS.lock().await = "idle".to_string();


    let skipped_ids: Vec<String> = {
        let mut q = QUEUE.lock().await;
        q.iter_mut()
            .filter(|i| i.status == "pending" || i.status == "processing")
            .map(|i| {
                i.status = "skipped".to_string();
                i.id.clone()
            })
            .collect()
    };

    for id in skipped_ids {
        let _ = app.emit("queue:item-skipped", serde_json::json!({ "item_id": id }));
    }

    let _ = app.emit("queue:cancelled", serde_json::json!({}));
    Ok(())
}

#[tauri::command]
pub async fn queue_skip_current(app: tauri::AppHandle) -> Result<(), AppError> {
    use tauri::Emitter;
    let skipped_id = {
        let mut q = QUEUE.lock().await;
        q.iter_mut()
            .find(|i| i.status == "processing" || i.status == "pending")
            .map(|i| {
                i.status = "skipped".to_string();
                i.id.clone()
            })
    };

    if let Some(id) = skipped_id {
        let _ = app.emit("queue:item-skipped", serde_json::json!({ "item_id": id }));
    }
    Ok(())
}

#[tauri::command]
pub async fn queue_retry_failed(item_ids: Vec<String>) -> Result<(), AppError> {
    let mut q = QUEUE.lock().await;
    for item in q.iter_mut() {
        if item_ids.contains(&item.id) && (item.status == "failed" || item.status == "skipped") {
            item.status = "pending".to_string();
            item.error = None;
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn queue_dry_run(items: Vec<QueueItemInput>) -> Result<Vec<DryRunResult>, AppError> {
    let results = items.into_iter().map(|inp| DryRunResult {
        repo_id: inp.repo_id,
        repo_name: inp.repo_name.clone(),
        action: inp.action.clone(),
        would_succeed: true,
        preview_message: format!("Would {} repository '{}'", inp.action, inp.repo_name),
    }).collect();
    Ok(results)
}
