import React, { useState } from "react";
import { CheckCircle, XCircle, SkipForward, Loader2, Clock, RotateCcw } from "lucide-react";
import type { QueueItem as QueueItemType } from "../../types/queue";

const ACTION_LABELS: Record<string, string> = {
  delete: "Delete",
  archive: "Archive",
  unarchive: "Unarchive",
  set_public: "Make Public",
  set_private: "Make Private",
  rename: "Rename",
  add_topics: "Add Topics",
  remove_topics: "Remove Topics",
  transfer: "Transfer",
  update_metadata: "Update Metadata",
};

const STATUS_CONFIG: Record<string, { color: string; bg: string; border: string; icon: React.ReactNode; label: string }> = {
  pending: {
    color: "#4A5580", bg: "transparent", border: "rgba(255,255,255,0.06)",
    icon: <Clock size={13} />, label: "Pending",
  },
  processing: {
    color: "#A78BFA", bg: "rgba(139,92,246,0.06)", border: "rgba(139,92,246,0.22)",
    icon: <Loader2 size={13} style={{ animation: "spin 0.9s linear infinite" }} />, label: "Processing",
  },
  completed: {
    color: "#10B981", bg: "rgba(16,185,129,0.06)", border: "rgba(16,185,129,0.18)",
    icon: <CheckCircle size={13} />, label: "Done",
  },
  failed: {
    color: "#EF4444", bg: "rgba(239,68,68,0.06)", border: "rgba(239,68,68,0.22)",
    icon: <XCircle size={13} />, label: "Failed",
  },
  skipped: {
    color: "#6B7A9B", bg: "rgba(255,255,255,0.025)", border: "rgba(255,255,255,0.06)",
    icon: <SkipForward size={13} />, label: "Skipped",
  },
};

interface QueueItemProps {
  item: QueueItemType;
  onRetry?: () => void;
  onSkip?: () => void;
}

export const QueueItemCard: React.FC<QueueItemProps> = ({ item, onRetry, onSkip }) => {
  const [retryHover, setRetryHover] = useState(false);
  const cfg = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.pending;

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "9px 12px", borderRadius: 9,
      background: cfg.bg, border: `1px solid ${cfg.border}`,
      transition: "all 140ms",
    }}>
      <span style={{ color: cfg.color, flexShrink: 0, display: "flex", alignItems: "center" }}>
        {cfg.icon}
      </span>

      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          fontSize: "0.8125rem", fontWeight: 600, color: "#D4D8E8",
          fontFamily: "'Cascadia Code','Consolas',monospace",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          letterSpacing: "-0.01em",
        }}>
          {item.repo_name}
        </p>
        <p style={{ fontSize: "0.6875rem", color: "#4A5580", marginTop: 1 }}>
          {ACTION_LABELS[item.action] ?? item.action}
        </p>
        {item.error && (
          <p style={{
            fontSize: "0.625rem", color: "#F87171", marginTop: 3,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {item.error}
          </p>
        )}
      </div>

      <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
        {item.status === "failed" && onRetry && (
          <button
            onClick={onRetry}
            onMouseEnter={() => setRetryHover(true)}
            onMouseLeave={() => setRetryHover(false)}
            style={{
              height: 24, padding: "0 8px", borderRadius: 6, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 4,
              background: retryHover ? "rgba(255,255,255,0.09)" : "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.09)",
              color: "#8991A4", fontSize: "0.6875rem", fontWeight: 600,
              transition: "all 120ms",
            }}
          >
            <RotateCcw size={9} /> Retry
          </button>
        )}
        {item.status === "pending" && onSkip && (
          <button
            onClick={onSkip}
            title="Skip"
            style={{
              width: 24, height: 24, borderRadius: 6, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              background: "transparent", border: "none",
              color: "#3A4560", transition: "color 120ms",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "#8991A4"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "#3A4560"; }}
          >
            <SkipForward size={11} />
          </button>
        )}
      </div>
    </div>
  );
};
