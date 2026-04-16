import React, { useState, useCallback, useRef } from "react";
import {
  Network, Shield, ShieldOff, RefreshCw, ChevronRight, Loader2,
  GitBranch, AlertTriangle, CheckCircle2, Edit3, Plus, Info,
  XCircle, GitMerge,
} from "lucide-react";
import { RepoPicker } from "../../components/repos/RepoPicker";
import { useRepoStore } from "../../stores/repoStore";
import { useUIStore } from "../../stores/uiStore";
import { fanout } from "../../lib/utils/fanout";
import { formatInvokeError } from "../../lib/formatError";
import {
  ghListBranches, ghGetBranchProtection, ghSetBranchProtection,
  ghRemoveBranchProtection, ghRenameDefaultBranch, ghCreateBranch,
  suggestionsRefreshFromBranches,
} from "../../lib/tauri/commands";
import type { Branch, BranchProtection } from "../../types/governance";
import type { Repo } from "../../types/repo";

type Tab = "overview" | "protect" | "create";

const STALE_DAYS = 90;

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  return Math.floor(ms / 86_400_000);
}

interface RepoRow {
  repo: Repo;
  branches: Branch[] | null;
  loading: boolean;
  defaultProtection: BranchProtection | null;
  staleBranches: Branch[];
  loadError?: string;
}

const DEFAULT_PROTECTION: BranchProtection = {
  require_pull_request_reviews: true,
  required_approving_review_count: 1,
  dismiss_stale_reviews: false,
  require_code_owner_reviews: false,
  enforce_admins: false,
  require_status_checks: false,
};

const INPUT_STYLE: React.CSSProperties = {
  width: "100%", height: 34, borderRadius: 8,
  background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)",
  color: "#C8CDD8", fontSize: "0.875rem", padding: "0 12px", outline: "none",
};

export const BranchesPage: React.FC = () => {
  const repos = useRepoStore((s) => s.repos);
  const addToast = useUIStore((s) => s.addToast);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [rows, setRows] = useState<Map<string, RepoRow>>(new Map());
  const [loadingAll, setLoadingAll] = useState(false);


  const [protection, setProtection] = useState<BranchProtection>({ ...DEFAULT_PROTECTION });
  const [protectAction, setProtectAction] = useState<"protect" | "unprotect" | "rename">("protect");
  const [renameValue, setRenameValue] = useState("main");
  const [protectRunning, setProtectRunning] = useState(false);
  const [protectProgress, setProtectProgress] = useState<{ done: number; total: number } | null>(null);
  const [protectResults, setProtectResults] = useState<Array<{ repo: string; ok: boolean; error?: string }> | null>(null);


  const [newBranchName, setNewBranchName] = useState("");
  const [fromBranchName, setFromBranchName] = useState("main");
  const [createRunning, setCreateRunning] = useState(false);
  const [createProgress, setCreateProgress] = useState<{ done: number; total: number } | null>(null);
  const [createResults, setCreateResults] = useState<Array<{ repo: string; ok: boolean; error?: string }> | null>(null);

  const selectedRepos = repos.filter((r) => selectedIds.has(r.id));

  const toggleRepo = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };


  const staleAccumRef = useRef<Map<string, string>>(new Map());

  const loadRowData = useCallback(async (repoIds: string[]) => {
    const targets = repos.filter((r) => repoIds.includes(r.id));
    for (const repo of targets) {
      setRows((prev) => {
        const next = new Map(prev);
        next.set(repo.id, { repo, branches: null, loading: true, defaultProtection: null, staleBranches: [] });
        return next;
      });
    }
    await fanout(targets, 5, async (repo) => {
      let branches: Branch[] = [];
      let prot: BranchProtection | null = null;
      let loadError: string | undefined;
      try {
        branches = await ghListBranches(repo.owner, repo.name, repo.default_branch);


        try { prot = await ghGetBranchProtection(repo.owner, repo.name, repo.default_branch); } catch { }
      } catch (e) {
        loadError = formatInvokeError(e);
      }
      const stale = branches.filter((b) => {
        const days = daysSince(b.commit_date);
        return days !== null && days > STALE_DAYS;
      });
      if (stale.length > 0) staleAccumRef.current.set(repo.id, repo.name);
      setRows((prev) => {
        const next = new Map(prev);
        next.set(repo.id, { repo, branches, loading: false, defaultProtection: prot, staleBranches: stale, loadError });
        return next;
      });
      if (loadError) throw new Error(loadError);
    });
  }, [repos]);

  const handleLoadSelected = async () => {
    if (!selectedIds.size) return;
    staleAccumRef.current.clear();
    setLoadingAll(true);
    await loadRowData([...selectedIds]);
    const staleIds = [...staleAccumRef.current.keys()];
    const staleNames = [...staleAccumRef.current.values()];
    if (staleIds.length) {
      try { await suggestionsRefreshFromBranches(staleIds, staleNames); } catch { }
    }
    setLoadingAll(false);
  };

  const handleProtectApply = async () => {
    if (!selectedRepos.length) return;
    if (protectAction === "rename" && !renameValue.trim()) return;
    setProtectRunning(true);
    setProtectResults(null);
    setProtectProgress({ done: 0, total: selectedRepos.length });
    const results = await fanout(selectedRepos, 6, async (repo) => {
      if (protectAction === "protect") {
        await ghSetBranchProtection(repo.owner, repo.name, repo.default_branch, protection);
      } else if (protectAction === "unprotect") {
        await ghRemoveBranchProtection(repo.owner, repo.name, repo.default_branch);
      } else {
        await ghRenameDefaultBranch(repo.owner, repo.name, renameValue.trim());
      }
    }, (done, total) => setProtectProgress({ done, total }));
    const ok = results.filter((r) => r.ok).length;
    const fail = results.filter((r) => !r.ok).length;
    setProtectResults(results.map((r) => ({ repo: r.item.full_name, ok: r.ok, error: r.error })));
    addToast({ type: fail === 0 ? "success" : "warning", title: `${protectAction}: ${ok} succeeded, ${fail} failed` });
    setProtectRunning(false);
    setProtectProgress(null);
    if (selectedIds.size) loadRowData([...selectedIds]);
  };

  const handleCreateBranch = async () => {
    if (!newBranchName.trim() || !fromBranchName.trim() || !selectedRepos.length) return;
    setCreateRunning(true);
    setCreateResults(null);
    setCreateProgress({ done: 0, total: selectedRepos.length });
    const results = await fanout(selectedRepos, 6, async (repo) => {
      await ghCreateBranch(repo.owner, repo.name, newBranchName.trim(), fromBranchName.trim());
    }, (done, total) => setCreateProgress({ done, total }));
    const ok = results.filter((r) => r.ok).length;
    const fail = results.filter((r) => !r.ok).length;
    setCreateResults(results.map((r) => ({ repo: r.item.full_name, ok: r.ok, error: r.error })));
    addToast({ type: fail === 0 ? "success" : "warning", title: `Create branch: ${ok} succeeded, ${fail} failed` });
    setCreateRunning(false);
    setCreateProgress(null);
  };

  const displayedRows: RepoRow[] = selectedRepos.map(
    (r) => rows.get(r.id) ?? { repo: r, branches: null, loading: false, defaultProtection: null, staleBranches: [], loadError: undefined }
  );

  const ProtectionToggle: React.FC<{ label: string; field: keyof BranchProtection; desc?: string }> = ({ label, field, desc }) => {
    if (field === "required_approving_review_count") return null;
    const val = protection[field] as boolean;
    return (
      <div style={{ padding: "7px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: "0.8125rem", color: "#8A94AA" }}>{label}</span>
          <button
            onClick={() => setProtection((p) => ({ ...p, [field]: !val }))}
            style={{
              width: 36, height: 20, borderRadius: 10, cursor: "pointer", transition: "background 150ms",
              background: val ? "#8B5CF6" : "rgba(255,255,255,0.08)", border: "none", position: "relative", flexShrink: 0,
            }}
          >
            <span style={{
              position: "absolute", top: 2, width: 16, height: 16, borderRadius: "50%", background: "#fff",
              transition: "left 150ms", left: val ? 18 : 2,
            }} />
          </button>
        </div>
        {desc && <p style={{ fontSize: "0.6875rem", color: "#2D3650", marginTop: 2 }}>{desc}</p>}
      </div>
    );
  };

  const ProgressBar = ({ progress }: { progress: { done: number; total: number } }) => (
    <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 8, padding: "10px 14px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ fontSize: "0.75rem", color: "#7A88A6" }}>Progress</span>
        <span style={{ fontSize: "0.75rem", color: "#C4B5FD" }}>{progress.done} / {progress.total}</span>
      </div>
      <div style={{ height: 4, borderRadius: 2, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
        <div style={{ height: "100%", borderRadius: 2, background: "linear-gradient(90deg, #8B5CF6, #7C3AED)", width: `${(progress.done / progress.total) * 100}%`, transition: "width 200ms" }} />
      </div>
    </div>
  );

  const ResultsList = ({ results }: { results: Array<{ repo: string; ok: boolean; error?: string }> }) => (
    <div style={{ background: "rgba(255,255,255,0.025)", borderRadius: 8, padding: "10px 14px", maxHeight: 200, overflowY: "auto" }}>
      <p style={{ fontSize: "0.6875rem", fontWeight: 700, color: "#4A5580", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.07em" }}>Results</p>
      {results.map((r) => (
        <div key={r.repo} style={{ display: "flex", alignItems: "flex-start", gap: 7, padding: "3px 0" }}>
          {r.ok ? <CheckCircle2 size={11} style={{ color: "#10B981", flexShrink: 0, marginTop: 1 }} /> : <XCircle size={11} style={{ color: "#EF4444", flexShrink: 0, marginTop: 1 }} />}
          <div style={{ flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: "0.75rem", color: r.ok ? "#C8CDD8" : "#EF4444" }}>{r.repo}</span>
            {r.error && <p style={{ fontSize: "0.6875rem", color: "#EF4444", marginTop: 1, wordBreak: "break-word" }}>{r.error}</p>}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div style={{ display: "flex", height: "100%", minHeight: 0, overflow: "hidden" }}>
      <RepoPicker
        selectedIds={selectedIds}
        onToggle={toggleRepo}
        onSelectAll={() => setSelectedIds(new Set(repos.map((r) => r.id)))}
        onClearAll={() => setSelectedIds(new Set())}
      />

      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>

        <div style={{
          margin: "12px 14px 0", padding: "10px 12px", borderRadius: 8,
          background: "rgba(96,165,250,0.06)", border: "1px solid rgba(96,165,250,0.15)",
          display: "flex", gap: 9, alignItems: "flex-start", flexShrink: 0,
        }}>
          <Info size={14} style={{ color: "#60A5FA", flexShrink: 0, marginTop: 1 }} />
          <p style={{ fontSize: "0.75rem", color: "#7A90B4", lineHeight: 1.55, margin: 0 }}>
            <strong style={{ color: "#93B4D8" }}>Branch Governance</strong> — select repos on the left, then:
            <em> Overview</em> shows all branches with stale detection (90 days without a commit) and default branch protection status.
            <em> Protection</em> lets you bulk-apply or remove branch protection rules, or rename the default branch.
            <em> Create</em> creates a new branch from a source branch across all selected repos.
            Branch protection requires admin access. Needs the
            <code style={{ background: "rgba(255,255,255,0.06)", padding: "1px 4px", borderRadius: 3 }}>repo</code> scope.
          </p>
        </div>

        <div style={{
          flexShrink: 0, display: "flex", alignItems: "center", gap: 2,
          padding: "0 14px", height: 44, marginTop: 8,
          borderBottom: "1px solid rgba(255,255,255,0.065)",
          background: "rgba(255,255,255,0.015)",
        }}>
          {(["overview", "protect", "create"] as Tab[]).map((t) => (
            <button key={t} onClick={() => setActiveTab(t)}
              style={{
                height: 28, padding: "0 12px", borderRadius: 6, cursor: "pointer",
                background: activeTab === t ? "rgba(139,92,246,0.14)" : "transparent",
                border: activeTab === t ? "1px solid rgba(139,92,246,0.28)" : "1px solid transparent",
                color: activeTab === t ? "#C4B5FD" : "#4A5580",
                fontSize: "0.8125rem", fontWeight: 500,
                display: "flex", alignItems: "center", gap: 5,
              }}>
              {t === "overview" && <Network size={12} />}
              {t === "protect" && <Shield size={12} />}
              {t === "create" && <Plus size={12} />}
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
          <div style={{ flex: 1 }} />
          {activeTab === "overview" && (
            <button
              onClick={handleLoadSelected}
              disabled={loadingAll || !selectedIds.size}
              style={{
                display: "flex", alignItems: "center", gap: 5, height: 28, padding: "0 10px",
                borderRadius: 7, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                color: "#4A5580", fontSize: "0.75rem", cursor: "pointer", opacity: !selectedIds.size ? 0.4 : 1,
              }}>
              {loadingAll ? <Loader2 size={11} style={{ animation: "spin 1s linear infinite" }} /> : <RefreshCw size={11} />}
              Load branches
            </button>
          )}
        </div>

        <div style={{ flex: 1, overflow: "auto" }}>

          {activeTab === "overview" && (
            <div>
              {!selectedIds.size && (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 300, gap: 10 }}>
                  <Network size={32} style={{ color: "#1D2436" }} />
                  <p style={{ color: "#3A4560", fontSize: "0.875rem" }}>Select repos and click "Load branches"</p>
                </div>
              )}
              {displayedRows.map((row) => { const { repo, branches, loading: rowLoading, defaultProtection, staleBranches } = row; return (
                <div key={repo.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", padding: "10px 14px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                    <GitBranch size={13} style={{ color: "#4A5580", flexShrink: 0 }} />
                    <span style={{ fontWeight: 600, color: "#D4D8E8", fontSize: "0.8125rem", flex: 1 }}>{repo.full_name}</span>
                    <span style={{ fontSize: "0.6875rem", color: "#3A4560" }}>
                      default: <code style={{ color: "#A78BFA", fontSize: "0.6875rem" }}>{repo.default_branch}</code>
                    </span>
                    {rowLoading && <Loader2 size={13} style={{ color: "#4A5580", animation: "spin 1s linear infinite" }} />}
                    {!rowLoading && branches !== null && (
                      <>
                        <span style={{ fontSize: "0.6875rem", color: "#4A5580" }}>{branches.length} branches</span>
                        {defaultProtection
                          ? <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "0.6875rem", color: "#10B981" }}><Shield size={11} /> Protected</span>
                          : <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "0.6875rem", color: "#3A4560" }}><ShieldOff size={11} /> Unprotected</span>}
                        {staleBranches.length > 0 && (
                          <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "0.6875rem", color: "#F59E0B" }}>
                            <AlertTriangle size={11} /> {staleBranches.length} stale
                          </span>
                        )}
                      </>
                    )}
                  </div>
                  {!rowLoading && branches !== null && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 5, paddingLeft: 22 }}>
                      {branches.slice(0, 15).map((b) => {
                        const days = daysSince(b.commit_date);
                        const isStale = days !== null && days > STALE_DAYS;
                        return (
                          <span key={b.name} title={days !== null ? `Last commit: ${days} days ago` : undefined} style={{
                            display: "inline-flex", alignItems: "center", gap: 4,
                            fontSize: "0.6875rem", padding: "2px 7px", borderRadius: 4,
                            background: b.is_default ? "rgba(139,92,246,0.12)" : isStale ? "rgba(245,158,11,0.08)" : "rgba(255,255,255,0.04)",
                            border: b.is_default ? "1px solid rgba(139,92,246,0.22)" : isStale ? "1px solid rgba(245,158,11,0.15)" : "1px solid rgba(255,255,255,0.07)",
                            color: b.is_default ? "#C4B5FD" : isStale ? "#F59E0B" : "#4A5580",
                            cursor: "default",
                          }}>
                            {b.protected && <CheckCircle2 size={9} />}
                            {isStale && !b.is_default && <AlertTriangle size={9} />}
                            {b.name}
                            {b.is_default && <span style={{ fontSize: "0.5625rem", opacity: 0.6 }}>default</span>}
                            {days !== null && <span style={{ fontSize: "0.5625rem", opacity: 0.5 }}>{days}d</span>}
                          </span>
                        );
                      })}
                      {branches.length > 15 && <span style={{ fontSize: "0.6875rem", color: "#2D3650", padding: "2px 5px" }}>+{branches.length - 15} more</span>}
                    </div>
                  )}
                  {!rowLoading && branches === null && !row.loadError && (
                    <p style={{ fontSize: "0.6875rem", color: "#2D3650", paddingLeft: 22 }}>Click "Load branches" to fetch</p>
                  )}
                  {row.loadError && (
                    <p style={{ fontSize: "0.6875rem", color: "#EF4444", paddingLeft: 22 }}>{row.loadError}</p>
                  )}
                </div>
              ); })}
            </div>
          )}


          {activeTab === "protect" && (
            <div style={{ padding: 24, maxWidth: 620 }}>
              <div style={{
                padding: "10px 12px", borderRadius: 8, marginBottom: 20,
                background: "rgba(96,165,250,0.06)", border: "1px solid rgba(96,165,250,0.15)",
                display: "flex", gap: 9, alignItems: "flex-start",
              }}>
                <Info size={14} style={{ color: "#60A5FA", flexShrink: 0, marginTop: 1 }} />
                <p style={{ fontSize: "0.75rem", color: "#7A90B4", lineHeight: 1.55, margin: 0 }}>
                  Apply branch protection rules to the <strong style={{ color: "#A78BFA" }}>default branch</strong> of
                  all <strong style={{ color: "#C4B5FD" }}>{selectedIds.size} selected repo{selectedIds.size !== 1 ? "s" : ""}</strong>.
                  Branch protection requires <strong>admin access</strong> to each repo.
                  On <strong>GitHub Free</strong>, branch protection is only available on <em>public repos</em> — private repos need GitHub Pro/Team.
                  Common errors: <em>"Resource not accessible by integration"</em> = PAT needs <code style={{ background: "rgba(255,255,255,0.06)", padding: "1px 4px", borderRadius: 3 }}>repo</code> scope + admin access;
                  <em>"403 Forbidden"</em> = private repo on Free plan.
                </p>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ display: "flex", gap: 8 }}>
                  {(["protect", "unprotect", "rename"] as const).map((a) => (
                    <button key={a} onClick={() => setProtectAction(a)}
                      style={{
                        flex: 1, height: 34, borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: "0.8125rem",
                        background: protectAction === a ? "rgba(139,92,246,0.14)" : "rgba(255,255,255,0.04)",
                        border: protectAction === a ? "1px solid rgba(139,92,246,0.28)" : "1px solid rgba(255,255,255,0.08)",
                        color: protectAction === a ? "#C4B5FD" : "#4A5580",
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                      }}>
                      {a === "protect" && <Shield size={12} />}
                      {a === "unprotect" && <ShieldOff size={12} />}
                      {a === "rename" && <Edit3 size={12} />}
                      {a === "protect" ? "Protect" : a === "unprotect" ? "Unprotect" : "Set Default Branch"}
                    </button>
                  ))}
                </div>

                {protectAction === "protect" && (
                  <div style={{ background: "rgba(255,255,255,0.025)", borderRadius: 10, padding: "12px 16px", border: "1px solid rgba(255,255,255,0.07)" }}>
                    <p style={{ fontSize: "0.75rem", color: "#4A5580", marginBottom: 6, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>Protection rules</p>
                    <ProtectionToggle
                      label="Require pull request reviews before merging"
                      field="require_pull_request_reviews"
                      desc="Prevents direct pushes — changes must go through a PR."
                    />
                    {protection.require_pull_request_reviews && (
                      <div style={{ padding: "7px 0 7px 16px", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <span style={{ fontSize: "0.8125rem", color: "#8A94AA" }}>Required approvals</span>
                          <div style={{ display: "flex", gap: 4 }}>
                            {[1, 2, 3].map((n) => (
                              <button key={n} onClick={() => setProtection((p) => ({ ...p, required_approving_review_count: n }))}
                                style={{ width: 28, height: 28, borderRadius: 6, cursor: "pointer", fontWeight: 700, fontSize: "0.75rem", background: protection.required_approving_review_count === n ? "rgba(139,92,246,0.20)" : "rgba(255,255,255,0.05)", border: protection.required_approving_review_count === n ? "1px solid rgba(139,92,246,0.35)" : "1px solid rgba(255,255,255,0.08)", color: protection.required_approving_review_count === n ? "#C4B5FD" : "#4A5580" }}>
                                {n}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                    <ProtectionToggle
                      label="Dismiss stale reviews when new commits are pushed"
                      field="dismiss_stale_reviews"
                      desc="Invalidates approval when the PR is updated."
                    />
                    <ProtectionToggle
                      label="Require review from code owners"
                      field="require_code_owner_reviews"
                      desc="Requires approval from owners listed in CODEOWNERS."
                    />
                    <ProtectionToggle
                      label="Enforce admins (no bypass)"
                      field="enforce_admins"
                      desc="Even repo admins must follow these rules."
                    />
                  </div>
                )}

                {protectAction === "unprotect" && (
                  <div style={{ padding: "10px 12px", borderRadius: 8, background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)" }}>
                    <p style={{ fontSize: "0.75rem", color: "#FCA5A5", lineHeight: 1.55, margin: 0 }}>
                      This will remove <strong>all branch protection</strong> from the default branch of selected repos,
                      allowing direct pushes. This cannot be undone automatically.
                    </p>
                  </div>
                )}

                {protectAction === "rename" && (
                  <div>
                    <label style={{ fontSize: "0.75rem", color: "#4A5580", display: "block", marginBottom: 5 }}>Branch name to set as default</label>
                    <input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} placeholder="main"
                      style={INPUT_STYLE} />
                    <p style={{ fontSize: "0.6875rem", color: "#F59E0B", marginTop: 5 }}>
                      ⚠ This changes <em>which existing branch</em> is marked as the default — it does not create or rename a branch.
                      The branch must already exist in each repo. Use the <strong>Create</strong> tab to create a new branch first if needed.
                    </p>
                  </div>
                )}

                {protectProgress && <ProgressBar progress={protectProgress} />}

                <button
                  onClick={handleProtectApply}
                  disabled={protectRunning || !selectedIds.size || (protectAction === "rename" && !renameValue.trim())}
                  style={{
                    height: 38, borderRadius: 9, cursor: "pointer", fontWeight: 700, fontSize: "0.875rem",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                    background: protectAction === "unprotect" ? "rgba(239,68,68,0.75)" : "rgba(139,92,246,0.80)",
                    border: protectAction === "unprotect" ? "1px solid rgba(239,68,68,0.40)" : "1px solid rgba(139,92,246,0.40)",
                    color: "#fff", opacity: (!selectedIds.size) ? 0.4 : 1,
                  }}>
                  {protectRunning ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <ChevronRight size={14} />}
                  {protectRunning ? "Applying…" : `Apply to ${selectedIds.size} repo${selectedIds.size !== 1 ? "s" : ""}`}
                </button>

                {protectResults && !protectRunning && <ResultsList results={protectResults} />}
              </div>
            </div>
          )}


          {activeTab === "create" && (
            <div style={{ padding: 24, maxWidth: 560 }}>
              <div style={{
                padding: "10px 12px", borderRadius: 8, marginBottom: 20,
                background: "rgba(96,165,250,0.06)", border: "1px solid rgba(96,165,250,0.15)",
                display: "flex", gap: 9, alignItems: "flex-start",
              }}>
                <Info size={14} style={{ color: "#60A5FA", flexShrink: 0, marginTop: 1 }} />
                <p style={{ fontSize: "0.75rem", color: "#7A90B4", lineHeight: 1.55, margin: 0 }}>
                  Create a new branch from an existing source branch across all
                  <strong style={{ color: "#C4B5FD" }}> {selectedIds.size} selected repo{selectedIds.size !== 1 ? "s" : ""}</strong>.
                  The source branch must exist in each repo. The new branch will be created at the same commit as the source.
                  Branch names with slashes (e.g. <code style={{ background: "rgba(255,255,255,0.06)", padding: "1px 4px", borderRadius: 3 }}>feature/my-thing</code>) are supported.
                </p>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div>
                  <label style={{ fontSize: "0.75rem", color: "#4A5580", display: "block", marginBottom: 5 }}>
                    New branch name *
                  </label>
                  <input
                    value={newBranchName}
                    onChange={(e) => setNewBranchName(e.target.value)}
                    placeholder="feature/my-new-branch"
                    style={INPUT_STYLE}
                  />
                </div>
                <div>
                  <label style={{ fontSize: "0.75rem", color: "#4A5580", display: "block", marginBottom: 5 }}>
                    From branch (source) *
                  </label>
                  <input
                    value={fromBranchName}
                    onChange={(e) => setFromBranchName(e.target.value)}
                    placeholder="main"
                    style={INPUT_STYLE}
                  />
                  <p style={{ fontSize: "0.6875rem", color: "#2D3650", marginTop: 4 }}>
                    This branch must exist in all selected repos. If it doesn't exist in a repo, that repo will fail and the others will continue.
                  </p>
                </div>

                <div style={{ background: "rgba(255,255,255,0.025)", borderRadius: 8, padding: "10px 14px", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <p style={{ fontSize: "0.75rem", color: "#4A5580", marginBottom: 6 }}>Summary</p>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <GitMerge size={13} style={{ color: "#A78BFA" }} />
                    <span style={{ fontSize: "0.8125rem", color: "#C8CDD8" }}>
                      Create <code style={{ color: "#A78BFA" }}>{newBranchName || "…"}</code>
                      {" from "}<code style={{ color: "#60A5FA" }}>{fromBranchName || "…"}</code>
                      {" across "}<strong style={{ color: "#C4B5FD" }}>{selectedIds.size}</strong> repo{selectedIds.size !== 1 ? "s" : ""}
                    </span>
                  </div>
                </div>

                {createProgress && <ProgressBar progress={createProgress} />}

                <button
                  onClick={handleCreateBranch}
                  disabled={createRunning || !selectedIds.size || !newBranchName.trim() || !fromBranchName.trim()}
                  style={{
                    height: 38, borderRadius: 9, cursor: "pointer", fontWeight: 700, fontSize: "0.875rem",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                    background: "rgba(139,92,246,0.80)", border: "1px solid rgba(139,92,246,0.40)", color: "#fff",
                    opacity: (!selectedIds.size || !newBranchName.trim() || !fromBranchName.trim()) ? 0.4 : 1,
                  }}>
                  {createRunning ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Plus size={14} />}
                  {createRunning ? "Creating…" : `Create on ${selectedIds.size} repo${selectedIds.size !== 1 ? "s" : ""}`}
                </button>

                {createResults && !createRunning && <ResultsList results={createResults} />}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
