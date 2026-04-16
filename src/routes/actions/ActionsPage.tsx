import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  GitBranch, Play, StopCircle, RefreshCw, ExternalLink,
  RotateCcw, CheckCircle2, XCircle, Clock, Loader2, ChevronRight,
  Info, ChevronDown,
} from "lucide-react";
import { RepoPicker } from "../../components/repos/RepoPicker";
import { useRepoStore } from "../../stores/repoStore";
import { useUIStore } from "../../stores/uiStore";
import { fanout } from "../../lib/utils/fanout";
import { formatInvokeError } from "../../lib/formatError";
import {
  ghListWorkflows, ghListWorkflowRuns, ghEnableWorkflow, ghDisableWorkflow,
  ghTriggerWorkflow, ghRerunFailedJobs, openUrlExternal,
} from "../../lib/tauri/commands";
import type { Workflow, WorkflowRun } from "../../types/governance";
import type { Repo } from "../../types/repo";

type Tab = "workflows" | "runs" | "bulk";

const STATUS_COLOR: Record<string, string> = {
  completed: "#10B981", in_progress: "#F59E0B", queued: "#60A5FA",
  waiting: "#60A5FA", failure: "#EF4444", cancelled: "#6B7280",
};

const CONCLUSION_ICON: Record<string, React.ReactNode> = {
  success: <CheckCircle2 size={13} style={{ color: "#10B981" }} />,
  failure: <XCircle size={13} style={{ color: "#EF4444" }} />,
  cancelled: <StopCircle size={13} style={{ color: "#6B7280" }} />,
};

function runStatusIcon(run: WorkflowRun) {
  if (run.status === "in_progress" || run.status === "queued") {
    return <Loader2 size={13} style={{ color: "#F59E0B", animation: "spin 1s linear infinite" }} />;
  }
  if (run.conclusion && CONCLUSION_ICON[run.conclusion]) return CONCLUSION_ICON[run.conclusion];
  return <Clock size={13} style={{ color: "#4A5580" }} />;
}

function fmtDate(iso: string) {
  try { return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }); }
  catch { return iso; }
}

const INPUT_STYLE: React.CSSProperties = {
  height: 34, borderRadius: 8, background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.10)", color: "#C8CDD8",
  fontSize: "0.875rem", padding: "0 12px", outline: "none",
};

export const ActionsPage: React.FC = () => {
  const repos = useRepoStore((s) => s.repos);
  const addToast = useUIStore((s) => s.addToast);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [viewingId, setViewingId] = useState<string>("");
  const [activeTab, setActiveTab] = useState<Tab>("workflows");
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [runs, setRuns] = useState<WorkflowRun[]>([]);
  const [loadingWf, setLoadingWf] = useState(false);
  const [loadingRuns, setLoadingRuns] = useState(false);
  const [bulkAction, setBulkAction] = useState<"enable" | "disable">("enable");
  const [bulkWorkflowName, setBulkWorkflowName] = useState("");
  const [bulkRunning, setBulkRunning] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null);
  const [bulkResults, setBulkResults] = useState<Array<{ repo: string; ok: boolean; error?: string }> | null>(null);
  const [triggerBranch, setTriggerBranch] = useState("main");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const selectedRepos = repos.filter((r) => selectedIds.has(r.id));
  const viewingRepo: Repo | undefined = repos.find((r) => r.id === viewingId) ?? selectedRepos[0];


  useEffect(() => {
    if (viewingId && !selectedIds.has(viewingId)) {
      setViewingId(selectedRepos[0]?.id ?? "");
    } else if (!viewingId && selectedRepos.length > 0) {
      setViewingId(selectedRepos[0].id);
    }
  }, [selectedIds]);

  const toggleRepo = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const fetchWorkflows = useCallback(async (repo: Repo) => {
    setLoadingWf(true);
    setWorkflows([]);
    try {
      const wf = await ghListWorkflows(repo.owner, repo.name);
      setWorkflows(wf);
    } catch (e) {
      addToast({ type: "error", title: "Failed to load workflows", message: formatInvokeError(e) });
    } finally { setLoadingWf(false); }
  }, [addToast]);

  const fetchRuns = useCallback(async (repo: Repo) => {
    setLoadingRuns(true);
    try {
      const r = await ghListWorkflowRuns(repo.owner, repo.name, 30);
      setRuns(r);
    } catch (e) {
      addToast({ type: "error", title: "Failed to load runs", message: formatInvokeError(e) });
    } finally { setLoadingRuns(false); }
  }, [addToast]);

  useEffect(() => {
    setWorkflows([]);
    setRuns([]);
    if (viewingRepo) {
      if (activeTab === "workflows") fetchWorkflows(viewingRepo);
      if (activeTab === "runs") fetchRuns(viewingRepo);
    }
  }, [viewingRepo?.id, activeTab]);

  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (!viewingRepo || activeTab !== "runs") return;
    const hasLive = runs.some((r) => r.status === "in_progress" || r.status === "queued");
    if (!hasLive) return;
    pollRef.current = setInterval(() => fetchRuns(viewingRepo), 8000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [runs, activeTab, viewingRepo?.id]);

  const handleEnableDisable = async (wf: Workflow, enable: boolean) => {
    if (!viewingRepo) return;
    try {
      if (enable) await ghEnableWorkflow(viewingRepo.owner, viewingRepo.name, wf.id);
      else await ghDisableWorkflow(viewingRepo.owner, viewingRepo.name, wf.id);
      setWorkflows((prev) => prev.map((w) => w.id === wf.id ? { ...w, state: enable ? "active" : "disabled_manually" } : w));
      addToast({ type: "success", title: enable ? "Workflow enabled" : "Workflow disabled", message: wf.name });
    } catch (e) {
      addToast({ type: "error", title: "Action failed", message: formatInvokeError(e) });
    }
  };

  const handleTrigger = async (wf: Workflow) => {
    if (!viewingRepo) return;
    try {
      await ghTriggerWorkflow(viewingRepo.owner, viewingRepo.name, wf.id, triggerBranch);
      addToast({ type: "success", title: "Workflow dispatched", message: `${wf.name} → ${triggerBranch}` });
      setTimeout(() => fetchRuns(viewingRepo), 2000);
    } catch (e) {
      addToast({ type: "error", title: "Dispatch failed", message: formatInvokeError(e) });
    }
  };

  const handleRerunFailed = async (run: WorkflowRun) => {
    if (!viewingRepo) return;
    try {
      await ghRerunFailedJobs(viewingRepo.owner, viewingRepo.name, run.id);
      addToast({ type: "success", title: "Re-running failed jobs", message: run.name ?? "Run" });
      setTimeout(() => fetchRuns(viewingRepo), 2000);
    } catch (e) {
      addToast({ type: "error", title: "Re-run failed", message: formatInvokeError(e) });
    }
  };

  const handleBulkApply = async () => {
    if (!selectedRepos.length || !bulkWorkflowName.trim()) return;
    setBulkRunning(true);
    setBulkResults(null);
    setBulkProgress({ done: 0, total: selectedRepos.length });
    const results = await fanout(selectedRepos, 6, async (repo) => {
      const wfs = await ghListWorkflows(repo.owner, repo.name);
      const match = wfs.filter((w) => w.name.toLowerCase().includes(bulkWorkflowName.toLowerCase()));
      if (match.length === 0) throw new Error("No matching workflows found in this repo");
      for (const wf of match) {
        if (bulkAction === "enable") await ghEnableWorkflow(repo.owner, repo.name, wf.id);
        else await ghDisableWorkflow(repo.owner, repo.name, wf.id);
      }
      return match.length;
    }, (done, total) => setBulkProgress({ done, total }));
    const ok = results.filter((r) => r.ok).length;
    const fail = results.filter((r) => !r.ok).length;
    setBulkResults(results.map((r) => ({ repo: r.item.full_name, ok: r.ok, error: r.error })));
    addToast({ type: fail === 0 ? "success" : "warning", title: `Bulk ${bulkAction}: ${ok} succeeded, ${fail} failed` });
    setBulkRunning(false);
    setBulkProgress(null);
  };

  const ROW_STYLE: React.CSSProperties = {
    display: "flex", alignItems: "center", gap: 10,
    padding: "7px 12px", borderRadius: 7,
    borderBottom: "1px solid rgba(255,255,255,0.04)",
    fontSize: "0.8125rem",
  };

  const InfoBanner = () => (
    <div style={{
      margin: "12px 14px 0", padding: "10px 12px", borderRadius: 8,
      background: "rgba(96,165,250,0.06)", border: "1px solid rgba(96,165,250,0.15)",
      display: "flex", gap: 9, alignItems: "flex-start",
    }}>
      <Info size={14} style={{ color: "#60A5FA", flexShrink: 0, marginTop: 1 }} />
      <p style={{ fontSize: "0.75rem", color: "#7A90B4", lineHeight: 1.55, margin: 0 }}>
        <strong style={{ color: "#93B4D8" }}>GitHub Actions</strong> lets you automate workflows that run on push, pull request, schedule, or manual trigger.
        Select repos on the left, then view <em>Workflows</em> (the YAML files) or <em>Runs</em> (individual executions).
        Use <em>Bulk Ops</em> to enable or disable a workflow by name across all selected repos at once.
        Requires a PAT with the <code style={{ background: "rgba(255,255,255,0.06)", padding: "1px 4px", borderRadius: 3 }}>workflow</code> scope.
      </p>
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
        <InfoBanner />

        <div style={{
          flexShrink: 0, display: "flex", alignItems: "center", gap: 2,
          padding: "0 14px", height: 44, marginTop: 8,
          borderBottom: "1px solid rgba(255,255,255,0.065)",
          background: "rgba(255,255,255,0.015)",
        }}>
          {(["workflows", "runs", "bulk"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              style={{
                height: 28, padding: "0 12px", borderRadius: 6, cursor: "pointer",
                background: activeTab === t ? "rgba(139,92,246,0.14)" : "transparent",
                border: activeTab === t ? "1px solid rgba(139,92,246,0.28)" : "1px solid transparent",
                color: activeTab === t ? "#C4B5FD" : "#4A5580",
                fontSize: "0.8125rem", fontWeight: 500,
              }}
            >
              {t === "bulk" ? "Bulk Ops" : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}

          <div style={{ flex: 1 }} />


          {activeTab !== "bulk" && selectedRepos.length > 0 && (
            <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ fontSize: "0.6875rem", color: "#5A6890" }}>Viewing:</span>
              <div style={{ position: "relative" }}>
                <select
                  value={viewingId}
                  onChange={(e) => setViewingId(e.target.value)}
                  style={{
                    height: 28, borderRadius: 7, background: "#131628",
                    border: "1px solid rgba(255,255,255,0.13)", color: "#B8C4DC",
                    fontSize: "0.75rem", padding: "0 24px 0 8px", outline: "none", cursor: "pointer",
                    appearance: "none",
                  }}
                >
                  {selectedRepos.map((r) => (
                    <option key={r.id} value={r.id} style={{ background: "#131628", color: "#B8C4DC" }}>{r.name}</option>
                  ))}
                </select>
                <ChevronDown size={10} style={{ position: "absolute", right: 7, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "#4A5580" }} />
              </div>
            </div>
          )}

          {viewingRepo && activeTab !== "bulk" && (
            <button
              onClick={() => activeTab === "workflows" ? fetchWorkflows(viewingRepo) : fetchRuns(viewingRepo)}
              style={{
                display: "flex", alignItems: "center", gap: 5, height: 28, padding: "0 10px",
                borderRadius: 7, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                color: "#4A5580", fontSize: "0.75rem", cursor: "pointer",
              }}
            >
              <RefreshCw size={11} />
              Refresh
            </button>
          )}
        </div>

        <div style={{ flex: 1, overflow: "auto" }}>
          {!selectedRepos.length && activeTab !== "bulk" && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 10 }}>
              <GitBranch size={32} style={{ color: "#1D2436" }} />
              <p style={{ color: "#3A4560", fontSize: "0.875rem" }}>Select repos from the left to get started</p>
            </div>
          )}

          {viewingRepo && activeTab === "workflows" && (
            <div style={{ padding: "8px 0" }}>
              {loadingWf ? (
                <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
                  <Loader2 size={20} style={{ color: "#4A5580", animation: "spin 1s linear infinite" }} />
                </div>
              ) : workflows.length === 0 ? (
                <p style={{ textAlign: "center", color: "#3A4560", padding: 40, fontSize: "0.875rem" }}>No workflows found in this repo</p>
              ) : (
                <>
                  <div style={{ padding: "4px 12px 8px", display: "flex", alignItems: "center", gap: 8 }}>
                    <label style={{ fontSize: "0.75rem", color: "#4A5580" }}>Dispatch branch:</label>
                    <input
                      value={triggerBranch}
                      onChange={(e) => setTriggerBranch(e.target.value)}
                      style={{ ...INPUT_STYLE, height: 26, width: 120, fontSize: "0.75rem" }}
                    />
                    <span style={{ fontSize: "0.6875rem", color: "#2D3650" }}>(used when clicking Run)</span>
                  </div>
                  {workflows.map((wf) => {
                    const active = wf.state === "active";
                    return (
                      <div key={wf.id} style={{ ...ROW_STYLE, background: "transparent" }}>
                        <span style={{
                          width: 7, height: 7, borderRadius: "50%", flexShrink: 0,
                          background: active ? "#10B981" : "#4A5580",
                          boxShadow: active ? "0 0 6px #10B981" : "none",
                        }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ color: "#D4D8E8", fontWeight: 500, fontSize: "0.8125rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {wf.name}
                          </p>
                          <p style={{ color: "#3A4560", fontSize: "0.6875rem" }}>{wf.path}</p>
                        </div>
                        <button
                          onClick={() => handleTrigger(wf)}
                          title="Trigger workflow_dispatch on the branch above"
                          style={{ display: "flex", alignItems: "center", gap: 4, height: 26, padding: "0 9px", borderRadius: 6, cursor: "pointer", background: "rgba(139,92,246,0.10)", border: "1px solid rgba(139,92,246,0.20)", color: "#A78BFA", fontSize: "0.6875rem", fontWeight: 600 }}
                        >
                          <Play size={10} /> Run
                        </button>
                        <button
                          onClick={() => handleEnableDisable(wf, !active)}
                          style={{
                            height: 26, padding: "0 9px", borderRadius: 6, cursor: "pointer", fontSize: "0.6875rem", fontWeight: 600,
                            background: active ? "rgba(239,68,68,0.08)" : "rgba(16,185,129,0.08)",
                            border: active ? "1px solid rgba(239,68,68,0.18)" : "1px solid rgba(16,185,129,0.18)",
                            color: active ? "#EF4444" : "#10B981",
                          }}
                        >
                          {active ? "Disable" : "Enable"}
                        </button>
                        <button
                          onClick={() => openUrlExternal(wf.html_url)}
                          style={{ display: "flex", padding: 5, borderRadius: 5, cursor: "pointer", background: "transparent", border: "none", color: "#3A4560" }}
                        >
                          <ExternalLink size={12} />
                        </button>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          )}

          {viewingRepo && activeTab === "runs" && (
            <div style={{ padding: "8px 0" }}>
              {loadingRuns ? (
                <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
                  <Loader2 size={20} style={{ color: "#4A5580", animation: "spin 1s linear infinite" }} />
                </div>
              ) : runs.length === 0 ? (
                <p style={{ textAlign: "center", color: "#3A4560", padding: 40, fontSize: "0.875rem" }}>No runs found</p>
              ) : runs.map((run) => (
                <div key={run.id} style={{ ...ROW_STYLE }}>
                  {runStatusIcon(run)}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ color: "#D4D8E8", fontWeight: 500, fontSize: "0.8125rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {run.name ?? `Run #${run.id}`}
                    </p>
                    <p style={{ color: "#3A4560", fontSize: "0.6875rem" }}>
                      {run.event} · {run.head_branch ?? "—"} · {fmtDate(run.created_at)}
                    </p>
                  </div>
                  <span style={{
                    fontSize: "0.625rem", fontWeight: 700, padding: "2px 6px", borderRadius: 4,
                    background: `${STATUS_COLOR[run.conclusion ?? run.status] ?? "#4A5580"}18`,
                    color: STATUS_COLOR[run.conclusion ?? run.status] ?? "#4A5580",
                    textTransform: "capitalize",
                  }}>
                    {run.conclusion ?? run.status}
                  </span>
                  {run.conclusion === "failure" && (
                    <button
                      onClick={() => handleRerunFailed(run)}
                      title="Re-run failed jobs only"
                      style={{ display: "flex", alignItems: "center", gap: 4, height: 26, padding: "0 8px", borderRadius: 6, cursor: "pointer", background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.18)", color: "#F59E0B", fontSize: "0.6875rem" }}
                    >
                      <RotateCcw size={10} />
                    </button>
                  )}
                  <button
                    onClick={() => openUrlExternal(run.html_url)}
                    style={{ display: "flex", padding: 5, borderRadius: 5, cursor: "pointer", background: "transparent", border: "none", color: "#3A4560" }}
                  >
                    <ExternalLink size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {activeTab === "bulk" && (
            <div style={{ padding: 24, maxWidth: 560 }}>
              <div style={{
                padding: "10px 12px", borderRadius: 8, marginBottom: 20,
                background: "rgba(96,165,250,0.06)", border: "1px solid rgba(96,165,250,0.15)",
                display: "flex", gap: 9, alignItems: "flex-start",
              }}>
                <Info size={14} style={{ color: "#60A5FA", flexShrink: 0, marginTop: 1 }} />
                <p style={{ fontSize: "0.75rem", color: "#7A90B4", lineHeight: 1.55, margin: 0 }}>
                  Enable or disable workflows by name across all selected repos simultaneously.
                  Enter any part of the workflow name — all matching workflows in each selected repo will be toggled.
                  Currently <strong style={{ color: "#C4B5FD" }}>{selectedIds.size} repo{selectedIds.size !== 1 ? "s" : ""} selected</strong> on the left.
                </p>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label style={{ fontSize: "0.75rem", color: "#4A5580", display: "block", marginBottom: 5 }}>Workflow name contains</label>
                  <input
                    value={bulkWorkflowName}
                    onChange={(e) => setBulkWorkflowName(e.target.value)}
                    placeholder="e.g. CI, deploy, test"
                    style={{ ...INPUT_STYLE, width: "100%" }}
                  />
                  <p style={{ fontSize: "0.6875rem", color: "#2D3650", marginTop: 4 }}>
                    Matches case-insensitively. Leave empty to skip all repos.
                  </p>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  {(["enable", "disable"] as const).map((a) => (
                    <button
                      key={a}
                      onClick={() => setBulkAction(a)}
                      style={{
                        flex: 1, height: 34, borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: "0.8125rem",
                        background: bulkAction === a ? (a === "enable" ? "rgba(16,185,129,0.14)" : "rgba(239,68,68,0.10)") : "rgba(255,255,255,0.04)",
                        border: bulkAction === a ? (a === "enable" ? "1px solid rgba(16,185,129,0.30)" : "1px solid rgba(239,68,68,0.22)") : "1px solid rgba(255,255,255,0.08)",
                        color: bulkAction === a ? (a === "enable" ? "#10B981" : "#EF4444") : "#4A5580",
                        textTransform: "capitalize",
                      }}
                    >
                      {a}
                    </button>
                  ))}
                </div>

                {bulkProgress && (
                  <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 8, padding: "10px 14px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                      <span style={{ fontSize: "0.75rem", color: "#7A88A6" }}>Progress</span>
                      <span style={{ fontSize: "0.75rem", color: "#C4B5FD" }}>{bulkProgress.done} / {bulkProgress.total}</span>
                    </div>
                    <div style={{ height: 4, borderRadius: 2, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                      <div style={{ height: "100%", borderRadius: 2, background: "linear-gradient(90deg, #8B5CF6, #7C3AED)", width: `${(bulkProgress.done / bulkProgress.total) * 100}%`, transition: "width 200ms" }} />
                    </div>
                  </div>
                )}

                <button
                  onClick={handleBulkApply}
                  disabled={bulkRunning || !selectedIds.size || !bulkWorkflowName.trim()}
                  style={{
                    height: 38, borderRadius: 9, cursor: "pointer", fontWeight: 700, fontSize: "0.875rem",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                    background: bulkRunning ? "rgba(139,92,246,0.15)" : "rgba(139,92,246,0.80)",
                    border: "1px solid rgba(139,92,246,0.40)", color: "#fff",
                    opacity: (!selectedIds.size || !bulkWorkflowName.trim()) ? 0.4 : 1,
                  }}
                >
                  {bulkRunning ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <ChevronRight size={14} />}
                  {bulkRunning ? "Running…" : `Apply to ${selectedIds.size} repo${selectedIds.size !== 1 ? "s" : ""}`}
                </button>

                {bulkResults && !bulkRunning && (
                  <div style={{ background: "rgba(255,255,255,0.025)", borderRadius: 8, padding: "10px 14px", maxHeight: 180, overflowY: "auto" }}>
                    <p style={{ fontSize: "0.6875rem", fontWeight: 700, color: "#4A5580", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.07em" }}>Results</p>
                    {bulkResults.map((r) => (
                      <div key={r.repo} style={{ display: "flex", alignItems: "center", gap: 7, padding: "3px 0" }}>
                        {r.ok ? <CheckCircle2 size={11} style={{ color: "#10B981" }} /> : <XCircle size={11} style={{ color: "#EF4444" }} />}
                        <span style={{ fontSize: "0.75rem", color: r.ok ? "#C8CDD8" : "#EF4444", flex: 1 }}>{r.repo}</span>
                        {r.error && <span style={{ fontSize: "0.6875rem", color: "#EF4444" }}>{r.error}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
