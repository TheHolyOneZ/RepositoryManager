mod models;
mod github;
mod health;
mod queue_engine;
mod suggestions;
mod commands;

use commands::{auth::*, repos::*, queue::*, actions::*, analytics::*, logs::*, shell::*, upload::*, files::*, actions_gh::*, webhooks::*, collaborators::*, branches::*, prs::*, issues::*, releases::*, orgs::*, environments::*, dependabot::*, deps_scanner::*};
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {

            let cred_path = app
                .path()
                .app_data_dir()
                .expect("failed to resolve app data directory")
                .join("credentials.json");
            commands::auth::init_session(cred_path);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![

            github_auth_start,
            github_auth_callback,
            github_device_flow_start,
            github_device_flow_poll,
            github_add_pat,
            github_list_accounts,
            github_get_session,
            github_switch_account,
            github_logout,

            repos_fetch_all,
            repos_get_suggestions,
            repos_apply_tag,
            repos_remove_tag,
            repos_export,
            export_readmes,
            fetch_releases,
            export_release_assets,
            export_repo_metadata,
            repo_get_languages,

            queue_add_items,
            queue_get_state,
            queue_start,
            queue_pause,
            queue_resume,
            queue_cancel,
            queue_skip_current,
            queue_retry_failed,
            queue_dry_run,
            queue_clear,

            action_delete_repo,
            action_archive_repo,
            action_set_visibility,
            action_rename_repo,
            action_update_topics,
            action_transfer_repo,

            analytics_get_summary,
            analytics_get_language_distribution,

            logs_get,

            open_url_external,

            read_local_dir,
            upload_files_to_repo,

            repo_get_tree,
            repo_apply_file_ops,
            repo_get_file_content,
            repo_update_file_content,
            open_editor_window,
            repo_get_artifact_download_url,
            repo_create_workflow,
            read_text_file,

            gh_list_workflows,
            gh_list_workflow_runs,
            gh_enable_workflow,
            gh_disable_workflow,
            gh_trigger_workflow,
            gh_rerun_failed_jobs,
            gh_list_run_artifacts,

            gh_list_webhooks,
            gh_create_webhook,
            gh_update_webhook,
            gh_delete_webhook,
            gh_ping_webhook,
            gh_list_webhook_deliveries,
            gh_redeliver_webhook,

            gh_list_collaborators,
            gh_add_collaborator,
            gh_remove_collaborator,
            gh_list_pending_invitations,
            gh_cancel_invitation,

            gh_list_branches,
            gh_get_branch_commit_date,
            gh_get_branch_protection,
            gh_set_branch_protection,
            gh_remove_branch_protection,
            gh_rename_default_branch,
            gh_create_branch,
            suggestions_refresh_from_branches,

            save_text_file,
            repo_delete_file,

            github_list_orgs,
            repos_fetch_org,

            gh_list_releases,
            gh_get_latest_release,
            gh_create_release,
            gh_update_release,
            gh_delete_release,
            gh_upload_release_asset,
            gh_delete_release_asset,

            gh_list_issues,
            gh_create_issue,
            gh_update_issue,
            gh_list_issue_comments,
            gh_create_issue_comment,
            gh_list_labels,
            gh_create_label,
            gh_list_milestones,
            gh_add_labels_to_issue,
            gh_set_issue_milestone,

            gh_list_pull_requests,
            gh_create_pull_request,
            gh_update_pull_request,
            gh_merge_pull_request,
            gh_list_pr_files,
            gh_list_pr_reviews,
            gh_create_pr_review,
            gh_list_pr_comments,
            gh_create_pr_comment,
            gh_request_reviewers,
            gh_list_repo_branches_simple,
            gh_list_repo_collaborators_simple,
            gh_convert_pr_to_ready,
            gh_add_pr_assignees,
            gh_remove_pr_assignees,
            gh_remove_pr_label,
            gh_set_pr_milestone,

            gh_list_run_jobs,
            gh_get_job_logs,

            action_star_repo,
            action_unstar_repo,

            gh_list_environments,
            gh_create_environment,
            gh_delete_environment,
            gh_list_repo_secrets,
            gh_list_env_secrets,
            gh_get_repo_public_key,
            gh_create_repo_secret,
            gh_delete_repo_secret,
            gh_create_env_secret,
            gh_delete_env_secret,
            gh_bulk_set_secret,

            gh_list_dependabot_alerts,
            gh_get_dependabot_enabled,
            gh_enable_dependabot,
            gh_disable_dependabot,
            gh_enable_security_fixes,
            gh_disable_security_fixes,
            gh_portfolio_security_summary,

            gh_scan_repo_deps,
            gh_scan_multiple_repos_deps,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
