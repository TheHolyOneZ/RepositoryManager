import React, { useState, useEffect, useCallback } from "react";
import {
  Users, RefreshCw, UserMinus, UserPlus, ChevronRight,
  Loader2, Clock, Download, X, Info, CheckCircle2, XCircle, ChevronDown,
  Edit2, ExternalLink, ShieldCheck,
} from "lucide-react";
import { save as tauriSave } from "@tauri-apps/plugin-dialog";
import { RepoPicker } from "../../components/repos/RepoPicker";
import { useRepoStore } from "../../stores/repoStore";
import { useUIStore } from "../../stores/uiStore";
import { useAccountStore } from "../../stores/accountStore";
import { fanout } from "../../lib/utils/fanout";
import { formatInvokeError } from "../../lib/formatError";
import { ContextMenu } from "../../components/shared/ContextMenu";
import type { ContextMenuItemDef } from "../../components/shared/ContextMenu";
import {
  ghListCollaborators, ghAddCollaborator, ghRemoveCollaborator,
  ghListPendingInvitations, ghCancelInvitation, saveTextFile,
  openUrlExternal,
} from "../../lib/tauri/commands";
import type { Collaborator, PendingInvite } from "../../types/governance";
import type { Repo } from "../../types/repo";

type Tab = "collaborators" | "invites" | "bulk";
type Permission = "pull" | "triage" | "push" | "maintain" | "admin";

const PERMS: Permission[] = ["pull", "triage", "push", "maintain", "admin"];
const PERM_COLOR: Record<string, string> = {
  admin: "#EF4444", maintain: "#F59E0B", push: "#8B5CF6", triage: "#60A5FA", pull: "#10B981",
};

function permLabel(p: string) {
  return ({ pull: "Read", triage: "Triage", push: "Write", maintain: "Maintain", admin: "Admin" })[p] ?? p;
}

function fmtDate(iso: string) {
  try { return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric" }); }
  catch { return iso; }
}

function buildCsv(data: Array<{ repo: string; login: string; role: string }>) {
  const rows = [["repo", "login", "permission"], ...data.map((d) => [d.repo, d.login, d.role])];
  return rows.map((r) => r.join(",")).join("\n");
}

const INPUT_STYLE: React.CSSProperties = {
  width: "100%", borderRadius: 8,
  background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)",
  color: "#C8CDD8", fontSize: "0.875rem", padding: "8px 12px", outline: "none",
};

export const CollaboratorsPage: React.FC = () => {
  const repos = useRepoStore((s) => s.repos);
  const addToast = useUIStore((s) => s.addToast);
  const activeAccount = useAccountStore((s) => s.accounts.find((a) => a.id === s.activeAccountId));
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [viewingId, setViewingId] = useState<string>("");
  const [activeTab, setActiveTab] = useState<Tab>("collaborators");
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [invites, setInvites] = useState<PendingInvite[]>([]);
  const [loading, setLoading] = useState(false);
  const [permFilter, setPermFilter] = useState<Permission | "all">("all");
  const [bulkAction, setBulkAction] = useState<"add" | "remove">("add");

  const [bulkUsernames, setBulkUsernames] = useState("");
  const [bulkPermission, setBulkPermission] = useState<Permission>("push");
  const [bulkRunning, setBulkRunning] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null);
  const [bulkResults, setBulkResults] = useState<Array<{ key: string; ok: boolean; error?: string }> | null>(null);
  const [exportLoading, setExportLoading] = useState(false);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; collab: Collaborator } | null>(null);
  const [editModal, setEditModal] = useState<Collaborator | null>(null);
  const [editPerm, setEditPerm] = useState<Permission>("push");

  const selectedRepos = repos.filter((r) => selectedIds.has(r.id));
  const viewingRepo: Repo | undefined = repos.find((r) => r.id === viewingId) ?? selectedRepos[0];


  const isPersonalRepo = (repo: Repo) =>
    !!activeAccount && repo.owner.toLowerCase() === activeAccount.login.toLowerCase();
  const viewingIsPersonal = viewingRepo ? isPersonalRepo(viewingRepo) : false;
  const someSelectedArePersonal = selectedRepos.some(isPersonalRepo);

  useEffect(() => {
    if (viewingId && !selectedIds.has(viewingId)) {
      setViewingId(selectedRepos[0]?.id ?? "");
    } else if (!viewingId && selectedRepos.length > 0) {
      setViewingId(selectedRepos[0].id);
    }
  }, [selectedIds]);

  const toggleRepo = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const fetchCollaborators = useCallback(async (repo: Repo) => {
    setLoading(true);
    setCollaborators([]);
    setInvites([]);
    try {
      const [collab, inv] = await Promise.all([
        ghListCollaborators(repo.owner, repo.name),
        ghListPendingInvitations(repo.owner, repo.name),
      ]);
      setCollaborators(collab);
      setInvites(inv);
    } catch (e) {
      addToast({ type: "error", title: "Failed to load collaborators", message: formatInvokeError(e) });
    } finally { setLoading(false); }
  }, [addToast]);

  useEffect(() => {
    if (viewingRepo) fetchCollaborators(viewingRepo);
  }, [viewingRepo?.id]);

  const handleRemove = async (collab: Collaborator) => {
    if (!viewingRepo) return;
    try {
      await ghRemoveCollaborator(viewingRepo.owner, viewingRepo.name, collab.login);
      setCollaborators((prev) => prev.filter((c) => c.id !== collab.id));
      addToast({ type: "success", title: "Collaborator removed", message: collab.login });
    } catch (e) {
      addToast({ type: "error", title: "Remove failed", message: formatInvokeError(e) });
    }
  };

  const handleChangeRole = async (collab: Collaborator, newPerm: Permission) => {
    if (!viewingRepo) return;
    setEditModal(null);
    try {
      await ghAddCollaborator(viewingRepo.owner, viewingRepo.name, collab.login, newPerm);
      setCollaborators((prev) =>
        prev.map((c) => c.id === collab.id ? { ...c, role_name: newPerm } : c)
      );
      addToast({ type: "success", title: "Role updated", message: `${collab.login} → ${permLabel(newPerm)}` });
    } catch (e) {
      addToast({ type: "error", title: "Role update failed", message: formatInvokeError(e) });
    }
  };

  const handleCancelInvite = async (invite: PendingInvite) => {
    if (!viewingRepo) return;
    try {
      await ghCancelInvitation(viewingRepo.owner, viewingRepo.name, invite.id);
      setInvites((prev) => prev.filter((i) => i.id !== invite.id));
      addToast({ type: "success", title: "Invitation cancelled" });
    } catch (e) {
      addToast({ type: "error", title: "Cancel failed", message: formatInvokeError(e) });
    }
  };

  const parsedUsernames = bulkUsernames
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const handleBulkApply = async () => {
    if (!parsedUsernames.length || !selectedRepos.length) return;
    setBulkRunning(true);
    setBulkResults(null);
    const total = parsedUsernames.length * selectedRepos.length;
    setBulkProgress({ done: 0, total });
    let done = 0;
    const results: Array<{ key: string; ok: boolean; error?: string }> = [];
    for (const username of parsedUsernames) {
      const fanoutResults = await fanout(selectedRepos, 6, async (repo) => {
        if (bulkAction === "add") await ghAddCollaborator(repo.owner, repo.name, username, bulkPermission);
        else await ghRemoveCollaborator(repo.owner, repo.name, username);
      }, (d) => { setBulkProgress({ done: done + d, total }); });
      done += selectedRepos.length;
      for (const r of fanoutResults) {
        results.push({ key: `${username} → ${r.item.full_name}`, ok: r.ok, error: r.error });
      }
    }
    const ok = results.filter((r) => r.ok).length;
    const fail = results.filter((r) => !r.ok).length;
    setBulkResults(results);
    addToast({ type: fail === 0 ? "success" : "warning", title: `Bulk ${bulkAction}: ${ok} succeeded, ${fail} failed` });
    setBulkRunning(false);
    setBulkProgress(null);
    setBulkUsernames("");
    if (viewingRepo) fetchCollaborators(viewingRepo);
  };

  const handleExportCsv = async () => {
    if (!selectedRepos.length) return;
    setExportLoading(true);
    try {
      const rows: Array<{ repo: string; login: string; role: string }> = [];
      await fanout(selectedRepos, 4, async (repo) => {
        const cs = await ghListCollaborators(repo.owner, repo.name);
        for (const c of cs) rows.push({ repo: repo.full_name, login: c.login, role: c.role_name });
      });
      const csv = buildCsv(rows);
      const path = await tauriSave({
        title: "Save collaborators CSV",
        defaultPath: "collaborators.csv",
        filters: [{ name: "CSV", extensions: ["csv"] }],
      });
      if (!path) { setExportLoading(false); return; }
      await saveTextFile(path, csv);
      addToast({ type: "success", title: "CSV saved", message: `${rows.length} rows → ${path}` });
    } catch (e) {
      addToast({ type: "error", title: "Export failed", message: formatInvokeError(e) });
    } finally { setExportLoading(false); }
  };

  const filteredCollabs = permFilter === "all"
    ? collaborators
    : collaborators.filter((c) => c.role_name === permFilter || c.role_name === permLabel(permFilter).toLowerCase());

  const ROW_STYLE: React.CSSProperties = {
    display: "flex", alignItems: "center", gap: 10, padding: "7px 12px",
    borderBottom: "1px solid rgba(255,255,255,0.04)",
  };

  return (
    <div style={{ display: "flex", height: "100%", minHeight: 0, overflow: "hidden" }}>
      <RepoPicker
        selectedIds={selectedIds}
        onToggle={toggleRepo}
        onSelectAll={() => setSelectedIds(new Set(repos.map((r) => r.id)))}
        onClearAll={() => setSelectedIds(new Set())}
      />

      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>

        <div style={{
          margin: "12px 14px 0", padding: "10px 12px", borderRadius: 8,
          background: "rgba(96,165,250,0.06)", border: "1px solid rgba(96,165,250,0.15)",
          display: "flex", gap: 9, alignItems: "flex-start", flexShrink: 0,
        }}>
          <Info size={14} style={{ color: "#60A5FA", flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: "0.75rem", color: "#7A90B4", lineHeight: 1.6, margin: 0 }}>
            <p style={{ margin: "0 0 6px" }}>
              <strong style={{ color: "#93B4D8" }}>Collaborators</strong> are GitHub users granted direct access to a repo.
              Roles are enforced by GitHub — this app just sends them to the API.
              Requires a PAT with the <code style={{ background: "rgba(255,255,255,0.06)", padding: "1px 4px", borderRadius: 3 }}>repo</code> scope.
            </p>
            <p style={{ margin: "0 0 4px", color: "#5A6A8A" }}>
              <strong style={{ color: "#7A90B4" }}>Important:</strong>{" "}
              Permissions only activate <em>after the invite is accepted</em> — pending invites have no access.
              You cannot restrict your own access as repo owner; test roles with a second account.
            </p>
            <p style={{ margin: "0 0 4px", color: "#4A5A70" }}>
              <strong style={{ color: "#6A7A90" }}>Roles:</strong>{" "}
              <span style={{ color: "#10B981" }}>Read</span> — view &amp; clone only ·{" "}
              <span style={{ color: "#60A5FA" }}>Triage</span> — manage issues/PRs, no push ·{" "}
              <span style={{ color: "#8B5CF6" }}>Write</span> — push branches, create releases ·{" "}
              <span style={{ color: "#F59E0B" }}>Maintain</span> — write + settings (no destructive ops) ·{" "}
              <span style={{ color: "#EF4444" }}>Admin</span> — full access (GitHub Free: owner-only settings on private repos)
            </p>
            <p style={{ margin: 0, color: "#7A5A30", fontWeight: 600 }}>
              ⚠ Role granularity only works on <strong style={{ color: "#F59E0B" }}>organization-owned repos</strong>.
              On personal repos (owned by a user account), GitHub ignores the permission field and always grants <strong style={{ color: "#F59E0B" }}>Write</strong> — this is a GitHub API limitation, not an app bug.
            </p>
          </div>
        </div>

        <div style={{
          flexShrink: 0, display: "flex", alignItems: "center", gap: 2,
          padding: "0 14px", height: 44, marginTop: 8,
          borderBottom: "1px solid rgba(255,255,255,0.065)",
          background: "rgba(255,255,255,0.015)",
        }}>
          {(["collaborators", "invites", "bulk"] as Tab[]).map((t) => (
            <button key={t} onClick={() => setActiveTab(t)}
              style={{
                height: 28, padding: "0 12px", borderRadius: 6, cursor: "pointer",
                background: activeTab === t ? "rgba(139,92,246,0.14)" : "transparent",
                border: activeTab === t ? "1px solid rgba(139,92,246,0.28)" : "1px solid transparent",
                color: activeTab === t ? "#C4B5FD" : "#4A5580",
                fontSize: "0.8125rem", fontWeight: 500, textTransform: "capitalize",
              }}>
              {t === "invites" ? "Pending Invites" : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
          <div style={{ flex: 1 }} />

          {(activeTab === "collaborators" || activeTab === "invites") && selectedRepos.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ fontSize: "0.6875rem", color: "#5A6890" }}>Viewing:</span>
              <div style={{ position: "relative" }}>
                <select
                  value={viewingId}
                  onChange={(e) => setViewingId(e.target.value)}
                  style={{
                    height: 28, borderRadius: 7, background: "#131628",
                    border: "1px solid rgba(255,255,255,0.13)", color: "#B8C4DC",
                    fontSize: "0.75rem", padding: "0 24px 0 8px", outline: "none", cursor: "pointer",
                    appearance: "none",
                  }}
                >
                  {selectedRepos.map((r) => (
                    <option key={r.id} value={r.id} style={{ background: "#131628", color: "#B8C4DC" }}>{r.name}</option>
                  ))}
                </select>
                <ChevronDown size={10} style={{ position: "absolute", right: 7, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "#4A5580" }} />
              </div>
            </div>
          )}

          {viewingRepo && activeTab === "collaborators" && (
            <button onClick={() => fetchCollaborators(viewingRepo)}
              style={{ display: "flex", alignItems: "center", gap: 5, height: 28, padding: "0 10px", borderRadius: 7, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#4A5580", fontSize: "0.75rem", cursor: "pointer" }}>
              <RefreshCw size={11} /> Refresh
            </button>
          )}
          <button
            onClick={handleExportCsv}
            disabled={exportLoading || !selectedIds.size}
            title="Export all collaborators from selected repos to CSV (choose save location)"
            style={{ display: "flex", alignItems: "center", gap: 5, height: 28, padding: "0 10px", borderRadius: 7, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#4A5580", fontSize: "0.75rem", cursor: "pointer", opacity: !selectedIds.size ? 0.4 : 1 }}>
            {exportLoading ? <Loader2 size={11} style={{ animation: "spin 1s linear infinite" }} /> : <Download size={11} />}
            Export CSV
          </button>
        </div>

        <div style={{ flex: 1, overflow: "auto" }}>
          {!selectedRepos.length && activeTab !== "bulk" && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 10 }}>
              <Users size={32} style={{ color: "#1D2436" }} />
              <p style={{ color: "#3A4560", fontSize: "0.875rem" }}>Select repos from the left to get started</p>
            </div>
          )}

          {viewingRepo && activeTab === "collaborators" && (
            <div>
              <div style={{ display: "flex", gap: 6, padding: "8px 12px", borderBottom: "1px solid rgba(255,255,255,0.04)", flexWrap: "wrap" }}>
                {(["all", ...PERMS] as const).map((p) => (
                  <button key={p} onClick={() => setPermFilter(p)}
                    style={{
                      height: 24, padding: "0 9px", borderRadius: 5, cursor: "pointer", fontSize: "0.6875rem", fontWeight: 600,
                      background: permFilter === p ? `${PERM_COLOR[p] ?? "#8B5CF6"}18` : "rgba(255,255,255,0.04)",
                      border: permFilter === p ? `1px solid ${PERM_COLOR[p] ?? "#8B5CF6"}35` : "1px solid rgba(255,255,255,0.08)",
                      color: permFilter === p ? (PERM_COLOR[p] ?? "#A78BFA") : "#4A5580",
                    }}>
                    {p === "all" ? "All" : permLabel(p)}
                  </button>
                ))}
                <span style={{ marginLeft: "auto", fontSize: "0.6875rem", color: "#2D3650", alignSelf: "center" }}>
                  {filteredCollabs.length} {filteredCollabs.length === 1 ? "person" : "people"}
                </span>
              </div>
              {loading ? (
                <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
                  <Loader2 size={20} style={{ color: "#4A5580", animation: "spin 1s linear infinite" }} />
                </div>
              ) : filteredCollabs.length === 0 ? (
                <p style={{ textAlign: "center", color: "#3A4560", padding: 40, fontSize: "0.875rem" }}>No collaborators</p>
              ) : filteredCollabs.map((c) => (
                <div
                  key={c.id}
                  style={{ ...ROW_STYLE, cursor: "default" }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setCtxMenu({ x: e.clientX, y: e.clientY, collab: c });
                  }}
                >
                  <img src={c.avatar_url} alt={c.login} style={{ width: 26, height: 26, borderRadius: "50%", border: "1.5px solid rgba(255,255,255,0.08)", flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ color: "#D4D8E8", fontWeight: 500, fontSize: "0.8125rem" }}>{c.login}</p>
                  </div>
                  <span style={{
                    fontSize: "0.625rem", fontWeight: 700, padding: "2px 7px", borderRadius: 4,
                    background: `${PERM_COLOR[c.role_name] ?? "#4A5580"}18`,
                    color: PERM_COLOR[c.role_name] ?? "#4A5580",
                    textTransform: "capitalize",
                  }}>
                    {permLabel(c.role_name)}
                  </span>
                  <button
                    onClick={() => { setEditPerm((c.role_name as Permission) ?? "push"); setEditModal(c); }}
                    title="Change role"
                    style={{ display: "flex", padding: 5, borderRadius: 5, cursor: "pointer", background: "transparent", border: "none", color: "#3A4560" }}>
                    <Edit2 size={12} />
                  </button>
                  <button onClick={() => handleRemove(c)}
                    title="Remove this collaborator"
                    style={{ display: "flex", padding: 5, borderRadius: 5, cursor: "pointer", background: "transparent", border: "none", color: "#3A4560" }}>
                    <UserMinus size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {viewingRepo && activeTab === "invites" && (
            <div>
              {loading ? (
                <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
                  <Loader2 size={20} style={{ color: "#4A5580", animation: "spin 1s linear infinite" }} />
                </div>
              ) : invites.length === 0 ? (
                <p style={{ textAlign: "center", color: "#3A4560", padding: 40, fontSize: "0.875rem" }}>No pending invitations</p>
              ) : invites.map((inv) => (
                <div key={inv.id} style={ROW_STYLE}>
                  <Clock size={13} style={{ color: "#F59E0B", flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <p style={{ color: "#D4D8E8", fontWeight: 500, fontSize: "0.8125rem" }}>
                      {inv.login ?? inv.email ?? "Unknown"}
                    </p>
                    <p style={{ color: "#3A4560", fontSize: "0.6875rem" }}>
                      Invited by {inv.inviter} · {fmtDate(inv.created_at)} · {inv.role}
                    </p>
                  </div>
                  <button onClick={() => handleCancelInvite(inv)}
                    style={{ display: "flex", alignItems: "center", gap: 4, height: 26, padding: "0 8px", borderRadius: 6, cursor: "pointer", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.18)", color: "#EF4444", fontSize: "0.6875rem" }}>
                    <X size={10} /> Cancel
                  </button>
                </div>
              ))}
            </div>
          )}

          {activeTab === "bulk" && (
            <div style={{ padding: 24, maxWidth: 560 }}>
              <div style={{
                padding: "10px 12px", borderRadius: 8, marginBottom: 20,
                background: "rgba(96,165,250,0.06)", border: "1px solid rgba(96,165,250,0.15)",
                display: "flex", gap: 9, alignItems: "flex-start",
              }}>
                <Info size={14} style={{ color: "#60A5FA", flexShrink: 0, marginTop: 1 }} />
                <p style={{ fontSize: "0.75rem", color: "#7A90B4", lineHeight: 1.55, margin: 0 }}>
                  Add or remove collaborators across all <strong style={{ color: "#C4B5FD" }}>{selectedIds.size} selected repo{selectedIds.size !== 1 ? "s" : ""}</strong>.
                  Enter one or more GitHub usernames (comma-separated or one per line).
                  Each username will be processed against every selected repo.
                </p>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{ display: "flex", gap: 8 }}>
                  {(["add", "remove"] as const).map((a) => (
                    <button key={a} onClick={() => setBulkAction(a)}
                      style={{
                        flex: 1, height: 34, borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: "0.8125rem",
                        background: bulkAction === a ? (a === "add" ? "rgba(16,185,129,0.14)" : "rgba(239,68,68,0.10)") : "rgba(255,255,255,0.04)",
                        border: bulkAction === a ? (a === "add" ? "1px solid rgba(16,185,129,0.30)" : "1px solid rgba(239,68,68,0.22)") : "1px solid rgba(255,255,255,0.08)",
                        color: bulkAction === a ? (a === "add" ? "#10B981" : "#EF4444") : "#4A5580",
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                      }}>
                      {a === "add" ? <UserPlus size={13} /> : <UserMinus size={13} />}
                      {a.charAt(0).toUpperCase() + a.slice(1)}
                    </button>
                  ))}
                </div>
                <div>
                  <label style={{ fontSize: "0.75rem", color: "#4A5580", display: "block", marginBottom: 5 }}>
                    GitHub usernames * <span style={{ color: "#2D3650" }}>(comma-separated or one per line)</span>
                  </label>
                  <textarea
                    value={bulkUsernames}
                    onChange={(e) => setBulkUsernames(e.target.value)}
                    placeholder={"octocat\nhubot, defunkt"}
                    rows={3}
                    style={{ ...INPUT_STYLE, resize: "vertical", height: "auto", lineHeight: 1.5 }}
                  />
                  {parsedUsernames.length > 0 && (
                    <p style={{ fontSize: "0.6875rem", color: "#4A5580", marginTop: 4 }}>
                      {parsedUsernames.length} user{parsedUsernames.length !== 1 ? "s" : ""}: {parsedUsernames.slice(0, 5).join(", ")}{parsedUsernames.length > 5 ? ` +${parsedUsernames.length - 5} more` : ""}
                    </p>
                  )}
                </div>
                {bulkAction === "add" && (
                  <div>
                    <label style={{ fontSize: "0.75rem", color: "#4A5580", display: "block", marginBottom: 7 }}>Permission level</label>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {PERMS.map((p) => (
                        <button key={p} onClick={() => setBulkPermission(p)}
                          style={{
                            height: 28, padding: "0 10px", borderRadius: 6, cursor: "pointer", fontSize: "0.6875rem", fontWeight: 600,
                            background: bulkPermission === p ? `${PERM_COLOR[p]}18` : "rgba(255,255,255,0.04)",
                            border: bulkPermission === p ? `1px solid ${PERM_COLOR[p]}35` : "1px solid rgba(255,255,255,0.08)",
                            color: bulkPermission === p ? PERM_COLOR[p] : "#4A5580",
                          }}>
                          {permLabel(p)}
                        </button>
                      ))}
                    </div>
                    <p style={{ fontSize: "0.6875rem", color: "#2D3650", marginTop: 6 }}>
                      Read=view only · Triage=issues/PRs (no push) · Write=push + releases · Maintain=write + settings · Admin=full access
                    </p>
                    {someSelectedArePersonal && bulkPermission !== "push" && (
                      <p style={{ fontSize: "0.6875rem", color: "#F59E0B", marginTop: 6, padding: "5px 8px", borderRadius: 5, background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.18)" }}>
                        ⚠ Some selected repos are personal (user-owned). GitHub will assign <strong>Write</strong> regardless of the role you pick — fine-grained roles only work on organization repos.
                      </p>
                    )}
                  </div>
                )}
                {bulkProgress && (
                  <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 8, padding: "10px 14px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                      <span style={{ fontSize: "0.75rem", color: "#7A88A6" }}>Progress</span>
                      <span style={{ fontSize: "0.75rem", color: "#C4B5FD" }}>{bulkProgress.done} / {bulkProgress.total}</span>
                    </div>
                    <div style={{ height: 4, borderRadius: 2, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                      <div style={{ height: "100%", borderRadius: 2, background: "linear-gradient(90deg, #8B5CF6, #7C3AED)", width: `${(bulkProgress.done / bulkProgress.total) * 100}%`, transition: "width 200ms" }} />
                    </div>
                  </div>
                )}
                <button
                  onClick={handleBulkApply}
                  disabled={bulkRunning || !selectedIds.size || !parsedUsernames.length}
                  style={{
                    height: 38, borderRadius: 9, cursor: "pointer", fontWeight: 700, fontSize: "0.875rem",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                    background: "rgba(139,92,246,0.80)", border: "1px solid rgba(139,92,246,0.40)", color: "#fff",
                    opacity: (!selectedIds.size || !parsedUsernames.length) ? 0.4 : 1,
                  }}>
                  {bulkRunning ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <ChevronRight size={14} />}
                  {bulkRunning
                    ? "Applying…"
                    : `${bulkAction === "add" ? "Add" : "Remove"} ${parsedUsernames.length} user${parsedUsernames.length !== 1 ? "s" : ""} on ${selectedIds.size} repo${selectedIds.size !== 1 ? "s" : ""}`}
                </button>

                {bulkResults && !bulkRunning && (
                  <div style={{ background: "rgba(255,255,255,0.025)", borderRadius: 8, padding: "10px 14px", maxHeight: 200, overflowY: "auto" }}>
                    <p style={{ fontSize: "0.6875rem", fontWeight: 700, color: "#4A5580", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.07em" }}>Results</p>
                    {bulkResults.map((r) => (
                      <div key={r.key} style={{ display: "flex", alignItems: "center", gap: 7, padding: "3px 0" }}>
                        {r.ok ? <CheckCircle2 size={11} style={{ color: "#10B981" }} /> : <XCircle size={11} style={{ color: "#EF4444" }} />}
                        <span style={{ fontSize: "0.75rem", color: r.ok ? "#C8CDD8" : "#EF4444", flex: 1 }}>{r.key}</span>
                        {r.error && <span style={{ fontSize: "0.6875rem", color: "#EF4444", maxWidth: 120, textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>{r.error}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>


      {ctxMenu && (
        <ContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          onClose={() => setCtxMenu(null)}
          items={[
            {
              type: "item", label: "Change Role",
              icon: ShieldCheck,
              onClick: () => { setEditPerm((ctxMenu.collab.role_name as Permission) ?? "push"); setEditModal(ctxMenu.collab); },
            },
            {
              type: "item", label: "Open on GitHub",
              icon: ExternalLink,
              onClick: () => openUrlExternal(ctxMenu.collab.html_url).catch(() => {}),
            },
            { type: "divider" },
            {
              type: "item", label: "Remove Collaborator",
              icon: UserMinus, danger: true,
              onClick: () => handleRemove(ctxMenu.collab),
            },
          ] as ContextMenuItemDef[]}
        />
      )}


      {editModal && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 10000, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center" }}
          onMouseDown={() => setEditModal(null)}
        >
          <div
            style={{
              minWidth: 340, borderRadius: 14, padding: "22px 22px 18px",
              background: "linear-gradient(180deg, rgba(18,20,40,0.99) 0%, rgba(12,14,30,0.99) 100%)",
              border: "1px solid rgba(255,255,255,0.10)",
              boxShadow: "0 24px 64px rgba(0,0,0,0.75)",
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <img src={editModal.avatar_url} alt={editModal.login} style={{ width: 30, height: 30, borderRadius: "50%", border: "1.5px solid rgba(255,255,255,0.10)" }} />
              <div>
                <p style={{ color: "#D4D8E8", fontWeight: 600, fontSize: "0.9rem", margin: 0 }}>{editModal.login}</p>
                <p style={{ color: "#3A4560", fontSize: "0.6875rem", margin: 0 }}>Change permission level</p>
              </div>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
              {PERMS.map((p) => (
                <button key={p} onClick={() => setEditPerm(p)}
                  style={{
                    height: 30, padding: "0 12px", borderRadius: 7, cursor: "pointer",
                    fontSize: "0.75rem", fontWeight: 600,
                    background: editPerm === p ? `${PERM_COLOR[p]}22` : "rgba(255,255,255,0.04)",
                    border: editPerm === p ? `1px solid ${PERM_COLOR[p]}45` : "1px solid rgba(255,255,255,0.08)",
                    color: editPerm === p ? PERM_COLOR[p] : "#4A5580",
                  }}>
                  {permLabel(p)}
                </button>
              ))}
            </div>
            <p style={{ fontSize: "0.6875rem", color: "#2D3650", marginBottom: viewingIsPersonal ? 8 : 16 }}>
              Read=view only · Triage=issues/PRs (no push) · Write=push + releases · Maintain=write + settings · Admin=full
            </p>
            {viewingIsPersonal && (
              <p style={{ fontSize: "0.6875rem", color: "#F59E0B", marginBottom: 16, padding: "6px 8px", borderRadius: 6, background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.18)" }}>
                ⚠ This is a personal repo — GitHub ignores the role and always assigns <strong>Write</strong>. Fine-grained roles only work on organization repos.
              </p>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => handleChangeRole(editModal, editPerm)}
                style={{
                  flex: 1, height: 34, borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: "0.8125rem",
                  background: "rgba(139,92,246,0.80)", border: "1px solid rgba(139,92,246,0.40)", color: "#fff",
                }}>
                Save
              </button>
              <button
                onClick={() => setEditModal(null)}
                style={{
                  height: 34, padding: "0 16px", borderRadius: 8, cursor: "pointer", fontSize: "0.8125rem",
                  background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#4A5580",
                }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
