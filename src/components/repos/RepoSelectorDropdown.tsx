import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Search } from "lucide-react";
import { motion } from "framer-motion";
import type { Repo } from "../../types/repo";

interface RepoSelectorDropdownProps {
  repos: Repo[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  placeholder?: string;
  accentColor?: string;
  accentBg?: string;
}

export const RepoSelectorDropdown: React.FC<RepoSelectorDropdownProps> = ({
  repos, selectedId, onSelect,
  placeholder = "Select repository…",
  accentColor = "#C4B5FD",
  accentBg = "rgba(139,92,246,0.10)",
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [pos, setPos] = useState<{ top: number; left: number; minWidth: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const selected = repos.find((r) => r.id === selectedId);
  const filtered = search ? repos.filter((r) => r.name.toLowerCase().includes(search.toLowerCase())) : repos;

  const handleOpen = () => {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 6, left: rect.left, minWidth: Math.max(rect.width, 240) });
    }
    setOpen((v) => !v);
  };


  useEffect(() => {
    if (!open) return;
    const update = () => {
      if (btnRef.current) {
        const rect = btnRef.current.getBoundingClientRect();
        setPos({ top: rect.bottom + 6, left: rect.left, minWidth: Math.max(rect.width, 240) });
      }
    };
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => { window.removeEventListener("scroll", update, true); window.removeEventListener("resize", update); };
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        onClick={handleOpen}
        style={{
          display: "flex", alignItems: "center", gap: 7,
          height: 32, padding: "0 12px", borderRadius: 8, cursor: "pointer",
          background: selectedId ? accentBg : "rgba(255,255,255,0.05)",
          border: selectedId ? `1px solid ${accentColor}40` : "1px solid rgba(255,255,255,0.09)",
          color: selectedId ? accentColor : "#6B7A9B",
          fontSize: "0.8125rem", fontWeight: selectedId ? 600 : 400,
          maxWidth: 240, transition: "all 140ms",
        }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
          {selected ? selected.name : placeholder}
        </span>
        <ChevronDown size={11} style={{ flexShrink: 0, color: "#4A5580" }} />
      </button>

      {open && pos && createPortal(
        <>
          {}
          <div
            style={{ position: "fixed", inset: 0, zIndex: 9998 }}
            onClick={() => { setOpen(false); setSearch(""); }}
          />
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.13 }}
            style={{
              position: "fixed", top: pos.top, left: pos.left, minWidth: pos.minWidth,
              zIndex: 9999, borderRadius: 10,
              background: "rgba(10,12,26,0.97)",
              border: "1px solid rgba(255,255,255,0.13)",
              boxShadow: "0 20px 60px rgba(0,0,0,0.65)",
            }}
          >
              <div style={{ padding: "8px 8px 5px" }}>
                <div style={{ position: "relative" }}>
                  <Search size={11} style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", color: "#3A4560", pointerEvents: "none" }} />
                  <input
                    autoFocus
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search repos…"
                    style={{
                      width: "100%", height: 28, borderRadius: 6, paddingLeft: 26, paddingRight: 8,
                      background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)",
                      color: "#C8CDD8", fontSize: "0.75rem", outline: "none",
                    }}
                  />
                </div>
              </div>
              <div style={{ maxHeight: 260, overflowY: "auto", padding: "2px 6px 6px" }}>
                {filtered.map((repo) => (
                  <button
                    key={repo.id}
                    onClick={() => { onSelect(repo.id === selectedId ? null : repo.id); setOpen(false); setSearch(""); }}
                    style={{
                      width: "100%", display: "flex", alignItems: "center", padding: "7px 9px",
                      borderRadius: 7, cursor: "pointer", textAlign: "left",
                      background: repo.id === selectedId ? accentBg : "transparent",
                      border: repo.id === selectedId ? `1px solid ${accentColor}35` : "1px solid transparent",
                      color: repo.id === selectedId ? accentColor : "#8991A4",
                      fontSize: "0.8125rem", fontWeight: 500,
                    }}
                    onMouseEnter={(e) => { if (repo.id !== selectedId) e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
                    onMouseLeave={(e) => { if (repo.id !== selectedId) e.currentTarget.style.background = "transparent"; }}
                  >
                    {repo.name}
                  </button>
                ))}
                {filtered.length === 0 && (
                  <p style={{ padding: "14px 8px", textAlign: "center", fontSize: "0.75rem", color: "#2D3650" }}>No repos match</p>
                )}
              </div>
            </motion.div>
          </>,
          document.body
        )}
    </>
  );
};
