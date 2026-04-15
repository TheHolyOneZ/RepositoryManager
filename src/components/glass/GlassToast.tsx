import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from "lucide-react";
import { useUIStore, type Toast } from "../../stores/uiStore";

const VARIANTS: Record<Toast["type"], {
  icon: React.ReactNode;
  accent: string;
  glow: string;
  iconBg: string;
  iconColor: string;
}> = {
  success: {
    icon: <CheckCircle2 size={15} strokeWidth={2.5} />,
    accent: "#10B981",
    glow: "rgba(16,185,129,0.18)",
    iconBg: "rgba(16,185,129,0.14)",
    iconColor: "#34D399",
  },
  error: {
    icon: <XCircle size={15} strokeWidth={2.5} />,
    accent: "#EF4444",
    glow: "rgba(239,68,68,0.18)",
    iconBg: "rgba(239,68,68,0.12)",
    iconColor: "#F87171",
  },
  warning: {
    icon: <AlertTriangle size={15} strokeWidth={2.5} />,
    accent: "#F59E0B",
    glow: "rgba(245,158,11,0.18)",
    iconBg: "rgba(245,158,11,0.12)",
    iconColor: "#FBBF24",
  },
  info: {
    icon: <Info size={15} strokeWidth={2.5} />,
    accent: "#8B5CF6",
    glow: "rgba(139,92,246,0.18)",
    iconBg: "rgba(139,92,246,0.12)",
    iconColor: "#A78BFA",
  },
};

const ToastItem: React.FC<{ toast: Toast; onRemove: () => void }> = ({ toast, onRemove }) => {
  const v = VARIANTS[toast.type];
  const duration = toast.duration ?? 4000;
  const progressRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (duration <= 0 || !progressRef.current) return;
    const el = progressRef.current;
    el.style.transition = "none";
    el.style.width = "100%";

    void el.offsetWidth;
    el.style.transition = `width ${duration}ms linear`;
    el.style.width = "0%";
  }, [duration]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12, scale: 0.96, x: 8 }}
      animate={{ opacity: 1, y: 0, scale: 1, x: 0 }}
      exit={{ opacity: 0, x: 16, scale: 0.95 }}
      transition={{ type: "spring", stiffness: 480, damping: 36 }}
      role="alert"
      style={{
        position: "relative",
        width: 320,
        background: "rgba(10,12,22,0.96)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        border: `1px solid ${v.accent}28`,
        borderRadius: 14,
        overflow: "hidden",
        boxShadow: `0 8px 32px rgba(0,0,0,0.55), 0 0 0 1px ${v.accent}14, 0 0 24px ${v.glow}`,
      }}
    >
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 2,
        background: `linear-gradient(90deg, ${v.accent}00 0%, ${v.accent} 40%, ${v.accent} 60%, ${v.accent}00 100%)`,
      }} />

      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "12px 12px 14px 14px" }}>
        <div style={{
          width: 30, height: 30, borderRadius: 8, flexShrink: 0,
          background: v.iconBg, border: `1px solid ${v.accent}28`,
          display: "flex", alignItems: "center", justifyContent: "center",
          color: v.iconColor, marginTop: 1,
        }}>
          {v.icon}
        </div>

        <div style={{ flex: 1, minWidth: 0, paddingTop: 1 }}>
          <p style={{
            fontSize: "0.8125rem", fontWeight: 700, color: "#E8EAF0",
            lineHeight: 1.3, letterSpacing: "-0.01em",
          }}>
            {toast.title}
          </p>
          {toast.message && (
            <p style={{
              fontSize: "0.75rem", color: "#6B7A9B", lineHeight: 1.5,
              marginTop: 3,
            }}>
              {toast.message}
            </p>
          )}
        </div>

        <button
          onClick={onRemove}
          style={{
            width: 22, height: 22, borderRadius: 6, flexShrink: 0,
            background: "transparent", border: "none", cursor: "pointer",
            color: "#3A4560", display: "flex", alignItems: "center", justifyContent: "center",
            transition: "all 120ms", marginTop: 1,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.07)"; e.currentTarget.style.color = "#8991A4"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#3A4560"; }}
        >
          <X size={11} />
        </button>
      </div>

      {duration > 0 && (
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 2, background: "rgba(255,255,255,0.04)" }}>
          <div ref={progressRef} style={{ height: "100%", background: v.accent, opacity: 0.5 }} />
        </div>
      )}
    </motion.div>
  );
};

export const ToastContainer: React.FC = () => {
  const toasts = useUIStore((s) => s.toasts);
  const removeToast = useUIStore((s) => s.removeToast);
  return createPortal(
    <div style={{
      position: "fixed", bottom: 20, right: 20, zIndex: 200,
      display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8,
      pointerEvents: "none",
    }}>
      <AnimatePresence mode="popLayout">
        {toasts.map((t) => (
          <div key={t.id} style={{ pointerEvents: "auto" }}>
            <ToastItem toast={t} onRemove={() => removeToast(t.id)} />
          </div>
        ))}
      </AnimatePresence>
    </div>,
    document.body
  );
};
