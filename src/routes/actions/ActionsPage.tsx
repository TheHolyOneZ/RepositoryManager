import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  GitBranch, Play, StopCircle, RefreshCw, ExternalLink,
  RotateCcw, CheckCircle2, XCircle, Clock, Loader2, ChevronRight,
  Info, ChevronDown, Package, Download, Plus, Trash2,
} from "lucide-react";
import { RepoPicker } from "../../components/repos/RepoPicker";
import { useRepoStore } from "../../stores/repoStore";
import { useUIStore } from "../../stores/uiStore";
import { fanout } from "../../lib/utils/fanout";
import { formatInvokeError } from "../../lib/formatError";
import {
  ghListWorkflows, ghListWorkflowRuns, ghEnableWorkflow, ghDisableWorkflow,
  ghTriggerWorkflow, ghRerunFailedJobs, openUrlExternal,
  ghListRunArtifacts, repoGetArtifactDownloadUrl, repoDeleteFile,
} from "../../lib/tauri/commands";
import type { Workflow, WorkflowRun, WorkflowArtifact } from "../../types/governance";
import type { Repo } from "../../types/repo";
import { CreateWorkflowPanel } from "./CreateWorkflowPanel";
import { RunLogPanel } from "./RunLogPanel";

type Tab = "workflows" | "runs" | "bulk" | "create";

type CtxMenu =
  | { kind: "workflow"; x: number; y: number; item: Workflow; active: boolean }
  | { kind: "run"; x: number; y: number; item: WorkflowRun };

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

const CTX_ITEM: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 8,
  padding: "7px 12px", cursor: "pointer", fontSize: "0.8125rem",
  borderRadius: 6, transition: "background 80ms",
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
  const [expandedRunId, setExpandedRunId] = useState<number | null>(null);
  const [expandedRunTab, setExpandedRunTab] = useState<"logs" | "artifacts">("logs");
  const [runArtifacts, setRunArtifacts] = useState<Map<number, WorkflowArtifact[]>>(new Map());
  const [loadingArtifacts, setLoadingArtifacts] = useState<Set<number>>(new Set());
  const [downloadingArtifact, setDownloadingArtifact] = useState<Set<number>>(new Set());

  const [triggeringWf, setTriggeringWf] = useState<Set<number>>(new Set());

  const [ctxMenu, setCtxMenu] = useState<CtxMenu | null>(null);
  const [deletingWf, setDeletingWf] = useState<Set<number>>(new Set());
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

    if (triggeringWf.has(wf.id)) {
      setActiveTab("runs");
      return;
    }
    setTriggeringWf(prev => new Set(prev).add(wf.id));
    try {
      await ghTriggerWorkflow(viewingRepo.owner, viewingRepo.name, wf.id, triggerBranch);
      addToast({ type: "success", title: "Workflow dispatched", message: `${wf.name} → ${triggerBranch}` });
    } catch (e) {
      addToast({ type: "error", title: "Dispatch failed", message: formatInvokeError(e) });
      setTriggeringWf(prev => { const s = new Set(prev); s.delete(wf.id); return s; });
    }
  };

  const handleDeleteWorkflow = async (wf: Workflow) => {
    if (!viewingRepo || deletingWf.has(wf.id)) return;
    setDeletingWf(prev => new Set(prev).add(wf.id));
    try {
      const branch = viewingRepo.default_branch;
      await repoDeleteFile(viewingRepo.owner, viewingRepo.name, branch, wf.path, `chore: remove workflow ${wf.name}`);
      setWorkflows(prev => prev.filter(w => w.id !== wf.id));
      addToast({ type: "success", title: "Workflow deleted", message: wf.name });
    } catch (e) {
      addToast({ type: "error", title: "Delete failed", message: formatInvokeError(e) });
    } finally {
      setDeletingWf(prev => { const s = new Set(prev); s.delete(wf.id); return s; });
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

  const ensureArtifactsLoaded = useCallback(async (run: WorkflowRun) => {
    if (runArtifacts.has(run.id) || loadingArtifacts.has(run.id) || !viewingRepo) return;
    setLoadingArtifacts(prev => new Set(prev).add(run.id));
    try {
      const arts = await ghListRunArtifacts(viewingRepo.owner, viewingRepo.name, run.id);
      setRunArtifacts(prev => new Map(prev).set(run.id, arts));
    } catch (e) {
      addToast({ type: "error", title: "Failed to load artifacts", message: formatInvokeError(e) });
    } finally {
      setLoadingArtifacts(prev => { const s = new Set(prev); s.delete(run.id); return s; });
    }
  }, [runArtifacts, loadingArtifacts, viewingRepo, addToast]);

  const handleToggleExpand = useCallback((run: WorkflowRun, defaultTab?: "logs" | "artifacts") => {
    if (expandedRunId === run.id) {
      setExpandedRunId(null);
    } else {
      setExpandedRunId(run.id);
      if (defaultTab) setExpandedRunTab(defaultTab);
    }
  }, [expandedRunId]);

  const handleDownloadArtifact = useCallback(async (artifact: WorkflowArtifact) => {
    if (!viewingRepo || downloadingArtifact.has(artifact.id)) return;
    setDownloadingArtifact(prev => new Set(prev).add(artifact.id));
    try {
      const url = await repoGetArtifactDownloadUrl(viewingRepo.owner, viewingRepo.name, artifact.id);
      await openUrlExternal(url);
    } catch (e) {
      addToast({ type: "error", title: "Download failed", message: formatInvokeError(e) });
    } finally {
      setDownloadingArtifact(prev => { const s = new Set(prev); s.delete(artifact.id); return s; });
    }
  }, [viewingRepo, downloadingArtifact, addToast]);

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
          {(["workflows", "runs", "bulk", "create"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              style={{
                height: 28, padding: "0 12px", borderRadius: 6, cursor: "pointer",
                background: activeTab === t ? "rgba(139,92,246,0.14)" : "transparent",
                border: activeTab === t ? "1px solid rgba(139,92,246,0.28)" : "1px solid transparent",
                color: activeTab === t ? "#C4B5FD" : "#4A5580",
                fontSize: "0.8125rem", fontWeight: 500,
                display: "flex", alignItems: "center", gap: 5,
              }}
            >
              {t === "create" && <Plus size={11} />}
              {t === "bulk" ? "Bulk Ops" : t === "create" ? "Create Workflow" : t.charAt(0).toUpperCase() + t.slice(1)}
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

          {viewingRepo && activeTab !== "bulk" && activeTab !== "create" && (
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

        <div style={{ flex: 1, minHeight: 0, overflow: activeTab === "create" ? "hidden" : "auto", display: "flex", flexDirection: "column" }}>
          {!selectedRepos.length && activeTab !== "bulk" && activeTab !== "create" && (
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
                    const isTriggering = triggeringWf.has(wf.id);
                    const isDeleting = deletingWf.has(wf.id);
                    return (
                      <div
                        key={wf.id}
                        style={{ ...ROW_STYLE, background: "transparent" }}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          setCtxMenu({ kind: "workflow", x: e.clientX, y: e.clientY, item: wf, active });
                        }}
                      >
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
                          title={isTriggering ? "Click to go to Runs tab" : "Trigger workflow_dispatch on the branch above"}
                          style={{
                            display: "flex", alignItems: "center", gap: 4,
                            height: 26, padding: "0 9px", borderRadius: 6, cursor: "pointer",
                            background: isTriggering ? "rgba(245,158,11,0.12)" : "rgba(139,92,246,0.10)",
                            border: isTriggering ? "1px solid rgba(245,158,11,0.28)" : "1px solid rgba(139,92,246,0.20)",
                            color: isTriggering ? "#F59E0B" : "#A78BFA",
                            fontSize: "0.6875rem", fontWeight: 600, transition: "all 150ms",
                          }}
                        >
                          {isTriggering
                            ? <><Loader2 size={10} style={{ animation: "spin 1s linear infinite" }} /> Running…</>
                            : <><Play size={10} /> Run</>
                          }
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
                        <button
                          onClick={() => handleDeleteWorkflow(wf)}
                          disabled={isDeleting}
                          title="Delete workflow file from repo"
                          style={{ display: "flex", padding: 5, borderRadius: 5, cursor: isDeleting ? "not-allowed" : "pointer", background: "transparent", border: "none", color: isDeleting ? "#3A4560" : "#4A3560", transition: "color 120ms" }}
                          onMouseEnter={e => { if (!isDeleting) (e.currentTarget as HTMLButtonElement).style.color = "#EF4444"; }}
                          onMouseLeave={e => { if (!isDeleting) (e.currentTarget as HTMLButtonElement).style.color = "#4A3560"; }}
                        >
                          {isDeleting ? <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} /> : <Trash2 size={12} />}
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
              ) : runs.map((run) => {
                const isExpanded = expandedRunId === run.id;
                const artifacts = runArtifacts.get(run.id) ?? [];
                const loadingArts = loadingArtifacts.has(run.id);
                return (
                  <div key={run.id}>
                    <div
                      style={{ ...ROW_STYLE }}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setCtxMenu({ kind: "run", x: e.clientX, y: e.clientY, item: run });
                      }}
                    >
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
                        <button onClick={() => handleRerunFailed(run)} title="Re-run failed jobs only"
                          style={{ display: "flex", alignItems: "center", gap: 4, height: 26, padding: "0 8px", borderRadius: 6, cursor: "pointer", background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.18)", color: "#F59E0B", fontSize: "0.6875rem" }}>
                          <RotateCcw size={10} />
                        </button>
                      )}
                      {(run.conclusion === "success" || run.conclusion === "failure" || run.conclusion === "cancelled") && (
                        <button onClick={() => { handleToggleExpand(run, "logs"); if (!isExpanded && run.conclusion === "success") ensureArtifactsLoaded(run); }} title={isExpanded ? "Collapse" : "View logs & artifacts"}
                          style={{ display: "flex", alignItems: "center", gap: 4, height: 26, padding: "0 8px", borderRadius: 6, cursor: "pointer", background: isExpanded ? "rgba(139,92,246,0.12)" : "rgba(255,255,255,0.04)", border: isExpanded ? "1px solid rgba(139,92,246,0.22)" : "1px solid rgba(255,255,255,0.08)", color: isExpanded ? "#A78BFA" : "#4A5580", fontSize: "0.6875rem", transition: "all 120ms" }}>
                          <ChevronDown size={10} style={{ transform: isExpanded ? "rotate(180deg)" : "none", transition: "transform 150ms" }} />
                          {loadingArts ? <Loader2 size={9} style={{ animation: "spin 1s linear infinite" }} /> : "Logs"}
                        </button>
                      )}
                      <button onClick={() => openUrlExternal(run.html_url)}
                        style={{ display: "flex", padding: 5, borderRadius: 5, cursor: "pointer", background: "transparent", border: "none", color: "#3A4560" }}>
                        <ExternalLink size={12} />
                      </button>
                    </div>

                    {isExpanded && (
                      <div style={{ margin: "4px 0 10px 32px", borderRadius: 10, border: "1px solid rgba(56,189,248,0.13)", background: "rgba(56,189,248,0.03)", overflow: "hidden" }}>
                        <div style={{ display: "flex", gap: 4, padding: "8px 12px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                          {(["logs", "artifacts"] as const).map((t) => (
                            <button key={t} type="button" onClick={() => { setExpandedRunTab(t); if (t === "artifacts") ensureArtifactsLoaded(run); }}
                              style={{ padding: "3px 12px", borderRadius: 6, cursor: "pointer", border: "none", background: expandedRunTab === t ? "rgba(139,92,246,0.2)" : "transparent", color: expandedRunTab === t ? "#C4B5FD" : "#7A8AAE", fontSize: "0.75rem", fontWeight: 500, textTransform: "capitalize" }}>
                              {t}
                            </button>
                          ))}
                        </div>
                        {expandedRunTab === "logs" && viewingRepo && (
                          <RunLogPanel owner={viewingRepo.owner} repo={viewingRepo.name} runId={run.id} />
                        )}
                        {expandedRunTab === "artifacts" && !loadingArts && (
                        <>
                        {artifacts.length === 0 ? (
                          <p style={{ fontSize: "0.71rem", color: "#3A4560", padding: "10px 14px" }}>No artifacts for this run</p>
                        ) : artifacts.map((art, idx) => {
                          const isDownloading = downloadingArtifact.has(art.id);
                          const sizeMb = (art.size_in_bytes / 1024 / 1024).toFixed(1);
                          return (
                            <div key={art.id} style={{
                              display: "flex", alignItems: "center", gap: 10,
                              padding: "9px 14px",
                              borderTop: idx > 0 ? "1px solid rgba(255,255,255,0.04)" : "none",
                            }}>
                              <Package size={12} style={{ color: "#38BDF8", flexShrink: 0 }} />
                              <span style={{ fontSize: "0.8rem", color: "#A8B4CC", flex: 1, fontWeight: 500 }}>{art.name}</span>
                              <span style={{ fontSize: "0.68rem", color: "#3A4A6A", background: "rgba(255,255,255,0.04)", padding: "2px 7px", borderRadius: 5, border: "1px solid rgba(255,255,255,0.06)" }}>{sizeMb} MB</span>
                              {art.expired ? (
                                <span style={{ fontSize: "0.68rem", color: "#EF4444", padding: "3px 8px", borderRadius: 5, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.15)" }}>Expired</span>
                              ) : (
                                <button onClick={() => handleDownloadArtifact(art)} disabled={isDownloading}
                                  style={{
                                    display: "flex", alignItems: "center", gap: 5,
                                    height: 28, padding: "0 12px",
                                    borderRadius: 7, cursor: isDownloading ? "not-allowed" : "pointer",
                                    background: isDownloading ? "rgba(16,185,129,0.05)" : "rgba(16,185,129,0.10)",
                                    border: "1px solid rgba(16,185,129,0.22)",
                                    color: "#10B981", fontSize: "0.75rem", fontWeight: 600,
                                    transition: "all 120ms",
                                  }}
                                  onMouseEnter={e => { if (!isDownloading) (e.currentTarget as HTMLButtonElement).style.background = "rgba(16,185,129,0.18)"; }}
                                  onMouseLeave={e => { if (!isDownloading) (e.currentTarget as HTMLButtonElement).style.background = "rgba(16,185,129,0.10)"; }}
                                >
                                  {isDownloading ? <Loader2 size={11} style={{ animation: "spin 1s linear infinite" }} /> : <Download size={11} />}
                                  {isDownloading ? "Downloading…" : "Download"}
                                </button>
                              )}
                            </div>
                          );
                        })}
                        </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}


          {activeTab === "create" && (
            <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
              {selectedRepos.length === 0 && (
                <div style={{ padding: "10px 14px 4px", flexShrink: 0 }}>
                  <div style={{ padding: "8px 12px", borderRadius: 8, background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.18)", display: "flex", gap: 8, alignItems: "center" }}>
                    <Info size={13} style={{ color: "#F59E0B", flexShrink: 0 }} />
                    <p style={{ fontSize: "0.75rem", color: "#A07830", margin: 0 }}>Select at least one repo on the left to create workflows.</p>
                  </div>
                </div>
              )}
              <div style={{ flex: 1, minHeight: 0 }}>
                <CreateWorkflowPanel selectedRepos={selectedRepos} />
              </div>
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


      {ctxMenu && (
        <>

          <div
            style={{ position: "fixed", inset: 0, zIndex: 9998 }}
            onClick={() => setCtxMenu(null)}
            onContextMenu={e => { e.preventDefault(); setCtxMenu(null); }}
          />
        <div
          onClick={e => e.stopPropagation()}
          style={{
            position: "fixed", zIndex: 9999,
            left: ctxMenu.x, top: ctxMenu.y,
            background: "#0F1225",
            border: "1px solid rgba(255,255,255,0.10)",
            borderRadius: 10, padding: 5,
            boxShadow: "0 8px 32px rgba(0,0,0,0.55)",
            minWidth: 188,
          }}
        >
          {ctxMenu.kind === "workflow" && (() => {
            const wf = ctxMenu.item;
            const active = ctxMenu.active;
            return (
              <>
                <div style={{ padding: "5px 10px 6px", borderBottom: "1px solid rgba(255,255,255,0.07)", marginBottom: 4 }}>
                  <p style={{ fontSize: "0.75rem", fontWeight: 600, color: "#A0AAC0", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 160 }}>{wf.name}</p>
                  <p style={{ fontSize: "0.6rem", color: "#3A4A6A", margin: "1px 0 0" }}>{wf.path}</p>
                </div>
                <button style={{ ...CTX_ITEM, color: "#A78BFA", width: "100%" }}
                  onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = "rgba(139,92,246,0.10)"}
                  onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = "transparent"}
                  onClick={() => { handleTrigger(wf); setCtxMenu(null); }}>
                  <Play size={12} /> Run workflow
                </button>
                <button style={{ ...CTX_ITEM, color: active ? "#EF4444" : "#10B981", width: "100%" }}
                  onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = active ? "rgba(239,68,68,0.08)" : "rgba(16,185,129,0.08)"}
                  onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = "transparent"}
                  onClick={() => { handleEnableDisable(wf, !active); setCtxMenu(null); }}>
                  {active ? <StopCircle size={12} /> : <Play size={12} />}
                  {active ? "Disable workflow" : "Enable workflow"}
                </button>
                <button style={{ ...CTX_ITEM, color: "#60A5FA", width: "100%" }}
                  onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = "rgba(96,165,250,0.08)"}
                  onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = "transparent"}
                  onClick={() => { openUrlExternal(wf.html_url); setCtxMenu(null); }}>
                  <ExternalLink size={12} /> Open on GitHub
                </button>
                <div style={{ height: 1, background: "rgba(255,255,255,0.07)", margin: "4px 0" }} />
                <button style={{ ...CTX_ITEM, color: "#EF4444", width: "100%" }}
                  onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = "rgba(239,68,68,0.08)"}
                  onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = "transparent"}
                  onClick={() => { handleDeleteWorkflow(wf); setCtxMenu(null); }}>
                  <Trash2 size={12} /> Delete workflow file
                </button>
              </>
            );
          })()}

          {ctxMenu.kind === "run" && (() => {
            const run = ctxMenu.item;
            return (
              <>
                <div style={{ padding: "5px 10px 6px", borderBottom: "1px solid rgba(255,255,255,0.07)", marginBottom: 4 }}>
                  <p style={{ fontSize: "0.75rem", fontWeight: 600, color: "#A0AAC0", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 160 }}>{run.name ?? `Run #${run.id}`}</p>
                  <p style={{ fontSize: "0.6rem", color: "#3A4A6A", margin: "1px 0 0" }}>{run.event} · {run.head_branch}</p>
                </div>
                {run.conclusion === "failure" && (
                  <button style={{ ...CTX_ITEM, color: "#F59E0B", width: "100%" }}
                    onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = "rgba(245,158,11,0.08)"}
                    onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = "transparent"}
                    onClick={() => { handleRerunFailed(run); setCtxMenu(null); }}>
                    <RotateCcw size={12} /> Re-run failed jobs
                  </button>
                )}
                {(run.conclusion === "success" || run.conclusion === "failure") && (
                  <button style={{ ...CTX_ITEM, color: "#38BDF8", width: "100%" }}
                    onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = "rgba(56,189,248,0.08)"}
                    onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = "transparent"}
                    onClick={() => { handleToggleExpand(run); setCtxMenu(null); }}>
                    <Package size={12} /> {expandedRunId === run.id ? "Collapse panel" : "View logs & artifacts"}
                  </button>
                )}
                <button style={{ ...CTX_ITEM, color: "#60A5FA", width: "100%" }}
                  onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = "rgba(96,165,250,0.08)"}
                  onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = "transparent"}
                  onClick={() => { openUrlExternal(run.html_url); setCtxMenu(null); }}>
                  <ExternalLink size={12} /> Open on GitHub
                </button>
              </>
            );
          })()}
        </div>
        </>
      )}
    </div>
  );
};
