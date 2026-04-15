import React from "react";
import { useLocation } from "react-router-dom";
import { Search, Eye, EyeOff, ChevronDown, Bell, GitFork, Zap, LayoutDashboard, Lightbulb, GitBranch, Webhook, Users, Network, Calendar, ArrowRightLeft, ScanSearch, Settings as SettingsIcon, Info, FolderUp, FilePen } from "lucide-react";
import { useUIStore } from "../../stores/uiStore";
import { useAccountStore, selectActiveAccount } from "../../stores/accountStore";
import { useNotificationStore, selectUnreadCount } from "../../stores/notificationStore";

const pageTitles: Record<string, string> = {
  "/repos": "Repositories",
  "/queue": "Queue",
  "/analytics": "Analytics",
  "/suggestions": "Suggestions",
  "/actions": "GitHub Actions",
  "/webhooks": "Webhooks",
  "/collaborators": "Collaborators",
  "/branches": "Branch Governance",
  "/scheduler": "Scheduler",
  "/migration": "Migration",
  "/scanner": "Scanner",
  "/settings": "Settings",
  "/upload": "Upload to Repository",
  "/files": "File Manager",
  "/about": "About",
};


const pageAccents: Record<string, [string, string]> = {
  "/repos":        ["#A78BFA", "#7C3AED"],
  "/queue":        ["#34D399", "#059669"],
  "/analytics":    ["#60A5FA", "#2563EB"],
  "/suggestions":  ["#FBBF24", "#D97706"],
  "/actions":      ["#F472B6", "#DB2777"],
  "/webhooks":     ["#FB923C", "#EA580C"],
  "/collaborators":["#A3E635", "#65A30D"],
  "/branches":     ["#38BDF8", "#0284C7"],
  "/scheduler":    ["#C084FC", "#9333EA"],
  "/migration":    ["#FB7185", "#E11D48"],
  "/scanner":      ["#4ADE80", "#16A34A"],
  "/settings":     ["#94A3B8", "#64748B"],
  "/upload":       ["#F59E0B", "#D97706"],
  "/files":        ["#38BDF8", "#0284C7"],
  "/about":        ["#A78BFA", "#7C3AED"],
};

const pageIcons: Record<string, React.ElementType> = {
  "/repos": GitFork,
  "/queue": Zap,
  "/analytics": LayoutDashboard,
  "/suggestions": Lightbulb,
  "/actions": GitBranch,
  "/webhooks": Webhook,
  "/collaborators": Users,
  "/branches": Network,
  "/scheduler": Calendar,
  "/migration": ArrowRightLeft,
  "/scanner": ScanSearch,
  "/settings": SettingsIcon,
  "/upload": FolderUp,
  "/files": FilePen,
  "/about": Info,
};

export const TopBar: React.FC = () => {
  const { pathname } = useLocation();
  const title = pageTitles[pathname] ?? "ZRepoManager";
  const [accentA, accentB] = pageAccents[pathname] ?? ["#A78BFA", "#7C3AED"];
  const PageIcon = pageIcons[pathname];
  const isDryRun = useUIStore((s) => s.isDryRunMode);
  const setDryRun = useUIStore((s) => s.setDryRunMode);
  const openPalette = useUIStore((s) => s.openCommandPalette);
  const openSlideOver = useUIStore((s) => s.openSlideOver);
  const accounts = useAccountStore((s) => s.accounts);
  const activeAccount = useAccountStore(selectActiveAccount);
  const setActive = useAccountStore((s) => s.setActiveAccount);
  const unreadCount = useNotificationStore(selectUnreadCount);
  const [acctOpen, setAcctOpen] = React.useState(false);
  const [searchHovered, setSearchHovered] = React.useState(false);

  return (
    <header
      style={{
        height: 48, flexShrink: 0, display: "flex", alignItems: "center",
        gap: 12, paddingLeft: 20, paddingRight: 16,
        background: "rgba(6,7,16,0.92)",
        borderBottom: "1px solid rgba(255,255,255,0.065)",
        boxShadow: "0 1px 0 rgba(0,0,0,0.35)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0, marginRight: 4 }}>
        {PageIcon && (
          <div style={{
            width: 26, height: 26, borderRadius: 7, flexShrink: 0,
            background: `linear-gradient(135deg, ${accentA}18, ${accentB}0D)`,
            border: `1px solid ${accentA}28`,
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: `0 0 10px ${accentA}18`,
          }}>
            <PageIcon size={13} style={{ color: accentA }} />
          </div>
        )}
        <h1 style={{
          fontSize: "0.9375rem", fontWeight: 700,
          color: accentA,
          letterSpacing: "-0.02em", whiteSpace: "nowrap",
          textShadow: `0 0 20px ${accentA}55`,
        }}>
          {title}
        </h1>
      </div>

      <button
        onClick={openPalette}
        onMouseEnter={() => setSearchHovered(true)}
        onMouseLeave={() => setSearchHovered(false)}
        style={{
          display: "flex", alignItems: "center", gap: 8,
          height: 32, flex: 1, maxWidth: 260,
          borderRadius: 8, padding: "0 12px",
          background: searchHovered
            ? "rgba(139,92,246,0.08)"
            : "rgba(255,255,255,0.042)",
          border: searchHovered
            ? "1px solid rgba(139,92,246,0.30)"
            : "1px solid rgba(255,255,255,0.07)",
          color: searchHovered ? "#9580C8" : "#3D4A66",
          fontSize: "0.75rem", fontWeight: 500,
          cursor: "pointer",
          transition: "all 160ms ease",
          boxShadow: searchHovered ? "0 0 16px rgba(139,92,246,0.12), inset 0 1px 0 rgba(255,255,255,0.04)" : "none",
        }}
      >
        <Search size={13} style={{ flexShrink: 0, color: searchHovered ? "#8B5CF6" : "#3D4A66", transition: "color 160ms ease" }} />
        <span style={{ letterSpacing: "0.01em" }}>Search anything…</span>
        <span style={{
          marginLeft: "auto", padding: "2px 7px", borderRadius: 5,
          background: searchHovered ? "rgba(139,92,246,0.15)" : "rgba(255,255,255,0.05)",
          border: searchHovered ? "1px solid rgba(139,92,246,0.25)" : "1px solid rgba(255,255,255,0.08)",
          color: searchHovered ? "#9580C8" : "#2A3350",
          fontFamily: "monospace", fontSize: 9, fontWeight: 700,
          letterSpacing: "0.05em",
          transition: "all 160ms ease",
        }}>⌘K</span>
      </button>

      <div style={{ flex: 1 }} />

      <button
        type="button"
        onClick={() => setDryRun(!isDryRun)}
        style={{
          display: "flex", alignItems: "center", gap: 6,
          height: 30, padding: "0 10px", borderRadius: 7,
          background: isDryRun ? "rgba(245,158,11,0.10)" : "rgba(255,255,255,0.04)",
          border: isDryRun ? "1px solid rgba(245,158,11,0.30)" : "1px solid rgba(255,255,255,0.08)",
          color: isDryRun ? "#FBBF24" : "#4A5580",
          fontSize: "0.75rem", fontWeight: 600, cursor: "pointer",
          transition: "all 140ms ease",
        }}
      >
        {isDryRun ? <EyeOff size={12} /> : <Eye size={12} />}
        {isDryRun ? "Dry Run ON" : "Dry Run"}
      </button>

      <div style={{ position: "relative" }}>
        <button
          type="button"
          onClick={() => openSlideOver("notifications")}
          style={{
            width: 32, height: 32, borderRadius: 8, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "transparent", border: "1px solid rgba(255,255,255,0.08)",
            color: unreadCount > 0 ? "#A78BFA" : "#4A5580",
            transition: "all 130ms",
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.06)"; (e.currentTarget as HTMLButtonElement).style.color = "#C8CDD8"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = unreadCount > 0 ? "#A78BFA" : "#4A5580"; }}
        >
          <Bell size={14} />
        </button>
        {unreadCount > 0 && (
          <span style={{
            position: "absolute", top: -3, right: -3,
            minWidth: 15, height: 15, borderRadius: 8, padding: "0 3px",
            background: "#8B5CF6", color: "#fff",
            fontSize: 8, fontWeight: 800,
            display: "flex", alignItems: "center", justifyContent: "center",
            border: "1.5px solid #06080F",
            pointerEvents: "none",
          }}>
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </div>

      {accounts.length > 1 ? (
        <div style={{ position: "relative" }}>
          <button
            onClick={() => setAcctOpen((v) => !v)}
            style={{
              display: "flex", alignItems: "center", gap: 7,
              height: 32, padding: "0 8px", borderRadius: 8,
              background: "transparent", border: "none", cursor: "pointer",
              color: "#8991A4", transition: "background 140ms ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.05)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            {activeAccount && <img src={activeAccount.avatar_url} alt="" style={{ width: 24, height: 24, borderRadius: "50%", border: "1.5px solid rgba(255,255,255,0.12)" }} />}
            <span style={{ fontSize: "0.75rem" }}>{activeAccount?.login}</span>
            <ChevronDown size={11} style={{ color: "#3A4560" }} />
          </button>
          {acctOpen && (
            <div
              style={{
                position: "absolute", right: 0, top: "calc(100% + 6px)",
                background: "rgba(10,12,26,0.97)", border: "1px solid rgba(255,255,255,0.11)",
                borderRadius: 12, padding: "6px", minWidth: 160, zIndex: 50,
                boxShadow: "0 16px 48px rgba(0,0,0,0.50)",
              }}
              onMouseLeave={() => setAcctOpen(false)}
            >
              {accounts.map((a) => (
                <button key={a.id} onClick={() => { setActive(a.id); setAcctOpen(false); }}
                  style={{
                    width: "100%", display: "flex", alignItems: "center", gap: 10,
                    padding: "8px 10px", borderRadius: 8, cursor: "pointer",
                    background: "transparent", border: "none", transition: "background 120ms",
                    color: a.id === activeAccount?.id ? "#A78BFA" : "#8991A4",
                    fontSize: "0.8125rem", fontWeight: 500,
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <img src={a.avatar_url} alt="" style={{ width: 20, height: 20, borderRadius: "50%" }} />
                  {a.login}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : activeAccount ? (
        <img
          src={activeAccount.avatar_url} alt={activeAccount.login}
          style={{ width: 28, height: 28, borderRadius: "50%", border: "1.5px solid rgba(255,255,255,0.14)", flexShrink: 0 }}
        />
      ) : null}
    </header>
  );
};
