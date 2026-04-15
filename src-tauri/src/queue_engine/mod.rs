use std::sync::Arc;
use tokio::sync::Mutex;
use crate::models::QueueItem;
use chrono::Utc;
use uuid::Uuid;

#[allow(dead_code)] pub type QueueStore = Arc<Mutex<Vec<QueueItem>>>;
#[allow(dead_code)] pub type QueueStatusStore = Arc<Mutex<String>>;

#[allow(dead_code)]
pub fn new_queue_store() -> QueueStore {
    Arc::new(Mutex::new(Vec::new()))
}

#[allow(dead_code)]
pub fn new_status_store() -> QueueStatusStore {
    Arc::new(Mutex::new("idle".to_string()))
}

#[allow(dead_code)]
pub async fn add_items(store: &QueueStore, items: Vec<crate::models::QueueItemInput>) -> Vec<QueueItem> {
    let mut queue = store.lock().await;
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
    new_items
}

#[allow(dead_code)]
pub async fn get_state(store: &QueueStore, status: &QueueStatusStore) -> crate::models::QueueState {
    let items = store.lock().await.clone();
    let status_val = status.lock().await.clone();
    crate::models::QueueState {
        items,
        status: status_val,
        mode: "fast".into(),
        grace_seconds_remaining: None,
        current_item_id: None,
    }
}
