import React, { useState, useCallback, useRef, useEffect } from "react";
import { ShieldAlert, AlertCircle, RefreshCw, ToggleLeft, ToggleRight, ExternalLink, ChevronDown, ChevronUp, ShieldCheck, Shield } from "lucide-react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { CompactRepoGrid } from "../../components/repos/CompactRepoGrid";
import { RepoSelectorDropdown } from "../../components/repos/RepoSelectorDropdown";
import { useRepoStore } from "../../stores/repoStore";
import { useUIStore } from "../../stores/uiStore";
import {
  ghListDependabotAlerts, ghGetDependabotEnabled,
  ghEnableDependabot, ghDisableDependabot,
  ghEnableSecurityFixes, ghDisableSecurityFixes,
  ghPortfolioSecuritySummary,
} from "../../lib/tauri/commands";
import { formatInvokeError } from "../../lib/formatError";
import type { DependabotAlert, RepoAlertSummary } from "../../types/governance";

type TabId = "repo-alerts" | "portfolio" | "bulk-controls";
type SeverityFilter = "all" | "critical" | "high" | "medium" | "low";
type StateFilter = "open" | "dismissed" | "fixed";

const SEV = {
  critical: { color: "#EF4444", bg: "rgba(239,68,68,0.10)", label: "Critical" },
  high:     { color: "#F97316", bg: "rgba(249,115,22,0.10)", label: "High" },
  medium:   { color: "#F59E0B", bg: "rgba(245,158,11,0.10)", label: "Medium" },
  low:      { color: "#3B82F6", bg: "rgba(59,130,246,0.10)", label: "Low" },
};


const SevBadge: React.FC<{ severity: string; size?: "sm" | "xs" }> = ({ severity, size = "sm" }) => {
  const s = SEV[severity as keyof typeof SEV] ?? { color: "#6B7A9B", bg: "rgba(107,122,155,0.10)", label: severity };
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: size === "xs" ? "1px 6px" : "3px 9px", borderRadius: 6,
      fontSize: size === "xs" ? "0.5625rem" : "0.625rem",
      fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
      color: s.color, background: s.bg, border: `1px solid ${s.color}28`,
      whiteSpace: "nowrap",
    }}>
      {s.label}
    </span>
  );
};


const MultiRepoPicker: React.FC<{
  repos: import("../../types/repo").Repo[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
  accentColor?: string;
  accentBg?: string;
}> = ({ repos, selectedIds, onToggle, onSelectAll, onClearAll, accentColor = "#FCA5A5", accentBg = "rgba(239,68,68,0.08)" }) => {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  const handleOpen = () => {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 6, left: rect.left });
    }
    setOpen((v) => !v);
  };

  useEffect(() => {
    if (!open) return;
    const update = () => {
      if (btnRef.current) {
        const rect = btnRef.current.getBoundingClientRect();
        setPos({ top: rect.bottom + 6, left: rect.left });
      }
    };
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => { window.removeEventListener("scroll", update, true); window.removeEventListener("resize", update); };
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        onClick={handleOpen}
        style={{
          display: "flex", alignItems: "center", gap: 7, height: 32, padding: "0 12px", borderRadius: 8, cursor: "pointer",
          background: selectedIds.size > 0 ? accentBg : "rgba(255,255,255,0.05)",
          border: selectedIds.size > 0 ? `1px solid ${accentColor}38` : "1px solid rgba(255,255,255,0.09)",
          color: selectedIds.size > 0 ? accentColor : "#6B7A9B",
          fontSize: "0.8125rem", fontWeight: selectedIds.size > 0 ? 600 : 400, transition: "all 140ms",
        }}
      >
        {selectedIds.size > 0 ? `${selectedIds.size} repos selected` : "Select repos…"}
        <ChevronDown size={11} style={{ color: "#4A5580" }} />
      </button>

      {open && pos && createPortal(
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 9998 }} onClick={() => setOpen(false)} />
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.13 }}
            style={{
              position: "fixed", top: pos.top, left: pos.left, zIndex: 9999,
              width: 380, borderRadius: 10, padding: 10,
              background: "rgba(10,12,26,0.97)", border: "1px solid rgba(255,255,255,0.13)",
              boxShadow: "0 20px 60px rgba(0,0,0,0.65)",
            }}
          >
            <CompactRepoGrid
              repos={repos}
              selectedIds={selectedIds}
              onToggle={onToggle}
              onSelectAll={onSelectAll}
              onClearAll={onClearAll}
            />
          </motion.div>
        </>,
        document.body
      )}
    </>
  );
};


const AlertRow: React.FC<{ alert: DependabotAlert }> = ({ alert }) => {
  const [expanded, setExpanded] = useState(false);
  return (
    <div style={{ borderRadius: 9, border: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.02)", marginBottom: 4, overflow: "hidden", transition: "border-color 140ms" }}
      onMouseEnter={(e) => (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(255,255,255,0.12)"}
      onMouseLeave={(e) => (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(255,255,255,0.07)"}
    >
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        style={{ width: "100%", display: "grid", gridTemplateColumns: "auto 1fr auto auto auto", alignItems: "center", gap: 12, padding: "10px 16px", background: "transparent", border: "none", cursor: "pointer", textAlign: "left" }}
      >
        <SevBadge severity={alert.severity} />
        <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#C8CDD8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {alert.package_name}
        </span>
        <span style={{ fontSize: "0.6875rem", color: "#4A5580", whiteSpace: "nowrap" }}>{alert.package_ecosystem}</span>
        {alert.cve_id && (
          <span style={{ fontFamily: "monospace", fontSize: "0.6875rem", color: "#3A4560", background: "rgba(255,255,255,0.04)", padding: "2px 7px", borderRadius: 5, whiteSpace: "nowrap" }}>
            {alert.cve_id}
          </span>
        )}
        {expanded ? <ChevronUp size={12} style={{ color: "#3A4560", flexShrink: 0 }} /> : <ChevronDown size={12} style={{ color: "#3A4560", flexShrink: 0 }} />}
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.15 }} style={{ overflow: "hidden" }}>
            <div style={{ padding: "12px 16px 14px", borderTop: "1px solid rgba(255,255,255,0.05)", display: "flex", flexDirection: "column", gap: 8 }}>
              <p style={{ fontSize: "0.8125rem", color: "#8991A4", lineHeight: 1.55 }}>{alert.summary}</p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                {alert.ghsa_id && (
                  <span style={{ fontFamily: "monospace", fontSize: "0.75rem", color: "#6B7A9B", background: "rgba(255,255,255,0.04)", padding: "2px 8px", borderRadius: 5 }}>{alert.ghsa_id}</span>
                )}
                {alert.cve_id && (
                  <span style={{ fontFamily: "monospace", fontSize: "0.75rem", color: "#6B7A9B", background: "rgba(255,255,255,0.04)", padding: "2px 8px", borderRadius: 5 }}>{alert.cve_id}</span>
                )}
                <a href={alert.html_url} target="_blank" rel="noopener noreferrer"
                  style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "0.75rem", color: "#8B5CF6", textDecoration: "none", marginLeft: "auto" }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <ExternalLink size={11} /> View on GitHub
                </a>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};


export const SecurityPage: React.FC = () => {
  const repos = useRepoStore((s) => s.repos);
  const addToast = useUIStore((s) => s.addToast);
  const [tab, setTab] = useState<TabId>("repo-alerts");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [alerts, setAlerts] = useState<DependabotAlert[]>([]);
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [stateFilter, setStateFilter] = useState<StateFilter>("open");
  const [sevFilter, setSevFilter] = useState<SeverityFilter>("all");
  const [portfolioTargets, setPortfolioTargets] = useState<Set<string>>(new Set());
  const [portfolioLoading, setPortfolioLoading] = useState(false);
  const [portfolioResults, setPortfolioResults] = useState<RepoAlertSummary[]>([]);
  const [bulkTargets, setBulkTargets] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState<string | null>(null);
  const [bulkResults, setBulkResults] = useState<Array<{ repo: string; success: boolean; error?: string }>>([]);

  const selectedRepo = repos.find((r) => r.id === selectedId);

  const loadAlerts = useCallback(async () => {
    if (!selectedRepo) return;
    setLoading(true);
    try {
      const [alertData, isEnabled] = await Promise.all([
        ghListDependabotAlerts(selectedRepo.owner, selectedRepo.name, stateFilter, sevFilter !== "all" ? sevFilter : undefined),
        ghGetDependabotEnabled(selectedRepo.owner, selectedRepo.name),
      ]);
      setAlerts(alertData);
      setEnabled(isEnabled);
    } catch (e) {
      const msg = formatInvokeError(e);
      if (msg.toLowerCase().includes("archived") || msg.toLowerCase().includes("not available")) {
        setAlerts([]); setEnabled(false);
        addToast({ type: "info", title: "Not available", message: "Dependabot is not available for archived repos." });
      } else {
        addToast({ type: "error", title: "Load failed", message: msg });
      }
    } finally { setLoading(false); }
  }, [selectedRepo, stateFilter, sevFilter, addToast]);

  useEffect(() => { if (selectedRepo && tab === "repo-alerts") loadAlerts(); }, [selectedRepo, tab, stateFilter, sevFilter]);

  const toggleDependabot = async () => {
    if (!selectedRepo || enabled === null) return;
    try {
      if (enabled) { await ghDisableDependabot(selectedRepo.owner, selectedRepo.name); setEnabled(false); }
      else { await ghEnableDependabot(selectedRepo.owner, selectedRepo.name); setEnabled(true); }
      addToast({ type: "success", title: `Dependabot ${enabled ? "disabled" : "enabled"}` });
    } catch (e) {
      const raw = formatInvokeError(e);
      const msg = raw.toLowerCase().includes("failed to change")
        ? "GitHub rejected the request. Your token likely needs the 'security_events' write scope, or Dependabot is managed at the organization level for this repo."
        : raw;
      addToast({ type: "error", title: "Dependabot toggle failed", message: msg });
    }
  };

  const runPortfolioScan = async () => {
    if (portfolioTargets.size === 0) return;
    setPortfolioLoading(true);
    setPortfolioResults([]);
    try {
      const targets = repos.filter((r) => portfolioTargets.has(r.id)).map((r) => ({ owner: r.owner, repo: r.name }));
      const results = await ghPortfolioSecuritySummary(targets);
      setPortfolioResults(results.sort((a, b) => (b.critical * 1000 + b.high * 100 + b.medium) - (a.critical * 1000 + a.high * 100 + a.medium)));
    } catch (e) { addToast({ type: "error", title: "Scan failed", message: formatInvokeError(e) }); }
    finally { setPortfolioLoading(false); }
  };

  const runBulkControl = async (action: "enable_dependabot" | "disable_dependabot" | "enable_fixes" | "disable_fixes") => {
    if (bulkTargets.size === 0) return;
    setBulkLoading(action);
    setBulkResults([]);
    const targets = repos.filter((r) => bulkTargets.has(r.id));
    const results: Array<{ repo: string; success: boolean; error?: string }> = [];
    for (const repo of targets) {
      try {
        if (action === "enable_dependabot") await ghEnableDependabot(repo.owner, repo.name);
        else if (action === "disable_dependabot") await ghDisableDependabot(repo.owner, repo.name);
        else if (action === "enable_fixes") await ghEnableSecurityFixes(repo.owner, repo.name);
        else await ghDisableSecurityFixes(repo.owner, repo.name);
        results.push({ repo: `${repo.owner}/${repo.name}`, success: true });
      } catch (e) {
        const raw = formatInvokeError(e);
        const friendly = raw.toLowerCase().includes("failed to change")
          ? "Token missing 'security_events' scope or org-controlled"
          : raw;
        results.push({ repo: `${repo.owner}/${repo.name}`, success: false, error: friendly });
      }
    }
    setBulkResults(results);
    setBulkLoading(null);
    addToast({ type: "success", title: `${results.filter((r) => r.success).length}/${results.length} repos updated` });
  };

  const filteredAlerts = alerts.filter((a) => sevFilter === "all" || a.severity === sevFilter);
  const sevCounts = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const a of filteredAlerts) {
    if (a.severity in sevCounts) sevCounts[a.severity as keyof typeof sevCounts]++;
  }

  const portfolioTotals = portfolioResults.reduce((acc, r) => ({
    critical: acc.critical + r.critical,
    high: acc.high + r.high,
    medium: acc.medium + r.medium,
    low: acc.low + r.low,
  }), { critical: 0, high: 0, medium: 0, low: 0 });

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>

      {}
      <div style={{
        flexShrink: 0, display: "flex", alignItems: "center",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        background: "rgba(255,255,255,0.01)",
      }}>
        {}
        <div style={{ display: "flex", alignItems: "flex-end", padding: "0 20px", gap: 2, height: 52 }}>
          {([["repo-alerts", "Repo Alerts"], ["portfolio", "Portfolio Overview"], ["bulk-controls", "Bulk Controls"]] as const).map(([t, label]) => (
            <button key={t} onClick={() => setTab(t)}
              style={{
                height: 36, padding: "0 14px", borderRadius: "8px 8px 0 0", cursor: "pointer",
                background: tab === t ? "rgba(255,255,255,0.05)" : "transparent",
                border: tab === t ? "1px solid rgba(255,255,255,0.09)" : "1px solid transparent",
                borderBottom: tab === t ? "1px solid rgba(6,8,16,0.01)" : "1px solid transparent",
                color: tab === t ? "#FCA5A5" : "#4A5580",
                fontSize: "0.8125rem", fontWeight: tab === t ? 600 : 400, marginBottom: -1,
                transition: "all 130ms",
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <div style={{ width: 1, height: 28, background: "rgba(255,255,255,0.07)", margin: "0 16px" }} />

        {}
        {tab === "repo-alerts" && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, paddingRight: 20, overflow: "hidden" }}>
            <RepoSelectorDropdown
              repos={repos} selectedId={selectedId}
              onSelect={(id) => { setSelectedId((p) => p === id ? null : id); setAlerts([]); setEnabled(null); }}
              accentColor="#FCA5A5" accentBg="rgba(239,68,68,0.08)"
            />

            {selectedRepo && (
              <>
                <div style={{ width: 1, height: 20, background: "rgba(255,255,255,0.07)", flexShrink: 0 }} />
                {}
                <div style={{ display: "flex", gap: 2 }}>
                  {(["open", "dismissed", "fixed"] as const).map((s) => (
                    <button key={s} onClick={() => setStateFilter(s)}
                      style={{
                        height: 26, padding: "0 10px", borderRadius: 6, cursor: "pointer",
                        background: stateFilter === s ? "rgba(255,255,255,0.08)" : "transparent",
                        border: stateFilter === s ? "1px solid rgba(255,255,255,0.14)" : "1px solid transparent",
                        color: stateFilter === s ? "#C8CDD8" : "#4A5580",
                        fontSize: "0.75rem", fontWeight: stateFilter === s ? 600 : 400, textTransform: "capitalize",
                      }}
                    >{s}</button>
                  ))}
                </div>
                <div style={{ width: 1, height: 20, background: "rgba(255,255,255,0.07)", flexShrink: 0 }} />
                {}
                <div style={{ display: "flex", gap: 2 }}>
                  {(["all", "critical", "high", "medium", "low"] as const).map((s) => {
                    const cfg = s !== "all" ? SEV[s] : null;
                    return (
                      <button key={s} onClick={() => setSevFilter(s)}
                        style={{
                          height: 26, padding: "0 9px", borderRadius: 6, cursor: "pointer",
                          background: sevFilter === s ? (cfg ? `${cfg.bg}` : "rgba(255,255,255,0.08)") : "transparent",
                          border: sevFilter === s ? `1px solid ${cfg ? `${cfg.color}30` : "rgba(255,255,255,0.14)"}` : "1px solid transparent",
                          color: sevFilter === s ? (cfg ? cfg.color : "#C8CDD8") : "#4A5580",
                          fontSize: "0.6875rem", fontWeight: sevFilter === s ? 700 : 400, textTransform: "capitalize",
                        }}
                      >{s}</button>
                    );
                  })}
                </div>
                <div style={{ flex: 1 }} />
                {}
                {enabled !== null && (
                  <button onClick={toggleDependabot}
                    style={{
                      display: "flex", alignItems: "center", gap: 6, height: 28, padding: "0 12px", borderRadius: 7, cursor: "pointer",
                      background: enabled ? "rgba(16,185,129,0.08)" : "rgba(255,255,255,0.04)",
                      border: enabled ? "1px solid rgba(16,185,129,0.22)" : "1px solid rgba(255,255,255,0.08)",
                      color: enabled ? "#34D399" : "#6B7A9B", fontSize: "0.75rem", fontWeight: 600, flexShrink: 0,
                    }}
                  >
                    {enabled ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                    Dependabot {enabled ? "On" : "Off"}
                  </button>
                )}
                <button onClick={loadAlerts} disabled={loading}
                  style={{ width: 28, height: 28, borderRadius: 7, background: "transparent", border: "1px solid rgba(255,255,255,0.08)", cursor: "pointer", color: "#4A5580", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
                >
                  <RefreshCw size={12} style={loading ? { animation: "spin 1s linear infinite" } : {}} />
                </button>
              </>
            )}
          </div>
        )}

        {}
        {tab === "portfolio" && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, paddingRight: 20 }}>
            <MultiRepoPicker
              repos={repos}
              selectedIds={portfolioTargets}
              onToggle={(id) => setPortfolioTargets((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; })}
              onSelectAll={() => setPortfolioTargets(new Set(repos.map((r) => r.id)))}
              onClearAll={() => setPortfolioTargets(new Set())}
            />
            <button
              onClick={runPortfolioScan}
              disabled={portfolioTargets.size === 0 || portfolioLoading}
              style={{
                height: 32, padding: "0 16px", borderRadius: 8, cursor: "pointer",
                background: "linear-gradient(135deg, #EF4444 0%, #DC2626 100%)",
                border: "none", color: "#fff", fontSize: "0.8125rem", fontWeight: 700,
                display: "flex", alignItems: "center", gap: 6, flexShrink: 0,
                opacity: portfolioTargets.size === 0 || portfolioLoading ? 0.45 : 1,
                boxShadow: portfolioTargets.size > 0 ? "0 4px 14px rgba(239,68,68,0.28)" : "none",
                transition: "all 140ms",
              }}
            >
              <ShieldAlert size={13} />
              {portfolioLoading ? "Scanning…" : `Scan ${portfolioTargets.size}`}
            </button>
            {portfolioResults.length > 0 && (
              <>
                <div style={{ width: 1, height: 20, background: "rgba(255,255,255,0.07)" }} />
                <div style={{ display: "flex", gap: 8 }}>
                  {portfolioTotals.critical > 0 && <span style={{ fontSize: "0.6875rem", fontWeight: 700, color: "#EF4444" }}>{portfolioTotals.critical} critical</span>}
                  {portfolioTotals.high > 0 && <span style={{ fontSize: "0.6875rem", fontWeight: 700, color: "#F97316" }}>{portfolioTotals.high} high</span>}
                  {portfolioTotals.medium > 0 && <span style={{ fontSize: "0.6875rem", fontWeight: 700, color: "#F59E0B" }}>{portfolioTotals.medium} med</span>}
                  {portfolioTotals.critical === 0 && portfolioTotals.high === 0 && portfolioTotals.medium === 0 && (
                    <span style={{ fontSize: "0.6875rem", fontWeight: 700, color: "#10B981" }}>All clean</span>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {}
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>

        {}
        {tab === "repo-alerts" && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            {!selectedRepo ? (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, padding: 40 }}>
                <div style={{ width: 56, height: 56, borderRadius: 16, background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.14)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <ShieldAlert size={22} style={{ color: "#7A3A3A" }} />
                </div>
                <p style={{ fontSize: "0.9375rem", fontWeight: 700, color: "#8991A4" }}>No repository selected</p>
                <p style={{ fontSize: "0.8125rem", color: "#3A4560" }}>Choose a repo from the dropdown above to view its Dependabot alerts.</p>
              </div>
            ) : (
              <>
                {}
                {!loading && alerts.length > 0 && (
                  <div style={{ flexShrink: 0, display: "flex", gap: 0, borderBottom: "1px solid rgba(255,255,255,0.05)", background: "rgba(255,255,255,0.01)" }}>
                    {(["critical", "high", "medium", "low"] as const).map((sev) => {
                      const count = sevCounts[sev];
                      const s = SEV[sev];
                      return (
                        <button
                          key={sev}
                          onClick={() => setSevFilter(sevFilter === sev ? "all" : sev)}
                          style={{
                            flex: 1, padding: "10px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
                            background: sevFilter === sev ? `${s.bg}` : "transparent",
                            borderRight: "1px solid rgba(255,255,255,0.05)",
                            border: "none", borderBottom: sevFilter === sev ? `2px solid ${s.color}` : "2px solid transparent",
                            cursor: "pointer", transition: "all 130ms",
                          }}
                        >
                          <span style={{ fontSize: "1.125rem", fontWeight: 800, color: count > 0 ? s.color : "#2D3650", lineHeight: 1 }}>{count}</span>
                          <span style={{ fontSize: "0.5625rem", fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase", color: count > 0 ? s.color : "#2D3650" }}>{s.label}</span>
                        </button>
                      );
                    })}
                    <div style={{ flex: 1, padding: "10px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, borderRight: "none" }}>
                      <span style={{ fontSize: "1.125rem", fontWeight: 800, color: "#6B7A9B", lineHeight: 1 }}>{filteredAlerts.length}</span>
                      <span style={{ fontSize: "0.5625rem", fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase", color: "#3A4560" }}>Total</span>
                    </div>
                  </div>
                )}

                {loading ? (
                  <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <RefreshCw size={20} style={{ color: "#3A4560", animation: "spin 1s linear infinite" }} />
                  </div>
                ) : filteredAlerts.length === 0 ? (
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 }}>
                    <div style={{ width: 56, height: 56, borderRadius: 16, background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.14)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <ShieldCheck size={22} style={{ color: "#10B981" }} />
                    </div>
                    <p style={{ fontSize: "0.9375rem", fontWeight: 700, color: "#10B981" }}>No alerts</p>
                    <p style={{ fontSize: "0.8125rem", color: "#3A4560" }}>This repo is clean for the selected filters.</p>
                  </div>
                ) : (
                  <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px" }}>
                    {filteredAlerts.map((a) => <AlertRow key={a.number} alert={a} />)}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {}
        {tab === "portfolio" && (
          <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
            {portfolioLoading ? (
              <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14 }}>
                <RefreshCw size={22} style={{ color: "#EF4444", animation: "spin 1s linear infinite" }} />
                <p style={{ fontSize: "0.875rem", color: "#6B7A9B" }}>Scanning {portfolioTargets.size} repositories…</p>
              </div>
            ) : portfolioResults.length === 0 ? (
              <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14 }}>
                <div style={{ width: 56, height: 56, borderRadius: 16, background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.14)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <ShieldAlert size={22} style={{ color: "#7A3A3A" }} />
                </div>
                <p style={{ fontSize: "0.9375rem", fontWeight: 700, color: "#8991A4" }}>No scan results yet</p>
                <p style={{ fontSize: "0.8125rem", color: "#3A4560", textAlign: "center", maxWidth: 320, lineHeight: 1.6 }}>
                  Use the dropdown above to select repos, then click Scan.
                </p>
              </div>
            ) : (
              <>
                {}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 80px 80px 80px 80px 80px", gap: 0, padding: "0 16px 8px", marginBottom: 4 }}>
                  <span style={{ fontSize: "0.5625rem", fontWeight: 700, color: "#2D3650", letterSpacing: "0.10em", textTransform: "uppercase" }}>Repository</span>
                  {(["Critical", "High", "Medium", "Low", "Total"] as const).map((h) => (
                    <span key={h} style={{ fontSize: "0.5625rem", fontWeight: 700, color: "#2D3650", letterSpacing: "0.10em", textTransform: "uppercase", textAlign: "center" }}>{h}</span>
                  ))}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  {portfolioResults.map((r) => (
                    <div key={r.repo_full_name} style={{
                      display: "grid", gridTemplateColumns: "1fr 80px 80px 80px 80px 80px",
                      alignItems: "center", padding: "10px 16px", borderRadius: 9,
                      background: r.error ? "rgba(239,68,68,0.04)" : r.total === 0 ? "rgba(16,185,129,0.03)" : "rgba(255,255,255,0.02)",
                      border: `1px solid ${r.error ? "rgba(239,68,68,0.15)" : r.total === 0 ? "rgba(16,185,129,0.10)" : "rgba(255,255,255,0.07)"}`,
                      transition: "border-color 140ms",
                    }}
                      onMouseEnter={(e) => (e.currentTarget as HTMLDivElement).style.borderColor = r.error ? "rgba(239,68,68,0.25)" : r.total === 0 ? "rgba(16,185,129,0.20)" : "rgba(255,255,255,0.13)"}
                      onMouseLeave={(e) => (e.currentTarget as HTMLDivElement).style.borderColor = r.error ? "rgba(239,68,68,0.15)" : r.total === 0 ? "rgba(16,185,129,0.10)" : "rgba(255,255,255,0.07)"}
                    >
                      <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#C8CDD8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {r.repo_full_name}
                      </span>
                      {r.error ? (
                        <span style={{ gridColumn: "2 / -1", fontSize: "0.6875rem", color: "#F87171" }}>
                          {r.error.toLowerCase().includes("archived") ? "Archived — not available" : `Error: ${r.error}`}
                        </span>
                      ) : (
                        <>
                          {([["critical", r.critical, "#EF4444"], ["high", r.high, "#F97316"], ["medium", r.medium, "#F59E0B"], ["low", r.low, "#3B82F6"]] as const).map(([, count, color]) => (
                            <span key={color} style={{ textAlign: "center", fontSize: "0.875rem", fontWeight: count > 0 ? 700 : 400, color: count > 0 ? color : "#1E2840" }}>{count}</span>
                          ))}
                          <span style={{ textAlign: "center", fontSize: "0.875rem", fontWeight: r.total > 0 ? 700 : 400, color: r.total === 0 ? "#10B981" : "#C8CDD8" }}>
                            {r.total === 0 ? "✓" : r.total}
                          </span>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {}
        {tab === "bulk-controls" && (
          <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
            {}
            <div style={{ padding: "14px 24px", borderBottom: "1px solid rgba(255,255,255,0.05)", flexShrink: 0, background: "rgba(255,255,255,0.01)", display: "flex", alignItems: "center", gap: 8 }}>
              <MultiRepoPicker
                repos={repos}
                selectedIds={bulkTargets}
                onToggle={(id) => setBulkTargets((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; })}
                onSelectAll={() => setBulkTargets(new Set(repos.map((r) => r.id)))}
                onClearAll={() => setBulkTargets(new Set())}
              />
              <div style={{ width: 1, height: 24, background: "rgba(255,255,255,0.07)" }} />
              {([
                ["enable_dependabot", "Enable Dependabot", "#34D399", "rgba(16,185,129,0.08)", "rgba(16,185,129,0.22)"],
                ["disable_dependabot", "Disable Dependabot", "#F87171", "rgba(239,68,68,0.08)", "rgba(239,68,68,0.22)"],
                ["enable_fixes", "Enable Security Fixes", "#60A5FA", "rgba(59,130,246,0.08)", "rgba(59,130,246,0.22)"],
                ["disable_fixes", "Disable Security Fixes", "#94A3B8", "rgba(100,116,139,0.08)", "rgba(100,116,139,0.22)"],
              ] as const).map(([action, label, color, bg, border]) => (
                <button
                  key={action}
                  onClick={() => runBulkControl(action)}
                  disabled={bulkTargets.size === 0 || bulkLoading !== null}
                  style={{
                    height: 32, padding: "0 14px", borderRadius: 8, cursor: "pointer",
                    background: bg, border: `1px solid ${border}`, color,
                    fontSize: "0.75rem", fontWeight: 600, flexShrink: 0,
                    display: "flex", alignItems: "center", gap: 5,
                    opacity: bulkTargets.size === 0 || bulkLoading !== null ? 0.4 : 1,
                    transition: "all 140ms",
                  }}
                >
                  {bulkLoading === action ? <RefreshCw size={11} style={{ animation: "spin 1s linear infinite" }} /> : <Shield size={11} />}
                  {bulkLoading === action ? "Working…" : label}
                </button>
              ))}
            </div>

            {}
            <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px" }}>
              {bulkResults.length === 0 ? (
                <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14 }}>
                  <div style={{ width: 56, height: 56, borderRadius: 16, background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.14)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Shield size={22} style={{ color: "#7A3A3A" }} />
                  </div>
                  <p style={{ fontSize: "0.9375rem", fontWeight: 700, color: "#8991A4" }}>Bulk Dependabot Controls</p>
                  <p style={{ fontSize: "0.8125rem", color: "#3A4560", textAlign: "center", maxWidth: 340, lineHeight: 1.6 }}>
                    Select repos above, then click an action to apply it across all selected repositories at once.
                  </p>
                </div>
              ) : (
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                    <p style={{ fontSize: "0.5625rem", fontWeight: 700, color: "#3A4560", letterSpacing: "0.12em", textTransform: "uppercase", flex: 1 }}>Results</p>
                    <span style={{ fontSize: "0.6875rem", color: "#10B981", fontWeight: 600 }}>{bulkResults.filter((r) => r.success).length} succeeded</span>
                    {bulkResults.some((r) => !r.success) && (
                      <span style={{ fontSize: "0.6875rem", color: "#F87171", fontWeight: 600 }}>{bulkResults.filter((r) => !r.success).length} failed</span>
                    )}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    {bulkResults.map((r) => (
                      <div key={r.repo} style={{
                        display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 8,
                        background: r.success ? "rgba(16,185,129,0.04)" : "rgba(239,68,68,0.05)",
                        border: `1px solid ${r.success ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.18)"}`,
                      }}>
                        {r.success
                          ? <ShieldCheck size={13} style={{ color: "#10B981", flexShrink: 0 }} />
                          : <AlertCircle size={13} style={{ color: "#EF4444", flexShrink: 0 }} />}
                        <span style={{ flex: 1, fontSize: "0.8125rem", color: "#8991A4", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.repo}</span>
                        {r.error && <span style={{ fontSize: "0.625rem", color: "#F87171", flexShrink: 0, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.error}</span>}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
