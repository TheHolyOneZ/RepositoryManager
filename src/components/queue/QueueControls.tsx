import React, { useState } from "react";
import { Play, Pause, X, SkipForward, Zap, Clock, Info } from "lucide-react";
import { useQueueStore, selectPending } from "../../stores/queueStore";
import { queueStart, queuePause, queueResume, queueCancel, queueSkipCurrent } from "../../lib/tauri/commands";

export const QueueControls: React.FC = () => {
  const status = useQueueStore((s) => s.status);
  const mode = useQueueStore((s) => s.mode);
  const graceSeconds = useQueueStore((s) => s.graceSecondsRemaining);
  const pendingCount = useQueueStore((s) => selectPending(s).length);
  const [btnHover, setBtnHover] = useState<string | null>(null);
  const [showInfo, setShowInfo] = useState(false);

  const isIdle = status === "idle" || status === "done";
  const isActive = status === "running" || status === "paused" || status === "grace";

  return (
    <div style={{
      padding: "14px 16px", borderRadius: 14,
      background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)",
      display: "flex", flexDirection: "column", gap: 12,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <p style={{
          fontSize: "0.5625rem", fontWeight: 700, letterSpacing: "0.12em",
          textTransform: "uppercase", color: "#2D3650",
        }}>
          Queue Controls
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{
            fontSize: "0.6875rem", color: "#4A5580",
            display: "flex", alignItems: "center", gap: 4,
          }}>
            Mode: <strong style={{ color: "#8991A4" }}>Fast</strong>
          </span>
          <button
            onClick={() => setShowInfo(!showInfo)}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#3A4560", display: "flex" }}
            title="About execution modes"
          >
            <Info size={12} />
          </button>
        </div>
      </div>

      {showInfo && (
        <div style={{
          padding: "10px 12px", borderRadius: 8,
          background: "rgba(139,92,246,0.07)", border: "1px solid rgba(139,92,246,0.18)",
          fontSize: "0.6875rem", color: "#8991A4", lineHeight: 1.6,
        }}>
          <strong style={{ color: "#A78BFA", display: "block", marginBottom: 4 }}>Fast mode</strong>
          Processes operations at the maximum rate allowed by GitHub's API rate limits.
          Custom scheduling modes (Scheduled, Controlled) are coming in a future release.
        </div>
      )}

      {/* Control buttons */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>

        {/* Start */}
        {isIdle && pendingCount > 0 && (
          <button
            onClick={() => queueStart(mode, 0)}
            onMouseEnter={() => setBtnHover("start")}
            onMouseLeave={() => setBtnHover(null)}
            style={{
              flex: 1, height: 38, borderRadius: 9, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              background: btnHover === "start"
                ? "linear-gradient(135deg, #9D71FF 0%, #8B5CF6 100%)"
                : "linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)",
              border: "none", color: "#fff",
              fontSize: "0.875rem", fontWeight: 700,
              boxShadow: "0 4px 14px rgba(139,92,246,0.35)",
              transition: "all 130ms",
            }}
          >
            <Play size={14} fill="white" /> Start {pendingCount} operation{pendingCount !== 1 ? "s" : ""}
          </button>
        )}

        {/* Waiting (no items) */}
        {isIdle && pendingCount === 0 && (
          <div style={{
            flex: 1, height: 38, borderRadius: 9,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
            background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
            color: "#3A4560", fontSize: "0.8125rem",
          }}>
            <Clock size={13} /> No operations queued
          </div>
        )}

        {/* Grace period */}
        {status === "grace" && (
          <div style={{
            flex: 1, height: 38, borderRadius: 9,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.22)",
            color: "#F59E0B", fontSize: "0.875rem", fontWeight: 700,
          }}>
            <Zap size={14} /> Starting in {graceSeconds ?? 0}s…
          </div>
        )}

        {/* Pause */}
        {status === "running" && (
          <button
            onClick={queuePause}
            onMouseEnter={() => setBtnHover("pause")}
            onMouseLeave={() => setBtnHover(null)}
            style={{
              flex: 1, height: 38, borderRadius: 9, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              background: btnHover === "pause" ? "rgba(255,255,255,0.09)" : "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.10)", color: "#C8CDD8",
              fontSize: "0.875rem", fontWeight: 600, transition: "all 130ms",
            }}
          >
            <Pause size={14} /> Pause
          </button>
        )}

        {/* Resume */}
        {status === "paused" && (
          <button
            onClick={queueResume}
            onMouseEnter={() => setBtnHover("resume")}
            onMouseLeave={() => setBtnHover(null)}
            style={{
              flex: 1, height: 38, borderRadius: 9, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              background: btnHover === "resume"
                ? "linear-gradient(135deg, #9D71FF 0%, #8B5CF6 100%)"
                : "linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)",
              border: "none", color: "#fff",
              fontSize: "0.875rem", fontWeight: 700,
              boxShadow: "0 4px 14px rgba(139,92,246,0.35)",
              transition: "all 130ms",
            }}
          >
            <Play size={14} fill="white" /> Resume
          </button>
        )}

        {/* Skip + Cancel — shown whenever queue is active */}
        {isActive && (
          <>
            <button
              onClick={queueSkipCurrent}
              title="Skip current item"
              onMouseEnter={() => setBtnHover("skip")}
              onMouseLeave={() => setBtnHover(null)}
              style={{
                width: 38, height: 38, borderRadius: 9, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                background: btnHover === "skip" ? "rgba(255,255,255,0.09)" : "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.09)",
                color: "#6B7A9B", transition: "all 130ms",
              }}
            >
              <SkipForward size={14} />
            </button>
            <button
              onClick={queueCancel}
              onMouseEnter={() => setBtnHover("cancel")}
              onMouseLeave={() => setBtnHover(null)}
              style={{
                height: 38, padding: "0 14px", borderRadius: 9, cursor: "pointer",
                display: "flex", alignItems: "center", gap: 7,
                background: btnHover === "cancel" ? "rgba(239,68,68,0.26)" : "rgba(239,68,68,0.16)",
                border: "1px solid rgba(239,68,68,0.32)",
                color: "#F87171", fontSize: "0.875rem", fontWeight: 700,
                transition: "all 130ms",
              }}
            >
              <X size={14} /> Cancel
            </button>
          </>
        )}
      </div>
    </div>
  );
};
