import React from "react";
import { motion } from "framer-motion";

interface GlassButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  icon?: React.ReactNode;
  children?: React.ReactNode;
}

const sizeClass = {
  sm: "h-8 px-3 text-[0.75rem] gap-1.5",
  md: "h-9 px-4 text-[0.8125rem] gap-2",
  lg: "h-11 px-5 text-[0.9375rem] gap-2",
};

const variantClass = {
  primary:   "btn-primary",
  secondary: "btn-secondary",
  danger:    "btn-danger",
  ghost:     "btn-ghost",
};

export const GlassButton = React.forwardRef<HTMLButtonElement, GlassButtonProps>(
  ({ variant = "secondary", size = "md", loading, icon, children, className = "", disabled, ...props }, ref) => {
    return (
      <motion.button
        ref={ref as React.Ref<HTMLButtonElement>}
        className={`inline-flex items-center justify-center rounded-lg select-none font-medium
          disabled:opacity-40 disabled:cursor-not-allowed
          ${sizeClass[size]} ${variantClass[variant]} ${className}`}
        disabled={disabled || loading}
        whileTap={{ scale: 0.96 }}
        transition={{ type: "spring", stiffness: 500, damping: 28 }}
        {...(props as React.ComponentProps<typeof motion.button>)}
      >
        {loading ? (
          <span className="h-3.5 w-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
        ) : icon ? (
          <span className="flex-shrink-0 flex">{icon}</span>
        ) : null}
        {children}
      </motion.button>
    );
  }
);
GlassButton.displayName = "GlassButton";
