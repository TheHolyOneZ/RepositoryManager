import React from "react";
import type { LucideIcon } from "lucide-react";
import { Sparkles, Clock } from "lucide-react";

interface PlaceholderPageProps {
  title: string;
  description: string;
  icon?: LucideIcon;
  phase?: string;
}

export const PlaceholderPage: React.FC<PlaceholderPageProps> = ({
  title,
  description,
  icon: Icon = Sparkles,
  phase,
}) => (
  <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
    <div style={{
      padding: "20px 24px 16px",
      borderBottom: "1px solid rgba(255,255,255,0.06)",
      background: "rgba(255,255,255,0.01)",
      flexShrink: 0,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 9,
          background: "rgba(139,92,246,0.15)", border: "1px solid rgba(139,92,246,0.25)",
          display: "flex", alignItems: "center", justifyContent: "center", color: "#A78BFA",
        }}>
          <Icon size={15} strokeWidth={1.75} />
        </div>
        <div>
          {phase && (
            <p style={{ fontSize: "0.5rem", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#3A4560" }}>
              {phase}
            </p>
          )}
          <h1 style={{ fontSize: "1.0625rem", fontWeight: 800, color: "#D4D8E8", letterSpacing: "-0.03em", lineHeight: 1 }}>
            {title}
          </h1>
        </div>
      </div>
      <p style={{ fontSize: "0.75rem", color: "#3A4560", marginTop: 6 }}>{description}</p>
    </div>

    <div style={{
      flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
      padding: 40,
    }}>
      <div style={{
        maxWidth: 380, borderRadius: 20, padding: "48px 40px", textAlign: "center",
        background: "rgba(255,255,255,0.018)", border: "1px solid rgba(255,255,255,0.07)",
      }}>
        <div style={{
          width: 60, height: 60, borderRadius: 16, margin: "0 auto 20px",
          background: "linear-gradient(135deg, rgba(139,92,246,0.14), rgba(6,182,212,0.07))",
          border: "1px solid rgba(139,92,246,0.22)",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "#A78BFA",
        }}>
          <Icon size={26} strokeWidth={1.75} />
        </div>

        <p style={{ fontSize: "0.9375rem", fontWeight: 700, color: "#4A5580", marginBottom: 8 }}>
          Not wired up yet
        </p>
        <p style={{ fontSize: "0.8125rem", color: "#2D3650", lineHeight: 1.6, marginBottom: 20 }}>
          {description}
        </p>

        {phase && (
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "5px 12px", borderRadius: 20,
            background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
          }}>
            <Clock size={10} style={{ color: "#3A4560" }} />
            <span style={{
              fontSize: "0.625rem", fontWeight: 800, letterSpacing: "0.12em",
              textTransform: "uppercase", color: "#3A4560",
            }}>
              {phase}
            </span>
          </div>
        )}
      </div>
    </div>
  </div>
);
