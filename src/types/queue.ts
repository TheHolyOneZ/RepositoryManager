export type QueueAction =
  | 'delete'
  | 'archive'
  | 'unarchive'
  | 'set_public'
  | 'set_private'
  | 'rename'
  | 'add_topics'
  | 'remove_topics'
  | 'transfer'
  | 'update_metadata';

export type QueueItemStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'skipped';
export type ExecutionMode = 'fast' | 'scheduled' | 'controlled';
export type QueueStatus = 'idle' | 'grace' | 'running' | 'paused' | 'done';

export interface QueueItem {
  id: string;
  repo_id: string;
  repo_name: string;
  repo_full_name: string;
  action: QueueAction;
  payload: Record<string, unknown>;
  status: QueueItemStatus;
  error?: string;
  started_at?: string;
  completed_at?: string;
  created_at: string;
}

export interface QueueState {
  items: QueueItem[];
  status: QueueStatus;
  mode: ExecutionMode;
  grace_seconds_remaining?: number;
  current_item_id?: string;
}

export interface DryRunResult {
  repo_id: string;
  repo_name: string;
  action: QueueAction;
  would_succeed: boolean;
  preview_message: string;
}

export interface QueueItemInput {
  repo_id: string;
  repo_name: string;
  repo_full_name: string;
  action: QueueAction;
  payload: Record<string, unknown>;
}

export interface RepoExportInput {
  repo_id: string;
  repo_name: string;
  repo_full_name: string;
}

export interface ExportItemResult {
  repo_name: string;
  success: boolean;
  path: string | null;
  error: string | null;
}

export interface ExportBatchResult {
  results: ExportItemResult[];
  succeeded: number;
  failed: number;
}

export interface ReleaseAsset {
  name: string;
  download_url: string;
  size: number;
  content_type: string;
}

export interface ReleaseInfo {
  tag_name: string;
  name: string | null;
  body: string | null;
  published_at: string | null;
  html_url: string;
  assets: ReleaseAsset[];
  prerelease: boolean;
  draft: boolean;
}

export interface ReleaseResult {
  repo_name: string;
  repo_full_name: string;
  success: boolean;
  release?: ReleaseInfo;
  error?: string;
}

export interface OperationLog {
  id: string;
  repo_id: string;
  repo_name: string;
  action: QueueAction;
  status: 'success' | 'failure' | 'skipped';
  error?: string;
  executed_at: string;
}
