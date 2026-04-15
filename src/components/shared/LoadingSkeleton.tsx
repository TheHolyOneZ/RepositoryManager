import React from "react";

interface LoadingSkeletonProps {
  count?: number;
}

const SkeletonRow: React.FC = () => (
  <div className="flex items-center gap-3 border-b border-white/[0.04] px-4 py-3 animate-shimmer">
    <div className="h-4 w-4 flex-shrink-0 rounded bg-white/[0.06]" />
    <div className="h-3 w-3 flex-shrink-0 rounded-full bg-white/[0.05]" />
    <div className="h-3 flex-1 max-w-48 rounded bg-white/[0.06]" />
    <div className="h-4 w-14 flex-shrink-0 rounded-full bg-white/[0.05]" />
    <div className="h-3 w-16 flex-shrink-0 rounded bg-white/[0.04]" />
    <div className="h-3 w-12 flex-shrink-0 rounded bg-white/[0.04]" />
    <div className="h-3 w-12 flex-shrink-0 rounded bg-white/[0.04]" />
    <div className="h-3 w-16 flex-shrink-0 rounded bg-white/[0.04] ml-auto" />
  </div>
);

export const LoadingSkeleton: React.FC<LoadingSkeletonProps> = ({ count = 8 }) => (
  <div className="flex flex-col">
    {Array.from({ length: count }).map((_, i) => (
      <SkeletonRow key={i} />
    ))}
  </div>
);

export const StatCardSkeleton: React.FC = () => (
  <div className="stat-card animate-shimmer">
    <div className="h-2.5 w-16 rounded bg-white/[0.06]" />
    <div className="mt-2 h-7 w-14 rounded bg-white/[0.08]" />
    <div className="mt-1 h-2 w-20 rounded bg-white/[0.04]" />
  </div>
);
