import React, { useMemo, useState } from "react";
import {
  ScanSearch, AlertTriangle, AlertCircle, Info, CheckCircle2,
  FileText, Tag, HardDrive, GitFork, Archive, Zap, ChevronDown,
  ChevronUp, RefreshCw, Shield, Eye,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useRepoStore } from "../../stores/repoStore";
import { useUIStore } from "../../stores/uiStore";
import type { Repo } from "../../types/repo";
import type { QueueItemInput } from "../../types/queue";


type Severity = "critical" | "warning" | "info" | "ok";

interface ScanRule {
  id: string;
  title: string;
  description: string;
  severity: Severity;
  icon: React.ReactNode;
  check: (repos: Repo[]) => Repo[];
  action?: {
    label: string;
    buildItems: (repos: Repo[]) => QueueItemInput[];
  };
}


const now = Date.now();
const MONTHS_6  = 6  * 30 * 24 * 60 * 60 * 1000;
const MONTHS_12 = 12 * 30 * 24 * 60 * 60 * 1000;
const MONTHS_3  = 3  * 30 * 24 * 60 * 60 * 1000;

const SCAN_RULES: ScanRule[] = [
  {
    id: "suspicious-public",
    title: "Potentially sensitive public repos",
    description: "Public repos whose name suggests private content (secret, credential, token, config-prod…). These should likely be private.",
    severity: "critical",
    icon: <Eye size={14} />,
    check: (repos) => {
      const SIGNALS = ["secret", "credential", "token", "apikey", "config-prod", ".env", "passwd", "private-key"];
      return repos.filter((r) => {
        if (r.private || r.archived) return false;
        const lc = r.name.toLowerCase();
        return SIGNALS.some((s) => lc.includes(s));
      });
    },
    action: {
      label: "Make private",
      buildItems: (repos) =>
        repos.map((r) => ({
          repo_id: r.id, repo_name: r.name, repo_full_name: r.full_name,
          action: "set_private" as const, payload: {},
        })),
    },
  },
  {
    id: "stale-not-archived",
    title: "Stale repos not archived (12+ months)",
    description: "Repos with no pushes for over a year that aren't archived. They create maintenance burden and visual noise.",
    severity: "critical",
    icon: <Archive size={14} />,
    check: (repos) =>
      repos.filter((r) => {
        if (r.archived) return false;
        if (!r.pushed_at) return true;
        return now - new Date(r.pushed_at).getTime() > MONTHS_12;
      }),
    action: {
      label: "Archive all",
      buildItems: (repos) =>
        repos.map((r) => ({
          repo_id: r.id, repo_name: r.name, repo_full_name: r.full_name,
          action: "archive" as const, payload: { archive: true },
        })),
    },
  },
  {
    id: "no-description",
    title: "Missing description",
    description: "Active repos without a description are harder to navigate and understand at a glance.",
    severity: "warning",
    icon: <FileText size={14} />,
    check: (repos) => repos.filter((r) => !r.archived && (!r.description || r.description.trim() === "")),
  },
  {
    id: "dormant-not-archived",
    title: "Dormant repos (6–12 months inactive)",
    description: "Repos inactive for 6–12 months. Consider archiving unless you plan to return.",
    severity: "warning",
    icon: <Archive size={14} />,
    check: (repos) =>
      repos.filter((r) => {
        if (r.archived) return false;
        if (!r.pushed_at) return false;
        const age = now - new Date(r.pushed_at).getTime();
        return age > MONTHS_6 && age <= MONTHS_12;
      }),
    action: {
      label: "Archive all",
      buildItems: (repos) =>
        repos.map((r) => ({
          repo_id: r.id, repo_name: r.name, repo_full_name: r.full_name,
          action: "archive" as const, payload: { archive: true },
        })),
    },
  },
  {
    id: "oversized",
    title: "Oversized repositories (500 MB+)",
    description: "Repos over 500 MB often contain committed binaries or untracked build artifacts.",
    severity: "warning",
    icon: <HardDrive size={14} />,
    check: (repos) => repos.filter((r) => r.size_kb > 512_000),
  },
  {
    id: "empty-repos",
    title: "Empty repositories",
    description: "Repos with no content. Populate or delete them.",
    severity: "warning",
    icon: <AlertTriangle size={14} />,
    check: (repos) => repos.filter((r) => r.health?.status === "empty"),
    action: {
      label: "Delete all",
      buildItems: (repos) =>
        repos.map((r) => ({
          repo_id: r.id, repo_name: r.name, repo_full_name: r.full_name,
          action: "delete" as const, payload: {},
        })),
    },
  },
  {
    id: "no-topics",
    title: "No topics assigned",
    description: "Topics improve searchability on GitHub and help categorize your estate.",
    severity: "info",
    icon: <Tag size={14} />,
    check: (repos) => repos.filter((r) => !r.archived && r.topics.length === 0),
  },
  {
    id: "public-forks-abandoned",
    title: "Abandoned public forks",
    description: "Public forks with no pushes in 3+ months and no stars — noise in your public profile.",
    severity: "info",
    icon: <GitFork size={14} />,
    check: (repos) =>
      repos.filter((r) => {
        if (!r.fork || r.archived || r.private) return false;
        const age = r.pushed_at ? now - new Date(r.pushed_at).getTime() : Infinity;
        return age > MONTHS_3 && r.stars === 0;
      }),
    action: {
      label: "Delete all",
      buildItems: (repos) =>
        repos.map((r) => ({
          repo_id: r.id, repo_name: r.name, repo_full_name: r.full_name,
          action: "delete" as const, payload: {},
        })),
    },
  },
  {
    id: "many-open-issues",
    title: "High open issue count (20+)",
    description: "Active repos with 20+ open issues — indicates backlog debt worth triaging.",
    severity: "info",
    icon: <AlertCircle size={14} />,
    check: (repos) => repos.filter((r) => !r.archived && r.open_issues >= 20),
  },
  {
    id: "large-public",
    title: "Large public repos (100 MB+)",
    description: "Public repos over 100 MB. Ensure no committed binaries or build artifacts.",
    severity: "info",
    icon: <HardDrive size={14} />,
    check: (repos) => repos.filter((r) => !r.private && !r.archived && r.size_kb > 102_400),
  },
];


const SEV: Record<Severity, { color: string; bg: string; label: string; icon: React.ReactNode }> = {
  critical: { color: "#EF4444", bg: "rgba(239,68,68,0.08)",   label: "Critical", icon: <AlertCircle size={12} /> },
  warning:  { color: "#F59E0B", bg: "rgba(245,158,11,0.08)",  label: "Warning",  icon: <AlertTriangle size={12} /> },
  info:     { color: "#3B82F6", bg: "rgba(59,130,246,0.08)",  label: "Info",     icon: <Info size={12} /> },
  ok:       { color: "#10B981", bg: "rgba(16,185,129,0.08)",  label: "OK",       icon: <CheckCircle2 size={12} /> },
};


interface FindingCardProps {
  rule: ScanRule;
  repos: Repo[];
  onQueue: (items: QueueItemInput[]) => void;
}

const FindingCard: React.FC<FindingCardProps> = ({ rule, repos, onQueue }) => {
  const [expanded, setExpanded] = useState(false);
  const sev = SEV[rule.severity];

  return (
    <div style={{ borderRadius: 12, border: `1px solid ${sev.color}22`, background: `${sev.color}05`, overflow: "hidden" }}>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        style={{
          width: "100%", display: "flex", alignItems: "center", gap: 12,
          padding: "12px 16px", background: "transparent", border: "none",
          cursor: "pointer", textAlign: "left",
        }}
      >
        <div style={{
          width: 30, height: 30, borderRadius: 8, flexShrink: 0,
          background: sev.bg, border: `1px solid ${sev.color}30`,
          display: "flex", alignItems: "center", justifyContent: "center", color: sev.color,
        }}>
          {rule.icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
            <span style={{ fontSize: "0.8375rem", fontWeight: 600, color: "#D4D8E8" }}>{rule.title}</span>
            <span style={{
              padding: "1px 6px", borderRadius: 6, flexShrink: 0,
              fontSize: "0.5625rem", fontWeight: 800, letterSpacing: "0.09em", textTransform: "uppercase",
              color: sev.color, background: sev.bg, border: `1px solid ${sev.color}28`,
            }}>
              {sev.label}
            </span>
          </div>
          <p style={{ fontSize: "0.6875rem", color: "#4A5580", lineHeight: 1.45 }}>{rule.description}</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <span style={{
            padding: "2px 10px", borderRadius: 8,
            fontSize: "0.75rem", fontWeight: 700, color: sev.color, background: sev.bg,
          }}>
            {repos.length} repo{repos.length !== 1 ? "s" : ""}
          </span>
          <div style={{ color: "#3A4560" }}>
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </div>
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            style={{ overflow: "hidden" }}
          >
            <div style={{ borderTop: `1px solid ${sev.color}15`, padding: "12px 16px" }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 12 }}>
                {repos.slice(0, 30).map((r) => (
                  <span key={r.id} style={{
                    padding: "2px 8px", borderRadius: 6,
                    background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
                    fontFamily: "'Cascadia Code','Consolas',monospace",
                    fontSize: "0.6875rem", color: "#8991A4",
                  }}>
                    {r.name}
                  </span>
                ))}
                {repos.length > 30 && (
                  <span style={{ fontSize: "0.6875rem", color: "#3A4560", alignSelf: "center" }}>
                    +{repos.length - 30} more
                  </span>
                )}
              </div>
              {rule.action && (
                <button
                  type="button"
                  onClick={() => onQueue(rule.action!.buildItems(repos))}
                  style={{
                    height: 30, padding: "0 14px", borderRadius: 7, cursor: "pointer",
                    display: "flex", alignItems: "center", gap: 6,
                    background: rule.severity === "critical" ? "rgba(239,68,68,0.14)" : "rgba(139,92,246,0.14)",
                    border: rule.severity === "critical" ? "1px solid rgba(239,68,68,0.30)" : "1px solid rgba(139,92,246,0.30)",
                    color: rule.severity === "critical" ? "#F87171" : "#C4B5FD",
                    fontSize: "0.75rem", fontWeight: 600, transition: "all 130ms",
                  }}
                >
                  <Zap size={11} /> {rule.action.label}
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};


const StatBox: React.FC<{ value: number; label: string; color: string }> = ({ value, label, color }) => (
  <div>
    <p style={{ fontSize: "1.375rem", fontWeight: 800, color, letterSpacing: "-0.04em", lineHeight: 1 }}>{value}</p>
    <p style={{ fontSize: "0.625rem", fontWeight: 700, color: "#3A4560", letterSpacing: "0.10em", textTransform: "uppercase", marginTop: 2 }}>{label}</p>
  </div>
);


type ScanState = "idle" | "scanning" | "done";

export const ScannerPage: React.FC = () => {
  const repos    = useRepoStore((s) => s.repos);
  const openModal = useUIStore((s) => s.openModal);

  const [scanState, setScanState] = useState<ScanState>("idle");
  const [progress, setProgress]   = useState(0);
  const [showOk, setShowOk]       = useState(false);

  const results = useMemo(() => {
    if (scanState !== "done") return null;
    return SCAN_RULES.map((rule) => ({ rule, affected: rule.check(repos) }));
  }, [repos, scanState]);

  const runScan = () => {
    setScanState("scanning");
    setProgress(0);
    const total = SCAN_RULES.length;
    let done = 0;
    const iv = setInterval(() => {
      done++;
      setProgress(Math.round((done / total) * 100));
      if (done >= total) { clearInterval(iv); setScanState("done"); }
    }, 55);
  };

  const score = useMemo(() => {
    if (!results) return null;
    const c = results.filter((r) => r.rule.severity === "critical" && r.affected.length > 0).length;
    const w = results.filter((r) => r.rule.severity === "warning"  && r.affected.length > 0).length;
    const i = results.filter((r) => r.rule.severity === "info"     && r.affected.length > 0).length;
    return Math.max(0, Math.min(100, 100 - c * 20 - w * 8 - i * 3));
  }, [results]);

  const scoreColor = score === null ? "#3A4560" : score >= 80 ? "#10B981" : score >= 55 ? "#F59E0B" : "#EF4444";

  const queueFinding = (items: QueueItemInput[]) => {
    openModal("confirm-queue", { items, action: items[0]?.action ?? "archive" });
  };

  const findings = results?.filter((r) => r.affected.length > 0) ?? [];
  const okCount  = results?.filter((r) => r.affected.length === 0).length ?? 0;
  const critCount = findings.filter((r) => r.rule.severity === "critical").length;
  const warnCount = findings.filter((r) => r.rule.severity === "warning").length;
  const infoCount = findings.filter((r) => r.rule.severity === "info").length;

  return (
    <div style={{ height: "100%", overflowY: "auto" }}>
      <div style={{
        padding: "20px 24px 16px",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        background: "rgba(255,255,255,0.01)",
        display: "flex", alignItems: "flex-start", justifyContent: "space-between",
      }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 9,
              background: "rgba(139,92,246,0.15)", border: "1px solid rgba(139,92,246,0.25)",
              display: "flex", alignItems: "center", justifyContent: "center", color: "#A78BFA",
            }}>
              <ScanSearch size={15} />
            </div>
            <div>
              <p style={{ fontSize: "0.5rem", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#3A4560" }}>
                Audit
              </p>
              <h1 style={{ fontSize: "1.0625rem", fontWeight: 800, color: "#D4D8E8", letterSpacing: "-0.03em", lineHeight: 1 }}>
                Scanner
              </h1>
            </div>
          </div>
          <p style={{ fontSize: "0.75rem", color: "#3A4560", marginTop: 6 }}>
            {SCAN_RULES.length} hygiene checks against your {repos.length} cached repos — no API calls, instant results.
          </p>
        </div>

        {scanState === "done" && (
          <button
            type="button"
            onClick={runScan}
            style={{
              height: 32, padding: "0 14px", borderRadius: 8, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 6, flexShrink: 0,
              background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)",
              color: "#8991A4", fontSize: "0.75rem", fontWeight: 600, transition: "all 130ms",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.09)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.05)"; }}
          >
            <RefreshCw size={12} /> Re-scan
          </button>
        )}
      </div>

      <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: 24 }}>

        {scanState === "idle" && (
          <div style={{
            borderRadius: 16, padding: "48px 40px",
            background: "rgba(139,92,246,0.04)", border: "1px solid rgba(139,92,246,0.14)",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 22, textAlign: "center",
          }}>
            <div style={{
              width: 64, height: 64, borderRadius: 18,
              background: "rgba(139,92,246,0.12)", border: "1px solid rgba(139,92,246,0.25)",
              display: "flex", alignItems: "center", justifyContent: "center", color: "#A78BFA",
            }}>
              <Shield size={28} strokeWidth={1.5} />
            </div>
            <div>
              <h2 style={{ fontSize: "1.125rem", fontWeight: 800, color: "#D4D8E8", letterSpacing: "-0.02em", marginBottom: 8 }}>
                Hygiene audit
              </h2>
              <p style={{ fontSize: "0.8125rem", color: "#6B7A9B", lineHeight: 1.65, maxWidth: 460 }}>
                Scans for stale repos, missing metadata, governance gaps, and potential security issues. All checks run locally — no API calls needed.
              </p>
            </div>
            <button
              type="button"
              onClick={runScan}
              disabled={repos.length === 0}
              style={{
                height: 42, padding: "0 28px", borderRadius: 10,
                cursor: repos.length === 0 ? "not-allowed" : "pointer",
                background: repos.length === 0
                  ? "rgba(139,92,246,0.08)"
                  : "linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)",
                border: "none",
                color: repos.length === 0 ? "#4A5580" : "#fff",
                fontSize: "0.875rem", fontWeight: 700, letterSpacing: "-0.01em",
                display: "flex", alignItems: "center", gap: 8,
                boxShadow: repos.length > 0 ? "0 4px 20px rgba(139,92,246,0.35)" : "none",
                transition: "all 150ms",
              }}
            >
              <ScanSearch size={15} />
              {repos.length === 0 ? "Load repositories first" : `Scan ${repos.length} repositories`}
            </button>
          </div>
        )}

        {scanState === "scanning" && (
          <div style={{
            borderRadius: 16, padding: 48,
            background: "rgba(139,92,246,0.04)", border: "1px solid rgba(139,92,246,0.14)",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 20, textAlign: "center",
          }}>
            <div style={{ position: "relative", width: 60, height: 60 }}>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1.1, ease: "linear" }}
                style={{
                  width: 60, height: 60, borderRadius: "50%",
                  border: "3px solid rgba(139,92,246,0.15)",
                  borderTop: "3px solid #8B5CF6",
                  position: "absolute", inset: 0,
                }}
              />
              <div style={{
                position: "absolute", inset: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#A78BFA",
              }}>
                <ScanSearch size={18} />
              </div>
            </div>
            <div>
              <p style={{ fontSize: "0.875rem", fontWeight: 600, color: "#D4D8E8", marginBottom: 4 }}>Scanning…</p>
              <p style={{ fontSize: "0.75rem", color: "#6B7A9B" }}>Running {SCAN_RULES.length} checks</p>
            </div>
            <div style={{ width: "100%", maxWidth: 300, height: 5, borderRadius: 3, background: "rgba(255,255,255,0.07)" }}>
              <motion.div
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.08 }}
                style={{
                  height: "100%", borderRadius: 3,
                  background: "linear-gradient(90deg, #8B5CF6, #A78BFA)",
                  boxShadow: "0 0 10px rgba(139,92,246,0.5)",
                }}
              />
            </div>
          </div>
        )}

        {scanState === "done" && results && (
          <>
            <div style={{
              borderRadius: 14,
              background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)",
              padding: "20px 24px",
              display: "flex", alignItems: "center", gap: 24,
            }}>
              <div style={{ position: "relative", width: 80, height: 80, flexShrink: 0 }}>
                <svg width="80" height="80" viewBox="0 0 80 80">
                  <circle cx="40" cy="40" r="32" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="7" />
                  <circle
                    cx="40" cy="40" r="32" fill="none"
                    stroke={scoreColor} strokeWidth="7"
                    strokeDasharray={`${2 * Math.PI * 32}`}
                    strokeDashoffset={`${2 * Math.PI * 32 * (1 - (score ?? 0) / 100)}`}
                    strokeLinecap="round"
                    transform="rotate(-90 40 40)"
                    style={{ filter: `drop-shadow(0 0 6px ${scoreColor}80)`, transition: "stroke-dashoffset 0.5s ease" }}
                  />
                </svg>
                <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontSize: "1.125rem", fontWeight: 800, color: scoreColor, lineHeight: 1 }}>{score}</span>
                  <span style={{ fontSize: "0.5rem", color: "#3A4560", letterSpacing: "0.1em", textTransform: "uppercase" }}>score</span>
                </div>
              </div>

              <div style={{ flex: 1, display: "flex", gap: 32 }}>
                <StatBox value={critCount} label="Critical" color="#EF4444" />
                <StatBox value={warnCount} label="Warnings" color="#F59E0B" />
                <StatBox value={infoCount} label="Info" color="#3B82F6" />
                <StatBox value={okCount} label="Passing" color="#10B981" />
              </div>

              <div style={{ flexShrink: 0, textAlign: "right", maxWidth: 160 }}>
                <p style={{ fontSize: "0.875rem", fontWeight: 700, color: scoreColor, marginBottom: 3 }}>
                  {score! >= 80 ? "Healthy" : score! >= 55 ? "Needs attention" : "Action required"}
                </p>
                <p style={{ fontSize: "0.6875rem", color: "#3A4560" }}>
                  {findings.length} issue{findings.length !== 1 ? "s" : ""} · {results.reduce((s, r) => s + r.affected.length, 0)} repos affected
                </p>
              </div>
            </div>

            {findings.length > 0 && (
              <section>
                <p style={{ fontSize: "0.5625rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#3A4560", marginBottom: 10 }}>
                  Findings
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {[...findings]
                    .sort((a, b) => {
                      const o: Record<Severity, number> = { critical: 0, warning: 1, info: 2, ok: 3 };
                      return o[a.rule.severity] - o[b.rule.severity];
                    })
                    .map(({ rule, affected }) => (
                      <FindingCard key={rule.id} rule={rule} repos={affected} onQueue={queueFinding} />
                    ))}
                </div>
              </section>
            )}

            {okCount > 0 && (
              <section>
                <button
                  type="button"
                  onClick={() => setShowOk((v) => !v)}
                  style={{
                    width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 8, marginBottom: 8,
                    background: "transparent", border: "none", cursor: "pointer", padding: 0,
                  }}
                >
                  <p style={{ fontSize: "0.5625rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#3A4560" }}>
                    Passing checks ({okCount})
                  </p>
                  {showOk ? <ChevronUp size={12} style={{ color: "#3A4560" }} /> : <ChevronDown size={12} style={{ color: "#3A4560" }} />}
                </button>
                <AnimatePresence>
                  {showOk && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                      style={{ overflow: "hidden" }}
                    >
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {results.filter((r) => r.affected.length === 0).map(({ rule }) => (
                          <div key={rule.id} style={{
                            display: "flex", alignItems: "center", gap: 10,
                            padding: "10px 14px", borderRadius: 10,
                            background: "rgba(16,185,129,0.04)", border: "1px solid rgba(16,185,129,0.12)",
                          }}>
                            <CheckCircle2 size={14} style={{ color: "#10B981", flexShrink: 0 }} />
                            <span style={{ fontSize: "0.8125rem", color: "#4A5580", fontWeight: 500 }}>{rule.title}</span>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </section>
            )}

            {findings.length === 0 && (
              <div style={{
                padding: "40px 24px", borderRadius: 14, textAlign: "center",
                background: "rgba(16,185,129,0.04)", border: "1px solid rgba(16,185,129,0.14)",
              }}>
                <div style={{
                  width: 52, height: 52, borderRadius: 14, margin: "0 auto 14px",
                  background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.25)",
                  display: "flex", alignItems: "center", justifyContent: "center", color: "#10B981",
                }}>
                  <Shield size={22} strokeWidth={1.5} />
                </div>
                <p style={{ fontSize: "0.9375rem", fontWeight: 800, color: "#10B981", marginBottom: 6 }}>
                  All checks passed
                </p>
                <p style={{ fontSize: "0.75rem", color: "#3A4560" }}>
                  Your repository estate is in excellent shape.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
