import { invoke as tauriInvoke } from "@tauri-apps/api/core";
import { assertTauriApp } from "./runtime";
import type { Repo, RepoTag } from "../../types/repo";
import type { QueueItem, QueueItemInput, QueueState, DryRunResult, ExecutionMode, OperationLog, RepoExportInput, ExportBatchResult, ReleaseResult } from "../../types/queue";
import type { AnalyticsSummary, LanguageStat, GrowthPoint, DecayPoint } from "../../types/analytics";
import type { Account, AuthToken, CleanupSuggestion, DeviceFlowStart, GitHubSession } from "./types";
import type { Workflow, WorkflowRun, WorkflowArtifact, Webhook, WebhookDelivery, Collaborator, PendingInvite, Branch, BranchProtection } from "../../types/governance";

function invoke<T>(cmd: string, args: Record<string, unknown> = {}): Promise<T> {
  assertTauriApp();
  return tauriInvoke(cmd, args);
}


export const githubAuthStart = (): Promise<string> =>
  invoke("github_auth_start");

export const githubAuthCallback = (code: string, state: string): Promise<AuthToken> =>
  invoke("github_auth_callback", { code, state });

export const githubDeviceFlowStart = (clientId: string): Promise<DeviceFlowStart> =>
  invoke("github_device_flow_start", { clientId });

export const githubDeviceFlowPoll = (
  clientId: string,
  deviceCode: string,
  intervalSecs: number,
): Promise<Account> =>
  invoke("github_device_flow_poll", { clientId, deviceCode, intervalSecs });

export const githubAddPat = (token: string, label: string): Promise<Account> =>
  invoke("github_add_pat", { token, label });

export const githubListAccounts = (): Promise<Account[]> =>
  invoke("github_list_accounts");

export const githubGetSession = (): Promise<GitHubSession> =>
  invoke("github_get_session");

export const githubSwitchAccount = (accountId: string): Promise<void> =>
  invoke("github_switch_account", { accountId });

export const githubLogout = (accountId: string): Promise<void> =>
  invoke("github_logout", { accountId });


export const reposFetchAll = (accountId: string, forceRefresh = false): Promise<Repo[]> =>
  invoke("repos_fetch_all", { accountId, forceRefresh });

export const reposGetSuggestions = (): Promise<CleanupSuggestion[]> =>
  invoke("repos_get_suggestions");

export const reposApplyTag = (repoIds: string[], tag: RepoTag): Promise<void> =>
  invoke("repos_apply_tag", { repoIds, tag });

export const reposRemoveTag = (repoIds: string[], tag: RepoTag): Promise<void> =>
  invoke("repos_remove_tag", { repoIds, tag });

export const reposExport = (repoIds: string[], format: "csv" | "json"): Promise<string> =>
  invoke("repos_export", { repoIds, format });

export interface RepoLanguageStat { language: string; bytes: number; percentage: number; }
export const repoGetLanguages = (fullName: string): Promise<RepoLanguageStat[]> =>
  invoke("repo_get_languages", { fullName });


export const queueAddItems = (items: QueueItemInput[]): Promise<QueueItem[]> =>
  invoke("queue_add_items", { items });

export const queueGetState = (): Promise<QueueState> =>
  invoke("queue_get_state");

export const queueStart = (mode: ExecutionMode, graceSeconds: number): Promise<void> =>
  invoke("queue_start", { mode, graceSeconds });

export const queuePause = (): Promise<void> =>
  invoke("queue_pause");

export const queueResume = (): Promise<void> =>
  invoke("queue_resume");

export const queueCancel = (): Promise<void> =>
  invoke("queue_cancel");

export const queueSkipCurrent = (): Promise<void> =>
  invoke("queue_skip_current");

export const queueRetryFailed = (itemIds: string[]): Promise<void> =>
  invoke("queue_retry_failed", { itemIds });

export const queueDryRun = (items: QueueItemInput[]): Promise<DryRunResult[]> =>
  invoke("queue_dry_run", { items });


export const actionDeleteRepo = (owner: string, repo: string): Promise<void> =>
  invoke("action_delete_repo", { owner, repo });

export const actionArchiveRepo = (owner: string, repo: string, archive: boolean): Promise<Repo> =>
  invoke("action_archive_repo", { owner, repo, archive });

export const actionSetVisibility = (owner: string, repo: string, isPrivate: boolean): Promise<Repo> =>
  invoke("action_set_visibility", { owner, repo, private: isPrivate });

export const actionRenameRepo = (owner: string, repo: string, newName: string): Promise<Repo> =>
  invoke("action_rename_repo", { owner, repo, newName });

export const actionUpdateTopics = (owner: string, repo: string, topics: string[]): Promise<void> =>
  invoke("action_update_topics", { owner, repo, topics });

export const actionTransferRepo = (owner: string, repo: string, newOwner: string): Promise<void> =>
  invoke("action_transfer_repo", { owner, repo, newOwner });


export const exportReadmes = (items: RepoExportInput[], destPath: string): Promise<ExportBatchResult> =>
  invoke("export_readmes", { items, destPath });

export const fetchReleases = (items: RepoExportInput[]): Promise<ReleaseResult[]> =>
  invoke("fetch_releases", { items });

export const exportReleaseAssets = (items: RepoExportInput[], destPath: string): Promise<ExportBatchResult> =>
  invoke("export_release_assets", { items, destPath });

export const exportRepoMetadata = (items: RepoExportInput[], destPath: string): Promise<ExportBatchResult> =>
  invoke("export_repo_metadata", { items, destPath });


export const analyticsGetSummary = (): Promise<AnalyticsSummary> =>
  invoke("analytics_get_summary");

export const analyticsGetLanguageDistribution = (): Promise<LanguageStat[]> =>
  invoke("analytics_get_language_distribution");

export const analyticsGetGrowthTimeline = (months: number): Promise<GrowthPoint[]> =>
  invoke("analytics_get_growth_timeline", { months });

export const analyticsGetDecayCurve = (): Promise<DecayPoint[]> =>
  invoke("analytics_get_decay_curve");


export const logsGet = (limit: number, offset: number): Promise<OperationLog[]> =>
  invoke("logs_get", { limit, offset });

export const openUrlExternal = (url: string): Promise<void> =>
  invoke("open_url_external", { url });

export interface FileEntry {
  name: string;
  path: string;
  size: number;
  is_dir: boolean;
  children: FileEntry[];
}

export interface UploadFileInput {
  local_path: string;
  repo_path: string;
}

export interface UploadResult {
  commit_sha: string;
  commit_url: string;
  files_uploaded: number;
}

export const readLocalDir = (path: string): Promise<FileEntry[]> =>
  invoke("read_local_dir", { path });

export const uploadFilesToRepo = (
  owner: string,
  repo: string,
  branch: string,
  targetPath: string,
  files: UploadFileInput[],
  commitMessage: string,
): Promise<UploadResult> =>
  invoke("upload_files_to_repo", { owner, repo, branch, targetPath, files, commitMessage });

export interface RepoFile {
  path: string;
  sha: string;
  size: number;
}

export type FileOp =
  | { op: "delete"; path: string }
  | { op: "rename"; old_path: string; new_path: string };

export interface FileOpsResult {
  commit_sha: string;
  commit_url: string;
  ops_applied: number;
}

export const repoGetTree = (owner: string, repo: string, branch: string): Promise<RepoFile[]> =>
  invoke("repo_get_tree", { owner, repo, branch });

export const repoApplyFileOps = (
  owner: string,
  repo: string,
  branch: string,
  ops: FileOp[],
  commitMessage: string,
): Promise<FileOpsResult> =>
  invoke("repo_apply_file_ops", { owner, repo, branch, ops, commitMessage });

export interface FileContent {
  content: string;
  sha: string;
}

export interface FileUpdateResult {
  commit_sha: string;
  commit_url: string;
}

export const repoGetFileContent = (
  owner: string,
  repo: string,
  path: string,
  refName: string,
): Promise<FileContent> =>
  invoke("repo_get_file_content", { owner, repo, path, refName });

export const repoUpdateFileContent = (
  owner: string,
  repo: string,
  branch: string,
  path: string,
  content: string,
  sha: string,
  commitMessage: string,
): Promise<FileUpdateResult> =>
  invoke("repo_update_file_content", { owner, repo, branch, path, content, sha, commitMessage });

export const openEditorWindow = (
  owner: string,
  repo: string,
  branch: string,
): Promise<void> =>
  invoke("open_editor_window", { owner, repo, branch });

export const repoGetArtifactDownloadUrl = (
  owner: string,
  repo: string,
  artifactId: number,
): Promise<string> =>
  invoke("repo_get_artifact_download_url", { owner, repo, artifactId });

export const readTextFile = (path: string): Promise<string> =>
  invoke("read_text_file", { path });

export const repoCreateWorkflow = (
  owner: string,
  repo: string,
  branch: string,
  filename: string,
  content: string,
  commitMessage: string,
): Promise<FileUpdateResult> =>
  invoke("repo_create_workflow", { owner, repo, branch, filename, content, commitMessage });


export const ghListWorkflows = (owner: string, repo: string): Promise<Workflow[]> =>
  invoke("gh_list_workflows", { owner, repo });

export const ghListWorkflowRuns = (owner: string, repo: string, perPage: number): Promise<WorkflowRun[]> =>
  invoke("gh_list_workflow_runs", { owner, repo, perPage });

export const ghEnableWorkflow = (owner: string, repo: string, workflowId: number): Promise<void> =>
  invoke("gh_enable_workflow", { owner, repo, workflowId });

export const ghDisableWorkflow = (owner: string, repo: string, workflowId: number): Promise<void> =>
  invoke("gh_disable_workflow", { owner, repo, workflowId });

export const ghTriggerWorkflow = (owner: string, repo: string, workflowId: number, branch: string): Promise<void> =>
  invoke("gh_trigger_workflow", { owner, repo, workflowId, branch });

export const ghRerunFailedJobs = (owner: string, repo: string, runId: number): Promise<void> =>
  invoke("gh_rerun_failed_jobs", { owner, repo, runId });

export const ghListRunArtifacts = (owner: string, repo: string, runId: number): Promise<WorkflowArtifact[]> =>
  invoke("gh_list_run_artifacts", { owner, repo, runId });


export const ghListWebhooks = (owner: string, repo: string): Promise<Webhook[]> =>
  invoke("gh_list_webhooks", { owner, repo });

export const ghCreateWebhook = (
  owner: string, repo: string, url: string,
  events: string[], secret: string | null, contentType: string,
): Promise<Webhook> =>
  invoke("gh_create_webhook", { owner, repo, url, events, secret, contentType });

export const ghUpdateWebhook = (
  owner: string, repo: string, hookId: number,
  url: string, events: string[], secret: string | null, contentType: string, active: boolean,
): Promise<import("../../types/governance").Webhook> =>
  invoke("gh_update_webhook", { owner, repo, hookId, url, events, secret, contentType, active });

export const ghDeleteWebhook = (owner: string, repo: string, hookId: number): Promise<void> =>
  invoke("gh_delete_webhook", { owner, repo, hookId });

export const ghPingWebhook = (owner: string, repo: string, hookId: number): Promise<void> =>
  invoke("gh_ping_webhook", { owner, repo, hookId });

export const ghListWebhookDeliveries = (owner: string, repo: string, hookId: number): Promise<WebhookDelivery[]> =>
  invoke("gh_list_webhook_deliveries", { owner, repo, hookId });

export const ghRedeliverWebhook = (owner: string, repo: string, hookId: number, deliveryId: number): Promise<void> =>
  invoke("gh_redeliver_webhook", { owner, repo, hookId, deliveryId });


export const ghListCollaborators = (owner: string, repo: string): Promise<Collaborator[]> =>
  invoke("gh_list_collaborators", { owner, repo });

export const ghAddCollaborator = (owner: string, repo: string, username: string, permission: string): Promise<void> =>
  invoke("gh_add_collaborator", { owner, repo, username, permission });

export const ghRemoveCollaborator = (owner: string, repo: string, username: string): Promise<void> =>
  invoke("gh_remove_collaborator", { owner, repo, username });

export const ghListPendingInvitations = (owner: string, repo: string): Promise<PendingInvite[]> =>
  invoke("gh_list_pending_invitations", { owner, repo });

export const ghCancelInvitation = (owner: string, repo: string, invitationId: number): Promise<void> =>
  invoke("gh_cancel_invitation", { owner, repo, invitationId });


export const ghListBranches = (owner: string, repo: string, defaultBranch: string): Promise<Branch[]> =>
  invoke("gh_list_branches", { owner, repo, defaultBranch });

export const ghGetBranchCommitDate = (owner: string, repo: string, sha: string): Promise<string | null> =>
  invoke("gh_get_branch_commit_date", { owner, repo, sha });

export const ghGetBranchProtection = (owner: string, repo: string, branch: string): Promise<BranchProtection | null> =>
  invoke("gh_get_branch_protection", { owner, repo, branch });

export const ghSetBranchProtection = (owner: string, repo: string, branch: string, protection: BranchProtection): Promise<void> =>
  invoke("gh_set_branch_protection", { owner, repo, branch, protection });

export const ghRemoveBranchProtection = (owner: string, repo: string, branch: string): Promise<void> =>
  invoke("gh_remove_branch_protection", { owner, repo, branch });

export const ghRenameDefaultBranch = (owner: string, repo: string, newName: string): Promise<void> =>
  invoke("gh_rename_default_branch", { owner, repo, newName });

export const ghCreateBranch = (owner: string, repo: string, newBranch: string, fromBranch: string): Promise<void> =>
  invoke("gh_create_branch", { owner, repo, newBranch, fromBranch });

export const suggestionsRefreshFromBranches = (staleRepoIds: string[], staleRepoNames: string[]): Promise<void> =>
  invoke("suggestions_refresh_from_branches", { staleRepoIds, staleRepoNames });

export const saveTextFile = (path: string, content: string): Promise<void> =>
  invoke("save_text_file", { path, content });

export const repoDeleteFile = (
  owner: string,
  repo: string,
  branch: string,
  path: string,
  commitMessage: string,
): Promise<void> =>
  invoke("repo_delete_file", { owner, repo, branch, path, commitMessage });
