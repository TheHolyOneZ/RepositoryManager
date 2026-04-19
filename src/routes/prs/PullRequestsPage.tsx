import React, { useState, useEffect, useCallback } from "react";
import {
  GitPullRequest, RefreshCw, Plus, Loader2, ChevronDown, ChevronRight,
  GitMerge, X, ExternalLink, CheckCircle2, CheckSquare, Square,
  MessageSquare, FileText, Star, Tag, Users, Flag, Milestone as MilestoneIcon,
} from "lucide-react";
import { RepoPicker } from "../../components/repos/RepoPicker";
import { useRepoStore } from "../../stores/repoStore";
import { useUIStore } from "../../stores/uiStore";
import { fanout } from "../../lib/utils/fanout";
import { formatInvokeError } from "../../lib/formatError";
import {
  ghListPullRequests, ghCreatePullRequest, ghUpdatePullRequest, ghMergePullRequest,
  ghListPrFiles, ghListPrReviews, ghCreatePrReview, ghListPrComments, ghCreatePrComment,
  ghRequestReviewers, ghListRepoBranchesSimple, ghListRepoCollaboratorsSimple,
  ghConvertPrToReady, ghAddPrAssignees, ghRemovePrAssignees, ghRemovePrLabel, ghSetPrMilestone,
  ghListLabels, ghListMilestones, ghAddLabelsToIssue,
  openUrlExternal,
} from "../../lib/tauri/commands";
import type { PullRequest, PrFile, PrReview, PrComment, IssueLabel, Milestone } from "../../types/governance";
import type { Repo } from "../../types/repo";

type Tab = "list" | "create" | "bulk";
type StateFilter = "open" | "closed" | "all";
type DetailTab = "files" | "reviews" | "comments" | "details";

function fmtDate(iso: string) {
  try { return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" }); }
  catch { return iso; }
}

function renderMarkdown(md: string): string {
  return md
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/`(.+?)`/g, "<code style='background:rgba(255,255,255,0.08);padding:1px 5px;border-radius:4px;font-size:0.85em'>$1</code>")
    .replace(/\n/g, "<br/>");
}

const REVIEW_COLOR: Record<string, string> = {
  APPROVED: "#10B981", CHANGES_REQUESTED: "#EF4444", COMMENTED: "#F59E0B", DISMISSED: "#6B7280",
};

const INPUT: React.CSSProperties = {
  width: "100%", height: 34, borderRadius: 8,
  backgroundColor: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)",
  color: "#C8CDD8", fontSize: "0.875rem", padding: "0 12px", outline: "none",
};

const PATCH_LINE_COLOR = (line: string): string => {
  if (line.startsWith("+")) return "rgba(16,185,129,0.08)";
  if (line.startsWith("-")) return "rgba(239,68,68,0.08)";
  if (line.startsWith("@@")) return "rgba(99,102,241,0.08)";
  return "transparent";
};

const PATCH_TEXT_COLOR = (line: string): string => {
  if (line.startsWith("+")) return "#86EFAC";
  if (line.startsWith("-")) return "#FCA5A5";
  if (line.startsWith("@@")) return "#A5B4FC";
  return "#7A8AAE";
};

export const PullRequestsPage: React.FC = () => {
  const repos = useRepoStore((s) => s.repos);
  const addToast = useUIStore((s) => s.addToast);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [viewingId, setViewingId] = useState<string>("");
  const [activeTab, setActiveTab] = useState<Tab>("list");
  const [stateFilter, setStateFilter] = useState<StateFilter>("open");
  const [search, setSearch] = useState("");
  const [prs, setPrs] = useState<PullRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>("files");
  const [prFiles, setPrFiles] = useState<PrFile[]>([]);
  const [prReviews, setPrReviews] = useState<PrReview[]>([]);
  const [prComments, setPrComments] = useState<PrComment[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [mergeMethod, setMergeMethod] = useState<"merge" | "squash" | "rebase">("merge");
  const [mergeLoading, setMergeLoading] = useState(false);
  const [reviewBody, setReviewBody] = useState("");
  const [reviewLoading, setReviewLoading] = useState(false);
  const [commentBody, setCommentBody] = useState("");
  const [commentLoading, setCommentLoading] = useState(false);
  const [branches, setBranches] = useState<string[]>([]);
  const [collaborators, setCollaborators] = useState<string[]>([]);
  const [repoLabels, setRepoLabels] = useState<IssueLabel[]>([]);
  const [repoMilestones, setRepoMilestones] = useState<Milestone[]>([]);
  const [expandedPr, setExpandedPr] = useState<PullRequest | null>(null);
  const [readyLoading, setReadyLoading] = useState(false);
  const [createForm, setCreateForm] = useState({ title: "", body: "", head: "", base: "main", draft: false });
  const [createReviewers, setCreateReviewers] = useState<string[]>([]);
  const [createLoading, setCreateLoading] = useState(false);
  const [bulkSelected, setBulkSelected] = useState<Set<number>>(new Set());
  const [bulkRunning, setBulkRunning] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null);
  const [bulkResults, setBulkResults] = useState<Array<{ key: string; ok: boolean; error?: string }> | null>(null);

  const viewingRepo: Repo | undefined = repos.find((r) => r.id === viewingId) ?? repos.find((r) => selectedIds.has(r.id));

  const loadPrs = useCallback(async () => {
    if (!viewingRepo) return;
    setLoading(true);
    try {
      const data = await ghListPullRequests(viewingRepo.owner, viewingRepo.name, stateFilter, 50);
      setPrs(data);
      setExpandedId(null);
    } catch (e) {
      addToast({ type: "error", title: "Failed to load PRs", message: formatInvokeError(e) });
    } finally {
      setLoading(false);
    }
  }, [viewingRepo, stateFilter, addToast]);

  useEffect(() => { if (viewingRepo) loadPrs(); }, [viewingRepo?.id, stateFilter]);

  useEffect(() => {
    if (!viewingRepo) return;
    ghListRepoBranchesSimple(viewingRepo.owner, viewingRepo.name).then(setBranches).catch(() => {});
    ghListRepoCollaboratorsSimple(viewingRepo.owner, viewingRepo.name).then(setCollaborators).catch(() => {});
    ghListLabels(viewingRepo.owner, viewingRepo.name).then(setRepoLabels).catch(() => {});
    ghListMilestones(viewingRepo.owner, viewingRepo.name).then(setRepoMilestones).catch(() => {});
  }, [viewingRepo?.id]);

  const loadDetail = async (pr: PullRequest, tab: DetailTab) => {
    if (!viewingRepo) return;
    setDetailLoading(true);
    try {
      if (tab === "files") {
        const files = await ghListPrFiles(viewingRepo.owner, viewingRepo.name, pr.number);
        setPrFiles(files);
      } else if (tab === "reviews") {
        const reviews = await ghListPrReviews(viewingRepo.owner, viewingRepo.name, pr.number);
        setPrReviews(reviews);
      } else {
        const comments = await ghListPrComments(viewingRepo.owner, viewingRepo.name, pr.number);
        setPrComments(comments);
      }
    } catch (e) {
      addToast({ type: "error", title: "Failed to load", message: formatInvokeError(e) });
    } finally {
      setDetailLoading(false);
    }
  };

  const toggleExpand = (pr: PullRequest) => {
    if (expandedId === pr.id) { setExpandedId(null); setExpandedPr(null); return; }
    setExpandedId(pr.id);
    setExpandedPr(pr);
    setDetailTab("files");
    loadDetail(pr, "files");
  };

  const switchDetailTab = (pr: PullRequest, tab: DetailTab) => {
    setDetailTab(tab);
    if (tab !== "details") loadDetail(pr, tab);
  };

  const handleMerge = async (pr: PullRequest) => {
    if (!viewingRepo) return;
    setMergeLoading(true);
    try {
      await ghMergePullRequest(viewingRepo.owner, viewingRepo.name, pr.number, mergeMethod);
      addToast({ type: "success", title: `PR #${pr.number} merged` });
      loadPrs();
    } catch (e) {
      addToast({ type: "error", title: "Merge failed", message: formatInvokeError(e) });
    } finally {
      setMergeLoading(false);
    }
  };

  const handleClose = async (pr: PullRequest) => {
    if (!viewingRepo) return;
    try {
      await ghUpdatePullRequest(viewingRepo.owner, viewingRepo.name, pr.number, "closed");
      setPrs((prev) => prev.map((p) => p.id === pr.id ? { ...p, state: "closed" } : p));
      addToast({ type: "success", title: `PR #${pr.number} closed` });
    } catch (e) {
      addToast({ type: "error", title: "Failed", message: formatInvokeError(e) });
    }
  };

  const handleSubmitReview = async (pr: PullRequest, event: "APPROVE" | "REQUEST_CHANGES" | "COMMENT") => {
    if (!viewingRepo) return;
    setReviewLoading(true);
    try {
      const review = await ghCreatePrReview(viewingRepo.owner, viewingRepo.name, pr.number, event, reviewBody);
      setPrReviews((prev) => [...prev, review]);
      setReviewBody("");
      addToast({ type: "success", title: "Review submitted" });
    } catch (e) {
      addToast({ type: "error", title: "Failed", message: formatInvokeError(e) });
    } finally {
      setReviewLoading(false);
    }
  };

  const handlePostComment = async (pr: PullRequest) => {
    if (!viewingRepo || !commentBody.trim()) return;
    setCommentLoading(true);
    try {
      const c = await ghCreatePrComment(viewingRepo.owner, viewingRepo.name, pr.number, commentBody);
      setPrComments((prev) => [...prev, c]);
      setCommentBody("");
    } catch (e) {
      addToast({ type: "error", title: "Failed", message: formatInvokeError(e) });
    } finally {
      setCommentLoading(false);
    }
  };

  const handleMarkAsReady = async (pr: PullRequest) => {
    if (!viewingRepo) return;
    setReadyLoading(true);
    try {
      const updated = await ghConvertPrToReady(viewingRepo.owner, viewingRepo.name, pr.number);
      setPrs((prev) => prev.map((p) => p.id === pr.id ? updated : p));
      setExpandedPr(updated);
      addToast({ type: "success", title: `PR #${pr.number} is now ready for review` });
    } catch (e) {
      addToast({ type: "error", title: "Failed", message: formatInvokeError(e) });
    } finally {
      setReadyLoading(false);
    }
  };

  const handleTogglePrLabel = async (pr: PullRequest, label: IssueLabel) => {
    if (!viewingRepo) return;
    const hasLabel = pr.labels.some((l) => l.name === label.name);
    try {
      if (hasLabel) {
        await ghRemovePrLabel(viewingRepo.owner, viewingRepo.name, pr.number, label.name);
        const updated = { ...pr, labels: pr.labels.filter((l) => l.name !== label.name) };
        setPrs((prev) => prev.map((p) => p.id === pr.id ? updated : p));
        setExpandedPr(updated);
      } else {
        await ghAddLabelsToIssue(viewingRepo.owner, viewingRepo.name, pr.number, [label.name]);
        const updated = { ...pr, labels: [...pr.labels, { name: label.name, color: label.color }] };
        setPrs((prev) => prev.map((p) => p.id === pr.id ? updated : p));
        setExpandedPr(updated);
      }
    } catch (e) {
      addToast({ type: "error", title: "Label update failed", message: formatInvokeError(e) });
    }
  };

  const handleTogglePrAssignee = async (pr: PullRequest, login: string) => {
    if (!viewingRepo) return;
    const assigned = pr.assignees.includes(login);
    try {
      if (assigned) {
        await ghRemovePrAssignees(viewingRepo.owner, viewingRepo.name, pr.number, [login]);
        const updated = { ...pr, assignees: pr.assignees.filter((a) => a !== login) };
        setPrs((prev) => prev.map((p) => p.id === pr.id ? updated : p));
        setExpandedPr(updated);
      } else {
        await ghAddPrAssignees(viewingRepo.owner, viewingRepo.name, pr.number, [login]);
        const updated = { ...pr, assignees: [...pr.assignees, login] };
        setPrs((prev) => prev.map((p) => p.id === pr.id ? updated : p));
        setExpandedPr(updated);
      }
    } catch (e) {
      addToast({ type: "error", title: "Assignee update failed", message: formatInvokeError(e) });
    }
  };

  const handleSetPrMilestone = async (pr: PullRequest, milestoneId: number | null) => {
    if (!viewingRepo) return;
    try {
      await ghSetPrMilestone(viewingRepo.owner, viewingRepo.name, pr.number, milestoneId);
      addToast({ type: "success", title: "Milestone updated" });
    } catch (e) {
      addToast({ type: "error", title: "Failed", message: formatInvokeError(e) });
    }
  };

  const handleCreate = async () => {
    if (!viewingRepo || !createForm.title.trim() || !createForm.head || !createForm.base) return;
    setCreateLoading(true);
    try {
      const pr = await ghCreatePullRequest(viewingRepo.owner, viewingRepo.name, createForm.title, createForm.body, createForm.head, createForm.base, createForm.draft);
      if (createReviewers.length > 0) {
        await ghRequestReviewers(viewingRepo.owner, viewingRepo.name, pr.number, createReviewers).catch(() => {});
      }
      setPrs((prev) => [pr, ...prev]);
      addToast({ type: "success", title: `PR #${pr.number} created` });
      setActiveTab("list");
      setCreateForm({ title: "", body: "", head: "", base: "main", draft: false });
      setCreateReviewers([]);
    } catch (e) {
      addToast({ type: "error", title: "Failed to create PR", message: formatInvokeError(e) });
    } finally {
      setCreateLoading(false);
    }
  };

  const handleBulkClose = async () => {
    if (!viewingRepo || bulkSelected.size === 0) return;
    const targets = prs.filter((p) => bulkSelected.has(p.id) && p.state === "open");
    setBulkRunning(true);
    setBulkProgress({ done: 0, total: targets.length });
    setBulkResults(null);
    const raw = await fanout(targets, 4, async (pr) => {
      await ghUpdatePullRequest(viewingRepo.owner, viewingRepo.name, pr.number, "closed");
      setBulkProgress((p) => p ? { ...p, done: p.done + 1 } : null);
    });
    setBulkResults(raw.map((r) => ({ key: `#${(r.item as PullRequest).number} ${(r.item as PullRequest).title}`, ok: r.ok, error: r.error })));
    setBulkRunning(false);
    setBulkSelected(new Set());
    loadPrs();
  };

  const filtered = prs.filter((p) => {
    if (!search) return true;
    return p.title.toLowerCase().includes(search.toLowerCase()) || p.user_login.toLowerCase().includes(search.toLowerCase());
  });

  const TAB_STYLE = (active: boolean): React.CSSProperties => ({
    padding: "6px 16px", borderRadius: 8, cursor: "pointer", border: "none",
    background: active ? "rgba(139,92,246,0.18)" : "transparent",
    color: active ? "#C4B5FD" : "#7A8AAE", fontSize: "0.8125rem", fontWeight: 500,
    transition: "all 130ms ease",
  });

  const DETAIL_TAB = (active: boolean): React.CSSProperties => ({
    padding: "4px 12px", borderRadius: 6, cursor: "pointer", border: "none",
    background: active ? "rgba(139,92,246,0.15)" : "transparent",
    color: active ? "#C4B5FD" : "#7A8AAE", fontSize: "0.75rem", fontWeight: 500,
  });

  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden" }}>
      <RepoPicker
        selectedIds={selectedIds}
        onToggle={(id) => { setSelectedIds((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; }); setViewingId(id); }}
        onSelectAll={() => setSelectedIds(new Set(repos.map((r) => r.id)))}
        onClearAll={() => setSelectedIds(new Set())}
      />

      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", padding: "20px 24px 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <GitPullRequest size={18} style={{ color: "#8B5CF6" }} />
          <h1 style={{ fontSize: "1.125rem", fontWeight: 700, color: "#D4D8E8" }}>Pull Requests</h1>
          {viewingRepo && <span style={{ fontSize: "0.8125rem", color: "#4A5580" }}>{viewingRepo.full_name}</span>}
          <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
            <button type="button" style={TAB_STYLE(activeTab === "list")} onClick={() => setActiveTab("list")}>List</button>
            <button type="button" style={TAB_STYLE(activeTab === "create")} onClick={() => setActiveTab("create")}>
              <Plus size={13} style={{ display: "inline", marginRight: 4 }} />Create
            </button>
            <button type="button" style={TAB_STYLE(activeTab === "bulk")} onClick={() => setActiveTab("bulk")}>Bulk</button>
          </div>
        </div>

        {activeTab === "list" && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center" }}>
              {(["open", "closed", "all"] as StateFilter[]).map((s) => (
                <button key={s} type="button" onClick={() => setStateFilter(s)}
                  style={{ padding: "4px 12px", borderRadius: 7, cursor: "pointer", border: "none", background: stateFilter === s ? "rgba(139,92,246,0.18)" : "rgba(255,255,255,0.04)", color: stateFilter === s ? "#C4B5FD" : "#7A8AAE", fontSize: "0.8125rem", fontWeight: 500, textTransform: "capitalize" }}>
                  {s}
                </button>
              ))}
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…"
                style={{ ...INPUT, width: 200, height: 30, marginLeft: "auto" }} />
              <button type="button" onClick={loadPrs} title="Refresh"
                style={{ padding: 6, borderRadius: 7, border: "none", background: "rgba(255,255,255,0.05)", color: "#7A8AAE", cursor: "pointer" }}>
                <RefreshCw size={14} style={loading ? { animation: "spin 1s linear infinite" } : {}} />
              </button>
            </div>

            {!viewingRepo ? (
              <div style={{ padding: 32, textAlign: "center", color: "#4A5580", fontSize: "0.875rem" }}>Select a repository</div>
            ) : loading ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 120, gap: 8, color: "#7A8AAE" }}>
                <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /><span>Loading PRs…</span>
              </div>
            ) : (
              <div style={{ flex: 1, overflowY: "auto" }}>
                {filtered.length === 0 && <div style={{ padding: 32, textAlign: "center", color: "#4A5580", fontSize: "0.875rem" }}>No pull requests found.</div>}
                {filtered.map((pr) => (
                  <div key={pr.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.055)", marginBottom: 1 }}>
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", cursor: "pointer", borderRadius: 8, background: expandedId === pr.id ? "rgba(139,92,246,0.07)" : "transparent", transition: "background 120ms ease" }}
                      onClick={() => toggleExpand(pr)}
                    >
                      {pr.state === "open"
                        ? <GitPullRequest size={15} style={{ color: "#10B981", flexShrink: 0 }} />
                        : pr.state === "closed"
                        ? <X size={15} style={{ color: "#EF4444", flexShrink: 0 }} />
                        : <GitMerge size={15} style={{ color: "#8B5CF6", flexShrink: 0 }} />}
                      <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#C8CDD8", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        #{pr.number} {pr.title}
                      </span>
                      {pr.draft && <span style={{ fontSize: "0.6875rem", padding: "1px 6px", borderRadius: 6, background: "rgba(107,114,128,0.15)", color: "#9CA3AF", fontWeight: 600 }}>Draft</span>}
                      <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                        {pr.labels.slice(0, 2).map((l) => (
                          <span key={l.name} style={{ fontSize: "0.625rem", padding: "1px 6px", borderRadius: 8, background: `#${l.color}22`, color: `#${l.color}`, border: `1px solid #${l.color}33`, fontWeight: 600 }}>
                            {l.name}
                          </span>
                        ))}
                      </div>
                      <span style={{ fontSize: "0.6875rem", color: "#5A6A8A", flexShrink: 0, fontFamily: "monospace" }}>{pr.head_ref} → {pr.base_ref}</span>
                      <span style={{ fontSize: "0.6875rem", color: "#4A5580", flexShrink: 0 }}>
                        <img src={pr.user_avatar} alt={pr.user_login} style={{ width: 16, height: 16, borderRadius: "50%", verticalAlign: "middle", marginRight: 4 }} />
                        {pr.user_login}
                      </span>
                      <span style={{ fontSize: "0.6875rem", color: "#3A4560", flexShrink: 0 }}>{fmtDate(pr.updated_at)}</span>
                      {expandedId === pr.id ? <ChevronDown size={13} style={{ color: "#6B7280" }} /> : <ChevronRight size={13} style={{ color: "#6B7280" }} />}
                    </div>

                    {expandedId === pr.id && (
                      <div style={{ padding: "0 16px 16px 40px" }}>
                        {pr.body && (
                          <div style={{ fontSize: "0.8125rem", color: "#9AA5BE", lineHeight: 1.7, marginBottom: 12, padding: "10px 14px", background: "rgba(255,255,255,0.025)", borderRadius: 8 }}
                            dangerouslySetInnerHTML={{ __html: renderMarkdown(pr.body) }} />
                        )}
                        <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center", flexWrap: "wrap" }}>
                          {pr.draft && pr.state === "open" && (
                            <button type="button" onClick={() => handleMarkAsReady(pr)} disabled={readyLoading}
                              style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 7, cursor: "pointer", border: "1px solid rgba(16,185,129,0.3)", background: "rgba(16,185,129,0.10)", color: "#6EE7B7", fontSize: "0.8125rem" }}>
                              {readyLoading ? <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} /> : <CheckCircle2 size={12} />}
                              Mark as Ready
                            </button>
                          )}
                          {pr.state === "open" && !pr.draft && (
                            <>
                              <div style={{ display: "flex", gap: 0, borderRadius: 8, overflow: "hidden", border: "1px solid rgba(139,92,246,0.3)" }}>
                                <button type="button" onClick={() => handleMerge(pr)} disabled={mergeLoading}
                                  style={{ padding: "5px 14px", cursor: "pointer", border: "none", background: "rgba(139,92,246,0.2)", color: "#C4B5FD", fontSize: "0.8125rem", fontWeight: 600, display: "flex", alignItems: "center", gap: 5 }}>
                                  <GitMerge size={13} />{mergeLoading ? "Merging…" : "Merge"}
                                </button>
                                <select value={mergeMethod} onChange={(e) => setMergeMethod(e.target.value as typeof mergeMethod)}
                                  style={{ padding: "0 8px", cursor: "pointer", border: "none", borderLeft: "1px solid rgba(139,92,246,0.3)", backgroundColor: "rgba(139,92,246,0.12)", color: "#C4B5FD", fontSize: "0.75rem" }}>
                                  <option value="merge">Merge</option>
                                  <option value="squash">Squash</option>
                                  <option value="rebase">Rebase</option>
                                </select>
                              </div>
                            </>
                          )}
                          {pr.state === "open" && (
                            <button type="button" onClick={() => handleClose(pr)}
                              style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 7, cursor: "pointer", border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.08)", color: "#FCA5A5", fontSize: "0.8125rem" }}>
                              <X size={12} />Close
                            </button>
                          )}
                          <button type="button" onClick={() => openUrlExternal(pr.html_url)}
                            style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 7, cursor: "pointer", border: "1px solid rgba(255,255,255,0.10)", background: "transparent", color: "#7A8AAE", fontSize: "0.8125rem" }}>
                            <ExternalLink size={12} />GitHub
                          </button>
                        </div>

                        <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
                          {(["files", "reviews", "comments", "details"] as DetailTab[]).map((t) => (
                            <button key={t} type="button" style={DETAIL_TAB(detailTab === t)}
                              onClick={() => switchDetailTab(pr, t)}>
                              {t === "files" ? <><FileText size={11} style={{ display: "inline", marginRight: 4 }} />Files</> :
                               t === "reviews" ? <><Star size={11} style={{ display: "inline", marginRight: 4 }} />Reviews</> :
                               t === "details" ? <><Tag size={11} style={{ display: "inline", marginRight: 4 }} />Details</> :
                               <><MessageSquare size={11} style={{ display: "inline", marginRight: 4 }} />Comments</>}
                            </button>
                          ))}
                        </div>

                        {detailLoading && (
                          <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#7A8AAE", fontSize: "0.8125rem" }}>
                            <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} />Loading…
                          </div>
                        )}

                        {!detailLoading && detailTab === "files" && (
                          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            {prFiles.map((f) => (
                              <div key={f.filename} style={{ background: "rgba(255,255,255,0.025)", borderRadius: 8, overflow: "hidden" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 12px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                                  <span style={{ flex: 1, fontSize: "0.7813rem", color: "#C8CDD8", fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.filename}</span>
                                  <span style={{ fontSize: "0.6875rem", color: "#86EFAC" }}>+{f.additions}</span>
                                  <span style={{ fontSize: "0.6875rem", color: "#FCA5A5" }}>-{f.deletions}</span>
                                  <span style={{ fontSize: "0.6875rem", padding: "1px 6px", borderRadius: 5, fontWeight: 600,
                                    background: f.status === "added" ? "rgba(16,185,129,0.15)" : f.status === "removed" ? "rgba(239,68,68,0.15)" : "rgba(245,158,11,0.15)",
                                    color: f.status === "added" ? "#6EE7B7" : f.status === "removed" ? "#FCA5A5" : "#FCD34D" }}>
                                    {f.status}
                                  </span>
                                </div>
                                {f.patch && (
                                  <div style={{ fontFamily: "monospace", fontSize: "0.6875rem", lineHeight: 1.7, overflow: "auto", maxHeight: 300 }}>
                                    {f.patch.split("\n").map((line, i) => (
                                      <div key={i} style={{ padding: "0 12px", background: PATCH_LINE_COLOR(line), color: PATCH_TEXT_COLOR(line), whiteSpace: "pre" }}>{line || " "}</div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                            {prFiles.length === 0 && <div style={{ color: "#4A5580", fontSize: "0.8125rem" }}>No files changed.</div>}
                          </div>
                        )}

                        {!detailLoading && detailTab === "reviews" && (
                          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            {prReviews.map((review) => (
                              <div key={review.id} style={{ padding: "8px 12px", background: "rgba(255,255,255,0.025)", borderRadius: 8 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: review.body ? 6 : 0 }}>
                                  <img src={review.user_avatar} alt={review.user_login} style={{ width: 18, height: 18, borderRadius: "50%" }} />
                                  <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#C8CDD8" }}>{review.user_login}</span>
                                  <span style={{ fontSize: "0.625rem", fontWeight: 700, padding: "1px 6px", borderRadius: 6,
                                    background: `${REVIEW_COLOR[review.state] ?? "#6B7280"}20`,
                                    color: REVIEW_COLOR[review.state] ?? "#9CA3AF" }}>
                                    {review.state.replace("_", " ")}
                                  </span>
                                  <span style={{ fontSize: "0.6875rem", color: "#3A4560", marginLeft: "auto" }}>{review.submitted_at ? fmtDate(review.submitted_at) : ""}</span>
                                </div>
                                {review.body && <div style={{ fontSize: "0.8125rem", color: "#9AA5BE", lineHeight: 1.6 }} dangerouslySetInnerHTML={{ __html: renderMarkdown(review.body) }} />}
                              </div>
                            ))}
                            {pr.state === "open" && (
                              <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
                                <textarea value={reviewBody} onChange={(e) => setReviewBody(e.target.value)}
                                  placeholder="Leave a review comment…"
                                  style={{ width: "100%", minHeight: 80, borderRadius: 8, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)", color: "#C8CDD8", fontSize: "0.8125rem", padding: "8px 12px", outline: "none", resize: "vertical" }} />
                                <div style={{ display: "flex", gap: 8 }}>
                                  {[["APPROVE", "#10B981", "Approve"], ["REQUEST_CHANGES", "#EF4444", "Request Changes"], ["COMMENT", "#F59E0B", "Comment"]] .map(([event, color, label]) => (
                                    <button key={event} type="button" onClick={() => handleSubmitReview(pr, event as "APPROVE" | "REQUEST_CHANGES" | "COMMENT")} disabled={reviewLoading}
                                      style={{ padding: "5px 12px", borderRadius: 7, cursor: "pointer", border: "none", background: `${color}20`, color: color, fontSize: "0.8125rem", fontWeight: 500 }}>
                                      {label}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {!detailLoading && detailTab === "comments" && (
                          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            {prComments.map((c) => (
                              <div key={c.id} style={{ padding: "8px 12px", background: "rgba(255,255,255,0.025)", borderRadius: 8 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                                  <img src={c.user_avatar} alt={c.user_login} style={{ width: 18, height: 18, borderRadius: "50%" }} />
                                  <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#C8CDD8" }}>{c.user_login}</span>
                                  <span style={{ fontSize: "0.6875rem", color: "#3A4560" }}>{fmtDate(c.created_at)}</span>
                                </div>
                                <div style={{ fontSize: "0.8125rem", color: "#9AA5BE", lineHeight: 1.6 }} dangerouslySetInnerHTML={{ __html: renderMarkdown(c.body) }} />
                              </div>
                            ))}
                            <textarea value={commentBody} onChange={(e) => setCommentBody(e.target.value)}
                              placeholder="Write a comment…"
                              style={{ width: "100%", minHeight: 80, borderRadius: 8, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)", color: "#C8CDD8", fontSize: "0.8125rem", padding: "8px 12px", outline: "none", resize: "vertical" }} />
                            <button type="button" onClick={() => handlePostComment(pr)} disabled={commentLoading || !commentBody.trim()}
                              style={{ alignSelf: "flex-end", padding: "6px 18px", borderRadius: 8, cursor: "pointer", border: "none", background: "rgba(139,92,246,0.25)", color: "#C4B5FD", fontSize: "0.8125rem", fontWeight: 600, opacity: commentLoading || !commentBody.trim() ? 0.5 : 1 }}>
                              {commentLoading ? "Posting…" : "Post Comment"}
                            </button>
                          </div>
                        )}

                        {detailTab === "details" && (() => {
                          const livePr = expandedPr?.id === pr.id ? expandedPr : pr;
                          return (
                            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>


                              <div>
                                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                                  <Tag size={12} style={{ color: "#7A8AAE" }} />
                                  <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#7A8AAE", textTransform: "uppercase", letterSpacing: "0.08em" }}>Labels</span>
                                </div>
                                {repoLabels.length === 0 ? (
                                  <p style={{ fontSize: "0.75rem", color: "#3A4560", fontStyle: "italic" }}>No labels in this repo.</p>
                                ) : (
                                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                    {repoLabels.map((lbl) => {
                                      const active = livePr.labels.some((l) => l.name === lbl.name);
                                      return (
                                        <button key={lbl.name} type="button"
                                          onClick={() => handleTogglePrLabel(livePr, lbl)}
                                          style={{
                                            padding: "3px 10px", borderRadius: 10, cursor: "pointer",
                                            background: active ? `#${lbl.color}28` : `#${lbl.color}0D`,
                                            border: active ? `1.5px solid #${lbl.color}80` : `1px solid #${lbl.color}30`,
                                            color: `#${lbl.color}`, fontSize: "0.75rem", fontWeight: 600,
                                            transition: "all 120ms",
                                          }}>
                                          {active && <span style={{ marginRight: 4 }}>✓</span>}{lbl.name}
                                        </button>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>


                              <div>
                                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                                  <Users size={12} style={{ color: "#7A8AAE" }} />
                                  <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#7A8AAE", textTransform: "uppercase", letterSpacing: "0.08em" }}>Assignees</span>
                                </div>
                                {livePr.assignees.length > 0 && (
                                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                                    {livePr.assignees.map((login) => (
                                      <div key={login} style={{ display: "flex", alignItems: "center", gap: 5, padding: "3px 8px 3px 6px", borderRadius: 20, background: "rgba(139,92,246,0.12)", border: "1px solid rgba(139,92,246,0.28)" }}>
                                        <span style={{ fontSize: "0.75rem", color: "#C4B5FD", fontWeight: 500 }}>{login}</span>
                                        <button type="button" onClick={() => handleTogglePrAssignee(livePr, login)}
                                          style={{ background: "none", border: "none", cursor: "pointer", color: "#A78BFA", padding: 0, display: "flex" }}>
                                          <X size={11} />
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                )}
                                {collaborators.length === 0 ? (
                                  <p style={{ fontSize: "0.75rem", color: "#3A4560", fontStyle: "italic" }}>No collaborators found.</p>
                                ) : (
                                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                                    {collaborators.filter((c) => !livePr.assignees.includes(c)).map((c) => (
                                      <button key={c} type="button"
                                        onClick={() => handleTogglePrAssignee(livePr, c)}
                                        style={{ padding: "3px 9px", borderRadius: 7, cursor: "pointer", border: "1px solid rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.04)", color: "#9AA5BE", fontSize: "0.75rem" }}>
                                        + {c}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>


                              {repoMilestones.length > 0 && (
                                <div>
                                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                                    <Flag size={12} style={{ color: "#7A8AAE" }} />
                                    <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#7A8AAE", textTransform: "uppercase", letterSpacing: "0.08em" }}>Milestone</span>
                                  </div>
                                  <select
                                    defaultValue=""
                                    onChange={(e) => handleSetPrMilestone(livePr, e.target.value ? Number(e.target.value) : null)}
                                    style={{ height: 32, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)", color: "#C8CDD8", fontSize: "0.8125rem", padding: "0 10px", cursor: "pointer" }}>
                                    <option value="">No milestone</option>
                                    {repoMilestones.map((m) => (
                                      <option key={m.number} value={m.number}>{m.title}</option>
                                    ))}
                                  </select>
                                </div>
                              )}

                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "create" && (
          <div style={{ maxWidth: 640, display: "flex", flexDirection: "column", gap: 14 }}>
            {!viewingRepo && <div style={{ color: "#F59E0B", fontSize: "0.875rem" }}>Select a repository first.</div>}
            <div>
              <label style={{ fontSize: "0.75rem", color: "#7A8AAE", marginBottom: 4, display: "block" }}>Title *</label>
              <input value={createForm.title} onChange={(e) => setCreateForm((f) => ({ ...f, title: e.target.value }))} placeholder="PR title" style={INPUT} />
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: "0.75rem", color: "#7A8AAE", marginBottom: 4, display: "block" }}>Head branch *</label>
                <select value={createForm.head} onChange={(e) => setCreateForm((f) => ({ ...f, head: e.target.value }))} style={{ ...INPUT, cursor: "pointer" }}>
                  <option value="">Select branch…</option>
                  {branches.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: "0.75rem", color: "#7A8AAE", marginBottom: 4, display: "block" }}>Base branch *</label>
                <select value={createForm.base} onChange={(e) => setCreateForm((f) => ({ ...f, base: e.target.value }))} style={{ ...INPUT, cursor: "pointer" }}>
                  {branches.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
            </div>
            {collaborators.length > 0 && (
              <div>
                <label style={{ fontSize: "0.75rem", color: "#7A8AAE", marginBottom: 4, display: "block" }}>Reviewers</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {collaborators.map((c) => {
                    const sel = createReviewers.includes(c);
                    return (
                      <button key={c} type="button" onClick={() => setCreateReviewers((prev) => sel ? prev.filter((x) => x !== c) : [...prev, c])}
                        style={{ padding: "3px 10px", borderRadius: 7, cursor: "pointer", border: sel ? "1px solid rgba(139,92,246,0.5)" : "1px solid rgba(255,255,255,0.10)", background: sel ? "rgba(139,92,246,0.15)" : "rgba(255,255,255,0.04)", color: sel ? "#C4B5FD" : "#9AA5BE", fontSize: "0.75rem" }}>
                        {c}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <div>
              <label style={{ fontSize: "0.75rem", color: "#7A8AAE", marginBottom: 4, display: "block" }}>Description</label>
              <textarea value={createForm.body} onChange={(e) => setCreateForm((f) => ({ ...f, body: e.target.value }))}
                placeholder="Describe your changes…"
                style={{ width: "100%", minHeight: 160, borderRadius: 8, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)", color: "#C8CDD8", fontSize: "0.875rem", padding: "10px 12px", outline: "none", resize: "vertical" }} />
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: "0.875rem", color: "#9AA5BE" }}>
              <input type="checkbox" className="zrm-check" checked={createForm.draft} onChange={(e) => setCreateForm((f) => ({ ...f, draft: e.target.checked }))} />
              Draft PR
            </label>
            <button type="button" onClick={handleCreate} disabled={createLoading || !createForm.title.trim() || !createForm.head || !createForm.base || !viewingRepo}
              style={{ alignSelf: "flex-start", padding: "8px 24px", borderRadius: 8, cursor: "pointer", border: "none", background: "linear-gradient(135deg, rgba(139,92,246,0.45), rgba(109,60,221,0.45))", color: "#E0D7FF", fontSize: "0.875rem", fontWeight: 700, opacity: createLoading || !createForm.title.trim() || !createForm.head || !viewingRepo ? 0.5 : 1 }}>
              {createLoading ? "Creating…" : "Create Pull Request"}
            </button>
          </div>
        )}

        {activeTab === "bulk" && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16, overflow: "hidden" }}>
            {!viewingRepo ? (
              <div style={{ color: "#F59E0B", fontSize: "0.875rem" }}>Select a repository first.</div>
            ) : (
              <>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ fontSize: "0.8125rem", color: "#9AA5BE" }}>{bulkSelected.size} selected</span>
                  <button type="button" onClick={handleBulkClose} disabled={bulkRunning || bulkSelected.size === 0}
                    style={{ padding: "6px 16px", borderRadius: 8, cursor: "pointer", border: "none", background: "rgba(239,68,68,0.2)", color: "#FCA5A5", fontSize: "0.8125rem", fontWeight: 500, opacity: bulkRunning || bulkSelected.size === 0 ? 0.5 : 1, display: "flex", alignItems: "center", gap: 5 }}>
                    <X size={13} />Bulk Close
                  </button>
                  {bulkRunning && bulkProgress && <span style={{ fontSize: "0.8125rem", color: "#7A8AAE" }}>{bulkProgress.done}/{bulkProgress.total}</span>}
                </div>
                <div style={{ flex: 1, overflowY: "auto" }}>
                  {prs.map((pr) => (
                    <div key={pr.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderBottom: "1px solid rgba(255,255,255,0.04)", cursor: "pointer" }}
                      onClick={() => setBulkSelected((prev) => { const n = new Set(prev); n.has(pr.id) ? n.delete(pr.id) : n.add(pr.id); return n; })}>
                      {bulkSelected.has(pr.id) ? <CheckSquare size={15} style={{ color: "#8B5CF6", flexShrink: 0 }} /> : <Square size={15} style={{ color: "#4A5580", flexShrink: 0 }} />}
                      {pr.state === "open" ? <GitPullRequest size={13} style={{ color: "#10B981", flexShrink: 0 }} /> : <X size={13} style={{ color: "#EF4444", flexShrink: 0 }} />}
                      <span style={{ fontSize: "0.8125rem", color: "#C8CDD8", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>#{pr.number} {pr.title}</span>
                      <span style={{ fontSize: "0.6875rem", color: "#4A5580" }}>{pr.user_login}</span>
                    </div>
                  ))}
                </div>
                {bulkResults && (
                  <div style={{ maxHeight: 160, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
                    {bulkResults.map((r) => (
                      <div key={r.key} style={{ display: "flex", gap: 8, fontSize: "0.7813rem", color: r.ok ? "#6EE7B7" : "#FCA5A5" }}>
                        {r.ok ? <CheckCircle2 size={12} /> : <X size={12} />}
                        <span>{r.key}</span>
                        {r.error && <span>— {r.error}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
