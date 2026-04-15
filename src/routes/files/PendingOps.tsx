import React from "react";
import { Trash2, MoveRight, X } from "lucide-react";
import type { FileOp } from "../../lib/tauri/commands";

interface PendingOpsProps {
  ops: FileOp[];
  onRemove: (index: number) => void;
}

export const PendingOps: React.FC<PendingOpsProps> = ({ ops, onRemove }) => {
  if (ops.length === 0) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {ops.map((op, i) => (
        <div key={i} style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "6px 10px", borderRadius: 7,
          background: op.op === "delete" ? "rgba(239,68,68,0.06)" : "rgba(56,189,248,0.06)",
          border: `1px solid ${op.op === "delete" ? "rgba(239,68,68,0.14)" : "rgba(56,189,248,0.14)"}`,
        }}>
          {op.op === "delete"
            ? <Trash2 size={11} style={{ color: "#EF4444", flexShrink: 0 }} />
            : <MoveRight size={11} style={{ color: "#38BDF8", flexShrink: 0 }} />
          }
          {op.op === "delete" ? (
            <span style={{ fontSize: "0.75rem", color: "#F87171", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textDecoration: "line-through" }}>
              {op.path}
            </span>
          ) : (
            <span style={{ fontSize: "0.75rem", color: "#7DD3FC", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {op.old_path} → {op.new_path}
            </span>
          )}
          <button onClick={() => onRemove(i)} style={{ background: "none", border: "none", cursor: "pointer", color: "#3A4060", padding: 2, display: "flex", flexShrink: 0 }}>
            <X size={11} />
          </button>
        </div>
      ))}
    </div>
  );
};
