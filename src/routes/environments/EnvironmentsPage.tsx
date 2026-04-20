import React, { useState, useCallback, useEffect } from "react";
import { KeyRound, Plus, Trash2, RefreshCw, Copy, Eye, EyeOff, AlertCircle, CheckCircle2, ShieldCheck, Layers, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { CompactRepoGrid } from "../../components/repos/CompactRepoGrid";
import { RepoSelectorDropdown } from "../../components/repos/RepoSelectorDropdown";
import { useRepoStore } from "../../stores/repoStore";
import { useUIStore } from "../../stores/uiStore";
import {
  ghListEnvironments, ghCreateEnvironment, ghDeleteEnvironment,
  ghListRepoSecrets, ghListEnvSecrets,
  ghCreateRepoSecret, ghDeleteRepoSecret,
  ghCreateEnvSecret, ghDeleteEnvSecret,
  ghBulkSetSecret,
} from "../../lib/tauri/commands";
import { formatInvokeError } from "../../lib/formatError";
import type { Environment, RepoSecret } from "../../types/governance";

type TabId = "repo-secrets" | "environments" | "bulk-copy";


const SecretRow: React.FC<{ secret: RepoSecret; onDelete: () => void }> = ({ secret, onDelete }) => (
  <div style={{
    display: "grid", gridTemplateColumns: "1fr auto auto", alignItems: "center", gap: 16,
    padding: "11px 16px", borderRadius: 8,
    background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
    marginBottom: 3,
  }}>
    <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
      <KeyRound size={12} style={{ color: "#8B5CF6", flexShrink: 0 }} />
      <span style={{ fontFamily: "'Cascadia Code','Consolas',monospace", fontSize: "0.8125rem", color: "#D4D8E8", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {secret.name}
      </span>
    </div>
    <span style={{ fontSize: "0.6875rem", color: "#3A4560", whiteSpace: "nowrap" }}>
      Updated {new Date(secret.updated_at).toLocaleDateString()}
    </span>
    <button
      onClick={onDelete}
      style={{
        width: 28, height: 28, borderRadius: 6, cursor: "pointer", flexShrink: 0,
        background: "transparent", border: "1px solid rgba(239,68,68,0.18)",
        color: "#4A5580", display: "flex", alignItems: "center", justifyContent: "center",
        transition: "all 120ms",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(239,68,68,0.12)"; e.currentTarget.style.color = "#F87171"; e.currentTarget.style.borderColor = "rgba(239,68,68,0.40)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#4A5580"; e.currentTarget.style.borderColor = "rgba(239,68,68,0.18)"; }}
    >
      <Trash2 size={11} />
    </button>
  </div>
);


const AddSecretForm: React.FC<{ onAdd: (name: string, value: string) => Promise<void>; compact?: boolean }> = ({ onAdd, compact }) => {
  const [name, setName] = useState("");
  const [value, setValue] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const canAdd = name.trim() && value.trim();

  const handle = async () => {
    if (!canAdd) return;
    setLoading(true);
    await onAdd(name.trim().toUpperCase().replace(/[^A-Z0-9_]/g, "_"), value.trim());
    setName(""); setValue("");
    setLoading(false);
  };

  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="SECRET_NAME"
        style={{
          flex: "0 0 200px", height: 34, borderRadius: 7, padding: "0 10px",
          background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)",
          color: "#C8CDD8", fontSize: "0.75rem", fontFamily: "monospace", outline: "none",
          transition: "border-color 140ms",
        }}
        onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(139,92,246,0.40)"; }}
        onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.09)"; }}
      />
      <div style={{ position: "relative", flex: 1 }}>
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Value"
          onKeyDown={(e) => { if (e.key === "Enter") handle(); }}
          style={{
            width: "100%", height: 34, borderRadius: 7, padding: "0 34px 0 10px",
            background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)",
            color: "#C8CDD8", fontSize: "0.75rem", outline: "none", transition: "border-color 140ms",
          }}
          onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(139,92,246,0.40)"; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.09)"; }}
        />
        <button
          type="button"
          onClick={() => setShow(!show)}
          style={{ position: "absolute", right: 7, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#3A4560", padding: 2 }}
        >
          {show ? <EyeOff size={12} /> : <Eye size={12} />}
        </button>
      </div>
      <button
        onClick={handle}
        disabled={!canAdd || loading}
        style={{
          height: 34, padding: "0 16px", borderRadius: 7, cursor: "pointer", flexShrink: 0,
          background: canAdd ? "rgba(139,92,246,0.18)" : "rgba(255,255,255,0.04)",
          border: canAdd ? "1px solid rgba(139,92,246,0.35)" : "1px solid rgba(255,255,255,0.08)",
          color: canAdd ? "#C4B5FD" : "#3A4560",
          fontSize: "0.75rem", fontWeight: 600,
          display: "flex", alignItems: "center", gap: 5,
          opacity: loading ? 0.5 : 1, transition: "all 140ms",
        }}
      >
        <Plus size={12} /> Add
      </button>
    </div>
  );
};


export const EnvironmentsPage: React.FC = () => {
  const repos = useRepoStore((s) => s.repos);
  const addToast = useUIStore((s) => s.addToast);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<TabId>("repo-secrets");
  const [loading, setLoading] = useState(false);
  const [secrets, setSecrets] = useState<RepoSecret[]>([]);
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [selectedEnv, setSelectedEnv] = useState<string | null>(null);
  const [envSecrets, setEnvSecrets] = useState<RepoSecret[]>([]);
  const [newEnvName, setNewEnvName] = useState("");
  const [bulkName, setBulkName] = useState("");
  const [bulkValue, setBulkValue] = useState("");
  const [bulkShowValue, setBulkShowValue] = useState(false);
  const [bulkTargets, setBulkTargets] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkResults, setBulkResults] = useState<Array<{ repo: string; success: boolean; error?: string }>>([]);

  const selectedRepo = repos.find((r) => r.id === selectedId);

  const load = useCallback(async () => {
    if (!selectedRepo) return;
    setLoading(true);
    setSecrets([]); setEnvironments([]); setEnvSecrets([]); setSelectedEnv(null);
    try {
      if (tab === "repo-secrets") {
        setSecrets(await ghListRepoSecrets(selectedRepo.owner, selectedRepo.name));
      } else if (tab === "environments") {
        setEnvironments(await ghListEnvironments(selectedRepo.owner, selectedRepo.name));
      }
    } catch (e) {
      addToast({ type: "error", title: "Load failed", message: formatInvokeError(e) });
    } finally { setLoading(false); }
  }, [selectedRepo, tab, addToast]);

  const loadEnvSecrets = async (envName: string) => {
    if (!selectedRepo) return;
    setSelectedEnv(envName);
    try {
      setEnvSecrets(await ghListEnvSecrets(selectedRepo.owner, selectedRepo.name, envName));
    } catch (e) {
      addToast({ type: "error", title: "Failed to load env secrets", message: formatInvokeError(e) });
    }
  };

  const handleRepoSelect = (id: string | null) => {
    setSelectedId(id);
    setSecrets([]); setEnvironments([]); setEnvSecrets([]); setSelectedEnv(null);
  };

  useEffect(() => { if (selectedRepo && tab !== "bulk-copy") load(); }, [selectedRepo, tab]);

  const addRepoSecret = async (name: string, value: string) => {
    if (!selectedRepo) return;
    try {
      await ghCreateRepoSecret(selectedRepo.owner, selectedRepo.name, name, value);
      addToast({ type: "success", title: "Secret saved", message: name });
      load();
    } catch (e) { addToast({ type: "error", title: "Failed", message: formatInvokeError(e) }); }
  };

  const deleteRepoSecret = async (name: string) => {
    if (!selectedRepo) return;
    try {
      await ghDeleteRepoSecret(selectedRepo.owner, selectedRepo.name, name);
      setSecrets((s) => s.filter((x) => x.name !== name));
      addToast({ type: "success", title: "Secret deleted" });
    } catch (e) { addToast({ type: "error", title: "Failed", message: formatInvokeError(e) }); }
  };

  const addEnvSecret = async (name: string, value: string) => {
    if (!selectedRepo || !selectedEnv) return;
    try {
      await ghCreateEnvSecret(selectedRepo.owner, selectedRepo.name, selectedEnv, name, value);
      addToast({ type: "success", title: "Secret saved", message: name });
      loadEnvSecrets(selectedEnv);
    } catch (e) { addToast({ type: "error", title: "Failed", message: formatInvokeError(e) }); }
  };

  const deleteEnvSecret = async (name: string) => {
    if (!selectedRepo || !selectedEnv) return;
    try {
      await ghDeleteEnvSecret(selectedRepo.owner, selectedRepo.name, selectedEnv, name);
      setEnvSecrets((s) => s.filter((x) => x.name !== name));
      addToast({ type: "success", title: "Secret deleted" });
    } catch (e) { addToast({ type: "error", title: "Failed", message: formatInvokeError(e) }); }
  };

  const createEnvironment = async () => {
    if (!selectedRepo || !newEnvName.trim()) return;
    try {
      await ghCreateEnvironment(selectedRepo.owner, selectedRepo.name, newEnvName.trim());
      setNewEnvName("");
      addToast({ type: "success", title: "Environment created" });
      load();
    } catch (e) { addToast({ type: "error", title: "Failed", message: formatInvokeError(e) }); }
  };

  const deleteEnvironment = async (envName: string) => {
    if (!selectedRepo) return;
    try {
      await ghDeleteEnvironment(selectedRepo.owner, selectedRepo.name, envName);
      if (selectedEnv === envName) { setSelectedEnv(null); setEnvSecrets([]); }
      setEnvironments((e) => e.filter((x) => x.name !== envName));
      addToast({ type: "success", title: "Environment deleted" });
    } catch (e) { addToast({ type: "error", title: "Failed", message: formatInvokeError(e) }); }
  };

  const runBulkCopy = async () => {
    if (!bulkName.trim() || !bulkValue.trim() || bulkTargets.size === 0) return;
    setBulkLoading(true);
    setBulkResults([]);
    try {
      const targets = repos.filter((r) => bulkTargets.has(r.id)).map((r) => ({ owner: r.owner, repo: r.name }));
      const results = await ghBulkSetSecret(targets, bulkName.trim().toUpperCase().replace(/[^A-Z0-9_]/g, "_"), bulkValue.trim());
      setBulkResults(results);
      addToast({ type: "success", title: `${results.filter((r) => r.success).length}/${results.length} repos updated` });
    } catch (e) {
      addToast({ type: "error", title: "Bulk copy failed", message: formatInvokeError(e) });
    } finally { setBulkLoading(false); }
  };

  const TABS: Array<{ id: TabId; label: string; icon: React.ReactNode }> = [
    { id: "repo-secrets", label: "Repo Secrets", icon: <KeyRound size={12} /> },
    { id: "environments", label: "Environments", icon: <Layers size={12} /> },
    { id: "bulk-copy", label: "Bulk Copy", icon: <Copy size={12} /> },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>

      {}
      <div style={{
        flexShrink: 0, display: "flex", alignItems: "center", gap: 0,
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        background: "rgba(255,255,255,0.01)",
      }}>
        {}
        <div style={{ display: "flex", alignItems: "flex-end", padding: "0 20px", gap: 2, height: 52 }}>
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                height: 36, padding: "0 14px", borderRadius: "8px 8px 0 0", cursor: "pointer",
                background: tab === t.id ? "rgba(255,255,255,0.05)" : "transparent",
                border: tab === t.id ? "1px solid rgba(255,255,255,0.09)" : "1px solid transparent",
                borderBottom: tab === t.id ? "1px solid rgba(6,8,16,0.01)" : "1px solid transparent",
                color: tab === t.id ? "#C4B5FD" : "#4A5580",
                fontSize: "0.8125rem", fontWeight: tab === t.id ? 600 : 400, marginBottom: -1,
                transition: "all 130ms",
              }}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        <div style={{ width: 1, height: 28, background: "rgba(255,255,255,0.07)", margin: "0 16px" }} />

        {}
        {tab !== "bulk-copy" && (
          <>
            <RepoSelectorDropdown repos={repos} selectedId={selectedId} onSelect={handleRepoSelect} />
            {selectedRepo && (
              <button
                onClick={load}
                disabled={loading}
                style={{ marginLeft: 8, width: 30, height: 30, borderRadius: 7, background: "transparent", border: "1px solid rgba(255,255,255,0.08)", cursor: "pointer", color: "#4A5580", display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <RefreshCw size={12} style={loading ? { animation: "spin 1s linear infinite" } : {}} />
              </button>
            )}
          </>
        )}

        <div style={{ flex: 1 }} />

        {}
        {tab === "bulk-copy" && (
          <div style={{ paddingRight: 20, display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: "0.6875rem", color: "#3A4560" }}>
              {bulkTargets.size > 0 ? <><span style={{ color: "#A78BFA", fontWeight: 700 }}>{bulkTargets.size}</span> repos selected</> : "No repos selected"}
            </span>
          </div>
        )}

        {}
        {tab === "repo-secrets" && selectedRepo && !loading && (
          <div style={{ paddingRight: 20 }}>
            <span style={{ fontSize: "0.6875rem", color: "#3A4560" }}>
              <span style={{ color: "#A78BFA", fontWeight: 700 }}>{secrets.length}</span> secret{secrets.length !== 1 ? "s" : ""}
            </span>
          </div>
        )}
      </div>

      {}
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>

        {}
        {tab === "repo-secrets" && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            {!selectedRepo ? (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, padding: 40 }}>
                <div style={{ width: 56, height: 56, borderRadius: 16, background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <KeyRound size={22} style={{ color: "#6B5A8A" }} />
                </div>
                <div style={{ textAlign: "center" }}>
                  <p style={{ fontSize: "0.9375rem", fontWeight: 700, color: "#8991A4", marginBottom: 6 }}>No repository selected</p>
                  <p style={{ fontSize: "0.8125rem", color: "#3A4560", lineHeight: 1.6 }}>Choose a repo from the dropdown above to manage its secrets.</p>
                </div>
              </div>
            ) : loading ? (
              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <RefreshCw size={20} style={{ color: "#3A4560", animation: "spin 1s linear infinite" }} />
              </div>
            ) : (
              <>
                {}
                <div style={{ padding: "16px 24px", borderBottom: "1px solid rgba(255,255,255,0.05)", background: "rgba(255,255,255,0.01)", flexShrink: 0 }}>
                  <AddSecretForm onAdd={addRepoSecret} />
                </div>
                {}
                <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px" }}>
                  {secrets.length === 0 ? (
                    <div style={{ padding: "48px 0", textAlign: "center", color: "#2D3650" }}>
                      <KeyRound size={28} style={{ margin: "0 auto 10px", opacity: 0.25 }} />
                      <p style={{ fontSize: "0.8125rem" }}>No secrets yet — add one above.</p>
                    </div>
                  ) : (
                    secrets.map((s) => (
                      <SecretRow key={s.name} secret={s} onDelete={() => deleteRepoSecret(s.name)} />
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {}
        {tab === "environments" && (
          <div style={{ flex: 1, overflow: "hidden" }}>
            {!selectedRepo ? (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, padding: 40, height: "100%" }}>
                <div style={{ width: 56, height: 56, borderRadius: 16, background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Layers size={22} style={{ color: "#6B5A8A" }} />
                </div>
                <p style={{ fontSize: "0.9375rem", fontWeight: 700, color: "#8991A4" }}>No repository selected</p>
                <p style={{ fontSize: "0.8125rem", color: "#3A4560" }}>Choose a repo from the dropdown above.</p>
              </div>
            ) : loading ? (
              <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <RefreshCw size={20} style={{ color: "#3A4560", animation: "spin 1s linear infinite" }} />
              </div>
            ) : (
              <div style={{ display: "flex", height: "100%" }}>
                {}
                <div style={{ width: 260, flexShrink: 0, borderRight: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
                  <div style={{ padding: "14px 16px 10px", borderBottom: "1px solid rgba(255,255,255,0.05)", flexShrink: 0 }}>
                    <p style={{ fontSize: "0.5625rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#3A4560", marginBottom: 10 }}>
                      Environments · {environments.length}
                    </p>
                    <div style={{ display: "flex", gap: 6 }}>
                      <input
                        value={newEnvName}
                        onChange={(e) => setNewEnvName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") createEnvironment(); }}
                        placeholder="new-environment"
                        style={{
                          flex: 1, height: 30, borderRadius: 7, padding: "0 9px",
                          background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)",
                          color: "#C8CDD8", fontSize: "0.75rem", outline: "none",
                        }}
                        onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(139,92,246,0.40)"; }}
                        onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.09)"; }}
                      />
                      <button
                        onClick={createEnvironment}
                        disabled={!newEnvName.trim()}
                        style={{
                          width: 30, height: 30, borderRadius: 7, cursor: "pointer", flexShrink: 0,
                          background: "rgba(139,92,246,0.15)", border: "1px solid rgba(139,92,246,0.30)",
                          color: "#A78BFA", display: "flex", alignItems: "center", justifyContent: "center",
                        }}
                      >
                        <Plus size={13} />
                      </button>
                    </div>
                  </div>
                  <div style={{ flex: 1, overflowY: "auto", padding: "8px 10px" }}>
                    {environments.length === 0 ? (
                      <p style={{ padding: "24px 8px", textAlign: "center", fontSize: "0.75rem", color: "#2D3650" }}>No environments yet</p>
                    ) : environments.map((env) => (
                      <div key={env.name} style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 3 }}>
                        <button
                          onClick={() => loadEnvSecrets(env.name)}
                          style={{
                            flex: 1, height: 34, borderRadius: 7, textAlign: "left", padding: "0 10px",
                            background: selectedEnv === env.name ? "rgba(139,92,246,0.14)" : "rgba(255,255,255,0.025)",
                            border: selectedEnv === env.name ? "1px solid rgba(139,92,246,0.28)" : "1px solid rgba(255,255,255,0.06)",
                            color: selectedEnv === env.name ? "#C4B5FD" : "#6B7A9B",
                            fontSize: "0.8125rem", fontWeight: selectedEnv === env.name ? 600 : 400, cursor: "pointer",
                            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                          }}
                        >
                          {env.name}
                        </button>
                        <button
                          onClick={() => deleteEnvironment(env.name)}
                          style={{ width: 28, height: 28, borderRadius: 6, background: "none", border: "1px solid rgba(239,68,68,0.14)", cursor: "pointer", color: "#4A5580", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 120ms" }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(239,68,68,0.10)"; e.currentTarget.style.color = "#F87171"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = "#4A5580"; }}
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {}
                <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                  {!selectedEnv ? (
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, color: "#2D3650" }}>
                      <Layers size={28} style={{ opacity: 0.2 }} />
                      <p style={{ fontSize: "0.8125rem" }}>Select an environment to manage its secrets</p>
                    </div>
                  ) : (
                    <>
                      <div style={{ padding: "14px 24px 12px", borderBottom: "1px solid rgba(255,255,255,0.05)", flexShrink: 0, display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: "0.5625rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#3A4560", marginBottom: 4 }}>
                            {selectedEnv} · {envSecrets.length} secrets
                          </p>
                          <AddSecretForm onAdd={addEnvSecret} />
                        </div>
                      </div>
                      <div style={{ flex: 1, overflowY: "auto", padding: "14px 24px" }}>
                        {envSecrets.length === 0 ? (
                          <div style={{ padding: "40px 0", textAlign: "center", color: "#2D3650" }}>
                            <KeyRound size={24} style={{ margin: "0 auto 10px", opacity: 0.2 }} />
                            <p style={{ fontSize: "0.8125rem" }}>No secrets in this environment yet.</p>
                          </div>
                        ) : envSecrets.map((s) => (
                          <SecretRow key={s.name} secret={s} onDelete={() => deleteEnvSecret(s.name)} />
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {}
        {tab === "bulk-copy" && (
          <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
            {}
            <div style={{ padding: "14px 24px", borderBottom: "1px solid rgba(255,255,255,0.05)", flexShrink: 0, background: "rgba(255,255,255,0.01)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  value={bulkName}
                  onChange={(e) => setBulkName(e.target.value)}
                  placeholder="SECRET_NAME"
                  style={{
                    flex: "0 0 220px", height: 36, borderRadius: 8, padding: "0 12px",
                    background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)",
                    color: "#C8CDD8", fontSize: "0.8125rem", fontFamily: "monospace", outline: "none",
                  }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(139,92,246,0.40)"; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.10)"; }}
                />
                <div style={{ position: "relative", flex: 1, maxWidth: 360 }}>
                  <input
                    type={bulkShowValue ? "text" : "password"}
                    value={bulkValue}
                    onChange={(e) => setBulkValue(e.target.value)}
                    placeholder="Secret value"
                    style={{
                      width: "100%", height: 36, borderRadius: 8, padding: "0 36px 0 12px",
                      background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)",
                      color: "#C8CDD8", fontSize: "0.8125rem", outline: "none",
                    }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(139,92,246,0.40)"; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.10)"; }}
                  />
                  <button
                    type="button"
                    onClick={() => setBulkShowValue(!bulkShowValue)}
                    style={{ position: "absolute", right: 9, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#3A4560" }}
                  >
                    {bulkShowValue ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                </div>
                <button
                  onClick={runBulkCopy}
                  disabled={!bulkName.trim() || !bulkValue.trim() || bulkTargets.size === 0 || bulkLoading}
                  style={{
                    height: 36, padding: "0 20px", borderRadius: 8, cursor: "pointer", flexShrink: 0,
                    background: "linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)",
                    border: "none", color: "#fff", fontSize: "0.875rem", fontWeight: 700,
                    display: "flex", alignItems: "center", gap: 7,
                    opacity: !bulkName.trim() || !bulkValue.trim() || bulkTargets.size === 0 || bulkLoading ? 0.45 : 1,
                    boxShadow: bulkTargets.size > 0 && bulkName.trim() && bulkValue.trim() ? "0 4px 16px rgba(139,92,246,0.35)" : "none",
                    transition: "all 140ms",
                  }}
                >
                  <Copy size={13} />
                  {bulkLoading ? "Copying…" : bulkTargets.size > 0 ? `Copy to ${bulkTargets.size} repo${bulkTargets.size !== 1 ? "s" : ""}` : "Copy"}
                </button>
              </div>
            </div>

            {}
            <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
              {}
              <div style={{ width: "45%", maxWidth: 480, borderRight: "1px solid rgba(255,255,255,0.06)", padding: "16px 20px", overflowY: "auto" }}>
                <p style={{ fontSize: "0.5625rem", fontWeight: 700, color: "#3A4560", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 10 }}>
                  Target Repos
                </p>
                <CompactRepoGrid
                  repos={repos}
                  selectedIds={bulkTargets}
                  onToggle={(id) => setBulkTargets((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; })}
                  onSelectAll={() => setBulkTargets(new Set(repos.map((r) => r.id)))}
                  onClearAll={() => setBulkTargets(new Set())}
                />
              </div>

              {}
              <div style={{ flex: 1, padding: "16px 20px", overflowY: "auto" }}>
                {bulkResults.length === 0 ? (
                  <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, color: "#2D3650" }}>
                    <Copy size={32} style={{ opacity: 0.15 }} />
                    <p style={{ fontSize: "0.8125rem" }}>Results appear here after copying</p>
                    <p style={{ fontSize: "0.75rem", color: "#1E2840", textAlign: "center", maxWidth: 280, lineHeight: 1.6 }}>
                      Fill in the secret name and value, select target repos, then click Copy.
                    </p>
                  </div>
                ) : (
                  <>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                      <p style={{ fontSize: "0.5625rem", fontWeight: 700, color: "#3A4560", letterSpacing: "0.12em", textTransform: "uppercase", flex: 1 }}>Results</p>
                      <span style={{ fontSize: "0.6875rem", color: "#10B981", fontWeight: 600 }}>
                        {bulkResults.filter((r) => r.success).length} succeeded
                      </span>
                      {bulkResults.some((r) => !r.success) && (
                        <span style={{ fontSize: "0.6875rem", color: "#F87171", fontWeight: 600 }}>
                          {bulkResults.filter((r) => !r.success).length} failed
                        </span>
                      )}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                      {bulkResults.map((r) => (
                        <div key={r.repo} style={{
                          display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 8,
                          background: r.success ? "rgba(16,185,129,0.04)" : "rgba(239,68,68,0.05)",
                          border: `1px solid ${r.success ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.18)"}`,
                        }}>
                          {r.success
                            ? <CheckCircle2 size={13} style={{ color: "#10B981", flexShrink: 0 }} />
                            : <AlertCircle size={13} style={{ color: "#EF4444", flexShrink: 0 }} />}
                          <span style={{ flex: 1, fontSize: "0.8125rem", color: "#8991A4", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.repo}</span>
                          {r.error && <span style={{ fontSize: "0.625rem", color: "#F87171", flexShrink: 0, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.error}</span>}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
