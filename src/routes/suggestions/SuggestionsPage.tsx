import React, { useMemo, useState } from "react";
import { Lightbulb, Zap, Plus, Trash2, Sprout, Sparkles, FlaskConical, type LucideIcon, ChevronRight } from "lucide-react";
import { useRepoStore } from "../../stores/repoStore";
import { useUIStore } from "../../stores/uiStore";
import type { QueueItemInput } from "../../types/queue";
import type { Repo } from "../../types/repo";

interface Suggestion {
  id: string;
  repos: Repo[];
  reason: string;
  description: string;
  action: "archive" | "delete";
  priority: "high" | "medium" | "low";
}

const PRESETS: {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  color: string;
  filter: (r: Repo) => boolean;
}[] = [
  {
    id: "spring-clean",
    label: "Spring Clean",
    description: "Archive dead and empty repos in one sweep.",
    icon: Sprout,
    color: "#10B981",
    filter: (r) => r.health?.status === "dead" || r.health?.status === "empty",
  },
  {
    id: "portfolio",
    label: "Portfolio Focus",
    description: "Surface repos with fewer than five stars that are not active.",
    icon: Sparkles,
    color: "#F59E0B",
    filter: (r) => r.stars < 5 && r.health?.status !== "active",
  },
  {
    id: "minimal",
    label: "Empty Only",
    description: "Target empty repos for deletion review.",
    icon: FlaskConical,
    color: "#EF4444",
    filter: (r) => r.health?.status === "empty",
  },
];

const PRIORITY_COLOR: Record<string, string> = {
  high: "#EF4444", medium: "#F59E0B", low: "#94A3B8",
};

const SectionLabel: React.FC<{ kicker: string; title: string }> = ({ kicker, title }) => (
  <div style={{ marginBottom: 16 }}>
    <p style={{
      fontSize: "0.5625rem", fontWeight: 700, letterSpacing: "0.14em",
      textTransform: "uppercase", color: "#3A4560", marginBottom: 3,
    }}>{kicker}</p>
    <h2 style={{ fontSize: "1.0625rem", fontWeight: 800, color: "#D4D8E8", letterSpacing: "-0.03em" }}>{title}</h2>
  </div>
);

export const SuggestionsPage: React.FC = () => {
  const repos = useRepoStore((s) => s.repos);
  const openModal = useUIStore((s) => s.openModal);
  const [hoveredPreset, setHoveredPreset] = useState<string | null>(null);
  const [hoveredAction, setHoveredAction] = useState<string | null>(null);

  const suggestions: Suggestion[] = useMemo(() => {
    const result: Suggestion[] = [];
    const dead = repos.filter((r) => r.health?.status === "dead");
    if (dead.length > 0) {
      result.push({
        id: "dead-repos", repos: dead, reason: "Inactive",
        description: `${dead.length} repos have had no pushes in 6+ months`,
        action: "archive", priority: dead.length > 5 ? "high" : "medium",
      });
    }
    const empty = repos.filter((r) => r.health?.status === "empty");
    if (empty.length > 0) {
      result.push({
        id: "empty-repos", repos: empty, reason: "Empty",
        description: `${empty.length} repos have no content`,
        action: "delete", priority: "medium",
      });
    }
    const abandonedForks = repos.filter((r) => r.fork && r.stars === 0 && r.health?.status !== "active");
    if (abandonedForks.length > 0) {
      result.push({
        id: "abandoned-forks", repos: abandonedForks, reason: "Abandoned Fork",
        description: `${abandonedForks.length} inactive forks with no stars`,
        action: "delete", priority: "low",
      });
    }
    const noDesc = repos.filter((r) => !r.description && r.health?.status === "active");
    if (noDesc.length > 0) {
      result.push({
        id: "no-description", repos: noDesc.slice(0, 10), reason: "Missing Description",
        description: `${noDesc.length} active repos have no description`,
        action: "archive", priority: "low",
      });
    }
    return result;
  }, [repos]);

  const applyPreset = (preset: typeof PRESETS[0]) => {
    const matching = repos.filter(preset.filter);
    if (matching.length === 0) return;
    const items: QueueItemInput[] = matching.map((r) => ({
      repo_id: r.id, repo_name: r.name, repo_full_name: r.full_name,
      action: "archive", payload: { archive: true },
    }));
    openModal("confirm-queue", { items, action: "archive" });
  };

  const queueSuggestion = (s: Suggestion) => {
    const items: QueueItemInput[] = s.repos.map((r) => ({
      repo_id: r.id, repo_name: r.name, repo_full_name: r.full_name,
      action: s.action, payload: s.action === "archive" ? { archive: true } : {},
    }));
    openModal("confirm-queue", { items, action: s.action });
  };

  return (
    <div style={{ height: "100%", overflowY: "auto" }}>
      <div style={{
        padding: "20px 24px 16px",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        background: "rgba(255,255,255,0.01)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 9,
            background: "rgba(139,92,246,0.15)", border: "1px solid rgba(139,92,246,0.25)",
            display: "flex", alignItems: "center", justifyContent: "center", color: "#A78BFA",
          }}>
            <Lightbulb size={15} strokeWidth={2} />
          </div>
          <div>
            <p style={{ fontSize: "0.5rem", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#3A4560" }}>
              Intelligence
            </p>
            <h1 style={{ fontSize: "1.0625rem", fontWeight: 800, color: "#D4D8E8", letterSpacing: "-0.03em", lineHeight: 1 }}>
              Suggestions
            </h1>
          </div>
        </div>
        <p style={{ fontSize: "0.75rem", color: "#3A4560", marginTop: 6 }}>
          Presets and heuristics to queue bulk work — everything still goes through confirmation.
        </p>
      </div>

      <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: 36 }}>

        <section>
          <SectionLabel kicker="Cleanup Presets" title="One-click starting points" />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
            {PRESETS.map((preset) => {
              const count = repos.filter(preset.filter).length;
              const Icon = preset.icon;
              const hov = hoveredPreset === preset.id;
              return (
                <div
                  key={preset.id}
                  onClick={() => { if (count > 0) applyPreset(preset); }}
                  onMouseEnter={() => setHoveredPreset(preset.id)}
                  onMouseLeave={() => setHoveredPreset(null)}
                  style={{
                    borderRadius: 14, padding: 18, cursor: count > 0 ? "pointer" : "default",
                    background: hov && count > 0
                      ? "rgba(255,255,255,0.04)"
                      : "rgba(255,255,255,0.022)",
                    border: `1px solid ${hov && count > 0 ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.07)"}`,
                    display: "flex", flexDirection: "column", gap: 14,
                    transition: "all 150ms",
                    transform: hov && count > 0 ? "translateY(-1px)" : "none",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: 11, flexShrink: 0,
                      background: `${preset.color}14`, border: `1px solid ${preset.color}28`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      color: preset.color,
                    }}>
                      <Icon size={18} strokeWidth={1.75} />
                    </div>
                    <span style={{
                      padding: "2px 8px", borderRadius: 10, flexShrink: 0,
                      fontSize: "0.625rem", fontWeight: 800, letterSpacing: "0.08em",
                      color: preset.color, background: `${preset.color}18`,
                    }}>
                      {count} repos
                    </span>
                  </div>
                  <div>
                    <p style={{ fontSize: "0.875rem", fontWeight: 700, color: "#D4D8E8", letterSpacing: "-0.01em", marginBottom: 4 }}>
                      {preset.label}
                    </p>
                    <p style={{ fontSize: "0.75rem", color: "#6B7A9B", lineHeight: 1.55 }}>
                      {preset.description}
                    </p>
                  </div>
                  {count > 0 ? (
                    <div style={{
                      height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                      background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.09)",
                      color: "#C8CDD8", fontSize: "0.75rem", fontWeight: 600,
                    }}>
                      <Plus size={11} /> Queue {count} repos
                    </div>
                  ) : (
                    <p style={{ fontSize: "0.75rem", fontWeight: 600, color: "#10B981" }}>
                      Nothing to clean up
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <section>
          <SectionLabel kicker="Heuristics" title="Smart suggestions" />

          {suggestions.length === 0 ? (
            <div style={{
              padding: "48px 24px", borderRadius: 14, textAlign: "center",
              background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.06)",
            }}>
              <div style={{
                width: 48, height: 48, borderRadius: 12, margin: "0 auto 12px",
                background: "rgba(16,185,129,0.10)", border: "1px solid rgba(16,185,129,0.20)",
                display: "flex", alignItems: "center", justifyContent: "center", color: "#10B981",
              }}>
                <Sparkles size={20} strokeWidth={1.75} />
              </div>
              <p style={{ fontSize: "0.875rem", fontWeight: 700, color: "#10B981", marginBottom: 6 }}>
                Your estate looks healthy
              </p>
              <p style={{ fontSize: "0.75rem", color: "#3A4560" }}>
                No automatic suggestions right now.
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {suggestions.map((s) => {
                const actionKey = `${s.id}-action`;
                const isDelete = s.action === "delete";
                return (
                  <div key={s.id} style={{
                    padding: 16, borderRadius: 12,
                    background: "rgba(255,255,255,0.022)", border: "1px solid rgba(255,255,255,0.07)",
                    display: "flex", alignItems: "flex-start", gap: 16,
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginBottom: 6 }}>
                        <span style={{
                          padding: "1px 7px", borderRadius: 8,
                          fontSize: "0.5625rem", fontWeight: 800, letterSpacing: "0.10em", textTransform: "uppercase",
                          color: PRIORITY_COLOR[s.priority], background: `${PRIORITY_COLOR[s.priority]}18`,
                        }}>
                          {s.priority}
                        </span>
                        <span style={{ fontSize: "0.75rem", color: "#4A5580" }}>{s.reason}</span>
                      </div>
                      <p style={{ fontSize: "0.875rem", color: "#C8CDD8", lineHeight: 1.4, marginBottom: 10 }}>
                        {s.description}
                      </p>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                        {s.repos.slice(0, 5).map((r) => (
                          <span key={r.id} style={{
                            padding: "2px 7px", borderRadius: 5,
                            background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
                            fontFamily: "'Cascadia Code','Consolas',monospace",
                            fontSize: "0.625rem", color: "#8991A4",
                          }}>
                            {r.name}
                          </span>
                        ))}
                        {s.repos.length > 5 && (
                          <span style={{ fontSize: "0.625rem", color: "#3A4560", alignSelf: "center" }}>
                            +{s.repos.length - 5} more
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => queueSuggestion(s)}
                      onMouseEnter={() => setHoveredAction(actionKey)}
                      onMouseLeave={() => setHoveredAction(null)}
                      style={{
                        flexShrink: 0, height: 34, padding: "0 14px", borderRadius: 8, cursor: "pointer",
                        display: "flex", alignItems: "center", gap: 6,
                        background: isDelete
                          ? (hoveredAction === actionKey ? "rgba(239,68,68,0.22)" : "rgba(239,68,68,0.14)")
                          : (hoveredAction === actionKey ? "rgba(255,255,255,0.09)" : "rgba(255,255,255,0.05)"),
                        border: isDelete ? "1px solid rgba(239,68,68,0.28)" : "1px solid rgba(255,255,255,0.10)",
                        color: isDelete ? "#F87171" : "#C8CDD8",
                        fontSize: "0.75rem", fontWeight: 600, transition: "all 130ms",
                      }}
                    >
                      {isDelete ? <><Trash2 size={11} /> Queue deletes</> : <><Zap size={11} /> Queue archives</>}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
