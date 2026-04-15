export type HealthStatus = 'active' | 'dormant' | 'dead' | 'empty' | 'archived';
export type RepoTag = 'keep' | 'delete' | 'review' | string;
export type RepoVisibility = 'public' | 'private';

export interface HealthScore {
  status: HealthStatus;
  score: number;
  last_push_days: number;
  commit_frequency: number;
}

export interface Repo {
  id: string;
  name: string;
  full_name: string;
  owner: string;
  description: string | null;
  private: boolean;
  fork: boolean;
  archived: boolean;
  is_template: boolean;
  language: string | null;
  stars: number;
  forks: number;
  open_issues: number;
  size_kb: number;
  topics: string[];
  created_at: string;
  updated_at: string;
  pushed_at: string | null;
  html_url: string;
  default_branch: string;
  has_issues: boolean;
  has_wiki: boolean;
  visibility: RepoVisibility;

  health?: HealthScore;
  tags?: RepoTag[];
}

export interface RepoFilters {
  search: string;
  language: string | null;
  visibility: RepoVisibility | null;
  health: HealthStatus | null;
  tags: RepoTag[];
  isFork: boolean | null;
  isTemplate: boolean | null;
  hasOpenIssues: boolean | null;
  minStars: number | null;
  maxStars: number | null;
  minSizeKb: number | null;
  maxSizeKb: number | null;
  createdAfter: string | null;
  createdBefore: string | null;
}

export type SortField = 'name' | 'updated_at' | 'created_at' | 'stars' | 'size_kb' | 'language' | 'health';
export type SortDirection = 'asc' | 'desc';

export interface RepoSort {
  field: SortField;
  direction: SortDirection;
}

export const defaultFilters: RepoFilters = {
  search: '',
  language: null,
  visibility: null,
  health: null,
  tags: [],
  isFork: null,
  isTemplate: null,
  hasOpenIssues: null,
  minStars: null,
  maxStars: null,
  minSizeKb: null,
  maxSizeKb: null,
  createdAfter: null,
  createdBefore: null,
};

export const defaultSort: RepoSort = {
  field: 'updated_at',
  direction: 'desc',
};
