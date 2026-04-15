use crate::models::AppError;
use serde::{Serialize, Deserialize};

#[derive(Serialize, Deserialize)]
pub struct AnalyticsSummary {
    pub total_repos: u32,
    pub public_repos: u32,
    pub private_repos: u32,
    pub active_repos: u32,
    pub dormant_repos: u32,
    pub dead_repos: u32,
    pub empty_repos: u32,
    pub archived_repos: u32,
    pub total_stars: u32,
    pub total_forks: u32,
    pub total_size_kb: u64,
}

#[derive(Serialize, Deserialize)]
pub struct LanguageStat {
    pub language: String,
    pub count: u32,
    pub percentage: f64,
}

#[tauri::command]
pub async fn analytics_get_summary() -> Result<AnalyticsSummary, AppError> {
    Ok(AnalyticsSummary {
        total_repos: 0,
        public_repos: 0,
        private_repos: 0,
        active_repos: 0,
        dormant_repos: 0,
        dead_repos: 0,
        empty_repos: 0,
        archived_repos: 0,
        total_stars: 0,
        total_forks: 0,
        total_size_kb: 0,
    })
}

#[tauri::command]
pub async fn analytics_get_language_distribution() -> Result<Vec<LanguageStat>, AppError> {
    Ok(vec![])
}
