use serde::{Deserialize, Serialize};
use crate::models::AppError;
use super::{build_client, check_json, check_ok};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DependabotAlert {
    pub number: u64,
    pub state: String,
    pub severity: String,
    pub package_name: String,
    pub package_ecosystem: String,
    pub ghsa_id: String,
    pub cve_id: Option<String>,
    pub summary: String,
    pub html_url: String,
    pub created_at: String,
    pub updated_at: String,
    pub auto_dismissed_at: Option<String>,
}

#[derive(Deserialize)]
struct AlertRaw {
    number: u64,
    state: String,
    dependency: DepRaw,
    security_advisory: AdvisoryRaw,
    security_vulnerability: VulnRaw,
    html_url: String,
    created_at: String,
    updated_at: String,
    auto_dismissed_at: Option<String>,
}

#[derive(Deserialize)]
struct DepRaw { package: PkgRaw }

#[derive(Deserialize)]
struct PkgRaw { name: String, ecosystem: String }

#[derive(Deserialize)]
struct AdvisoryRaw { ghsa_id: String, cve_id: Option<String>, summary: String }

#[derive(Deserialize)]
struct VulnRaw { severity: String }

impl From<AlertRaw> for DependabotAlert {
    fn from(r: AlertRaw) -> Self {
        DependabotAlert {
            number: r.number,
            state: r.state,
            severity: r.security_vulnerability.severity,
            package_name: r.dependency.package.name,
            package_ecosystem: r.dependency.package.ecosystem,
            ghsa_id: r.security_advisory.ghsa_id,
            cve_id: r.security_advisory.cve_id,
            summary: r.security_advisory.summary,
            html_url: r.html_url,
            created_at: r.created_at,
            updated_at: r.updated_at,
            auto_dismissed_at: r.auto_dismissed_at,
        }
    }
}

pub async fn list_alerts(token: &str, owner: &str, repo: &str, state: &str, severity: Option<&str>) -> Result<Vec<DependabotAlert>, AppError> {
    let client = build_client(token)?;
    let mut url = format!("https://api.github.com/repos/{}/{}/dependabot/alerts?per_page=100&state={}", owner, repo, state);
    if let Some(sev) = severity { url.push_str(&format!("&severity={}", sev)); }
    let raw: Vec<AlertRaw> = check_json(client.get(&url).send().await?).await?;
    Ok(raw.into_iter().map(DependabotAlert::from).collect())
}

pub async fn get_alerts_enabled(token: &str, owner: &str, repo: &str) -> Result<bool, AppError> {
    let client = build_client(token)?;
    let resp = client.get(&format!("https://api.github.com/repos/{}/{}/vulnerability-alerts", owner, repo)).send().await?;
    match resp.status().as_u16() {
        204 => Ok(true),
        404 => Ok(false),
        code => Err(AppError { code: "API_ERROR".into(), message: format!("Unexpected status: {}", code) }),
    }
}

pub async fn enable_alerts(token: &str, owner: &str, repo: &str) -> Result<(), AppError> {
    let client = build_client(token)?;
    check_ok(client.put(&format!("https://api.github.com/repos/{}/{}/vulnerability-alerts", owner, repo)).send().await?).await
}

pub async fn disable_alerts(token: &str, owner: &str, repo: &str) -> Result<(), AppError> {
    let client = build_client(token)?;
    check_ok(client.delete(&format!("https://api.github.com/repos/{}/{}/vulnerability-alerts", owner, repo)).send().await?).await
}

pub async fn enable_security_fixes(token: &str, owner: &str, repo: &str) -> Result<(), AppError> {
    let client = build_client(token)?;
    check_ok(client.put(&format!("https://api.github.com/repos/{}/{}/automated-security-fixes", owner, repo)).send().await?).await
}

pub async fn disable_security_fixes(token: &str, owner: &str, repo: &str) -> Result<(), AppError> {
    let client = build_client(token)?;
    check_ok(client.delete(&format!("https://api.github.com/repos/{}/{}/automated-security-fixes", owner, repo)).send().await?).await
}
