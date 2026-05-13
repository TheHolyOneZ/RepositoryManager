import React from "react";
import { motion } from "framer-motion";
import { useSettingsStore } from "../../stores/settingsStore";

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
  color,
  glow,
  height = 4,
  className = "",
  animated = true,
}) => {
  const storeAccent = useSettingsStore((s) => s.accentColor);
  const resolvedColor = color ?? storeAccent;
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
          background: resolvedColor,
          boxShadow: glow ?? `0 0 8px ${resolvedColor}50`,
        }}
      />
    </div>
  );
};
