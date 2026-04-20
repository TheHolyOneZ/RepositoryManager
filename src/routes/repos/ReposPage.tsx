import React, { useEffect, useCallback, useRef, useState } from "react";
import { RefreshCw, Search, ArrowDown, ArrowUp, ArrowUpDown, Wand2 } from "lucide-react";
import { RepoTable } from "../../components/repos/RepoTable";
import { RepoFilters } from "../../components/repos/RepoFilters";
import { SelectionToolbar } from "../../components/repos/SelectionToolbar";
import { RepoDetailSlideOver } from "./RepoDetailSlideOver";
import { CleanupPresetsPanel } from "../../components/repos/CleanupPresetsPanel";
import { useRepoStore, selectFilteredRepos } from "../../stores/repoStore";
import { useSelectionStore } from "../../stores/selectionStore";
import { useAccountStore, selectActiveAccount } from "../../stores/accountStore";
import { useShallow } from "zustand/react/shallow";
import { useUIStore } from "../../stores/uiStore";
import { useGlobalKeyboard } from "../../hooks/useKeyboard";
import { reposFetchAll, reposFetchOrg } from "../../lib/tauri/commands";
import { formatInvokeError } from "../../lib/formatError";
import { useTauriEvent } from "../../hooks/useTauriEvent";
import { useOrgStore } from "../../stores/orgStore";
import type { SortField } from "../../types/repo";

const SORT_FIELDS: { field: SortField; label: string }[] = [
  { field: "name", label: "Name" },
  { field: "updated_at", label: "Updated" },
  { field: "stars", label: "Stars" },
  { field: "size_kb", label: "Size" },
  { field: "health", label: "Health" },
];

export const ReposPage: React.FC = () => {
  const setRepos = useRepoStore((s) => s.setRepos);
  const setLoading = useRepoStore((s) => s.setLoading);
  const setFetchProgress = useRepoStore((s) => s.setFetchProgress);
  const enrichHealthScores = useRepoStore((s) => s.enrichHealthScores);
  const isLoading = useRepoStore((s) => s.isLoading);
  const filters = useRepoStore((s) => s.filters);
  const sort = useRepoStore((s) => s.sort);
  const setFilter = useRepoStore((s) => s.setFilter);
  const setSort = useRepoStore((s) => s.setSort);
  const filteredRepos = useRepoStore(useShallow(selectFilteredRepos));
  const totalRepos = useRepoStore((s) => s.repos.length);
  const activeAccount = useAccountStore(selectActiveAccount);
  const orgContext = useOrgStore((s) => s.activeContext);
  const addToast = useUIStore((s) => s.addToast);
  const activeSlideOver = useUIStore((s) => s.activeSlideOver);
  const slideOverData = useUIStore((s) => s.slideOverData);
  const closeSlideOver = useUIStore((s) => s.closeSlideOver);
  const openModal = useUIStore((s) => s.openModal);
  const selection = useSelectionStore((s) => s.selectedIds);
  const toggleSelection = useSelectionStore((s) => s.toggle);
  const openSlideOver = useUIStore((s) => s.openSlideOver);
  const [cursorIdx, setCursorIdx] = useState(0);
  const [presetsOpen, setPresetsOpen] = useState(false);
  const fetchReposRef = useRef<(force?: boolean) => void>(() => {});

  const fetchRepos = useCallback(async (force = false) => {
    if (!activeAccount) return;
    setLoading(true);
    try {
      let repos;
      if (orgContext.type === "org") {
        repos = await reposFetchOrg(orgContext.login, 100, 1);
      } else {
        repos = await reposFetchAll(activeAccount.id, force);
      }
      setRepos(repos);
      enrichHealthScores();
    } catch (e: unknown) {
      addToast({ type: "error", title: "Couldn't load repositories", message: formatInvokeError(e) });
    } finally {
      setLoading(false);
    }
  }, [activeAccount, orgContext, setRepos, setLoading, enrichHealthScores, addToast]);

  useGlobalKeyboard({
    j: useCallback(() => setCursorIdx((i) => Math.min(i + 1, filteredRepos.length - 1)), [filteredRepos.length]),
    k: useCallback(() => setCursorIdx((i) => Math.max(i - 1, 0)), []),
    " ": useCallback(() => { const repo = filteredRepos[cursorIdx]; if (repo) toggleSelection(repo.id); }, [filteredRepos, cursorIdx, toggleSelection]),
    enter: useCallback(() => { const repo = filteredRepos[cursorIdx]; if (repo) openSlideOver("repo-detail", repo); }, [filteredRepos, cursorIdx, openSlideOver]),
    d: useCallback(() => {
      const targets = selection.size > 0 ? filteredRepos.filter((r) => selection.has(r.id)) : filteredRepos.slice(cursorIdx, cursorIdx + 1);
      if (targets.length) openModal("confirm-queue", { action: "delete", repos: targets });
    }, [selection, filteredRepos, cursorIdx, openModal]),
    a: useCallback(() => {
      const targets = selection.size > 0 ? filteredRepos.filter((r) => selection.has(r.id)) : filteredRepos.slice(cursorIdx, cursorIdx + 1);
      if (targets.length) openModal("confirm-queue", { action: "archive", repos: targets });
    }, [selection, filteredRepos, cursorIdx, openModal]),
    r: useCallback(() => fetchRepos(true), [fetchRepos]),
    f: useCallback(() => {
      const el = document.querySelector<HTMLInputElement>("[data-filter-search]");
      if (el) { el.focus(); el.select(); }
    }, []),
  });

  const repoRefreshToken = useUIStore((s) => s.repoRefreshToken);
  const prevTokenRef = useRef(repoRefreshToken);
  const silentRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchReposSilent = useCallback(async () => {
    if (!activeAccount) return;
    try {
      let repos;
      if (orgContext.type === "org") {
        repos = await reposFetchOrg(orgContext.login, 100, 1);
      } else {
        repos = await reposFetchAll(activeAccount.id, false);
      }
      setRepos(repos);
      enrichHealthScores();
    } catch { }
  }, [activeAccount, orgContext, setRepos, enrichHealthScores]);

  useEffect(() => { void fetchRepos(); }, [fetchRepos]);

  useEffect(() => {
    if (silentRefreshRef.current) clearInterval(silentRefreshRef.current);
    silentRefreshRef.current = setInterval(() => { void fetchReposSilent(); }, 30_000);
    return () => { if (silentRefreshRef.current) clearInterval(silentRefreshRef.current); };
  }, [fetchReposSilent]);

  useTauriEvent<{ fetched: number; total: number }>("repos:fetch-progress", (p) => { setFetchProgress(p); });
  useTauriEvent("repos:cache-updated", () => { fetchRepos(); });


  useEffect(() => {
    if (repoRefreshToken !== prevTokenRef.current) {
      prevTokenRef.current = repoRefreshToken;
      void fetchRepos(true);
    }
  }, [repoRefreshToken, fetchRepos]);

  const toggleSort = (field: SortField) => {
    if (sort.field === field) setSort({ field, direction: sort.direction === "asc" ? "desc" : "asc" });
    else setSort({ field, direction: "desc" });
  };

  return (
    <div style={{ display: "flex", height: "100%", minHeight: 0, overflow: "hidden" }}>
      <RepoFilters />

      <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
        <div style={{
          flexShrink: 0, display: "flex", alignItems: "center", gap: 8,
          padding: "8px 14px",
          background: "rgba(255,255,255,0.015)",
          borderBottom: "1px solid rgba(255,255,255,0.065)",
        }}>
          <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
            <Search size={12} style={{ position: "absolute", left: 10, color: "#4A5580", pointerEvents: "none" }} />
            <input
              data-filter-search
              placeholder="Search repos…"
              value={filters.search}
              onChange={(e) => setFilter("search", e.target.value)}
              style={{
                width: 200, height: 32, borderRadius: 8,
                background: "rgba(255,255,255,0.06)", border: "1px solid transparent",
                color: "#D4D8E8", fontSize: "0.8125rem", paddingLeft: 30, paddingRight: 10,
                outline: "none", transition: "all 150ms",
              }}
              onFocus={(e) => {
                e.currentTarget.style.border = "1px solid rgba(139,92,246,0.45)";
                e.currentTarget.style.boxShadow = "0 0 0 3px rgba(139,92,246,0.10)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.border = "1px solid transparent";
                e.currentTarget.style.boxShadow = "none";
              }}
            />
          </div>

          <div style={{ width: 1, height: 20, background: "rgba(255,255,255,0.07)", flexShrink: 0 }} />

          <div style={{ display: "flex", gap: 2, alignItems: "center" }}>
            {SORT_FIELDS.map(({ field, label }) => {
              const active = sort.field === field;
              return (
                <button key={field} onClick={() => toggleSort(field)}
                  style={{
                    display: "flex", alignItems: "center", gap: 4,
                    height: 28, padding: "0 10px", borderRadius: 6,
                    background: active ? "rgba(139,92,246,0.14)" : "transparent",
                    border: active ? "1px solid rgba(139,92,246,0.28)" : "1px solid transparent",
                    color: active ? "#A78BFA" : "#4A5580",
                    fontSize: "0.75rem", fontWeight: active ? 600 : 400,
                    cursor: "pointer", transition: "all 130ms ease",
                  }}
                  onMouseEnter={(e) => { if (!active) { (e.currentTarget as HTMLButtonElement).style.color = "#8991A4"; (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.05)"; }}}
                  onMouseLeave={(e) => { if (!active) { (e.currentTarget as HTMLButtonElement).style.color = "#4A5580"; (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}}
                >
                  {label}
                  {active
                    ? (sort.direction === "asc"
                        ? <ArrowUp size={9} style={{ color: "#A78BFA" }} />
                        : <ArrowDown size={9} style={{ color: "#A78BFA" }} />)
                    : <ArrowUpDown size={9} style={{ color: "#2D3650" }} />}
                </button>
              );
            })}
          </div>

          <div style={{ flex: 1 }} />

          <span style={{ fontSize: "0.6875rem", color: "#3A4560", fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>
            {filteredRepos.length === totalRepos
              ? `${totalRepos} repos`
              : `${filteredRepos.length} / ${totalRepos}`}
          </span>

          <button
            onClick={() => setPresetsOpen(true)}
            style={{
              display: "flex", alignItems: "center", gap: 5,
              height: 30, padding: "0 10px", borderRadius: 7,
              background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.20)",
              color: "#A78BFA", fontSize: "0.75rem", fontWeight: 500, cursor: "pointer",
              transition: "all 140ms",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(139,92,246,0.14)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(139,92,246,0.08)"; }}
          >
            <Wand2 size={12} /> Presets
          </button>
          <button
            onClick={() => fetchRepos(true)}
            disabled={isLoading}
            style={{
              display: "flex", alignItems: "center", gap: 5,
              height: 30, padding: "0 10px", borderRadius: 7,
              background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
              color: "#7A8AAE", fontSize: "0.75rem", fontWeight: 500,
              cursor: isLoading ? "not-allowed" : "pointer", opacity: isLoading ? 0.6 : 1,
              transition: "all 140ms",
            }}
            onMouseEnter={(e) => { if (!isLoading) e.currentTarget.style.background = "rgba(255,255,255,0.07)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
          >
            <RefreshCw size={12} className={isLoading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>

        <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
          <RepoTable repos={filteredRepos} isLoading={isLoading} />
          <SelectionToolbar />
        </div>
      </div>
      <RepoDetailSlideOver
        open={activeSlideOver === "repo-detail"}
        repo={activeSlideOver === "repo-detail" ? slideOverData as any : null}
        onClose={closeSlideOver}
      />
      <CleanupPresetsPanel open={presetsOpen} onClose={() => setPresetsOpen(false)} />
    </div>
  );
};
