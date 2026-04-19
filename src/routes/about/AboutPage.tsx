import React from "react";
import { motion } from "framer-motion";
import {
  GitFork, Globe, Heart, Code2, Layers, Cpu, Box, Zap, ExternalLink,
  FolderUp, FilePen, MousePointer2, FolderTree,
  Play, Webhook, Users, GitBranch, GitPullRequest, CircleDot, Tag, ScrollText, Building2, Settings,
} from "lucide-react";
import { openUrlExternal } from "../../lib/tauri/commands";

const GITHUB_URL = "https://github.com/TheHolyOneZ/RepositoryManager";
const WEBSITE_URL = "https://zsync.eu/repomanager/";

const stack = [
  { label: "Backend",          value: "Rust",                  icon: Cpu,    color: "#EF4444" },
  { label: "Desktop shell",    value: "Tauri 2",               icon: Box,    color: "#38BDF8" },
  { label: "Frontend",         value: "React 18 + TypeScript", icon: Code2,  color: "#61DAFB" },
  { label: "State",            value: "Zustand",               icon: Layers, color: "#F59E0B" },
  { label: "Animations",       value: "Framer Motion",         icon: Zap,    color: "#8B5CF6" },
];

const features = [
  {
    icon: GitPullRequest,
    color: "#A78BFA",
    title: "Pull Requests",
    desc: "Full PR management: list open/closed PRs, Monaco inline diff viewer, create PRs with reviewer multi-select, review (approve/request changes/comment), merge with strategy selector. Details tab lets you toggle labels, add/remove assignees, set milestones, and convert drafts to ready — all live without reopening.",
  },
  {
    icon: CircleDot,
    color: "#34D399",
    title: "Issues",
    desc: "Issue tracking built-in: list, create, and close issues with label picker and milestone selector. Expand any issue into a chat-style thread with Markdown body, inline replies, and a full comment list. Bulk-close or bulk-label many issues at once.",
  },
  {
    icon: Tag,
    color: "#F59E0B",
    title: "Release Manager",
    desc: "Create releases and queue files to upload before clicking Create — they upload sequentially with a live progress bar. Manage assets (download, delete, upload more) in the expanded view. Cross-repo Overview shows each repo's latest tag sorted by staleness.",
  },
  {
    icon: ScrollText,
    color: "#38BDF8",
    title: "Workflow Run Logs",
    desc: "Click any completed run to expand a two-column log panel: job list with step-level status icons on the left, raw log output on the right with ANSI codes stripped, clipboard copy, and keyword search. Switching Logs/Artifacts tabs never closes the panel.",
  },
  {
    icon: Building2,
    color: "#F472B6",
    title: "Organization Support",
    desc: "Switch context between personal account and any GitHub org you belong to via the ContextSwitcher in the sidebar. Org repos load instantly and support all the same filtering, sorting, bulk ops, and analytics as personal repos.",
  },
  {
    icon: Settings,
    color: "#FB923C",
    title: "Settings & Presets",
    desc: "Configure grace window, execution mode, stale branch threshold, and cache TTL. Pick an accent color from six swatches or enter a custom hex — applied globally on launch. Save and restore filter presets. Desktop notifications for queue events (with graceful Tauri WebView fallback).",
  },
  {
    icon: Play,
    color: "#EF4444",
    title: "GitHub Actions",
    desc: "View workflows and runs per repo. Trigger with custom branch, enable/disable in bulk, re-run failed jobs, download artifacts. Create workflow YAML in Monaco with CI/Release/Deploy/Manual templates and commit to many repos at once. Live run-log viewer built in.",
  },
  {
    icon: GitBranch,
    color: "#60A5FA",
    title: "Branch Governance",
    desc: "Overview every branch portfolio-wide with last-commit dates and configurable stale detection. Bulk-apply protection rules, rename default branches, create branches from a source — all across multiple repos in parallel with per-item results.",
  },
  {
    icon: Webhook,
    color: "#67E8F9",
    title: "Webhooks & Collaborators",
    desc: "List, create, edit, and delete webhooks. Ping or re-deliver individual payloads. Manage collaborators with permission badges, bulk add/remove access, view pending invitations, and export a full access audit as CSV.",
  },
  {
    icon: FolderTree,
    color: "#FCD34D",
    title: "Bulk Repo Operations",
    desc: "Rename, archive, change visibility, transfer ownership, update topics, star/unstar, and delete repos in bulk. Queued execution with dry-run preview, grace periods, pause/resume/skip/cancel, and per-item results — with background silent refresh every 30 s.",
  },
];

function openLink(url: string) {
  openUrlExternal(url).catch(() => { window.open(url, "_blank"); });
}

export const AboutPage: React.FC = () => {
  return (

    <div style={{
      position: "absolute", inset: 0,
      overflowY: "auto", overflowX: "hidden",
      scrollbarWidth: "thin",
      scrollbarColor: "rgba(139,92,246,0.25) transparent",
    }}>
      <div style={{ maxWidth: 700, margin: "0 auto", padding: "32px 36px 48px" }}>
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          style={{ display: "flex", flexDirection: "column", gap: 18 }}
        >


          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 6 }}>
            <div style={{
              width: 52, height: 52, borderRadius: 14, flexShrink: 0,
              background: "linear-gradient(135deg, rgba(139,92,246,0.22), rgba(124,58,237,0.10))",
              border: "1px solid rgba(139,92,246,0.30)",
              boxShadow: "0 0 24px rgba(139,92,246,0.12)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Heart size={22} style={{ color: "#A78BFA" }} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700, color: "#E2E5F0", letterSpacing: "-0.025em" }}>
                About ZRepoManager
              </h2>
              <p style={{ margin: "3px 0 0", fontSize: "0.8125rem", color: "#4A5580" }}>
                v0.4.0 — Windows Native · Linux Supported
              </p>
            </div>
          </div>


          <div style={{
            borderRadius: 14,
            background: "rgba(255,255,255,0.028)",
            border: "1px solid rgba(255,255,255,0.065)",
            padding: "22px 24px",
          }}>
            <p style={{ margin: "0 0 12px", fontSize: "0.8125rem", lineHeight: 1.75, color: "#8A91A8" }}>
              ZRepoManager is a blazing-fast desktop app for managing every GitHub repository you've ever
              touched. Bulk operations, analytics, queued execution, and smart cleanup suggestions — all
              from a single native window.
            </p>
            <p style={{ margin: 0, fontSize: "0.8125rem", lineHeight: 1.75, color: "#8A91A8" }}>
              Built to replace 50 browser tabs and endless GitHub UI clicking.
            </p>
          </div>


          <div style={{
            borderRadius: 14,
            background: "rgba(255,255,255,0.028)",
            border: "1px solid rgba(255,255,255,0.065)",
            padding: "20px 24px",
          }}>
            <p style={{ margin: "0 0 16px", fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase", color: "#3A4060" }}>
              Created by
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
              <div style={{
                width: 42, height: 42, borderRadius: "50%", flexShrink: 0,
                background: "linear-gradient(135deg, #A78BFA 0%, #7C3AED 100%)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <span style={{ fontSize: "1rem", fontWeight: 800, color: "#fff", letterSpacing: "-0.02em" }}>Z</span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: "0.9375rem", fontWeight: 700, color: "#D4D8E8", letterSpacing: "-0.02em" }}>
                  TheHolyOneZ
                </p>
                <p style={{ margin: "2px 0 0", fontSize: "0.75rem", color: "#3A4060" }}>
                  Designer · Developer · Maintainer
                </p>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", flexShrink: 0 }}>
                <button
                  onClick={() => openLink(GITHUB_URL)}
                  style={{
                    display: "flex", alignItems: "center", gap: 7,
                    padding: "7px 14px", borderRadius: 8, cursor: "pointer",
                    background: "rgba(139,92,246,0.10)", border: "1px solid rgba(139,92,246,0.22)",
                    color: "#A78BFA", fontSize: "0.8125rem", fontWeight: 600, transition: "all 130ms ease",
                  }}
                  onMouseEnter={e => { const b = e.currentTarget; b.style.background = "rgba(139,92,246,0.20)"; b.style.borderColor = "rgba(139,92,246,0.40)"; b.style.boxShadow = "0 0 14px rgba(139,92,246,0.15)"; }}
                  onMouseLeave={e => { const b = e.currentTarget; b.style.background = "rgba(139,92,246,0.10)"; b.style.borderColor = "rgba(139,92,246,0.22)"; b.style.boxShadow = "none"; }}
                >
                  <GitFork size={13} /> GitHub
                </button>
                <button
                  onClick={() => openLink(WEBSITE_URL)}
                  style={{
                    display: "flex", alignItems: "center", gap: 7,
                    padding: "7px 14px", borderRadius: 8, cursor: "pointer",
                    background: "rgba(6,182,212,0.08)", border: "1px solid rgba(6,182,212,0.18)",
                    color: "#67E8F9", fontSize: "0.8125rem", fontWeight: 600, transition: "all 130ms ease",
                  }}
                  onMouseEnter={e => { const b = e.currentTarget; b.style.background = "rgba(6,182,212,0.16)"; b.style.borderColor = "rgba(6,182,212,0.35)"; b.style.boxShadow = "0 0 14px rgba(6,182,212,0.12)"; }}
                  onMouseLeave={e => { const b = e.currentTarget; b.style.background = "rgba(6,182,212,0.08)"; b.style.borderColor = "rgba(6,182,212,0.18)"; b.style.boxShadow = "none"; }}
                >
                  <Globe size={13} /> Website
                </button>
              </div>
            </div>
          </div>


          <div style={{
            borderRadius: 14,
            background: "rgba(255,255,255,0.028)",
            border: "1px solid rgba(255,255,255,0.065)",
            padding: "20px 24px",
          }}>
            <p style={{ margin: "0 0 16px", fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase", color: "#3A4060" }}>
              Latest Features
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {features.map(({ icon: Icon, color, title, desc }) => (
                <div key={title} style={{ display: "flex", gap: 12 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                    background: `${color}14`,
                    border: `1px solid ${color}28`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    marginTop: 1,
                  }}>
                    <Icon size={14} style={{ color }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: "0 0 3px", fontSize: "0.8125rem", fontWeight: 600, color: "#C8CDD8", letterSpacing: "-0.01em" }}>{title}</p>
                    <p style={{ margin: 0, fontSize: "0.75rem", lineHeight: 1.6, color: "#4A5580" }}>{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>


          <div style={{
            borderRadius: 14,
            background: "rgba(255,255,255,0.028)",
            border: "1px solid rgba(255,255,255,0.065)",
            padding: "20px 24px",
          }}>
            <p style={{ margin: "0 0 16px", fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase", color: "#3A4060" }}>
              Tech Stack
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {stack.map(({ label, value, icon: Icon, color }) => (
                <div key={label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: 7, flexShrink: 0,
                    background: `${color}14`, border: `1px solid ${color}22`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <Icon size={13} style={{ color }} />
                  </div>
                  <span style={{ fontSize: "0.75rem", fontWeight: 500, color: "#3A4060", width: 110, flexShrink: 0 }}>{label}</span>
                  <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#8A91A8" }}>{value}</span>
                </div>
              ))}
            </div>
          </div>


          <div style={{
            borderRadius: 14,
            background: "rgba(255,255,255,0.018)",
            border: "1px solid rgba(255,255,255,0.045)",
            padding: "14px 24px",
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap",
          }}>
            <span style={{ fontSize: "0.75rem", color: "#2D3450" }}>GPL-3.0 License · Open Source · v0.4.0</span>
            <button
              onClick={() => openLink(GITHUB_URL)}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "5px 12px", borderRadius: 6, cursor: "pointer",
                background: "transparent", border: "1px solid rgba(255,255,255,0.07)",
                color: "#4A5580", fontSize: "0.75rem", fontWeight: 500, transition: "all 130ms ease",
              }}
              onMouseEnter={e => { const b = e.currentTarget; b.style.borderColor = "rgba(139,92,246,0.25)"; b.style.color = "#A78BFA"; }}
              onMouseLeave={e => { const b = e.currentTarget; b.style.borderColor = "rgba(255,255,255,0.07)"; b.style.color = "#4A5580"; }}
            >
              <ExternalLink size={11} /> View Source
            </button>
          </div>

        </motion.div>
      </div>
    </div>
  );
};
