import React from "react";
import { motion, type HTMLMotionProps } from "framer-motion";

interface GlassPanelProps extends HTMLMotionProps<"div"> {
  variant?: "default" | "elevated" | "card" | "danger" | "success" | "warning";
  children: React.ReactNode;
  className?: string;
}

const variantClass: Record<string, string> = {
  default:  "glass-panel",
  elevated: "glass-elevated",
  card:     "glass-card",
  danger:   "glass-danger",
  success:  "glass-success",
  warning:  "glass-warning",
};

export const GlassPanel = React.forwardRef<HTMLDivElement, GlassPanelProps>(
  ({ variant = "default", children, className = "", ...props }, ref) => (
    <motion.div
      ref={ref}
      className={`${variantClass[variant]} ${className}`}
      {...props}
    >
      {children}
    </motion.div>
  )
);
GlassPanel.displayName = "GlassPanel";
