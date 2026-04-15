import React, { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, CheckCircle, XCircle, Loader2, Zap, Play, Pause, X, SkipForward } from "lucide-react";
import { QueueControls } from "../../components/queue/QueueControls";
import { GraceWindowCountdown } from "../../components/queue/GraceWindowCountdown";
import { QueueItemCard } from "../../components/queue/QueueItem";
import {
  useQueueStore,
  selectPending,
  selectProcessing,
  selectCompleted,
  selectFailed,
  selectSkipped,
  selectTotalCount,
} from "../../stores/queueStore";
import { useShallow } from "zustand/react/shallow";
import { queueCancel, queueSkipCurrent, queueRetryFailed, queueGetState, queuePause, queueResume } from "../../lib/tauri/commands";
import type { QueueItem as QueueItemType } from "../../types/queue";

interface LaneProps {
  title: string;
  icon: React.ReactNode;
  items: QueueItemType[];
  color: string;
  count?: number;
  onRetry?: (id: string) => void;
  onSkip?: (id: string) => void;
}

const Lane: React.FC<LaneProps> = ({ title, icon, items, color, onRetry, onSkip }) => (
  <div style={{
    display: "flex", flexDirection: "column", minHeight: 0, flex: 1, overflow: "hidden",
    borderRadius: 14, background: "rgba(255,255,255,0.022)", border: "1px solid rgba(255,255,255,0.07)",
  }}>
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
      padding: "10px 14px", flexShrink: 0,
      borderBottom: "1px solid rgba(255,255,255,0.06)",
      background: "rgba(255,255,255,0.015)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, color }}>
        {icon}
        <span style={{ fontSize: "0.8125rem", fontWeight: 700, color: "#C8CDD8", letterSpacing: "-0.01em" }}>
          {title}
        </span>
      </div>
      <span style={{
        padding: "2px 7px", borderRadius: 6,
        fontSize: "0.625rem", fontWeight: 800, fontVariantNumeric: "tabular-nums",
        color, background: `${color}18`,
      }}>
        {items.length}
      </span>
    </div>

    <div style={{ flex: 1, overflowY: "auto", padding: 10, display: "flex", flexDirection: "column", gap: 5 }}>
      <AnimatePresence mode="popLayout">
        {items.map((item) => (
          <motion.div
            key={item.id}
            layout
            initial={{ opacity: 0, scale: 0.96, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -6 }}
            transition={{ type: "spring", stiffness: 500, damping: 36 }}
          >
            <QueueItemCard
              item={item}
              onRetry={onRetry ? () => onRetry(item.id) : undefined}
              onSkip={onSkip ? () => onSkip(item.id) : undefined}
            />
          </motion.div>
        ))}
      </AnimatePresence>

      {items.length === 0 && (
        <div style={{
          flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
          padding: "32px 0", fontSize: "0.6875rem", color: "#2D3650",
        }}>
          Empty
        </div>
      )}
    </div>
  </div>
);

export const QueuePage: React.FC = () => {
  const status = useQueueStore((s) => s.status);
  const graceSeconds = useQueueStore((s) => s.graceSecondsRemaining);
  const pending = useQueueStore(useShallow(selectPending));
  const processing = useQueueStore(selectProcessing);
  const completed = useQueueStore(useShallow(selectCompleted));
  const failed = useQueueStore(useShallow(selectFailed));
  const skipped = useQueueStore(useShallow(selectSkipped));
  const totalCount = useQueueStore(selectTotalCount);
  const setItems = useQueueStore((s) => s.setItems);
  const setStatus = useQueueStore((s) => s.setStatus);
  const setGraceSeconds = useQueueStore((s) => s.setGraceSeconds);


  useEffect(() => {
    queueGetState().then((state) => {
      if (state.items && state.items.length > 0) {
        setItems(state.items);
      }
      if (state.status) setStatus(state.status);
      if (state.grace_seconds_remaining != null) setGraceSeconds(state.grace_seconds_remaining);
    }).catch(() => {

    });
  }, [setItems, setStatus, setGraceSeconds]);

  const handleRetry = (id: string) => queueRetryFailed([id]);

  const isActive = status === "running" || status === "paused" || status === "grace";

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0, overflow: "hidden" }}>
      <div style={{
        padding: "16px 24px 14px",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        flexShrink: 0,
        background: "rgba(255,255,255,0.01)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 9,
            background: status === "running"
              ? "rgba(139,92,246,0.20)"
              : "rgba(139,92,246,0.15)",
            border: `1px solid ${status === "running" ? "rgba(139,92,246,0.40)" : "rgba(139,92,246,0.25)"}`,
            display: "flex", alignItems: "center", justifyContent: "center", color: "#A78BFA",
          }}>
            <Zap size={15} strokeWidth={2} style={status === "running" ? { animation: "pulse 1.5s ease-in-out infinite" } : {}} />
          </div>
          <div>
            <p style={{ fontSize: "0.5rem", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#3A4560" }}>
              Operations
            </p>
            <h1 style={{ fontSize: "1.0625rem", fontWeight: 800, color: "#D4D8E8", letterSpacing: "-0.03em", lineHeight: 1 }}>
              Queue
            </h1>
          </div>
        </div>

        {isActive && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "4px 10px", borderRadius: 8,
              background: status === "running"
                ? "rgba(139,92,246,0.12)"
                : status === "paused"
                ? "rgba(245,158,11,0.12)"
                : "rgba(239,68,68,0.10)",
              border: `1px solid ${status === "running" ? "rgba(139,92,246,0.25)" : status === "paused" ? "rgba(245,158,11,0.25)" : "rgba(239,68,68,0.20)"}`,
            }}>
              <span style={{
                width: 6, height: 6, borderRadius: "50%",
                background: status === "running" ? "#8B5CF6" : status === "paused" ? "#F59E0B" : "#EF4444",
                animation: status === "running" ? "pulse 1.5s ease-in-out infinite" : "none",
              }} />
              <span style={{
                fontSize: "0.6875rem", fontWeight: 700,
                color: status === "running" ? "#A78BFA" : status === "paused" ? "#F59E0B" : "#F87171",
              }}>
                {status === "running" ? `Running · ${pending.length} left` : status === "paused" ? "Paused" : `Grace period · ${graceSeconds ?? 0}s`}
              </span>
            </div>

            {status === "running" && (
              <button onClick={queuePause} title="Pause" style={{
                width: 30, height: 30, borderRadius: 7, cursor: "pointer", display: "flex",
                alignItems: "center", justifyContent: "center",
                background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)",
                color: "#8991A4", transition: "all 120ms",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.09)"; e.currentTarget.style.color = "#C8CDD8"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; e.currentTarget.style.color = "#8991A4"; }}
              >
                <Pause size={12} />
              </button>
            )}

            {status === "paused" && (
              <button onClick={queueResume} title="Resume" style={{
                width: 30, height: 30, borderRadius: 7, cursor: "pointer", display: "flex",
                alignItems: "center", justifyContent: "center",
                background: "rgba(139,92,246,0.14)", border: "1px solid rgba(139,92,246,0.28)",
                color: "#A78BFA", transition: "all 120ms",
              }}>
                <Play size={12} />
              </button>
            )}

            <button onClick={queueCancel} title="Cancel queue" style={{
              height: 30, padding: "0 10px", borderRadius: 7, cursor: "pointer", display: "flex",
              alignItems: "center", gap: 5,
              background: "rgba(239,68,68,0.14)", border: "1px solid rgba(239,68,68,0.28)",
              color: "#F87171", fontSize: "0.75rem", fontWeight: 600, transition: "all 120ms",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(239,68,68,0.22)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(239,68,68,0.14)"; }}
            >
              <X size={12} /> Cancel
            </button>
          </div>
        )}
      </div>

      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", padding: "14px 24px", gap: 12, overflow: "hidden" }}>

        <div style={{ display: "flex", gap: 12, flexShrink: 0 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <QueueControls />
          </div>
          {status === "grace" && graceSeconds !== null && (
            <div style={{
              width: 190, flexShrink: 0, borderRadius: 14,
              background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)",
              display: "flex", alignItems: "center", justifyContent: "center", padding: 14,
            }}>
              <GraceWindowCountdown
                seconds={graceSeconds}
                totalSeconds={10}
                onAbort={queueCancel}
              />
            </div>
          )}
        </div>

        {totalCount === 0 ? (
          <div style={{
            flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
            borderRadius: 14, border: "1px dashed rgba(255,255,255,0.06)",
            background: "rgba(255,255,255,0.008)",
          }}>
            <div style={{ textAlign: "center", maxWidth: 320 }}>
              <div style={{
                width: 52, height: 52, borderRadius: 14, margin: "0 auto 14px",
                background: "rgba(139,92,246,0.10)", border: "1px solid rgba(139,92,246,0.18)",
                display: "flex", alignItems: "center", justifyContent: "center", color: "#A78BFA",
              }}>
                <Zap size={22} strokeWidth={1.5} />
              </div>
              <p style={{ fontSize: "0.875rem", fontWeight: 700, color: "#4A5580", marginBottom: 6 }}>
                Queue is empty
              </p>
              <p style={{ fontSize: "0.75rem", color: "#2D3650", lineHeight: 1.6 }}>
                Go to <strong style={{ color: "#4A5580" }}>Repositories</strong>, select repos, then use the bottom toolbar to Archive, Make Private/Public, or Delete. Operations appear here instantly after confirmation.
              </p>
            </div>
          </div>
        ) : (

          <div style={{
            display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10,
            flex: 1, minHeight: 0,
          }}>
            <Lane
              title="Pending"
              icon={<Clock size={13} strokeWidth={2} />}
              items={pending}
              color="#94A3B8"
              onSkip={() => queueSkipCurrent()}
            />
            <Lane
              title="Processing"
              icon={<Loader2 size={13} strokeWidth={2} style={status === "running" ? { animation: "spin 1s linear infinite" } : {}} />}
              items={processing ? [processing] : []}
              color="#A78BFA"
            />
            <Lane
              title="Completed"
              icon={<CheckCircle size={13} strokeWidth={2} />}
              items={completed}
              color="#10B981"
            />
            <Lane
              title="Failed / Skipped"
              icon={<XCircle size={13} strokeWidth={2} />}
              items={[...failed, ...skipped]}
              color="#EF4444"
              onRetry={handleRetry}
            />
          </div>
        )}
      </div>
    </div>
  );
};
