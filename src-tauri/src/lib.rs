mod models;
mod github;
mod health;
mod queue_engine;
mod suggestions;
mod commands;

use commands::{auth::*, repos::*, queue::*, actions::*, analytics::*, logs::*, shell::*, upload::*, files::*, actions_gh::*, webhooks::*, collaborators::*, branches::*};
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
