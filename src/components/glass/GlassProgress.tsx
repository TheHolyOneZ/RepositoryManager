import React from "react";
import { motion } from "framer-motion";

interface GlassProgressProps {
  value: number;
  color?: string;
  glow?: string;
  height?: number;
  className?: string;
  animated?: boolean;
}

export const GlassProgress: React.FC<GlassProgressProps> = ({
  value,
  color = "#8B5CF6",
  glow,
  height = 4,
  className = "",
  animated = true,
}) => {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div
      className={`w-full overflow-hidden rounded-full ${className}`}
      style={{ height, background: "rgba(255,255,255,0.06)" }}
    >
      <motion.div
        className="h-full rounded-full"
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: animated ? 0.7 : 0, ease: [0.22, 1, 0.36, 1] }}
        style={{
          background: color,
          boxShadow: glow ?? `0 0 8px ${color}50`,
        }}
      />
    </div>
  );
};
