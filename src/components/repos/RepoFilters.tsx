import React, { useState, useRef } from "react";
import { X, SlidersHorizontal, RotateCcw, Plus, Tag, Bookmark, BookmarkCheck } from "lucide-react";
import { useRepoStore, selectAvailableLanguages } from "../../stores/repoStore";
import { useFilterPresetsStore } from "../../stores/filterPresetsStore";
import { useShallow } from "zustand/react/shallow";
import type { HealthStatus, RepoVisibility } from "../../types/repo";

const HEALTH_OPTIONS: HealthStatus[] = ["active", "dormant", "dead", "empty", "archived"];
const HEALTH_LABELS: Record<HealthStatus, string> = {
  active: "Active", dormant: "Dormant", dead: "Dead", empty: "Empty", archived: "Archived",
};
const HEALTH_COLORS: Record<HealthStatus, string> = {
  active: "#10B981", dormant: "#F59E0B", dead: "#EF4444", empty: "#6B7280", archived: "#8B5CF6",
};


const BUILTIN_TAGS = ["keep", "delete", "review"];
const BUILTIN_TAG_COLORS: Record<string, string> = {
  keep: "#10B981", delete: "#EF4444", review: "#F59E0B",
};

export const RepoFilters: React.FC = () => {
  const filters = useRepoStore((s) => s.filters);
  const setFilter = useRepoStore((s) => s.setFilter);
  const setFilters = useRepoStore((s) => s.setFilters);
  const resetFilters = useRepoStore((s) => s.resetFilters);
  const languages = useRepoStore(useShallow(selectAvailableLanguages));
  const customTagOptions = useRepoStore((s) => s.customTagOptions);
  const addCustomTagOption = useRepoStore((s) => s.addCustomTagOption);
  const removeCustomTagOption = useRepoStore((s) => s.removeCustomTagOption);
  const { presets, savePreset, deletePreset } = useFilterPresetsStore();

  const [newTagInput, setNewTagInput] = useState("");
  const [showTagInput, setShowTagInput] = useState(false);
  const [savePresetInput, setSavePresetInput] = useState("");
  const [showSaveInput, setShowSaveInput] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSavePreset = () => {
    const name = savePresetInput.trim();
    if (!name) return;
    savePreset(name, filters);
    setSavePresetInput("");
    setShowSaveInput(false);
  };

  const hasActiveFilters = filters.language || filters.visibility || filters.health ||
    filters.tags.length > 0 || filters.isFork !== null || filters.isTemplate !== null;

  const handleAddTag = () => {
    const tag = newTagInput.trim().toLowerCase().replace(/\s+/g, "-");
    if (!tag || BUILTIN_TAGS.includes(tag) || customTagOptions.includes(tag)) return;
    addCustomTagOption(tag);
    setNewTagInput("");
    setShowTagInput(false);
  };

  const handleRemoveCustomTag = (tag: string) => {

    if (filters.tags.includes(tag)) {
      setFilter("tags", filters.tags.filter((t) => t !== tag));
    }
    removeCustomTagOption(tag);
  };

  const toggleTagFilter = (tag: string) => {
    const next = filters.tags.includes(tag)
      ? filters.tags.filter((t) => t !== tag)
      : [...filters.tags, tag];
    setFilter("tags", next);
  };

  return (
    <div style={{
      width: 200, flexShrink: 0, display: "flex", flexDirection: "column",
      overflowY: "auto", overflowX: "hidden",
      background: "rgba(255,255,255,0.012)",
      borderRight: "1px solid rgba(255,255,255,0.06)",
    }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        height: 36, padding: "0 14px", flexShrink: 0,
        borderBottom: "1px solid rgba(255,255,255,0.055)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#3A4560" }}>
          <SlidersHorizontal size={11} />
          <span style={{ fontSize: "0.625rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" }}>
            Filters
          </span>
        </div>
        {hasActiveFilters && (
          <button onClick={resetFilters} style={{
            display: "flex", alignItems: "center", gap: 4,
            fontSize: "0.6875rem", color: "#4A5580", background: "none", border: "none",
            cursor: "pointer", transition: "color 140ms", fontWeight: 500,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "#A78BFA")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "#4A5580")}>
            <RotateCcw size={9} /> Reset
          </button>
        )}
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "14px 10px", display: "flex", flexDirection: "column", gap: 18 }}>

        <FilterSection label="Health">
          {HEALTH_OPTIONS.map((h) => (
            <FilterBtn
              key={h}
              active={filters.health === h}
              dot={HEALTH_COLORS[h]}
              onClick={() => setFilter("health", filters.health === h ? null : h)}
            >
              {HEALTH_LABELS[h]}
            </FilterBtn>
          ))}
        </FilterSection>

        <FilterSection label="Visibility">
          <div style={{ display: "flex", gap: 5 }}>
            {(["public", "private"] as RepoVisibility[]).map((v) => {
              const active = filters.visibility === v;
              return (
                <button key={v} onClick={() => setFilter("visibility", filters.visibility === v ? null : v)}
                  style={{
                    flex: 1, height: 28, borderRadius: 7, cursor: "pointer", transition: "all 130ms",
                    background: active ? "rgba(139,92,246,0.14)" : "rgba(255,255,255,0.04)",
                    border: active ? "1px solid rgba(139,92,246,0.30)" : "1px solid rgba(255,255,255,0.07)",
                    color: active ? "#A78BFA" : "#6B7A9B", fontSize: "0.75rem", fontWeight: 500, textTransform: "capitalize",
                  }}>
                  {v}
                </button>
              );
            })}
          </div>
        </FilterSection>

        <FilterSection label="Tags">
          {BUILTIN_TAGS.map((tag) => {
            const active = filters.tags.includes(tag);
            return (
              <FilterBtn
                key={tag}
                active={active}
                dot={BUILTIN_TAG_COLORS[tag]}
                onClick={() => toggleTagFilter(tag)}
              >
                {tag}
              </FilterBtn>
            );
          })}

          {customTagOptions.length > 0 && (
            <div style={{ margin: "4px 0 2px", height: 1, background: "rgba(255,255,255,0.05)" }} />
          )}
          {customTagOptions.map((tag) => {
            const active = filters.tags.includes(tag);
            return (
              <div key={tag} style={{ display: "flex", alignItems: "center", gap: 2 }}>
                <FilterBtn
                  active={active}
                  dot="#A78BFA"
                  onClick={() => toggleTagFilter(tag)}
                  style={{ flex: 1 }}
                >
                  {tag}
                </FilterBtn>
                <button
                  onClick={() => handleRemoveCustomTag(tag)}
                  title="Remove tag"
                  style={{
                    flexShrink: 0, width: 18, height: 18, borderRadius: 4,
                    background: "none", border: "none", cursor: "pointer",
                    color: "#2D3650", display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "color 120ms",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "#F87171")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "#2D3650")}
                >
                  <X size={9} />
                </button>
              </div>
            );
          })}

          {showTagInput ? (
            <div style={{ marginTop: 4, display: "flex", gap: 4 }}>
              <input
                ref={inputRef}
                autoFocus
                value={newTagInput}
                onChange={(e) => setNewTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddTag();
                  if (e.key === "Escape") { setShowTagInput(false); setNewTagInput(""); }
                }}
                placeholder="tag-name"
                style={{
                  flex: 1, height: 26, borderRadius: 6, fontSize: "0.6875rem",
                  background: "rgba(255,255,255,0.07)", border: "1px solid rgba(139,92,246,0.35)",
                  color: "#D4D8E8", padding: "0 7px", outline: "none",
                }}
              />
              <button
                onClick={handleAddTag}
                disabled={!newTagInput.trim()}
                style={{
                  height: 26, width: 26, borderRadius: 6, flexShrink: 0,
                  background: "rgba(139,92,246,0.20)", border: "1px solid rgba(139,92,246,0.35)",
                  color: "#A78BFA", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                  opacity: newTagInput.trim() ? 1 : 0.4,
                }}
              >
                <Plus size={11} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => { setShowTagInput(true); setTimeout(() => inputRef.current?.focus(), 50); }}
              style={{
                marginTop: 4, display: "flex", alignItems: "center", gap: 5,
                padding: "4px 8px", borderRadius: 6, cursor: "pointer",
                background: "none", border: "1px dashed rgba(255,255,255,0.08)",
                color: "#3A4560", fontSize: "0.6875rem",
                transition: "all 140ms", width: "100%",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "rgba(139,92,246,0.30)";
                e.currentTarget.style.color = "#7C6DB5";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
                e.currentTarget.style.color = "#3A4560";
              }}
            >
              <Tag size={9} /> <Plus size={8} /> New tag
            </button>
          )}
        </FilterSection>

        {languages.length > 0 && (
          <FilterSection label="Language">
            <select
              value={filters.language ?? ""}
              onChange={(e) => setFilter("language", e.target.value || null)}
              style={{
                width: "100%", height: 32, borderRadius: 8, cursor: "pointer",
                background: "rgba(255,255,255,0.06)", border: "1px solid transparent",
                color: "#8991A4", fontSize: "0.75rem", padding: "0 8px", outline: "none",
                appearance: "none",
              }}
            >
              <option value="">All languages</option>
              {languages.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </FilterSection>
        )}

        {presets.length > 0 && (
          <FilterSection label="Saved Presets">
            {presets.map((preset) => (
              <div key={preset.id} style={{ display: "flex", alignItems: "center", gap: 3 }}>
                <button
                  onClick={() => setFilters(preset.filters)}
                  style={{
                    flex: 1, display: "flex", alignItems: "center", gap: 6,
                    padding: "5px 8px", borderRadius: 7, cursor: "pointer",
                    background: "transparent", border: "none", transition: "all 130ms",
                    color: "#6B7A9B", fontSize: "0.75rem", fontWeight: 400, textAlign: "left",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.color = "#C8CDD8"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#6B7A9B"; }}
                >
                  <BookmarkCheck size={10} style={{ flexShrink: 0, color: "#A78BFA" }} />
                  <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{preset.name}</span>
                </button>
                <button
                  onClick={() => deletePreset(preset.id)}
                  style={{ flexShrink: 0, width: 18, height: 18, borderRadius: 4, background: "none", border: "none", cursor: "pointer", color: "#2D3650", display: "flex", alignItems: "center", justifyContent: "center", transition: "color 120ms" }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "#F87171")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "#2D3650")}
                >
                  <X size={9} />
                </button>
              </div>
            ))}
          </FilterSection>
        )}

        <FilterSection label="Presets">
          {showSaveInput ? (
            <div style={{ marginTop: 2, display: "flex", gap: 4 }}>
              <input
                autoFocus
                value={savePresetInput}
                onChange={(e) => setSavePresetInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleSavePreset(); if (e.key === "Escape") setShowSaveInput(false); }}
                placeholder="Preset name"
                style={{
                  flex: 1, height: 26, borderRadius: 6, fontSize: "0.6875rem",
                  background: "rgba(255,255,255,0.07)", border: "1px solid rgba(139,92,246,0.35)",
                  color: "#D4D8E8", padding: "0 7px", outline: "none",
                }}
              />
              <button
                onClick={handleSavePreset}
                disabled={!savePresetInput.trim()}
                style={{ height: 26, width: 26, borderRadius: 6, flexShrink: 0, background: "rgba(139,92,246,0.20)", border: "1px solid rgba(139,92,246,0.35)", color: "#A78BFA", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", opacity: savePresetInput.trim() ? 1 : 0.4 }}
              >
                <Plus size={11} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowSaveInput(true)}
              style={{
                marginTop: 2, display: "flex", alignItems: "center", gap: 5,
                padding: "4px 8px", borderRadius: 6, cursor: "pointer",
                background: "none", border: "1px dashed rgba(255,255,255,0.08)",
                color: "#3A4560", fontSize: "0.6875rem", transition: "all 140ms", width: "100%",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(139,92,246,0.30)"; e.currentTarget.style.color = "#7C6DB5"; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "#3A4560"; }}
            >
              <Bookmark size={9} /> <Plus size={8} /> Save current filters
            </button>
          )}
        </FilterSection>

        <FilterSection label="Type">
          {([
            { key: "isFork" as const, label: "Forks only" },
            { key: "isTemplate" as const, label: "Templates" },
            { key: "hasOpenIssues" as const, label: "Has open issues" },
          ]).map(({ key, label }) => {
            const active = filters[key] === true;
            return (
              <button key={key}
                onClick={() => setFilter(key, active ? null : true)}
                style={{
                  width: "100%", display: "flex", alignItems: "center", gap: 8,
                  padding: "5px 8px", borderRadius: 7, cursor: "pointer",
                  background: active ? "rgba(255,255,255,0.06)" : "transparent",
                  border: "none", fontSize: "0.75rem", fontWeight: 400, transition: "all 130ms",
                  color: active ? "#D4D8E8" : "#6B7A9B",
                }}
                onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
                onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = "transparent"; }}
              >
                <span style={{
                  width: 14, height: 14, borderRadius: 4, flexShrink: 0,
                  background: active ? "#8B5CF6" : "transparent",
                  border: active ? "1px solid #8B5CF6" : "1px solid rgba(255,255,255,0.18)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "all 130ms",
                }}>
                  {active && <span style={{ fontSize: 8, fontWeight: 700, color: "#fff" }}>✓</span>}
                </span>
                {label}
              </button>
            );
          })}
        </FilterSection>

      </div>
    </div>
  );
};

const FilterSection: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <p style={{
      fontSize: "0.5625rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase",
      color: "#2D3650", marginBottom: 6, paddingLeft: 4,
    }}>
      {label}
    </p>
    <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
      {children}
    </div>
  </div>
);

const FilterBtn: React.FC<{
  active: boolean; dot: string; onClick: () => void; children: React.ReactNode; style?: React.CSSProperties;
}> = ({ active, dot, onClick, children, style }) => (
  <button
    onClick={onClick}
    style={{
      display: "flex", alignItems: "center", gap: 7,
      padding: "5px 8px", borderRadius: 7, cursor: "pointer", width: "100%",
      background: active ? "rgba(255,255,255,0.07)" : "transparent",
      border: "none", transition: "all 130ms",
      color: active ? "#D4D8E8" : "#6B7A9B", fontSize: "0.75rem", fontWeight: 400,
      ...style,
    }}
    onMouseEnter={(e) => { if (!active) { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.color = "#C8CDD8"; }}}
    onMouseLeave={(e) => { if (!active) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#6B7A9B"; }}}
  >
    <span style={{ width: 7, height: 7, borderRadius: "50%", background: dot, flexShrink: 0 }} />
    <span style={{ flex: 1, textAlign: "left", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
      {children}
    </span>
    {active && <X size={9} style={{ color: "#4A5580", flexShrink: 0 }} />}
  </button>
);
