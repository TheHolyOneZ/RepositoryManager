import React from "react";
import { X } from "lucide-react";

const tagColors: Record<string, { color: string; bg: string; border: string }> = {
  keep:   { color: "#10B981", bg: "rgba(16,185,129,0.10)",  border: "rgba(16,185,129,0.25)"  },
  delete: { color: "#EF4444", bg: "rgba(239,68,68,0.10)",   border: "rgba(239,68,68,0.25)"   },
  review: { color: "#F59E0B", bg: "rgba(245,158,11,0.10)",  border: "rgba(245,158,11,0.25)"  },
};
const defaultTag = { color: "#A78BFA", bg: "rgba(139,92,246,0.10)", border: "rgba(139,92,246,0.25)" };

interface TagChipProps {
  tag: string;
  onRemove?: () => void;
}

export const TagChip: React.FC<TagChipProps> = ({ tag, onRemove }) => {
  const s = tagColors[tag] ?? defaultTag;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 3,
      padding: "2px 6px", borderRadius: 5,
      fontSize: "0.625rem", fontWeight: 700, letterSpacing: "0.04em",
      color: s.color, background: s.bg, border: `1px solid ${s.border}`,
      textTransform: "uppercase",
    }}>
      {tag}
      {onRemove && (
        <button
          onClick={onRemove}
          style={{
            background: "none", border: "none", cursor: "pointer",
            color: "inherit", opacity: 0.55, padding: 0,
            display: "flex", alignItems: "center", marginLeft: 1,
            transition: "opacity 120ms",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.opacity = "1"; }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = "0.55"; }}
        >
          <X size={8} />
        </button>
      )}
    </span>
  );
};
