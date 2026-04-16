export interface Workflow {
  id: number;
  name: string;
  path: string;
  state: string;
  html_url: string;
}

export interface WorkflowRun {
  id: number;
  name: string | null;
  workflow_id: number;
  status: string;
  conclusion: string | null;
  html_url: string;
  created_at: string;
  updated_at: string;
  event: string;
  head_branch: string | null;
  head_sha: string;
}

export interface WorkflowArtifact {
  id: number;
  name: string;
  size_in_bytes: number;
  expired: boolean;
  archive_download_url: string;
}

export interface WebhookConfig {
  url: string;
  content_type: string;
  insecure_ssl: string;
}

export interface Webhook {
  id: number;
  name: string;
  active: boolean;
  events: string[];
  config: WebhookConfig;
  created_at: string;
  updated_at: string;
}

export interface WebhookDelivery {
  id: number;
  guid: string;
  delivered_at: string;
  redelivery: boolean;
  duration: number;
  status: string;
  status_code: number;
  event: string;
  action: string | null;
}

export interface CollaboratorPermissions {
  pull: boolean;
  triage: boolean;
  push: boolean;
  maintain: boolean;
  admin: boolean;
}

export interface Collaborator {
  id: number;
  login: string;
  avatar_url: string;
  html_url: string;
  permissions: CollaboratorPermissions;
  role_name: string;
}

export interface PendingInvite {
  id: number;
  login: string | null;
  email: string | null;
  role: string;
  created_at: string;
  inviter: string;
}

export interface Branch {
  name: string;
  sha: string;
  protected: boolean;
  is_default: boolean;
  commit_date: string | null;
}

export interface BranchProtection {
  require_pull_request_reviews: boolean;
  required_approving_review_count: number;
  dismiss_stale_reviews: boolean;
  require_code_owner_reviews: boolean;
  enforce_admins: boolean;
  require_status_checks: boolean;
}
