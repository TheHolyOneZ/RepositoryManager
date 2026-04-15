export interface AnalyticsSummary {
  total_repos: number;
  public_repos: number;
  private_repos: number;
  active_repos: number;
  dormant_repos: number;
  dead_repos: number;
  empty_repos: number;
  archived_repos: number;
  total_stars: number;
  total_forks: number;
  total_size_kb: number;
}

export interface LanguageStat {
  language: string;
  count: number;
  percentage: number;
  color: string;
}

export interface GrowthPoint {
  month: string;
  count: number;
  cumulative: number;
}

export interface DecayPoint {
  month: string;
  active: number;
  dormant: number;
  dead: number;
}

export interface StarSnapshot {
  date: string;
  stars: number;
  repo_id: string;
}

export interface StarVelocityEntry {
  repo_name: string;
  stars_this_week: number;
  total_stars: number;
}
