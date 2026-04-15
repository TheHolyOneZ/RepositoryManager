import React, { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { Repo } from "../../types/repo";
import { RepoRow } from "./RepoRow";
import { LoadingSkeleton } from "../shared/LoadingSkeleton";
import { EmptyState } from "../shared/EmptyState";
import { GitFork } from "lucide-react";

interface RepoTableProps {
  repos: Repo[];
  isLoading: boolean;
}

const COL_STYLE: React.CSSProperties = {
  fontSize: "0.5625rem", fontWeight: 700, letterSpacing: "0.10em",
  textTransform: "uppercase", color: "#2D3650",
};

export const RepoTable: React.FC<RepoTableProps> = ({ repos, isLoading }) => {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: repos.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 52,
    overscan: 10,
  });

  if (isLoading) return <LoadingSkeleton count={12} />;

  if (repos.length === 0) {
    return (
      <EmptyState
        icon={<GitFork size={32} strokeWidth={1.5} style={{ color: "#2D3650" }} />}
        title="No repositories here"
        message="Clear filters or hit Refresh. If still empty, check the toast — GitHub may have rejected the request."
      />
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{
        flexShrink: 0, display: "flex", alignItems: "center", gap: 12,
        height: 36, padding: "0 16px",
        background: "rgba(255,255,255,0.015)",
        borderBottom: "1px solid rgba(255,255,255,0.055)",
      }}>
        <div style={{ width: 14, flexShrink: 0 }} />
        <div style={{ width: 12, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0, maxWidth: 224, ...COL_STYLE }}>Name</div>
        <div style={{ width: 72, flexShrink: 0, ...COL_STYLE }}>Health</div>
        <div style={{ width: 72, flexShrink: 0, ...COL_STYLE }}>Tags</div>
        <div style={{ width: 96, flexShrink: 0, ...COL_STYLE }}>Language</div>
        <div style={{ width: 56, flexShrink: 0, ...COL_STYLE }}>Stars</div>
        <div style={{ width: 48, flexShrink: 0, ...COL_STYLE }}>Forks</div>
        <div style={{ width: 48, flexShrink: 0, ...COL_STYLE }}>Issues</div>
        <div style={{ width: 64, flexShrink: 0, ...COL_STYLE }}>Size</div>
        <div style={{ width: 72, flexShrink: 0, textAlign: "right", ...COL_STYLE }}>Updated</div>
        <div style={{ width: 24, flexShrink: 0 }} />
      </div>

      <div ref={parentRef} style={{ flex: 1, overflowY: "auto", overflowX: "hidden" }}>
        <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
          {virtualizer.getVirtualItems().map((vItem) => (
            <RepoRow
              key={repos[vItem.index].id}
              repo={repos[vItem.index]}
              style={{
                position: "absolute", top: 0, left: 0, right: 0,
                transform: `translateY(${vItem.start}px)`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
