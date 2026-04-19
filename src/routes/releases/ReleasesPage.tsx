import React, { useState, useEffect, useCallback } from "react";
import {
  Tag, RefreshCw, Plus, Loader2, Download, Trash2, Upload,
  ChevronDown, ChevronRight, ExternalLink, Edit3, CheckCircle2, X,
} from "lucide-react";
import { open as tauriOpen } from "@tauri-apps/plugin-dialog";
import { RepoPicker } from "../../components/repos/RepoPicker";
import { useRepoStore } from "../../stores/repoStore";
import { useUIStore } from "../../stores/uiStore";
import { formatInvokeError } from "../../lib/formatError";
import {
  ghListReleases, ghCreateRelease, ghUpdateRelease, ghDeleteRelease,
  ghUploadReleaseAsset, ghDeleteReleaseAsset, ghListRepoBranchesSimple,
  openUrlExternal,
} from "../../lib/tauri/commands";
import type { Release, ReleaseAssetFull } from "../../types/governance";
import type { Repo } from "../../types/repo";

type Tab = "releases" | "create" | "overview";

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }); }
  catch { return iso; }
}

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function renderMarkdown(md: string): string {
  return md
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/`(.+?)`/g, "<code style='background:rgba(255,255,255,0.08);padding:1px 5px;border-radius:4px;font-size:0.85em'>$1</code>")
    .replace(/\n/g, "<br/>");
}

const INPUT: React.CSSProperties = {
  width: "100%", height: 34, borderRadius: 8,
  backgroundColor: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)",
  color: "#C8CDD8", fontSize: "0.875rem", padding: "0 12px", outline: "none",
};

const BADGE: React.CSSProperties = {
  display: "inline-flex", alignItems: "center",
  padding: "2px 8px", borderRadius: 8,
  fontSize: "0.6875rem", fontWeight: 700,
};

export const ReleasesPage: React.FC = () => {
  const repos = useRepoStore((s) => s.repos);
  const addToast = useUIStore((s) => s.addToast);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [viewingId, setViewingId] = useState<string>("");
  const [activeTab, setActiveTab] = useState<Tab>("releases");
  const [releases, setReleases] = useState<Release[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [editingRelease, setEditingRelease] = useState<Release | null>(null);
  const [editForm, setEditForm] = useState({ tagName: "", name: "", body: "", draft: false, prerelease: false });
  const [editLoading, setEditLoading] = useState(false);
  const [createForm, setCreateForm] = useState({ tagName: "", name: "", body: "", targetCommitish: "main", draft: false, prerelease: false });
  const [createLoading, setCreateLoading] = useState(false);
  const [branches, setBranches] = useState<string[]>([]);
  const [overviewData, setOverviewData] = useState<Map<string, Release | null>>(new Map());
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [uploadingId, setUploadingId] = useState<number | null>(null);
  const [createAssets, setCreateAssets] = useState<{ path: string; name: string }[]>([]);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);

  const viewingRepo: Repo | undefined = repos.find((r) => r.id === viewingId) ?? repos.find((r) => selectedIds.has(r.id));

  const loadReleases = useCallback(async () => {
    if (!viewingRepo) return;
    setLoading(true);
    try {
      const data = await ghListReleases(viewingRepo.owner, viewingRepo.name);
      setReleases(data);
      setExpandedId(null);
    } catch (e) {
      addToast({ type: "error", title: "Failed to load releases", message: formatInvokeError(e) });
    } finally {
      setLoading(false);
    }
  }, [viewingRepo, addToast]);

  useEffect(() => { if (viewingRepo) { loadReleases(); ghListRepoBranchesSimple(viewingRepo.owner, viewingRepo.name).then(setBranches).catch(() => {}); } }, [viewingRepo?.id]);

  const loadOverview = useCallback(async () => {
    const selectedRepos = repos.filter((r) => selectedIds.has(r.id));
    if (selectedRepos.length === 0) return;
    setOverviewLoading(true);
    const results = new Map<string, Release | null>();
    await Promise.allSettled(selectedRepos.map(async (repo) => {
      try {
        const rel = await ghListReleases(repo.owner, repo.name);
        results.set(repo.id, rel[0] ?? null);
      } catch {
        results.set(repo.id, null);
      }
    }));
    setOverviewData(results);
    setOverviewLoading(false);
  }, [repos, selectedIds]);

  useEffect(() => { if (activeTab === "overview") loadOverview(); }, [activeTab]);

  const handlePickCreateAssets = async () => {
    const selected = await tauriOpen({ multiple: true, directory: false }) as string[] | string | null;
    if (!selected) return;
    const paths = Array.isArray(selected) ? selected : [selected];
    setCreateAssets((prev) => {
      const existing = new Set(prev.map((a) => a.path));
      const newEntries = paths.filter((p) => !existing.has(p)).map((p) => ({
        path: p,
        name: p.split("/").pop() ?? p.split("\\").pop() ?? p,
      }));
      return [...prev, ...newEntries];
    });
  };

  const handleCreate = async () => {
    if (!viewingRepo || !createForm.tagName.trim()) return;
    setCreateLoading(true);
    try {
      const rel = await ghCreateRelease(viewingRepo.owner, viewingRepo.name, createForm.tagName, createForm.name, createForm.body, createForm.draft, createForm.prerelease, createForm.targetCommitish);
      let finalRel = rel;
      if (createAssets.length > 0) {
        setUploadProgress({ current: 0, total: createAssets.length });
        for (let i = 0; i < createAssets.length; i++) {
          const asset = createAssets[i];
          setUploadProgress({ current: i + 1, total: createAssets.length });
          try {
            const uploaded = await ghUploadReleaseAsset(viewingRepo.owner, viewingRepo.name, rel.id, asset.path, asset.name);
            finalRel = { ...finalRel, assets: [...finalRel.assets, uploaded] };
          } catch (e) {
            addToast({ type: "error", title: `Failed to upload ${asset.name}`, message: formatInvokeError(e) });
          }
        }
        setUploadProgress(null);
      }
      setReleases((prev) => [finalRel, ...prev]);
      addToast({ type: "success", title: `Release ${rel.tag_name} created`, message: createAssets.length > 0 ? `${createAssets.length} asset(s) uploaded.` : "Expand it to upload assets." });
      setActiveTab("releases");
      setExpandedId(rel.id);
      setCreateForm({ tagName: "", name: "", body: "", targetCommitish: "main", draft: false, prerelease: false });
      setCreateAssets([]);
    } catch (e) {
      addToast({ type: "error", title: "Failed to create release", message: formatInvokeError(e) });
    } finally {
      setCreateLoading(false);
      setUploadProgress(null);
    }
  };

  const handleEdit = async () => {
    if (!viewingRepo || !editingRelease) return;
    setEditLoading(true);
    try {
      const updated = await ghUpdateRelease(viewingRepo.owner, viewingRepo.name, editingRelease.id, editForm.tagName, editForm.name, editForm.body, editForm.draft, editForm.prerelease);
      setReleases((prev) => prev.map((r) => r.id === updated.id ? updated : r));
      addToast({ type: "success", title: "Release updated" });
      setEditingRelease(null);
    } catch (e) {
      addToast({ type: "error", title: "Failed to update release", message: formatInvokeError(e) });
    } finally {
      setEditLoading(false);
    }
  };

  const handleDelete = async (release: Release) => {
    if (!viewingRepo || !confirm(`Delete release ${release.tag_name}?`)) return;
    try {
      await ghDeleteRelease(viewingRepo.owner, viewingRepo.name, release.id);
      setReleases((prev) => prev.filter((r) => r.id !== release.id));
      addToast({ type: "success", title: "Release deleted" });
    } catch (e) {
      addToast({ type: "error", title: "Failed", message: formatInvokeError(e) });
    }
  };

  const handleDeleteAsset = async (release: Release, asset: ReleaseAssetFull) => {
    if (!viewingRepo || !confirm(`Delete asset ${asset.name}?`)) return;
    try {
      await ghDeleteReleaseAsset(viewingRepo.owner, viewingRepo.name, asset.id);
      setReleases((prev) => prev.map((r) => r.id === release.id
        ? { ...r, assets: r.assets.filter((a) => a.id !== asset.id) }
        : r));
      addToast({ type: "success", title: "Asset deleted" });
    } catch (e) {
      addToast({ type: "error", title: "Failed", message: formatInvokeError(e) });
    }
  };

  const handleUploadAsset = async (release: Release) => {
    if (!viewingRepo) return;
    const selected = await tauriOpen({ multiple: false, directory: false }) as string | null;
    if (!selected) return;
    const assetName = selected.split("/").pop() ?? selected.split("\\").pop() ?? "asset";
    setUploadingId(release.id);
    try {
      const asset = await ghUploadReleaseAsset(viewingRepo.owner, viewingRepo.name, release.id, selected, assetName);
      setReleases((prev) => prev.map((r) => r.id === release.id
        ? { ...r, assets: [...r.assets, asset] }
        : r));
      addToast({ type: "success", title: `${assetName} uploaded` });
    } catch (e) {
      addToast({ type: "error", title: "Upload failed", message: formatInvokeError(e) });
    } finally {
      setUploadingId(null);
    }
  };

  const TAB_STYLE = (active: boolean): React.CSSProperties => ({
    padding: "6px 16px", borderRadius: 8, cursor: "pointer", border: "none",
    background: active ? "rgba(139,92,246,0.18)" : "transparent",
    color: active ? "#C4B5FD" : "#7A8AAE", fontSize: "0.8125rem", fontWeight: 500,
    transition: "all 130ms ease",
  });

  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden" }}>
      <RepoPicker
        selectedIds={selectedIds}
        onToggle={(id) => { setSelectedIds((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; }); setViewingId(id); }}
        onSelectAll={() => setSelectedIds(new Set(repos.map((r) => r.id)))}
        onClearAll={() => setSelectedIds(new Set())}
      />

      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", padding: "20px 24px 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <Tag size={18} style={{ color: "#8B5CF6" }} />
          <h1 style={{ fontSize: "1.125rem", fontWeight: 700, color: "#D4D8E8" }}>Releases</h1>
          {viewingRepo && <span style={{ fontSize: "0.8125rem", color: "#4A5580" }}>{viewingRepo.full_name}</span>}
          <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
            <button type="button" style={TAB_STYLE(activeTab === "releases")} onClick={() => setActiveTab("releases")}>Releases</button>
            <button type="button" style={TAB_STYLE(activeTab === "create")} onClick={() => setActiveTab("create")}>
              <Plus size={13} style={{ display: "inline", marginRight: 4 }} />Create
            </button>
            <button type="button" style={TAB_STYLE(activeTab === "overview")} onClick={() => setActiveTab("overview")}>Overview</button>
          </div>
        </div>

        {activeTab === "releases" && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <button type="button" onClick={loadReleases} title="Refresh"
                style={{ padding: 6, borderRadius: 7, border: "none", background: "rgba(255,255,255,0.05)", color: "#7A8AAE", cursor: "pointer" }}>
                <RefreshCw size={14} style={loading ? { animation: "spin 1s linear infinite" } : {}} />
              </button>
            </div>
            {!viewingRepo ? (
              <div style={{ padding: 32, textAlign: "center", color: "#4A5580", fontSize: "0.875rem" }}>Select a repository</div>
            ) : loading ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 120, gap: 8, color: "#7A8AAE" }}>
                <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /><span>Loading releases…</span>
              </div>
            ) : (
              <div style={{ flex: 1, overflowY: "auto" }}>
                {releases.length === 0 && <div style={{ padding: 32, textAlign: "center", color: "#4A5580", fontSize: "0.875rem" }}>No releases yet.</div>}
                {releases.map((rel) => (
                  <div key={rel.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.055)", marginBottom: 1 }}>
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", cursor: "pointer", borderRadius: 8, background: expandedId === rel.id ? "rgba(139,92,246,0.07)" : "transparent", transition: "background 120ms ease" }}
                      onClick={() => setExpandedId(expandedId === rel.id ? null : rel.id)}
                    >
                      <Tag size={14} style={{ color: "#8B5CF6", flexShrink: 0 }} />
                      <span style={{ fontFamily: "monospace", fontSize: "0.875rem", fontWeight: 700, color: "#C4B5FD", flexShrink: 0 }}>{rel.tag_name}</span>
                      <span style={{ fontSize: "0.8125rem", color: "#C8CDD8", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{rel.name ?? ""}</span>
                      {rel.draft && <span style={{ ...BADGE, background: "rgba(107,114,128,0.2)", color: "#9CA3AF", border: "1px solid rgba(107,114,128,0.3)" }}>Draft</span>}
                      {rel.prerelease && <span style={{ ...BADGE, background: "rgba(245,158,11,0.15)", color: "#FCD34D", border: "1px solid rgba(245,158,11,0.25)" }}>Pre-release</span>}
                      <span style={{ fontSize: "0.6875rem", color: "#4A5580", flexShrink: 0 }}>{rel.assets.length} asset{rel.assets.length !== 1 ? "s" : ""}</span>
                      <span style={{ fontSize: "0.6875rem", color: "#3A4560", flexShrink: 0 }}>{fmtDate(rel.published_at)}</span>
                      {expandedId === rel.id ? <ChevronDown size={13} style={{ color: "#6B7280" }} /> : <ChevronRight size={13} style={{ color: "#6B7280" }} />}
                    </div>

                    {expandedId === rel.id && (
                      <div style={{ padding: "0 16px 16px 40px" }}>
                        {rel.body && (
                          <div style={{ fontSize: "0.8125rem", color: "#9AA5BE", lineHeight: 1.7, marginBottom: 12, padding: "10px 14px", background: "rgba(255,255,255,0.025)", borderRadius: 8 }}
                            dangerouslySetInnerHTML={{ __html: renderMarkdown(rel.body) }} />
                        )}
                        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                          <button type="button"
                            onClick={() => { setEditingRelease(rel); setEditForm({ tagName: rel.tag_name, name: rel.name ?? "", body: rel.body ?? "", draft: rel.draft, prerelease: rel.prerelease }); }}
                            style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 7, cursor: "pointer", border: "1px solid rgba(255,255,255,0.10)", background: "transparent", color: "#7A8AAE", fontSize: "0.8125rem" }}>
                            <Edit3 size={12} />Edit
                          </button>
                          <button type="button"
                            onClick={() => { if (uploadingId !== rel.id) handleUploadAsset(rel); }}
                            style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 7, cursor: "pointer", border: "1px solid rgba(255,255,255,0.10)", background: "transparent", color: "#7A8AAE", fontSize: "0.8125rem" }}>
                            {uploadingId === rel.id ? <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} /> : <Upload size={12} />}
                            Upload Asset
                          </button>
                          <button type="button" onClick={() => openUrlExternal(rel.html_url)}
                            style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 7, cursor: "pointer", border: "1px solid rgba(255,255,255,0.10)", background: "transparent", color: "#7A8AAE", fontSize: "0.8125rem" }}>
                            <ExternalLink size={12} />Open
                          </button>
                          <button type="button" onClick={() => handleDelete(rel)}
                            style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 7, cursor: "pointer", border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.08)", color: "#FCA5A5", fontSize: "0.8125rem" }}>
                            <Trash2 size={12} />Delete
                          </button>
                        </div>
                        {rel.assets.length > 0 && (
                          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            <p style={{ fontSize: "0.75rem", color: "#4A5580", marginBottom: 4 }}>Assets</p>
                            {rel.assets.map((asset) => (
                              <div key={asset.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 12px", background: "rgba(255,255,255,0.025)", borderRadius: 8 }}>
                                <span style={{ fontSize: "0.8125rem", color: "#C8CDD8", flex: 1 }}>{asset.name}</span>
                                <span style={{ fontSize: "0.6875rem", color: "#4A5580" }}>{fmtSize(asset.size)}</span>
                                <span style={{ fontSize: "0.6875rem", color: "#4A5580" }}>{asset.download_count} dl</span>
                                <button type="button" onClick={() => openUrlExternal(asset.browser_download_url)}
                                  style={{ padding: "3px 10px", borderRadius: 6, cursor: "pointer", border: "none", background: "rgba(139,92,246,0.15)", color: "#C4B5FD", fontSize: "0.75rem" }}>
                                  <Download size={11} style={{ display: "inline", marginRight: 4 }} />Download
                                </button>
                                <button type="button" onClick={() => handleDeleteAsset(rel, asset)}
                                  style={{ padding: "3px 8px", borderRadius: 6, cursor: "pointer", border: "none", background: "rgba(239,68,68,0.12)", color: "#FCA5A5", fontSize: "0.75rem" }}>
                                  <Trash2 size={11} />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "create" && (
          <div style={{ maxWidth: 560, display: "flex", flexDirection: "column", gap: 14 }}>
            {!viewingRepo && <div style={{ color: "#F59E0B", fontSize: "0.875rem" }}>Select a repository first.</div>}
            <div style={{ display: "flex", gap: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: "0.75rem", color: "#7A8AAE", marginBottom: 4, display: "block" }}>Tag name *</label>
                <input value={createForm.tagName} onChange={(e) => setCreateForm((f) => ({ ...f, tagName: e.target.value }))} placeholder="v1.0.0" style={INPUT} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: "0.75rem", color: "#7A8AAE", marginBottom: 4, display: "block" }}>Release name</label>
                <input value={createForm.name} onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))} placeholder="Release v1.0.0" style={INPUT} />
              </div>
            </div>
            <div>
              <label style={{ fontSize: "0.75rem", color: "#7A8AAE", marginBottom: 4, display: "block" }}>Target branch</label>
              <select value={createForm.targetCommitish} onChange={(e) => setCreateForm((f) => ({ ...f, targetCommitish: e.target.value }))}
                style={{ ...INPUT, cursor: "pointer" }}>
                {branches.map((b) => <option key={b} value={b}>{b}</option>)}
                <option value="main">main</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: "0.75rem", color: "#7A8AAE", marginBottom: 4, display: "block" }}>Release notes</label>
              <textarea value={createForm.body} onChange={(e) => setCreateForm((f) => ({ ...f, body: e.target.value }))}
                placeholder="Describe this release…"
                style={{ width: "100%", minHeight: 140, borderRadius: 8, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)", color: "#C8CDD8", fontSize: "0.875rem", padding: "10px 12px", outline: "none", resize: "vertical" }} />
            </div>
            <div style={{ display: "flex", gap: 16 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: "0.875rem", color: "#9AA5BE" }}>
                <input type="checkbox" checked={createForm.draft} onChange={(e) => setCreateForm((f) => ({ ...f, draft: e.target.checked }))} style={{ accentColor: "#8B5CF6" }} />
                Draft
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: "0.875rem", color: "#9AA5BE" }}>
                <input type="checkbox" checked={createForm.prerelease} onChange={(e) => setCreateForm((f) => ({ ...f, prerelease: e.target.checked }))} style={{ accentColor: "#8B5CF6" }} />
                Pre-release
              </label>
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <label style={{ fontSize: "0.75rem", color: "#7A8AAE" }}>Assets to upload ({createAssets.length})</label>
                <button type="button" onClick={handlePickCreateAssets}
                  style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 12px", borderRadius: 7, cursor: "pointer", border: "1px solid rgba(139,92,246,0.35)", background: "rgba(139,92,246,0.1)", color: "#C4B5FD", fontSize: "0.8125rem" }}>
                  <Upload size={12} />Pick files
                </button>
              </div>
              {createAssets.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {createAssets.map((a) => (
                    <div key={a.path} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 10px", background: "rgba(255,255,255,0.03)", borderRadius: 7, border: "1px solid rgba(255,255,255,0.07)" }}>
                      <span style={{ flex: 1, fontSize: "0.8125rem", color: "#C8CDD8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.name}</span>
                      <button type="button" onClick={() => setCreateAssets((prev) => prev.filter((x) => x.path !== a.path))}
                        style={{ background: "none", border: "none", color: "#6B7280", cursor: "pointer", padding: 2, flexShrink: 0 }}>
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {uploadProgress && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: "0.75rem", color: "#C4B5FD", marginBottom: 4 }}>Uploading {uploadProgress.current}/{uploadProgress.total}…</div>
                  <div style={{ height: 4, borderRadius: 4, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
                    <div style={{ height: "100%", borderRadius: 4, background: "linear-gradient(90deg, #8B5CF6, #6D3CDD)", width: `${(uploadProgress.current / uploadProgress.total) * 100}%`, transition: "width 200ms ease" }} />
                  </div>
                </div>
              )}
            </div>
            <button type="button" onClick={handleCreate} disabled={createLoading || !createForm.tagName.trim() || !viewingRepo}
              style={{ alignSelf: "flex-start", padding: "8px 24px", borderRadius: 8, cursor: "pointer", border: "none", background: "linear-gradient(135deg, rgba(139,92,246,0.45), rgba(109,60,221,0.45))", color: "#E0D7FF", fontSize: "0.875rem", fontWeight: 700, opacity: createLoading || !createForm.tagName.trim() || !viewingRepo ? 0.5 : 1 }}>
              {uploadProgress ? `Uploading ${uploadProgress.current}/${uploadProgress.total}…` : createLoading ? "Creating…" : createAssets.length > 0 ? `Create & Upload ${createAssets.length} file(s)` : "Create Release"}
            </button>
          </div>
        )}

        {activeTab === "overview" && (
          <div style={{ flex: 1, overflowY: "auto" }}>
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <button type="button" onClick={loadOverview} disabled={overviewLoading}
                style={{ padding: "5px 14px", borderRadius: 7, border: "none", background: "rgba(139,92,246,0.15)", color: "#C4B5FD", cursor: "pointer", fontSize: "0.8125rem" }}>
                {overviewLoading ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite", display: "inline" }} /> : <RefreshCw size={13} style={{ display: "inline" }} />} Refresh
              </button>
            </div>
            {repos.filter((r) => selectedIds.has(r.id)).map((repo) => {
              const rel = overviewData.get(repo.id);
              return (
                <div key={repo.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderBottom: "1px solid rgba(255,255,255,0.055)" }}>
                  <span style={{ flex: 1, fontSize: "0.875rem", color: "#C8CDD8", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{repo.full_name}</span>
                  {rel === undefined ? (
                    <span style={{ fontSize: "0.75rem", color: "#4A5580" }}>—</span>
                  ) : rel === null ? (
                    <span style={{ fontSize: "0.75rem", color: "#EF4444", background: "rgba(239,68,68,0.1)", padding: "2px 8px", borderRadius: 6 }}>No releases</span>
                  ) : (
                    <>
                      <span style={{ fontFamily: "monospace", fontSize: "0.8125rem", color: "#C4B5FD", background: "rgba(139,92,246,0.12)", padding: "2px 8px", borderRadius: 6 }}>{rel.tag_name}</span>
                      <span style={{ fontSize: "0.6875rem", color: "#4A5580" }}>{fmtDate(rel.published_at)}</span>
                    </>
                  )}
                  <button type="button" onClick={() => { setViewingId(repo.id); setSelectedIds(new Set([repo.id])); setActiveTab("releases"); }}
                    style={{ padding: "3px 10px", borderRadius: 6, cursor: "pointer", border: "1px solid rgba(255,255,255,0.10)", background: "transparent", color: "#7A8AAE", fontSize: "0.75rem" }}>
                    View
                  </button>
                </div>
              );
            })}
            {repos.filter((r) => selectedIds.has(r.id)).length === 0 && (
              <div style={{ padding: 32, textAlign: "center", color: "#4A5580", fontSize: "0.875rem" }}>Select repositories to see their latest release.</div>
            )}
          </div>
        )}
      </div>

      {editingRelease && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: 520, background: "#0D1025", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 14, padding: 24, display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "#D4D8E8" }}>Edit Release</h2>
              <button type="button" onClick={() => setEditingRelease(null)} style={{ background: "none", border: "none", color: "#7A8AAE", cursor: "pointer" }}><X size={16} /></button>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: "0.75rem", color: "#7A8AAE", display: "block", marginBottom: 4 }}>Tag</label>
                <input value={editForm.tagName} onChange={(e) => setEditForm((f) => ({ ...f, tagName: e.target.value }))} style={INPUT} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: "0.75rem", color: "#7A8AAE", display: "block", marginBottom: 4 }}>Name</label>
                <input value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} style={INPUT} />
              </div>
            </div>
            <textarea value={editForm.body} onChange={(e) => setEditForm((f) => ({ ...f, body: e.target.value }))}
              style={{ width: "100%", minHeight: 120, borderRadius: 8, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)", color: "#C8CDD8", fontSize: "0.875rem", padding: "8px 12px", outline: "none", resize: "vertical" }} />
            <div style={{ display: "flex", gap: 16 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: "0.875rem", color: "#9AA5BE" }}>
                <input type="checkbox" checked={editForm.draft} onChange={(e) => setEditForm((f) => ({ ...f, draft: e.target.checked }))} style={{ accentColor: "#8B5CF6" }} />Draft
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: "0.875rem", color: "#9AA5BE" }}>
                <input type="checkbox" checked={editForm.prerelease} onChange={(e) => setEditForm((f) => ({ ...f, prerelease: e.target.checked }))} style={{ accentColor: "#8B5CF6" }} />Pre-release
              </label>
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button type="button" onClick={() => setEditingRelease(null)} style={{ padding: "7px 18px", borderRadius: 8, cursor: "pointer", border: "1px solid rgba(255,255,255,0.10)", background: "transparent", color: "#7A8AAE", fontSize: "0.875rem" }}>Cancel</button>
              <button type="button" onClick={handleEdit} disabled={editLoading}
                style={{ padding: "7px 18px", borderRadius: 8, cursor: "pointer", border: "none", background: "rgba(139,92,246,0.3)", color: "#E0D7FF", fontSize: "0.875rem", fontWeight: 600 }}>
                {editLoading ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
