#!/usr/bin/env bash
set -e
SRC=~/ZRepoManager/src-tauri/src

echo "Fixing Rust warnings..."

# models/mod.rs — remove unused chrono import
sed -i '/use chrono::{DateTime, Utc};/d' "$SRC/models/mod.rs"
sed -i '/use chrono::Utc;/d'             "$SRC/models/mod.rs"

# github/mod.rs — remove Serialize, Arc, std::io::Read; fix private struct
sed -i 's/use serde::{Deserialize, Serialize};/use serde::Deserialize;/' "$SRC/github/mod.rs"
sed -i '/^use std::sync::Arc;$/d'         "$SRC/github/mod.rs"
sed -i '/use std::io::Read;/d'            "$SRC/github/mod.rs"
sed -i 's/^struct GitHubUser {/pub(crate) struct GitHubUser {/' "$SRC/github/mod.rs"

# queue_engine/mod.rs — remove AppError; allow dead_code on unused items
sed -i 's/use crate::models::{QueueItem, AppError};/use crate::models::QueueItem;/' "$SRC/queue_engine/mod.rs"
sed -i '/^pub type QueueStore/i #[allow(dead_code)]'       "$SRC/queue_engine/mod.rs"
sed -i '/^pub type QueueStatusStore/i #[allow(dead_code)]' "$SRC/queue_engine/mod.rs"
sed -i '/^pub fn new_queue_store/i #[allow(dead_code)]'    "$SRC/queue_engine/mod.rs"
sed -i '/^pub fn new_status_store/i #[allow(dead_code)]'   "$SRC/queue_engine/mod.rs"
sed -i '/^pub async fn add_items/i #[allow(dead_code)]'    "$SRC/queue_engine/mod.rs"
sed -i '/^pub async fn get_state/i #[allow(dead_code)]'    "$SRC/queue_engine/mod.rs"

# commands/repos.rs — remove ReleaseInfo, Arc; prefix account_id
sed -i 's/, ReleaseInfo//'                           "$SRC/commands/repos.rs"
sed -i 's/use std::sync::{Arc, Mutex};/use std::sync::Mutex;/' "$SRC/commands/repos.rs"
sed -i 's/repos_fetch_all(account_id: String,/repos_fetch_all(_account_id: String,/' "$SRC/commands/repos.rs"

# commands/queue.rs — remove unused queue_engine imports; fix mut
sed -i '/use crate::queue_engine::{QueueStore, QueueStatusStore};/d' "$SRC/commands/queue.rs"
sed -i 's/let mut skipped = 0u32;/let skipped = 0u32;/' "$SRC/commands/queue.rs"

# commands/analytics.rs — remove all unused imports and unused variable
sed -i '/use crate::commands::repos::repos_fetch_all;/d' "$SRC/commands/analytics.rs"
sed -i '/use once_cell::sync::Lazy;/d'                   "$SRC/commands/analytics.rs"
sed -i '/use std::sync::Mutex;/d'                        "$SRC/commands/analytics.rs"
sed -i '/use crate::commands::repos;/d'                  "$SRC/commands/analytics.rs"
sed -i '/let repos: Vec<crate::models::Repo> = Vec::new();/d' "$SRC/commands/analytics.rs"

# commands/logs.rs — prefix unused params
sed -i 's/logs_get(limit: u32, offset: u32)/logs_get(_limit: u32, _offset: u32)/' "$SRC/commands/logs.rs"

echo "All fixes applied."
