import React, { useState, useCallback, useEffect, useMemo, useRef } from "react";
import Editor from "@monaco-editor/react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useSessionSync } from "../../hooks/useSessionSync";
import { useAccountStore } from "../../stores/accountStore";
import {
  repoGetTree, repoGetFileContent, repoUpdateFileContent, openUrlExternal,
} from "../../lib/tauri/commands";
import type { RepoFile } from "../../lib/tauri/commands";
import {
  File, FileText, Folder, FolderOpen, ChevronRight, ChevronDown,
  Save, RefreshCw, GitBranch, ExternalLink, CheckCircle, XCircle,
  Code2, AlertCircle, X, Eye, EyeOff, Link, Link2Off,
} from "lucide-react";

function getLanguage(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    ts: "typescript", tsx: "typescript",
    js: "javascript", jsx: "javascript",
    rs: "rust", py: "python", go: "go",
    java: "java", cpp: "cpp", cc: "cpp", cxx: "cpp",
    c: "c", cs: "csharp", rb: "ruby",
    swift: "swift", kt: "kotlin", kts: "kotlin",
    json: "json", toml: "toml",
    yaml: "yaml", yml: "yaml",
    md: "markdown", mdx: "markdown",
    html: "html", htm: "html",
    css: "css", scss: "scss", sass: "scss", less: "less",
    sh: "shell", bash: "shell", zsh: "shell",
    sql: "sql", xml: "xml", svg: "xml",
    dockerfile: "dockerfile",
    vue: "html", svelte: "html",
  };
  if (filename.toLowerCase() === "dockerfile") return "dockerfile";
  return map[ext] ?? "plaintext";
}

function fileIcon(name: string) {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const code = ["ts","tsx","js","jsx","rs","py","go","java","cpp","c","cs","rb","swift","kt","json","toml","yaml","yml","md","html","css","scss","sh","sql","xml","vue","svelte"];
  return code.includes(ext)
    ? <FileText size={13} style={{ color: "#8B5CF6", flexShrink: 0 }} />
    : <File size={13} style={{ color: "#4A5580", flexShrink: 0 }} />;
}

interface TreeNode {
  name: string;
  path: string;
  isDir: boolean;
  children: TreeNode[];
  file?: RepoFile;
}

function buildTree(files: RepoFile[]): TreeNode[] {
  const dirMap = new Map<string, TreeNode>();
  const root: TreeNode[] = [];

  function ensureDir(dirPath: string): TreeNode {
    if (dirMap.has(dirPath)) return dirMap.get(dirPath)!;
    const name = dirPath.split("/").pop()!;
    const node: TreeNode = { name, path: dirPath, isDir: true, children: [] };
    dirMap.set(dirPath, node);
    const slash = dirPath.lastIndexOf("/");
    if (slash !== -1) ensureDir(dirPath.slice(0, slash)).children.push(node);
    else root.push(node);
    return node;
  }

  for (const file of files) {
    const slash = file.path.lastIndexOf("/");
    if (slash === -1) root.push({ name: file.path, path: file.path, isDir: false, children: [], file });
    else ensureDir(file.path.slice(0, slash)).children.push({ name: file.path.slice(slash + 1), path: file.path, isDir: false, children: [], file });
  }

  function sort(nodes: TreeNode[]) {
    nodes.sort((a, b) => { if (a.isDir !== b.isDir) return a.isDir ? -1 : 1; return a.name.localeCompare(b.name); });
    for (const n of nodes) if (n.isDir) sort(n.children);
  }
  sort(root);
  return root;
}

interface TreeNodeProps {
  node: TreeNode;
  depth: number;
  selectedPath: string | null;
  onFileClick: (file: RepoFile) => void;
}

const TreeNodeComp: React.FC<TreeNodeProps> = ({ node, depth, selectedPath, onFileClick }) => {
  const [expanded, setExpanded] = useState(depth < 1);

  if (node.isDir) {
    return (
      <div>
        <div
          onClick={() => setExpanded(v => !v)}
          style={{ display: "flex", alignItems: "center", gap: 5, paddingLeft: 10 + depth * 14, paddingRight: 8, height: 26, cursor: "pointer", borderRadius: 4, transition: "background 80ms" }}
          onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.04)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}
        >
          <span style={{ color: "#3A4060", flexShrink: 0, display: "flex" }}>
            {expanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
          </span>
          {expanded
            ? <FolderOpen size={12} style={{ color: "#38BDF8", flexShrink: 0 }} />
            : <Folder size={12} style={{ color: "#38BDF8", flexShrink: 0 }} />
          }
          <span style={{ fontSize: "0.78125rem", fontWeight: 600, color: "#7A8299", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {node.name}
          </span>
        </div>
        {expanded && node.children.map(child => (
          <TreeNodeComp key={child.path} node={child} depth={depth + 1} selectedPath={selectedPath} onFileClick={onFileClick} />
        ))}
      </div>
    );
  }

  const isSelected = selectedPath === node.path;

  return (
    <div
      onClick={() => node.file && onFileClick(node.file)}
      style={{
        display: "flex", alignItems: "center", gap: 5,
        paddingLeft: 10 + depth * 14, paddingRight: 8,
        height: 26, cursor: "pointer", borderRadius: 4, transition: "background 80ms",
        background: isSelected ? "rgba(139,92,246,0.18)" : "transparent",
      }}
      onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.04)"; }}
      onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}
    >
      {fileIcon(node.name)}
      <span style={{ fontSize: "0.78125rem", color: isSelected ? "#C4B5FD" : "#8A91A8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {node.name}
      </span>
    </div>
  );
};

export const EditorWindow: React.FC = () => {
  const sessionReady = useSessionSync();
  const hasAccount = useAccountStore(s => s.accounts.length > 0);

  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const owner = params.get("owner") ?? "";
  const repo = params.get("repo") ?? "";
  const branch = params.get("branch") ?? "main";

  const [files, setFiles] = useState<RepoFile[]>([]);
  const [treeLoading, setTreeLoading] = useState(false);
  const [treeError, setTreeError] = useState("");
  const [fileSearch, setFileSearch] = useState("");

  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [selectedSha, setSelectedSha] = useState("");
  const [editorContent, setEditorContent] = useState("");
  const [originalContent, setOriginalContent] = useState("");
  const [contentLoading, setContentLoading] = useState(false);
  const [contentError, setContentError] = useState("");

  const [commitMsg, setCommitMsg] = useState("Edit via ZRepoManager");
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<{ url: string } | null>(null);
  const [saveError, setSaveError] = useState("");

  const isDirty = editorContent !== originalContent;
  const [showPreview, setShowPreview] = useState(false);
  const [syncScroll, setSyncScroll] = useState(true);
  const syncScrollRef = useRef(true);
  const isMarkdown = selectedPath?.toLowerCase().endsWith(".md") ?? false;

  const editorInstanceRef = useRef<any>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const isSyncingRef = useRef(false);

  useEffect(() => { syncScrollRef.current = syncScroll; }, [syncScroll]);

  useEffect(() => {
    if (!isMarkdown) setShowPreview(false);
  }, [isMarkdown]);

  const handlePreviewScroll = useCallback(() => {
    if (isSyncingRef.current || !syncScrollRef.current || !editorInstanceRef.current || !previewRef.current) return;
    const el = previewRef.current;
    const maxScroll = el.scrollHeight - el.clientHeight;
    if (maxScroll <= 0) return;
    isSyncingRef.current = true;
    const pct = el.scrollTop / maxScroll;
    const editorMax = editorInstanceRef.current.getScrollHeight() - editorInstanceRef.current.getLayoutInfo().height;
    editorInstanceRef.current.setScrollTop(pct * editorMax);
    requestAnimationFrame(() => { isSyncingRef.current = false; });
  }, [syncScroll]);

  const treeData = useMemo(() => buildTree(files), [files]);

  const filteredFiles = useMemo(() =>
    fileSearch ? files.filter(f => f.path.toLowerCase().includes(fileSearch.toLowerCase())) : [],
  [files, fileSearch]);

  const loadTree = useCallback(async () => {
    if (!owner || !repo) return;
    setTreeLoading(true);
    setTreeError("");
    setFiles([]);
    try {
      const result = await repoGetTree(owner, repo, branch);
      result.sort((a, b) => a.path.localeCompare(b.path));
      setFiles(result);
    } catch (e) {
      setTreeError(String(e));
    } finally {
      setTreeLoading(false);
    }
  }, [owner, repo, branch]);

  useEffect(() => {
    if (sessionReady && hasAccount && owner && repo) {
      loadTree();
    }
  }, [sessionReady, hasAccount, owner, repo, loadTree]);

  const openFile = useCallback(async (file: RepoFile) => {
    setSelectedPath(file.path);
    setContentLoading(true);
    setContentError("");
    setSaveResult(null);
    setSaveError("");
    try {
      const result = await repoGetFileContent(owner, repo, file.path, branch);
      setEditorContent(result.content);
      setOriginalContent(result.content);
      setSelectedSha(result.sha);
    } catch (e) {
      setContentError(String(e));
    } finally {
      setContentLoading(false);
    }
  }, [owner, repo, branch]);

  const saveFile = useCallback(async () => {
    if (!selectedPath || !isDirty || saving) return;
    setSaving(true);
    setSaveError("");
    setSaveResult(null);
    try {
      const result = await repoUpdateFileContent(owner, repo, branch, selectedPath, editorContent, selectedSha, commitMsg);
      setOriginalContent(editorContent);
      setSelectedSha(result.commit_sha);
      setSaveResult({ url: result.commit_url });
    } catch (e) {
      setSaveError(String(e));
    } finally {
      setSaving(false);
    }
  }, [selectedPath, isDirty, saving, owner, repo, branch, editorContent, selectedSha, commitMsg]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        saveFile();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [saveFile]);

  const language = selectedPath ? getLanguage(selectedPath.split("/").pop() ?? "") : "plaintext";
  const filename = selectedPath?.split("/").pop() ?? "";

  if (!sessionReady) {
    return (
      <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#06080F" }}>
        <div style={{ width: 28, height: 28, borderRadius: "50%", border: "2px solid rgba(139,92,246,0.20)", borderTopColor: "#8B5CF6", animation: "spin 0.8s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!hasAccount) {
    return (
      <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#06080F", flexDirection: "column", gap: 12 }}>
        <AlertCircle size={32} style={{ color: "#EF4444" }} />
        <p style={{ color: "#8A91A8", fontSize: "0.875rem" }}>No account — open the main window to sign in.</p>
      </div>
    );
  }

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: "#06080F", overflow: "hidden" }}>


      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 16px", height: 42, borderBottom: "1px solid rgba(255,255,255,0.06)", flexShrink: 0, background: "rgba(255,255,255,0.015)" }}>
        <Code2 size={16} style={{ color: "#8B5CF6", flexShrink: 0 }} />
        <span style={{ fontSize: "0.8125rem", fontWeight: 700, color: "#C8CDD8" }}>{owner}/{repo}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 4, marginLeft: 4, padding: "2px 8px", borderRadius: 5, background: "rgba(56,189,248,0.08)", border: "1px solid rgba(56,189,248,0.15)" }}>
          <GitBranch size={11} style={{ color: "#38BDF8" }} />
          <span style={{ fontSize: "0.75rem", color: "#7DD3FC", fontWeight: 600 }}>{branch}</span>
        </div>

        <div style={{ flex: 1 }} />

        {selectedPath && (
          <>
            <input
              value={commitMsg}
              onChange={e => setCommitMsg(e.target.value)}
              placeholder="Commit message…"
              style={{ width: 240, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6, padding: "5px 10px", color: "#C8CDD8", fontSize: "0.75rem", outline: "none", fontFamily: "inherit" }}
              onFocus={e => { (e.target as HTMLInputElement).style.borderColor = "rgba(139,92,246,0.40)"; }}
              onBlur={e => { (e.target as HTMLInputElement).style.borderColor = "rgba(255,255,255,0.08)"; }}
            />
            <button
              onClick={saveFile}
              disabled={!isDirty || saving}
              style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 6, cursor: isDirty && !saving ? "pointer" : "not-allowed", background: isDirty ? "rgba(139,92,246,0.15)" : "rgba(255,255,255,0.03)", border: `1px solid ${isDirty ? "rgba(139,92,246,0.35)" : "rgba(255,255,255,0.06)"}`, color: isDirty ? "#C4B5FD" : "#3A4060", fontSize: "0.75rem", fontWeight: 600, transition: "all 130ms" }}
              onMouseEnter={e => { if (isDirty) { const b = e.currentTarget as HTMLButtonElement; b.style.background = "rgba(139,92,246,0.25)"; } }}
              onMouseLeave={e => { if (isDirty) { const b = e.currentTarget as HTMLButtonElement; b.style.background = "rgba(139,92,246,0.15)"; } }}
            >
              {saving
                ? <><RefreshCw size={12} style={{ animation: "spin 0.8s linear infinite" }} /> Saving…</>
                : <><Save size={12} /> Save  <span style={{ fontSize: "0.65rem", opacity: 0.6 }}>Ctrl+S</span></>
              }
            </button>

            {isMarkdown && (
              <>
                <button
                  onClick={() => setShowPreview(v => !v)}
                  style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 6, cursor: "pointer", background: showPreview ? "rgba(56,189,248,0.15)" : "rgba(255,255,255,0.04)", border: `1px solid ${showPreview ? "rgba(56,189,248,0.35)" : "rgba(255,255,255,0.08)"}`, color: showPreview ? "#38BDF8" : "#8A91A8", fontSize: "0.75rem", fontWeight: 600, transition: "all 130ms" }}
                  onMouseEnter={e => { const b = e.currentTarget as HTMLButtonElement; b.style.background = showPreview ? "rgba(56,189,248,0.22)" : "rgba(255,255,255,0.07)"; }}
                  onMouseLeave={e => { const b = e.currentTarget as HTMLButtonElement; b.style.background = showPreview ? "rgba(56,189,248,0.15)" : "rgba(255,255,255,0.04)"; }}
                >
                  {showPreview ? <EyeOff size={12} /> : <Eye size={12} />}
                  {showPreview ? "Hide Preview" : "Preview"}
                </button>

                {showPreview && (
                  <button
                    onClick={() => setSyncScroll(v => !v)}
                    title={syncScroll ? "Scroll sync on — click to disable" : "Scroll sync off — click to enable"}
                    style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 6, cursor: "pointer", background: syncScroll ? "rgba(16,185,129,0.12)" : "rgba(255,255,255,0.04)", border: `1px solid ${syncScroll ? "rgba(16,185,129,0.30)" : "rgba(255,255,255,0.08)"}`, color: syncScroll ? "#34D399" : "#4A5580", fontSize: "0.75rem", fontWeight: 600, transition: "all 130ms" }}
                    onMouseEnter={e => { const b = e.currentTarget as HTMLButtonElement; b.style.background = syncScroll ? "rgba(16,185,129,0.20)" : "rgba(255,255,255,0.07)"; }}
                    onMouseLeave={e => { const b = e.currentTarget as HTMLButtonElement; b.style.background = syncScroll ? "rgba(16,185,129,0.12)" : "rgba(255,255,255,0.04)"; }}
                  >
                    {syncScroll ? <Link size={12} /> : <Link2Off size={12} />}
                    Sync
                  </button>
                )}
              </>
            )}
          </>
        )}

        <button
          onClick={loadTree}
          title="Reload file tree"
          style={{ display: "flex", padding: "5px", borderRadius: 6, cursor: "pointer", background: "none", border: "none", color: "#3A4060", transition: "color 120ms" }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "#38BDF8"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "#3A4060"; }}
        >
          <RefreshCw size={13} style={{ animation: treeLoading ? "spin 0.8s linear infinite" : "none" }} />
        </button>
      </div>


      {saveResult && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 16px", background: "rgba(16,185,129,0.08)", borderBottom: "1px solid rgba(16,185,129,0.18)", flexShrink: 0 }}>
          <CheckCircle size={14} style={{ color: "#10B981", flexShrink: 0 }} />
          <span style={{ fontSize: "0.8125rem", color: "#34D399", fontWeight: 600, flex: 1 }}>Saved successfully</span>
          <button onClick={() => openUrlExternal(saveResult.url)} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "0.75rem", color: "#34D399", background: "none", border: "none", cursor: "pointer", opacity: 0.8 }}>
            <ExternalLink size={11} /> View commit
          </button>
          <button onClick={() => setSaveResult(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#3A4060", display: "flex", padding: 2 }}><X size={12} /></button>
        </div>
      )}
      {saveError && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 16px", background: "rgba(239,68,68,0.08)", borderBottom: "1px solid rgba(239,68,68,0.18)", flexShrink: 0 }}>
          <XCircle size={14} style={{ color: "#EF4444", flexShrink: 0 }} />
          <span style={{ fontSize: "0.8125rem", color: "#F87171", flex: 1 }}>{saveError}</span>
          <button onClick={() => setSaveError("")} style={{ background: "none", border: "none", cursor: "pointer", color: "#3A4060", display: "flex", padding: 2 }}><X size={12} /></button>
        </div>
      )}


      <div style={{ flex: 1, minHeight: 0, display: "flex" }}>


        <div style={{ width: 240, flexShrink: 0, display: "flex", flexDirection: "column", borderRight: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.008)" }}>
          <div style={{ padding: "8px 8px 6px", borderBottom: "1px solid rgba(255,255,255,0.05)", flexShrink: 0 }}>
            <input
              value={fileSearch}
              onChange={e => setFileSearch(e.target.value)}
              placeholder="Search files…"
              style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 5, padding: "5px 8px", color: "#C8CDD8", fontSize: "0.75rem", outline: "none", boxSizing: "border-box" }}
            />
          </div>

          <div style={{ flex: 1, minHeight: 0, overflowY: "auto", overflowX: "hidden", padding: "4px 2px", scrollbarWidth: "thin" as const, scrollbarColor: "rgba(139,92,246,0.20) transparent" }}>
            {treeLoading && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: 24 }}>
                <div style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid rgba(139,92,246,0.15)", borderTopColor: "#8B5CF6", animation: "spin 0.8s linear infinite" }} />
                <span style={{ fontSize: "0.75rem", color: "#4A5580" }}>Loading…</span>
              </div>
            )}
            {treeError && (
              <div style={{ padding: "12px 10px" }}>
                <p style={{ margin: 0, fontSize: "0.75rem", color: "#7A3030" }}>{treeError}</p>
              </div>
            )}
            {!treeLoading && !treeError && fileSearch ? (
              filteredFiles.length === 0
                ? <p style={{ margin: 0, padding: "16px 10px", fontSize: "0.75rem", color: "#3A4060" }}>No matches</p>
                : filteredFiles.map(f => (
                  <div
                    key={f.path}
                    onClick={() => openFile(f)}
                    style={{ display: "flex", alignItems: "center", gap: 5, paddingLeft: 10, paddingRight: 8, height: 26, cursor: "pointer", borderRadius: 4, transition: "background 80ms", background: selectedPath === f.path ? "rgba(139,92,246,0.18)" : "transparent" }}
                    onMouseEnter={e => { if (selectedPath !== f.path) (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.04)"; }}
                    onMouseLeave={e => { if (selectedPath !== f.path) (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}
                  >
                    {fileIcon(f.path.split("/").pop() ?? f.path)}
                    <span style={{ fontSize: "0.75rem", color: selectedPath === f.path ? "#C4B5FD" : "#8A91A8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.path}</span>
                  </div>
                ))
            ) : (
              treeData.map(node => (
                <TreeNodeComp key={node.path} node={node} depth={0} selectedPath={selectedPath} onFileClick={openFile} />
              ))
            )}
          </div>
        </div>


        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
          {!selectedPath && (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14 }}>
              <div style={{ width: 52, height: 52, borderRadius: 14, background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Code2 size={24} style={{ color: "#8B5CF6" }} />
              </div>
              <p style={{ margin: 0, fontSize: "0.8125rem", color: "#4A5580", textAlign: "center" }}>
                {files.length > 0 ? "Click a file to open it" : "Load a repo to get started"}
              </p>
            </div>
          )}

          {selectedPath && contentLoading && (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
              <div style={{ width: 20, height: 20, borderRadius: "50%", border: "2px solid rgba(139,92,246,0.15)", borderTopColor: "#8B5CF6", animation: "spin 0.8s linear infinite" }} />
              <span style={{ fontSize: "0.8125rem", color: "#4A5580" }}>Loading {filename}…</span>
            </div>
          )}

          {selectedPath && contentError && (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10 }}>
              <XCircle size={28} style={{ color: "#EF4444" }} />
              <p style={{ margin: 0, fontSize: "0.8125rem", color: "#F87171" }}>{contentError}</p>
            </div>
          )}

          {selectedPath && !contentLoading && !contentError && (
            <div style={{ flex: 1, minHeight: 0, display: "flex" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <Editor
                  height="100%"
                  language={language}
                  value={editorContent}
                  onChange={v => setEditorContent(v ?? "")}
                  theme="vs-dark"
                  options={{
                    fontSize: 13,
                    fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
                    fontLigatures: true,
                    minimap: { enabled: !showPreview },
                    scrollBeyondLastLine: false,
                    wordWrap: "off",
                    lineNumbers: "on",
                    renderLineHighlight: "all",
                    smoothScrolling: true,
                    cursorSmoothCaretAnimation: "on",
                    bracketPairColorization: { enabled: true },
                    guides: { bracketPairs: true },
                    formatOnPaste: false,
                    padding: { top: 12, bottom: 12 },
                  }}
                  onMount={(editor) => {
                    editorInstanceRef.current = editor;
                    editor.onDidScrollChange((e) => {
                      if (isSyncingRef.current || !syncScrollRef.current || !previewRef.current) return;
                      const maxScroll = editor.getScrollHeight() - editor.getLayoutInfo().height;
                      if (maxScroll <= 0) return;
                      isSyncingRef.current = true;
                      const pct = e.scrollTop / maxScroll;
                      const el = previewRef.current;
                      el.scrollTop = pct * (el.scrollHeight - el.clientHeight);
                      requestAnimationFrame(() => { isSyncingRef.current = false; });
                    });
                  }}
                />
              </div>

              {showPreview && (
                <div ref={previewRef} onScroll={handlePreviewScroll} style={{ width: "50%", flexShrink: 0, borderLeft: "1px solid rgba(255,255,255,0.07)", overflowY: "auto", padding: "20px 28px", background: "#080a12", scrollbarWidth: "thin" as const, scrollbarColor: "rgba(56,189,248,0.15) transparent" }}>
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      h1: ({ children }) => <h1 style={{ fontSize: "1.6rem", fontWeight: 700, color: "#E2E8F0", borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: 8, marginTop: 0, marginBottom: 16 }}>{children}</h1>,
                      h2: ({ children }) => <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "#CBD5E1", borderBottom: "1px solid rgba(255,255,255,0.06)", paddingBottom: 6, marginTop: 24, marginBottom: 12 }}>{children}</h2>,
                      h3: ({ children }) => <h3 style={{ fontSize: "1.05rem", fontWeight: 600, color: "#94A3B8", marginTop: 20, marginBottom: 8 }}>{children}</h3>,
                      h4: ({ children }) => <h4 style={{ fontSize: "0.95rem", fontWeight: 600, color: "#64748B", marginTop: 16, marginBottom: 6 }}>{children}</h4>,
                      p: ({ children }) => <p style={{ fontSize: "0.875rem", lineHeight: 1.75, color: "#94A3B8", margin: "0 0 14px" }}>{children}</p>,
                      a: ({ href, children }) => <a href={href} style={{ color: "#38BDF8", textDecoration: "none" }} onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.textDecoration = "underline"; }} onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.textDecoration = "none"; }}>{children}</a>,
                      code: ({ children, className }) => {
                        const isBlock = className?.includes("language-");
                        return isBlock
                          ? <code style={{ display: "block", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 6, padding: "12px 14px", fontSize: "0.8125rem", color: "#C4B5FD", fontFamily: "monospace", overflowX: "auto", marginBottom: 14 }}>{children}</code>
                          : <code style={{ background: "rgba(139,92,246,0.15)", borderRadius: 4, padding: "1px 5px", fontSize: "0.8125rem", color: "#C4B5FD", fontFamily: "monospace" }}>{children}</code>;
                      },
                      pre: ({ children }) => <pre style={{ margin: "0 0 14px", overflowX: "auto" }}>{children}</pre>,
                      blockquote: ({ children }) => <blockquote style={{ borderLeft: "3px solid rgba(56,189,248,0.40)", margin: "0 0 14px", paddingLeft: 14, color: "#64748B" }}>{children}</blockquote>,
                      ul: ({ children }) => <ul style={{ paddingLeft: 20, margin: "0 0 14px", color: "#94A3B8", fontSize: "0.875rem", lineHeight: 1.75 }}>{children}</ul>,
                      ol: ({ children }) => <ol style={{ paddingLeft: 20, margin: "0 0 14px", color: "#94A3B8", fontSize: "0.875rem", lineHeight: 1.75 }}>{children}</ol>,
                      li: ({ children }) => <li style={{ marginBottom: 4 }}>{children}</li>,
                      hr: () => <hr style={{ border: "none", borderTop: "1px solid rgba(255,255,255,0.07)", margin: "20px 0" }} />,
                      table: ({ children }) => <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 14, fontSize: "0.8125rem" }}>{children}</table>,
                      th: ({ children }) => <th style={{ padding: "6px 12px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#C8CDD8", textAlign: "left", fontWeight: 600 }}>{children}</th>,
                      td: ({ children }) => <td style={{ padding: "6px 12px", border: "1px solid rgba(255,255,255,0.06)", color: "#94A3B8" }}>{children}</td>,
                      img: ({ src, alt }) => <img src={src} alt={alt} style={{ maxWidth: "100%", borderRadius: 6, margin: "8px 0" }} />,
                    }}
                  >
                    {editorContent}
                  </ReactMarkdown>
                </div>
              )}
            </div>
          )}
        </div>
      </div>


      <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "0 14px", height: 24, borderTop: "1px solid rgba(255,255,255,0.05)", flexShrink: 0, background: "rgba(139,92,246,0.06)" }}>
        {selectedPath && (
          <>
            <span style={{ fontSize: "0.6875rem", color: "#4A5580" }}>{selectedPath}</span>
            <span style={{ fontSize: "0.6875rem", color: "#3A4060" }}>|</span>
            <span style={{ fontSize: "0.6875rem", color: "#4A5580" }}>{language}</span>
            {isDirty && <span style={{ fontSize: "0.6875rem", color: "#C4B5FD", fontWeight: 600 }}>● unsaved</span>}
          </>
        )}
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: "0.6875rem", color: "#3A4060" }}>{files.length > 0 ? `${files.length} files` : ""}</span>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        * { box-sizing: border-box; }
        body { margin: 0; }
      `}</style>
    </div>
  );
};
