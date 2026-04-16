use serde::{Deserialize, Serialize};
use crate::models::AppError;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CollaboratorPermissions {
    pub pull: bool,
    pub triage: bool,
    pub push: bool,
    pub maintain: bool,
    pub admin: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Collaborator {
    pub id: u64,
    pub login: String,
    pub avatar_url: String,
    pub html_url: String,
    pub permissions: CollaboratorPermissions,
    pub role_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PendingInvite {
    pub id: u64,
    pub login: Option<String>,
    pub email: Option<String>,
    pub role: String,
    pub created_at: String,
    pub inviter: String,
}

#[derive(Deserialize)]
struct CollaboratorRaw {
    id: u64, login: String, avatar_url: String, html_url: String,
    permissions: Option<PermissionsRaw>, role_name: Option<String>,
}

#[derive(Deserialize)]
struct PermissionsRaw {
    pull: bool, triage: Option<bool>, push: bool, maintain: Option<bool>, admin: bool,
}

impl From<CollaboratorRaw> for Collaborator {
    fn from(r: CollaboratorRaw) -> Self {
        let p = r.permissions.unwrap_or(PermissionsRaw { pull: true, triage: None, push: false, maintain: None, admin: false });
        Collaborator {
            id: r.id, login: r.login, avatar_url: r.avatar_url, html_url: r.html_url,
            role_name: r.role_name.unwrap_or_else(|| "read".into()),
            permissions: CollaboratorPermissions {
                pull: p.pull, triage: p.triage.unwrap_or(false),
                push: p.push, maintain: p.maintain.unwrap_or(false), admin: p.admin,
            },
        }
    }
}

#[derive(Deserialize)]
struct InviteRaw {
    id: u64, login: Option<String>, email: Option<String>,
    permissions: String, created_at: String, inviter: InviterRaw,
}

#[derive(Deserialize)]
struct InviterRaw { login: String }

impl From<InviteRaw> for PendingInvite {
    fn from(r: InviteRaw) -> Self {
        PendingInvite { id: r.id, login: r.login, email: r.email, role: r.permissions, created_at: r.created_at, inviter: r.inviter.login }
    }
}

pub async fn list_collaborators(token: &str, owner: &str, repo: &str) -> Result<Vec<Collaborator>, AppError> {
    let client = super::build_client(token)?;
    let mut all = Vec::new();
    let mut page = 1u32;
    loop {


        let resp = client
            .get(format!("https://api.github.com/repos/{}/{}/collaborators?per_page=100&page={}", owner, repo, page))
            .send().await?;
        let raw: Vec<CollaboratorRaw> = super::check_json(resp).await?;
        let len = raw.len();
        all.extend(raw.into_iter().map(Collaborator::from));
        if len < 100 { break; }
        page += 1;
    }
    Ok(all)
}

pub async fn add_collaborator(token: &str, owner: &str, repo: &str, username: &str, permission: &str) -> Result<(), AppError> {
    let client = super::build_client(token)?;
    let body = serde_json::json!({ "permission": permission });
    let resp = client
        .put(format!("https://api.github.com/repos/{}/{}/collaborators/{}", owner, repo, username))
        .json(&body).send().await?;
    super::check_ok(resp).await
}

pub async fn remove_collaborator(token: &str, owner: &str, repo: &str, username: &str) -> Result<(), AppError> {
    let client = super::build_client(token)?;
    let resp = client
        .delete(format!("https://api.github.com/repos/{}/{}/collaborators/{}", owner, repo, username))
        .send().await?;
    super::check_ok(resp).await
}

pub async fn list_pending_invitations(token: &str, owner: &str, repo: &str) -> Result<Vec<PendingInvite>, AppError> {
    let client = super::build_client(token)?;
    let resp = client
        .get(format!("https://api.github.com/repos/{}/{}/invitations?per_page=100", owner, repo))
        .send().await?;
    let raw: Vec<InviteRaw> = super::check_json(resp).await?;
    Ok(raw.into_iter().map(PendingInvite::from).collect())
}

pub async fn cancel_invitation(token: &str, owner: &str, repo: &str, invitation_id: u64) -> Result<(), AppError> {
    let client = super::build_client(token)?;
    let resp = client
        .delete(format!("https://api.github.com/repos/{}/{}/invitations/{}", owner, repo, invitation_id))
        .send().await?;
    super::check_ok(resp).await
}
