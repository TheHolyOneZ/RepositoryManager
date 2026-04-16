use serde::{Deserialize, Serialize};
use crate::models::AppError;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Branch {
    pub name: String,
    pub sha: String,
    pub protected: bool,
    pub is_default: bool,
    pub commit_date: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BranchProtection {
    pub require_pull_request_reviews: bool,
    pub required_approving_review_count: u32,
    pub dismiss_stale_reviews: bool,
    pub require_code_owner_reviews: bool,
    pub enforce_admins: bool,
    pub require_status_checks: bool,
}

#[derive(Deserialize)]
struct BranchRaw { name: String, commit: CommitRefRaw, protected: bool }

#[derive(Deserialize)]
struct CommitRefRaw { sha: String }

#[derive(Deserialize)]
struct CommitDetailRaw { commit: CommitBodyRaw }

#[derive(Deserialize)]
struct CommitBodyRaw {
    committer: Option<CommitterRaw>,
    author: Option<CommitterRaw>,
}

#[derive(Deserialize)]
struct CommitterRaw { date: Option<String> }

#[derive(Deserialize)]
struct ProtectionRaw {
    required_pull_request_reviews: Option<PrReviewsRaw>,
    enforce_admins: Option<EnforceAdminsRaw>,
    required_status_checks: Option<serde_json::Value>,
}

#[derive(Deserialize)]
struct PrReviewsRaw {
    required_approving_review_count: Option<u32>,
    dismiss_stale_reviews: Option<bool>,
    require_code_owner_reviews: Option<bool>,
}

#[derive(Deserialize)]
struct EnforceAdminsRaw { enabled: bool }

impl BranchProtection {
    fn from_raw(r: ProtectionRaw) -> Self {
        let pr = r.required_pull_request_reviews;
        BranchProtection {
            require_pull_request_reviews: pr.is_some(),
            required_approving_review_count: pr.as_ref().and_then(|p| p.required_approving_review_count).unwrap_or(1),
            dismiss_stale_reviews: pr.as_ref().and_then(|p| p.dismiss_stale_reviews).unwrap_or(false),
            require_code_owner_reviews: pr.as_ref().and_then(|p| p.require_code_owner_reviews).unwrap_or(false),
            enforce_admins: r.enforce_admins.map(|e| e.enabled).unwrap_or(false),
            require_status_checks: r.required_status_checks.is_some(),
        }
    }
}

pub async fn list_branches(token: &str, owner: &str, repo: &str, default_branch: &str) -> Result<Vec<Branch>, AppError> {
    let client = super::build_client(token)?;
    let mut all: Vec<Branch> = Vec::new();
    let mut page = 1u32;
    loop {
        let raw: Vec<BranchRaw> = client
            .get(format!("https://api.github.com/repos/{}/{}/branches?per_page=100&page={}", owner, repo, page))
            .send().await?.error_for_status()?.json().await?;
        let len = raw.len();
        for b in raw {
            let is_default = b.name == default_branch;
            all.push(Branch { name: b.name, sha: b.commit.sha, protected: b.protected, is_default, commit_date: None });
        }
        if len < 100 { break; }
        page += 1;
    }
    Ok(all)
}

pub async fn get_branch_commit_date(token: &str, owner: &str, repo: &str, sha: &str) -> Result<Option<String>, AppError> {
    let client = super::build_client(token)?;
    let detail: CommitDetailRaw = client
        .get(format!("https://api.github.com/repos/{}/{}/commits/{}", owner, repo, sha))
        .send().await?.error_for_status()?.json().await?;
    Ok(detail.commit.committer.and_then(|c| c.date)
        .or_else(|| detail.commit.author.and_then(|a| a.date)))
}

pub async fn get_branch_protection(token: &str, owner: &str, repo: &str, branch: &str) -> Result<Option<BranchProtection>, AppError> {
    let client = super::build_client(token)?;
    let resp = client
        .get(format!("https://api.github.com/repos/{}/{}/branches/{}/protection", owner, repo, branch))
        .send().await?;

    let s = resp.status().as_u16();
    if s == 404 || s == 403 { return Ok(None); }
    let raw: ProtectionRaw = super::check_json(resp).await?;
    Ok(Some(BranchProtection::from_raw(raw)))
}

pub async fn set_branch_protection(token: &str, owner: &str, repo: &str, branch: &str, p: &BranchProtection) -> Result<(), AppError> {
    let client = super::build_client(token)?;
    let pr_reviews = if p.require_pull_request_reviews {
        serde_json::json!({
            "required_approving_review_count": p.required_approving_review_count,
            "dismiss_stale_reviews": p.dismiss_stale_reviews,
            "require_code_owner_reviews": p.require_code_owner_reviews,
        })
    } else {
        serde_json::Value::Null
    };
    let body = serde_json::json!({
        "required_status_checks": null,
        "enforce_admins": p.enforce_admins,
        "required_pull_request_reviews": pr_reviews,
        "restrictions": null,
    });
    let resp = client
        .put(format!("https://api.github.com/repos/{}/{}/branches/{}/protection", owner, repo, branch))
        .json(&body).send().await?;
    super::check_ok(resp).await
}

pub async fn remove_branch_protection(token: &str, owner: &str, repo: &str, branch: &str) -> Result<(), AppError> {
    let client = super::build_client(token)?;
    let resp = client
        .delete(format!("https://api.github.com/repos/{}/{}/branches/{}/protection", owner, repo, branch))
        .send().await?;
    super::check_ok(resp).await
}

/// Sets the repo's default branch to `new_name`. The branch must already exist.
pub async fn rename_default_branch(token: &str, owner: &str, repo: &str, new_name: &str) -> Result<(), AppError> {
    let client = super::build_client(token)?;
    let body = serde_json::json!({ "default_branch": new_name });
    let resp = client
        .patch(format!("https://api.github.com/repos/{}/{}", owner, repo))
        .json(&body).send().await?;
    super::check_ok(resp).await
}

pub async fn get_branch_sha(token: &str, owner: &str, repo: &str, branch: &str) -> Result<String, AppError> {
    let client = super::build_client(token)?;
    #[derive(serde::Deserialize)]
    struct Ref { object: RefObject }
    #[derive(serde::Deserialize)]
    struct RefObject { sha: String }
    let resp = client
        .get(format!("https://api.github.com/repos/{}/{}/git/ref/heads/{}", owner, repo, branch.replace('/', "%2F")))
        .send().await?;
    let r: Ref = super::check_json(resp).await?;
    Ok(r.object.sha)
}

pub async fn create_branch(token: &str, owner: &str, repo: &str, new_branch: &str, from_branch: &str) -> Result<(), AppError> {
    let sha = get_branch_sha(token, owner, repo, from_branch).await
        .map_err(|e| AppError { code: e.code, message: format!("Source branch '{}' not found: {}", from_branch, e.message) })?;
    let client = super::build_client(token)?;
    let body = serde_json::json!({ "ref": format!("refs/heads/{}", new_branch), "sha": sha });
    let resp = client
        .post(format!("https://api.github.com/repos/{}/{}/git/refs", owner, repo))
        .json(&body).send().await?;
    super::check_ok(resp).await
}
