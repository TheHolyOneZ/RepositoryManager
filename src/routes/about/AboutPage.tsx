import React from "react";
import { motion } from "framer-motion";
import { GitFork, Globe, Heart, Code2, Layers, Cpu, Box, Zap, ExternalLink } from "lucide-react";
import { openUrlExternal } from "../../lib/tauri/commands";

const GITHUB_URL = "https://github.com/TheHolyOneZ/RepositoryManager";
const WEBSITE_URL = "https://zsync.eu/repomanager/";

const stack = [
  { label: "Backend",        value: "Rust",               icon: Cpu   },
  { label: "Desktop shell",  value: "Tauri 2",            icon: Box   },
  { label: "Frontend",       value: "React 18 + TypeScript", icon: Code2 },
  { label: "State",          value: "Zustand",            icon: Layers },
  { label: "Animations",     value: "Framer Motion",      icon: Zap   },
];

function openLink(url: string) {
  openUrlExternal(url).catch(() => { window.open(url, "_blank"); });
}

export const AboutPage: React.FC = () => {
  return (
    <div style={{ padding: "32px 36px", maxWidth: 680, margin: "0 auto" }}>

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 32 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14,
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
              v0.1.0 — Windows Native · Linux Supported
            </p>
          </div>
        </div>

        <div style={{
          borderRadius: 14,
          background: "rgba(255,255,255,0.028)",
          border: "1px solid rgba(255,255,255,0.065)",
          padding: "24px 26px",
          marginBottom: 20,
        }}>
          <p style={{ margin: "0 0 14px", fontSize: "0.8125rem", lineHeight: 1.7, color: "#8A91A8" }}>
            ZRepoManager is a blazing-fast desktop app for managing every GitHub repository you've ever
            touched. Bulk operations, analytics, queued execution, and smart cleanup suggestions — all
            from a single native window.
          </p>
          <p style={{ margin: 0, fontSize: "0.8125rem", lineHeight: 1.7, color: "#8A91A8" }}>
            Built with care to replace 50 browser tabs and endless GitHub UI clicking.
          </p>
        </div>

        <div style={{
          borderRadius: 14,
          background: "rgba(255,255,255,0.028)",
          border: "1px solid rgba(255,255,255,0.065)",
          padding: "20px 26px",
          marginBottom: 20,
        }}>
          <p style={{ margin: "0 0 16px", fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase", color: "#3A4060" }}>
            Created by
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <div style={{
              width: 40, height: 40, borderRadius: "50%",
              background: "linear-gradient(135deg, #A78BFA 0%, #7C3AED 100%)",
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
            }}>
              <span style={{ fontSize: "0.9375rem", fontWeight: 800, color: "#fff", letterSpacing: "-0.02em" }}>Z</span>
            </div>
            <div>
              <p style={{ margin: 0, fontSize: "0.9375rem", fontWeight: 700, color: "#D4D8E8", letterSpacing: "-0.02em" }}>
                TheHolyOneZ
              </p>
              <p style={{ margin: "2px 0 0", fontSize: "0.75rem", color: "#3A4060" }}>
                Designer · Developer · Maintainer
              </p>
            </div>
            <div style={{ marginLeft: "auto", display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                onClick={() => openLink(GITHUB_URL)}
                style={{
                  display: "flex", alignItems: "center", gap: 7,
                  padding: "7px 14px", borderRadius: 8, cursor: "pointer",
                  background: "rgba(139,92,246,0.10)",
                  border: "1px solid rgba(139,92,246,0.22)",
                  color: "#A78BFA", fontSize: "0.8125rem", fontWeight: 600,
                  transition: "all 130ms ease",
                }}
                onMouseEnter={(e) => {
                  const b = e.currentTarget;
                  b.style.background = "rgba(139,92,246,0.20)";
                  b.style.borderColor = "rgba(139,92,246,0.40)";
                  b.style.boxShadow = "0 0 14px rgba(139,92,246,0.15)";
                }}
                onMouseLeave={(e) => {
                  const b = e.currentTarget;
                  b.style.background = "rgba(139,92,246,0.10)";
                  b.style.borderColor = "rgba(139,92,246,0.22)";
                  b.style.boxShadow = "none";
                }}
              >
                <GitFork size={13} />
                GitHub
              </button>
              <button
                onClick={() => openLink(WEBSITE_URL)}
                style={{
                  display: "flex", alignItems: "center", gap: 7,
                  padding: "7px 14px", borderRadius: 8, cursor: "pointer",
                  background: "rgba(6,182,212,0.08)",
                  border: "1px solid rgba(6,182,212,0.18)",
                  color: "#67E8F9", fontSize: "0.8125rem", fontWeight: 600,
                  transition: "all 130ms ease",
                }}
                onMouseEnter={(e) => {
                  const b = e.currentTarget;
                  b.style.background = "rgba(6,182,212,0.16)";
                  b.style.borderColor = "rgba(6,182,212,0.35)";
                  b.style.boxShadow = "0 0 14px rgba(6,182,212,0.12)";
                }}
                onMouseLeave={(e) => {
                  const b = e.currentTarget;
                  b.style.background = "rgba(6,182,212,0.08)";
                  b.style.borderColor = "rgba(6,182,212,0.18)";
                  b.style.boxShadow = "none";
                }}
              >
                <Globe size={13} />
                Website
              </button>
            </div>
          </div>
        </div>

        <div style={{
          borderRadius: 14,
          background: "rgba(255,255,255,0.028)",
          border: "1px solid rgba(255,255,255,0.065)",
          padding: "20px 26px",
          marginBottom: 20,
        }}>
          <p style={{ margin: "0 0 16px", fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase", color: "#3A4060" }}>
            Tech Stack
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {stack.map(({ label, value, icon: Icon }) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 7, flexShrink: 0,
                  background: "rgba(139,92,246,0.08)",
                  border: "1px solid rgba(139,92,246,0.14)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Icon size={13} style={{ color: "#7C6DB5" }} />
                </div>
                <span style={{ fontSize: "0.75rem", fontWeight: 500, color: "#3A4060", minWidth: 110 }}>{label}</span>
                <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#8A91A8" }}>{value}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{
          borderRadius: 14,
          background: "rgba(255,255,255,0.018)",
          border: "1px solid rgba(255,255,255,0.045)",
          padding: "14px 26px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <span style={{ fontSize: "0.75rem", color: "#2D3450" }}>MIT License · Open Source</span>
          <button
            onClick={() => openLink(GITHUB_URL)}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "5px 12px", borderRadius: 6, cursor: "pointer",
              background: "transparent",
              border: "1px solid rgba(255,255,255,0.07)",
              color: "#4A5580", fontSize: "0.75rem", fontWeight: 500,
              transition: "all 130ms ease",
            }}
            onMouseEnter={(e) => {
              const b = e.currentTarget;
              b.style.borderColor = "rgba(139,92,246,0.25)";
              b.style.color = "#A78BFA";
            }}
            onMouseLeave={(e) => {
              const b = e.currentTarget;
              b.style.borderColor = "rgba(255,255,255,0.07)";
              b.style.color = "#4A5580";
            }}
          >
            <ExternalLink size={11} />
            View Source
          </button>
        </div>
      </motion.div>
    </div>
  );
};
