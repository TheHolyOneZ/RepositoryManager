import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  Search, GitFork, Zap, LayoutDashboard, Lightbulb, Settings,
  X, Bell, RefreshCw, MousePointer2, Eye, EyeOff,
  Tag, Archive, Trash2, ArrowRight,
  CornerDownLeft,
} from "lucide-react";
import { useUIStore } from "../../stores/uiStore";
import { useRepoStore } from "../../stores/repoStore";
import { useSelectionStore } from "../../stores/selectionStore";
import { useNavigate } from "react-router-dom";
import Fuse from "fuse.js";


type CommandCategory = "navigation" | "repos" | "actions" | "selection";

interface Command {
  id: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  iconBg?: string;
  category: CommandCategory;
  action: () => void;
  keywords?: string[];
  badge?: string;
}


const CATEGORY_META: Record<CommandCategory, { label: string; order: number }> = {
  navigation: { label: "Navigation", order: 0 },
  actions:    { label: "Actions",    order: 1 },
  selection:  { label: "Selection",  order: 2 },
  repos:      { label: "Repositories", order: 3 },
};


export const CommandPalette: React.FC = () => {
  const isOpen           = useUIStore((s) => s.isCommandPaletteOpen);
  const close            = useUIStore((s) => s.closeCommandPalette);
  const openSlideOver    = useUIStore((s) => s.openSlideOver);
  const openNotif        = useUIStore((s) => s.openSlideOver);
  const isDryRunMode     = useUIStore((s) => s.isDryRunMode);
  const setDryRunMode    = useUIStore((s) => s.setDryRunMode);
  const triggerRefresh   = useUIStore((s) => s.triggerRepoRefresh);
  const addToast         = useUIStore((s) => s.addToast);

  const repos            = useRepoStore((s) => s.repos);
  const selectedIds      = useSelectionStore((s) => s.selectedIds);
  const deselectAll      = useSelectionStore((s) => s.deselectAll);
  const selectAll        = useSelectionStore((s) => s.selectAll);

  const navigate         = useNavigate();
  const [query, setQuery]     = useState("");
  const [selected, setSelected] = useState(0);

  const inputRef  = useRef<HTMLInputElement>(null);
  const listRef   = useRef<HTMLDivElement>(null);
  const itemRefs  = useRef<(HTMLButtonElement | null)[]>([]);


  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelected(0);
      setTimeout(() => inputRef.current?.focus(), 40);
    }
  }, [isOpen]);


  const allCommands: Command[] = useMemo(() => {
    const go = (path: string) => { navigate(path); close(); };

    const nav: Command[] = [
      { id: "nav-repos",       label: "Repositories",  description: "Browse and manage your GitHub repos",  icon: <GitFork size={15} />,      iconBg: "#1a1f35", category: "navigation", action: () => go("/repos"),       keywords: ["repos", "browse"] },
      { id: "nav-queue",       label: "Queue",          description: "View operation queue and history",     icon: <Zap size={15} />,          iconBg: "#1a1f35", category: "navigation", action: () => go("/queue"),       keywords: ["queue", "operations"] },
      { id: "nav-analytics",   label: "Analytics",      description: "Repo stats, growth, language data",   icon: <LayoutDashboard size={15} />, iconBg: "#1a1f35", category: "navigation", action: () => go("/analytics"),  keywords: ["analytics", "stats"] },
      { id: "nav-suggestions", label: "Suggestions",    description: "Cleanup suggestions for your repos",  icon: <Lightbulb size={15} />,    iconBg: "#1a1f35", category: "navigation", action: () => go("/suggestions"), keywords: ["suggestions", "cleanup"] },
      { id: "nav-settings",    label: "Settings",       description: "Configure accounts, tags, shortcuts", icon: <Settings size={15} />,     iconBg: "#1a1f35", category: "navigation", action: () => go("/settings"),    keywords: ["settings", "config"] },
    ];

    const actions: Command[] = [
      {
        id: "action-dryrun",
        label: isDryRunMode ? "Disable Dry Run Mode" : "Enable Dry Run Mode",
        description: isDryRunMode ? "Operations will execute for real" : "Preview operations without executing",
        icon: isDryRunMode ? <Eye size={15} /> : <EyeOff size={15} />,
        iconBg: isDryRunMode ? "#2a1f10" : "#161a28",
        category: "actions",
        badge: isDryRunMode ? "ON" : undefined,
        action: () => {
          setDryRunMode(!isDryRunMode);
          addToast({ type: "info", title: isDryRunMode ? "Dry run disabled" : "Dry run enabled", duration: 2500 });
          close();
        },
        keywords: ["dry run", "preview", "simulate"],
      },
      {
        id: "action-notifications",
        label: "Notifications",
        description: "Open notification center",
        icon: <Bell size={15} />,
        iconBg: "#1a1f35",
        category: "actions",
        action: () => { openNotif("notifications"); close(); },
        keywords: ["notifications", "alerts"],
      },
      {
        id: "action-refresh",
        label: "Refresh Repositories",
        description: "Force-fetch latest repo data from GitHub",
        icon: <RefreshCw size={15} />,
        iconBg: "#1a1f35",
        category: "actions",
        action: () => { triggerRefresh(); addToast({ type: "success", title: "Refreshing repositories…", duration: 2500 }); close(); },
        keywords: ["refresh", "sync", "fetch"],
      },
    ];

    const selectionCmds: Command[] = [];
    if (selectedIds.size > 0) {
      selectionCmds.push({
        id: "sel-clear",
        label: "Clear Selection",
        description: `Deselect all ${selectedIds.size} selected repos`,
        icon: <MousePointer2 size={15} />,
        iconBg: "#1a1f35",
        category: "selection",
        action: () => { deselectAll(); close(); },
        keywords: ["deselect", "clear"],
      });
    }
    if (repos.length > 0) {
      selectionCmds.push({
        id: "sel-all",
        label: "Select All Repositories",
        description: `Select all ${repos.length} repos`,
        icon: <MousePointer2 size={15} />,
        iconBg: "#1a1f35",
        category: "selection",
        action: () => { selectAll(repos.map((r) => r.id)); navigate("/repos"); close(); },
        keywords: ["select all"],
      });
    }

    const repoCmds: Command[] = repos.slice(0, 80).map((r) => ({
      id: `repo-${r.id}`,
      label: r.name,
      description: r.description ?? r.full_name,
      icon: <GitFork size={14} />,
      iconBg: "#111420",
      category: "repos" as CommandCategory,
      action: () => {
        navigate("/repos");
        setTimeout(() => openSlideOver("repo-detail", r), 80);
        close();
      },
      keywords: [r.full_name, r.description ?? ""],
    }));

    return [...nav, ...actions, ...selectionCmds, ...repoCmds];
  }, [repos, navigate, close, isDryRunMode, setDryRunMode, addToast, selectedIds, deselectAll, selectAll, openSlideOver, openNotif, triggerRefresh]);


  const grouped = useMemo(() => {
    let results: Command[];
    if (!query.trim()) {

      results = allCommands.filter((c) => c.category !== "repos").slice(0, 12);
    } else {
      const fuse = new Fuse(allCommands, {
        keys: ["label", "description", "keywords"],
        threshold: 0.38,
        includeScore: true,
      });
      results = fuse.search(query).slice(0, 14).map((r) => r.item);
    }


    const byCategory = new Map<CommandCategory, Command[]>();
    for (const cmd of results) {
      if (!byCategory.has(cmd.category)) byCategory.set(cmd.category, []);
      byCategory.get(cmd.category)!.push(cmd);
    }


    const sorted = [...byCategory.entries()].sort(
      ([a], [b]) => CATEGORY_META[a].order - CATEGORY_META[b].order
    );

    return sorted;
  }, [query, allCommands]);


  const flatList = useMemo(() => grouped.flatMap(([, cmds]) => cmds), [grouped]);


  useEffect(() => {
    const el = itemRefs.current[selected];
    if (el) el.scrollIntoView({ block: "nearest" });
  }, [selected]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelected((s) => Math.min(s + 1, flatList.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelected((s) => Math.max(s - 1, 0));
    } else if (e.key === "Enter" && flatList[selected]) {
      flatList[selected].action();
    } else if (e.key === "Escape") {
      close();
    }
  };


  let globalIndex = 0;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 300,
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "center",
            paddingTop: "14vh",
            paddingLeft: 16,
            paddingRight: 16,
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.1 }}
        >
          <motion.div
            onClick={close}
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(4,5,12,0.82)",
              backdropFilter: "blur(6px)",
              WebkitBackdropFilter: "blur(6px)",
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          <motion.div
            style={{
              position: "relative",
              zIndex: 10,
              width: "100%",
              maxWidth: 580,
              background: "linear-gradient(145deg, rgba(14,17,32,0.98) 0%, rgba(10,13,26,0.98) 100%)",
              border: "1px solid rgba(139,92,246,0.18)",
              borderRadius: 14,
              overflow: "hidden",
              boxShadow: "0 32px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04), 0 0 60px rgba(139,92,246,0.08)",
            }}
            initial={{ scale: 0.96, opacity: 0, y: -16 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.96, opacity: 0, y: -16 }}
            transition={{ type: "spring", stiffness: 480, damping: 36 }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "14px 16px",
                borderBottom: "1px solid rgba(255,255,255,0.06)",
                background: "rgba(255,255,255,0.02)",
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: "rgba(139,92,246,0.12)",
                  border: "1px solid rgba(139,92,246,0.2)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  color: "#A78BFA",
                }}
              >
                <Search size={15} />
              </div>

              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => { setQuery(e.target.value); setSelected(0); }}
                onKeyDown={handleKeyDown}
                placeholder="Search commands, repos, actions…"
                style={{
                  flex: 1,
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  color: "#E8EAF0",
                  fontSize: "0.9375rem",
                  fontWeight: 500,
                  letterSpacing: "-0.01em",
                }}
              />

              <AnimatePresence>
                {query && (
                  <motion.button
                    initial={{ opacity: 0, scale: 0.7 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.7 }}
                    onClick={() => { setQuery(""); setSelected(0); inputRef.current?.focus(); }}
                    style={{
                      background: "rgba(255,255,255,0.06)",
                      border: "none",
                      borderRadius: 6,
                      width: 22,
                      height: 22,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      color: "#6B7280",
                      flexShrink: 0,
                    }}
                  >
                    <X size={12} />
                  </motion.button>
                )}
              </AnimatePresence>

              <KbdKey>Esc</KbdKey>
            </div>

            <div
              ref={listRef}
              style={{
                maxHeight: 400,
                overflowY: "auto",
                padding: "6px 0",
              }}
            >
              {flatList.length === 0 ? (
                <div
                  style={{
                    padding: "40px 20px",
                    textAlign: "center",
                    color: "#3D4559",
                    fontSize: "0.8125rem",
                  }}
                >
                  <Search size={28} style={{ margin: "0 auto 10px", opacity: 0.3 }} />
                  <p>No results for <span style={{ color: "#6B7280" }}>"{query}"</span></p>
                </div>
              ) : (
                grouped.map(([category, cmds]) => {
                  const meta = CATEGORY_META[category];
                  return (
                    <div key={category}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          padding: "6px 16px 4px",
                          marginTop: 2,
                        }}
                      >
                        <span
                          style={{
                            fontSize: "10px",
                            fontWeight: 600,
                            letterSpacing: "0.08em",
                            textTransform: "uppercase",
                            color: "#3D4559",
                          }}
                        >
                          {meta.label}
                        </span>
                        <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.04)" }} />
                      </div>

                      {cmds.map((cmd) => {
                        const idx = globalIndex++;
                        const isSelected = idx === selected;
                        return (
                          <CommandItem
                            key={cmd.id}
                            cmd={cmd}
                            isSelected={isSelected}
                            ref={(el) => { itemRefs.current[idx] = el; }}
                            onMouseEnter={() => setSelected(idx)}
                            onClick={() => cmd.action()}
                          />
                        );
                      })}
                    </div>
                  );
                })
              )}
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "9px 16px",
                borderTop: "1px solid rgba(255,255,255,0.05)",
                background: "rgba(0,0,0,0.2)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <FooterHint keys={["↑", "↓"]} label="navigate" />
                <FooterHint keys={["↵"]} label="select" />
                <FooterHint keys={["Esc"]} label="close" />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: isDryRunMode ? "#F59E0B" : "#22C55E",
                    boxShadow: isDryRunMode ? "0 0 6px rgba(245,158,11,0.6)" : "0 0 6px rgba(34,197,94,0.6)",
                  }}
                />
                <span style={{ fontSize: 10, color: "#3D4559", letterSpacing: "0.03em" }}>
                  {isDryRunMode ? "Dry run active" : "Live mode"}
                </span>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};


interface CommandItemProps {
  cmd: Command;
  isSelected: boolean;
  onMouseEnter: () => void;
  onClick: () => void;
}

const CommandItem = React.forwardRef<HTMLButtonElement, CommandItemProps>(
  ({ cmd, isSelected, onMouseEnter, onClick }, ref) => {
    return (
      <button
        ref={ref}
        type="button"
        onMouseEnter={onMouseEnter}
        onClick={onClick}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          width: "100%",
          padding: "7px 14px 7px 10px",
          border: "none",
          background: isSelected ? "rgba(139,92,246,0.10)" : "transparent",
          cursor: "pointer",
          position: "relative",
          transition: "background 0.1s",
          textAlign: "left",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 0,
            top: "50%",
            transform: "translateY(-50%)",
            width: 3,
            height: isSelected ? 24 : 0,
            borderRadius: "0 3px 3px 0",
            background: "linear-gradient(180deg, #8B5CF6, #A78BFA)",
            transition: "height 0.15s cubic-bezier(0.34,1.56,0.64,1)",
            boxShadow: "2px 0 8px rgba(139,92,246,0.4)",
          }}
        />

        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: isSelected ? "rgba(139,92,246,0.16)" : (cmd.iconBg ?? "rgba(255,255,255,0.04)"),
            border: `1px solid ${isSelected ? "rgba(139,92,246,0.3)" : "rgba(255,255,255,0.06)"}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            color: isSelected ? "#A78BFA" : "#4A5166",
            transition: "all 0.15s",
          }}
        >
          {cmd.icon}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: "0.8375rem",
              fontWeight: 500,
              color: isSelected ? "#E8EAF0" : "#8991A4",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              transition: "color 0.1s",
              letterSpacing: "-0.01em",
            }}
          >
            {cmd.label}
          </div>
          {cmd.description && (
            <div
              style={{
                fontSize: 11,
                color: isSelected ? "#6B7280" : "#3D4559",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                marginTop: 1,
                transition: "color 0.1s",
              }}
            >
              {cmd.description}
            </div>
          )}
        </div>

        {cmd.badge && (
          <div
            style={{
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: "0.08em",
              color: "#F59E0B",
              background: "rgba(245,158,11,0.12)",
              border: "1px solid rgba(245,158,11,0.25)",
              borderRadius: 4,
              padding: "1px 5px",
              flexShrink: 0,
            }}
          >
            {cmd.badge}
          </div>
        )}

        <div
          style={{
            opacity: isSelected ? 1 : 0,
            transition: "opacity 0.1s",
            color: "#8B5CF6",
            flexShrink: 0,
          }}
        >
          <CornerDownLeft size={13} />
        </div>
      </button>
    );
  }
);
CommandItem.displayName = "CommandItem";


function KbdKey({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(255,255,255,0.05)",
        border: "1px solid rgba(255,255,255,0.09)",
        borderBottom: "2px solid rgba(255,255,255,0.05)",
        borderRadius: 5,
        padding: "2px 7px",
        fontSize: 10,
        color: "#4A5166",
        fontFamily: "monospace",
        flexShrink: 0,
      }}
    >
      {children}
    </div>
  );
}

function FooterHint({ keys, label }: { keys: string[]; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      {keys.map((k) => (
        <KbdKey key={k}>{k}</KbdKey>
      ))}
      <span style={{ fontSize: 10, color: "#3D4559", marginLeft: 2 }}>{label}</span>
    </div>
  );
}
