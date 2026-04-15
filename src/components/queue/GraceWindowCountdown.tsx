import React from "react";
import { motion } from "framer-motion";

interface GraceWindowCountdownProps {
  seconds: number;
  totalSeconds: number;
  onAbort: () => void;
}

export const GraceWindowCountdown: React.FC<GraceWindowCountdownProps> = ({
  seconds,
  totalSeconds,
  onAbort,
}) => {
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const progress = seconds / totalSeconds;
  const dashOffset = circumference * (1 - progress);
  const isRed = seconds <= 5;
  const color = isRed ? "#EF4444" : "#8B5CF6";

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
      <div style={{ position: "relative" }}>
        <svg width={96} height={96} style={{ transform: "rotate(-90deg)" }}>
          <circle cx={48} cy={48} r={radius} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={5} />
          <motion.circle
            cx={48} cy={48} r={radius}
            fill="none"
            stroke={color}
            strokeWidth={5}
            strokeLinecap="round"
            strokeDasharray={circumference}
            animate={{ strokeDashoffset: dashOffset }}
            transition={{ duration: 0.8, ease: "linear" }}
          />
        </svg>
        <div style={{
          position: "absolute", inset: 0, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
        }}>
          <span style={{
            fontSize: "1.625rem", fontWeight: 800, fontVariantNumeric: "tabular-nums",
            letterSpacing: "-0.04em", color: isRed ? "#EF4444" : "#D4D8E8",
          }}>
            {seconds}
          </span>
          <span style={{ fontSize: "0.5625rem", color: "#3A4560", fontWeight: 600, letterSpacing: "0.06em" }}>
            SEC
          </span>
        </div>
      </div>

      <p style={{
        fontSize: "0.75rem", color: "#6B7A9B", textAlign: "center", lineHeight: 1.55,
      }}>
        Operations begin in {seconds}s.
        <br />
        Click abort to cancel.
      </p>

      <button
        onClick={onAbort}
        style={{
          height: 34, padding: "0 18px", borderRadius: 8, cursor: "pointer",
          display: "flex", alignItems: "center", gap: 6,
          background: "rgba(239,68,68,0.16)", border: "1px solid rgba(239,68,68,0.30)",
          color: "#F87171", fontSize: "0.8125rem", fontWeight: 700,
          transition: "all 130ms",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(239,68,68,0.24)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(239,68,68,0.16)"; }}
      >
        Abort
      </button>
    </div>
  );
};
