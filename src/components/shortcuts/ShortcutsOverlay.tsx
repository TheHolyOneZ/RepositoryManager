import React from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, Keyboard } from "lucide-react";

interface ShortcutEntry {
  keys: string[];
  description: string;
}

const SHORTCUTS: ShortcutEntry[] = [
  { keys: ["J"], description: "Move selection down" },
  { keys: ["K"], description: "Move selection up" },
  { keys: ["Space"], description: "Toggle row selection" },
  { keys: ["Enter"], description: "Open repo detail" },
  { keys: ["D"], description: "Queue delete for selected" },
  { keys: ["A"], description: "Queue archive for selected" },
  { keys: ["F"], description: "Focus filter sidebar" },
  { keys: ["R"], description: "Refresh repo list" },
  { keys: ["?"], description: "Show this shortcuts guide" },
  { keys: ["⌘", "K"], description: "Open command palette" },
  { keys: ["Esc"], description: "Deselect / close panels" },
];

interface ShortcutsOverlayProps {
  open: boolean;
  onClose: () => void;
}

export const ShortcutsOverlay: React.FC<ShortcutsOverlayProps> = ({ open, onClose }) => {
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
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ type: "spring", stiffness: 400, damping: 36, mass: 0.7 }}
            style={{
              position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
              zIndex: 61, width: 420,
              background: "rgba(8,10,22,0.98)", backdropFilter: "blur(28px) saturate(160%)",
              border: "1px solid rgba(255,255,255,0.10)",
              borderRadius: 16, overflow: "hidden",
              boxShadow: "0 24px 80px rgba(0,0,0,0.65), 0 0 0 1px rgba(139,92,246,0.12)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: "rgba(139,92,246,0.15)", border: "1px solid rgba(139,92,246,0.25)", display: "flex", alignItems: "center", justifyContent: "center", color: "#A78BFA" }}>
                <Keyboard size={13} />
              </div>
              <p style={{ fontSize: "0.9375rem", fontWeight: 700, color: "#D4D8E8", letterSpacing: "-0.02em", flex: 1 }}>
                Keyboard Shortcuts
              </p>
              <button
                onClick={onClose}
                style={{ width: 30, height: 30, borderRadius: 7, cursor: "pointer", background: "transparent", border: "1px solid rgba(255,255,255,0.07)", color: "#4A5580", display: "flex", alignItems: "center", justifyContent: "center" }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.color = "#8991A4"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#4A5580"; }}
              >
                <X size={13} />
              </button>
            </div>

            <div style={{ padding: "12px 16px 16px" }}>
              <p style={{ fontSize: "0.5625rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#2D3650", marginBottom: 10, paddingLeft: 4 }}>
                Repository List
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                {SHORTCUTS.map((s, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "6px 8px", borderRadius: 8 }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.03)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}
                  >
                    <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                      {s.keys.map((k, ki) => (
                        <kbd key={ki} style={{
                          display: "inline-flex", alignItems: "center", justifyContent: "center",
                          minWidth: 26, height: 22, padding: "0 6px", borderRadius: 5,
                          background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.13)",
                          borderBottom: "2px solid rgba(255,255,255,0.10)",
                          fontFamily: "'Cascadia Code','Consolas',monospace",
                          fontSize: "0.6875rem", fontWeight: 600, color: "#C8CDD8",
                          letterSpacing: "0.03em",
                        }}>
                          {k}
                        </kbd>
                      ))}
                    </div>
                    <span style={{ flex: 1, fontSize: "0.8125rem", color: "#8991A4" }}>{s.description}</span>
                  </div>
                ))}
              </div>
              <p style={{ marginTop: 14, fontSize: "0.6875rem", color: "#2D3650", textAlign: "center" }}>
                Shortcuts are disabled when typing in inputs
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
};
