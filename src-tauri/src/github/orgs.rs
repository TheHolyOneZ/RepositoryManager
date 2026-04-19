use serde::{Deserialize, Serialize};
use crate::models::{Repo, AppError};
use super::{build_client, check_json};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OrgSummary {
    pub login: String,
    pub avatar_url: String,
    pub description: Option<String>,
}

#[derive(Deserialize)]
struct OrgRaw {
    login: String,
    avatar_url: String,
    description: Option<String>,
}

impl From<OrgRaw> for OrgSummary {
    fn from(r: OrgRaw) -> Self {
        OrgSummary { login: r.login, avatar_url: r.avatar_url, description: r.description }
    }
}

pub async fn list_user_orgs(token: &str) -> Result<Vec<OrgSummary>, AppError> {
    let client = build_client(token)?;
    let orgs: Vec<OrgRaw> = check_json(
        client.get("https://api.github.com/user/orgs?per_page=100").send().await?,
    ).await?;
    Ok(orgs.into_iter().map(OrgSummary::from).collect())
}

pub async fn list_org_repos(token: &str, org: &str, per_page: u32, page: u32) -> Result<Vec<Repo>, AppError> {
    let client = build_client(token)?;
    let url = format!(
        "https://api.github.com/orgs/{}/repos?per_page={}&page={}&type=all",
        org, per_page, page
    );
    let raw: Vec<serde_json::Value> = check_json(client.get(&url).send().await?).await?;
    Ok(raw.into_iter().filter_map(|v| serde_json::from_value(v).ok()).collect())
}
