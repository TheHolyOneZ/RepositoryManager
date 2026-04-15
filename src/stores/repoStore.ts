import { create } from "zustand";
import type { Repo, RepoFilters, RepoSort } from "../types/repo";
import { defaultFilters, defaultSort } from "../types/repo";
import { computeHealthStatus } from "../lib/utils/health";

interface RepoState {
  repos: Repo[];
  filters: RepoFilters;
  sort: RepoSort;
  isLoading: boolean;
  fetchProgress: { fetched: number; total: number } | null;
  lastFetchedAt: number | null;
  customTagOptions: string[];

  setRepos: (repos: Repo[]) => void;
  setLoading: (loading: boolean) => void;
  setFetchProgress: (progress: { fetched: number; total: number } | null) => void;
  setFilter: <K extends keyof RepoFilters>(key: K, value: RepoFilters[K]) => void;
  setSort: (sort: RepoSort) => void;
  resetFilters: () => void;
  updateRepoTag: (repoId: string, tag: string, add: boolean) => void;
  enrichHealthScores: () => void;
  addCustomTagOption: (tag: string) => void;
  removeCustomTagOption: (tag: string) => void;
  applyRepoStatusChange: (repoId: string, action: string) => void;
}

function loadCustomTags(): string[] {
  try { return JSON.parse(localStorage.getItem("zrm_custom_tags") ?? "[]"); } catch { return []; }
}


function loadRepoTags(): Record<string, string[]> {
  try { return JSON.parse(localStorage.getItem("zrm_repo_tags") ?? "{}"); } catch { return {}; }
}
function saveRepoTags(repos: { id: string; tags?: string[] }[]) {
  const map: Record<string, string[]> = {};
  repos.forEach((r) => { if ((r.tags ?? []).length > 0) map[r.id] = r.tags!; });
  localStorage.setItem("zrm_repo_tags", JSON.stringify(map));
}

export const useRepoStore = create<RepoState>((set) => ({
  repos: [],
  filters: defaultFilters,
  sort: defaultSort,
  isLoading: false,
  fetchProgress: null,
  lastFetchedAt: null,
  customTagOptions: loadCustomTags(),

  setRepos: (repos) => {

    const saved = loadRepoTags();
    const merged = repos.map((r) => ({ ...r, tags: saved[r.id] ?? r.tags ?? [] }));
    set({ repos: merged, lastFetchedAt: Date.now() });
  },
  setLoading: (isLoading) => set({ isLoading }),
  setFetchProgress: (fetchProgress) => set({ fetchProgress }),

  setFilter: (key, value) =>
    set((state) => ({ filters: { ...state.filters, [key]: value } })),

  setSort: (sort) => set({ sort }),

  resetFilters: () => set({ filters: defaultFilters }),

  updateRepoTag: (repoId, tag, add) =>
    set((state) => {
      const repos = state.repos.map((r) => {
        if (r.id !== repoId) return r;
        const tags = r.tags ?? [];
        if (add) return { ...r, tags: [...new Set([...tags, tag])] };
        return { ...r, tags: tags.filter((t) => t !== tag) };
      });
      saveRepoTags(repos);
      return { repos };
    }),

  enrichHealthScores: () =>
    set((state) => ({
      repos: state.repos.map((r) => ({
        ...r,
        health: r.health ?? {
          status: r.archived ? "archived" : computeHealthStatus(r.pushed_at, r.size_kb),
          score: 50,
          last_push_days: r.pushed_at
            ? Math.floor((Date.now() - new Date(r.pushed_at).getTime()) / 86400000)
            : 9999,
          commit_frequency: 0,
        },
      })),
    })),

  addCustomTagOption: (tag) =>
    set((state) => {
      if (state.customTagOptions.includes(tag)) return state;
      const next = [...state.customTagOptions, tag];
      localStorage.setItem("zrm_custom_tags", JSON.stringify(next));
      return { customTagOptions: next };
    }),

  removeCustomTagOption: (tag) =>
    set((state) => {
      const next = state.customTagOptions.filter((t) => t !== tag);
      localStorage.setItem("zrm_custom_tags", JSON.stringify(next));
      return { customTagOptions: next };
    }),


  applyRepoStatusChange: (repoId, action) =>
    set((state) => ({
      repos: state.repos.map((r) => {
        if (r.id !== repoId) return r;
        switch (action) {
          case "delete":   return { ...r, _deleted: true } as Repo & { _deleted: boolean };
          case "archive":  return { ...r, archived: true, health: { ...r.health!, status: "archived" as const } };
          case "unarchive": return { ...r, archived: false };
          case "set_private": return { ...r, private: true, visibility: "private" as const };
          case "set_public":  return { ...r, private: false, visibility: "public" as const };
          default: return r;
        }
      }).filter((r) => !(r as Repo & { _deleted?: boolean })._deleted),
    })),
}));


export function selectFilteredRepos(state: RepoState): Repo[] {
  const { repos, filters, sort } = state;
  let result = [...repos];

  if (filters.search) {
    const q = filters.search.toLowerCase();
    result = result.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        (r.description ?? "").toLowerCase().includes(q) ||
        r.topics.some((t) => t.toLowerCase().includes(q))
    );
  }

  if (filters.language) result = result.filter((r) => r.language === filters.language);
  if (filters.visibility) result = result.filter((r) => (filters.visibility === "private") === r.private);
  if (filters.health) result = result.filter((r) => r.health?.status === filters.health);
  if (filters.isFork !== null) result = result.filter((r) => r.fork === filters.isFork);
  if (filters.isTemplate !== null) result = result.filter((r) => r.is_template === filters.isTemplate);
  if (filters.hasOpenIssues !== null)
    result = result.filter((r) => filters.hasOpenIssues ? r.open_issues > 0 : r.open_issues === 0);
  if (filters.minStars !== null) result = result.filter((r) => r.stars >= filters.minStars!);
  if (filters.maxStars !== null) result = result.filter((r) => r.stars <= filters.maxStars!);
  if (filters.tags.length > 0)
    result = result.filter((r) => filters.tags.some((t) => r.tags?.includes(t)));

  result.sort((a, b) => {
    let aVal: string | number = 0;
    let bVal: string | number = 0;
    switch (sort.field) {
      case "name": aVal = a.name; bVal = b.name; break;
      case "updated_at": aVal = a.updated_at; bVal = b.updated_at; break;
      case "created_at": aVal = a.created_at; bVal = b.created_at; break;
      case "stars": aVal = a.stars; bVal = b.stars; break;
      case "size_kb": aVal = a.size_kb; bVal = b.size_kb; break;
      case "language": aVal = a.language ?? ""; bVal = b.language ?? ""; break;
      case "health": aVal = a.health?.score ?? 0; bVal = b.health?.score ?? 0; break;
    }
    if (aVal < bVal) return sort.direction === "asc" ? -1 : 1;
    if (aVal > bVal) return sort.direction === "asc" ? 1 : -1;
    return 0;
  });

  return result;
}

export function selectAvailableLanguages(state: RepoState): string[] {
  const langs = new Set(state.repos.map((r) => r.language).filter(Boolean) as string[]);
  return Array.from(langs).sort();
}
