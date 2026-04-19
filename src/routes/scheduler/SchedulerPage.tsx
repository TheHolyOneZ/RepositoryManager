import React, { useState, useEffect, useMemo } from "react";
import {
  Calendar, Plus, Trash2, Play, Clock, Archive, Trash, EyeOff,
  GitFork, Tag, RefreshCw, ChevronDown, AlertCircle,
  CheckCircle2, ToggleLeft, ToggleRight,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useRepoStore } from "../../stores/repoStore";
import { useUIStore } from "../../stores/uiStore";
import type { QueueAction, QueueItemInput } from "../../types/queue";
import type { Repo } from "../../types/repo";


type ScheduleFreq = "on-launch" | "daily" | "weekly";
type ScheduleFilter = "all" | "dead" | "empty" | "forks" | "no-description" | "stale-12mo";

interface ScheduleEntry {
  id: string;
  label: string;
  action: QueueAction;
  filter: ScheduleFilter;
  freq: ScheduleFreq;
  enabled: boolean;
  lastRunAt: string | null;
  createdAt: string;
}


const STORAGE_KEY = "zrm_schedules";

function loadSchedules(): ScheduleEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ScheduleEntry[]) : [];
  } catch {
    return [];
  }
}

function saveSchedules(entries: ScheduleEntry[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

function isDue(entry: ScheduleEntry): boolean {
  if (!entry.enabled) return false;
  if (!entry.lastRunAt) return true;
  const last = new Date(entry.lastRunAt).getTime();
  const now = Date.now();
  if (entry.freq === "on-launch") return true;
  if (entry.freq === "daily")  return now - last >= 24 * 60 * 60 * 1000;
  if (entry.freq === "weekly") return now - last >= 7 * 24 * 60 * 60 * 1000;
  return false;
}


const FILTER_DEFS: Record<ScheduleFilter, { label: string; description: string; apply: (repos: Repo[]) => Repo[] }> = {
  "all": {
    label: "All repositories",
    description: "Every non-archived repo",
    apply: (repos) => repos.filter((r) => !r.archived),
  },
  "dead": {
    label: "Dead repos",
    description: "Repos with health status = dead",
    apply: (repos) => repos.filter((r) => r.health?.status === "dead"),
  },
  "empty": {
    label: "Empty repos",
    description: "Repos with no content",
    apply: (repos) => repos.filter((r) => r.health?.status === "empty"),
  },
  "forks": {
    label: "Abandoned forks",
    description: "Forks with no stars and no recent activity",
    apply: (repos) => repos.filter((r) => r.fork && r.stars === 0 && r.health?.status !== "active"),
  },
  "no-description": {
    label: "Missing description",
    description: "Active repos without a description",
    apply: (repos) => repos.filter((r) => !r.archived && (!r.description || r.description.trim() === "")),
  },
  "stale-12mo": {
    label: "Stale (12+ months)",
    description: "Repos not pushed to in over 12 months",
    apply: (repos) => {
      const cutoff = Date.now() - 12 * 30 * 24 * 60 * 60 * 1000;
      return repos.filter((r) => {
        if (r.archived) return false;
        if (!r.pushed_at) return true;
        return new Date(r.pushed_at).getTime() < cutoff;
      });
    },
  },
};


const ACTION_OPTS: { value: QueueAction; label: string; color: string; icon: React.ReactNode }[] = [
  { value: "archive",    label: "Archive",     color: "#F59E0B", icon: <Archive size={13} /> },
  { value: "delete",     label: "Delete",      color: "#EF4444", icon: <Trash size={13} /> },
  { value: "set_private", label: "Make private", color: "#8B5CF6", icon: <EyeOff size={13} /> },
];

const FREQ_OPTS: { value: ScheduleFreq; label: string; icon: React.ReactNode }[] = [
  { value: "on-launch", label: "Every launch",  icon: <Play size={12} /> },
  { value: "daily",     label: "Daily",         icon: <Clock size={12} /> },
  { value: "weekly",    label: "Weekly",        icon: <Calendar size={12} /> },
];


interface CreateFormProps {
  repos: Repo[];
  onSave: (entry: Omit<ScheduleEntry, "id" | "createdAt" | "lastRunAt">) => void;
  onCancel: () => void;
}

const CreateForm: React.FC<CreateFormProps> = ({ repos, onSave, onCancel }) => {
  const [label, setLabel]   = useState("");
  const [action, setAction] = useState<QueueAction>("archive");
  const [filter, setFilter] = useState<ScheduleFilter>("dead");
  const [freq, setFreq]     = useState<ScheduleFreq>("weekly");

  const preview = useMemo(() => FILTER_DEFS[filter].apply(repos), [filter, repos]);

  const handleSave = () => {
    if (!label.trim()) return;
    onSave({ label: label.trim(), action, filter, freq, enabled: true });
  };

  const fieldStyle: React.CSSProperties = {
    height: 34, borderRadius: 8, padding: "0 12px",
    backgroundColor: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.10)",
    color: "#D4D8E8", fontSize: "0.8125rem", outline: "none",
    transition: "border-color 140ms",
    width: "100%", cursor: "pointer",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      style={{
        borderRadius: 14, padding: 20,
        background: "rgba(139,92,246,0.05)", border: "1px solid rgba(139,92,246,0.20)",
        display: "flex", flexDirection: "column", gap: 14,
      }}
    >
      <p style={{ fontSize: "0.875rem", fontWeight: 700, color: "#D4D8E8", letterSpacing: "-0.01em" }}>
        New scheduled job
      </p>

      <div>
        <label style={{ fontSize: "0.6875rem", fontWeight: 600, color: "#4A5580", letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 5 }}>
          Label
        </label>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Weekly archive of dead repos"
          style={{
            ...fieldStyle, cursor: "text",
            background: "rgba(255,255,255,0.04)",
          }}
          onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(139,92,246,0.45)"; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.10)"; }}
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
        <div>
          <label style={{ fontSize: "0.6875rem", fontWeight: 600, color: "#4A5580", letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 5 }}>
            Action
          </label>
          <select
            value={action}
            onChange={(e) => setAction(e.target.value as QueueAction)}
            style={fieldStyle}
          >
            {ACTION_OPTS.map((o) => (
              <option key={o.value} value={o.value} style={{ background: "#0D1025" }}>{o.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={{ fontSize: "0.6875rem", fontWeight: 600, color: "#4A5580", letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 5 }}>
            Target
          </label>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as ScheduleFilter)}
            style={fieldStyle}
          >
            {(Object.keys(FILTER_DEFS) as ScheduleFilter[]).map((k) => (
              <option key={k} value={k} style={{ background: "#0D1025" }}>{FILTER_DEFS[k].label}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={{ fontSize: "0.6875rem", fontWeight: 600, color: "#4A5580", letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 5 }}>
            Frequency
          </label>
          <select
            value={freq}
            onChange={(e) => setFreq(e.target.value as ScheduleFreq)}
            style={fieldStyle}
          >
            {FREQ_OPTS.map((o) => (
              <option key={o.value} value={o.value} style={{ background: "#0D1025" }}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div style={{
        padding: "10px 14px", borderRadius: 8,
        background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)",
        display: "flex", alignItems: "center", gap: 10,
      }}>
        <AlertCircle size={13} style={{ color: "#8B5CF6", flexShrink: 0 }} />
        <span style={{ fontSize: "0.75rem", color: "#6B7A9B" }}>
          This job would affect <strong style={{ color: "#D4D8E8" }}>{preview.length} repo{preview.length !== 1 ? "s" : ""}</strong> right now.
          Always goes through the confirmation modal before executing.
        </span>
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button
          type="button"
          onClick={handleSave}
          disabled={!label.trim()}
          style={{
            height: 34, padding: "0 18px", borderRadius: 8, cursor: label.trim() ? "pointer" : "not-allowed",
            background: label.trim() ? "linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)" : "rgba(139,92,246,0.10)",
            border: "none", color: "#fff", fontSize: "0.8125rem", fontWeight: 600,
            boxShadow: label.trim() ? "0 4px 14px rgba(139,92,246,0.35)" : "none",
            transition: "all 150ms",
          }}
        >
          Save job
        </button>
        <button
          type="button"
          onClick={onCancel}
          style={{
            height: 34, padding: "0 16px", borderRadius: 8, cursor: "pointer",
            background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)",
            color: "#8991A4", fontSize: "0.8125rem", fontWeight: 500, transition: "all 130ms",
          }}
        >
          Cancel
        </button>
      </div>
    </motion.div>
  );
};


interface ScheduleCardProps {
  entry: ScheduleEntry;
  repoCount: number;
  due: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onRunNow: () => void;
}

const ScheduleCard: React.FC<ScheduleCardProps> = ({ entry, repoCount, due, onToggle, onDelete, onRunNow }) => {
  const actionOpt = ACTION_OPTS.find((a) => a.value === entry.action);
  const freqOpt   = FREQ_OPTS.find((f) => f.value === entry.freq);
  const [hover, setHover] = useState<string | null>(null);

  return (
    <div
      style={{
        borderRadius: 12,
        background: entry.enabled ? "rgba(255,255,255,0.025)" : "rgba(255,255,255,0.012)",
        border: `1px solid ${due && entry.enabled ? "rgba(139,92,246,0.25)" : "rgba(255,255,255,0.07)"}`,
        padding: "14px 16px",
        display: "flex", alignItems: "flex-start", gap: 14,
        opacity: entry.enabled ? 1 : 0.55,
        transition: "all 140ms",
      }}
    >
      <div style={{
        width: 8, height: 8, borderRadius: "50%", flexShrink: 0, marginTop: 6,
        background: !entry.enabled ? "#3A4560" : due ? "#8B5CF6" : "#10B981",
        boxShadow: !entry.enabled ? "none" : due ? "0 0 8px rgba(139,92,246,0.6)" : "0 0 6px rgba(16,185,129,0.5)",
      }} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "#D4D8E8", letterSpacing: "-0.01em" }}>
            {entry.label}
          </span>
          {due && entry.enabled && (
            <span style={{
              padding: "1px 6px", borderRadius: 5,
              fontSize: "0.5625rem", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase",
              color: "#A78BFA", background: "rgba(139,92,246,0.14)", border: "1px solid rgba(139,92,246,0.25)",
            }}>
              Due
            </span>
          )}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          <Chip icon={actionOpt?.icon} label={actionOpt?.label ?? entry.action} color={actionOpt?.color ?? "#8991A4"} />
          <Chip icon={<GitFork size={11} />} label={`${FILTER_DEFS[entry.filter].label} · ${repoCount} repos`} color="#6B7A9B" />
          <Chip icon={freqOpt?.icon} label={freqOpt?.label ?? entry.freq} color="#6B7A9B" />
          {entry.lastRunAt && (
            <Chip icon={<CheckCircle2 size={11} />} label={`Last: ${new Date(entry.lastRunAt).toLocaleDateString()}`} color="#3A4560" />
          )}
        </div>
      </div>

      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
        <button
          type="button"
          onClick={onRunNow}
          title="Run now"
          onMouseEnter={() => setHover("run")}
          onMouseLeave={() => setHover(null)}
          style={{
            width: 30, height: 30, borderRadius: 7, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            background: hover === "run" ? "rgba(139,92,246,0.18)" : "rgba(255,255,255,0.04)",
            border: hover === "run" ? "1px solid rgba(139,92,246,0.30)" : "1px solid rgba(255,255,255,0.08)",
            color: hover === "run" ? "#A78BFA" : "#6B7A9B",
            transition: "all 130ms",
          }}
        >
          <Play size={12} />
        </button>

        <button
          type="button"
          onClick={onToggle}
          title={entry.enabled ? "Disable" : "Enable"}
          onMouseEnter={() => setHover("toggle")}
          onMouseLeave={() => setHover(null)}
          style={{
            width: 30, height: 30, borderRadius: 7, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            background: hover === "toggle" ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            color: entry.enabled ? "#10B981" : "#3A4560",
            transition: "all 130ms",
          }}
        >
          {entry.enabled ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
        </button>

        <button
          type="button"
          onClick={onDelete}
          title="Delete"
          onMouseEnter={() => setHover("del")}
          onMouseLeave={() => setHover(null)}
          style={{
            width: 30, height: 30, borderRadius: 7, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            background: hover === "del" ? "rgba(239,68,68,0.12)" : "rgba(255,255,255,0.04)",
            border: hover === "del" ? "1px solid rgba(239,68,68,0.25)" : "1px solid rgba(255,255,255,0.08)",
            color: hover === "del" ? "#F87171" : "#3A4560",
            transition: "all 130ms",
          }}
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
};

const Chip: React.FC<{ icon?: React.ReactNode; label: string; color: string }> = ({ icon, label, color }) => (
  <span style={{
    display: "inline-flex", alignItems: "center", gap: 4,
    padding: "2px 7px", borderRadius: 6,
    background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)",
    fontSize: "0.6875rem", color, fontWeight: 500,
  }}>
    {icon}
    {label}
  </span>
);


export const SchedulerPage: React.FC = () => {
  const repos     = useRepoStore((s) => s.repos);
  const openModal = useUIStore((s) => s.openModal);

  const [schedules, setSchedules] = useState<ScheduleEntry[]>(loadSchedules);
  const [creating, setCreating]   = useState(false);


  useEffect(() => { saveSchedules(schedules); }, [schedules]);


  useEffect(() => {
    const due = schedules.filter(isDue);
    if (due.length > 0) {

    }
  }, []);

  const addSchedule = (entry: Omit<ScheduleEntry, "id" | "createdAt" | "lastRunAt">) => {
    const newEntry: ScheduleEntry = {
      ...entry,
      id: `sch_${Date.now()}`,
      createdAt: new Date().toISOString(),
      lastRunAt: null,
    };
    setSchedules((prev) => [newEntry, ...prev]);
    setCreating(false);
  };

  const deleteSchedule = (id: string) => {
    setSchedules((prev) => prev.filter((s) => s.id !== id));
  };

  const toggleSchedule = (id: string) => {
    setSchedules((prev) => prev.map((s) => s.id === id ? { ...s, enabled: !s.enabled } : s));
  };

  const runNow = (entry: ScheduleEntry) => {
    const filtered = FILTER_DEFS[entry.filter].apply(repos);
    if (filtered.length === 0) return;
    const items: QueueItemInput[] = filtered.map((r) => ({
      repo_id: r.id, repo_name: r.name, repo_full_name: r.full_name,
      action: entry.action,
      payload: entry.action === "archive" ? { archive: true } : {},
    }));
    openModal("confirm-queue", { items, action: entry.action });

    setSchedules((prev) =>
      prev.map((s) => s.id === entry.id ? { ...s, lastRunAt: new Date().toISOString() } : s)
    );
  };

  const dueCount = schedules.filter(isDue).length;

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
              <Calendar size={15} />
            </div>
            <div>
              <p style={{ fontSize: "0.5rem", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#3A4560" }}>
                Automation
              </p>
              <h1 style={{ fontSize: "1.0625rem", fontWeight: 800, color: "#D4D8E8", letterSpacing: "-0.03em", lineHeight: 1 }}>
                Scheduler
              </h1>
            </div>
          </div>
          <p style={{ fontSize: "0.75rem", color: "#3A4560", marginTop: 6 }}>
            Recurring queue jobs — all operations still require confirmation before executing.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setCreating(true)}
          disabled={creating}
          style={{
            height: 34, padding: "0 16px", borderRadius: 9, cursor: "pointer",
            display: "flex", alignItems: "center", gap: 6, flexShrink: 0,
            background: creating ? "rgba(139,92,246,0.10)" : "linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)",
            border: "none", color: "#fff",
            fontSize: "0.8125rem", fontWeight: 600,
            boxShadow: creating ? "none" : "0 4px 14px rgba(139,92,246,0.30)",
            transition: "all 150ms",
          }}
        >
          <Plus size={13} /> New job
        </button>
      </div>

      <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: 20 }}>

        {dueCount > 0 && (
          <div style={{
            padding: "12px 16px", borderRadius: 10,
            background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.22)",
            display: "flex", alignItems: "center", gap: 10,
          }}>
            <div style={{
              width: 8, height: 8, borderRadius: "50%",
              background: "#8B5CF6", boxShadow: "0 0 10px rgba(139,92,246,0.7)",
              animation: "pulse 2s infinite",
              flexShrink: 0,
            }} />
            <span style={{ fontSize: "0.8125rem", color: "#C4B5FD", fontWeight: 500 }}>
              <strong>{dueCount} job{dueCount !== 1 ? "s" : ""}</strong> {dueCount === 1 ? "is" : "are"} due to run. Click Run to queue them for confirmation.
            </span>
          </div>
        )}

        <AnimatePresence>
          {creating && (
            <CreateForm
              repos={repos}
              onSave={addSchedule}
              onCancel={() => setCreating(false)}
            />
          )}
        </AnimatePresence>

        {schedules.length > 0 ? (
          <section>
            <p style={{ fontSize: "0.5625rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#3A4560", marginBottom: 10 }}>
              Scheduled jobs ({schedules.length})
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {schedules.map((entry) => {
                const repoCount = FILTER_DEFS[entry.filter].apply(repos).length;
                return (
                  <ScheduleCard
                    key={entry.id}
                    entry={entry}
                    repoCount={repoCount}
                    due={isDue(entry)}
                    onToggle={() => toggleSchedule(entry.id)}
                    onDelete={() => deleteSchedule(entry.id)}
                    onRunNow={() => runNow(entry)}
                  />
                );
              })}
            </div>
          </section>
        ) : !creating ? (
          <div style={{
            borderRadius: 16, padding: "48px 40px",
            background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.07)",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 18, textAlign: "center",
          }}>
            <div style={{
              width: 56, height: 56, borderRadius: 16,
              background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
              display: "flex", alignItems: "center", justifyContent: "center", color: "#2D3650",
            }}>
              <Calendar size={24} strokeWidth={1.5} />
            </div>
            <div>
              <p style={{ fontSize: "0.875rem", fontWeight: 700, color: "#4A5580", marginBottom: 6 }}>
                No scheduled jobs yet
              </p>
              <p style={{ fontSize: "0.75rem", color: "#2D3650", lineHeight: 1.6, maxWidth: 380 }}>
                Create recurring jobs to automatically queue cleanups on launch or on a schedule. Every job still requires confirmation before changes happen.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setCreating(true)}
              style={{
                height: 36, padding: "0 20px", borderRadius: 9, cursor: "pointer",
                background: "rgba(139,92,246,0.12)", border: "1px solid rgba(139,92,246,0.25)",
                color: "#C4B5FD", fontSize: "0.8125rem", fontWeight: 600,
                display: "flex", alignItems: "center", gap: 6, transition: "all 140ms",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(139,92,246,0.20)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(139,92,246,0.12)"; }}
            >
              <Plus size={13} /> Create your first job
            </button>
          </div>
        ) : null}

        <section style={{
          borderRadius: 12, padding: "14px 16px",
          background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.06)",
        }}>
          <p style={{ fontSize: "0.6875rem", fontWeight: 700, color: "#3A4560", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>
            How it works
          </p>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 5 }}>
            {[
              "Jobs run on the target filter using your currently cached repo data.",
              "On-launch jobs are surfaced every time you open the app.",
              "Daily/weekly jobs are due after the set interval has passed since the last run.",
              "All jobs go through the confirmation modal — nothing executes automatically.",
              "Job settings and run history are stored locally in your browser.",
            ].map((text, i) => (
              <li key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                <span style={{ flexShrink: 0, marginTop: 2, width: 4, height: 4, borderRadius: "50%", background: "#3A4560" }} />
                <span style={{ fontSize: "0.6875rem", color: "#4A5580", lineHeight: 1.55 }}>{text}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
};
