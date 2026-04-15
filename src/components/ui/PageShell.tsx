import React from "react";
import type { LucideIcon } from "lucide-react";

type Width = "narrow" | "wide" | "full";

const widthClass: Record<Width, string> = {
  narrow: "page-inner--narrow",
  wide:   "page-inner--wide",
  full:   "page-inner--full",
};

interface PageShellProps {
  children: React.ReactNode;

  title?: string;
  subtitle?: string;
  icon?: LucideIcon;
  width?: Width;
  className?: string;

  scroll?: boolean;

  eyebrow?: string | null;
}

export const PageShell: React.FC<PageShellProps> = ({
  children,
  title,
  subtitle,
  icon: Icon,
  width = "wide",
  className = "",
  scroll = true,
  eyebrow = "Workspace",
}) => {
  const outer = scroll
    ? "page-scroll"
    : "flex h-full min-h-0 flex-1 flex-col p-[var(--page-pad)]";

  return (
    <div className={`${outer} ${className}`.trim()}>
      <div className={`page-inner ${widthClass[width]} ${scroll ? "" : "flex min-h-0 flex-1 flex-col"}`.trim()}>
        {(title || subtitle) && (
          <header className="flex flex-col gap-1.5 pb-1">
            {title && (
              <div className="flex items-start gap-3.5">
                {Icon && (
                  <div
                    className="mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-[#A78BFA]"
                    style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)" }}
                  >
                    <Icon size={20} strokeWidth={1.75} />
                  </div>
                )}
                <div className="min-w-0">
                  {eyebrow != null && eyebrow !== "" && (
                    <p className="section-eyebrow">{eyebrow}</p>
                  )}
                  <h1 className="text-[1.125rem] font-bold tracking-tight text-[#E8EAF0] leading-tight">
                    {title}
                  </h1>
                  {subtitle && (
                    <p className="mt-1.5 max-w-2xl text-[0.8125rem] leading-relaxed text-[#4A5166]">
                      {subtitle}
                    </p>
                  )}
                </div>
              </div>
            )}
          </header>
        )}
        {children}
      </div>
    </div>
  );
};
