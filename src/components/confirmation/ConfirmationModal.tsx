import React, { useState, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle, Trash2, Archive, Lock, Globe, ChevronRight,
  Zap, Play, ListChecks, CheckCircle2, XCircle, FlaskConical,
} from "lucide-react";
import { useUIStore } from "../../stores/uiStore";
import { useQueueStore } from "../../stores/queueStore";
import { useSelectionStore } from "../../stores/selectionStore";
import { queueAddItems, queueStart, queueDryRun } from "../../lib/tauri/commands";
import { formatInvokeError } from "../../lib/formatError";
import type { QueueItemInput, DryRunResult, ExecutionMode } from "../../types/queue";

const ACTION_LABELS: Record<string, string> = {
  delete: "Delete", archive: "Archive", set_private: "Make Private",
  set_public: "Make Public", rename: "Rename", transfer: "Transfer",
};
const ACTION_ICONS: Record<string, React.ReactNode> = {
  delete: <Trash2 size={14} />, archive: <Archive size={14} />,
  set_private: <Lock size={14} />, set_public: <Globe size={14} />,
};
const DANGER_ACTIONS = new Set(["delete", "transfer"]);

const EXECUTION_MODES: { value: ExecutionMode; label: string; desc: string }[] = [
  { value: "fast", label: "Fast", desc: "Max rate, 400ms between ops" },
  { value: "controlled", label: "Controlled", desc: "Slower, safer for large batches" },
];

export const ConfirmationModal: React.FC = () => {
  const { activeModal, modalData, closeModal } = useUIStore();
  const addToast = useUIStore((s) => s.addToast);
  const isDryRun = useUIStore((s) => s.isDryRunMode);
  const mode = useQueueStore((s) => s.mode);
  const setMode = useQueueStore((s) => s.setMode);
  const setItems = useQueueStore((s) => s.setItems);
  const deselectAll = useSelectionStore((s) => s.deselectAll);

  const [confirmText, setConfirmText] = useState("");
  const [graceSeconds, setGraceSeconds] = useState(10);
  const [autoStart, setAutoStart] = useState(true);
  const [loading, setLoading] = useState(false);
  const [dryRunResults, setDryRunResults] = useState<DryRunResult[] | null>(null);

  const isOpen = activeModal === "confirm-queue";
  const data = modalData as { items: QueueItemInput[]; action: string } | null;

  const items: QueueItemInput[] = data?.items ?? [];
  const action: string = data?.action ?? "";
  const isDanger = DANGER_ACTIONS.has(action);
  const required = isDanger ? `delete ${items.length} repos` : undefined;
  const canConfirm = !required || confirmText === required;

  const handleClose = useCallback(() => {
    closeModal();
    setConfirmText("");
    setGraceSeconds(10);
    setDryRunResults(null);
    setAutoStart(true);
  }, [closeModal]);

  const handleDryRun = useCallback(async () => {
    if (!data) return;
    setLoading(true);
    try {
      const results = await queueDryRun(items);
      setDryRunResults(results);
    } catch (e: unknown) {
      addToast({ type: "error", title: "Dry run failed", message: formatInvokeError(e) });
    } finally {
      setLoading(false);
    }
  }, [data, items, addToast]);

  const handleConfirm = useCallback(async () => {
    if (!canConfirm || !data) return;
    setLoading(true);
    try {
      if (isDryRun) {
        await handleDryRun();
        return;
      }
      const addedItems = await queueAddItems(items);
      setItems(addedItems);
      deselectAll();
      if (autoStart) {
        await queueStart(mode, graceSeconds);
        handleClose();
        addToast({
          type: "success",
          title: graceSeconds > 0 ? `Grace period: ${graceSeconds}s` : "Queue started",
          message: `${items.length} operation${items.length !== 1 ? "s" : ""} queued${graceSeconds > 0 ? ` — cancel in Queue tab within ${graceSeconds}s` : ""}`,
        });
      } else {
        handleClose();
        addToast({
          type: "info",
          title: "Queued — start manually",
          message: `${items.length} operation${items.length !== 1 ? "s" : ""} added. Go to the Queue tab and press Start.`,
        });
      }
    } catch (e: unknown) {
      addToast({ type: "error", title: "Couldn't queue operations", message: formatInvokeError(e) });
    } finally {
      setLoading(false);
    }
  }, [canConfirm, data, items, mode, graceSeconds, autoStart, isDryRun, handleClose, addToast, setItems, handleDryRun]);

  if (!isOpen || !data) return null;

  const actionLabel = ACTION_LABELS[action] ?? action;
  const actionIcon = ACTION_ICONS[action];
  const accentColor = isDanger ? "#EF4444" : isDryRun ? "#F59E0B" : action === "archive" ? "#F59E0B" : "#8B5CF6";

  const modal = (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 200,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div
        style={{
          width: "100%", maxWidth: 560, borderRadius: 20, overflow: "hidden",
          background: "rgba(8,10,20,0.98)",
          border: "1px solid rgba(255,255,255,0.10)",
          boxShadow: "0 24px 80px rgba(0,0,0,0.70), 0 0 0 1px rgba(255,255,255,0.05) inset",
          margin: "0 16px",
          maxHeight: "90vh", overflowY: "auto",
        }}
      >
        {isDryRun && (
          <div style={{
            display: "flex", alignItems: "center", gap: 8, padding: "9px 20px",
            background: "rgba(245,158,11,0.08)", borderBottom: "1px solid rgba(245,158,11,0.20)",
            fontSize: "0.75rem", color: "#FBBF24",
          }}>
            <FlaskConical size={12} />
            <span><strong>Dry run mode active</strong> — operations will preview only, nothing will execute on GitHub.</span>
          </div>
        )}

        <div style={{
          padding: "18px 22px", borderBottom: "1px solid rgba(255,255,255,0.07)",
          background: `linear-gradient(135deg, ${accentColor}12 0%, transparent 100%)`,
          display: "flex", alignItems: "center", gap: 12,
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10, flexShrink: 0,
            background: `${accentColor}18`, border: `1px solid ${accentColor}30`,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: accentColor,
          }}>
            {isDanger ? <AlertTriangle size={16} strokeWidth={2} /> : actionIcon}
          </div>
          <div>
            <p style={{ fontSize: "0.9375rem", fontWeight: 700, color: "#D4D8E8", letterSpacing: "-0.02em" }}>
              {isDryRun ? `Preview: ${actionLabel}` : isDanger ? "Destructive operation" : `Confirm: ${actionLabel}`}
            </p>
            <p style={{ fontSize: "0.75rem", color: "#556080", marginTop: 2 }}>
              {actionLabel} {items.length} {items.length === 1 ? "repository" : "repositories"}
              {isDanger && !isDryRun && " — this cannot be undone."}
            </p>
          </div>
        </div>

        <div style={{ padding: "20px 22px", display: "flex", flexDirection: "column", gap: 18 }}>

          {dryRunResults && (
            <div style={{
              borderRadius: 12, overflow: "hidden",
              border: "1px solid rgba(245,158,11,0.20)",
              background: "rgba(245,158,11,0.04)",
            }}>
              <div style={{
                padding: "10px 14px", borderBottom: "1px solid rgba(245,158,11,0.15)",
                fontSize: "0.625rem", fontWeight: 700, letterSpacing: "0.12em",
                textTransform: "uppercase", color: "#D97706",
                display: "flex", alignItems: "center", gap: 6,
              }}>
                <FlaskConical size={10} /> Preview results
              </div>
              {dryRunResults.map((r, i) => (
                <div key={r.repo_id} style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "8px 14px",
                  borderBottom: i < dryRunResults.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                }}>
                  {r.would_succeed
                    ? <CheckCircle2 size={12} style={{ color: "#10B981", flexShrink: 0 }} />
                    : <XCircle size={12} style={{ color: "#EF4444", flexShrink: 0 }} />}
                  <span style={{
                    fontSize: "0.75rem", fontWeight: 500,
                    fontFamily: "'Cascadia Code','Consolas',monospace",
                    color: "#C8CDD8", flex: 1, minWidth: 0,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {r.repo_name}
                  </span>
                  <span style={{ fontSize: "0.6875rem", color: "#6B7A9B", flexShrink: 0 }}>
                    {r.preview_message.replace(`repository '${r.repo_name}'`, "").trim()}
                  </span>
                </div>
              ))}
            </div>
          )}

          {!dryRunResults && (
            <div>
              <p style={{ fontSize: "0.625rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#3A4560", marginBottom: 8 }}>
                Affected Repositories ({items.length})
              </p>
              <div style={{
                maxHeight: 140, overflowY: "auto",
                borderRadius: 10, background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.07)",
              }}>
                {items.map((item, i) => (
                  <div key={item.repo_id} style={{
                    display: "flex", alignItems: "center", gap: 8, padding: "6px 12px",
                    borderBottom: i < items.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                  }}>
                    <ChevronRight size={10} style={{ color: accentColor, flexShrink: 0 }} />
                    <span style={{
                      fontFamily: "'Cascadia Code','Consolas',monospace",
                      fontSize: "0.8125rem", color: "#C8CDD8",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {item.repo_full_name}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!isDryRun && (
            <div>
              <p style={{ fontSize: "0.625rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#3A4560", marginBottom: 8 }}>
                Execution Mode
              </p>
              <div style={{ display: "flex", gap: 6 }}>
                {EXECUTION_MODES.map((m) => {
                  const active = mode === m.value;
                  return (
                    <button
                      key={m.value}
                      onClick={() => setMode(m.value)}
                      style={{
                        flex: 1, padding: "9px 12px", borderRadius: 9, cursor: "pointer",
                        background: active ? "rgba(139,92,246,0.14)" : "rgba(255,255,255,0.03)",
                        border: active ? "1px solid rgba(139,92,246,0.35)" : "1px solid rgba(255,255,255,0.07)",
                        textAlign: "left", transition: "all 130ms",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 2 }}>
                        {m.value === "fast" ? <Zap size={11} style={{ color: active ? "#A78BFA" : "#4A5580" }} /> : <ListChecks size={11} style={{ color: active ? "#A78BFA" : "#4A5580" }} />}
                        <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: active ? "#C4B5FD" : "#7A8AAE" }}>
                          {m.label}
                        </span>
                      </div>
                      <p style={{ fontSize: "0.6875rem", color: "#4A5580", margin: 0 }}>{m.desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {!isDryRun && (
            <div>
              <p style={{ fontSize: "0.625rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#3A4560", marginBottom: 8 }}>
                Start Behavior
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <button
                  onClick={() => setAutoStart(true)}
                  style={{
                    display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 12px",
                    borderRadius: 9, cursor: "pointer", textAlign: "left", transition: "all 130ms",
                    background: autoStart ? "rgba(139,92,246,0.10)" : "rgba(255,255,255,0.025)",
                    border: autoStart ? "1px solid rgba(139,92,246,0.30)" : "1px solid rgba(255,255,255,0.07)",
                  }}
                >
                  <div style={{
                    width: 16, height: 16, borderRadius: "50%", flexShrink: 0, marginTop: 1,
                    border: autoStart ? "5px solid #8B5CF6" : "2px solid rgba(255,255,255,0.20)",
                    background: autoStart ? "#8B5CF6" : "transparent",
                    transition: "all 150ms",
                  }} />
                  <div>
                    <p style={{ fontSize: "0.8125rem", fontWeight: 600, color: autoStart ? "#C4B5FD" : "#7A8AAE", marginBottom: 2 }}>
                      Auto-start after grace period
                    </p>
                    <p style={{ fontSize: "0.6875rem", color: "#4A5580", margin: 0 }}>
                      Operations begin automatically after the grace window. Cancel from Queue tab if needed.
                    </p>
                  </div>
                </button>
                <button
                  onClick={() => setAutoStart(false)}
                  style={{
                    display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 12px",
                    borderRadius: 9, cursor: "pointer", textAlign: "left", transition: "all 130ms",
                    background: !autoStart ? "rgba(139,92,246,0.10)" : "rgba(255,255,255,0.025)",
                    border: !autoStart ? "1px solid rgba(139,92,246,0.30)" : "1px solid rgba(255,255,255,0.07)",
                  }}
                >
                  <div style={{
                    width: 16, height: 16, borderRadius: "50%", flexShrink: 0, marginTop: 1,
                    border: !autoStart ? "5px solid #8B5CF6" : "2px solid rgba(255,255,255,0.20)",
                    background: !autoStart ? "#8B5CF6" : "transparent",
                    transition: "all 150ms",
                  }} />
                  <div>
                    <p style={{ fontSize: "0.8125rem", fontWeight: 600, color: !autoStart ? "#C4B5FD" : "#7A8AAE", marginBottom: 2 }}>
                      Queue only — I'll start manually
                    </p>
                    <p style={{ fontSize: "0.6875rem", color: "#4A5580", margin: 0 }}>
                      Items are added to the Queue tab. Go there to review and press Start when ready.
                    </p>
                  </div>
                </button>
              </div>
            </div>
          )}


          {!isDryRun && autoStart && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: "0.75rem", color: "#556080" }}>Grace window</span>
                <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#D4D8E8", fontVariantNumeric: "tabular-nums" }}>
                  {graceSeconds === 0 ? "None (immediate)" : `${graceSeconds}s`}
                </span>
              </div>
              <input
                type="range" min={0} max={60} step={5}
                value={graceSeconds}
                onChange={(e) => setGraceSeconds(Number(e.target.value))}
                style={{
                  width: "100%", height: 4, borderRadius: 2, cursor: "pointer",
                  accentColor: "#8B5CF6",
                  background: `linear-gradient(to right, #8B5CF6 ${(graceSeconds / 60) * 100}%, rgba(255,255,255,0.10) 0%)`,
                  appearance: "none",
                }}
              />
              <p style={{ fontSize: "0.6875rem", color: "#3A4560", marginTop: 6 }}>
                {graceSeconds === 0
                  ? "Operations start immediately."
                  : `A ${graceSeconds}s countdown starts. Abort from the Queue tab anytime.`}
              </p>
            </div>
          )}


          {isDanger && !isDryRun && (
            <div>
              <p style={{ fontSize: "0.625rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#3A4560", marginBottom: 8 }}>
                Type to confirm
              </p>
              <TypeConfirmInput
                placeholder={`Type: ${required}`}
                value={confirmText}
                onChange={(v) => setConfirmText(v)}
                required={required ?? ""}
              />
            </div>
          )}


          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", paddingTop: 4 }}>
            <button
              onClick={handleClose}
              style={{
                height: 38, padding: "0 16px", borderRadius: 8, cursor: "pointer",
                background: "transparent", border: "1px solid rgba(255,255,255,0.09)",
                color: "#7A8AAE", fontSize: "0.8125rem", fontWeight: 500,
                transition: "all 140ms",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
            >
              Cancel
            </button>

            {isDryRun && !dryRunResults && (
              <button
                onClick={handleDryRun}
                disabled={loading}
                style={{
                  height: 38, padding: "0 20px", borderRadius: 8,
                  cursor: loading ? "not-allowed" : "pointer",
                  background: "linear-gradient(135deg, #F59E0B 0%, #D97706 100%)",
                  border: "none", color: "#000", fontSize: "0.8125rem", fontWeight: 700,
                  opacity: loading ? 0.6 : 1, display: "flex", alignItems: "center", gap: 6,
                  boxShadow: "0 4px 16px rgba(245,158,11,0.30)",
                }}
              >
                {loading ? <Spinner /> : <FlaskConical size={14} />}
                Preview operations
              </button>
            )}

            {isDryRun && dryRunResults && (
              <button
                onClick={handleClose}
                style={{
                  height: 38, padding: "0 20px", borderRadius: 8, cursor: "pointer",
                  background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)",
                  color: "#D4D8E8", fontSize: "0.8125rem", fontWeight: 600,
                }}
              >
                Close preview
              </button>
            )}

            {!isDryRun && (
              <button
                onClick={handleConfirm}
                disabled={!canConfirm || loading}
                style={{
                  height: 38, padding: "0 20px", borderRadius: 8,
                  cursor: (!canConfirm || loading) ? "not-allowed" : "pointer",
                  background: isDanger
                    ? "linear-gradient(135deg, #EF4444 0%, #DC2626 100%)"
                    : "linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)",
                  border: "none", color: "#fff",
                  fontSize: "0.8125rem", fontWeight: 600,
                  opacity: (!canConfirm || loading) ? 0.5 : 1,
                  display: "flex", alignItems: "center", gap: 6,
                  boxShadow: isDanger ? "0 4px 16px rgba(239,68,68,0.30)" : "0 4px 16px rgba(139,92,246,0.30)",
                  transition: "opacity 150ms",
                }}
              >
                {loading ? <Spinner /> : isDanger ? <Trash2 size={14} /> : <Play size={14} fill="white" />}
                {isDanger
                  ? `Delete ${items.length} repo${items.length !== 1 ? "s" : ""}`
                  : autoStart
                    ? `Confirm & ${graceSeconds > 0 ? "start countdown" : "start"}`
                    : "Add to queue"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
};

const Spinner: React.FC = () => (
  <span style={{
    width: 14, height: 14, borderRadius: "50%",
    border: "2px solid rgba(255,255,255,0.40)", borderTopColor: "#fff",
    animation: "spin 0.8s linear infinite", display: "inline-block",
  }} />
);

const TypeConfirmInput: React.FC<{
  placeholder: string; value: string; onChange: (v: string) => void; required: string;
}> = ({ placeholder, value, onChange, required }) => {
  const [focused, setFocused] = React.useState(false);
  const matches = value === required;
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      placeholder={placeholder}
      style={{
        width: "100%", height: 40, borderRadius: 8,
        background: "rgba(255,255,255,0.055)",
        border: matches ? "1px solid rgba(16,185,129,0.45)" : focused ? "1px solid rgba(239,68,68,0.45)" : "1px solid transparent",
        boxShadow: matches ? "0 0 0 3px rgba(16,185,129,0.10)" : focused ? "0 0 0 3px rgba(239,68,68,0.08)" : "none",
        color: matches ? "#34D399" : "#ECEEF5",
        fontSize: "0.875rem", padding: "0 12px",
        fontFamily: "'Cascadia Code','Consolas',monospace",
        outline: "none", transition: "all 160ms ease",
        boxSizing: "border-box",
      }}
    />
  );
};
