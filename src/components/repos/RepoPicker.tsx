import React, { useState, useMemo } from "react";
import { Search } from "lucide-react";
import { useRepoStore } from "../../stores/repoStore";
import type { Repo } from "../../types/repo";

interface RepoPickerProps {
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onSelectAll?: () => void;
  onClearAll?: () => void;
  singleSelect?: boolean;
  footer?: React.ReactNode;
}

export const RepoPicker: React.FC<RepoPickerProps> = ({
  selectedIds, onToggle, onSelectAll, onClearAll, singleSelect = false, footer,
}) => {
  const repos = useRepoStore((s) => s.repos);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return q ? repos.filter((r) => r.name.toLowerCase().includes(q) || r.owner.toLowerCase().includes(q)) : repos;
  }, [repos, search]);

  return (
    <div style={{
      width: 232, flexShrink: 0, display: "flex", flexDirection: "column",
      borderRight: "1px solid rgba(255,255,255,0.06)",
      background: "rgba(255,255,255,0.012)",
    }}>
      <div style={{ padding: "10px 10px 8px", borderBottom: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 }}>
        <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
          <Search size={11} style={{ position: "absolute", left: 8, color: "#3A4560", pointerEvents: "none" }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter repos…"
            style={{
              width: "100%", height: 28, borderRadius: 7,
              background: "rgba(255,255,255,0.05)", border: "1px solid transparent",
              color: "#C8CDD8", fontSize: "0.75rem", paddingLeft: 26, paddingRight: 8,
              outline: "none",
            }}
            onFocus={(e) => { e.currentTarget.style.border = "1px solid rgba(139,92,246,0.35)"; }}
            onBlur={(e) => { e.currentTarget.style.border = "1px solid transparent"; }}
          />
        </div>
        {!singleSelect && (
          <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
            <button
              onClick={onSelectAll}
              style={{ flex: 1, height: 22, borderRadius: 5, fontSize: "0.6875rem", fontWeight: 600, cursor: "pointer", background: "rgba(139,92,246,0.10)", border: "1px solid rgba(139,92,246,0.20)", color: "#A78BFA" }}
            >
              All
            </button>
            <button
              onClick={onClearAll}
              style={{ flex: 1, height: 22, borderRadius: 5, fontSize: "0.6875rem", fontWeight: 600, cursor: "pointer", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#4A5580" }}
            >
              None
            </button>
          </div>
        )}
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "4px 6px" }}>
        {filtered.length === 0 && (
          <p style={{ padding: "20px 8px", textAlign: "center", fontSize: "0.75rem", color: "#2D3650" }}>
            No repos
          </p>
        )}
        {filtered.map((repo: Repo) => {
          const active = selectedIds.has(repo.id);
          return (
            <button
              key={repo.id}
              onClick={() => onToggle(repo.id)}
              style={{
                width: "100%", display: "flex", alignItems: "center", gap: 8,
                padding: "5px 7px", borderRadius: 7, marginBottom: 1,
                background: active ? "rgba(139,92,246,0.13)" : "transparent",
                border: active ? "1px solid rgba(139,92,246,0.22)" : "1px solid transparent",
                cursor: "pointer", textAlign: "left",
              }}
            >
              {!singleSelect && (
                <span style={{
                  width: 13, height: 13, borderRadius: 3, flexShrink: 0,
                  border: active ? "1.5px solid #8B5CF6" : "1.5px solid rgba(255,255,255,0.15)",
                  background: active ? "#8B5CF6" : "transparent",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {active && <span style={{ width: 7, height: 7, background: "#fff", borderRadius: 1.5, display: "block" }} />}
                </span>
              )}
              {singleSelect && (
                <span style={{
                  width: 11, height: 11, borderRadius: "50%", flexShrink: 0,
                  border: active ? "1.5px solid #8B5CF6" : "1.5px solid rgba(255,255,255,0.15)",
                  background: active ? "#8B5CF6" : "transparent",
                }} />
              )}
              <span style={{
                fontSize: "0.75rem", fontWeight: 500,
                color: active ? "#C4B5FD" : "#6A7A9A",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1,
              }}>
                {repo.name}
              </span>
            </button>
          );
        })}
      </div>

      <div style={{ padding: "6px 10px 8px", borderTop: "1px solid rgba(255,255,255,0.05)", flexShrink: 0 }}>
        {footer && <div style={{ marginBottom: 7 }}>{footer}</div>}
        <p style={{ fontSize: "0.625rem", color: "#2D3650", fontVariantNumeric: "tabular-nums" }}>
          {singleSelect
            ? `${filtered.length} repos`
            : `${selectedIds.size} selected · ${filtered.length} total`}
        </p>
      </div>
    </div>
  );
};
