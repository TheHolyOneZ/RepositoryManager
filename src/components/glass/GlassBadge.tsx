import React from "react";

interface GlassBadgeProps {
  color?: string;
  bg?: string;
  border?: string;
  children: React.ReactNode;
  className?: string;
  dot?: boolean;
}

export const GlassBadge: React.FC<GlassBadgeProps> = ({
  color = "#8991A4",
  bg = "rgba(255,255,255,0.06)",
  border = "rgba(255,255,255,0.10)",
  children,
  className = "",
  dot = false,
}) => (
  <span
    className={`inline-flex items-center gap-1 rounded-full px-2 py-[2px] text-[11px] font-semibold tracking-tight ${className}`}
    style={{ color, background: bg, border: `1px solid ${border}` }}
  >
    {dot && (
      <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full" style={{ background: color }} />
    )}
    {children}
  </span>
);
