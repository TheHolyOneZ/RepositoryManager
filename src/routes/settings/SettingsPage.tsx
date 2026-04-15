import React, { useState, useRef } from "react";
import {
  Settings, Plus, Trash2, Key, Eye, EyeOff, Shield, Check,
  Tag, X, Keyboard, FlaskConical,
} from "lucide-react";
import { GlassButton } from "../../components/glass/GlassButton";
import { GlassInput } from "../../components/glass/GlassInput";
import { useAccountStore } from "../../stores/accountStore";
import { useUIStore } from "../../stores/uiStore";
import { useRepoStore } from "../../stores/repoStore";
import { githubAddPat, githubLogout } from "../../lib/tauri/commands";
import { formatInvokeError } from "../../lib/formatError";
import { PageShell } from "../../components/ui/PageShell";

const KEYBOARD_SHORTCUTS = [
  { keys: ["⌘", "K"], desc: "Command palette", category: "Global" },
  { keys: ["Esc"], desc: "Close overlays", category: "Global" },
  { keys: ["Space"], desc: "Toggle row selection", category: "Repos" },
  { keys: ["J"], desc: "Move selection down", category: "Repos" },
  { keys: ["K"], desc: "Move selection up", category: "Repos" },
  { keys: ["Enter"], desc: "Open repo detail", category: "Repos" },
  { keys: ["⌘", "A"], desc: "Select all repos", category: "Repos" },
  { keys: ["Del"], desc: "Queue delete (selection)", category: "Repos" },
];

const BUILTIN_TAGS = ["keep", "delete", "review"];
const BUILTIN_TAG_COLORS: Record<string, string> = {
  keep: "#10B981", delete: "#EF4444", review: "#F59E0B",
};

export const SettingsPage: React.FC = () => {
  const accounts = useAccountStore((s) => s.accounts);
  const activeAccountId = useAccountStore((s) => s.activeAccountId);
  const setActive = useAccountStore((s) => s.setActiveAccount);
  const removeAccount = useAccountStore((s) => s.removeAccount);
  const addAccount = useAccountStore((s) => s.addAccount);
  const addToast = useUIStore((s) => s.addToast);
  const isDryRun = useUIStore((s) => s.isDryRunMode);
  const setDryRun = useUIStore((s) => s.setDryRunMode);
  const customTagOptions = useRepoStore((s) => s.customTagOptions);
  const addCustomTagOption = useRepoStore((s) => s.addCustomTagOption);
  const removeCustomTagOption = useRepoStore((s) => s.removeCustomTagOption);

  const [newPat, setNewPat] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [adding, setAdding] = useState(false);
  const [showPat, setShowPat] = useState(false);
  const [newTagInput, setNewTagInput] = useState("");
  const [showTagInput, setShowTagInput] = useState(false);
  const tagInputRef = useRef<HTMLInputElement>(null);

  const handleAddPat = async () => {
    if (!newPat) return;
    setAdding(true);
    try {
      const account = await githubAddPat(newPat, newLabel || "Token");
      addAccount(account);
      setNewPat("");
      setNewLabel("");
      addToast({ type: "success", title: "Account added", message: `Logged in as ${account.login}` });
    } catch (e: unknown) {
      addToast({ type: "error", title: "Couldn't add account", message: formatInvokeError(e) });
    } finally {
      setAdding(false);
    }
  };

  const handleLogout = async (id: string) => {
    try { await githubLogout(id); } catch {  }
    removeAccount(id);
  };

  const handleAddTag = () => {
    const tag = newTagInput.trim().toLowerCase().replace(/\s+/g, "-");
    if (!tag || BUILTIN_TAGS.includes(tag) || customTagOptions.includes(tag)) return;
    addCustomTagOption(tag);
    setNewTagInput("");
    setShowTagInput(false);
  };


  const grouped = KEYBOARD_SHORTCUTS.reduce<Record<string, typeof KEYBOARD_SHORTCUTS>>((acc, s) => {
    acc[s.category] = [...(acc[s.category] ?? []), s];
    return acc;
  }, {});

  return (
    <PageShell title="Settings" subtitle="Accounts, safety, tags, and keyboard shortcuts." icon={Settings} width="narrow" eyebrow={null}>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

        <Section
          kicker="GitHub"
          title="Connected accounts"
          action={<span style={{ fontSize: "0.75rem", color: "#4A5580" }}>{accounts.length} account{accounts.length !== 1 ? "s" : ""}</span>}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {accounts.map((a) => (
              <div key={a.id} style={{
                display: "flex", alignItems: "center", gap: 12, padding: "12px 14px",
                borderRadius: 12, background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.07)",
              }}>
                <img src={a.avatar_url} alt="" style={{ width: 36, height: 36, borderRadius: "50%", border: "1.5px solid rgba(255,255,255,0.10)", flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: "0.875rem", fontWeight: 600, color: "#D4D8E8", letterSpacing: "-0.015em" }}>{a.login}</p>
                  <p style={{ fontSize: "0.625rem", fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase", color: "#3A4560", marginTop: 2 }}>{a.auth_type}</p>
                </div>
                {a.id === activeAccountId ? (
                  <span style={{
                    display: "flex", alignItems: "center", gap: 4, padding: "3px 8px", borderRadius: 6,
                    background: "rgba(16,185,129,0.10)", border: "1px solid rgba(16,185,129,0.22)",
                    fontSize: "0.6875rem", fontWeight: 600, color: "#34D399",
                  }}>
                    <Check size={10} strokeWidth={2.5} /> Active
                  </span>
                ) : (
                  <GlassButton size="sm" variant="secondary" onClick={() => setActive(a.id)}>Switch</GlassButton>
                )}
                <button
                  type="button"
                  onClick={() => handleLogout(a.id)}
                  style={{
                    padding: 7, borderRadius: 8, cursor: "pointer",
                    background: "transparent", border: "none", color: "#3A4560",
                    display: "flex", alignItems: "center", transition: "all 140ms",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background = "rgba(239,68,68,0.10)";
                    (e.currentTarget as HTMLButtonElement).style.color = "#F87171";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                    (e.currentTarget as HTMLButtonElement).style.color = "#3A4560";
                  }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}

            <div style={{ marginTop: 8, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              <p style={{ fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase", color: "#3A4560", marginBottom: 12 }}>
                Add via PAT
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <GlassInput placeholder="Label (e.g. Work laptop)" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} />
                <div style={{ position: "relative" }}>
                  <GlassInput
                    type={showPat ? "text" : "password"}
                    placeholder="ghp_xxxxxxxxxxxx"
                    value={newPat}
                    onChange={(e) => setNewPat(e.target.value)}
                    icon={<Key size={13} />}
                    className="font-mono"
                    style={{ paddingRight: 40 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPat(!showPat)}
                    style={{
                      position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
                      background: "none", border: "none", cursor: "pointer",
                      color: "#4A5580", display: "flex", padding: 0,
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = "#8991A4")}
                    onMouseLeave={(e) => (e.currentTarget.style.color = "#4A5580")}
                  >
                    {showPat ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                <GlassButton variant="primary" size="sm" icon={<Plus size={13} />} loading={adding} disabled={!newPat} onClick={handleAddPat}>
                  Add account
                </GlassButton>
              </div>
            </div>
          </div>
        </Section>

        <Section kicker="Safety" title="Dry run mode" icon={<FlaskConical size={14} style={{ color: "#FBBF24" }} />}>
          <div style={{
            borderRadius: 12, overflow: "hidden",
            border: isDryRun ? "1px solid rgba(245,158,11,0.35)" : "1px solid rgba(255,255,255,0.07)",
            background: isDryRun ? "rgba(245,158,11,0.05)" : "rgba(255,255,255,0.03)",
            transition: "all 200ms",
          }}>
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16,
              padding: "14px 16px",
            }}>
              <div>
                <p style={{ fontSize: "0.875rem", fontWeight: 600, color: isDryRun ? "#FBBF24" : "#D4D8E8", transition: "color 200ms" }}>
                  Simulate destructive work
                </p>
                <p style={{ fontSize: "0.75rem", color: "#4A5580", marginTop: 4, lineHeight: 1.5 }}>
                  When enabled, queue operations preview only — nothing executes on GitHub.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDryRun(!isDryRun)}
                aria-pressed={isDryRun}
                style={{
                  position: "relative", width: 44, height: 24, borderRadius: 12, flexShrink: 0,
                  background: isDryRun ? "#F59E0B" : "rgba(255,255,255,0.12)",
                  border: "none", cursor: "pointer", transition: "background 200ms ease",
                }}
              >
                <span style={{
                  position: "absolute", top: 2,
                  left: isDryRun ? "calc(100% - 22px)" : 2,
                  width: 20, height: 20, borderRadius: "50%",
                  background: "#fff", boxShadow: "0 1px 4px rgba(0,0,0,0.25)",
                  transition: "left 200ms cubic-bezier(0.34,1.56,0.64,1)",
                }} />
              </button>
            </div>
            {isDryRun && (
              <div style={{
                padding: "10px 16px", borderTop: "1px solid rgba(245,158,11,0.20)",
                background: "rgba(245,158,11,0.06)",
                fontSize: "0.75rem", color: "#D97706", display: "flex", alignItems: "center", gap: 7,
              }}>
                <Shield size={12} />
                Active — confirmations will show a preview panel instead of executing.
              </div>
            )}
          </div>
        </Section>

        <Section kicker="Organization" title="Custom tags" icon={<Tag size={14} style={{ color: "#A78BFA" }} />}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <p style={{ fontSize: "0.625rem", fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase", color: "#2D3650", marginBottom: 4 }}>
              Built-in
            </p>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
              {BUILTIN_TAGS.map((tag) => (
                <span key={tag} style={{
                  display: "inline-flex", alignItems: "center", gap: 5,
                  padding: "4px 10px", borderRadius: 6,
                  background: `${BUILTIN_TAG_COLORS[tag]}12`, border: `1px solid ${BUILTIN_TAG_COLORS[tag]}30`,
                  fontSize: "0.75rem", fontWeight: 600, color: BUILTIN_TAG_COLORS[tag],
                  textTransform: "uppercase", letterSpacing: "0.04em",
                }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: BUILTIN_TAG_COLORS[tag] }} />
                  {tag}
                </span>
              ))}
            </div>

            <p style={{ fontSize: "0.625rem", fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase", color: "#2D3650", marginBottom: 4 }}>
              Custom ({customTagOptions.length})
            </p>
            {customTagOptions.length === 0 && !showTagInput && (
              <p style={{ fontSize: "0.75rem", color: "#3A4560", fontStyle: "italic" }}>
                No custom tags yet. Add one below.
              </p>
            )}
            {customTagOptions.length > 0 && (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {customTagOptions.map((tag) => (
                  <span key={tag} style={{
                    display: "inline-flex", alignItems: "center", gap: 5,
                    padding: "4px 8px 4px 10px", borderRadius: 6,
                    background: "rgba(139,92,246,0.10)", border: "1px solid rgba(139,92,246,0.25)",
                    fontSize: "0.75rem", fontWeight: 600, color: "#A78BFA",
                    textTransform: "uppercase", letterSpacing: "0.04em",
                  }}>
                    {tag}
                    <button
                      onClick={() => removeCustomTagOption(tag)}
                      style={{
                        background: "none", border: "none", cursor: "pointer",
                        color: "inherit", opacity: 0.5, padding: 0,
                        display: "flex", alignItems: "center",
                        transition: "opacity 120ms",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
                      onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.5")}
                    >
                      <X size={10} />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {showTagInput ? (
              <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                <input
                  ref={tagInputRef}
                  autoFocus
                  value={newTagInput}
                  onChange={(e) => setNewTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAddTag();
                    if (e.key === "Escape") { setShowTagInput(false); setNewTagInput(""); }
                  }}
                  placeholder="e.g. client-project"
                  maxLength={32}
                  style={{
                    flex: 1, height: 36, borderRadius: 8, fontSize: "0.8125rem",
                    background: "rgba(255,255,255,0.07)", border: "1px solid rgba(139,92,246,0.35)",
                    boxShadow: "0 0 0 3px rgba(139,92,246,0.10)",
                    color: "#D4D8E8", padding: "0 12px", outline: "none",
                  }}
                />
                <button
                  onClick={handleAddTag}
                  disabled={!newTagInput.trim()}
                  style={{
                    height: 36, padding: "0 14px", borderRadius: 8, flexShrink: 0,
                    background: "rgba(139,92,246,0.18)", border: "1px solid rgba(139,92,246,0.35)",
                    color: "#A78BFA", cursor: "pointer", fontSize: "0.8125rem", fontWeight: 600,
                    opacity: newTagInput.trim() ? 1 : 0.4, display: "flex", alignItems: "center", gap: 5,
                  }}
                >
                  <Plus size={13} /> Add
                </button>
                <button
                  onClick={() => { setShowTagInput(false); setNewTagInput(""); }}
                  style={{
                    height: 36, width: 36, borderRadius: 8, flexShrink: 0,
                    background: "transparent", border: "1px solid rgba(255,255,255,0.09)",
                    color: "#4A5580", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                >
                  <X size={13} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => { setShowTagInput(true); setTimeout(() => tagInputRef.current?.focus(), 50); }}
                style={{
                  marginTop: 4, height: 34, padding: "0 14px", borderRadius: 8,
                  display: "flex", alignItems: "center", gap: 6, cursor: "pointer", width: "fit-content",
                  background: "rgba(139,92,246,0.08)", border: "1px dashed rgba(139,92,246,0.25)",
                  color: "#7C6DB5", fontSize: "0.8125rem", fontWeight: 500,
                  transition: "all 140ms",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(139,92,246,0.14)";
                  e.currentTarget.style.borderColor = "rgba(139,92,246,0.45)";
                  e.currentTarget.style.color = "#A78BFA";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(139,92,246,0.08)";
                  e.currentTarget.style.borderColor = "rgba(139,92,246,0.25)";
                  e.currentTarget.style.color = "#7C6DB5";
                }}
              >
                <Plus size={13} /> New custom tag
              </button>
            )}
          </div>
        </Section>

        <Section title="Keyboard shortcuts" icon={<Keyboard size={14} style={{ color: "#7A8AAE" }} />}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {Object.entries(grouped).map(([category, shortcuts]) => (
              <div key={category}>
                <p style={{
                  fontSize: "0.5625rem", fontWeight: 700, letterSpacing: "0.12em",
                  textTransform: "uppercase", color: "#2D3650", marginBottom: 6,
                }}>
                  {category}
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  {shortcuts.map(({ keys, desc }) => (
                    <div key={desc} style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "8px 12px", borderRadius: 8,
                      background: "rgba(255,255,255,0.02)",
                      border: "1px solid rgba(255,255,255,0.055)",
                    }}>
                      <span style={{ fontSize: "0.8125rem", color: "#7A8AAE" }}>{desc}</span>
                      <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                        {keys.map((key, i) => (
                          <React.Fragment key={i}>
                            {i > 0 && <span style={{ fontSize: "0.625rem", color: "#2D3650" }}>+</span>}
                            <kbd style={{
                              padding: "3px 8px", borderRadius: 6,
                              background: "rgba(255,255,255,0.06)",
                              border: "1px solid rgba(255,255,255,0.12)",
                              borderBottom: "2px solid rgba(255,255,255,0.08)",
                              fontFamily: "monospace", fontSize: "0.75rem",
                              color: "#C8CDD8", letterSpacing: 0,
                              boxShadow: "0 1px 2px rgba(0,0,0,0.20)",
                              display: "inline-block",
                            }}>
                              {key}
                            </kbd>
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Section>

      </div>
    </PageShell>
  );
};

const Section: React.FC<{
  kicker?: string;
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  icon?: React.ReactNode;
}> = ({ kicker, title, children, action, icon }) => (
  <div style={{
    borderRadius: 16, overflow: "hidden",
    border: "1px solid rgba(255,255,255,0.085)",
    background: "linear-gradient(160deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.025) 100%)",
    boxShadow: "0 4px 20px rgba(0,0,0,0.20), inset 0 1px 0 rgba(255,255,255,0.06)",
  }}>
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "14px 18px", borderBottom: "1px solid rgba(255,255,255,0.055)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {icon}
        <div>
          {kicker && (
            <p style={{ fontSize: "0.5625rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#3A4560", marginBottom: 2 }}>
              {kicker}
            </p>
          )}
          <p style={{ fontSize: "0.9375rem", fontWeight: 700, color: "#D4D8E8", letterSpacing: "-0.02em" }}>{title}</p>
        </div>
      </div>
      {action}
    </div>
    <div style={{ padding: "18px" }}>{children}</div>
  </div>
);
