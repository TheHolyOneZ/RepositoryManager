import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, User, Building2 } from "lucide-react";
import { useOrgStore } from "../../stores/orgStore";
import { useAccountStore, selectActiveAccount } from "../../stores/accountStore";

export const ContextSwitcher: React.FC = () => {
  const activeAccount = useAccountStore(selectActiveAccount);
  const { orgs, activeContext, setContext } = useOrgStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const label = activeContext.type === "org" ? activeContext.login : (activeAccount?.login ?? "Personal");
  const avatar = activeContext.type === "org" ? activeContext.avatar_url : (activeAccount?.avatar_url ?? null);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "flex", alignItems: "center", gap: 7,
          padding: "5px 8px", borderRadius: 8, cursor: "pointer",
          background: open ? "rgba(139,92,246,0.12)" : "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
          color: "#C8CDD8", fontSize: "0.75rem", fontWeight: 600,
          transition: "background 140ms ease",
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.07)"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = open ? "rgba(139,92,246,0.12)" : "rgba(255,255,255,0.04)"; }}
      >
        {avatar
          ? <img src={avatar} alt={label} style={{ width: 18, height: 18, borderRadius: "50%" }} />
          : <User size={13} />}
        <span style={{ maxWidth: 100, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
        <ChevronDown size={11} style={{ opacity: 0.5 }} />
      </button>

      {open && (
        <div style={{
          position: "absolute", bottom: "calc(100% + 6px)", left: 0, zIndex: 200,
          minWidth: 180, borderRadius: 10,
          background: "#0D1025", border: "1px solid rgba(255,255,255,0.10)",
          boxShadow: "0 -8px 32px rgba(0,0,0,0.6)",
          padding: "4px 0",
        }}>
          <p style={{ fontSize: "0.5625rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#3A4560", padding: "6px 12px 4px" }}>Context</p>
          <DropItem
            avatar={activeAccount?.avatar_url ?? null}
            label={activeAccount?.login ?? "Personal"}
            icon={<User size={13} />}
            active={activeContext.type === "user"}
            onClick={() => { setContext({ type: "user" }); setOpen(false); }}
          />
          {orgs.length > 0 && (
            <>
              <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "4px 0" }} />
              <p style={{ fontSize: "0.5625rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#3A4560", padding: "4px 12px" }}>Organizations</p>
              {orgs.map((org) => (
                <DropItem
                  key={org.login}
                  avatar={org.avatar_url}
                  label={org.login}
                  icon={<Building2 size={13} />}
                  active={activeContext.type === "org" && activeContext.login === org.login}
                  onClick={() => { setContext({ type: "org", login: org.login, avatar_url: org.avatar_url }); setOpen(false); }}
                />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
};

const DropItem: React.FC<{
  avatar: string | null; label: string; icon: React.ReactNode;
  active: boolean; onClick: () => void;
}> = ({ avatar, label, active, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    style={{
      width: "100%", display: "flex", alignItems: "center", gap: 8,
      padding: "7px 12px", cursor: "pointer", border: "none",
      background: active ? "rgba(139,92,246,0.15)" : "transparent",
      color: active ? "#C4B5FD" : "#9AA5BE", fontSize: "0.8125rem", fontWeight: 500,
      transition: "background 120ms ease",
    }}
    onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.055)"; }}
    onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
  >
    {avatar
      ? <img src={avatar} alt={label} style={{ width: 18, height: 18, borderRadius: "50%", flexShrink: 0 }} />
      : <div style={{ width: 18, height: 18, borderRadius: "50%", background: "rgba(255,255,255,0.08)", flexShrink: 0 }} />}
    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
    {active && <span style={{ marginLeft: "auto", color: "#8B5CF6", fontSize: 10 }}>✓</span>}
  </button>
);
