use serde::{Deserialize, Serialize};
use crate::models::AppError;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowStep {
    pub name: String,
    pub status: String,
    pub conclusion: Option<String>,
    pub number: u64,
    pub started_at: Option<String>,
    pub completed_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowJob {
    pub id: u64,
    pub name: String,
    pub status: String,
    pub conclusion: Option<String>,
    pub started_at: Option<String>,
    pub completed_at: Option<String>,
    pub steps: Vec<WorkflowStep>,
}

#[derive(Deserialize)]
struct JobsPage { jobs: Vec<WorkflowJob> }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Workflow {
    pub id: u64,
    pub name: String,
    pub path: String,
    pub state: String,
    pub html_url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowRun {
    pub id: u64,
    pub name: Option<String>,
    pub workflow_id: u64,
    pub status: String,
    pub conclusion: Option<String>,
    pub html_url: String,
    pub created_at: String,
    pub updated_at: String,
    pub event: String,
    pub head_branch: Option<String>,
    pub head_sha: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowArtifact {
    pub id: u64,
    pub name: String,
    pub size_in_bytes: u64,
    pub expired: bool,
    pub archive_download_url: String,
}

#[derive(Deserialize)]
struct WorkflowsPage { workflows: Vec<WorkflowRaw> }

#[derive(Deserialize)]
struct WorkflowRaw { id: u64, name: String, path: String, state: String, html_url: String }

impl From<WorkflowRaw> for Workflow {
    fn from(r: WorkflowRaw) -> Self {
        Workflow { id: r.id, name: r.name, path: r.path, state: r.state, html_url: r.html_url }
    }
}

#[derive(Deserialize)]
struct RunsPage { workflow_runs: Vec<WorkflowRunRaw> }

#[derive(Deserialize)]
struct WorkflowRunRaw {
    id: u64, name: Option<String>, workflow_id: u64, status: String,
    conclusion: Option<String>, html_url: String, created_at: String,
    updated_at: String, event: String, head_branch: Option<String>, head_sha: String,
}

impl From<WorkflowRunRaw> for WorkflowRun {
    fn from(r: WorkflowRunRaw) -> Self {
        WorkflowRun {
            id: r.id, name: r.name, workflow_id: r.workflow_id, status: r.status,
            conclusion: r.conclusion, html_url: r.html_url, created_at: r.created_at,
            updated_at: r.updated_at, event: r.event, head_branch: r.head_branch, head_sha: r.head_sha,
        }
    }
}

#[derive(Deserialize)]
struct ArtifactsPage { artifacts: Vec<ArtifactRaw> }

#[derive(Deserialize)]
struct ArtifactRaw { id: u64, name: String, size_in_bytes: u64, expired: bool, archive_download_url: String }

impl From<ArtifactRaw> for WorkflowArtifact {
    fn from(r: ArtifactRaw) -> Self {
        WorkflowArtifact { id: r.id, name: r.name, size_in_bytes: r.size_in_bytes, expired: r.expired, archive_download_url: r.archive_download_url }
    }
}

pub async fn list_workflows(token: &str, owner: &str, repo: &str) -> Result<Vec<Workflow>, AppError> {
    let client = super::build_client(token)?;
    let page: WorkflowsPage = client
        .get(format!("https://api.github.com/repos/{}/{}/actions/workflows?per_page=100", owner, repo))
        .send().await?.error_for_status()?.json().await?;
    Ok(page.workflows.into_iter().map(Workflow::from).collect())
}

pub async fn list_workflow_runs(token: &str, owner: &str, repo: &str, per_page: u32) -> Result<Vec<WorkflowRun>, AppError> {
    let client = super::build_client(token)?;
    let page: RunsPage = client
        .get(format!("https://api.github.com/repos/{}/{}/actions/runs?per_page={}", owner, repo, per_page))
        .send().await?.error_for_status()?.json().await?;
    Ok(page.workflow_runs.into_iter().map(WorkflowRun::from).collect())
}

pub async fn enable_workflow(token: &str, owner: &str, repo: &str, workflow_id: u64) -> Result<(), AppError> {
    let client = super::build_client(token)?;
    client
        .put(format!("https://api.github.com/repos/{}/{}/actions/workflows/{}/enable", owner, repo, workflow_id))
        .send().await?.error_for_status()
        .map(|_| ()).map_err(|e| AppError { code: "API_ERROR".into(), message: e.to_string() })
}

pub async fn disable_workflow(token: &str, owner: &str, repo: &str, workflow_id: u64) -> Result<(), AppError> {
    let client = super::build_client(token)?;
    client
        .put(format!("https://api.github.com/repos/{}/{}/actions/workflows/{}/disable", owner, repo, workflow_id))
        .send().await?.error_for_status()
        .map(|_| ()).map_err(|e| AppError { code: "API_ERROR".into(), message: e.to_string() })
}

pub async fn trigger_workflow(token: &str, owner: &str, repo: &str, workflow_id: u64, branch: &str) -> Result<(), AppError> {
    let client = super::build_client(token)?;
    let body = serde_json::json!({ "ref": branch });
    client
        .post(format!("https://api.github.com/repos/{}/{}/actions/workflows/{}/dispatches", owner, repo, workflow_id))
        .json(&body).send().await?.error_for_status()
        .map(|_| ()).map_err(|e| AppError { code: "API_ERROR".into(), message: e.to_string() })
}

pub async fn rerun_failed_jobs(token: &str, owner: &str, repo: &str, run_id: u64) -> Result<(), AppError> {
    let client = super::build_client(token)?;
    client
        .post(format!("https://api.github.com/repos/{}/{}/actions/runs/{}/rerun-failed-jobs", owner, repo, run_id))
        .send().await?.error_for_status()
        .map(|_| ()).map_err(|e| AppError { code: "API_ERROR".into(), message: e.to_string() })
}

pub async fn list_run_artifacts(token: &str, owner: &str, repo: &str, run_id: u64) -> Result<Vec<WorkflowArtifact>, AppError> {
    let client = super::build_client(token)?;
    let page: ArtifactsPage = client
        .get(format!("https://api.github.com/repos/{}/{}/actions/runs/{}/artifacts", owner, repo, run_id))
        .send().await?.error_for_status()?.json().await?;
    Ok(page.artifacts.into_iter().map(WorkflowArtifact::from).collect())
}

pub async fn list_run_jobs(token: &str, owner: &str, repo: &str, run_id: u64) -> Result<Vec<WorkflowJob>, AppError> {
    let client = super::build_client(token)?;
    let page: JobsPage = super::check_json(
        client.get(format!("https://api.github.com/repos/{}/{}/actions/runs/{}/jobs?per_page=100", owner, repo, run_id))
            .send().await?,
    ).await?;
    Ok(page.jobs)
}

pub async fn get_job_logs(token: &str, owner: &str, repo: &str, job_id: u64) -> Result<String, AppError> {
    let client = super::build_client(token)?;
    let resp = client
        .get(format!("https://api.github.com/repos/{}/{}/actions/jobs/{}/logs", owner, repo, job_id))
        .send().await?;
    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        let snippet: String = body.chars().take(200).collect();
        return Err(crate::models::AppError { code: "API_ERROR".into(), message: format!("HTTP {}: {}", status, snippet) });
    }
    Ok(resp.text().await.unwrap_or_default())
}
