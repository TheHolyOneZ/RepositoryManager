import React, { useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FilePen, ChevronDown, Search, Trash2, Pencil, MoveRight,
  CheckCircle, XCircle, X, ExternalLink, FileText, File,
  FolderOpen, RefreshCw, List, Folder, ChevronRight, Clipboard,
} from "lucide-react";
import { repoGetTree, repoApplyFileOps, openUrlExternal } from "../../lib/tauri/commands";
import type { RepoFile, FileOp } from "../../lib/tauri/commands";
import { PendingOps } from "./PendingOps";
import { useRepoStore } from "../../stores/repoStore";
import { ContextMenu } from "../../components/shared/ContextMenu";
import type { ContextMenuItemDef } from "../../components/shared/ContextMenu";

function formatSize(b: number) {
  if (b < 1024) return `${b}B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)}KB`;
  return `${(b / (1024 * 1024)).toFixed(1)}MB`;
}

function fileIcon(name: string) {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const code = ["ts","tsx","js","jsx","rs","py","go","java","cpp","c","cs","rb","swift","kt","json","toml","yaml","yml","md"];
  return code.includes(ext)
    ? <FileText size={12} style={{ color: "#8B5CF6", flexShrink: 0 }} />
    : <File size={12} style={{ color: "#4A5580", flexShrink: 0 }} />;
}


interface RepoTreeNode {
  name: string;
  path: string;
  isDir: boolean;
  children: RepoTreeNode[];
  file?: RepoFile;
}

function buildFileTree(files: RepoFile[]): RepoTreeNode[] {
  const dirMap = new Map<string, RepoTreeNode>();
  const root: RepoTreeNode[] = [];

  function ensureDir(dirPath: string): RepoTreeNode {
    if (dirMap.has(dirPath)) return dirMap.get(dirPath)!;
    const name = dirPath.split("/").pop()!;
    const node: RepoTreeNode = { name, path: dirPath, isDir: true, children: [] };
    dirMap.set(dirPath, node);
    const parentSlash = dirPath.lastIndexOf("/");
    if (parentSlash !== -1) {
      ensureDir(dirPath.slice(0, parentSlash)).children.push(node);
    } else {
      root.push(node);
    }
    return node;
  }

  for (const file of files) {
    const lastSlash = file.path.lastIndexOf("/");
    if (lastSlash === -1) {
      root.push({ name: file.path, path: file.path, isDir: false, children: [], file });
    } else {
      const dirPath = file.path.slice(0, lastSlash);
      const name = file.path.slice(lastSlash + 1);
      ensureDir(dirPath).children.push({ name, path: file.path, isDir: false, children: [], file });
    }
  }

  function sort(nodes: RepoTreeNode[]) {
    nodes.sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    for (const n of nodes) if (n.isDir) sort(n.children);
  }
  sort(root);
  return root;
}


interface TreeNodeComponentProps {
  node: RepoTreeNode;
  depth: number;
  pendingDeletes: Set<string>;
  pendingRenames: Map<string, string>;
  editingPath: string | null;
  editingType: "rename" | "move";
  editValue: string;
  editInputRef: React.RefObject<HTMLInputElement | null>;
  setEditValue: (v: string) => void;
  commitEdit: () => void;
  setEditingPath: (p: string | null) => void;
  startEdit: (path: string, type: "rename" | "move") => void;
  markDelete: (path: string) => void;
  onContextMenu: (e: React.MouseEvent, file: RepoFile) => void;
}

const TreeNodeComponent: React.FC<TreeNodeComponentProps> = ({
  node, depth,
  pendingDeletes, pendingRenames,
  editingPath, editingType, editValue, editInputRef,
  setEditValue, commitEdit, setEditingPath,
  startEdit, markDelete, onContextMenu,
}) => {
  const [expanded, setExpanded] = useState(depth < 2);

  if (node.isDir) {
    return (
      <div>
        <div
          style={{
            display: "flex", alignItems: "center", gap: 6,
            paddingLeft: 14 + depth * 16, paddingRight: 10,
            height: 28, cursor: "pointer", borderRadius: 6,
            transition: "background 100ms",
          }}
          onClick={() => setExpanded(v => !v)}
          onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.025)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}
        >
          <span style={{ color: "#3A4060", flexShrink: 0, display: "flex" }}>
            {expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
          </span>
          {expanded
            ? <FolderOpen size={13} style={{ color: "#38BDF8", flexShrink: 0 }} />
            : <Folder size={13} style={{ color: "#38BDF8", flexShrink: 0 }} />
          }
          <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#8A91A8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
            {node.name}
          </span>
          <span style={{ fontSize: "0.6875rem", color: "#2D3450", flexShrink: 0 }}>
            {node.children.length}
          </span>
        </div>
        {expanded && node.children.map(child => (
          <TreeNodeComponent
            key={child.path} node={child} depth={depth + 1}
            pendingDeletes={pendingDeletes} pendingRenames={pendingRenames}
            editingPath={editingPath} editingType={editingType}
            editValue={editValue} editInputRef={editInputRef}
            setEditValue={setEditValue} commitEdit={commitEdit}
            setEditingPath={setEditingPath} startEdit={startEdit}
            markDelete={markDelete} onContextMenu={onContextMenu}
          />
        ))}
      </div>
    );
  }


  const file = node.file!;
  const isDeleted = pendingDeletes.has(file.path);
  const renamedTo = pendingRenames.get(file.path);
  const isEditing = editingPath === file.path;

  return (
    <div
      style={{
        display: "flex", alignItems: "center", gap: 8,
        paddingLeft: 14 + depth * 16, paddingRight: 10,
        height: 28, transition: "background 100ms",
        background: isDeleted ? "rgba(239,68,68,0.04)" : "transparent",
        borderRadius: 6,
      }}
      onMouseEnter={e => { if (!isDeleted) (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.025)"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = isDeleted ? "rgba(239,68,68,0.04)" : "transparent"; }}
      onContextMenu={e => { e.preventDefault(); onContextMenu(e, file); }}
    >
      {fileIcon(node.name)}

      {isEditing ? (
        <input ref={editInputRef} value={editValue} onChange={e => setEditValue(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={e => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") setEditingPath(null); }}
          style={{ flex: 1, background: "rgba(56,189,248,0.08)", border: "1px solid rgba(56,189,248,0.30)", borderRadius: 5, padding: "2px 7px", color: "#7DD3FC", fontSize: "0.8125rem", outline: "none", fontFamily: "inherit" }}
        />
      ) : (
        <span style={{ flex: 1, fontSize: "0.8125rem", color: isDeleted ? "#7A3030" : renamedTo ? "#7DD3FC" : "#8A91A8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textDecoration: isDeleted ? "line-through" : "none" }}>
          {node.name}
          {renamedTo && <span style={{ color: "#38BDF8", marginLeft: 6, fontSize: "0.6875rem" }}>→ {renamedTo.split("/").pop()}</span>}
        </span>
      )}

      <span style={{ fontSize: "0.625rem", color: "#2D3450", flexShrink: 0 }}>{formatSize(file.size)}</span>

      {!isEditing && (
        <div className="file-row-actions" style={{ display: "flex", gap: 2, flexShrink: 0 }}>
          <button onClick={() => startEdit(file.path, "rename")} title="Rename"
            style={{ display: "flex", padding: "2px 4px", borderRadius: 4, cursor: "pointer", background: "none", border: "none", color: "#4A5580", transition: "color 100ms" }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "#38BDF8"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "#4A5580"; }}
          ><Pencil size={11} /></button>
          <button onClick={() => startEdit(file.path, "move")} title="Move"
            style={{ display: "flex", padding: "2px 4px", borderRadius: 4, cursor: "pointer", background: "none", border: "none", color: "#4A5580", transition: "color 100ms" }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "#38BDF8"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "#4A5580"; }}
          ><MoveRight size={11} /></button>
          <button onClick={() => markDelete(file.path)} title={isDeleted ? "Undo delete" : "Delete"}
            style={{ display: "flex", padding: "2px 4px", borderRadius: 4, cursor: "pointer", background: "none", border: "none", color: isDeleted ? "#EF4444" : "#4A5580", transition: "color 100ms" }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "#EF4444"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = isDeleted ? "#EF4444" : "#4A5580"; }}
          ><Trash2 size={11} /></button>
        </div>
      )}
    </div>
  );
};


type PageState = "idle" | "loading" | "ready" | "applying" | "done" | "error";
type ViewMode = "list" | "tree";

interface CtxMenuState {
  x: number;
  y: number;
  file: RepoFile;
}

export const FilesPage: React.FC = () => {
  const repos = useRepoStore((s) => s.repos);

  const [targetRepo, setTargetRepo] = useState("");
  const [branch, setBranch] = useState("main");
  const [repoDropOpen, setRepoDropOpen] = useState(false);
  const [repoSearch, setRepoSearch] = useState("");

  const [files, setFiles] = useState<RepoFile[]>([]);
  const [search, setSearch] = useState("");
  const [pageState, setPageState] = useState<PageState>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [resultUrl, setResultUrl] = useState("");

  const [ops, setOps] = useState<FileOp[]>([]);
  const [commitMessage, setCommitMessage] = useState("File operations via ZRepoManager");

  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [ctxMenu, setCtxMenu] = useState<CtxMenuState | null>(null);

  const [editingPath, setEditingPath] = useState<string | null>(null);
  const [editingType, setEditingType] = useState<"rename" | "move">("rename");
  const [editValue, setEditValue] = useState("");
  const editInputRef = useRef<HTMLInputElement | null>(null);

  const filteredRepos = repos.filter(r =>
    !r.archived && (repoSearch === "" || r.full_name.toLowerCase().includes(repoSearch.toLowerCase()))
  );

  const displayedFiles = files.filter(f =>
    search === "" || f.path.toLowerCase().includes(search.toLowerCase())
  );

  const pendingDeletes = new Set(ops.filter(o => o.op === "delete").map(o => o.path));
  const pendingRenames = new Map(ops.filter(o => o.op === "rename").map(o => [o.old_path, o.new_path]));

  const treeData = React.useMemo(() => buildFileTree(displayedFiles), [displayedFiles]);

  const loadTree = useCallback(async () => {
    if (!targetRepo) return;
    const [owner, repo] = targetRepo.split("/");
    setPageState("loading");
    setFiles([]);
    setOps([]);
    setErrorMsg("");
    try {
      const result = await repoGetTree(owner, repo, branch);
      result.sort((a, b) => a.path.localeCompare(b.path));
      setFiles(result);
      setPageState("ready");
    } catch (e) {
      setErrorMsg(String(e));
      setPageState("error");
    }
  }, [targetRepo, branch]);

  const markDelete = useCallback((path: string) => {
    if (pendingDeletes.has(path)) {
      setOps(prev => prev.filter(o => !(o.op === "delete" && o.path === path)));
    } else {
      setOps(prev => [...prev.filter(o => !(o.op === "rename" && o.old_path === path)), { op: "delete", path }]);
    }
  }, [pendingDeletes]);

  const startEdit = useCallback((path: string, type: "rename" | "move") => {
    setEditingPath(path);
    setEditingType(type);
    setEditValue(type === "rename" ? (path.split("/").pop() ?? path) : path);
    setTimeout(() => editInputRef.current?.focus(), 50);
  }, []);

  const commitEdit = useCallback(() => {
    if (!editingPath || !editValue.trim()) { setEditingPath(null); return; }
    let newPath: string;
    if (editingType === "rename") {
      const dir = editingPath.includes("/") ? editingPath.substring(0, editingPath.lastIndexOf("/") + 1) : "";
      newPath = dir + editValue.trim();
    } else {
      newPath = editValue.trim();
    }
    if (newPath === editingPath) { setEditingPath(null); return; }
    setOps(prev => [
      ...prev.filter(o => !(o.op === "delete" && o.path === editingPath) && !(o.op === "rename" && o.old_path === editingPath)),
      { op: "rename", old_path: editingPath, new_path: newPath },
    ]);
    setEditingPath(null);
  }, [editingPath, editingType, editValue]);

  const applyOps = useCallback(async () => {
    if (!targetRepo || ops.length === 0) return;
    const [owner, repo] = targetRepo.split("/");
    setPageState("applying");
    setErrorMsg("");
    try {
      const result = await repoApplyFileOps(owner, repo, branch, ops, commitMessage);
      setResultUrl(result.commit_url);
      setOps([]);
      setPageState("done");
      await loadTree();
    } catch (e) {
      setErrorMsg(String(e));
      setPageState("error");
    }
  }, [targetRepo, branch, ops, commitMessage, loadTree]);

  const canApply = targetRepo && ops.length > 0 && (pageState === "ready" || pageState === "done");


  const buildCtxItems = useCallback((file: RepoFile): ContextMenuItemDef[] => {
    const isDeleted = pendingDeletes.has(file.path);
    return [
      { type: "item", label: "Rename", icon: Pencil, onClick: () => startEdit(file.path, "rename") },
      { type: "item", label: "Move to path", icon: MoveRight, onClick: () => startEdit(file.path, "move") },
      { type: "item", label: isDeleted ? "Undo delete" : "Delete", icon: Trash2, danger: !isDeleted, onClick: () => markDelete(file.path) },
      { type: "divider" },
      {
        type: "item", label: "Copy path", icon: Clipboard,
        onClick: () => { navigator.clipboard.writeText(file.path).catch(() => {}); },
      },
    ];
  }, [pendingDeletes, startEdit, markDelete]);

  const handleFileCtxMenu = useCallback((e: React.MouseEvent, file: RepoFile) => {
    e.preventDefault();
    setCtxMenu({ x: e.clientX, y: e.clientY, file });
  }, []);

  const isReady = pageState === "ready" || pageState === "applying" || pageState === "done";

  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", padding: "24px 28px", gap: 16, overflow: "hidden" }}>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
        style={{ display: "flex", gap: 20, flex: 1, minHeight: 0 }}>


        <div style={{ width: 300, flexShrink: 0, display: "flex", flexDirection: "column", gap: 12, overflowY: "auto", paddingRight: 4 }}>

          <div style={{ borderRadius: 12, background: "rgba(255,255,255,0.028)", border: "1px solid rgba(255,255,255,0.065)", padding: "16px 18px" }}>
            <p style={{ margin: "0 0 10px", fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase", color: "#3A4060" }}>Repository</p>
            <div style={{ position: "relative" }}>
              <button onClick={() => setRepoDropOpen(v => !v)}
                style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", borderRadius: 8, cursor: "pointer", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)", color: targetRepo ? "#C8CDD8" : "#4A5580", fontSize: "0.8125rem", fontWeight: 500, transition: "border-color 130ms" }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(56,189,248,0.35)"; }}
                onMouseLeave={e => { if (!repoDropOpen) (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.10)"; }}
              >
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{targetRepo || "Select a repository…"}</span>
                <ChevronDown size={13} style={{ flexShrink: 0, color: "#4A5580", transform: repoDropOpen ? "rotate(180deg)" : "none", transition: "transform 150ms" }} />
              </button>
              <AnimatePresence>
                {repoDropOpen && (
                  <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.15 }}
                    style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, zIndex: 50, borderRadius: 10, background: "#0D1025", border: "1px solid rgba(255,255,255,0.10)", boxShadow: "0 12px 40px rgba(0,0,0,0.55)", overflow: "hidden" }}>
                    <div style={{ padding: "8px 10px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                      <input autoFocus placeholder="Search repos…" value={repoSearch} onChange={e => setRepoSearch(e.target.value)}
                        style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6, padding: "6px 10px", color: "#C8CDD8", fontSize: "0.8125rem", outline: "none" }} />
                    </div>
                    <div style={{ maxHeight: 200, overflowY: "auto" }}>
                      {filteredRepos.slice(0, 80).map(r => (
                        <div key={r.id} onClick={() => { setTargetRepo(r.full_name); setRepoDropOpen(false); setRepoSearch(""); setFiles([]); setOps([]); setPageState("idle"); }}
                          style={{ padding: "8px 14px", cursor: "pointer", fontSize: "0.8125rem", color: r.full_name === targetRepo ? "#38BDF8" : "#8A91A8", background: r.full_name === targetRepo ? "rgba(56,189,248,0.08)" : "transparent", transition: "background 100ms" }}
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
            <div style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "flex-end" }}>
              <div style={{ flex: 1 }}>
                <p style={{ margin: "0 0 5px", fontSize: "0.6875rem", color: "#3A4060" }}>Branch</p>
                <input value={branch} onChange={e => setBranch(e.target.value)} placeholder="main"
                  style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 7, padding: "7px 10px", color: "#C8CDD8", fontSize: "0.8125rem", outline: "none", transition: "border-color 130ms" }}
                  onFocus={e => { (e.target as HTMLInputElement).style.borderColor = "rgba(56,189,248,0.40)"; }}
                  onBlur={e => { (e.target as HTMLInputElement).style.borderColor = "rgba(255,255,255,0.08)"; }}
                />
              </div>
              <button onClick={loadTree} disabled={!targetRepo}
                style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 12px", borderRadius: 7, cursor: targetRepo ? "pointer" : "not-allowed", background: targetRepo ? "rgba(56,189,248,0.10)" : "rgba(255,255,255,0.03)", border: `1px solid ${targetRepo ? "rgba(56,189,248,0.22)" : "rgba(255,255,255,0.06)"}`, color: targetRepo ? "#7DD3FC" : "#3A4060", fontSize: "0.75rem", fontWeight: 600, transition: "all 130ms", flexShrink: 0 }}
                onMouseEnter={e => { if (targetRepo) { const b = e.currentTarget as HTMLButtonElement; b.style.background = "rgba(56,189,248,0.18)"; b.style.borderColor = "rgba(56,189,248,0.40)"; } }}
                onMouseLeave={e => { if (targetRepo) { const b = e.currentTarget as HTMLButtonElement; b.style.background = "rgba(56,189,248,0.10)"; b.style.borderColor = "rgba(56,189,248,0.22)"; } }}
              >
                <RefreshCw size={12} style={{ animation: pageState === "loading" ? "spin 0.8s linear infinite" : "none" }} />
                {pageState === "loading" ? "Loading…" : "Load"}
              </button>
            </div>
          </div>

          {ops.length > 0 && (
            <div style={{ borderRadius: 12, background: "rgba(255,255,255,0.028)", border: "1px solid rgba(255,255,255,0.065)", padding: "16px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
              <p style={{ margin: 0, fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase", color: "#3A4060" }}>
                Staged Changes <span style={{ color: "#38BDF8", fontWeight: 700 }}>{ops.length}</span>
              </p>
              <PendingOps ops={ops} onRemove={i => setOps(prev => prev.filter((_, idx) => idx !== i))} />
            </div>
          )}

          {(pageState === "ready" || pageState === "done") && (
            <>
              <div style={{ borderRadius: 12, background: "rgba(255,255,255,0.028)", border: "1px solid rgba(255,255,255,0.065)", padding: "16px 18px" }}>
                <p style={{ margin: "0 0 8px", fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase", color: "#3A4060" }}>Commit Message</p>
                <textarea value={commitMessage} onChange={e => setCommitMessage(e.target.value)} rows={2}
                  style={{ width: "100%", resize: "none", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 7, padding: "8px 10px", color: "#C8CDD8", fontSize: "0.8125rem", outline: "none", fontFamily: "inherit", lineHeight: 1.5, transition: "border-color 130ms" }}
                  onFocus={e => { (e.target as HTMLTextAreaElement).style.borderColor = "rgba(56,189,248,0.40)"; }}
                  onBlur={e => { (e.target as HTMLTextAreaElement).style.borderColor = "rgba(255,255,255,0.08)"; }}
                />
              </div>
              <motion.button onClick={canApply ? applyOps : undefined} whileTap={canApply ? { scale: 0.97 } : undefined}
                style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "12px 20px", borderRadius: 10, cursor: canApply ? "pointer" : "not-allowed", background: canApply ? "linear-gradient(135deg, #38BDF8, #0284C7)" : "rgba(255,255,255,0.04)", border: canApply ? "1px solid rgba(56,189,248,0.40)" : "1px solid rgba(255,255,255,0.06)", color: canApply ? "#fff" : "#3A4060", fontSize: "0.875rem", fontWeight: 700, boxShadow: canApply ? "0 4px 20px rgba(56,189,248,0.20)" : "none", transition: "all 150ms" }}>
                <FilePen size={15} />
                {ops.length > 0 ? `Apply ${ops.length} change${ops.length !== 1 ? "s" : ""}` : "No changes staged"}
              </motion.button>
            </>
          )}
        </div>


        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
          <div style={{ flex: 1, minHeight: 0, borderRadius: 12, background: "rgba(255,255,255,0.028)", border: "1px solid rgba(255,255,255,0.065)", display: "flex", flexDirection: "column", overflow: "hidden" }}>


            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 18px 10px", flexShrink: 0, borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
              <Search size={13} style={{ color: "#3A4060", flexShrink: 0 }} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Filter files…"
                style={{ flex: 1, background: "none", border: "none", outline: "none", color: "#C8CDD8", fontSize: "0.8125rem" }} />
              {files.length > 0 && (
                <span style={{ fontSize: "0.6875rem", color: "#3A4060", flexShrink: 0 }}>
                  {displayedFiles.length} / {files.length}
                </span>
              )}

              <div style={{ display: "flex", gap: 2, padding: 2, borderRadius: 7, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", flexShrink: 0 }}>
                {(["list", "tree"] as ViewMode[]).map(mode => (
                  <button key={mode} onClick={() => setViewMode(mode)}
                    title={mode === "list" ? "Flat list" : "Folder tree"}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "center",
                      width: 24, height: 22, borderRadius: 5, border: "none", cursor: "pointer",
                      background: viewMode === mode ? "rgba(56,189,248,0.15)" : "transparent",
                      color: viewMode === mode ? "#38BDF8" : "#3A4060",
                      transition: "all 120ms",
                    }}
                  >
                    {mode === "list" ? <List size={12} /> : <Folder size={12} />}
                  </button>
                ))}
              </div>
            </div>


            <div style={{ flex: 1, minHeight: 0, overflowY: "auto", overflowX: "hidden", scrollbarWidth: "thin" as const, scrollbarColor: "rgba(56,189,248,0.20) transparent" }}>

              {pageState === "idle" && (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 12, padding: "60px 20px" }}>
                  <div style={{ width: 48, height: 48, borderRadius: 14, background: "rgba(56,189,248,0.08)", border: "1px solid rgba(56,189,248,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <FolderOpen size={22} style={{ color: "#38BDF8" }} />
                  </div>
                  <p style={{ margin: 0, fontSize: "0.8125rem", color: "#4A5580", textAlign: "center" }}>Select a repo and click Load</p>
                </div>
              )}

              {pageState === "loading" && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", gap: 12 }}>
                  <div style={{ width: 24, height: 24, borderRadius: "50%", border: "2px solid rgba(56,189,248,0.15)", borderTopColor: "#38BDF8", animation: "spin 0.8s linear infinite" }} />
                  <span style={{ fontSize: "0.8125rem", color: "#4A5580" }}>Loading file tree…</span>
                </div>
              )}

              {isReady && displayedFiles.length === 0 && search && (
                <div style={{ padding: "40px 20px", textAlign: "center", fontSize: "0.8125rem", color: "#3A4060" }}>
                  No files match "{search}"
                </div>
              )}


              {isReady && viewMode === "list" && displayedFiles.map(file => {
                const isDeleted = pendingDeletes.has(file.path);
                const renamedTo = pendingRenames.get(file.path);
                const isEditing = editingPath === file.path;

                return (
                  <div key={file.path}
                    style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 14px", transition: "background 100ms", background: isDeleted ? "rgba(239,68,68,0.04)" : "transparent" }}
                    onMouseEnter={e => { if (!isDeleted) (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.025)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = isDeleted ? "rgba(239,68,68,0.04)" : "transparent"; }}
                    onContextMenu={e => handleFileCtxMenu(e, file)}
                  >
                    {fileIcon(file.path)}
                    {isEditing ? (
                      <input ref={editInputRef} value={editValue} onChange={e => setEditValue(e.target.value)}
                        onBlur={commitEdit}
                        onKeyDown={e => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") setEditingPath(null); }}
                        style={{ flex: 1, background: "rgba(56,189,248,0.08)", border: "1px solid rgba(56,189,248,0.30)", borderRadius: 5, padding: "3px 8px", color: "#7DD3FC", fontSize: "0.8125rem", outline: "none", fontFamily: "inherit" }}
                      />
                    ) : (
                      <span style={{ flex: 1, fontSize: "0.8125rem", color: isDeleted ? "#7A3030" : renamedTo ? "#7DD3FC" : "#8A91A8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textDecoration: isDeleted ? "line-through" : "none" }}>
                        {file.path}
                        {renamedTo && <span style={{ color: "#38BDF8", marginLeft: 6, fontSize: "0.75rem" }}>→ {renamedTo}</span>}
                      </span>
                    )}
                    <span style={{ fontSize: "0.625rem", color: "#2D3450", flexShrink: 0 }}>{formatSize(file.size)}</span>
                    {!isEditing && (
                      <div className="file-row-actions" style={{ display: "flex", gap: 2, flexShrink: 0 }}>
                        <button onClick={() => startEdit(file.path, "rename")} title="Rename"
                          style={{ display: "flex", padding: "3px 5px", borderRadius: 5, cursor: "pointer", background: "none", border: "none", color: "#4A5580", transition: "color 100ms" }}
                          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "#38BDF8"; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "#4A5580"; }}
                        ><Pencil size={11} /></button>
                        <button onClick={() => startEdit(file.path, "move")} title="Move"
                          style={{ display: "flex", padding: "3px 5px", borderRadius: 5, cursor: "pointer", background: "none", border: "none", color: "#4A5580", transition: "color 100ms" }}
                          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "#38BDF8"; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "#4A5580"; }}
                        ><MoveRight size={11} /></button>
                        <button onClick={() => markDelete(file.path)} title={isDeleted ? "Undo delete" : "Delete"}
                          style={{ display: "flex", padding: "3px 5px", borderRadius: 5, cursor: "pointer", background: "none", border: "none", color: isDeleted ? "#EF4444" : "#4A5580", transition: "color 100ms" }}
                          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "#EF4444"; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = isDeleted ? "#EF4444" : "#4A5580"; }}
                        ><Trash2 size={11} /></button>
                      </div>
                    )}
                  </div>
                );
              })}


              {isReady && viewMode === "tree" && (
                <div style={{ padding: "6px 4px" }}>
                  {treeData.map(node => (
                    <TreeNodeComponent
                      key={node.path}
                      node={node}
                      depth={0}
                      pendingDeletes={pendingDeletes}
                      pendingRenames={pendingRenames}
                      editingPath={editingPath}
                      editingType={editingType}
                      editValue={editValue}
                      editInputRef={editInputRef}
                      setEditValue={setEditValue}
                      commitEdit={commitEdit}
                      setEditingPath={setEditingPath}
                      startEdit={startEdit}
                      markDelete={markDelete}
                      onContextMenu={handleFileCtxMenu}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>


      <AnimatePresence>
        {pageState === "applying" && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            style={{ borderRadius: 12, background: "rgba(56,189,248,0.08)", border: "1px solid rgba(56,189,248,0.20)", padding: "14px 18px", display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
            <div style={{ width: 18, height: 18, borderRadius: "50%", border: "2px solid rgba(56,189,248,0.20)", borderTopColor: "#38BDF8", animation: "spin 0.8s linear infinite", flexShrink: 0 }} />
            <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#7DD3FC" }}>Applying changes…</span>
          </motion.div>
        )}
        {pageState === "done" && resultUrl && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            style={{ borderRadius: 12, background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.22)", padding: "14px 18px", display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
            <CheckCircle size={18} style={{ color: "#10B981", flexShrink: 0 }} />
            <p style={{ margin: 0, flex: 1, fontSize: "0.875rem", fontWeight: 600, color: "#34D399" }}>Changes committed successfully</p>
            <button onClick={() => openUrlExternal(resultUrl)}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 7, cursor: "pointer", background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.25)", color: "#34D399", fontSize: "0.75rem", fontWeight: 600, flexShrink: 0, transition: "all 130ms" }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(16,185,129,0.20)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(16,185,129,0.12)"; }}
            >
              <ExternalLink size={11} /> View commit
            </button>
            <button onClick={() => setResultUrl("")}
              style={{ background: "none", border: "none", cursor: "pointer", color: "#3A4060", padding: 4, display: "flex" }}>
              <X size={14} />
            </button>
          </motion.div>
        )}
        {pageState === "error" && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            style={{ borderRadius: 12, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.22)", padding: "14px 18px", display: "flex", alignItems: "flex-start", gap: 12, flexShrink: 0 }}>
            <XCircle size={18} style={{ color: "#EF4444", flexShrink: 0, marginTop: 1 }} />
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: "0.875rem", fontWeight: 600, color: "#F87171" }}>Error</p>
              <p style={{ margin: "4px 0 0", fontSize: "0.75rem", color: "#7A3030", lineHeight: 1.5 }}>{errorMsg}</p>
            </div>
            <button onClick={() => setPageState(files.length > 0 ? "ready" : "idle")}
              style={{ background: "none", border: "none", cursor: "pointer", color: "#3A4060", padding: 4, display: "flex" }}>
              <X size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>


      {ctxMenu && (
        <ContextMenu
          x={ctxMenu.x} y={ctxMenu.y}
          items={buildCtxItems(ctxMenu.file)}
          onClose={() => setCtxMenu(null)}
        />
      )}

      <style>{`
        .file-row-actions { opacity: 0 !important; transition: opacity 120ms ease; }
        div:hover > .file-row-actions { opacity: 1 !important; }
      `}</style>
    </div>
  );
};
