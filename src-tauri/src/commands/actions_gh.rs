use crate::models::AppError;
use crate::github;
use crate::commands::auth::get_active_token;
use crate::github::actions::{Workflow, WorkflowRun, WorkflowArtifact};

#[tauri::command]
pub async fn gh_list_workflows(owner: String, repo: String) -> Result<Vec<Workflow>, AppError> {
    let token = get_active_token()?;
    github::actions::list_workflows(&token, &owner, &repo).await
}

#[tauri::command]
pub async fn gh_list_workflow_runs(owner: String, repo: String, per_page: u32) -> Result<Vec<WorkflowRun>, AppError> {
    let token = get_active_token()?;
    github::actions::list_workflow_runs(&token, &owner, &repo, per_page).await
}

#[tauri::command]
pub async fn gh_enable_workflow(owner: String, repo: String, workflow_id: u64) -> Result<(), AppError> {
    let token = get_active_token()?;
    github::actions::enable_workflow(&token, &owner, &repo, workflow_id).await
}

#[tauri::command]
pub async fn gh_disable_workflow(owner: String, repo: String, workflow_id: u64) -> Result<(), AppError> {
    let token = get_active_token()?;
    github::actions::disable_workflow(&token, &owner, &repo, workflow_id).await
}

#[tauri::command]
pub async fn gh_trigger_workflow(owner: String, repo: String, workflow_id: u64, branch: String) -> Result<(), AppError> {
    let token = get_active_token()?;
    github::actions::trigger_workflow(&token, &owner, &repo, workflow_id, &branch).await
}

#[tauri::command]
pub async fn gh_rerun_failed_jobs(owner: String, repo: String, run_id: u64) -> Result<(), AppError> {
    let token = get_active_token()?;
    github::actions::rerun_failed_jobs(&token, &owner, &repo, run_id).await
}

#[tauri::command]
pub async fn gh_list_run_artifacts(owner: String, repo: String, run_id: u64) -> Result<Vec<WorkflowArtifact>, AppError> {
    let token = get_active_token()?;
    github::actions::list_run_artifacts(&token, &owner, &repo, run_id).await
}
