import React from "react";
import { GlassButton } from "../glass/GlassButton";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  message?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, message, action }) => (
  <div className="flex h-full flex-col items-center justify-center gap-4 px-8 py-16 text-center">
    {icon && (
      <div
        className="mb-1 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/[0.07] bg-white/[0.025]"
        style={{ boxShadow: "0 16px 40px rgba(0,0,0,0.30)" }}
      >
        {icon}
      </div>
    )}
    <div className="max-w-xs space-y-1.5">
      <h3 className="text-[0.9375rem] font-bold tracking-tight text-[#C8CDD8]">{title}</h3>
      {message && <p className="text-[0.8125rem] leading-relaxed text-[#4A5166]">{message}</p>}
    </div>
    {action && (
      <GlassButton variant="primary" size="sm" onClick={action.onClick} className="mt-1">
        {action.label}
      </GlassButton>
    )}
  </div>
);
