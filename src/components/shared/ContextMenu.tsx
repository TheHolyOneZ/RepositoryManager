import React, { useEffect } from "react";
import { createPortal } from "react-dom";

export type ContextMenuItemDef =
  | { type: "item"; label: string; icon?: React.ElementType; onClick: () => void; danger?: boolean; disabled?: boolean }
  | { type: "divider" };

interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuItemDef[];
  onClose: () => void;
}

const MENU_WIDTH = 192;
const MENU_APPROX_HEIGHT = 280;

export const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, items, onClose }) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    const onScroll = () => onClose();
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [onClose]);

  const left = Math.min(x, window.innerWidth - MENU_WIDTH - 10);
  const top = Math.min(y, window.innerHeight - MENU_APPROX_HEIGHT - 10);

  return createPortal(
    <>

      <div
        style={{ position: "fixed", inset: 0, zIndex: 9998 }}
        onMouseDown={onClose}
        onContextMenu={e => { e.preventDefault(); onClose(); }}
      />
      <div
        style={{
          position: "fixed", left, top, zIndex: 9999,
          minWidth: MENU_WIDTH,
          background: "linear-gradient(180deg, rgba(14,16,34,0.99) 0%, rgba(10,12,26,0.99) 100%)",
          border: "1px solid rgba(255,255,255,0.10)",
          borderRadius: 11,
          padding: "5px 4px",
          boxShadow: "0 24px 64px rgba(0,0,0,0.75), 0 0 0 1px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.05)",
        }}
        onMouseDown={e => e.stopPropagation()}
      >
        {items.map((item, i) => {
          if (item.type === "divider") {
            return <div key={i} style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "4px 6px" }} />;
          }
          const Icon = item.icon;
          return (
            <button
              key={i}
              disabled={item.disabled}
              onClick={() => { if (!item.disabled) { item.onClick(); onClose(); } }}
              style={{
                width: "100%", display: "flex", alignItems: "center", gap: 9,
                padding: "7px 10px", borderRadius: 7,
                border: "none", background: "transparent",
                cursor: item.disabled ? "not-allowed" : "pointer",
                color: item.danger ? "#F87171" : item.disabled ? "#2D3450" : "#C8CDD8",
                fontSize: "0.8125rem", fontWeight: 500,
                textAlign: "left", transition: "background 80ms",
                letterSpacing: "-0.01em",
              }}
              onMouseEnter={e => {
                if (!item.disabled)
                  (e.currentTarget as HTMLButtonElement).style.background =
                    item.danger ? "rgba(239,68,68,0.10)" : "rgba(255,255,255,0.065)";
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLButtonElement).style.background = "transparent";
              }}
            >
              {Icon && (
                <Icon
                  size={13}
                  style={{ flexShrink: 0, color: item.danger ? "#EF4444" : item.disabled ? "#2D3450" : "#5A6490" }}
                />
              )}
              <span style={{ flex: 1 }}>{item.label}</span>
            </button>
          );
        })}
      </div>
    </>,
    document.body
  );
};
