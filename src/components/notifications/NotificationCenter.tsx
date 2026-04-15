import React, { useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCheck, Trash2, Bell, CheckCircle, AlertCircle, Zap, Info, X } from "lucide-react";
import { useNotificationStore, type AppNotification } from "../../stores/notificationStore";
import { formatDate } from "../../lib/utils/formatters";

const TYPE_CONFIG: Record<AppNotification["type"], { icon: React.ReactNode; color: string }> = {
  queue_done:           { icon: <CheckCircle size={13} />, color: "#10B981" },
  queue_failed:         { icon: <AlertCircle size={13} />, color: "#EF4444" },
  automation_triggered: { icon: <Zap size={13} />,         color: "#8B5CF6" },
  new_dead_repos:       { icon: <AlertCircle size={13} />, color: "#F59E0B" },
  info:                 { icon: <Info size={13} />,         color: "#3B82F6" },
};

interface NotificationCenterProps {
  open: boolean;
  onClose: () => void;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({ open, onClose }) => {
  const notifications = useNotificationStore((s) => s.notifications);
  const markAllRead = useNotificationStore((s) => s.markAllRead);
  const clearAll = useNotificationStore((s) => s.clearAll);
  const markRead = useNotificationStore((s) => s.markRead);
  const [btnHover, setBtnHover] = useState<string | null>(null);

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            style={{
              position: "fixed", inset: 0, zIndex: 40,
              background: "rgba(0,0,0,0.50)",
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
              width: 400, display: "flex", flexDirection: "column",
              background: "rgba(8,10,20,0.98)",
              backdropFilter: "blur(28px) saturate(160%)",
              WebkitBackdropFilter: "blur(28px) saturate(160%)",
              borderLeft: "1px solid rgba(255,255,255,0.09)",
              boxShadow: "-24px 0 60px rgba(0,0,0,0.55)",
            }}
          >
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,0.07)",
              flexShrink: 0,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                <div style={{
                  width: 30, height: 30, borderRadius: 8,
                  background: "rgba(139,92,246,0.15)", border: "1px solid rgba(139,92,246,0.25)",
                  display: "flex", alignItems: "center", justifyContent: "center", color: "#A78BFA",
                }}>
                  <Bell size={13} />
                </div>
                <div>
                  <p style={{ fontSize: "0.9375rem", fontWeight: 700, color: "#D4D8E8", letterSpacing: "-0.02em" }}>
                    Notifications
                  </p>
                  {notifications.filter((n) => !n.read).length > 0 && (
                    <p style={{ fontSize: "0.625rem", color: "#8B5CF6", marginTop: 1 }}>
                      {notifications.filter((n) => !n.read).length} unread
                    </p>
                  )}
                </div>
              </div>
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

            {notifications.length > 0 && (
              <div style={{
                display: "flex", gap: 8, padding: "12px 20px",
                borderBottom: "1px solid rgba(255,255,255,0.05)", flexShrink: 0,
              }}>
                <button
                  onClick={markAllRead}
                  onMouseEnter={() => setBtnHover("markAll")}
                  onMouseLeave={() => setBtnHover(null)}
                  style={{
                    height: 30, padding: "0 12px", borderRadius: 7, cursor: "pointer",
                    display: "flex", alignItems: "center", gap: 5,
                    background: btnHover === "markAll" ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    color: "#8991A4", fontSize: "0.75rem", fontWeight: 500,
                    transition: "all 120ms",
                  }}
                >
                  <CheckCheck size={11} /> Mark all read
                </button>
                <button
                  onClick={clearAll}
                  onMouseEnter={() => setBtnHover("clearAll")}
                  onMouseLeave={() => setBtnHover(null)}
                  style={{
                    height: 30, padding: "0 12px", borderRadius: 7, cursor: "pointer",
                    display: "flex", alignItems: "center", gap: 5,
                    background: btnHover === "clearAll" ? "rgba(239,68,68,0.12)" : "transparent",
                    border: "1px solid rgba(255,255,255,0.07)",
                    color: btnHover === "clearAll" ? "#F87171" : "#6B7A9B",
                    fontSize: "0.75rem", fontWeight: 500,
                    transition: "all 120ms",
                  }}
                >
                  <Trash2 size={11} /> Clear all
                </button>
              </div>
            )}

            <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px" }}>
              {notifications.length === 0 ? (
                <div style={{
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 12,
                  padding: "64px 24px", textAlign: "center",
                }}>
                  <div style={{
                    width: 52, height: 52, borderRadius: 14,
                    background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "#2D3650",
                  }}>
                    <Bell size={20} strokeWidth={1.5} />
                  </div>
                  <div>
                    <p style={{ fontSize: "0.875rem", fontWeight: 600, color: "#4A5580", marginBottom: 4 }}>
                      No notifications yet
                    </p>
                    <p style={{ fontSize: "0.75rem", color: "#2D3650" }}>
                      Queue completions and alerts will appear here.
                    </p>
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {notifications.map((n) => {
                    const cfg = TYPE_CONFIG[n.type];
                    return (
                      <button
                        key={n.id}
                        onClick={() => markRead(n.id)}
                        style={{
                          width: "100%", textAlign: "left",
                          display: "flex", alignItems: "flex-start", gap: 12,
                          padding: "12px 14px", borderRadius: 10, cursor: "pointer",
                          background: !n.read
                            ? "rgba(139,92,246,0.08)"
                            : "rgba(255,255,255,0.025)",
                          border: !n.read
                            ? "1px solid rgba(139,92,246,0.20)"
                            : "1px solid rgba(255,255,255,0.06)",
                          transition: "all 130ms",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = !n.read
                            ? "rgba(139,92,246,0.12)"
                            : "rgba(255,255,255,0.04)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = !n.read
                            ? "rgba(139,92,246,0.08)"
                            : "rgba(255,255,255,0.025)";
                        }}
                      >
                        <span style={{
                          flexShrink: 0, width: 30, height: 30, borderRadius: 8,
                          background: `${cfg.color}14`, border: `1px solid ${cfg.color}25`,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          color: cfg.color, marginTop: 1,
                        }}>
                          {cfg.icon}
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{
                            fontSize: "0.8125rem", fontWeight: 600, lineHeight: 1.3,
                            color: n.read ? "#6B7A9B" : "#D4D8E8", marginBottom: 3,
                          }}>
                            {n.title}
                          </p>
                          <p style={{ fontSize: "0.6875rem", color: "#3A4560", lineHeight: 1.5, marginBottom: 4 }}>
                            {n.message}
                          </p>
                          <p style={{ fontSize: "0.5625rem", color: "#2D3650" }}>
                            {formatDate(n.created_at)}
                          </p>
                        </div>
                        {!n.read && (
                          <span style={{
                            flexShrink: 0, marginTop: 6,
                            width: 7, height: 7, borderRadius: "50%",
                            background: "#8B5CF6",
                          }} />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
};
