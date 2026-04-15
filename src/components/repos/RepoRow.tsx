import React, { useCallback, useState } from "react";
import { Star, GitFork, AlertCircle, HardDrive, ExternalLink, Lock, Globe, Check, Clipboard } from "lucide-react";
import { openUrlExternal } from "../../lib/tauri/commands";
import type { Repo } from "../../types/repo";
import { HealthBadge } from "./HealthBadge";
import { TagChip } from "./TagChip";
import { formatDate, formatBytes } from "../../lib/utils/formatters";
import { useSelectionStore } from "../../stores/selectionStore";
import { useUIStore } from "../../stores/uiStore";
import { ContextMenu } from "../shared/ContextMenu";
import type { ContextMenuItemDef } from "../shared/ContextMenu";

const langColors: Record<string, string> = {
  TypeScript: "#3178c6", JavaScript: "#f1e05a", Python: "#3572A5",
  Rust: "#dea584", Go: "#00ADD8", Java: "#b07219", "C++": "#f34b7d",
  C: "#555555", Ruby: "#701516", Swift: "#F05138", Kotlin: "#A97BFF",
  PHP: "#4F5D95", HTML: "#e34c26", CSS: "#563d7c", Shell: "#89e051",
  Dart: "#00B4AB", Vue: "#41b883", Svelte: "#ff3e00",
};

interface RepoRowProps {
  repo: Repo;
  style: React.CSSProperties;
}

const CustomCheckbox: React.FC<{ checked: boolean; onChange: () => void }> = ({ checked, onChange }) => {
  const [hov, setHov] = useState(false);
  return (
    <div
      role="checkbox"
      aria-checked={checked}
      onClick={(e) => { e.stopPropagation(); onChange(); }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: 15, height: 15, borderRadius: 4, flexShrink: 0, cursor: "pointer",
        background: checked
          ? "linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)"
          : hov ? "rgba(139,92,246,0.12)" : "rgba(255,255,255,0.05)",
        border: checked
          ? "1px solid #8B5CF6"
          : hov ? "1px solid rgba(139,92,246,0.45)" : "1px solid rgba(255,255,255,0.18)",
        display: "flex", alignItems: "center", justifyContent: "center",
        transition: "all 120ms ease",
        boxShadow: checked ? "0 0 0 2px rgba(139,92,246,0.18)" : "none",
      }}
    >
      {checked && <Check size={9} strokeWidth={3} style={{ color: "#fff" }} />}
    </div>
  );
};

export const RepoRow: React.FC<RepoRowProps> = ({ repo, style }) => {
  const isSelected = useSelectionStore((s) => s.selectedIds.has(repo.id));
  const toggle = useSelectionStore((s) => s.toggle);
  const openSlideOver = useUIStore((s) => s.openSlideOver);
  const [hovered, setHovered] = useState(false);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null);

  const handleRowClick = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('[role="checkbox"]')) return;
    if ((e.target as HTMLElement).closest('[data-external-link]')) return;
    openSlideOver("repo-detail", repo);
  }, [repo, openSlideOver]);

  const handleOpenUrl = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    openUrlExternal(repo.html_url).catch(() => {
      window.open(repo.html_url, "_blank");
    });
  }, [repo.html_url]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCtxMenu({ x: e.clientX, y: e.clientY });
  }, []);

  const ctxItems: ContextMenuItemDef[] = [
    {
      type: "item",
      label: "Open on GitHub",
      icon: ExternalLink,
      onClick: () => openUrlExternal(repo.html_url).catch(() => { window.open(repo.html_url, "_blank"); }),
    },
    {
      type: "item",
      label: "View Details",
      icon: AlertCircle,
      onClick: () => openSlideOver("repo-detail", repo),
    },
    { type: "divider" },
    {
      type: "item",
      label: isSelected ? "Deselect" : "Select",
      icon: Check,
      onClick: () => toggle(repo.id),
    },
    { type: "divider" },
    {
      type: "item",
      label: "Copy full name",
      icon: Clipboard,
      onClick: () => { navigator.clipboard.writeText(repo.full_name).catch(() => {}); },
    },
    {
      type: "item",
      label: "Copy URL",
      icon: Clipboard,
      onClick: () => { navigator.clipboard.writeText(repo.html_url).catch(() => {}); },
    },
  ];

  const langColor = repo.language ? (langColors[repo.language] ?? "#6B7280") : "#475569";

  return (
    <>
      <div
        style={{
          ...style,
          display: "flex", alignItems: "center", gap: 12,
          height: 52, padding: "0 16px",
          cursor: "pointer", userSelect: "none",
          background: isSelected
            ? "rgba(139,92,246,0.09)"
            : hovered ? "rgba(255,255,255,0.035)" : "transparent",
          borderBottom: "1px solid rgba(255,255,255,0.04)",
          borderLeft: isSelected ? "2px solid #8B5CF6" : "2px solid transparent",
          transition: "background 100ms ease, border-color 100ms ease",
          position: "absolute",
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={handleRowClick}
        onContextMenu={handleContextMenu}
      >
        <CustomCheckbox checked={isSelected} onChange={() => toggle(repo.id)} />

        <span style={{ color: "#2D3650", flexShrink: 0, display: "flex" }}>
          {repo.private ? <Lock size={11} /> : <Globe size={11} />}
        </span>

        <span style={{
          flex: 1, minWidth: 0, maxWidth: 224,
          fontSize: "0.8125rem", fontWeight: 500, color: "#D4D8E8",
          fontFamily: "'Cascadia Code','Consolas',monospace",
          letterSpacing: "-0.01em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {repo.name}
        </span>

        <div style={{ width: 72, flexShrink: 0 }}>
          {repo.health && <HealthBadge status={repo.health.status} />}
        </div>

        <div style={{ width: 72, flexShrink: 0, display: "flex", alignItems: "center", gap: 3, overflow: "hidden" }}>
          {(repo.tags ?? []).slice(0, 1).map((t) => (
            <TagChip key={t} tag={t} />
          ))}
          {(repo.tags ?? []).length > 1 && (
            <span style={{
              fontSize: "0.5625rem", fontWeight: 700, color: "#4A5580",
              background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)",
              borderRadius: 4, padding: "1px 4px", flexShrink: 0, whiteSpace: "nowrap",
            }}>
              +{(repo.tags ?? []).length - 1}
            </span>
          )}
        </div>

        <div style={{ width: 96, flexShrink: 0, display: "flex", alignItems: "center", gap: 5 }}>
          {repo.language && (
            <>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: langColor, flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: "#7A8AAE", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {repo.language}
              </span>
            </>
          )}
        </div>

        <div style={{ width: 56, flexShrink: 0, display: "flex", alignItems: "center", gap: 3, fontSize: 11, color: "#4A5580" }}>
          <Star size={10} style={{ color: "#D97706" }} />
          <span style={{ fontVariantNumeric: "tabular-nums" }}>{repo.stars.toLocaleString()}</span>
        </div>

        <div style={{ width: 48, flexShrink: 0, display: "flex", alignItems: "center", gap: 3, fontSize: 11, color: "#4A5580" }}>
          <GitFork size={10} />
          <span style={{ fontVariantNumeric: "tabular-nums" }}>{repo.forks}</span>
        </div>

        <div style={{ width: 48, flexShrink: 0, display: "flex", alignItems: "center", gap: 3, fontSize: 11, color: "#4A5580" }}>
          <AlertCircle size={10} />
          <span style={{ fontVariantNumeric: "tabular-nums" }}>{repo.open_issues}</span>
        </div>

        <div style={{ width: 64, flexShrink: 0, display: "flex", alignItems: "center", gap: 3, fontSize: 11, color: "#3A4560" }}>
          <HardDrive size={10} />
          <span>{formatBytes(repo.size_kb)}</span>
        </div>

        <span style={{ width: 72, flexShrink: 0, textAlign: "right", fontSize: 11, color: "#3A4560", fontVariantNumeric: "tabular-nums" }}>
          {formatDate(repo.pushed_at ?? repo.updated_at)}
        </span>

        <div
          data-external-link
          onClick={handleOpenUrl}
          style={{
            width: 24, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
            color: hovered ? "#8B5CF6" : "#2D3650", transition: "color 140ms",
            padding: 4, borderRadius: 4, cursor: "pointer",
          }}
          title="Open on GitHub"
        >
          <ExternalLink size={11} />
        </div>
      </div>

      {ctxMenu && (
        <ContextMenu
          x={ctxMenu.x} y={ctxMenu.y}
          items={ctxItems}
          onClose={() => setCtxMenu(null)}
        />
      )}
    </>
  );
};
