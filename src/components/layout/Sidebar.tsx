import React from "react";
import { NavLink } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  GitFork, LayoutDashboard, Zap, Lightbulb, GitBranch, Webhook,
  Users, Network, Calendar, ArrowRightLeft, ScanSearch, Settings,
  ChevronLeft, ChevronRight, Bell, Info, FolderUp, FilePen,
  GitPullRequest, CircleDot, Tag,
} from "lucide-react";
import { ContextSwitcher } from "./ContextSwitcher";
import { AppLogoMark } from "../icons/AppLogoMark";
import { useAccountStore, selectActiveAccount } from "../../stores/accountStore";
import { useQueueStore, selectPending } from "../../stores/queueStore";
import { useNotificationStore, selectUnreadCount } from "../../stores/notificationStore";
import { useUIStore } from "../../stores/uiStore";

const NAV_SECTIONS = [
  {
    label: "Core",
    items: [
      { path: "/repos",       label: "Repositories", icon: GitFork },
      { path: "/queue",       label: "Queue",         icon: Zap },
      { path: "/analytics",   label: "Analytics",     icon: LayoutDashboard },
      { path: "/suggestions", label: "Suggestions",   icon: Lightbulb },
    ],
  },
  {
    label: "Governance",
    items: [
      { path: "/actions",       label: "Actions",        icon: GitBranch },
      { path: "/prs",           label: "Pull Requests",  icon: GitPullRequest },
      { path: "/issues",        label: "Issues",         icon: CircleDot },
      { path: "/releases",      label: "Releases",       icon: Tag },
      { path: "/webhooks",      label: "Webhooks",       icon: Webhook },
      { path: "/collaborators", label: "Collaborators",  icon: Users },
      { path: "/branches",      label: "Branches",       icon: Network },
    ],
  },
  {
    label: "Tools",
    items: [
      { path: "/scheduler", label: "Scheduler", icon: Calendar },
      { path: "/migration", label: "Migration",  icon: ArrowRightLeft },
      { path: "/scanner",   label: "Scanner",    icon: ScanSearch },
      { path: "/upload",    label: "Upload",       icon: FolderUp },
      { path: "/files",     label: "File Manager", icon: FilePen },
    ],
  },
];

const QueuePip: React.FC = () => {
  const status = useQueueStore((s) => s.status);
  const count = useQueueStore((s) => selectPending(s).length);
  if (status === "idle" || status === "done") return null;
  const color = status === "running" ? "#8B5CF6" : status === "paused" ? "#F59E0B" : "#EF4444";
  return (
    <div className="mx-2 mb-2 flex items-center gap-2 rounded-lg px-3 py-2"
      style={{ background: `${color}12`, border: `1px solid ${color}25` }}>
      <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full animate-pulse" style={{ background: color }} />
      <span className="text-[11px] font-semibold" style={{ color }}>
        {status === "running" ? `Running · ${count} left` : status === "paused" ? "Paused" : "Grace period"}
      </span>
    </div>
  );
};

export const Sidebar: React.FC = () => {
  const collapsed = useUIStore((s) => s.isSidebarCollapsed);
  const setSidebarCollapsed = useUIStore((s) => s.setSidebarCollapsed);
  const activeAccount = useAccountStore(selectActiveAccount);
  const unreadCount = useNotificationStore(selectUnreadCount);
  const openNotifications = useUIStore((s) => s.openSlideOver);

  return (
    <motion.aside
      className="relative z-10 flex h-full flex-col"
      animate={{ width: collapsed ? 52 : 220 }}
      transition={{ type: "spring", stiffness: 320, damping: 34 }}
      style={{
        background: "linear-gradient(180deg, #070915 0%, #060810 100%)",
        borderRight: "1px solid rgba(255,255,255,0.07)",
        boxShadow: "1px 0 20px rgba(0,0,0,0.30)",
        overflow: "visible",
      }}
    >
      <div
        style={{
          height: 48, flexShrink: 0, display: "flex", alignItems: "center",
          justifyContent: collapsed ? "center" : "flex-start",
          gap: 10, padding: collapsed ? "0" : "0 14px",
          borderBottom: "1px solid rgba(255,255,255,0.055)",
          overflow: "hidden",
        }}
      >
        <AppLogoMark size={30} />
        <AnimatePresence>
          {!collapsed && (
            <motion.span
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.16 }}
              style={{ fontSize: "0.875rem", fontWeight: 700, color: "#D4D8E8", whiteSpace: "nowrap", letterSpacing: "-0.02em" }}
            >
              ZRepoManager
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      <nav className="flex flex-1 flex-col overflow-y-auto px-2 py-3" style={{ gap: 2, overflow: "hidden auto" }}>
        {NAV_SECTIONS.map((section) => (
          <div key={section.label} style={{ marginBottom: 4 }}>
            <AnimatePresence>
              {!collapsed && (
                <motion.p
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  style={{
                    padding: "4px 8px 4px 8px", marginBottom: 2,
                    fontSize: "0.5625rem", fontWeight: 700, letterSpacing: "0.12em",
                    textTransform: "uppercase", color: "#3A4560",
                  }}
                >
                  {section.label}
                </motion.p>
              )}
            </AnimatePresence>
            {section.items.map(({ path, label, icon: Icon }) => (
              <NavLink key={path} to={path} title={collapsed ? label : undefined}
                style={{ textDecoration: "none", display: "block" }}
              >
                {({ isActive }) => (
                  <div
                    style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: collapsed ? "8px 0" : "7px 10px",
                      justifyContent: collapsed ? "center" : "flex-start",
                      borderRadius: 8, marginBottom: 1,
                      background: isActive ? "rgba(139,92,246,0.15)" : "transparent",
                      color: isActive ? "#C4B5FD" : "#7A8AAE",
                      fontSize: "0.8125rem", fontWeight: 500,
                      letterSpacing: "-0.01em", whiteSpace: "nowrap",
                      cursor: "pointer", position: "relative",
                      transition: "background 140ms ease, color 140ms ease",
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) {
                        (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.055)";
                        (e.currentTarget as HTMLDivElement).style.color = "#C8CDD8";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) {
                        (e.currentTarget as HTMLDivElement).style.background = "transparent";
                        (e.currentTarget as HTMLDivElement).style.color = "#7A8AAE";
                      }
                    }}
                  >
                    {isActive && (
                      <span style={{
                        position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)",
                        width: 2.5, height: "60%", borderRadius: "0 2px 2px 0",
                        background: "linear-gradient(180deg, #A78BFA, #7C3AED)",
                      }} />
                    )}
                    <Icon size={collapsed ? 17 : 15} style={{ flexShrink: 0 }} />
                    <AnimatePresence>
                      {!collapsed && (
                        <motion.span
                          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                          transition={{ duration: 0.14 }}
                        >
                          {label}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <QueuePip />

      <div style={{
        flexShrink: 0, borderTop: "1px solid rgba(255,255,255,0.055)",
        padding: "8px 8px 10px",
        display: "flex", flexDirection: "column", gap: 1, overflow: "hidden",
      }}>
        <button
          type="button"
          onClick={() => openNotifications("notifications")}
          title={collapsed ? "Notifications" : undefined}
          style={{
            width: "100%", display: "flex", alignItems: "center", gap: 10,
            padding: collapsed ? "7px 0" : "7px 10px",
            justifyContent: collapsed ? "center" : "flex-start",
            borderRadius: 7, cursor: "pointer",
            background: "transparent", border: "none",
            color: "#4A5580", fontSize: "0.8125rem", fontWeight: 500,
            letterSpacing: "-0.01em", position: "relative", transition: "all 130ms ease",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.05)";
            (e.currentTarget as HTMLButtonElement).style.color = "#C8CDD8";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "transparent";
            (e.currentTarget as HTMLButtonElement).style.color = "#4A5580";
          }}
        >
          <div style={{ position: "relative", flexShrink: 0 }}>
            <Bell size={collapsed ? 16 : 14} />
            {unreadCount > 0 && (
              <span style={{
                position: "absolute", top: -4, right: -4,
                minWidth: 14, height: 14, borderRadius: 7,
                background: "linear-gradient(135deg, #8B5CF6, #7C3AED)",
                color: "#fff", fontSize: 8, fontWeight: 800,
                display: "flex", alignItems: "center", justifyContent: "center",
                padding: "0 3px",
                boxShadow: "0 0 0 2px #070915",
              }}>
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.13 }}
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flex: 1, minWidth: 0 }}
              >
                <span>Notifications</span>
                {unreadCount > 0 && (
                  <span style={{
                    fontSize: "0.625rem", fontWeight: 700, color: "#8B5CF6",
                    background: "rgba(139,92,246,0.12)", border: "1px solid rgba(139,92,246,0.22)",
                    borderRadius: 5, padding: "1px 5px",
                  }}>
                    {unreadCount}
                  </span>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </button>

        <NavLink to="/settings" style={{ textDecoration: "none" }} title={collapsed ? "Settings" : undefined}>
          {({ isActive }) => (
            <div
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: collapsed ? "7px 0" : "7px 10px",
                justifyContent: collapsed ? "center" : "flex-start",
                borderRadius: 7, cursor: "pointer", position: "relative",
                background: isActive ? "rgba(139,92,246,0.12)" : "transparent",
                color: isActive ? "#A78BFA" : "#4A5580",
                fontSize: "0.8125rem", fontWeight: 500, transition: "all 130ms ease",
              }}
              onMouseEnter={(e) => { if (!isActive) { (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.05)"; (e.currentTarget as HTMLDivElement).style.color = "#C8CDD8"; } }}
              onMouseLeave={(e) => { if (!isActive) { (e.currentTarget as HTMLDivElement).style.background = "transparent"; (e.currentTarget as HTMLDivElement).style.color = "#4A5580"; } }}
            >
              {isActive && <span style={{ position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)", width: 2.5, height: "55%", borderRadius: "0 2px 2px 0", background: "linear-gradient(180deg, #A78BFA, #7C3AED)" }} />}
              <Settings size={collapsed ? 16 : 14} style={{ flexShrink: 0 }} />
              <AnimatePresence>
                {!collapsed && (
                  <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.13 }}>
                    Settings
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
          )}
        </NavLink>

        <NavLink to="/about" style={{ textDecoration: "none" }} title={collapsed ? "About" : undefined}>
          {({ isActive }) => (
            <div
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: collapsed ? "7px 0" : "7px 10px",
                justifyContent: collapsed ? "center" : "flex-start",
                borderRadius: 7, cursor: "pointer", position: "relative",
                background: isActive ? "rgba(139,92,246,0.12)" : "transparent",
                color: isActive ? "#A78BFA" : "#4A5580",
                fontSize: "0.8125rem", fontWeight: 500, transition: "all 130ms ease",
              }}
              onMouseEnter={(e) => { if (!isActive) { (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.05)"; (e.currentTarget as HTMLDivElement).style.color = "#C8CDD8"; } }}
              onMouseLeave={(e) => { if (!isActive) { (e.currentTarget as HTMLDivElement).style.background = "transparent"; (e.currentTarget as HTMLDivElement).style.color = "#4A5580"; } }}
            >
              {isActive && <span style={{ position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)", width: 2.5, height: "55%", borderRadius: "0 2px 2px 0", background: "linear-gradient(180deg, #A78BFA, #7C3AED)" }} />}
              <Info size={collapsed ? 16 : 14} style={{ flexShrink: 0 }} />
              <AnimatePresence>
                {!collapsed && (
                  <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.13 }}>
                    About
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
          )}
        </NavLink>

        {!collapsed && <div style={{ padding: "4px 2px 2px" }}><ContextSwitcher /></div>}

        {activeAccount && (
          <div style={{
            marginTop: 4, display: "flex", alignItems: "center", gap: 9,
            padding: collapsed ? "6px 0" : "7px 10px",
            justifyContent: collapsed ? "center" : "flex-start",
            borderRadius: 8,
            background: "rgba(255,255,255,0.025)",
            border: "1px solid rgba(255,255,255,0.055)",
          }}>
            <div style={{ position: "relative", flexShrink: 0 }}>
              <img
                src={activeAccount.avatar_url} alt={activeAccount.login}
                style={{ width: 26, height: 26, borderRadius: "50%", display: "block", border: "1.5px solid rgba(255,255,255,0.10)" }}
              />
              <span style={{
                position: "absolute", bottom: -1, right: -1,
                width: 7, height: 7, borderRadius: "50%",
                background: "#10B981", border: "1.5px solid #070915",
              }} />
            </div>
            <AnimatePresence>
              {!collapsed && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  style={{ minWidth: 0, overflow: "hidden" }}>
                  <p style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#C8CDD8", letterSpacing: "-0.015em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {activeAccount.login}
                  </p>
                  <p style={{ fontSize: "0.5625rem", fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase", color: "#2D3650" }}>
                    {activeAccount.auth_type === "pat" ? "Personal Token" : "OAuth"}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => setSidebarCollapsed(!collapsed)}
        style={{
          position: "absolute", right: -14, top: "50%", transform: "translateY(-50%)",
          width: 28, height: 28, borderRadius: "50%", zIndex: 30,
          background: "#0D1025",
          border: "1.5px solid rgba(139,92,246,0.30)",
          color: "#7C6DB5", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 2px 12px rgba(0,0,0,0.55), 0 0 0 1px rgba(0,0,0,0.4)",
          transition: "border-color 150ms, color 150ms, background 150ms, box-shadow 150ms",
        }}
        onMouseEnter={(e) => {
          const btn = e.currentTarget as HTMLButtonElement;
          btn.style.borderColor = "rgba(139,92,246,0.65)";
          btn.style.color = "#C4B5FD";
          btn.style.background = "#131630";
          btn.style.boxShadow = "0 2px 14px rgba(139,92,246,0.25), 0 0 0 1px rgba(0,0,0,0.4)";
        }}
        onMouseLeave={(e) => {
          const btn = e.currentTarget as HTMLButtonElement;
          btn.style.borderColor = "rgba(139,92,246,0.30)";
          btn.style.color = "#7C6DB5";
          btn.style.background = "#0D1025";
          btn.style.boxShadow = "0 2px 12px rgba(0,0,0,0.55), 0 0 0 1px rgba(0,0,0,0.4)";
        }}
      >
        {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>
    </motion.aside>
  );
};
