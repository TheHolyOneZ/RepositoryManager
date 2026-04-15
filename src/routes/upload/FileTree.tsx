import React, { useState } from "react";
import { ChevronRight, ChevronDown, Folder, FolderOpen, FileText, File } from "lucide-react";
import type { FileEntry } from "../../lib/tauri/commands";

function formatSize(bytes: number): string {
  if (bytes === 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(name: string) {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const codeExts = ["ts", "tsx", "js", "jsx", "rs", "py", "go", "java", "cpp", "c", "cs", "rb", "swift", "kt"];
  if (codeExts.includes(ext)) return <FileText size={12} style={{ color: "#8B5CF6", flexShrink: 0 }} />;
  return <File size={12} style={{ color: "#4A5580", flexShrink: 0 }} />;
}

function collectPaths(entry: FileEntry): string[] {
  if (!entry.is_dir) return [entry.path];
  return entry.children.flatMap(collectPaths);
}

interface FileNodeProps {
  entry: FileEntry;
  selected: Set<string>;
  onToggle: (paths: string[], checked: boolean) => void;
  depth: number;
}

const FileNode: React.FC<FileNodeProps> = ({ entry, selected, onToggle, depth }) => {
  const [expanded, setExpanded] = useState(depth < 2);

  if (entry.is_dir) {
    const allPaths = collectPaths(entry);
    const checkedCount = allPaths.filter(p => selected.has(p)).length;
    const allChecked = checkedCount === allPaths.length;
    const someChecked = checkedCount > 0 && !allChecked;

    return (
      <div>
        <div
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "4px 8px", paddingLeft: `${8 + depth * 16}px`,
            borderRadius: 6, cursor: "pointer",
            transition: "background 120ms ease",
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.04)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}
        >
          <input
            type="checkbox"
            checked={allChecked}
            ref={el => { if (el) el.indeterminate = someChecked; }}
            onChange={(e) => onToggle(allPaths, e.target.checked)}
            onClick={(e) => e.stopPropagation()}
            style={{ width: 13, height: 13, accentColor: "#8B5CF6", flexShrink: 0, cursor: "pointer" }}
          />
          <div
            style={{ display: "flex", alignItems: "center", gap: 5, flex: 1, minWidth: 0 }}
            onClick={() => setExpanded(v => !v)}
          >
            <span style={{ color: "#3A4060", flexShrink: 0, display: "flex" }}>
              {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </span>
            {expanded
              ? <FolderOpen size={13} style={{ color: "#F59E0B", flexShrink: 0 }} />
              : <Folder size={13} style={{ color: "#F59E0B", flexShrink: 0 }} />
            }
            <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#C8CDD8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {entry.name}
            </span>
            <span style={{ fontSize: "0.6875rem", color: "#3A4060", flexShrink: 0, marginLeft: 4 }}>
              {allPaths.length} file{allPaths.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
        {expanded && entry.children.map(child => (
          <FileNode key={child.path} entry={child} selected={selected} onToggle={onToggle} depth={depth + 1} />
        ))}
      </div>
    );
  }

  const isChecked = selected.has(entry.path);
  return (
    <div
      style={{
        display: "flex", alignItems: "center", gap: 6,
        padding: "3px 8px", paddingLeft: `${8 + depth * 16}px`,
        borderRadius: 6,
        background: isChecked ? "rgba(139,92,246,0.05)" : "transparent",
        transition: "background 120ms ease",
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = isChecked ? "rgba(139,92,246,0.08)" : "rgba(255,255,255,0.03)"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = isChecked ? "rgba(139,92,246,0.05)" : "transparent"; }}
    >
      <input
        type="checkbox"
        checked={isChecked}
        onChange={(e) => onToggle([entry.path], e.target.checked)}
        style={{ width: 13, height: 13, accentColor: "#8B5CF6", flexShrink: 0, cursor: "pointer" }}
      />
      {getFileIcon(entry.name)}
      <span style={{ fontSize: "0.8125rem", color: isChecked ? "#C8CDD8" : "#6B7494", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
        {entry.name}
      </span>
      {entry.size > 0 && (
        <span style={{ fontSize: "0.6875rem", color: "#3A4060", flexShrink: 0 }}>
          {formatSize(entry.size)}
        </span>
      )}
    </div>
  );
};

interface FileTreeProps {
  entries: FileEntry[];
  selected: Set<string>;
  onToggle: (paths: string[], checked: boolean) => void;
}

export const FileTree: React.FC<FileTreeProps> = ({ entries, selected, onToggle }) => {
  if (entries.length === 0) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
      {entries.map(entry => (
        <FileNode key={entry.path} entry={entry} selected={selected} onToggle={onToggle} depth={0} />
      ))}
    </div>
  );
};

export { collectPaths };
