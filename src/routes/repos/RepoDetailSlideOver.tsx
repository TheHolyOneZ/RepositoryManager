import React, { useState, useEffect } from "react";
import { ExternalLink, Star, GitFork, AlertCircle, HardDrive, Calendar, Globe, Lock, Archive, Trash2, Tag, X, Code2 } from "lucide-react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import type { Repo } from "../../types/repo";
import { formatDateFull, formatBytes } from "../../lib/utils/formatters";
import { useRepoStore } from "../../stores/repoStore";
import { useUIStore } from "../../stores/uiStore";
import { repoGetLanguages, openUrlExternal, type RepoLanguageStat } from "../../lib/tauri/commands";

interface RepoDetailSlideOverProps {
  open: boolean;
  repo: Repo | null;
  onClose: () => void;
}

const BUILTIN_TAG_COLORS: Record<string, string> = { keep: "#10B981", delete: "#EF4444", review: "#F59E0B" };
const BUILTIN_TAGS = ["keep", "delete", "review"];

function tagColor(tag: string): string {
  return BUILTIN_TAG_COLORS[tag] ?? "#A78BFA";
}
const HEALTH_COLORS: Record<string, string> = {
  active: "#10B981", dormant: "#F59E0B", dead: "#EF4444", empty: "#6B7280", archived: "#8B5CF6",
};

const langColors: Record<string, string> = {
  TypeScript: "#3178c6", JavaScript: "#f1e05a", Python: "#3572A5",
  Rust: "#dea584", Go: "#00ADD8", Java: "#b07219", "C++": "#f34b7d",
  C: "#555555", Ruby: "#701516", Swift: "#F05138", Kotlin: "#A97BFF",
  PHP: "#4F5D95", HTML: "#e34c26", CSS: "#563d7c", Shell: "#89e051",
  Dart: "#00B4AB", Vue: "#41b883", Svelte: "#ff3e00",
};

export const RepoDetailSlideOver: React.FC<RepoDetailSlideOverProps> = ({ open, repo, onClose }) => {
  const updateRepoTag = useRepoStore((s) => s.updateRepoTag);
  const customTagOptions = useRepoStore((s) => s.customTagOptions);
  const openModal = useUIStore((s) => s.openModal);
  const [hoveredBtn, setHoveredBtn] = useState<string | null>(null);
  const [languages, setLanguages] = useState<RepoLanguageStat[]>([]);
  const [langsLoading, setLangsLoading] = useState(false);

  useEffect(() => {
    if (!open || !repo) { setLanguages([]); return; }
    setLangsLoading(true);
    repoGetLanguages(repo.full_name)
      .then(setLanguages)
      .catch(() => setLanguages([]))
      .finally(() => setLangsLoading(false));
  }, [open, repo?.full_name]);

  const allTagOptions = [...BUILTIN_TAGS, ...customTagOptions];

  const enqueue = (action: "archive" | "delete" | "set_private" | "set_public") => {
    if (!repo) return;

    onClose();
    openModal("confirm-queue", {
      items: [{
        repo_id: repo.id,
        repo_name: repo.name,
        repo_full_name: repo.full_name,
        action,
        payload:
          action === "archive" ? { archive: true } :
          action === "set_private" ? { private: true } :
          action === "set_public" ? { private: false } : {},
      }],
      action,
    });
  };

  return createPortal(
    <AnimatePresence>
      {open && repo && (
        <>
          <motion.div
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            style={{
              position: "fixed", inset: 0, zIndex: 40,
              background: "rgba(0,0,0,0.55)",
              backdropFilter: "blur(4px)",
            }}
          />

          <motion.div
            initial={{ x: "100%", opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "100%", opacity: 0 }}
            transition={{ type: "spring", stiffness: 340, damping: 38, mass: 0.8 }}
            style={{
              position: "fixed", top: 0, right: 0, height: "100%", zIndex: 50,
              width: 520, display: "flex", flexDirection: "column",
              background: "rgba(8,10,20,0.98)",
              backdropFilter: "blur(28px) saturate(160%)",
              WebkitBackdropFilter: "blur(28px) saturate(160%)",
              borderLeft: "1px solid rgba(255,255,255,0.09)",
              boxShadow: "-24px 0 60px rgba(0,0,0,0.55), -1px 0 0 rgba(255,255,255,0.04)",
            }}
          >
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,0.07)",
              flexShrink: 0,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                  background: "rgba(139,92,246,0.15)", border: "1px solid rgba(139,92,246,0.25)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "#A78BFA",
                }}>
                  {repo.private ? <Lock size={13} /> : <Globe size={13} />}
                </div>
                <div style={{ minWidth: 0 }}>
                  <p style={{
                    fontSize: "0.9375rem", fontWeight: 700, color: "#D4D8E8",
                    letterSpacing: "-0.02em", fontFamily: "'Cascadia Code','Consolas',monospace",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {repo.name}
                  </p>
                  <p style={{ fontSize: "0.6875rem", color: "#3A4560", marginTop: 1 }}>
                    {repo.full_name}
                  </p>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                <button
                  onClick={() => openUrlExternal(repo.html_url).catch(() => window.open(repo.html_url, "_blank"))}
                  title="Open on GitHub"
                  style={{
                    width: 32, height: 32, borderRadius: 7, display: "flex",
                    alignItems: "center", justifyContent: "center",
                    color: "#4A5580", background: "transparent",
                    border: "1px solid rgba(255,255,255,0.07)", transition: "all 140ms",
                    cursor: "pointer",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = "#8B5CF6"; e.currentTarget.style.background = "rgba(139,92,246,0.10)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = "#4A5580"; e.currentTarget.style.background = "transparent"; }}
                >
                  <ExternalLink size={13} />
                </button>
                <button
                  onClick={onClose}
                  style={{
                    width: 32, height: 32, borderRadius: 7, cursor: "pointer",
                    background: "transparent", border: "1px solid rgba(255,255,255,0.07)",
                    color: "#4A5580", display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "all 140ms",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.color = "#8991A4"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#4A5580"; }}
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: "20px" }}>

              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
                {repo.health && (
                  <span style={{
                    display: "inline-flex", alignItems: "center", gap: 5,
                    height: 22, padding: "0 8px", borderRadius: 6,
                    background: `${HEALTH_COLORS[repo.health.status]}18`,
                    border: `1px solid ${HEALTH_COLORS[repo.health.status]}30`,
                    color: HEALTH_COLORS[repo.health.status],
                    fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "capitalize",
                  }}>
                    <span style={{ width: 5, height: 5, borderRadius: "50%", background: HEALTH_COLORS[repo.health.status] }} />
                    {repo.health.status}
                    {repo.health.score != null && (
                      <span style={{ opacity: 0.6, fontSize: "0.625rem" }}>· {repo.health.score}</span>
                    )}
                  </span>
                )}
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: 4, height: 22, padding: "0 8px",
                  borderRadius: 6, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                  color: "#6B7A9B", fontSize: "0.6875rem", fontWeight: 500,
                }}>
                  {repo.private ? <Lock size={9} /> : <Globe size={9} />}
                  {repo.private ? "Private" : "Public"}
                </span>
                {repo.fork && (
                  <span style={{
                    height: 22, padding: "0 8px", borderRadius: 6, display: "inline-flex", alignItems: "center",
                    background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                    color: "#6B7A9B", fontSize: "0.6875rem", fontWeight: 500,
                  }}>Fork</span>
                )}
                {repo.archived && (
                  <span style={{
                    height: 22, padding: "0 8px", borderRadius: 6, display: "inline-flex", alignItems: "center",
                    background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.25)",
                    color: "#F59E0B", fontSize: "0.6875rem", fontWeight: 600,
                  }}>Archived</span>
                )}
              </div>

              {repo.description && (
                <p style={{
                  fontSize: "0.8125rem", color: "#8991A4", lineHeight: 1.65,
                  marginBottom: 20, padding: "12px 14px",
                  background: "rgba(255,255,255,0.025)",
                  borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)",
                }}>
                  {repo.description}
                </p>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 20 }}>
                {[
                  { label: "Stars", value: repo.stars.toLocaleString(), icon: <Star size={12} />, color: "#F59E0B" },
                  { label: "Forks", value: repo.forks.toLocaleString(), icon: <GitFork size={12} />, color: "#8B5CF6" },
                  { label: "Issues", value: String(repo.open_issues), icon: <AlertCircle size={12} />, color: "#EF4444" },
                  { label: "Size", value: formatBytes(repo.size_kb), icon: <HardDrive size={12} />, color: "#6B7A9B" },
                ].map(({ label, value, icon, color }) => (
                  <div key={label} style={{
                    padding: "12px 14px", borderRadius: 10,
                    background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.065)",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 5, color, marginBottom: 6 }}>
                      {icon}
                      <span style={{ fontSize: "0.625rem", fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase" }}>
                        {label}
                      </span>
                    </div>
                    <p style={{ fontSize: "1rem", fontWeight: 800, color: "#D4D8E8", fontVariantNumeric: "tabular-nums" }}>
                      {value}
                    </p>
                  </div>
                ))}
              </div>

              <div style={{
                padding: "12px 14px", borderRadius: 10, marginBottom: 20,
                background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.065)",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                  <Code2 size={11} style={{ color: "#3A4560" }} />
                  <span style={{ fontSize: "0.5625rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#2D3650" }}>
                    Languages
                  </span>
                </div>
                {langsLoading ? (
                  <div style={{ display: "flex", gap: 6 }}>
                    {[80, 50, 30].map((w, i) => (
                      <div key={i} style={{ height: 6, width: w, borderRadius: 3, background: "rgba(255,255,255,0.07)", animation: "pulse 1.5s ease-in-out infinite" }} />
                    ))}
                  </div>
                ) : languages.length > 0 ? (
                  <>
                    <div style={{ display: "flex", height: 6, borderRadius: 3, overflow: "hidden", marginBottom: 10, gap: 1 }}>
                      {languages.map((l) => (
                        <div key={l.language} style={{
                          width: `${l.percentage}%`,
                          background: langColors[l.language] ?? "#6B7280",
                          borderRadius: 3,
                          minWidth: l.percentage > 1 ? 3 : 0,
                        }} />
                      ))}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                      {languages.map((l) => (
                        <div key={l.language} style={{ display: "flex", alignItems: "center", gap: 7 }}>
                          <span style={{ width: 7, height: 7, borderRadius: "50%", background: langColors[l.language] ?? "#6B7280", flexShrink: 0 }} />
                          <span style={{ flex: 1, fontSize: "0.75rem", color: "#C8CDD8", fontFamily: "'Cascadia Code','Consolas',monospace" }}>{l.language}</span>
                          <span style={{ fontSize: "0.6875rem", color: "#4A5580", fontVariantNumeric: "tabular-nums" }}>
                            {l.percentage.toFixed(1)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : repo.language ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: langColors[repo.language] ?? "#6B7280" }} />
                    <span style={{ fontSize: "0.8125rem", color: "#C8CDD8", fontFamily: "'Cascadia Code','Consolas',monospace" }}>{repo.language}</span>
                  </div>
                ) : (
                  <span style={{ fontSize: "0.75rem", color: "#2D3650" }}>No language data</span>
                )}
              </div>

              <div style={{
                padding: "12px 14px", borderRadius: 10, marginBottom: 20,
                background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.065)",
                display: "flex", flexDirection: "column", gap: 8,
              }}>
                {[
                  { label: "Created", value: formatDateFull(repo.created_at) },
                  { label: "Updated", value: formatDateFull(repo.updated_at) },
                  ...(repo.pushed_at ? [{ label: "Last push", value: formatDateFull(repo.pushed_at) }] : []),
                ].map(({ label, value }) => (
                  <div key={label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#3A4560" }}>
                      <Calendar size={10} />
                      <span style={{ fontSize: "0.6875rem" }}>{label}</span>
                    </div>
                    <span style={{ fontSize: "0.6875rem", color: "#8991A4", fontVariantNumeric: "tabular-nums" }}>
                      {value}
                    </span>
                  </div>
                ))}
              </div>

              {repo.topics.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <p style={{
                    fontSize: "0.5625rem", fontWeight: 700, letterSpacing: "0.12em",
                    textTransform: "uppercase", color: "#2D3650", marginBottom: 8,
                  }}>Topics</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                    {repo.topics.map((t) => (
                      <span key={t} style={{
                        fontSize: "0.6875rem", padding: "3px 10px", borderRadius: 20,
                        border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)",
                        color: "#8991A4",
                      }}>{t}</span>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ marginBottom: 24 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                  <Tag size={10} style={{ color: "#3A4560" }} />
                  <p style={{
                    fontSize: "0.5625rem", fontWeight: 700, letterSpacing: "0.12em",
                    textTransform: "uppercase", color: "#2D3650",
                  }}>Local Tags</p>
                </div>

                {(repo.tags ?? []).length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 8 }}>
                    {(repo.tags ?? []).map((t) => {
                      const c = tagColor(t);
                      return (
                        <span key={t} style={{
                          display: "inline-flex", alignItems: "center", gap: 5,
                          padding: "3px 8px 3px 8px", borderRadius: 6,
                          background: `${c}18`, border: `1px solid ${c}30`,
                          fontSize: "0.6875rem", fontWeight: 600, color: c,
                        }}>
                          <span style={{ width: 5, height: 5, borderRadius: "50%", background: c }} />
                          {t}
                          <button
                            onClick={() => updateRepoTag(repo.id, t, false)}
                            style={{
                              background: "none", border: "none", cursor: "pointer",
                              color: "inherit", opacity: 0.5, padding: 0, marginLeft: 2,
                              display: "flex", alignItems: "center",
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.opacity = "1"; }}
                            onMouseLeave={(e) => { e.currentTarget.style.opacity = "0.5"; }}
                          >
                            <X size={9} />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}

                <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                  {allTagOptions.filter((t) => !(repo.tags ?? []).includes(t)).map((t) => {
                    const c = tagColor(t);
                    return (
                      <button
                        key={t}
                        onClick={() => updateRepoTag(repo.id, t, true)}
                        style={{
                          display: "inline-flex", alignItems: "center", gap: 4,
                          padding: "3px 8px", borderRadius: 6, cursor: "pointer",
                          background: "transparent",
                          border: "1px dashed rgba(255,255,255,0.12)",
                          color: "#4A5580", fontSize: "0.6875rem", fontWeight: 500,
                          transition: "all 130ms",
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = c + "80"; e.currentTarget.style.color = c; }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)"; e.currentTarget.style.color = "#4A5580"; }}
                      >
                        + {t}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div style={{
                borderTop: "1px solid rgba(255,255,255,0.07)",
                paddingTop: 20,
              }}>
                <p style={{
                  fontSize: "0.5625rem", fontWeight: 700, letterSpacing: "0.12em",
                  textTransform: "uppercase", color: "#2D3650", marginBottom: 12,
                }}>Actions</p>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                  {!repo.archived && (
                    <button
                      onClick={() => enqueue("archive")}
                      style={{
                        height: 38, borderRadius: 9, cursor: "pointer", display: "flex",
                        alignItems: "center", justifyContent: "center", gap: 7,
                        background: hoveredBtn === "archive" ? "rgba(245,158,11,0.18)" : "rgba(245,158,11,0.10)",
                        border: "1px solid rgba(245,158,11,0.28)",
                        color: "#F59E0B", fontSize: "0.8125rem", fontWeight: 600,
                        transition: "all 140ms",
                      }}
                      onMouseEnter={() => setHoveredBtn("archive")}
                      onMouseLeave={() => setHoveredBtn(null)}
                    >
                      <Archive size={13} /> Archive
                    </button>
                  )}

                  <button
                    onClick={() => enqueue(repo.private ? "set_public" : "set_private")}
                    style={{
                      height: 38, borderRadius: 9, cursor: "pointer", display: "flex",
                      alignItems: "center", justifyContent: "center", gap: 7,
                      background: hoveredBtn === "privacy" ? "rgba(255,255,255,0.09)" : "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.10)",
                      color: "#C8CDD8", fontSize: "0.8125rem", fontWeight: 600,
                      transition: "all 140ms",
                    }}
                    onMouseEnter={() => setHoveredBtn("privacy")}
                    onMouseLeave={() => setHoveredBtn(null)}
                  >
                    {repo.private ? <><Globe size={13} /> Make Public</> : <><Lock size={13} /> Make Private</>}
                  </button>
                </div>

                <button
                  onClick={() => enqueue("delete")}
                  style={{
                    width: "100%", height: 40, borderRadius: 9, cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    background: hoveredBtn === "delete" ? "rgba(239,68,68,0.22)" : "rgba(239,68,68,0.14)",
                    border: "1px solid rgba(239,68,68,0.32)",
                    color: "#F87171", fontSize: "0.8125rem", fontWeight: 700,
                    transition: "all 140ms", letterSpacing: "0.01em",
                  }}
                  onMouseEnter={() => setHoveredBtn("delete")}
                  onMouseLeave={() => setHoveredBtn(null)}
                >
                  <Trash2 size={14} /> Delete Repository
                </button>

                <p style={{
                  fontSize: "0.625rem", color: "#2D3650", textAlign: "center", marginTop: 8,
                }}>
                  All actions go through confirmation and respect your dry-run setting.
                </p>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
};
