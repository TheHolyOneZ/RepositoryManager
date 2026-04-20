import React, { useState, useMemo } from "react";
import { Search } from "lucide-react";
import type { Repo } from "../../types/repo";

interface CompactRepoGridProps {
  repos: Repo[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onSelectAll?: () => void;
  onClearAll?: () => void;
}

export const CompactRepoGrid: React.FC<CompactRepoGridProps> = ({
  repos, selectedIds, onToggle, onSelectAll, onClearAll,
}) => {
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return q ? repos.filter((r) => r.name.toLowerCase().includes(q) || r.owner.toLowerCase().includes(q)) : repos;
  }, [repos, search]);

  return (
    <div style={{ borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)", overflow: "hidden" }}>
      <div style={{
        padding: "7px 10px", borderBottom: "1px solid rgba(255,255,255,0.06)",
        display: "flex", gap: 7, alignItems: "center",
        background: "rgba(255,255,255,0.015)",
      }}>
        <div style={{ position: "relative", flex: 1 }}>
          <Search size={11} style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", color: "#3A4560", pointerEvents: "none" }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter repos…"
            style={{
              width: "100%", height: 26, borderRadius: 6, paddingLeft: 26, paddingRight: 8,
              background: "rgba(255,255,255,0.05)", border: "1px solid transparent",
              color: "#C8CDD8", fontSize: "0.75rem", outline: "none",
            }}
            onFocus={(e) => { e.currentTarget.style.border = "1px solid rgba(139,92,246,0.35)"; }}
            onBlur={(e) => { e.currentTarget.style.border = "1px solid transparent"; }}
          />
        </div>
        {onSelectAll && (
          <button onClick={onSelectAll} style={{ height: 24, padding: "0 10px", borderRadius: 5, fontSize: "0.6875rem", fontWeight: 600, cursor: "pointer", background: "rgba(139,92,246,0.10)", border: "1px solid rgba(139,92,246,0.20)", color: "#A78BFA", whiteSpace: "nowrap" }}>
            All
          </button>
        )}
        {onClearAll && (
          <button onClick={onClearAll} style={{ height: 24, padding: "0 10px", borderRadius: 5, fontSize: "0.6875rem", fontWeight: 600, cursor: "pointer", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#4A5580", whiteSpace: "nowrap" }}>
            None
          </button>
        )}
      </div>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
        gap: 2,
        padding: 6,
        maxHeight: 220,
        overflowY: "auto",
        background: "rgba(255,255,255,0.008)",
      }}>
        {filtered.map((repo) => {
          const active = selectedIds.has(repo.id);
          return (
            <button
              key={repo.id}
              onClick={() => onToggle(repo.id)}
              title={repo.name}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "5px 8px", borderRadius: 6,
                background: active ? "rgba(139,92,246,0.13)" : "transparent",
                border: active ? "1px solid rgba(139,92,246,0.22)" : "1px solid transparent",
                cursor: "pointer", textAlign: "left", minWidth: 0,
              }}
              onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
              onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = "transparent"; }}
            >
              <span style={{
                width: 11, height: 11, borderRadius: 3, flexShrink: 0,
                border: active ? "1.5px solid #8B5CF6" : "1.5px solid rgba(255,255,255,0.15)",
                background: active ? "#8B5CF6" : "transparent",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {active && <span style={{ width: 5, height: 5, background: "#fff", borderRadius: 1, display: "block" }} />}
              </span>
              <span style={{
                fontSize: "0.6875rem", fontWeight: 500,
                color: active ? "#C4B5FD" : "#6A7A9A",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1,
              }}>
                {repo.name}
              </span>
            </button>
          );
        })}
        {filtered.length === 0 && (
          <div style={{ gridColumn: "1 / -1", padding: "20px", textAlign: "center", fontSize: "0.75rem", color: "#2D3650" }}>
            No repos match
          </div>
        )}
      </div>

      <div style={{ padding: "5px 10px", borderTop: "1px solid rgba(255,255,255,0.05)", background: "rgba(0,0,0,0.12)" }}>
        <p style={{ fontSize: "0.625rem", color: "#2D3650", fontVariantNumeric: "tabular-nums" }}>
          {selectedIds.size} selected · {filtered.length} total
        </p>
      </div>
    </div>
  );
};
