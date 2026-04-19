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

export interface PrLabel {
  name: string;
  color: string;
}

export interface PullRequest {
  id: number;
  number: number;
  title: string;
  body: string | null;
  state: string;
  draft: boolean;
  html_url: string;
  head_ref: string;
  base_ref: string;
  user_login: string;
  user_avatar: string;
  created_at: string;
  updated_at: string;
  mergeable: boolean | null;
  labels: PrLabel[];
  assignees: string[];
  requested_reviewers: string[];
}

export interface PrFile {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  patch: string | null;
}

export interface PrReview {
  id: number;
  user_login: string;
  user_avatar: string;
  state: string;
  body: string | null;
  submitted_at: string | null;
}

export interface PrComment {
  id: number;
  user_login: string;
  user_avatar: string;
  body: string;
  created_at: string;
}

export interface IssueLabel {
  name: string;
  color: string;
  description: string | null;
}

export interface Milestone {
  id: number;
  number: number;
  title: string;
  open_issues: number;
  closed_issues: number;
  due_on: string | null;
}

export interface Issue {
  id: number;
  number: number;
  title: string;
  body: string | null;
  state: string;
  html_url: string;
  user_login: string;
  user_avatar: string;
  created_at: string;
  updated_at: string;
  comments: number;
  labels: IssueLabel[];
  assignees: string[];
  milestone_title: string | null;
  milestone_number: number | null;
}

export interface IssueComment {
  id: number;
  user_login: string;
  user_avatar: string;
  body: string;
  created_at: string;
}

export interface ReleaseAssetFull {
  id: number;
  name: string;
  size: number;
  download_count: number;
  browser_download_url: string;
  content_type: string;
  state: string;
}

export interface Release {
  id: number;
  tag_name: string;
  name: string | null;
  body: string | null;
  draft: boolean;
  prerelease: boolean;
  html_url: string;
  created_at: string;
  published_at: string | null;
  upload_url: string;
  assets: ReleaseAssetFull[];
  author_login: string;
}

export interface OrgSummary {
  login: string;
  avatar_url: string;
  description: string | null;
}

export interface WorkflowStep {
  name: string;
  status: string;
  conclusion: string | null;
  number: number;
  started_at: string | null;
  completed_at: string | null;
}

export interface WorkflowJob {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  started_at: string | null;
  completed_at: string | null;
  steps: WorkflowStep[];
}
