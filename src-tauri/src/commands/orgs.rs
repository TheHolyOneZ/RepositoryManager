use crate::models::AppError;
use crate::github;
use crate::commands::auth::get_active_token;

#[tauri::command]
pub async fn repos_fetch_org(org_login: String, per_page: u32, page: u32) -> Result<Vec<crate::models::Repo>, AppError> {
    let token = get_active_token()?;
    github::orgs::list_org_repos(&token, &org_login, per_page, page).await
}
