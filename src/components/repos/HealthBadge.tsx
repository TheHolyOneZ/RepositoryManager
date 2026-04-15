import React from "react";
import type { HealthStatus } from "../../types/repo";
import { healthColor, healthBg, healthBorder, healthLabel } from "../../lib/utils/health";

interface HealthBadgeProps {
  status: HealthStatus;
  score?: number;
  size?: "sm" | "md";
}

export const HealthBadge: React.FC<HealthBadgeProps> = ({ status, score, size = "sm" }) => {
  const color = healthColor(status);
  const bg = healthBg(status);
  const border = healthBorder(status);

  return (
    <span
      style={{
        display: "inline-flex", alignItems: "center", gap: size === "sm" ? 4 : 5,
        borderRadius: 5,
        fontWeight: 700, letterSpacing: "0.04em", fontFamily: "inherit",
        fontSize: size === "sm" ? "0.625rem" : "0.6875rem",
        padding: size === "sm" ? "2px 6px" : "3px 8px",
        color, background: bg, border: `1px solid ${border}`,
        textTransform: "uppercase",
      }}
    >
      <span
        style={{
          flexShrink: 0, borderRadius: "50%",
          background: color,
          width: size === "sm" ? 4 : 5,
          height: size === "sm" ? 4 : 5,
          ...(status === "active" ? { animation: "pulse 2s ease-in-out infinite" } : {}),
        }}
      />
      {healthLabel(status)}
      {score !== undefined && size !== "sm" && (
        <span style={{ opacity: 0.5, fontWeight: 400, fontSize: "0.625rem" }}>{score}</span>
      )}
    </span>
  );
};
