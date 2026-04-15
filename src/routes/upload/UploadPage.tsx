import React, { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FolderOpen, Upload, CheckCircle, XCircle, ChevronDown, X, ExternalLink, Clipboard } from "lucide-react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { listen } from "@tauri-apps/api/event";
import { readLocalDir, uploadFilesToRepo, openUrlExternal } from "../../lib/tauri/commands";
import type { FileEntry, UploadFileInput } from "../../lib/tauri/commands";
import { FileTree, collectPaths } from "./FileTree";
import { useRepoStore } from "../../stores/repoStore";
import { ContextMenu } from "../../components/shared/ContextMenu";
import type { ContextMenuItemDef } from "../../components/shared/ContextMenu";

interface ProgressEvent {
  file: string;
  status: string;
  done: number;
  total: number;
}

type UploadState = "idle" | "loading-tree" | "ready" | "uploading" | "done" | "error";

export const UploadPage: React.FC = () => {
  const repos = useRepoStore((s) => s.repos);

  const [folderPath, setFolderPath] = useState<string>("");
  const [folderName, setFolderName] = useState<string>("");
  const [tree, setTree] = useState<FileEntry[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [targetRepo, setTargetRepo] = useState<string>("");
  const [branch, setBranch] = useState<string>("main");
  const [targetPath, setTargetPath] = useState<string>("");
  const [commitMessage, setCommitMessage] = useState<string>("Upload files via ZRepoManager");
  const [repoDropOpen, setRepoDropOpen] = useState(false);
  const [repoSearch, setRepoSearch] = useState("");

  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [progress, setProgress] = useState<ProgressEvent | null>(null);
  const [resultUrl, setResultUrl] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string>("");

  const unlisten = useRef<(() => void) | null>(null);

  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; entry: FileEntry; paths: string[] } | null>(null);

  const handleFileCtxMenu = useCallback((e: React.MouseEvent, entry: FileEntry, paths: string[]) => {
    e.preventDefault();
    setCtxMenu({ x: e.clientX, y: e.clientY, entry, paths });
  }, []);

  const filteredRepos = repos.filter(r =>
    !r.archived && !r.fork &&
    (repoSearch === "" || r.full_name.toLowerCase().includes(repoSearch.toLowerCase()))
  );

  const selectedCount = selected.size;
  const totalCount = tree.flatMap(collectPaths).length;
  const canUpload = !!(targetRepo && selectedCount > 0 && uploadState === "ready");

  const pickFolder = useCallback(async () => {
    try {
      const result = await openDialog({ directory: true, multiple: false, title: "Select folder to upload" });
      if (!result || typeof result !== "string") return;
      setFolderPath(result);
      setFolderName(result.split(/[\\/]/).pop() ?? result);
      setUploadState("loading-tree");
      setSelected(new Set());
      setTree([]);
      const entries = await readLocalDir(result);
      setTree(entries);
      setSelected(new Set(entries.flatMap(collectPaths)));
      setUploadState("ready");
    } catch (e) {
      setErrorMsg(String(e));
      setUploadState("error");
    }
  }, []);

  const handleToggle = useCallback((paths: string[], checked: boolean) => {
    setSelected(prev => {
      const next = new Set(prev);
      paths.forEach(p => checked ? next.add(p) : next.delete(p));
      return next;
    });
  }, []);

  const buildCtxItems = useCallback((entry: FileEntry, paths: string[]): ContextMenuItemDef[] => {
    const allSelected = paths.every(p => selected.has(p));
    const noneSelected = paths.every(p => !selected.has(p));
    if (entry.is_dir) {
      return [
        { type: "item", label: "Select all in folder", icon: Upload, disabled: allSelected, onClick: () => handleToggle(paths, true) },
        { type: "item", label: "Deselect all in folder", disabled: noneSelected, onClick: () => handleToggle(paths, false) },
        { type: "divider" },
        { type: "item", label: "Copy folder path", icon: Clipboard, onClick: () => { navigator.clipboard.writeText(entry.path).catch(() => {}); } },
      ];
    }
    const isChecked = selected.has(entry.path);
    return [
      { type: "item", label: isChecked ? "Deselect file" : "Select file", icon: Upload, onClick: () => handleToggle([entry.path], !isChecked) },
      { type: "divider" },
      { type: "item", label: "Copy path", icon: Clipboard, onClick: () => { navigator.clipboard.writeText(entry.path).catch(() => {}); } },
    ];
  }, [selected, handleToggle]);

  const handleUpload = useCallback(async () => {
    if (!targetRepo || selected.size === 0 || !folderPath) return;
    const [owner, repo] = targetRepo.split("/");
    const files: UploadFileInput[] = Array.from(selected).map(relPath => ({
      local_path: folderPath.replace(/\\/g, "/") + "/" + relPath,
      repo_path: relPath,
    }));
    setUploadState("uploading");
    setProgress(null);
    setErrorMsg("");
    if (unlisten.current) unlisten.current();
    unlisten.current = await listen<ProgressEvent>("upload://progress", (e) => setProgress(e.payload));
    try {
      const result = await uploadFilesToRepo(owner, repo, branch, targetPath, files, commitMessage);
      setResultUrl(result.commit_url);
      setUploadState("done");
    } catch (e) {
      setErrorMsg(String(e));
      setUploadState("error");
    } finally {
      if (unlisten.current) { unlisten.current(); unlisten.current = null; }
    }
  }, [targetRepo, selected, folderPath, branch, targetPath, commitMessage]);

  useEffect(() => () => { if (unlisten.current) unlisten.current(); }, []);

  return (
    <div style={{
      position: "absolute", inset: 0,
      display: "flex", flexDirection: "column",
      padding: "24px 28px", gap: 16, overflow: "hidden",
    }}>

      <motion.div
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
        style={{ display: "flex", gap: 20, flex: 1, minHeight: 0 }}
      >

        <div style={{ width: 320, flexShrink: 0, display: "flex", flexDirection: "column", gap: 12, overflowY: "auto", paddingRight: 4 }}>


          <div style={{ borderRadius: 12, background: "rgba(255,255,255,0.028)", border: "1px solid rgba(255,255,255,0.065)", padding: "16px 18px" }}>
            <p style={{ margin: "0 0 10px", fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase", color: "#3A4060" }}>Target Repository</p>
            <div style={{ position: "relative" }}>
              <button
                onClick={() => setRepoDropOpen(v => !v)}
                style={{
                  width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "8px 12px", borderRadius: 8, cursor: "pointer",
                  background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)",
                  color: targetRepo ? "#C8CDD8" : "#4A5580", fontSize: "0.8125rem", fontWeight: 500,
                  transition: "border-color 130ms ease",
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(139,92,246,0.35)"; }}
                onMouseLeave={e => { if (!repoDropOpen) (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.10)"; }}
              >
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {targetRepo || "Select a repository…"}
                </span>
                <ChevronDown size={13} style={{ flexShrink: 0, color: "#4A5580", transform: repoDropOpen ? "rotate(180deg)" : "none", transition: "transform 150ms" }} />
              </button>
              <AnimatePresence>
                {repoDropOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.15 }}
                    style={{
                      position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, zIndex: 50,
                      borderRadius: 10, background: "#0D1025", border: "1px solid rgba(255,255,255,0.10)",
                      boxShadow: "0 12px 40px rgba(0,0,0,0.55)", overflow: "hidden",
                    }}
                  >
                    <div style={{ padding: "8px 10px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                      <input autoFocus placeholder="Search repos…" value={repoSearch} onChange={e => setRepoSearch(e.target.value)}
                        style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6, padding: "6px 10px", color: "#C8CDD8", fontSize: "0.8125rem", outline: "none" }}
                      />
                    </div>
                    <div style={{ maxHeight: 200, overflowY: "auto" }}>
                      {filteredRepos.slice(0, 80).map(r => (
                        <div key={r.id} onClick={() => { setTargetRepo(r.full_name); setRepoDropOpen(false); setRepoSearch(""); }}
                          style={{ padding: "8px 14px", cursor: "pointer", fontSize: "0.8125rem", color: r.full_name === targetRepo ? "#A78BFA" : "#8A91A8", background: r.full_name === targetRepo ? "rgba(139,92,246,0.10)" : "transparent", transition: "background 100ms" }}
                          onMouseEnter={e => { if (r.full_name !== targetRepo) (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.04)"; }}
                          onMouseLeave={e => { if (r.full_name !== targetRepo) (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}
                        >{r.full_name}</div>
                      ))}
                      {filteredRepos.length === 0 && <div style={{ padding: "16px 14px", fontSize: "0.8125rem", color: "#3A4060", textAlign: "center" }}>No repos found</div>}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
              <div style={{ flex: 1 }}>
                <p style={{ margin: "0 0 5px", fontSize: "0.6875rem", color: "#3A4060" }}>Branch</p>
                <input value={branch} onChange={e => setBranch(e.target.value)} placeholder="main"
                  style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 7, padding: "7px 10px", color: "#C8CDD8", fontSize: "0.8125rem", outline: "none", transition: "border-color 130ms" }}
                  onFocus={e => { (e.target as HTMLInputElement).style.borderColor = "rgba(139,92,246,0.40)"; }}
                  onBlur={e => { (e.target as HTMLInputElement).style.borderColor = "rgba(255,255,255,0.08)"; }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ margin: "0 0 5px", fontSize: "0.6875rem", color: "#3A4060" }}>Target path <span style={{ color: "#2D3450" }}>(opt.)</span></p>
                <input value={targetPath} onChange={e => setTargetPath(e.target.value)} placeholder="e.g. src/assets"
                  style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 7, padding: "7px 10px", color: "#C8CDD8", fontSize: "0.8125rem", outline: "none", transition: "border-color 130ms" }}
                  onFocus={e => { (e.target as HTMLInputElement).style.borderColor = "rgba(139,92,246,0.40)"; }}
                  onBlur={e => { (e.target as HTMLInputElement).style.borderColor = "rgba(255,255,255,0.08)"; }}
                />
              </div>
            </div>
          </div>


          <div style={{ borderRadius: 12, background: "rgba(255,255,255,0.028)", border: "1px solid rgba(255,255,255,0.065)", padding: "16px 18px" }}>
            <p style={{ margin: "0 0 10px", fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase", color: "#3A4060" }}>Commit Message</p>
            <textarea value={commitMessage} onChange={e => setCommitMessage(e.target.value)} rows={2}
              style={{ width: "100%", resize: "none", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 7, padding: "8px 10px", color: "#C8CDD8", fontSize: "0.8125rem", outline: "none", fontFamily: "inherit", lineHeight: 1.5, transition: "border-color 130ms" }}
              onFocus={e => { (e.target as HTMLTextAreaElement).style.borderColor = "rgba(139,92,246,0.40)"; }}
              onBlur={e => { (e.target as HTMLTextAreaElement).style.borderColor = "rgba(255,255,255,0.08)"; }}
            />
          </div>


          <motion.button onClick={canUpload ? handleUpload : undefined} whileTap={canUpload ? { scale: 0.97 } : undefined}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              padding: "12px 20px", borderRadius: 10, cursor: canUpload ? "pointer" : "not-allowed",
              background: canUpload ? "linear-gradient(135deg, #8B5CF6, #7C3AED)" : "rgba(255,255,255,0.04)",
              border: canUpload ? "1px solid rgba(139,92,246,0.40)" : "1px solid rgba(255,255,255,0.06)",
              color: canUpload ? "#fff" : "#3A4060",
              fontSize: "0.875rem", fontWeight: 700, letterSpacing: "-0.01em",
              boxShadow: canUpload ? "0 4px 20px rgba(139,92,246,0.30)" : "none",
              transition: "all 150ms ease",
            }}
          >
            <Upload size={15} />
            {selectedCount > 0 ? `Upload ${selectedCount} file${selectedCount !== 1 ? "s" : ""}` : "Upload files"}
          </motion.button>

        </div>


        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
          <div style={{
            flex: 1, minHeight: 0,
            borderRadius: 12, background: "rgba(255,255,255,0.028)", border: "1px solid rgba(255,255,255,0.065)",
            display: "flex", flexDirection: "column", overflow: "hidden",
          }}>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px 10px", flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <p style={{ margin: 0, fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase", color: "#3A4060" }}>Files</p>
                {uploadState === "ready" && (
                  <span style={{ fontSize: "0.6875rem", color: "#4A5580" }}>{selectedCount} / {totalCount} selected</span>
                )}
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {uploadState === "ready" && (
                  <>
                    <button onClick={() => setSelected(new Set(tree.flatMap(collectPaths)))} style={{ fontSize: "0.6875rem", color: "#8B5CF6", background: "none", border: "none", cursor: "pointer", padding: "2px 6px" }}>all</button>
                    <button onClick={() => setSelected(new Set())} style={{ fontSize: "0.6875rem", color: "#4A5580", background: "none", border: "none", cursor: "pointer", padding: "2px 6px" }}>none</button>
                  </>
                )}
                <button onClick={pickFolder}
                  style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 7, cursor: "pointer", background: "rgba(245,158,11,0.10)", border: "1px solid rgba(245,158,11,0.22)", color: "#FCD34D", fontSize: "0.75rem", fontWeight: 600, transition: "all 130ms ease" }}
                  onMouseEnter={e => { const b = e.currentTarget; b.style.background = "rgba(245,158,11,0.18)"; b.style.borderColor = "rgba(245,158,11,0.40)"; }}
                  onMouseLeave={e => { const b = e.currentTarget; b.style.background = "rgba(245,158,11,0.10)"; b.style.borderColor = "rgba(245,158,11,0.22)"; }}
                >
                  <FolderOpen size={12} />
                  {folderPath ? "Change folder" : "Pick folder"}
                </button>
              </div>
            </div>


            <div style={{
              flex: 1, minHeight: 0,
              overflowY: "auto", overflowX: "hidden",
              padding: "0 10px 10px",

              scrollbarWidth: "thin" as const,
              scrollbarColor: "rgba(139,92,246,0.25) transparent",
            }}>
              {uploadState === "idle" && (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 12, padding: "60px 20px" }}>
                  <div style={{ width: 48, height: 48, borderRadius: 14, background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <FolderOpen size={22} style={{ color: "#F59E0B" }} />
                  </div>
                  <p style={{ margin: 0, fontSize: "0.8125rem", color: "#4A5580", textAlign: "center" }}>Pick a local folder to see its files</p>
                </div>
              )}
              {uploadState === "loading-tree" && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
                  <div style={{ width: 28, height: 28, borderRadius: "50%", border: "2px solid rgba(245,158,11,0.15)", borderTopColor: "#F59E0B", animation: "spin 0.8s linear infinite" }} />
                </div>
              )}
              {(uploadState === "ready" || uploadState === "uploading") && (
                <FileTree entries={tree} selected={selected} onToggle={handleToggle} onCtxMenu={handleFileCtxMenu} />
              )}
            </div>


            {folderPath && uploadState !== "idle" && uploadState !== "loading-tree" && (
              <div style={{ padding: "8px 18px", borderTop: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                <FolderOpen size={11} style={{ color: "#F59E0B", flexShrink: 0 }} />
                <span style={{ fontSize: "0.6875rem", color: "#3A4060", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }} title={folderPath}>
                  {folderName}
                </span>
                <button onClick={() => { setFolderPath(""); setFolderName(""); setTree([]); setSelected(new Set()); setUploadState("idle"); }}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#3A4060", flexShrink: 0, display: "flex", padding: 2 }}>
                  <X size={11} />
                </button>
              </div>
            )}
          </div>
        </div>
      </motion.div>


      <AnimatePresence>
        {uploadState === "uploading" && progress && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            style={{ borderRadius: 12, background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.20)", padding: "14px 18px", flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <p style={{ margin: 0, fontSize: "0.8125rem", fontWeight: 600, color: "#A78BFA" }}>Uploading… {progress.done} / {progress.total}</p>
              <span style={{ fontSize: "0.75rem", color: "#6B5FA0" }}>{Math.round((progress.done / progress.total) * 100)}%</span>
            </div>
            <div style={{ height: 4, borderRadius: 4, background: "rgba(139,92,246,0.15)", overflow: "hidden" }}>
              <motion.div animate={{ width: `${(progress.done / progress.total) * 100}%` }} transition={{ type: "spring", stiffness: 120, damping: 20 }}
                style={{ height: "100%", borderRadius: 4, background: "linear-gradient(90deg, #8B5CF6, #A78BFA)" }} />
            </div>
            <p style={{ margin: "6px 0 0", fontSize: "0.6875rem", color: "#4A5580", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{progress.file}</p>
          </motion.div>
        )}

        {uploadState === "done" && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            style={{ borderRadius: 12, background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.22)", padding: "14px 18px", display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
            <CheckCircle size={18} style={{ color: "#10B981", flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: "0.875rem", fontWeight: 600, color: "#34D399" }}>Upload complete</p>
              <p style={{ margin: "2px 0 0", fontSize: "0.75rem", color: "#3A6050" }}>{progress?.total ?? selectedCount} file{(progress?.total ?? selectedCount) !== 1 ? "s" : ""} committed to {targetRepo}</p>
            </div>
            {resultUrl && (
              <button onClick={() => openUrlExternal(resultUrl)}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 7, cursor: "pointer", background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.25)", color: "#34D399", fontSize: "0.75rem", fontWeight: 600, flexShrink: 0, transition: "all 130ms" }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(16,185,129,0.20)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(16,185,129,0.12)"; }}
              >
                <ExternalLink size={11} /> View commit
              </button>
            )}
            <button onClick={() => { setUploadState("ready"); setProgress(null); setResultUrl(""); }}
              style={{ background: "none", border: "none", cursor: "pointer", color: "#3A4060", padding: 4, display: "flex" }}>
              <X size={14} />
            </button>
          </motion.div>
        )}

        {uploadState === "error" && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            style={{ borderRadius: 12, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.22)", padding: "14px 18px", display: "flex", alignItems: "flex-start", gap: 12, flexShrink: 0 }}>
            <XCircle size={18} style={{ color: "#EF4444", flexShrink: 0, marginTop: 1 }} />
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: "0.875rem", fontWeight: 600, color: "#F87171" }}>Upload failed</p>
              <p style={{ margin: "4px 0 0", fontSize: "0.75rem", color: "#7A3030", lineHeight: 1.5 }}>{errorMsg}</p>
            </div>
            <button onClick={() => { setUploadState(folderPath ? "ready" : "idle"); setErrorMsg(""); }}
              style={{ background: "none", border: "none", cursor: "pointer", color: "#3A4060", padding: 4, display: "flex" }}>
              <X size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {ctxMenu && (
        <ContextMenu
          x={ctxMenu.x} y={ctxMenu.y}
          items={buildCtxItems(ctxMenu.entry, ctxMenu.paths)}
          onClose={() => setCtxMenu(null)}
        />
      )}
    </div>
  );
};
