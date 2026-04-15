import { invoke as tauriInvoke } from "@tauri-apps/api/core";
import { assertTauriApp } from "./runtime";
import type { Repo, RepoTag } from "../../types/repo";
import type { QueueItem, QueueItemInput, QueueState, DryRunResult, ExecutionMode, OperationLog, RepoExportInput, ExportBatchResult, ReleaseResult } from "../../types/queue";
import type { AnalyticsSummary, LanguageStat, GrowthPoint, DecayPoint } from "../../types/analytics";
import type { Account, AuthToken, CleanupSuggestion, DeviceFlowStart, GitHubSession } from "./types";

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
