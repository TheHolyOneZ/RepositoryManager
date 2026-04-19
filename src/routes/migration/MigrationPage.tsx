import React, { useState, useMemo } from "react";
import {
  ArrowRightLeft, Search, X, GitFork, ChevronRight,
  Trash2, Plus, AlertCircle, CheckCircle2, ArrowRight,
  Users, Eye, EyeOff, Pencil, Send,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useRepoStore } from "../../stores/repoStore";
import { useUIStore } from "../../stores/uiStore";
import type { Repo } from "../../types/repo";
import type { QueueItemInput } from "../../types/queue";


type MigrationOp = "transfer" | "rename" | "visibility";

interface MigrationEntry {
  id: string;
  repo: Repo;
  op: MigrationOp;

  newOwner?: string;

  newName?: string;

  makePrivate?: boolean;
}


const OP_CONFIG: Record<MigrationOp, { label: string; color: string; icon: React.ReactNode; description: string }> = {
  transfer:   { label: "Transfer",         color: "#F59E0B", icon: <Send size={13} />,   description: "Move to a different owner or org" },
  rename:     { label: "Rename",           color: "#8B5CF6", icon: <Pencil size={13} />, description: "Change the repository name" },
  visibility: { label: "Toggle visibility", color: "#3B82F6", icon: <Eye size={13} />,   description: "Switch between public and private" },
};


interface RepoPickerProps {
  repos: Repo[];
  picked: Set<string>;
  onToggle: (repo: Repo) => void;
}

const RepoPicker: React.FC<RepoPickerProps> = ({ repos, picked, onToggle }) => {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return repos.slice(0, 60);
    const q = search.toLowerCase();
    return repos.filter((r) => r.name.toLowerCase().includes(q) || r.full_name.toLowerCase().includes(q)).slice(0, 40);
  }, [repos, search]);

  return (
    <div style={{
      borderRadius: 12, overflow: "hidden",
      border: "1px solid rgba(255,255,255,0.09)",
      background: "rgba(255,255,255,0.02)",
    }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "10px 14px", borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}>
        <Search size={13} style={{ color: "#4A5580", flexShrink: 0 }} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter repositories…"
          style={{
            flex: 1, background: "transparent", border: "none", outline: "none",
            color: "#D4D8E8", fontSize: "0.8125rem",
          }}
        />
        {search && (
          <button type="button" onClick={() => setSearch("")} style={{ background: "none", border: "none", cursor: "pointer", color: "#4A5580" }}>
            <X size={12} />
          </button>
        )}
      </div>

      <div style={{ maxHeight: 240, overflowY: "auto" }}>
        {filtered.map((repo) => {
          const isPicked = picked.has(repo.id);
          return (
            <button
              key={repo.id}
              type="button"
              onClick={() => onToggle(repo)}
              style={{
                width: "100%", display: "flex", alignItems: "center", gap: 10,
                padding: "8px 14px", background: isPicked ? "rgba(139,92,246,0.08)" : "transparent",
                border: "none", cursor: "pointer", textAlign: "left",
                borderBottom: "1px solid rgba(255,255,255,0.03)",
                transition: "background 100ms",
              }}
              onMouseEnter={(e) => { if (!isPicked) (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.03)"; }}
              onMouseLeave={(e) => { if (!isPicked) (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
            >
              <div style={{
                width: 16, height: 16, borderRadius: 4, flexShrink: 0,
                background: isPicked ? "linear-gradient(135deg, #8B5CF6, #7C3AED)" : "rgba(255,255,255,0.06)",
                border: isPicked ? "none" : "1px solid rgba(255,255,255,0.10)",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all 120ms",
              }}>
                {isPicked && <CheckCircle2 size={10} style={{ color: "#fff" }} />}
              </div>
              <span style={{
                fontFamily: "'Cascadia Code','Consolas',monospace",
                fontSize: "0.75rem", color: isPicked ? "#C4B5FD" : "#8991A4",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {repo.name}
              </span>
              <span style={{ fontSize: "0.6875rem", color: "#3A4560", marginLeft: "auto" }}>
                {repo.private ? "private" : "public"}
              </span>
            </button>
          );
        })}
        {filtered.length === 0 && (
          <div style={{ padding: "20px", textAlign: "center", color: "#3A4560", fontSize: "0.75rem" }}>
            No repos match "{search}"
          </div>
        )}
      </div>
    </div>
  );
};


interface EntryRowProps {
  entry: MigrationEntry;
  onChange: (updated: MigrationEntry) => void;
  onRemove: () => void;
}

const EntryRow: React.FC<EntryRowProps> = ({ entry, onChange, onRemove }) => {
  const cfg = OP_CONFIG[entry.op];

  const isValid =
    (entry.op === "transfer"   && !!entry.newOwner?.trim()) ||
    (entry.op === "rename"     && !!entry.newName?.trim() && entry.newName !== entry.repo.name) ||
    (entry.op === "visibility");

  const inputStyle: React.CSSProperties = {
    height: 30, borderRadius: 7, padding: "0 10px",
    backgroundColor: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.10)",
    color: "#D4D8E8", fontSize: "0.75rem", outline: "none",
    transition: "border-color 140ms",
  };

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "10px 14px", borderRadius: 10,
      background: isValid ? "rgba(255,255,255,0.025)" : "rgba(255,255,255,0.015)",
      border: `1px solid ${isValid ? "rgba(139,92,246,0.18)" : "rgba(255,255,255,0.07)"}`,
      transition: "all 140ms",
    }}>
      <div style={{
        width: 7, height: 7, borderRadius: "50%", flexShrink: 0,
        background: isValid ? "#10B981" : "#3A4560",
        boxShadow: isValid ? "0 0 6px rgba(16,185,129,0.5)" : "none",
        transition: "all 200ms",
      }} />

      <span style={{
        fontFamily: "'Cascadia Code','Consolas',monospace",
        fontSize: "0.75rem", color: "#A78BFA", flexShrink: 0, width: 160,
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>
        {entry.repo.full_name}
      </span>

      <select
        value={entry.op}
        onChange={(e) => onChange({ ...entry, op: e.target.value as MigrationOp, newOwner: "", newName: "" })}
        style={{ ...inputStyle, width: 130, cursor: "pointer", flexShrink: 0 }}
      >
        {(Object.keys(OP_CONFIG) as MigrationOp[]).map((k) => (
          <option key={k} value={k} style={{ background: "#0D1025" }}>{OP_CONFIG[k].label}</option>
        ))}
      </select>

      <ChevronRight size={12} style={{ color: "#3A4560", flexShrink: 0 }} />

      {entry.op === "transfer" && (
        <input
          value={entry.newOwner ?? ""}
          onChange={(e) => onChange({ ...entry, newOwner: e.target.value })}
          placeholder="new-owner or org"
          style={{ ...inputStyle, flex: 1 }}
          onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(139,92,246,0.45)"; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.10)"; }}
        />
      )}
      {entry.op === "rename" && (
        <input
          value={entry.newName ?? ""}
          onChange={(e) => onChange({ ...entry, newName: e.target.value })}
          placeholder={`new name (was: ${entry.repo.name})`}
          style={{ ...inputStyle, flex: 1 }}
          onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(139,92,246,0.45)"; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.10)"; }}
        />
      )}
      {entry.op === "visibility" && (
        <button
          type="button"
          onClick={() => onChange({ ...entry, makePrivate: !entry.makePrivate })}
          style={{
            flex: 1, height: 30, borderRadius: 7, cursor: "pointer",
            display: "flex", alignItems: "center", gap: 6,
            background: entry.makePrivate ? "rgba(239,68,68,0.10)" : "rgba(59,130,246,0.10)",
            border: `1px solid ${entry.makePrivate ? "rgba(239,68,68,0.25)" : "rgba(59,130,246,0.25)"}`,
            color: entry.makePrivate ? "#F87171" : "#60A5FA",
            fontSize: "0.75rem", fontWeight: 600, transition: "all 140ms",
          }}
        >
          {entry.makePrivate ? <><EyeOff size={11} /> Make private</> : <><Eye size={11} /> Make public</>}
        </button>
      )}

      <button
        type="button"
        onClick={onRemove}
        style={{
          width: 26, height: 26, borderRadius: 6, cursor: "pointer", flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "transparent", border: "1px solid rgba(255,255,255,0.07)",
          color: "#3A4560", transition: "all 120ms",
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(239,68,68,0.12)"; (e.currentTarget as HTMLButtonElement).style.color = "#F87171"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = "#3A4560"; }}
      >
        <Trash2 size={11} />
      </button>
    </div>
  );
};


export const MigrationPage: React.FC = () => {
  const repos     = useRepoStore((s) => s.repos);
  const openModal = useUIStore((s) => s.openModal);

  const [entries, setEntries]     = useState<MigrationEntry[]>([]);
  const [pickedIds, setPickedIds] = useState<Set<string>>(new Set());
  const [defaultOp, setDefaultOp] = useState<MigrationOp>("transfer");
  const [showPicker, setShowPicker] = useState(true);

  const toggleRepo = (repo: Repo) => {
    setPickedIds((prev) => {
      const next = new Set(prev);
      if (next.has(repo.id)) {
        next.delete(repo.id);
        setEntries((e) => e.filter((en) => en.repo.id !== repo.id));
      } else {
        next.add(repo.id);
        setEntries((e) => [...e, {
          id: `me_${repo.id}`,
          repo,
          op: defaultOp,
          makePrivate: !repo.private,
        }]);
      }
      return next;
    });
  };

  const updateEntry = (id: string, updated: MigrationEntry) => {
    setEntries((prev) => prev.map((e) => e.id === id ? updated : e));
  };

  const removeEntry = (id: string) => {
    const entry = entries.find((e) => e.id === id);
    if (entry) setPickedIds((prev) => { const n = new Set(prev); n.delete(entry.repo.id); return n; });
    setEntries((prev) => prev.filter((e) => e.id !== id));
  };

  const validEntries = useMemo(() => entries.filter((e) => {
    if (e.op === "transfer")   return !!e.newOwner?.trim();
    if (e.op === "rename")     return !!e.newName?.trim() && e.newName !== e.repo.name;
    if (e.op === "visibility") return true;
    return false;
  }), [entries]);

  const queueAll = () => {
    if (validEntries.length === 0) return;
    const items: QueueItemInput[] = validEntries.map((e) => {
      if (e.op === "transfer") {
        return { repo_id: e.repo.id, repo_name: e.repo.name, repo_full_name: e.repo.full_name, action: "transfer" as const, payload: { new_owner: e.newOwner } };
      }
      if (e.op === "rename") {
        return { repo_id: e.repo.id, repo_name: e.repo.name, repo_full_name: e.repo.full_name, action: "rename" as const, payload: { new_name: e.newName } };
      }
      return {
        repo_id: e.repo.id, repo_name: e.repo.name, repo_full_name: e.repo.full_name,
        action: e.makePrivate ? "set_private" as const : "set_public" as const,
        payload: {},
      };
    });
    openModal("confirm-queue", { items, action: items[0]?.action ?? "rename" });
  };

  return (
    <div style={{ height: "100%", overflowY: "auto" }}>
      <div style={{
        padding: "20px 24px 16px",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        background: "rgba(255,255,255,0.01)",
        display: "flex", alignItems: "flex-start", justifyContent: "space-between",
      }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 9,
              background: "rgba(139,92,246,0.15)", border: "1px solid rgba(139,92,246,0.25)",
              display: "flex", alignItems: "center", justifyContent: "center", color: "#A78BFA",
            }}>
              <ArrowRightLeft size={15} />
            </div>
            <div>
              <p style={{ fontSize: "0.5rem", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#3A4560" }}>
                Operations
              </p>
              <h1 style={{ fontSize: "1.0625rem", fontWeight: 800, color: "#D4D8E8", letterSpacing: "-0.03em", lineHeight: 1 }}>
                Migration
              </h1>
            </div>
          </div>
          <p style={{ fontSize: "0.75rem", color: "#3A4560", marginTop: 6 }}>
            Batch transfer, rename, or change visibility — everything queues through the confirmation modal.
          </p>
        </div>

        {entries.length > 0 && (
          <button
            type="button"
            onClick={queueAll}
            disabled={validEntries.length === 0}
            style={{
              height: 34, padding: "0 16px", borderRadius: 9, cursor: validEntries.length > 0 ? "pointer" : "not-allowed",
              display: "flex", alignItems: "center", gap: 6, flexShrink: 0,
              background: validEntries.length > 0
                ? "linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)"
                : "rgba(139,92,246,0.08)",
              border: "none", color: validEntries.length > 0 ? "#fff" : "#4A5580",
              fontSize: "0.8125rem", fontWeight: 600,
              boxShadow: validEntries.length > 0 ? "0 4px 14px rgba(139,92,246,0.30)" : "none",
              transition: "all 150ms",
            }}
          >
            <ArrowRight size={13} /> Queue {validEntries.length} operation{validEntries.length !== 1 ? "s" : ""}
          </button>
        )}
      </div>

      <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: 20 }}>

        <section>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{
                width: 22, height: 22, borderRadius: 6,
                background: "rgba(139,92,246,0.15)", border: "1px solid rgba(139,92,246,0.25)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "0.625rem", fontWeight: 800, color: "#A78BFA",
              }}>1</div>
              <p style={{ fontSize: "0.8125rem", fontWeight: 700, color: "#D4D8E8", letterSpacing: "-0.01em" }}>
                Pick repositories
              </p>
              {pickedIds.size > 0 && (
                <span style={{
                  padding: "1px 7px", borderRadius: 6,
                  fontSize: "0.625rem", fontWeight: 800, color: "#A78BFA",
                  background: "rgba(139,92,246,0.14)", border: "1px solid rgba(139,92,246,0.25)",
                }}>
                  {pickedIds.size} selected
                </span>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: "0.6875rem", color: "#3A4560" }}>Default op:</span>
              <select
                value={defaultOp}
                onChange={(e) => setDefaultOp(e.target.value as MigrationOp)}
                style={{
                  height: 28, borderRadius: 7, padding: "0 8px",
                  backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)",
                  color: "#D4D8E8", fontSize: "0.75rem", outline: "none", cursor: "pointer",
                }}
              >
                {(Object.keys(OP_CONFIG) as MigrationOp[]).map((k) => (
                  <option key={k} value={k} style={{ background: "#0D1025" }}>{OP_CONFIG[k].label}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setShowPicker((v) => !v)}
                style={{
                  height: 28, padding: "0 10px", borderRadius: 7, cursor: "pointer",
                  background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)",
                  color: "#6B7A9B", fontSize: "0.75rem", transition: "all 120ms",
                }}
              >
                {showPicker ? "Hide" : "Show"}
              </button>
            </div>
          </div>
          <AnimatePresence>
            {showPicker && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: "hidden" }}>
                <RepoPicker repos={repos} picked={pickedIds} onToggle={toggleRepo} />
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {entries.length > 0 && (
          <section>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <div style={{
                width: 22, height: 22, borderRadius: 6,
                background: "rgba(139,92,246,0.15)", border: "1px solid rgba(139,92,246,0.25)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "0.625rem", fontWeight: 800, color: "#A78BFA",
              }}>2</div>
              <p style={{ fontSize: "0.8125rem", fontWeight: 700, color: "#D4D8E8", letterSpacing: "-0.01em" }}>
                Configure operations
              </p>
              <span style={{ fontSize: "0.6875rem", color: "#3A4560" }}>
                {validEntries.length}/{entries.length} ready
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <AnimatePresence>
                {entries.map((entry) => (
                  <motion.div
                    key={entry.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ duration: 0.15 }}
                  >
                    <EntryRow
                      entry={entry}
                      onChange={(updated) => updateEntry(entry.id, updated)}
                      onRemove={() => removeEntry(entry.id)}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </section>
        )}

        {validEntries.some((e) => e.op === "transfer") && (
          <div style={{
            padding: "12px 16px", borderRadius: 10,
            background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.20)",
            display: "flex", gap: 10, alignItems: "flex-start",
          }}>
            <AlertCircle size={14} style={{ color: "#FBBF24", flexShrink: 0, marginTop: 1 }} />
            <div>
              <p style={{ fontSize: "0.75rem", fontWeight: 600, color: "#FBBF24", marginBottom: 2 }}>Transfer warning</p>
              <p style={{ fontSize: "0.6875rem", color: "#92680C", lineHeight: 1.55 }}>
                Transferring a repository changes its URL. Links, clone URLs, and webhooks pointing to the old URL will break. GitHub sets up redirects for 30 days.
              </p>
            </div>
          </div>
        )}

        {repos.length === 0 && (
          <div style={{
            padding: "40px 24px", borderRadius: 14, textAlign: "center",
            background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.07)",
          }}>
            <GitFork size={28} style={{ margin: "0 auto 12px", color: "#2D3650", display: "block" }} />
            <p style={{ fontSize: "0.875rem", fontWeight: 700, color: "#4A5580", marginBottom: 4 }}>No repositories loaded</p>
            <p style={{ fontSize: "0.75rem", color: "#2D3650" }}>Go to Repositories and load your repos first.</p>
          </div>
        )}

        <section style={{
          borderRadius: 12, padding: "14px 16px",
          background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.06)",
        }}>
          <p style={{ fontSize: "0.6875rem", fontWeight: 700, color: "#3A4560", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>
            Operation guide
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {(Object.entries(OP_CONFIG) as [MigrationOp, typeof OP_CONFIG[MigrationOp]][]).map(([key, cfg]) => (
              <div key={key} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <span style={{
                  flexShrink: 0, padding: "2px 8px", borderRadius: 5,
                  fontSize: "0.625rem", fontWeight: 700,
                  color: cfg.color, background: `${cfg.color}14`, border: `1px solid ${cfg.color}28`,
                }}>
                  {cfg.label}
                </span>
                <span style={{ fontSize: "0.6875rem", color: "#4A5580", lineHeight: 1.55 }}>{cfg.description}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};
