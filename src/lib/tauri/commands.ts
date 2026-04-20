import { invoke as tauriInvoke } from "@tauri-apps/api/core";
import { assertTauriApp } from "./runtime";
import type { Repo, RepoTag } from "../../types/repo";
import type { QueueItem, QueueItemInput, QueueState, DryRunResult, ExecutionMode, OperationLog, RepoExportInput, ExportBatchResult, ReleaseResult } from "../../types/queue";
import type { AnalyticsSummary, LanguageStat, GrowthPoint, DecayPoint } from "../../types/analytics";
import type { Account, AuthToken, CleanupSuggestion, DeviceFlowStart, GitHubSession } from "./types";
import type { Workflow, WorkflowRun, WorkflowArtifact, Webhook, WebhookDelivery, Collaborator, PendingInvite, Branch, BranchProtection, PullRequest, PrFile, PrReview, PrComment, Issue, IssueComment, IssueLabel, Milestone, Release, ReleaseAssetFull, OrgSummary, WorkflowJob, Environment, RepoSecret, RepoPublicKey, BulkSecretResult, DependabotAlert, RepoAlertSummary, RepoDependencies } from "../../types/governance";

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

export const queueClear = (keepPending = false): Promise<void> =>
  invoke("queue_clear", { keepPending });


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


export const githubListOrgs = (): Promise<OrgSummary[]> =>
  invoke("github_list_orgs");

export const reposFetchOrg = (orgLogin: string, perPage = 100, page = 1): Promise<Repo[]> =>
  invoke("repos_fetch_org", { orgLogin, perPage, page });


export const ghListReleases = (owner: string, repo: string): Promise<Release[]> =>
  invoke("gh_list_releases", { owner, repo });

export const ghGetLatestRelease = (owner: string, repo: string): Promise<Release | null> =>
  invoke("gh_get_latest_release", { owner, repo });

export const ghCreateRelease = (
  owner: string, repo: string,
  tagName: string, name: string, body: string,
  draft: boolean, prerelease: boolean, targetCommitish: string,
): Promise<Release> =>
  invoke("gh_create_release", { owner, repo, tagName, name, body, draft, prerelease, targetCommitish });

export const ghUpdateRelease = (
  owner: string, repo: string, releaseId: number,
  tagName: string, name: string, body: string, draft: boolean, prerelease: boolean,
): Promise<Release> =>
  invoke("gh_update_release", { owner, repo, releaseId, tagName, name, body, draft, prerelease });

export const ghDeleteRelease = (owner: string, repo: string, releaseId: number): Promise<void> =>
  invoke("gh_delete_release", { owner, repo, releaseId });

export const ghUploadReleaseAsset = (
  owner: string, repo: string, releaseId: number,
  localPath: string, assetName: string,
): Promise<ReleaseAssetFull> =>
  invoke("gh_upload_release_asset", { owner, repo, releaseId, localPath, assetName });

export const ghDeleteReleaseAsset = (owner: string, repo: string, assetId: number): Promise<void> =>
  invoke("gh_delete_release_asset", { owner, repo, assetId });


export const ghListIssues = (owner: string, repo: string, state: string, perPage: number): Promise<Issue[]> =>
  invoke("gh_list_issues", { owner, repo, state, perPage });

export const ghCreateIssue = (
  owner: string, repo: string,
  title: string, body: string, labels: string[], assignees: string[], milestone: number | null,
): Promise<Issue> =>
  invoke("gh_create_issue", { owner, repo, title, body, labels, assignees, milestone });

export const ghUpdateIssue = (
  owner: string, repo: string, number: number,
  state?: string, title?: string, body?: string,
): Promise<Issue> =>
  invoke("gh_update_issue", { owner, repo, number, state: state ?? null, title: title ?? null, body: body ?? null });

export const ghListIssueComments = (owner: string, repo: string, number: number): Promise<IssueComment[]> =>
  invoke("gh_list_issue_comments", { owner, repo, number });

export const ghCreateIssueComment = (owner: string, repo: string, number: number, body: string): Promise<IssueComment> =>
  invoke("gh_create_issue_comment", { owner, repo, number, body });

export const ghListLabels = (owner: string, repo: string): Promise<IssueLabel[]> =>
  invoke("gh_list_labels", { owner, repo });

export const ghCreateLabel = (owner: string, repo: string, name: string, color: string, description: string): Promise<IssueLabel> =>
  invoke("gh_create_label", { owner, repo, name, color, description });

export const ghListMilestones = (owner: string, repo: string): Promise<Milestone[]> =>
  invoke("gh_list_milestones", { owner, repo });

export const ghAddLabelsToIssue = (owner: string, repo: string, number: number, labels: string[]): Promise<void> =>
  invoke("gh_add_labels_to_issue", { owner, repo, number, labels });

export const ghSetIssueMilestone = (owner: string, repo: string, number: number, milestoneNumber: number): Promise<void> =>
  invoke("gh_set_issue_milestone", { owner, repo, number, milestoneNumber });


export const ghListPullRequests = (owner: string, repo: string, state: string, perPage: number): Promise<PullRequest[]> =>
  invoke("gh_list_pull_requests", { owner, repo, state, perPage });

export const ghCreatePullRequest = (
  owner: string, repo: string,
  title: string, body: string, head: string, base: string, draft: boolean,
): Promise<PullRequest> =>
  invoke("gh_create_pull_request", { owner, repo, title, body, head, base, draft });

export const ghUpdatePullRequest = (
  owner: string, repo: string, number: number,
  state?: string, title?: string, body?: string,
): Promise<PullRequest> =>
  invoke("gh_update_pull_request", { owner, repo, number, state: state ?? null, title: title ?? null, body: body ?? null });

export const ghMergePullRequest = (owner: string, repo: string, number: number, mergeMethod: string): Promise<void> =>
  invoke("gh_merge_pull_request", { owner, repo, number, mergeMethod });

export const ghListPrFiles = (owner: string, repo: string, number: number): Promise<PrFile[]> =>
  invoke("gh_list_pr_files", { owner, repo, number });

export const ghListPrReviews = (owner: string, repo: string, number: number): Promise<PrReview[]> =>
  invoke("gh_list_pr_reviews", { owner, repo, number });

export const ghCreatePrReview = (owner: string, repo: string, number: number, event: string, body: string): Promise<PrReview> =>
  invoke("gh_create_pr_review", { owner, repo, number, event, body });

export const ghListPrComments = (owner: string, repo: string, number: number): Promise<PrComment[]> =>
  invoke("gh_list_pr_comments", { owner, repo, number });

export const ghCreatePrComment = (owner: string, repo: string, number: number, body: string): Promise<PrComment> =>
  invoke("gh_create_pr_comment", { owner, repo, number, body });

export const ghRequestReviewers = (owner: string, repo: string, number: number, reviewers: string[]): Promise<void> =>
  invoke("gh_request_reviewers", { owner, repo, number, reviewers });

export const ghListRepoBranchesSimple = (owner: string, repo: string): Promise<string[]> =>
  invoke("gh_list_repo_branches_simple", { owner, repo });

export const ghListRepoCollaboratorsSimple = (owner: string, repo: string): Promise<string[]> =>
  invoke("gh_list_repo_collaborators_simple", { owner, repo });

export const ghConvertPrToReady = (owner: string, repo: string, number: number): Promise<PullRequest> =>
  invoke("gh_convert_pr_to_ready", { owner, repo, number });

export const ghAddPrAssignees = (owner: string, repo: string, number: number, assignees: string[]): Promise<void> =>
  invoke("gh_add_pr_assignees", { owner, repo, number, assignees });

export const ghRemovePrAssignees = (owner: string, repo: string, number: number, assignees: string[]): Promise<void> =>
  invoke("gh_remove_pr_assignees", { owner, repo, number, assignees });

export const ghRemovePrLabel = (owner: string, repo: string, number: number, label: string): Promise<void> =>
  invoke("gh_remove_pr_label", { owner, repo, number, label });

export const ghSetPrMilestone = (owner: string, repo: string, number: number, milestone: number | null): Promise<void> =>
  invoke("gh_set_pr_milestone", { owner, repo, number, milestone });


export const ghListRunJobs = (owner: string, repo: string, runId: number): Promise<WorkflowJob[]> =>
  invoke("gh_list_run_jobs", { owner, repo, runId });

export const ghGetJobLogs = (owner: string, repo: string, jobId: number): Promise<string> =>
  invoke("gh_get_job_logs", { owner, repo, jobId });


export const actionStarRepo = (owner: string, repo: string): Promise<void> =>
  invoke("action_star_repo", { owner, repo });

export const actionUnstarRepo = (owner: string, repo: string): Promise<void> =>
  invoke("action_unstar_repo", { owner, repo });


export const ghListEnvironments = (owner: string, repo: string): Promise<Environment[]> =>
  invoke("gh_list_environments", { owner, repo });

export const ghCreateEnvironment = (owner: string, repo: string, envName: string): Promise<Environment> =>
  invoke("gh_create_environment", { owner, repo, envName });

export const ghDeleteEnvironment = (owner: string, repo: string, envName: string): Promise<void> =>
  invoke("gh_delete_environment", { owner, repo, envName });

export const ghListRepoSecrets = (owner: string, repo: string): Promise<RepoSecret[]> =>
  invoke("gh_list_repo_secrets", { owner, repo });

export const ghListEnvSecrets = (owner: string, repo: string, envName: string): Promise<RepoSecret[]> =>
  invoke("gh_list_env_secrets", { owner, repo, envName });

export const ghGetRepoPublicKey = (owner: string, repo: string): Promise<RepoPublicKey> =>
  invoke("gh_get_repo_public_key", { owner, repo });

export const ghCreateRepoSecret = (owner: string, repo: string, name: string, plaintext: string): Promise<void> =>
  invoke("gh_create_repo_secret", { owner, repo, name, plaintext });

export const ghDeleteRepoSecret = (owner: string, repo: string, name: string): Promise<void> =>
  invoke("gh_delete_repo_secret", { owner, repo, name });

export const ghCreateEnvSecret = (owner: string, repo: string, envName: string, name: string, plaintext: string): Promise<void> =>
  invoke("gh_create_env_secret", { owner, repo, envName, name, plaintext });

export const ghDeleteEnvSecret = (owner: string, repo: string, envName: string, name: string): Promise<void> =>
  invoke("gh_delete_env_secret", { owner, repo, envName, name });

export const ghBulkSetSecret = (
  targets: Array<{ owner: string; repo: string }>,
  name: string,
  plaintext: string,
): Promise<BulkSecretResult[]> =>
  invoke("gh_bulk_set_secret", { targets, name, plaintext });


export const ghListDependabotAlerts = (owner: string, repo: string, state: string, severity?: string): Promise<DependabotAlert[]> =>
  invoke("gh_list_dependabot_alerts", { owner, repo, state, severity: severity ?? null });

export const ghGetDependabotEnabled = (owner: string, repo: string): Promise<boolean> =>
  invoke("gh_get_dependabot_enabled", { owner, repo });

export const ghEnableDependabot = (owner: string, repo: string): Promise<void> =>
  invoke("gh_enable_dependabot", { owner, repo });

export const ghDisableDependabot = (owner: string, repo: string): Promise<void> =>
  invoke("gh_disable_dependabot", { owner, repo });

export const ghEnableSecurityFixes = (owner: string, repo: string): Promise<void> =>
  invoke("gh_enable_security_fixes", { owner, repo });

export const ghDisableSecurityFixes = (owner: string, repo: string): Promise<void> =>
  invoke("gh_disable_security_fixes", { owner, repo });

export const ghPortfolioSecuritySummary = (
  targets: Array<{ owner: string; repo: string }>,
): Promise<RepoAlertSummary[]> =>
  invoke("gh_portfolio_security_summary", { targets });


export const ghScanRepoDeps = (owner: string, repo: string): Promise<RepoDependencies> =>
  invoke("gh_scan_repo_deps", { owner, repo });

export const ghScanMultipleReposDeps = (
  targets: Array<{ owner: string; repo: string }>,
): Promise<RepoDependencies[]> =>
  invoke("gh_scan_multiple_repos_deps", { targets });
