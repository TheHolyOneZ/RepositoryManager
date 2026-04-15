import React, { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Trash2, Archive, Lock, Globe, Tag, X, CheckSquare, Square, Shuffle,
  ChevronDown, ChevronUp, FileText, Package, Download, Database,
  FolderOpen, CheckCircle2, XCircle, Loader2, Zap,
} from "lucide-react";
import { useSelectionStore } from "../../stores/selectionStore";
import { useRepoStore, selectFilteredRepos } from "../../stores/repoStore";
import { useShallow } from "zustand/react/shallow";
import { useUIStore } from "../../stores/uiStore";

import {
  exportReadmes, fetchReleases, exportReleaseAssets, exportRepoMetadata,
} from "../../lib/tauri/commands";
import type { QueueItemInput, ExportBatchResult, ReleaseResult } from "../../types/queue";
import { formatInvokeError } from "../../lib/formatError";

const BUILTIN_TAG_COLORS: Record<string, string> = {
  keep: "#10B981", delete: "#EF4444", review: "#F59E0B",
};
function tagColor(tag: string): string {
  return BUILTIN_TAG_COLORS[tag] ?? "#A78BFA";
}


type AdvancedOp = "readme" | "releases-info" | "release-assets" | "metadata";

const ADVANCED_OPS: { id: AdvancedOp; icon: React.ReactNode; label: string; desc: string; needsPath: boolean }[] = [
  { id: "readme", icon: <FileText size={13} />, label: "Export READMEs", desc: "Save README.md from each repo to a folder", needsPath: true },
  { id: "releases-info", icon: <Package size={13} />, label: "Fetch release info", desc: "Get latest release metadata for selected repos", needsPath: false },
  { id: "release-assets", icon: <Download size={13} />, label: "Download release assets", desc: "Download all assets from latest release to a folder", needsPath: true },
  { id: "metadata", icon: <Database size={13} />, label: "Export metadata (JSON)", desc: "Save full repo metadata as repo.json per repo", needsPath: true },
];

type RunState = { loading: boolean; result: ExportBatchResult | ReleaseResult[] | null; error: string | null };

export const SelectionToolbar: React.FC = () => {
  const selectedIds = useSelectionStore((s) => s.selectedIds);
  const count = selectedIds.size;
  const deselectAll = useSelectionStore((s) => s.deselectAll);
  const selectAll = useSelectionStore((s) => s.selectAll);
  const invertSelection = useSelectionStore((s) => s.invertSelection);
  const filteredRepos = useRepoStore(useShallow(selectFilteredRepos));
  const openModal = useUIStore((s) => s.openModal);
  const addToast = useUIStore((s) => s.addToast);
  const customTagOptions = useRepoStore((s) => s.customTagOptions);
  const updateRepoTag = useRepoStore((s) => s.updateRepoTag);

  const [showTagMenu, setShowTagMenu] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [selectedOp, setSelectedOp] = useState<AdvancedOp>("readme");
  const [destPath, setDestPath] = useState("");
  const [run, setRun] = useState<RunState>({ loading: false, result: null, error: null });

  const allIds = filteredRepos.map((r) => r.id);
  const selectedRepos = filteredRepos.filter((r) => selectedIds.has(r.id));
  const allTags = ["keep", "delete", "review", ...customTagOptions];

  const enqueue = (action: QueueItemInput["action"], payload: Record<string, unknown> = {}) => {
    const items: QueueItemInput[] = selectedRepos.map((r) => ({
      repo_id: r.id, repo_name: r.name, repo_full_name: r.full_name, action, payload,
    }));
    openModal("confirm-queue", { items, action });
  };

  const applyTag = (tag: string) => {
    selectedRepos.forEach((r) => updateRepoTag(r.id, tag, true));
    setShowTagMenu(false);
    addToast({ type: "success", title: `Tagged ${count} repo${count !== 1 ? "s" : ""} as "${tag}"` });
  };

  const exportItems = selectedRepos.map((r) => ({
    repo_id: r.id,
    repo_name: r.name,
    repo_full_name: r.full_name,
  }));

  const runAdvancedOp = async () => {
    const currentOp = ADVANCED_OPS.find((o) => o.id === selectedOp)!;
    if (currentOp.needsPath && !destPath.trim()) {
      addToast({ type: "error", title: "Path required", message: "Enter a destination folder path." });
      return;
    }
    setRun({ loading: true, result: null, error: null });
    try {
      let result: ExportBatchResult | ReleaseResult[];
      switch (selectedOp) {
        case "readme":          result = await exportReadmes(exportItems, destPath); break;
        case "releases-info":   result = await fetchReleases(exportItems); break;
        case "release-assets":  result = await exportReleaseAssets(exportItems, destPath); break;
        case "metadata":        result = await exportRepoMetadata(exportItems, destPath); break;
      }
      setRun({ loading: false, result, error: null });
    } catch (e: unknown) {
      setRun({ loading: false, result: null, error: formatInvokeError(e) });
    }
  };

  if (count === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        key="selection-toolbar"
        style={{
          position: "absolute", bottom: 24, zIndex: 50,
          left: "50%",
          display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
          maxWidth: "calc(100% - 32px)",
          pointerEvents: "none",
        }}
        initial={{ x: "-50%", y: 80, opacity: 0, scale: 0.95 }}
        animate={{ x: "-50%", y: 0, opacity: 1, scale: 1 }}
        exit={{ x: "-50%", y: 80, opacity: 0, scale: 0.95 }}
        transition={{ type: "spring", stiffness: 420, damping: 34 }}
      >
        <AnimatePresence>
          {showAdvanced && (
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.97 }}
              transition={{ type: "spring", stiffness: 400, damping: 32 }}
              style={{
                background: "rgba(9,11,24,0.98)",
                backdropFilter: "blur(28px)",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 18,
                padding: 16,
                width: 520, maxWidth: "100%",
                pointerEvents: "auto",
                boxShadow: "0 20px 60px rgba(0,0,0,0.65), 0 0 0 1px rgba(139,92,246,0.08)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <p style={{ fontSize: "0.625rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#4A5580" }}>
                  Advanced Operations — {count} repo{count !== 1 ? "s" : ""}
                </p>
                <button
                  onClick={() => { setShowAdvanced(false); setRun({ loading: false, result: null, error: null }); }}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#3A4560", display: "flex", padding: 4 }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "#8991A4")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "#3A4560")}
                >
                  <X size={12} />
                </button>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 14 }}>
                {ADVANCED_OPS.map((op) => {
                  const active = selectedOp === op.id;
                  return (
                    <button
                      key={op.id}
                      onClick={() => { setSelectedOp(op.id); setRun({ loading: false, result: null, error: null }); }}
                      style={{
                        padding: "9px 12px", borderRadius: 10, cursor: "pointer",
                        textAlign: "left", transition: "all 130ms",
                        background: active ? "rgba(139,92,246,0.14)" : "rgba(255,255,255,0.03)",
                        border: active ? "1px solid rgba(139,92,246,0.35)" : "1px solid rgba(255,255,255,0.07)",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3, color: active ? "#C4B5FD" : "#6B7A9B" }}>
                        {op.icon}
                        <span style={{ fontSize: "0.75rem", fontWeight: 600 }}>{op.label}</span>
                      </div>
                      <p style={{ fontSize: "0.6875rem", color: "#3A4560", margin: 0, lineHeight: 1.4 }}>{op.desc}</p>
                    </button>
                  );
                })}
              </div>

              {ADVANCED_OPS.find((o) => o.id === selectedOp)?.needsPath && (
                <div style={{ marginBottom: 12 }}>
                  <p style={{ fontSize: "0.625rem", fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase", color: "#2D3650", marginBottom: 6 }}>
                    Destination folder
                  </p>
                  <div style={{ display: "flex", gap: 6 }}>
                    <div style={{ position: "relative", flex: 1 }}>
                      <FolderOpen size={12} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#3A4560", pointerEvents: "none" }} />
                      <input
                        value={destPath}
                        onChange={(e) => setDestPath(e.target.value)}
                        placeholder="C:\Users\you\exports or /home/you/exports"
                        style={{
                          width: "100%", height: 36, borderRadius: 8,
                          background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)",
                          color: "#D4D8E8", fontSize: "0.75rem", paddingLeft: 30, paddingRight: 10,
                          outline: "none", boxSizing: "border-box",
                          fontFamily: "'Cascadia Code','Consolas',monospace",
                        }}
                        onFocus={(e) => { e.currentTarget.style.border = "1px solid rgba(139,92,246,0.45)"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(139,92,246,0.10)"; }}
                        onBlur={(e) => { e.currentTarget.style.border = "1px solid rgba(255,255,255,0.10)"; e.currentTarget.style.boxShadow = "none"; }}
                      />
                    </div>
                  </div>
                  <p style={{ fontSize: "0.625rem", color: "#2D3650", marginTop: 5 }}>
                    Each repo gets its own subfolder: {destPath || "<path>"}/<em>repo-name</em>/…
                  </p>
                </div>
              )}

              {run.error && (
                <div style={{
                  padding: "10px 12px", borderRadius: 8, marginBottom: 12,
                  background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.20)",
                  fontSize: "0.75rem", color: "#F87171",
                }}>
                  {run.error}
                </div>
              )}

              {run.result && (
                <div style={{
                  maxHeight: 200, overflowY: "auto",
                  borderRadius: 10, border: "1px solid rgba(255,255,255,0.07)",
                  marginBottom: 12,
                }}>
                  {!Array.isArray(run.result) ? (

                    (run.result as ExportBatchResult).results.map((r, i) => (
                      <div key={i} style={{
                        display: "flex", alignItems: "center", gap: 8, padding: "7px 12px",
                        borderBottom: i < (run.result as ExportBatchResult).results.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                        background: i % 2 === 0 ? "rgba(255,255,255,0.015)" : "transparent",
                      }}>
                        {r.success
                          ? <CheckCircle2 size={11} style={{ color: "#10B981", flexShrink: 0 }} />
                          : <XCircle size={11} style={{ color: "#EF4444", flexShrink: 0 }} />}
                        <span style={{ flex: 1, fontSize: "0.75rem", color: "#C8CDD8", fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {r.repo_name}
                        </span>
                        <span style={{ fontSize: "0.625rem", color: r.success ? "#4A5580" : "#EF4444", flexShrink: 0, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {r.success ? r.path ?? "" : r.error ?? ""}
                        </span>
                      </div>
                    ))
                  ) : (

                    (run.result as ReleaseResult[]).map((r, i) => (
                      <div key={i} style={{
                        display: "flex", alignItems: "flex-start", gap: 8, padding: "8px 12px",
                        borderBottom: i < (run.result as ReleaseResult[]).length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                        background: i % 2 === 0 ? "rgba(255,255,255,0.015)" : "transparent",
                      }}>
                        {r.success
                          ? <CheckCircle2 size={11} style={{ color: "#10B981", flexShrink: 0, marginTop: 2 }} />
                          : <XCircle size={11} style={{ color: "#EF4444", flexShrink: 0, marginTop: 2 }} />}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: "0.75rem", color: "#C8CDD8", fontFamily: "monospace", marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {r.repo_name}
                          </p>
                          {r.success && r.release ? (
                            <p style={{ fontSize: "0.625rem", color: "#8B5CF6" }}>
                              {r.release.tag_name}{r.release.name ? ` — ${r.release.name}` : ""} · {r.release.assets.length} asset{r.release.assets.length !== 1 ? "s" : ""}
                            </p>
                          ) : (
                            <p style={{ fontSize: "0.625rem", color: "#4A5580" }}>{r.error ?? "No release"}</p>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                {run.result && !Array.isArray(run.result) && (
                  <p style={{ fontSize: "0.75rem", color: "#4A5580" }}>
                    <span style={{ color: "#10B981", fontWeight: 700 }}>{(run.result as ExportBatchResult).succeeded}</span> succeeded,{" "}
                    <span style={{ color: "#EF4444", fontWeight: 700 }}>{(run.result as ExportBatchResult).failed}</span> failed
                  </p>
                )}
                {run.result && Array.isArray(run.result) && (
                  <p style={{ fontSize: "0.75rem", color: "#4A5580" }}>
                    <span style={{ color: "#10B981", fontWeight: 700 }}>{(run.result as ReleaseResult[]).filter((r) => r.success).length}</span> with releases,{" "}
                    <span style={{ color: "#EF4444", fontWeight: 700 }}>{(run.result as ReleaseResult[]).filter((r) => !r.success).length}</span> without
                  </p>
                )}
                {!run.result && <span />}
                <button
                  onClick={runAdvancedOp}
                  disabled={run.loading}
                  style={{
                    height: 34, padding: "0 16px", borderRadius: 8,
                    background: run.loading ? "rgba(139,92,246,0.20)" : "linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)",
                    border: "none", color: "#fff",
                    fontSize: "0.8125rem", fontWeight: 600, cursor: run.loading ? "not-allowed" : "pointer",
                    display: "flex", alignItems: "center", gap: 7,
                    boxShadow: run.loading ? "none" : "0 4px 14px rgba(139,92,246,0.30)",
                    opacity: run.loading ? 0.7 : 1,
                    transition: "all 140ms",
                    flexShrink: 0,
                  }}
                >
                  {run.loading ? <Loader2 size={13} style={{ animation: "spin 0.8s linear infinite" }} /> : <Zap size={13} />}
                  {run.loading ? "Running…" : run.result ? "Run again" : "Run"}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div style={{
          display: "flex", alignItems: "center", gap: 4, flexWrap: "nowrap",
          background: "rgba(9,11,24,0.97)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 18,
          padding: "6px 8px",
          boxShadow: "0 20px 60px rgba(0,0,0,0.60), 0 0 0 1px rgba(139,92,246,0.10), 0 1px 0 rgba(255,255,255,0.06) inset",
          maxWidth: "100%", overflow: "visible",
          pointerEvents: "auto",
        }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "4px 12px 4px 8px", marginRight: 2,
            borderRight: "1px solid rgba(255,255,255,0.09)",
          }}>
            <div style={{
              width: 28, height: 28, borderRadius: 8,
              background: "rgba(139,92,246,0.18)", border: "1px solid rgba(139,92,246,0.28)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "0.8125rem", fontWeight: 800, color: "#A78BFA",
              fontVariantNumeric: "tabular-nums",
            }}>
              {count}
            </div>
            <div>
              <p style={{ fontSize: "0.75rem", fontWeight: 600, color: "#C8CDD8", lineHeight: 1 }}>selected</p>
              <p style={{ fontSize: "0.625rem", color: "#4A5580", marginTop: 1 }}>{filteredRepos.length} total</p>
            </div>
          </div>

          <div style={{ display: "flex", gap: 1, padding: "0 4px" }}>
            <IconBtn title="Select all" onClick={() => selectAll(allIds)}><CheckSquare size={13} /></IconBtn>
            <IconBtn title="Deselect all" onClick={deselectAll}><Square size={13} /></IconBtn>
            <IconBtn title="Invert selection" onClick={() => invertSelection(allIds)}><Shuffle size={13} /></IconBtn>
          </div>

          <Divider />

          <div style={{ display: "flex", gap: 3, padding: "0 4px" }}>
            <ActionBtn icon={<Archive size={12} />} label="Archive" onClick={() => enqueue("archive", { archive: true })} color="#F59E0B" />
            <ActionBtn icon={<Lock size={12} />} label="Private" onClick={() => enqueue("set_private", { private: true })} />
            <ActionBtn icon={<Globe size={12} />} label="Public" onClick={() => enqueue("set_public", { private: false })} />

            <div style={{ position: "relative" }}>
              <button
                onClick={() => { setShowTagMenu((v) => !v); setShowAdvanced(false); }}
                style={{
                  display: "flex", alignItems: "center", gap: 5,
                  height: 32, padding: "0 10px", borderRadius: 8, cursor: "pointer",
                  background: showTagMenu ? "rgba(255,255,255,0.09)" : "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  color: "#8991A4", fontSize: "0.75rem", fontWeight: 500,
                  transition: "all 130ms",
                }}
              >
                <Tag size={12} /> Tag <ChevronDown size={9} />
              </button>
              <AnimatePresence>
                {showTagMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: 6, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.97 }}
                    transition={{ duration: 0.14 }}
                    style={{
                      position: "absolute", bottom: "calc(100% + 8px)", left: 0,
                      background: "rgba(10,12,26,0.98)", border: "1px solid rgba(255,255,255,0.11)",
                      borderRadius: 12, padding: 6, minWidth: 140, zIndex: 60,
                      boxShadow: "0 12px 40px rgba(0,0,0,0.50)",
                      maxHeight: 280, overflowY: "auto",
                    }}
                    onMouseLeave={() => setShowTagMenu(false)}
                  >
                    {allTags.map((tag) => {
                      const c = tagColor(tag);
                      return (
                        <button key={tag}
                          onClick={() => applyTag(tag)}
                          style={{
                            width: "100%", display: "flex", alignItems: "center", gap: 8,
                            padding: "7px 10px", borderRadius: 7, cursor: "pointer",
                            background: "transparent", border: "none", transition: "background 120ms",
                            color: "#8991A4", fontSize: "0.8125rem", fontWeight: 500,
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.color = "#D4D8E8"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#8991A4"; }}
                        >
                          <span style={{ width: 7, height: 7, borderRadius: "50%", background: c, flexShrink: 0 }} />
                          {tag}
                        </button>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          <Divider />

          <div style={{ padding: "0 4px 0 2px", display: "flex", gap: 3 }}>
            <button
              onClick={() => enqueue("delete")}
              style={{
                display: "flex", alignItems: "center", gap: 5,
                height: 32, padding: "0 12px", borderRadius: 8, cursor: "pointer",
                background: "rgba(239,68,68,0.14)", border: "1px solid rgba(239,68,68,0.28)",
                color: "#F87171", fontSize: "0.75rem", fontWeight: 600,
                transition: "all 130ms",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(239,68,68,0.22)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(239,68,68,0.14)"; }}
            >
              <Trash2 size={12} /> Delete {count}
            </button>

            <button
              onClick={() => { setShowAdvanced((v) => !v); setShowTagMenu(false); setRun({ loading: false, result: null, error: null }); }}
              title="Advanced operations"
              style={{
                display: "flex", alignItems: "center", gap: 5,
                height: 32, padding: "0 10px", borderRadius: 8, cursor: "pointer",
                background: showAdvanced ? "rgba(139,92,246,0.18)" : "rgba(255,255,255,0.04)",
                border: showAdvanced ? "1px solid rgba(139,92,246,0.35)" : "1px solid rgba(255,255,255,0.08)",
                color: showAdvanced ? "#A78BFA" : "#6B7A9B",
                fontSize: "0.75rem", fontWeight: 500, transition: "all 130ms",
              }}
            >
              {showAdvanced ? <ChevronDown size={11} /> : <ChevronUp size={11} />}
              Advanced
            </button>

            <button
              onClick={deselectAll}
              title="Clear selection"
              style={{
                width: 32, height: 32, borderRadius: 8, cursor: "pointer",
                background: "transparent", border: "1px solid rgba(255,255,255,0.07)",
                color: "#4A5580", display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all 130ms",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.color = "#8991A4"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#4A5580"; }}
            >
              <X size={12} />
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

const Divider: React.FC = () => (
  <div style={{ width: 1, height: 24, background: "rgba(255,255,255,0.09)", flexShrink: 0 }} />
);

const IconBtn: React.FC<{ title: string; onClick: () => void; children: React.ReactNode }> = ({ title, onClick, children }) => (
  <button
    title={title}
    onClick={onClick}
    style={{
      width: 30, height: 30, borderRadius: 7, cursor: "pointer",
      background: "transparent", border: "none",
      color: "#4A5580", display: "flex", alignItems: "center", justifyContent: "center",
      transition: "all 120ms",
    }}
    onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.07)"; e.currentTarget.style.color = "#9CA3B8"; }}
    onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#4A5580"; }}
  >
    {children}
  </button>
);

const ActionBtn: React.FC<{ icon: React.ReactNode; label: string; onClick: () => void; color?: string }> = ({ icon, label, onClick, color }) => (
  <button
    onClick={onClick}
    style={{
      display: "flex", alignItems: "center", gap: 5,
      height: 32, padding: "0 10px", borderRadius: 8, cursor: "pointer",
      background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)",
      color: color ?? "#8991A4", fontSize: "0.75rem", fontWeight: 500,
      transition: "all 130ms",
    }}
    onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.10)"; e.currentTarget.style.color = color ?? "#C8CDD8"; }}
    onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; e.currentTarget.style.color = color ?? "#8991A4"; }}
  >
    {icon} {label}
  </button>
);
