import React, { useState, useEffect, useCallback } from "react";
import {
  Webhook as WebhookIcon, RefreshCw, Trash2, Bell, BellOff,
  ChevronRight, Loader2, CheckCircle2, XCircle,
  RotateCcw, X, Info, HelpCircle, ChevronDown, Edit2, ExternalLink,
} from "lucide-react";
import { RepoPicker } from "../../components/repos/RepoPicker";
import { ContextMenu } from "../../components/shared/ContextMenu";
import type { ContextMenuItemDef } from "../../components/shared/ContextMenu";
import { useRepoStore } from "../../stores/repoStore";
import { useUIStore } from "../../stores/uiStore";
import { fanout } from "../../lib/utils/fanout";
import { formatInvokeError } from "../../lib/formatError";
import {
  ghListWebhooks, ghCreateWebhook, ghUpdateWebhook, ghDeleteWebhook, ghPingWebhook,
  ghListWebhookDeliveries, ghRedeliverWebhook, openUrlExternal,
} from "../../lib/tauri/commands";
import type { Webhook, WebhookDelivery } from "../../types/governance";
import type { Repo } from "../../types/repo";

type Tab = "webhooks" | "bulk";

const COMMON_EVENTS = ["push", "pull_request", "release", "issues", "workflow_run", "create", "delete", "fork", "star"];

function fmtDate(iso: string) {
  try { return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }); }
  catch { return iso; }
}

const INPUT_STYLE: React.CSSProperties = {
  width: "100%", height: 34, borderRadius: 8,
  background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)",
  color: "#C8CDD8", fontSize: "0.875rem", padding: "0 12px", outline: "none",
};

interface FieldLabelProps {
  label: string;
  tooltip: string;
  required?: boolean;
}

const FieldLabel: React.FC<FieldLabelProps> = ({ label, tooltip, required }) => {
  const [show, setShow] = useState(false);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 5, position: "relative" }}>
      <label style={{ fontSize: "0.75rem", color: "#4A5580" }}>{label}{required ? " *" : ""}</label>
      <button
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        style={{ display: "flex", background: "none", border: "none", padding: 0, cursor: "default", color: "#3A4560" }}
      >
        <HelpCircle size={11} />
      </button>
      {show && (
        <div style={{
          position: "absolute", left: 0, top: "100%", marginTop: 4, zIndex: 50,
          background: "#0E1120", border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 7, padding: "8px 10px", width: 280, boxShadow: "0 6px 24px rgba(0,0,0,0.5)",
        }}>
          <p style={{ fontSize: "0.6875rem", color: "#8A9AB8", lineHeight: 1.55, margin: 0 }}>{tooltip}</p>
        </div>
      )}
    </div>
  );
};

interface EditModalProps {
  hook: Webhook;
  repo: Repo;
  onClose: () => void;
  onSaved: (updated: Webhook) => void;
}

const MODAL_EVENTS = COMMON_EVENTS;

const EditModal: React.FC<EditModalProps> = ({ hook, repo, onClose, onSaved }) => {
  const addToast = useUIStore((s) => s.addToast);
  const [url, setUrl] = useState(hook.config.url);
  const [secret, setSecret] = useState("");
  const [contentType, setContentType] = useState(hook.config.content_type);
  const [active, setActive] = useState(hook.active);
  const [events, setEvents] = useState<Set<string>>(new Set(hook.events));
  const [saving, setSaving] = useState(false);

  const toggleEv = (ev: string) => {
    setEvents((prev) => { const next = new Set(prev); next.has(ev) ? next.delete(ev) : next.add(ev); return next; });
  };

  const handleSave = async () => {
    if (!url.trim()) return;
    setSaving(true);
    try {
      const updated = await ghUpdateWebhook(
        repo.owner, repo.name, hook.id,
        url.trim(), [...events], secret.trim() || null, contentType, active,
      );
      onSaved(updated);
      addToast({ type: "success", title: "Webhook updated" });
      onClose();
    } catch (e) {
      addToast({ type: "error", title: "Update failed", message: formatInvokeError(e) });
    } finally { setSaving(false); }
  };

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.55)" }} />
      <div style={{
        position: "fixed", zIndex: 201, top: "50%", left: "50%", transform: "translate(-50%, -50%)",
        width: 520, background: "linear-gradient(180deg, #0E1120 0%, #090C1A 100%)",
        border: "1px solid rgba(255,255,255,0.10)", borderRadius: 14,
        boxShadow: "0 32px 80px rgba(0,0,0,0.8)",
        display: "flex", flexDirection: "column",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          <span style={{ fontSize: "0.9375rem", fontWeight: 700, color: "#C8CDD8" }}>Edit webhook</span>
          <button onClick={onClose} style={{ display: "flex", padding: 5, borderRadius: 6, cursor: "pointer", background: "transparent", border: "none", color: "#3A4560" }}>
            <X size={14} />
          </button>
        </div>
        <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 14, overflowY: "auto" }}>
          <div>
            <FieldLabel label="Payload URL" required tooltip="The URL GitHub POSTs events to. Must be publicly reachable." />
            <input value={url} onChange={(e) => setUrl(e.target.value)} style={INPUT_STYLE} />
          </div>
          <div>
            <FieldLabel label="New Secret" tooltip="Leave empty to keep the existing secret. Enter a new value to replace it. GitHub signs payloads with HMAC-SHA256 using this secret." />
            <input value={secret} onChange={(e) => setSecret(e.target.value)} placeholder="(leave empty to keep existing)" type="password" style={INPUT_STYLE} />
          </div>
          <div>
            <FieldLabel label="Payload format" tooltip="JSON sends a JSON body. Form-encoded sends a 'payload' field." />
            <div style={{ display: "flex", gap: 8 }}>
              {(["json", "form"] as const).map((ct) => (
                <button key={ct} onClick={() => setContentType(ct)}
                  style={{ flex: 1, height: 30, borderRadius: 7, cursor: "pointer", fontSize: "0.75rem", fontWeight: 600, background: contentType === ct ? "rgba(139,92,246,0.14)" : "rgba(255,255,255,0.04)", border: contentType === ct ? "1px solid rgba(139,92,246,0.28)" : "1px solid rgba(255,255,255,0.08)", color: contentType === ct ? "#C4B5FD" : "#4A5580" }}>
                  {ct === "json" ? "application/json" : "application/x-www-form-urlencoded"}
                </button>
              ))}
            </div>
          </div>
          <div>
            <FieldLabel label="Events" tooltip="Which GitHub events trigger this webhook." />
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {MODAL_EVENTS.map((ev) => {
                const on = events.has(ev);
                return (
                  <button key={ev} onClick={() => toggleEv(ev)}
                    style={{ height: 26, padding: "0 10px", borderRadius: 6, cursor: "pointer", fontSize: "0.6875rem", fontWeight: 600, background: on ? "rgba(139,92,246,0.14)" : "rgba(255,255,255,0.04)", border: on ? "1px solid rgba(139,92,246,0.28)" : "1px solid rgba(255,255,255,0.08)", color: on ? "#C4B5FD" : "#4A5580" }}>
                    {ev}
                  </button>
                );
              })}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: "0.8125rem", color: "#8A94AA" }}>Active</span>
            <button onClick={() => setActive((v) => !v)}
              style={{ width: 36, height: 20, borderRadius: 10, cursor: "pointer", transition: "background 150ms", background: active ? "#8B5CF6" : "rgba(255,255,255,0.08)", border: "none", position: "relative" }}>
              <span style={{ position: "absolute", top: 2, width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: "left 150ms", left: active ? 18 : 2 }} />
            </button>
          </div>
        </div>
        <div style={{ padding: "12px 18px", borderTop: "1px solid rgba(255,255,255,0.07)", display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ height: 34, padding: "0 16px", borderRadius: 8, cursor: "pointer", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)", color: "#7A88A6", fontSize: "0.875rem" }}>
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving || !url.trim()}
            style={{ height: 34, padding: "0 20px", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: "0.875rem", display: "flex", alignItems: "center", gap: 7, background: "rgba(139,92,246,0.80)", border: "1px solid rgba(139,92,246,0.40)", color: "#fff", opacity: !url.trim() ? 0.4 : 1 }}>
            {saving ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> : null}
            Save
          </button>
        </div>
      </div>
    </>
  );
};

export const WebhooksPage: React.FC = () => {
  const repos = useRepoStore((s) => s.repos);
  const addToast = useUIStore((s) => s.addToast);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [viewingId, setViewingId] = useState<string>("");
  const [activeTab, setActiveTab] = useState<Tab>("webhooks");
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(false);
  const [deliveries, setDeliveries] = useState<WebhookDelivery[] | null>(null);
  const [deliveriesHook, setDeliveriesHook] = useState<Webhook | null>(null);
  const [loadingDeliveries, setLoadingDeliveries] = useState(false);
  const [editingHook, setEditingHook] = useState<Webhook | null>(null);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; hook: Webhook } | null>(null);

  const [bulkUrl, setBulkUrl] = useState("");
  const [bulkSecret, setBulkSecret] = useState("");
  const [bulkContentType, setBulkContentType] = useState("json");
  const [bulkEvents, setBulkEvents] = useState<Set<string>>(new Set(["push"]));
  const [bulkRunning, setBulkRunning] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null);
  const [bulkResults, setBulkResults] = useState<Array<{ repo: string; ok: boolean; error?: string }> | null>(null);

  const selectedRepos = repos.filter((r) => selectedIds.has(r.id));
  const viewingRepo: Repo | undefined = repos.find((r) => r.id === viewingId) ?? selectedRepos[0];

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

  const fetchWebhooks = useCallback(async (repo: Repo) => {
    setLoading(true);
    setWebhooks([]);
    try {
      const wh = await ghListWebhooks(repo.owner, repo.name);
      setWebhooks(wh);
    } catch (e) {
      addToast({ type: "error", title: "Failed to load webhooks", message: formatInvokeError(e) });
    } finally { setLoading(false); }
  }, [addToast]);

  useEffect(() => {
    setWebhooks([]);
    setDeliveries(null);
    if (viewingRepo && activeTab === "webhooks") fetchWebhooks(viewingRepo);
  }, [viewingRepo?.id, activeTab]);

  const handleDelete = async (hook: Webhook) => {
    if (!viewingRepo) return;
    try {
      await ghDeleteWebhook(viewingRepo.owner, viewingRepo.name, hook.id);
      setWebhooks((prev) => prev.filter((h) => h.id !== hook.id));
      addToast({ type: "success", title: "Webhook deleted", message: hook.config.url });
    } catch (e) {
      addToast({ type: "error", title: "Delete failed", message: formatInvokeError(e) });
    }
  };

  const handlePing = async (hook: Webhook) => {
    if (!viewingRepo) return;
    try {
      await ghPingWebhook(viewingRepo.owner, viewingRepo.name, hook.id);
      addToast({ type: "success", title: "Ping sent", message: hook.config.url });
    } catch (e) {
      addToast({ type: "error", title: "Ping failed", message: formatInvokeError(e) });
    }
  };

  const openDeliveries = async (hook: Webhook) => {
    if (!viewingRepo) return;
    setDeliveriesHook(hook);
    setLoadingDeliveries(true);
    try {
      const d = await ghListWebhookDeliveries(viewingRepo.owner, viewingRepo.name, hook.id);
      setDeliveries(d);
    } catch (e) {
      addToast({ type: "error", title: "Failed to load deliveries", message: formatInvokeError(e) });
      setDeliveries([]);
    } finally { setLoadingDeliveries(false); }
  };

  const handleRedeliver = async (hook: Webhook, delivery: WebhookDelivery) => {
    if (!viewingRepo) return;
    try {
      await ghRedeliverWebhook(viewingRepo.owner, viewingRepo.name, hook.id, delivery.id);
      addToast({ type: "success", title: "Re-delivery triggered" });
    } catch (e) {
      addToast({ type: "error", title: "Re-delivery failed", message: formatInvokeError(e) });
    }
  };

  const handleBulkCreate = async () => {
    if (!bulkUrl.trim() || !bulkEvents.size || !selectedRepos.length) return;
    setBulkRunning(true);
    setBulkResults(null);
    setBulkProgress({ done: 0, total: selectedRepos.length });
    const results = await fanout(selectedRepos, 6, async (repo) => {
      await ghCreateWebhook(
        repo.owner, repo.name, bulkUrl.trim(), [...bulkEvents],
        bulkSecret.trim() || null, bulkContentType,
      );
    }, (done, total) => setBulkProgress({ done, total }));
    const ok = results.filter((r) => r.ok).length;
    const fail = results.filter((r) => !r.ok).length;
    setBulkResults(results.map((r) => ({ repo: r.item.full_name, ok: r.ok, error: r.error })));
    addToast({ type: fail === 0 ? "success" : "warning", title: `Bulk create: ${ok} succeeded, ${fail} failed` });
    setBulkRunning(false);
    setBulkProgress(null);
    if (viewingRepo && activeTab === "webhooks") fetchWebhooks(viewingRepo);
  };

  const toggleEvent = (ev: string) => {
    setBulkEvents((prev) => {
      const next = new Set(prev);
      next.has(ev) ? next.delete(ev) : next.add(ev);
      return next;
    });
  };

  const buildCtxItems = (hook: Webhook): ContextMenuItemDef[] => [
    {
      type: "item", label: "Edit webhook", icon: Edit2,
      onClick: () => setEditingHook(hook),
    },
    {
      type: "item", label: "Ping", icon: Bell,
      onClick: () => handlePing(hook),
    },
    {
      type: "item", label: "Delivery history", icon: RotateCcw,
      onClick: () => openDeliveries(hook),
    },
    { type: "divider" },
    {
      type: "item", label: "Open on GitHub", icon: ExternalLink,
      onClick: () => openUrlExternal(`${viewingRepo?.html_url ?? ""}/settings/hooks/${hook.id}`),
    },
    { type: "divider" },
    {
      type: "item", label: "Delete webhook", icon: Trash2, danger: true,
      onClick: () => handleDelete(hook),
    },
  ];

  const ROW_STYLE: React.CSSProperties = {
    display: "flex", alignItems: "center", gap: 10, padding: "8px 12px",
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


      {editingHook && viewingRepo && (
        <EditModal
          hook={editingHook}
          repo={viewingRepo}
          onClose={() => setEditingHook(null)}
          onSaved={(updated) => setWebhooks((prev) => prev.map((h) => h.id === updated.id ? updated : h))}
        />
      )}


      {ctxMenu && (
        <ContextMenu
          x={ctxMenu.x} y={ctxMenu.y}
          items={buildCtxItems(ctxMenu.hook)}
          onClose={() => setCtxMenu(null)}
        />
      )}

      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>

        <div style={{
          margin: "12px 14px 0", padding: "10px 12px", borderRadius: 8,
          background: "rgba(96,165,250,0.06)", border: "1px solid rgba(96,165,250,0.15)",
          display: "flex", gap: 9, alignItems: "flex-start", flexShrink: 0,
        }}>
          <Info size={14} style={{ color: "#60A5FA", flexShrink: 0, marginTop: 1 }} />
          <p style={{ fontSize: "0.75rem", color: "#7A90B4", lineHeight: 1.55, margin: 0 }}>
            <strong style={{ color: "#93B4D8" }}>Webhooks</strong> send HTTP POST payloads to your server whenever events happen in a repo (push, PR, release, etc.).
            Select repos on the left. The <em>Webhooks</em> tab shows existing hooks on the currently viewed repo — right-click any row to edit, ping, or delete.
            <em> Bulk Create</em> adds the same webhook to all selected repos simultaneously. Requires
            <code style={{ background: "rgba(255,255,255,0.06)", padding: "1px 4px", borderRadius: 3 }}>admin:repo_hook</code> scope.
          </p>
        </div>

        <div style={{
          flexShrink: 0, display: "flex", alignItems: "center", gap: 2,
          padding: "0 14px", height: 44, marginTop: 8,
          borderBottom: "1px solid rgba(255,255,255,0.065)",
          background: "rgba(255,255,255,0.015)",
        }}>
          {(["webhooks", "bulk"] as Tab[]).map((t) => (
            <button key={t} onClick={() => setActiveTab(t)}
              style={{
                height: 28, padding: "0 12px", borderRadius: 6, cursor: "pointer",
                background: activeTab === t ? "rgba(139,92,246,0.14)" : "transparent",
                border: activeTab === t ? "1px solid rgba(139,92,246,0.28)" : "1px solid transparent",
                color: activeTab === t ? "#C4B5FD" : "#4A5580",
                fontSize: "0.8125rem", fontWeight: 500,
              }}
            >
              {t === "bulk" ? "Bulk Create" : "Webhooks"}
            </button>
          ))}
          <div style={{ flex: 1 }} />

          {activeTab === "webhooks" && selectedRepos.length > 0 && (
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

          {viewingRepo && activeTab === "webhooks" && (
            <button onClick={() => fetchWebhooks(viewingRepo)}
              style={{ display: "flex", alignItems: "center", gap: 5, height: 28, padding: "0 10px", borderRadius: 7, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#4A5580", fontSize: "0.75rem", cursor: "pointer" }}>
              <RefreshCw size={11} /> Refresh
            </button>
          )}
        </div>

        <div style={{ flex: 1, overflow: "hidden", display: "flex" }}>
          <div style={{ flex: 1, overflow: "auto" }}>
            {!selectedRepos.length && activeTab === "webhooks" && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 10 }}>
                <WebhookIcon size={32} style={{ color: "#1D2436" }} />
                <p style={{ color: "#3A4560", fontSize: "0.875rem" }}>Select repos from the left to get started</p>
              </div>
            )}

            {viewingRepo && activeTab === "webhooks" && (
              <div>
                {loading ? (
                  <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
                    <Loader2 size={20} style={{ color: "#4A5580", animation: "spin 1s linear infinite" }} />
                  </div>
                ) : webhooks.length === 0 ? (
                  <p style={{ textAlign: "center", color: "#3A4560", padding: 40, fontSize: "0.875rem" }}>No webhooks on this repo</p>
                ) : webhooks.map((hook) => (
                  <div
                    key={hook.id}
                    style={ROW_STYLE}
                    onContextMenu={(e) => { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY, hook }); }}
                  >
                    {hook.active
                      ? <Bell size={13} style={{ color: "#10B981", flexShrink: 0 }} />
                      : <BellOff size={13} style={{ color: "#4A5580", flexShrink: 0 }} />}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ color: "#D4D8E8", fontWeight: 500, fontSize: "0.8125rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {hook.config.url}
                      </p>
                      <p style={{ color: "#3A4560", fontSize: "0.6875rem" }}>
                        {hook.events.slice(0, 4).join(", ")}{hook.events.length > 4 ? ` +${hook.events.length - 4}` : ""}
                        {" · "}{hook.config.content_type}
                      </p>
                    </div>
                    <button onClick={() => openDeliveries(hook)}
                      style={{ height: 26, padding: "0 8px", borderRadius: 6, cursor: "pointer", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#7A88A6", fontSize: "0.6875rem" }}>
                      History
                    </button>
                    <button onClick={() => handlePing(hook)}
                      title="Send a ping event to test connectivity"
                      style={{ height: 26, padding: "0 8px", borderRadius: 6, cursor: "pointer", background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.18)", color: "#A78BFA", fontSize: "0.6875rem" }}>
                      Ping
                    </button>
                    <button onClick={() => setEditingHook(hook)}
                      title="Edit this webhook"
                      style={{ display: "flex", padding: 5, borderRadius: 5, cursor: "pointer", background: "transparent", border: "none", color: "#4A5580" }}>
                      <Edit2 size={12} />
                    </button>
                    <button onClick={() => handleDelete(hook)}
                      title="Delete this webhook"
                      style={{ display: "flex", padding: 5, borderRadius: 5, cursor: "pointer", background: "transparent", border: "none", color: "#3A4560" }}>
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {activeTab === "bulk" && (
              <div style={{ padding: 24, maxWidth: 580 }}>
                <div style={{
                  padding: "10px 12px", borderRadius: 8, marginBottom: 20,
                  background: "rgba(96,165,250,0.06)", border: "1px solid rgba(96,165,250,0.15)",
                  display: "flex", gap: 9, alignItems: "flex-start",
                }}>
                  <Info size={14} style={{ color: "#60A5FA", flexShrink: 0, marginTop: 1 }} />
                  <p style={{ fontSize: "0.75rem", color: "#7A90B4", lineHeight: 1.55, margin: 0 }}>
                    Creates the exact same webhook on all <strong style={{ color: "#C4B5FD" }}>{selectedIds.size} selected repo{selectedIds.size !== 1 ? "s" : ""}</strong> at once.
                    GitHub will immediately start sending events to your URL.
                  </p>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div>
                    <FieldLabel label="Payload URL" required
                      tooltip="The URL GitHub will POST event payloads to. Must be publicly reachable (not localhost). Example: https://ci.example.com/github/events" />
                    <input value={bulkUrl} onChange={(e) => setBulkUrl(e.target.value)} placeholder="https://…" style={INPUT_STYLE} />
                  </div>
                  <div>
                    <FieldLabel label="Webhook Secret"
                      tooltip="An optional secret token. GitHub signs each payload with HMAC-SHA256. Your server can verify the X-Hub-Signature-256 header to confirm the request came from GitHub." />
                    <input value={bulkSecret} onChange={(e) => setBulkSecret(e.target.value)} placeholder="Leave empty to skip signing" type="password" style={INPUT_STYLE} />
                  </div>
                  <div>
                    <FieldLabel label="Payload format"
                      tooltip="application/json sends the payload as a JSON body. application/x-www-form-urlencoded encodes it as a form field named 'payload'. Most modern integrations expect JSON." />
                    <div style={{ display: "flex", gap: 8 }}>
                      {(["json", "form"] as const).map((ct) => (
                        <button key={ct} onClick={() => setBulkContentType(ct)}
                          style={{ flex: 1, height: 30, borderRadius: 7, cursor: "pointer", fontSize: "0.75rem", fontWeight: 600, background: bulkContentType === ct ? "rgba(139,92,246,0.14)" : "rgba(255,255,255,0.04)", border: bulkContentType === ct ? "1px solid rgba(139,92,246,0.28)" : "1px solid rgba(255,255,255,0.08)", color: bulkContentType === ct ? "#C4B5FD" : "#4A5580" }}>
                          {ct === "json" ? "application/json" : "application/x-www-form-urlencoded"}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <FieldLabel label="Events"
                      tooltip="Which GitHub events trigger this webhook. Select the minimal set your integration needs." />
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {COMMON_EVENTS.map((ev) => {
                        const on = bulkEvents.has(ev);
                        return (
                          <button key={ev} onClick={() => toggleEvent(ev)}
                            style={{ height: 26, padding: "0 10px", borderRadius: 6, cursor: "pointer", fontSize: "0.6875rem", fontWeight: 600, background: on ? "rgba(139,92,246,0.14)" : "rgba(255,255,255,0.04)", border: on ? "1px solid rgba(139,92,246,0.28)" : "1px solid rgba(255,255,255,0.08)", color: on ? "#C4B5FD" : "#4A5580" }}>
                            {ev}
                          </button>
                        );
                      })}
                    </div>
                  </div>

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
                    onClick={handleBulkCreate}
                    disabled={bulkRunning || !selectedIds.size || !bulkUrl.trim() || !bulkEvents.size}
                    style={{
                      height: 38, borderRadius: 9, cursor: "pointer", fontWeight: 700, fontSize: "0.875rem",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                      background: "rgba(139,92,246,0.80)", border: "1px solid rgba(139,92,246,0.40)", color: "#fff",
                      opacity: (!selectedIds.size || !bulkUrl.trim() || !bulkEvents.size) ? 0.4 : 1,
                    }}
                  >
                    {bulkRunning ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <ChevronRight size={14} />}
                    {bulkRunning ? "Creating…" : `Create on ${selectedIds.size} repo${selectedIds.size !== 1 ? "s" : ""}`}
                  </button>

                  {bulkResults && !bulkRunning && (
                    <div style={{ background: "rgba(255,255,255,0.025)", borderRadius: 8, padding: "10px 14px", maxHeight: 180, overflowY: "auto" }}>
                      <p style={{ fontSize: "0.6875rem", fontWeight: 700, color: "#4A5580", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.07em" }}>Results</p>
                      {bulkResults.map((r) => (
                        <div key={r.repo} style={{ display: "flex", alignItems: "flex-start", gap: 7, padding: "3px 0" }}>
                          {r.ok ? <CheckCircle2 size={11} style={{ color: "#10B981", flexShrink: 0, marginTop: 1 }} /> : <XCircle size={11} style={{ color: "#EF4444", flexShrink: 0, marginTop: 1 }} />}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <span style={{ fontSize: "0.75rem", color: r.ok ? "#C8CDD8" : "#EF4444" }}>{r.repo}</span>
                            {r.error && <p style={{ fontSize: "0.6875rem", color: "#EF4444", marginTop: 1, wordBreak: "break-word" }}>{r.error}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {deliveries !== null && deliveriesHook && (
            <div style={{
              width: 380, flexShrink: 0, borderLeft: "1px solid rgba(255,255,255,0.07)",
              background: "rgba(6,8,16,0.95)", display: "flex", flexDirection: "column",
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderBottom: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 }}>
                <div>
                  <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#C8CDD8" }}>Delivery history</span>
                  <p style={{ fontSize: "0.6875rem", color: "#3A4560", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 280 }}>{deliveriesHook.config.url}</p>
                </div>
                <button onClick={() => { setDeliveries(null); setDeliveriesHook(null); }}
                  style={{ display: "flex", padding: 4, borderRadius: 5, cursor: "pointer", background: "transparent", border: "none", color: "#3A4560" }}>
                  <X size={14} />
                </button>
              </div>
              <div style={{ flex: 1, overflow: "auto" }}>
                {loadingDeliveries ? (
                  <div style={{ display: "flex", justifyContent: "center", padding: 30 }}>
                    <Loader2 size={18} style={{ color: "#4A5580", animation: "spin 1s linear infinite" }} />
                  </div>
                ) : deliveries.length === 0 ? (
                  <p style={{ textAlign: "center", color: "#3A4560", padding: 30, fontSize: "0.8125rem" }}>No deliveries yet</p>
                ) : deliveries.map((d) => (
                  <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 14px", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                    {d.status === "OK"
                      ? <CheckCircle2 size={12} style={{ color: "#10B981", flexShrink: 0 }} />
                      : <XCircle size={12} style={{ color: "#EF4444", flexShrink: 0 }} />}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ color: "#C8CDD8", fontSize: "0.75rem", fontWeight: 500 }}>{d.event}{d.action ? ` · ${d.action}` : ""}</p>
                      <p style={{ color: "#3A4560", fontSize: "0.6875rem" }}>{fmtDate(d.delivered_at)} · HTTP {d.status_code} · {d.duration.toFixed(2)}s</p>
                    </div>
                    {d.status !== "OK" && (
                      <button onClick={() => handleRedeliver(deliveriesHook, d)}
                        title="Re-deliver this payload"
                        style={{ display: "flex", padding: 5, borderRadius: 5, cursor: "pointer", background: "transparent", border: "none", color: "#F59E0B" }}>
                        <RotateCcw size={11} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
