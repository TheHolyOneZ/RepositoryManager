

export interface Account {
  id: string;
  login: string;
  avatar_url: string;
  name: string | null;
  auth_type: 'oauth' | 'pat';
  created_at: string;
}

export interface AuthToken {
  account: Account;
  scopes: string[];
}


export interface GitHubSession {
  accounts: Account[];
  active_account_id: string | null;
}

export interface AppError {
  code: string;
  message: string;
}

export interface CleanupSuggestion {
  id: string;
  repo_id: string;
  repo_name: string;
  reason: SuggestionReason;
  description: string;
  suggested_action: 'delete' | 'archive' | 'review';
  priority: 'high' | 'medium' | 'low';
}

export type SuggestionReason =
  | 'inactive'
  | 'empty'
  | 'abandoned_fork'
  | 'duplicate_name'
  | 'readme_only'
  | 'stale_branches'
  | 'no_license'
  | 'no_description';

export interface DeviceFlowStart {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
}

export interface FetchProgress {
  fetched: number;
  total: number;
  page: number;
}

export interface RateLimitWarning {
  remaining: number;
  reset_at: string;
}
