import React, { useState, useEffect, useRef } from "react";
import { Loader2, Copy, Check, ChevronRight, CheckCircle2, XCircle, Clock, AlertTriangle } from "lucide-react";
import { ghListRunJobs, ghGetJobLogs } from "../../lib/tauri/commands";
import { formatInvokeError } from "../../lib/formatError";
import type { WorkflowJob, WorkflowStep } from "../../types/governance";

function stripAnsi(s: string): string {
  return s.replace(/\x1b\[[0-9;]*m/g, "");
}

function fmtTime(iso: string | null): string {
  if (!iso) return "";
  try { return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" }); }
  catch { return ""; }
}

const STATUS_ICON: Record<string, React.ReactNode> = {
  completed_success: <CheckCircle2 size={13} style={{ color: "#10B981" }} />,
  completed_failure: <XCircle size={13} style={{ color: "#EF4444" }} />,
  completed_skipped: <span style={{ color: "#6B7280", fontSize: 11 }}>—</span>,
  in_progress: <Loader2 size={13} style={{ color: "#8B5CF6", animation: "spin 1s linear infinite" }} />,
  queued: <Clock size={13} style={{ color: "#F59E0B" }} />,
};

function jobIcon(job: WorkflowJob) {
  const key = job.status === "completed" ? `completed_${job.conclusion ?? ""}` : job.status;
  return STATUS_ICON[key] ?? <AlertTriangle size={13} style={{ color: "#F59E0B" }} />;
}

function stepIcon(step: WorkflowStep) {
  const key = step.status === "completed" ? `completed_${step.conclusion ?? ""}` : step.status;
  return STATUS_ICON[key] ?? null;
}

interface Props {
  owner: string;
  repo: string;
  runId: number;
}

export const RunLogPanel: React.FC<Props> = ({ owner, repo, runId }) => {
  const [jobs, setJobs] = useState<WorkflowJob[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [jobsError, setJobsError] = useState<string | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null);
  const [logs, setLogs] = useState<string>("");
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [logsError, setLogsError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [search, setSearch] = useState("");
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoadingJobs(true);
    ghListRunJobs(owner, repo, runId)
      .then((j) => { setJobs(j); if (j.length > 0) setSelectedJobId(j[0].id); })
      .catch((e) => setJobsError(formatInvokeError(e)))
      .finally(() => setLoadingJobs(false));
  }, [owner, repo, runId]);

  useEffect(() => {
    if (!selectedJobId) return;
    setLoadingLogs(true);
    setLogsError(null);
    setLogs("");
    ghGetJobLogs(owner, repo, selectedJobId)
      .then((text) => setLogs(stripAnsi(text)))
      .catch((e) => setLogsError(formatInvokeError(e)))
      .finally(() => setLoadingLogs(false));
  }, [owner, repo, selectedJobId]);

  const handleCopy = () => {
    navigator.clipboard.writeText(logs).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const displayedLines = React.useMemo(() => {
    const lines = logs.split("\n");
    if (!search.trim()) return lines;
    const q = search.toLowerCase();
    return lines.map((line) => ({
      line,
      match: line.toLowerCase().includes(q),
    }));
  }, [logs, search]);

  if (loadingJobs) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 160, gap: 8, color: "#7A8AAE" }}>
        <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />
        <span style={{ fontSize: "0.8125rem" }}>Loading jobs…</span>
      </div>
    );
  }

  if (jobsError) {
    return <div style={{ padding: 16, color: "#EF4444", fontSize: "0.8125rem" }}>{jobsError}</div>;
  }

  return (
    <div style={{ display: "flex", height: 420, gap: 0, overflow: "hidden" }}>
      <div style={{
        width: 220, flexShrink: 0, borderRight: "1px solid rgba(255,255,255,0.07)",
        overflowY: "auto", padding: "8px 0",
      }}>
        {jobs.map((job) => (
          <div key={job.id}>
            <button
              type="button"
              onClick={() => setSelectedJobId(job.id)}
              style={{
                width: "100%", display: "flex", alignItems: "center", gap: 8,
                padding: "7px 12px", cursor: "pointer", border: "none",
                background: selectedJobId === job.id ? "rgba(139,92,246,0.14)" : "transparent",
                color: selectedJobId === job.id ? "#C4B5FD" : "#9AA5BE",
                fontSize: "0.7813rem", fontWeight: 500, textAlign: "left",
                transition: "background 120ms ease",
              }}
              onMouseEnter={(e) => { if (selectedJobId !== job.id) (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.05)"; }}
              onMouseLeave={(e) => { if (selectedJobId !== job.id) (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
            >
              <span style={{ flexShrink: 0 }}>{jobIcon(job)}</span>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{job.name}</span>
            </button>
            {selectedJobId === job.id && job.steps.map((step) => (
              <div key={step.number} style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "4px 12px 4px 30px", color: "#5A6A8A", fontSize: "0.7188rem",
              }}>
                <span style={{ flexShrink: 0 }}>{stepIcon(step)}</span>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{step.name}</span>
              </div>
            ))}
          </div>
        ))}
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
        <div style={{
          flexShrink: 0, display: "flex", alignItems: "center", gap: 8,
          padding: "6px 12px", borderBottom: "1px solid rgba(255,255,255,0.07)",
        }}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search logs…"
            style={{
              flex: 1, height: 28, borderRadius: 7,
              background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)",
              color: "#C8CDD8", fontSize: "0.7813rem", padding: "0 10px", outline: "none",
            }}
          />
          {selectedJobId && jobs.find((j) => j.id === selectedJobId) && (
            <span style={{ fontSize: "0.6875rem", color: "#4A5580" }}>
              {fmtTime(jobs.find((j) => j.id === selectedJobId)!.started_at)} – {fmtTime(jobs.find((j) => j.id === selectedJobId)!.completed_at)}
            </span>
          )}
          <button
            type="button"
            onClick={handleCopy}
            disabled={!logs}
            style={{
              display: "flex", alignItems: "center", gap: 5, padding: "4px 10px",
              borderRadius: 7, cursor: "pointer", border: "1px solid rgba(255,255,255,0.10)",
              background: "rgba(255,255,255,0.05)", color: "#9AA5BE", fontSize: "0.75rem", fontWeight: 500,
            }}
          >
            {copied ? <Check size={12} style={{ color: "#10B981" }} /> : <Copy size={12} />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>

        <div
          ref={logRef}
          style={{
            flex: 1, overflowY: "auto", padding: "12px 16px",
            fontFamily: "monospace", fontSize: "0.75rem", lineHeight: 1.6,
            color: "#A0ABB8", background: "#070812",
            whiteSpace: "pre-wrap", wordBreak: "break-all",
          }}
        >
          {loadingLogs && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#7A8AAE" }}>
              <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />
              <span>Loading logs…</span>
            </div>
          )}
          {logsError && <span style={{ color: "#EF4444" }}>{logsError}</span>}
          {!loadingLogs && !logsError && (
            search.trim()
              ? (displayedLines as Array<{ line: string; match: boolean }>).map((item, i) => (
                  <div key={i} style={{ background: item.match ? "rgba(139,92,246,0.15)" : "transparent" }}>
                    {item.line || " "}
                  </div>
                ))
              : logs || <span style={{ color: "#3A4560" }}>No log output.</span>
          )}
        </div>
      </div>
    </div>
  );
};
