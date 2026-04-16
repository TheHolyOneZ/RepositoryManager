import React from "react";
import { motion } from "framer-motion";
import {
  GitFork, Globe, Heart, Code2, Layers, Cpu, Box, Zap, ExternalLink,
  FolderUp, FilePen, MousePointer2, FolderTree,
  Play, Webhook, Users, GitBranch,
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
    icon: Play,
    color: "#F59E0B",
    title: "GitHub Actions",
    desc: "View all workflows and recent runs per repo. Enable, disable, or trigger workflows with a custom branch. Re-run only the failed jobs on any run. Live status polling every 8 s while runs are in progress. Bulk enable/disable workflows by name across any number of repos at once.",
  },
  {
    icon: Webhook,
    color: "#38BDF8",
    title: "Webhooks",
    desc: "List, create, edit, and delete webhooks across all your repos. Ping any webhook to test delivery, view the full delivery history with status codes, and re-deliver failed payloads. Bulk-create a webhook from a template (URL, events, secret, content type) across multiple repos in parallel.",
  },
  {
    icon: Users,
    color: "#A78BFA",
    title: "Collaborators",
    desc: "View all direct collaborators with permission badges (Read, Triage, Write, Maintain, Admin). Change a collaborator's role via right-click or the pen icon. Add or remove collaborators in bulk — enter multiple usernames at once, applied across all selected repos. View and cancel pending invites. Export a full access audit as CSV.",
  },
  {
    icon: GitBranch,
    color: "#34D399",
    title: "Branch Governance",
    desc: "Overview of every branch across all repos with last-commit date and stale detection (>90 days). Bulk-apply branch protection rules (required reviews, code owner reviews, enforce admins) to default branches. Remove protection in bulk. Rename the default branch across multiple repos. Create new branches from a source branch across all selected repos.",
  },
  {
    icon: FolderUp,
    color: "#EF4444",
    title: "Upload to Repository",
    desc: "Pick a local folder, browse the full file tree, select exactly what you want, and push it as one atomic commit — no 100-file GitHub drag limit.",
  },
  {
    icon: FilePen,
    color: "#60A5FA",
    title: "Repository File Manager",
    desc: "Browse every file inside any repo, rename, move, or delete them — all changes staged and committed in a single atomic operation. Flat list or hierarchical tree view with expand/collapse.",
  },
  {
    icon: MousePointer2,
    color: "#F472B6",
    title: "Custom Context Menus",
    desc: "Right-click any repo row, collaborator, webhook, file, or upload entry for context-aware actions — edit, open on GitHub, delete, and more. The default WebView context menu is fully suppressed.",
  },
  {
    icon: FolderTree,
    color: "#FB923C",
    title: "Bulk Repo Operations",
    desc: "Rename, archive, change visibility, transfer ownership, update topics, delete, and tag repos in bulk. Queue operations across hundreds of repos with concurrency control and per-item results.",
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
                v0.2.0 — Windows Native · Linux Supported
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

          {/* ── Created by ─────────────────────────────────────── */}
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

          {/* ── Recent features ────────────────────────────────── */}
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

          {/* ── Tech stack ─────────────────────────────────────── */}
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

          {/* ── Footer ─────────────────────────────────────────── */}
          <div style={{
            borderRadius: 14,
            background: "rgba(255,255,255,0.018)",
            border: "1px solid rgba(255,255,255,0.045)",
            padding: "14px 24px",
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap",
          }}>
            <span style={{ fontSize: "0.75rem", color: "#2D3450" }}>GPL-3.0 License · Open Source · v0.2.0</span>
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
