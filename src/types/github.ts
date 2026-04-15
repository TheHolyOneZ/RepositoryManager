

export interface GitHubUser {
  id: number;
  login: string;
  avatar_url: string;
  name: string | null;
  email: string | null;
  public_repos: number;
  private_repos?: number;
  total_private_repos?: number;
}

export interface GitHubRepo {
  id: number;
  node_id: string;
  name: string;
  full_name: string;
  owner: GitHubUser;
  private: boolean;
  html_url: string;
  description: string | null;
  fork: boolean;
  created_at: string;
  updated_at: string;
  pushed_at: string | null;
  homepage: string | null;
  size: number;
  stargazers_count: number;
  watchers_count: number;
  language: string | null;
  forks_count: number;
  archived: boolean;
  disabled: boolean;
  open_issues_count: number;
  topics: string[];
  visibility: 'public' | 'private' | 'internal';
  default_branch: string;
  is_template: boolean;
  has_issues: boolean;
  has_wiki: boolean;
  has_projects: boolean;
}
