import React, { useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, Wand2, Leaf, LayoutGrid, Minimize2, ArrowRight } from "lucide-react";
import { useRepoStore } from "../../stores/repoStore";
import { useUIStore } from "../../stores/uiStore";
import { useSelectionStore } from "../../stores/selectionStore";
import type { Repo } from "../../types/repo";
import type { QueueItemInput } from "../../types/queue";

interface CleanupPreset {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  selectRepos: (repos: Repo[]) => Repo[];
  buildItems: (repos: Repo[]) => QueueItemInput[];
}

const now = Date.now();
const MONTHS_12 = 12 * 30 * 24 * 60 * 60 * 1000;

const PRESETS: CleanupPreset[] = [
  {
    id: "spring-clean",
    name: "Spring Clean",
    description: "Auto-selects all Dead + Empty repos for archival or deletion. Best first cleanup run.",
    icon: <Leaf size={16} />,
    color: "#10B981",
    selectRepos: (repos) => repos.filter((r) => !r.archived && (r.health?.status === "dead" || r.health?.status === "empty")),
    buildItems: (repos) => repos.map((r) => ({
      repo_id: r.id, repo_name: r.name, repo_full_name: r.full_name,
      action: r.health?.status === "empty" ? "delete" as const : "archive" as const,
      payload: r.health?.status === "empty" ? {} : { archive: true },
    })),
  },
  {
    id: "portfolio-mode",
    name: "Portfolio Mode",
    description: "Deselects Active + starred repos. Keeps low-value ones for review and cleanup.",
    icon: <LayoutGrid size={16} />,
    color: "#8B5CF6",
    selectRepos: (repos) => repos.filter((r) => !r.archived && !r.health?.score && r.stars === 0 && r.health?.status !== "active"),
    buildItems: (repos) => repos.map((r) => ({
      repo_id: r.id, repo_name: r.name, repo_full_name: r.full_name,
      action: "archive" as const, payload: { archive: true },
    })),
  },
  {
    id: "minimal-mode",
    name: "Minimal Mode",
    description: "Targets the 20 lowest-value repos by health score and queues them for archival.",
    icon: <Minimize2 size={16} />,
    color: "#F59E0B",
    selectRepos: (repos) => {
      const candidates = repos.filter((r) => !r.archived && !r.private && r.stars === 0);
      return [...candidates]
        .sort((a, b) => (a.health?.score ?? 0) - (b.health?.score ?? 0))
        .slice(0, 20);
    },
    buildItems: (repos) => repos.map((r) => ({
      repo_id: r.id, repo_name: r.name, repo_full_name: r.full_name,
      action: "archive" as const, payload: { archive: true },
    })),
  },
];

interface CleanupPresetsPanelProps {
  open: boolean;
  onClose: () => void;
}

export const CleanupPresetsPanel: React.FC<CleanupPresetsPanelProps> = ({ open, onClose }) => {
  const repos = useRepoStore((s) => s.repos);
  const openModal = useUIStore((s) => s.openModal);
  const [preview, setPreview] = useState<{ preset: CleanupPreset; repos: Repo[] } | null>(null);

  const handlePreview = (preset: CleanupPreset) => {
    const selected = preset.selectRepos(repos);
    setPreview({ preset, repos: selected });
  };

  const handleQueue = () => {
    if (!preview) return;
    const items = preview.preset.buildItems(preview.repos);
    if (items.length === 0) return;
    onClose();
    openModal("confirm-queue", { items, action: items[0]?.action ?? "archive" });
  };

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            onClick={onClose}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}
          />
          <motion.div
            initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 40 }}
            transition={{ type: "spring", stiffness: 380, damping: 36 }}
            style={{
              position: "fixed", top: 0, right: 0, height: "100%", zIndex: 61,
              width: preview ? 700 : 440, display: "flex",
              background: "rgba(8,10,22,0.98)", backdropFilter: "blur(28px) saturate(160%)",
              borderLeft: "1px solid rgba(255,255,255,0.09)",
              boxShadow: "-24px 0 60px rgba(0,0,0,0.55)",
            }}
          >
            <div style={{ width: 440, flexShrink: 0, display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: "rgba(139,92,246,0.15)", border: "1px solid rgba(139,92,246,0.25)", display: "flex", alignItems: "center", justifyContent: "center", color: "#A78BFA" }}>
                  <Wand2 size={13} />
                </div>
                <p style={{ fontSize: "0.9375rem", fontWeight: 700, color: "#D4D8E8", letterSpacing: "-0.02em", flex: 1 }}>Cleanup Presets</p>
                <button
                  onClick={onClose}
                  style={{ width: 30, height: 30, borderRadius: 7, cursor: "pointer", background: "transparent", border: "1px solid rgba(255,255,255,0.07)", color: "#4A5580", display: "flex", alignItems: "center", justifyContent: "center" }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.color = "#8991A4"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#4A5580"; }}
                >
                  <X size={13} />
                </button>
              </div>

              <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
                <p style={{ fontSize: "0.75rem", color: "#4A5580", lineHeight: 1.6, marginBottom: 20 }}>
                  Each preset automatically selects repos matching its criteria and shows a preview before anything is queued.
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {PRESETS.map((preset) => {
                    const affected = preset.selectRepos(repos);
                    const isActive = preview?.preset.id === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => handlePreview(preset)}
                        style={{
                          display: "flex", alignItems: "flex-start", gap: 14,
                          padding: "14px 16px", borderRadius: 12, cursor: "pointer", textAlign: "left",
                          background: isActive ? `${preset.color}0D` : "rgba(255,255,255,0.025)",
                          border: isActive ? `1px solid ${preset.color}30` : "1px solid rgba(255,255,255,0.07)",
                          transition: "all 140ms",
                        }}
                        onMouseEnter={(e) => { if (!isActive) { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.04)"; } }}
                        onMouseLeave={(e) => { if (!isActive) { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.025)"; } }}
                      >
                        <div style={{
                          width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                          background: `${preset.color}14`, border: `1px solid ${preset.color}28`,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          color: preset.color,
                        }}>
                          {preset.icon}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                            <span style={{ fontSize: "0.875rem", fontWeight: 700, color: "#D4D8E8" }}>{preset.name}</span>
                            <span style={{
                              padding: "1px 7px", borderRadius: 5,
                              fontSize: "0.6rem", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase",
                              color: preset.color, background: `${preset.color}14`, border: `1px solid ${preset.color}28`,
                            }}>
                              {affected.length} repos
                            </span>
                          </div>
                          <p style={{ fontSize: "0.75rem", color: "#4A5580", lineHeight: 1.5 }}>{preset.description}</p>
                        </div>
                        <ArrowRight size={14} style={{ color: isActive ? preset.color : "#2D3650", flexShrink: 0, marginTop: 2 }} />
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <AnimatePresence>
              {preview && (
                <motion.div
                  initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: 260 }} exit={{ opacity: 0, width: 0 }}
                  transition={{ duration: 0.18 }}
                  style={{
                    borderLeft: "1px solid rgba(255,255,255,0.07)",
                    display: "flex", flexDirection: "column", overflow: "hidden",
                  }}
                >
                  <div style={{ padding: "16px 16px 12px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                    <p style={{ fontSize: "0.875rem", fontWeight: 700, color: "#D4D8E8", marginBottom: 2 }}>{preview.preset.name}</p>
                    <p style={{ fontSize: "0.75rem", color: "#4A5580" }}>{preview.repos.length} repos selected</p>
                  </div>
                  <div style={{ flex: 1, overflowY: "auto", padding: "10px 12px" }}>
                    {preview.repos.length === 0 ? (
                      <p style={{ fontSize: "0.8125rem", color: "#2D3650", padding: "20px 4px" }}>No repos match this preset's criteria.</p>
                    ) : (
                      preview.repos.map((r) => (
                        <div key={r.id} style={{ padding: "4px 6px", borderRadius: 6, marginBottom: 2 }}>
                          <span style={{ fontSize: "0.75rem", color: "#6B7A9B", fontFamily: "monospace" }}>{r.name}</span>
                        </div>
                      ))
                    )}
                  </div>
                  <div style={{ padding: "12px 16px", borderTop: "1px solid rgba(255,255,255,0.07)" }}>
                    <button
                      onClick={handleQueue}
                      disabled={preview.repos.length === 0}
                      style={{
                        width: "100%", height: 36, borderRadius: 8, cursor: "pointer",
                        background: preview.repos.length > 0
                          ? `linear-gradient(135deg, ${preview.preset.color} 0%, ${preview.preset.color}CC 100%)`
                          : "rgba(255,255,255,0.04)",
                        border: "none", color: preview.repos.length > 0 ? "#fff" : "#3A4560",
                        fontSize: "0.8125rem", fontWeight: 700,
                        boxShadow: preview.repos.length > 0 ? `0 3px 14px ${preview.preset.color}35` : "none",
                      }}
                    >
                      Queue {preview.repos.length} repos
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
};
