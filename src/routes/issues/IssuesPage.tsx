import React, { useState, useEffect, useCallback } from "react";
import {
  CircleDot, RefreshCw, Plus, Loader2, MessageSquare, Tag,
  ChevronDown, ChevronRight, CheckCircle2, X, ExternalLink,
  CheckSquare, Square,
} from "lucide-react";
import { RepoPicker } from "../../components/repos/RepoPicker";
import { useRepoStore } from "../../stores/repoStore";
import { useUIStore } from "../../stores/uiStore";
import { fanout } from "../../lib/utils/fanout";
import { formatInvokeError } from "../../lib/formatError";
import { openUrlExternal, ghListIssues, ghCreateIssue, ghUpdateIssue, ghListIssueComments, ghCreateIssueComment, ghListLabels, ghListMilestones, ghAddLabelsToIssue } from "../../lib/tauri/commands";
import type { Issue, IssueComment, IssueLabel, Milestone } from "../../types/governance";
import type { Repo } from "../../types/repo";

type Tab = "list" | "create" | "bulk";
type StateFilter = "open" | "closed" | "all";

function fmtDate(iso: string) {
  try { return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" }); }
  catch { return iso; }
}

function renderMarkdown(md: string): string {
  return md
    .replace(/^### (.+)$/gm, "<strong style='color:#C8CDD8'>$1</strong>")
    .replace(/^## (.+)$/gm, "<strong style='font-size:1.05em;color:#D4D8E8'>$1</strong>")
    .replace(/^# (.+)$/gm, "<strong style='font-size:1.1em;color:#E0E4F0'>$1</strong>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code style='background:rgba(255,255,255,0.08);padding:1px 5px;border-radius:4px;font-size:0.85em'>$1</code>")
    .replace(/\n/g, "<br/>");
}

const LABEL_STYLE: React.CSSProperties = {
  display: "inline-flex", alignItems: "center",
  padding: "2px 7px", borderRadius: 10,
  fontSize: "0.6875rem", fontWeight: 600, letterSpacing: "0.01em",
};

const INPUT: React.CSSProperties = {
  width: "100%", height: 34, borderRadius: 8,
  background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)",
  color: "#C8CDD8", fontSize: "0.875rem", padding: "0 12px", outline: "none",
};

export const IssuesPage: React.FC = () => {
  const repos = useRepoStore((s) => s.repos);
  const addToast = useUIStore((s) => s.addToast);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [viewingId, setViewingId] = useState<string>("");
  const [activeTab, setActiveTab] = useState<Tab>("list");
  const [stateFilter, setStateFilter] = useState<StateFilter>("open");
  const [search, setSearch] = useState("");
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [comments, setComments] = useState<IssueComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [replyBody, setReplyBody] = useState("");
  const [replyLoading, setReplyLoading] = useState(false);
  const [labels, setLabels] = useState<IssueLabel[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [createTitle, setCreateTitle] = useState("");
  const [createBody, setCreateBody] = useState("");
  const [createLabels, setCreateLabels] = useState<string[]>([]);
  const [createLoading, setCreateLoading] = useState(false);
  const [bulkSelected, setBulkSelected] = useState<Set<number>>(new Set());
  const [bulkRunning, setBulkRunning] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null);
  const [bulkResults, setBulkResults] = useState<Array<{ key: string; ok: boolean; error?: string }> | null>(null);

  const viewingRepo: Repo | undefined = repos.find((r) => r.id === viewingId) ?? repos.find((r) => selectedIds.has(r.id));

  const loadIssues = useCallback(async () => {
    if (!viewingRepo) return;
    setLoading(true);
    try {
      const data = await ghListIssues(viewingRepo.owner, viewingRepo.name, stateFilter, 50);
      setIssues(data);
      setExpandedId(null);
    } catch (e) {
      addToast({ type: "error", title: "Failed to load issues", message: formatInvokeError(e) });
    } finally {
      setLoading(false);
    }
  }, [viewingRepo, stateFilter, addToast]);

  useEffect(() => { if (viewingRepo) loadIssues(); }, [viewingRepo?.id, stateFilter]);

  useEffect(() => {
    if (!viewingRepo) return;
    ghListLabels(viewingRepo.owner, viewingRepo.name).then(setLabels).catch(() => {});
    ghListMilestones(viewingRepo.owner, viewingRepo.name).then(setMilestones).catch(() => {});
  }, [viewingRepo?.id]);

  const loadComments = async (issue: Issue) => {
    if (!viewingRepo) return;
    setCommentsLoading(true);
    try {
      const data = await ghListIssueComments(viewingRepo.owner, viewingRepo.name, issue.number);
      setComments(data);
    } catch (e) {
      addToast({ type: "error", title: "Failed to load comments", message: formatInvokeError(e) });
    } finally {
      setCommentsLoading(false);
    }
  };

  const toggleExpand = (issue: Issue) => {
    if (expandedId === issue.id) { setExpandedId(null); return; }
    setExpandedId(issue.id);
    setReplyBody("");
    loadComments(issue);
  };

  const handlePostComment = async (issue: Issue) => {
    if (!viewingRepo || !replyBody.trim()) return;
    setReplyLoading(true);
    try {
      const c = await ghCreateIssueComment(viewingRepo.owner, viewingRepo.name, issue.number, replyBody);
      setComments((prev) => [...prev, c]);
      setReplyBody("");
    } catch (e) {
      addToast({ type: "error", title: "Failed to post comment", message: formatInvokeError(e) });
    } finally {
      setReplyLoading(false);
    }
  };

  const handleToggleState = async (issue: Issue) => {
    if (!viewingRepo) return;
    const newState = issue.state === "open" ? "closed" : "open";
    try {
      const updated = await ghUpdateIssue(viewingRepo.owner, viewingRepo.name, issue.number, newState);
      setIssues((prev) => prev.map((i) => i.id === updated.id ? updated : i));
      addToast({ type: "success", title: `Issue #${issue.number} ${newState}` });
    } catch (e) {
      addToast({ type: "error", title: "Failed", message: formatInvokeError(e) });
    }
  };

  const handleCreateIssue = async () => {
    if (!viewingRepo || !createTitle.trim()) return;
    setCreateLoading(true);
    try {
      const created = await ghCreateIssue(viewingRepo.owner, viewingRepo.name, createTitle, createBody, createLabels, [], null);
      setIssues((prev) => [created, ...prev]);
      setCreateTitle(""); setCreateBody(""); setCreateLabels([]);
      addToast({ type: "success", title: `Issue #${created.number} created` });
      setActiveTab("list");
    } catch (e) {
      addToast({ type: "error", title: "Failed to create issue", message: formatInvokeError(e) });
    } finally {
      setCreateLoading(false);
    }
  };

  const handleBulkClose = async () => {
    if (!viewingRepo || bulkSelected.size === 0) return;
    const targets = issues.filter((i) => bulkSelected.has(i.id) && i.state === "open");
    setBulkRunning(true);
    setBulkProgress({ done: 0, total: targets.length });
    setBulkResults(null);
    const raw = await fanout(targets, 4, async (issue) => {
      await ghUpdateIssue(viewingRepo.owner, viewingRepo.name, issue.number, "closed");
      setBulkProgress((p) => p ? { ...p, done: p.done + 1 } : null);
    });
    setBulkResults(raw.map((r) => ({ key: `#${(r.item as Issue).number} ${(r.item as Issue).title}`, ok: r.ok, error: r.error })));
    setBulkRunning(false);
    setBulkSelected(new Set());
    loadIssues();
  };

  const handleBulkAddLabel = async (labelName: string) => {
    if (!viewingRepo || bulkSelected.size === 0 || !labelName) return;
    const targets = issues.filter((i) => bulkSelected.has(i.id));
    setBulkRunning(true);
    setBulkProgress({ done: 0, total: targets.length });
    setBulkResults(null);
    const raw = await fanout(targets, 4, async (issue) => {
      await ghAddLabelsToIssue(viewingRepo.owner, viewingRepo.name, issue.number, [labelName]);
      setBulkProgress((p) => p ? { ...p, done: p.done + 1 } : null);
    });
    setBulkResults(raw.map((r) => ({ key: `#${(r.item as Issue).number}`, ok: r.ok, error: r.error })));
    setBulkRunning(false);
    loadIssues();
  };

  const filtered = issues.filter((i) => {
    if (!search) return true;
    return i.title.toLowerCase().includes(search.toLowerCase()) || i.user_login.toLowerCase().includes(search.toLowerCase());
  });

  const TAB_STYLE = (active: boolean): React.CSSProperties => ({
    padding: "6px 16px", borderRadius: 8, cursor: "pointer",
    border: "none", background: active ? "rgba(139,92,246,0.18)" : "transparent",
    color: active ? "#C4B5FD" : "#7A8AAE", fontSize: "0.8125rem", fontWeight: 500,
    transition: "all 130ms ease",
  });

  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden" }}>
      <RepoPicker
        selectedIds={selectedIds}
        onToggle={(id) => {
          setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) { next.delete(id); } else { next.add(id); }
            return next;
          });
          setViewingId(id);
        }}
        onSelectAll={() => setSelectedIds(new Set(repos.map((r) => r.id)))}
        onClearAll={() => setSelectedIds(new Set())}
      />

      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", padding: "20px 24px 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <CircleDot size={18} style={{ color: "#8B5CF6" }} />
          <h1 style={{ fontSize: "1.125rem", fontWeight: 700, color: "#D4D8E8" }}>Issues</h1>
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
                <button key={s} type="button"
                  onClick={() => setStateFilter(s)}
                  style={{
                    padding: "4px 12px", borderRadius: 7, cursor: "pointer", border: "none",
                    background: stateFilter === s ? "rgba(139,92,246,0.18)" : "rgba(255,255,255,0.04)",
                    color: stateFilter === s ? "#C4B5FD" : "#7A8AAE", fontSize: "0.8125rem", fontWeight: 500,
                    textTransform: "capitalize",
                  }}
                >{s}</button>
              ))}
              <input
                value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Search…"
                style={{ ...INPUT, width: 200, height: 30, marginLeft: "auto" }}
              />
              <button type="button" onClick={loadIssues} title="Refresh"
                style={{ padding: 6, borderRadius: 7, border: "none", background: "rgba(255,255,255,0.05)", color: "#7A8AAE", cursor: "pointer" }}>
                <RefreshCw size={14} style={loading ? { animation: "spin 1s linear infinite" } : {}} />
              </button>
            </div>

            {!viewingRepo ? (
              <div style={{ padding: 32, textAlign: "center", color: "#4A5580", fontSize: "0.875rem" }}>Select a repository</div>
            ) : loading ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 120, gap: 8, color: "#7A8AAE" }}>
                <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /><span>Loading issues…</span>
              </div>
            ) : (
              <div style={{ flex: 1, overflowY: "auto" }}>
                {filtered.length === 0 && <div style={{ padding: 32, textAlign: "center", color: "#4A5580", fontSize: "0.875rem" }}>No issues found.</div>}
                {filtered.map((issue) => (
                  <div key={issue.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.055)", marginBottom: 1 }}>
                    <div
                      style={{
                        display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
                        cursor: "pointer", borderRadius: 8,
                        background: expandedId === issue.id ? "rgba(139,92,246,0.07)" : "transparent",
                        transition: "background 120ms ease",
                      }}
                      onClick={() => toggleExpand(issue)}
                    >
                      {issue.state === "open"
                        ? <CircleDot size={15} style={{ color: "#10B981", flexShrink: 0 }} />
                        : <CheckCircle2 size={15} style={{ color: "#8B5CF6", flexShrink: 0 }} />}
                      <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#C8CDD8", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        #{issue.number} {issue.title}
                      </span>
                      <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                        {issue.labels.slice(0, 3).map((l) => (
                          <span key={l.name} style={{ ...LABEL_STYLE, background: `#${l.color}22`, color: `#${l.color}`, border: `1px solid #${l.color}44` }}>
                            {l.name}
                          </span>
                        ))}
                      </div>
                      <span style={{ fontSize: "0.7188rem", color: "#4A5580", flexShrink: 0 }}>
                        <img src={issue.user_avatar} alt={issue.user_login} style={{ width: 18, height: 18, borderRadius: "50%", verticalAlign: "middle", marginRight: 4 }} />
                        {issue.user_login}
                      </span>
                      <span style={{ fontSize: "0.6875rem", color: "#3A4560", flexShrink: 0 }}>{fmtDate(issue.updated_at)}</span>
                      <MessageSquare size={12} style={{ color: "#4A5580", flexShrink: 0 }} />
                      <span style={{ fontSize: "0.6875rem", color: "#4A5580", flexShrink: 0 }}>{issue.comments}</span>
                      {expandedId === issue.id ? <ChevronDown size={13} style={{ color: "#6B7280", flexShrink: 0 }} /> : <ChevronRight size={13} style={{ color: "#6B7280", flexShrink: 0 }} />}
                    </div>

                    {expandedId === issue.id && (
                      <div style={{
                        margin: "0 12px 14px 12px",
                        borderRadius: 12,
                        border: "1px solid rgba(255,255,255,0.07)",
                        background: "rgba(10,12,28,0.60)",
                        overflow: "hidden",
                      }}>

                        <div style={{
                          display: "flex", alignItems: "center", gap: 8,
                          padding: "10px 14px",
                          borderBottom: "1px solid rgba(255,255,255,0.06)",
                          background: "rgba(255,255,255,0.018)",
                        }}>
                          <span style={{
                            fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.08em",
                            textTransform: "uppercase", color: "#3A4560",
                          }}>Thread</span>
                          <div style={{ flex: 1 }} />
                          <button type="button" onClick={() => handleToggleState(issue)}
                            style={{
                              display: "flex", alignItems: "center", gap: 5,
                              padding: "4px 12px", borderRadius: 6, cursor: "pointer", border: "none",
                              background: issue.state === "open" ? "rgba(139,92,246,0.14)" : "rgba(16,185,129,0.12)",
                              color: issue.state === "open" ? "#C4B5FD" : "#6EE7B7",
                              fontSize: "0.75rem", fontWeight: 600,
                            }}>
                            {issue.state === "open" ? <><X size={11} />Close issue</> : <><CheckCircle2 size={11} />Reopen</>}
                          </button>
                          <button type="button" onClick={() => openUrlExternal(issue.html_url)}
                            style={{
                              display: "flex", alignItems: "center", gap: 5,
                              padding: "4px 10px", borderRadius: 6, cursor: "pointer",
                              border: "1px solid rgba(255,255,255,0.08)", background: "transparent",
                              color: "#4A5580", fontSize: "0.75rem",
                            }}>
                            <ExternalLink size={11} />GitHub
                          </button>
                        </div>


                        <div style={{ maxHeight: 420, overflowY: "auto", padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12 }}>


                          <div style={{ display: "flex", gap: 10 }}>
                            <img src={issue.user_avatar} alt={issue.user_login}
                              style={{ width: 30, height: 30, borderRadius: "50%", flexShrink: 0, border: "1.5px solid rgba(255,255,255,0.10)", marginTop: 2 }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{
                                borderRadius: "0 10px 10px 10px",
                                border: "1px solid rgba(139,92,246,0.18)",
                                background: "rgba(139,92,246,0.06)",
                                overflow: "hidden",
                              }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 12px", borderBottom: "1px solid rgba(139,92,246,0.10)", background: "rgba(139,92,246,0.04)" }}>
                                  <span style={{ fontSize: "0.8125rem", fontWeight: 700, color: "#C4B5FD" }}>{issue.user_login}</span>
                                  <span style={{ fontSize: "0.6875rem", color: "#3A4560" }}>opened · {fmtDate(issue.created_at)}</span>
                                  <div style={{ flex: 1 }} />
                                  {issue.labels.map((l) => (
                                    <span key={l.name} style={{ ...LABEL_STYLE, background: `#${l.color}1A`, color: `#${l.color}`, border: `1px solid #${l.color}33` }}>
                                      {l.name}
                                    </span>
                                  ))}
                                </div>
                                <div style={{ padding: "10px 12px" }}>
                                  {issue.body ? (
                                    <div style={{ fontSize: "0.8125rem", color: "#A8B4CC", lineHeight: 1.75 }}
                                      dangerouslySetInnerHTML={{ __html: renderMarkdown(issue.body) }} />
                                  ) : (
                                    <p style={{ fontSize: "0.8125rem", color: "#3A4560", fontStyle: "italic" }}>No description provided.</p>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>


                          {commentsLoading ? (
                            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 0", color: "#4A5580", fontSize: "0.8125rem" }}>
                              <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} />Loading comments…
                            </div>
                          ) : comments.map((c) => (
                            <div key={c.id} style={{ display: "flex", gap: 10 }}>
                              <img src={c.user_avatar} alt={c.user_login}
                                style={{ width: 28, height: 28, borderRadius: "50%", flexShrink: 0, border: "1.5px solid rgba(255,255,255,0.08)", marginTop: 2 }} />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{
                                  borderRadius: "0 10px 10px 10px",
                                  border: "1px solid rgba(255,255,255,0.07)",
                                  background: "rgba(255,255,255,0.025)",
                                  overflow: "hidden",
                                }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 11px", borderBottom: "1px solid rgba(255,255,255,0.05)", background: "rgba(255,255,255,0.018)" }}>
                                    <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#C8CDD8" }}>{c.user_login}</span>
                                    <span style={{ fontSize: "0.6875rem", color: "#3A4560" }}>{fmtDate(c.created_at)}</span>
                                  </div>
                                  <div style={{ padding: "9px 11px" }}>
                                    <div style={{ fontSize: "0.8125rem", color: "#9AA5BE", lineHeight: 1.7 }}
                                      dangerouslySetInnerHTML={{ __html: renderMarkdown(c.body) }} />
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}


                          <div style={{ display: "flex", gap: 10, paddingTop: 4 }}>
                            <div style={{
                              width: 28, height: 28, borderRadius: "50%", flexShrink: 0, marginTop: 2,
                              background: "linear-gradient(135deg, rgba(139,92,246,0.35), rgba(109,60,221,0.25))",
                              border: "1.5px solid rgba(139,92,246,0.30)",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              fontSize: "0.75rem", fontWeight: 800, color: "#A78BFA",
                            }}>
                              Y
                            </div>
                            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                              <textarea
                                value={replyBody}
                                onChange={(e) => setReplyBody(e.target.value)}
                                placeholder="Write a comment…"
                                rows={3}
                                style={{
                                  width: "100%", borderRadius: "0 10px 10px 10px",
                                  background: "rgba(255,255,255,0.04)",
                                  border: "1px solid rgba(255,255,255,0.10)",
                                  color: "#C8CDD8", fontSize: "0.8125rem",
                                  padding: "9px 12px", outline: "none", resize: "vertical",
                                  lineHeight: 1.6,
                                }}
                                onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(139,92,246,0.40)"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(139,92,246,0.08)"; }}
                                onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.10)"; e.currentTarget.style.boxShadow = "none"; }}
                              />
                              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                                <button type="button"
                                  onClick={() => handlePostComment(issue)}
                                  disabled={replyLoading || !replyBody.trim()}
                                  style={{
                                    display: "flex", alignItems: "center", gap: 6,
                                    padding: "6px 18px", borderRadius: 8, cursor: "pointer", border: "none",
                                    background: "linear-gradient(135deg, rgba(139,92,246,0.55), rgba(109,60,221,0.55))",
                                    color: "#E0D7FF", fontSize: "0.8125rem", fontWeight: 600,
                                    opacity: replyLoading || !replyBody.trim() ? 0.45 : 1,
                                    transition: "opacity 130ms",
                                  }}>
                                  {replyLoading ? <><Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} />Posting…</> : "Comment"}
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
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
              <input value={createTitle} onChange={(e) => setCreateTitle(e.target.value)} placeholder="Issue title" style={INPUT} />
            </div>
            <div>
              <label style={{ fontSize: "0.75rem", color: "#7A8AAE", marginBottom: 4, display: "block" }}>Labels</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {labels.map((l) => {
                  const active = createLabels.includes(l.name);
                  return (
                    <button key={l.name} type="button"
                      onClick={() => setCreateLabels((prev) => active ? prev.filter((x) => x !== l.name) : [...prev, l.name])}
                      style={{ ...LABEL_STYLE, cursor: "pointer", border: "none",
                        background: active ? `#${l.color}33` : `#${l.color}11`,
                        color: `#${l.color}`, outline: active ? `1.5px solid #${l.color}` : "none" }}>
                      <Tag size={10} style={{ marginRight: 3 }} />{l.name}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <label style={{ fontSize: "0.75rem", color: "#7A8AAE", marginBottom: 4, display: "block" }}>Body</label>
              <textarea
                value={createBody} onChange={(e) => setCreateBody(e.target.value)}
                placeholder="Describe the issue…"
                style={{
                  width: "100%", minHeight: 160, borderRadius: 8,
                  background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)",
                  color: "#C8CDD8", fontSize: "0.875rem", padding: "10px 12px", outline: "none", resize: "vertical",
                }}
              />
            </div>
            <button type="button" onClick={handleCreateIssue} disabled={createLoading || !createTitle.trim() || !viewingRepo}
              style={{
                alignSelf: "flex-start", padding: "8px 24px", borderRadius: 8, cursor: "pointer", border: "none",
                background: "linear-gradient(135deg, rgba(139,92,246,0.45), rgba(109,60,221,0.45))",
                color: "#E0D7FF", fontSize: "0.875rem", fontWeight: 700,
                opacity: createLoading || !createTitle.trim() || !viewingRepo ? 0.5 : 1,
              }}>
              {createLoading ? "Creating…" : "Create Issue"}
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
                    style={{
                      padding: "6px 16px", borderRadius: 8, cursor: "pointer", border: "none",
                      background: "rgba(239,68,68,0.2)", color: "#FCA5A5", fontSize: "0.8125rem", fontWeight: 500,
                      opacity: bulkRunning || bulkSelected.size === 0 ? 0.5 : 1,
                    }}>
                    <X size={13} style={{ display: "inline", marginRight: 5 }} />Bulk Close
                  </button>
                  {labels.length > 0 && (
                    <select
                      onChange={(e) => { if (e.target.value) handleBulkAddLabel(e.target.value); e.target.value = ""; }}
                      disabled={bulkRunning || bulkSelected.size === 0}
                      style={{ height: 32, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)", color: "#C8CDD8", fontSize: "0.8125rem", padding: "0 10px", cursor: "pointer" }}
                    >
                      <option value="">Add label…</option>
                      {labels.map((l) => <option key={l.name} value={l.name}>{l.name}</option>)}
                    </select>
                  )}
                  {bulkRunning && bulkProgress && (
                    <span style={{ fontSize: "0.8125rem", color: "#7A8AAE" }}>{bulkProgress.done}/{bulkProgress.total}</span>
                  )}
                </div>
                <div style={{ flex: 1, overflowY: "auto" }}>
                  {issues.map((issue) => (
                    <div key={issue.id}
                      style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderBottom: "1px solid rgba(255,255,255,0.04)", cursor: "pointer" }}
                      onClick={() => setBulkSelected((prev) => { const n = new Set(prev); n.has(issue.id) ? n.delete(issue.id) : n.add(issue.id); return n; })}
                    >
                      {bulkSelected.has(issue.id) ? <CheckSquare size={15} style={{ color: "#8B5CF6", flexShrink: 0 }} /> : <Square size={15} style={{ color: "#4A5580", flexShrink: 0 }} />}
                      {issue.state === "open" ? <CircleDot size={13} style={{ color: "#10B981", flexShrink: 0 }} /> : <CheckCircle2 size={13} style={{ color: "#8B5CF6", flexShrink: 0 }} />}
                      <span style={{ fontSize: "0.8125rem", color: "#C8CDD8", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>#{issue.number} {issue.title}</span>
                    </div>
                  ))}
                </div>
                {bulkResults && (
                  <div style={{ maxHeight: 160, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
                    {bulkResults.map((r) => (
                      <div key={r.key} style={{ display: "flex", gap: 8, fontSize: "0.7813rem", color: r.ok ? "#6EE7B7" : "#FCA5A5" }}>
                        {r.ok ? <CheckCircle2 size={12} /> : <X size={12} />}
                        <span>{r.key}</span>
                        {r.error && <span style={{ color: "#F87171" }}>— {r.error}</span>}
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
