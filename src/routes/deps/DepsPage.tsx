import React, { useState, useMemo, useRef, useEffect } from "react";
import { PackageSearch, RefreshCw, AlertTriangle, ChevronDown, ChevronUp, Search, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { CompactRepoGrid } from "../../components/repos/CompactRepoGrid";
import { useRepoStore } from "../../stores/repoStore";
import { useUIStore } from "../../stores/uiStore";
import { ghScanMultipleReposDeps } from "../../lib/tauri/commands";
import { formatInvokeError } from "../../lib/formatError";
import type { RepoDependencies } from "../../types/governance";

const ECO_COLOR: Record<string, string> = {
  npm: "#F59E0B", cargo: "#F97316", pip: "#3B82F6", go: "#06B6D4", maven: "#EF4444",
};

const EcoBadge: React.FC<{ eco: string }> = ({ eco }) => {
  const c = ECO_COLOR[eco] ?? "#8B5CF6";
  return (
    <span style={{ padding: "2px 7px", borderRadius: 5, fontSize: "0.5625rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: c, background: `${c}14`, border: `1px solid ${c}22` }}>
      {eco}
    </span>
  );
};

interface ConflictGroup {
  name: string; ecosystem: string;
  versions: Array<{ version: string; repos: string[] }>;
}

const ByRepoCard: React.FC<{ result: RepoDependencies }> = ({ result }) => {
  const [expanded, setExpanded] = useState(false);
  const ecosystems = [...new Set(result.dependencies.map((d) => d.ecosystem))];
  return (
    <div style={{ borderRadius: 9, border: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.02)", overflow: "hidden", transition: "border-color 140ms" }}
      onMouseEnter={(e) => (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(255,255,255,0.12)"}
      onMouseLeave={(e) => (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(255,255,255,0.07)"}
    >
      <button type="button" onClick={() => setExpanded(!expanded)}
        style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", background: "transparent", border: "none", cursor: "pointer", textAlign: "left" }}
      >
        <span style={{ flex: 1, fontSize: "0.8125rem", fontWeight: 600, color: "#C8CDD8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{result.repo_full_name}</span>
        <div style={{ display: "flex", gap: 5 }}>{ecosystems.map((eco) => <EcoBadge key={eco} eco={eco} />)}</div>
        <span style={{ fontSize: "0.6875rem", color: "#3A4560", whiteSpace: "nowrap" }}>{result.dependencies.length} deps</span>
        {expanded ? <ChevronUp size={12} style={{ color: "#3A4560", flexShrink: 0 }} /> : <ChevronDown size={12} style={{ color: "#3A4560", flexShrink: 0 }} />}
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.15 }} style={{ overflow: "hidden" }}>
            <div style={{ padding: "10px 16px 14px", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
              {result.files_found.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 10 }}>
                  {result.files_found.map((f) => (
                    <span key={f} style={{ padding: "2px 8px", borderRadius: 5, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", fontSize: "0.625rem", fontFamily: "monospace", color: "#6B7A9B" }}>{f}</span>
                  ))}
                </div>
              )}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {result.dependencies.slice(0, 60).map((dep) => (
                  <span key={`${dep.ecosystem}:${dep.name}`} style={{ padding: "2px 8px", borderRadius: 5, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", fontSize: "0.6875rem", fontFamily: "monospace", color: "#6B7A9B" }}>
                    {dep.name}<span style={{ color: "#2D3650" }}>@{dep.version}</span>
                  </span>
                ))}
                {result.dependencies.length > 60 && (
                  <span style={{ fontSize: "0.6875rem", color: "#2D3650", alignSelf: "center" }}>+{result.dependencies.length - 60} more</span>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export const DepsPage: React.FC = () => {
  const repos = useRepoStore((s) => s.repos);
  const addToast = useUIStore((s) => s.addToast);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [scanning, setScanning] = useState(false);
  const [results, setResults] = useState<RepoDependencies[]>([]);
  const [ecoFilter, setEcoFilter] = useState("all");
  const [searchFilter, setSearchFilter] = useState("");
  const [tab, setTab] = useState<"packages" | "conflicts" | "by-repo">("packages");
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setPickerOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const runScan = async () => {
    if (selectedIds.size === 0) return;
    setScanning(true);
    setResults([]);
    setPickerOpen(false);
    try {
      const targets = repos.filter((r) => selectedIds.has(r.id)).map((r) => ({ owner: r.owner, repo: r.name }));
      setResults(await ghScanMultipleReposDeps(targets));
    } catch (e) {
      addToast({ type: "error", title: "Scan failed", message: formatInvokeError(e) });
    } finally { setScanning(false); }
  };

  const allDeps = useMemo(() => {
    const map = new Map<string, { name: string; ecosystem: string; versions: Map<string, Set<string>>; dev: boolean }>();
    for (const repo of results) {
      for (const dep of repo.dependencies) {
        const key = `${dep.ecosystem}:${dep.name}`;
        if (!map.has(key)) map.set(key, { name: dep.name, ecosystem: dep.ecosystem, versions: new Map(), dev: dep.dev });
        const entry = map.get(key)!;
        if (!entry.versions.has(dep.version)) entry.versions.set(dep.version, new Set());
        entry.versions.get(dep.version)!.add(repo.repo_full_name);
      }
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [results]);

  const conflicts = useMemo((): ConflictGroup[] =>
    allDeps.filter((d) => d.versions.size > 1).map((d) => ({
      name: d.name, ecosystem: d.ecosystem,
      versions: Array.from(d.versions.entries()).map(([version, r]) => ({ version, repos: Array.from(r) })),
    })), [allDeps]);

  const ecosystems = useMemo(() => ["all", ...Array.from(new Set(allDeps.map((d) => d.ecosystem)))], [allDeps]);

  const filteredDeps = useMemo(() => allDeps.filter((d) => {
    if (ecoFilter !== "all" && d.ecosystem !== ecoFilter) return false;
    if (searchFilter && !d.name.toLowerCase().includes(searchFilter.toLowerCase())) return false;
    return true;
  }), [allDeps, ecoFilter, searchFilter]);

  const scannedRepos = results.filter((r) => r.files_found.length > 0).length;
  const hasResults = results.length > 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>

      {}
      <div style={{
        flexShrink: 0, display: "flex", alignItems: "center", gap: 0,
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        background: "rgba(255,255,255,0.01)",
        height: 52, paddingLeft: 20, paddingRight: 20,
      }}>
        {}
        <div ref={pickerRef} style={{ position: "relative" }}>
          <button
            onClick={() => setPickerOpen(!pickerOpen)}
            style={{
              display: "flex", alignItems: "center", gap: 7, height: 32, padding: "0 12px", borderRadius: 8, cursor: "pointer",
              background: selectedIds.size > 0 ? "rgba(245,158,11,0.08)" : "rgba(255,255,255,0.05)",
              border: selectedIds.size > 0 ? "1px solid rgba(245,158,11,0.25)" : "1px solid rgba(255,255,255,0.09)",
              color: selectedIds.size > 0 ? "#FCD34D" : "#6B7A9B",
              fontSize: "0.8125rem", fontWeight: selectedIds.size > 0 ? 600 : 400,
              transition: "all 140ms",
            }}
          >
            <PackageSearch size={13} style={{ flexShrink: 0 }} />
            {selectedIds.size > 0 ? `${selectedIds.size} repo${selectedIds.size !== 1 ? "s" : ""} selected` : "Select repos to scan…"}
            <ChevronDown size={11} style={{ color: "#4A5580", flexShrink: 0 }} />
          </button>
          <AnimatePresence>
            {pickerOpen && (
              <motion.div
                initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.12 }}
                style={{
                  position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 60,
                  width: 380, borderRadius: 10, padding: 10,
                  background: "rgba(10,12,26,0.97)", border: "1px solid rgba(255,255,255,0.13)",
                  boxShadow: "0 20px 60px rgba(0,0,0,0.60)",
                }}
              >
                <CompactRepoGrid
                  repos={repos}
                  selectedIds={selectedIds}
                  onToggle={(id) => setSelectedIds((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; })}
                  onSelectAll={() => setSelectedIds(new Set(repos.map((r) => r.id)))}
                  onClearAll={() => setSelectedIds(new Set())}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {}
        <button
          onClick={runScan}
          disabled={selectedIds.size === 0 || scanning}
          style={{
            marginLeft: 8, height: 32, padding: "0 16px", borderRadius: 8, cursor: "pointer",
            background: "linear-gradient(135deg, #F59E0B 0%, #D97706 100%)",
            border: "none", color: "#0A0C1A", fontSize: "0.8125rem", fontWeight: 700,
            display: "flex", alignItems: "center", gap: 6, flexShrink: 0,
            opacity: selectedIds.size === 0 || scanning ? 0.45 : 1,
            boxShadow: selectedIds.size > 0 ? "0 4px 14px rgba(245,158,11,0.28)" : "none",
            transition: "all 140ms",
          }}
        >
          {scanning ? <RefreshCw size={12} style={{ animation: "spin 1s linear infinite" }} /> : <PackageSearch size={12} />}
          {scanning ? "Scanning…" : "Scan"}
        </button>

        {}
        {hasResults && (
          <>
            <div style={{ width: 1, height: 24, background: "rgba(255,255,255,0.07)", margin: "0 16px", flexShrink: 0 }} />
            <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
              <div>
                <span style={{ fontSize: "0.9375rem", fontWeight: 800, color: "#D4D8E8" }}>{allDeps.length}</span>
                <span style={{ fontSize: "0.5625rem", color: "#3A4560", letterSpacing: "0.10em", textTransform: "uppercase", marginLeft: 6 }}>packages</span>
              </div>
              {conflicts.length > 0 && (
                <div>
                  <span style={{ fontSize: "0.9375rem", fontWeight: 800, color: "#F59E0B" }}>{conflicts.length}</span>
                  <span style={{ fontSize: "0.5625rem", color: "#3A4560", letterSpacing: "0.10em", textTransform: "uppercase", marginLeft: 6 }}>conflicts</span>
                </div>
              )}
              <div>
                <span style={{ fontSize: "0.9375rem", fontWeight: 800, color: "#D4D8E8" }}>{scannedRepos}</span>
                <span style={{ fontSize: "0.5625rem", color: "#3A4560", letterSpacing: "0.10em", textTransform: "uppercase", marginLeft: 6 }}>repos found</span>
              </div>
            </div>
          </>
        )}

        <div style={{ flex: 1 }} />

        {}
        {hasResults && (
          <div style={{ display: "flex", gap: 2 }}>
            {(["packages", "conflicts", "by-repo"] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)}
                style={{
                  height: 30, padding: "0 12px", borderRadius: 7, cursor: "pointer",
                  background: tab === t ? "rgba(245,158,11,0.10)" : "transparent",
                  border: tab === t ? "1px solid rgba(245,158,11,0.22)" : "1px solid transparent",
                  color: tab === t ? "#FCD34D" : "#4A5580",
                  fontSize: "0.8125rem", fontWeight: tab === t ? 600 : 400, textTransform: "capitalize",
                  display: "flex", alignItems: "center", gap: 6, transition: "all 130ms",
                }}
              >
                {t === "by-repo" ? "By Repo" : t.charAt(0).toUpperCase() + t.slice(1)}
                {t === "conflicts" && conflicts.length > 0 && (
                  <span style={{ padding: "0 5px", borderRadius: 4, background: "rgba(245,158,11,0.20)", color: "#FBBF24", fontSize: "0.625rem", fontWeight: 700 }}>
                    {conflicts.length}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {}
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>

        {}
        {!hasResults && !scanning && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
            <div style={{ width: 64, height: 64, borderRadius: 18, background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.14)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <PackageSearch size={26} style={{ color: "#78600A" }} />
            </div>
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: "1rem", fontWeight: 700, color: "#8991A4", marginBottom: 8 }}>No scan results yet</p>
              <p style={{ fontSize: "0.8125rem", color: "#3A4560", lineHeight: 1.7, maxWidth: 340 }}>
                Select repositories using the dropdown above, then click Scan.<br />
                Parses <code style={{ fontFamily: "monospace", color: "#6B7A9B" }}>package.json</code>, <code style={{ fontFamily: "monospace", color: "#6B7A9B" }}>Cargo.toml</code>, <code style={{ fontFamily: "monospace", color: "#6B7A9B" }}>requirements.txt</code>, <code style={{ fontFamily: "monospace", color: "#6B7A9B" }}>go.mod</code>, <code style={{ fontFamily: "monospace", color: "#6B7A9B" }}>pom.xml</code>.
              </p>
            </div>
          </div>
        )}

        {scanning && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14 }}>
            <RefreshCw size={22} style={{ color: "#F59E0B", animation: "spin 1s linear infinite" }} />
            <p style={{ fontSize: "0.875rem", color: "#6B7A9B" }}>Scanning {selectedIds.size} repositories…</p>
          </div>
        )}

        {}
        {hasResults && tab === "packages" && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            {}
            <div style={{ flexShrink: 0, display: "flex", gap: 8, alignItems: "center", padding: "10px 24px", borderBottom: "1px solid rgba(255,255,255,0.05)", flexWrap: "wrap" }}>
              <div style={{ position: "relative" }}>
                <Search size={11} style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", color: "#3A4560", pointerEvents: "none" }} />
                <input
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  placeholder="Search packages…"
                  style={{ height: 28, borderRadius: 7, paddingLeft: 26, paddingRight: searchFilter ? 28 : 10, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "#C8CDD8", fontSize: "0.75rem", outline: "none", width: 180 }}
                />
                {searchFilter && (
                  <button onClick={() => setSearchFilter("")} style={{ position: "absolute", right: 7, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#3A4560", padding: 2 }}>
                    <X size={10} />
                  </button>
                )}
              </div>
              <div style={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
                {ecosystems.map((eco) => {
                  const c = ECO_COLOR[eco];
                  return (
                    <button key={eco} onClick={() => setEcoFilter(eco)}
                      style={{
                        height: 26, padding: "0 10px", borderRadius: 6, cursor: "pointer",
                        background: ecoFilter === eco ? (c ? `${c}14` : "rgba(139,92,246,0.12)") : "transparent",
                        border: ecoFilter === eco ? `1px solid ${c ?? "#8B5CF6"}30` : "1px solid transparent",
                        color: ecoFilter === eco ? (c ?? "#C4B5FD") : "#4A5580",
                        fontSize: "0.75rem", fontWeight: ecoFilter === eco ? 600 : 400,
                      }}
                    >{eco}</button>
                  );
                })}
              </div>
              <span style={{ fontSize: "0.6875rem", color: "#2D3650", marginLeft: "auto" }}>{filteredDeps.length} packages</span>
            </div>
            {}
            <div style={{ flex: 1, overflowY: "auto", padding: "12px 24px" }}>
              {filteredDeps.map((dep) => (
                <div key={`${dep.ecosystem}:${dep.name}`} style={{
                  display: "grid", gridTemplateColumns: "auto 1fr auto auto", alignItems: "center", gap: 12,
                  padding: "8px 14px", borderRadius: 8, marginBottom: 3,
                  background: dep.versions.size > 1 ? "rgba(245,158,11,0.04)" : "rgba(255,255,255,0.02)",
                  border: dep.versions.size > 1 ? "1px solid rgba(245,158,11,0.16)" : "1px solid rgba(255,255,255,0.06)",
                  transition: "border-color 140ms",
                }}
                  onMouseEnter={(e) => (e.currentTarget as HTMLDivElement).style.borderColor = dep.versions.size > 1 ? "rgba(245,158,11,0.30)" : "rgba(255,255,255,0.12)"}
                  onMouseLeave={(e) => (e.currentTarget as HTMLDivElement).style.borderColor = dep.versions.size > 1 ? "rgba(245,158,11,0.16)" : "rgba(255,255,255,0.06)"}
                >
                  <EcoBadge eco={dep.ecosystem} />
                  <span style={{ fontFamily: "'Cascadia Code','Consolas',monospace", fontSize: "0.8125rem", color: "#C8CDD8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {dep.name}
                  </span>
                  <div style={{ display: "flex", gap: 5, flexWrap: "wrap", justifyContent: "flex-end" }}>
                    {Array.from(dep.versions.entries()).map(([ver, repoSet]) => (
                      <span key={ver} style={{
                        padding: "2px 8px", borderRadius: 5, fontFamily: "monospace", fontSize: "0.6875rem",
                        color: dep.versions.size > 1 ? "#FBBF24" : "#6B7A9B",
                        background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)",
                      }}>
                        {ver}<span style={{ color: "#2D3650" }}> ×{repoSet.size}</span>
                      </span>
                    ))}
                  </div>
                  {dep.versions.size > 1 && <AlertTriangle size={12} style={{ color: "#F59E0B", flexShrink: 0 }} />}
                </div>
              ))}
            </div>
          </div>
        )}

        {}
        {hasResults && tab === "conflicts" && (
          <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px" }}>
            {conflicts.length === 0 ? (
              <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 }}>
                <div style={{ width: 56, height: 56, borderRadius: 16, background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.14)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <PackageSearch size={22} style={{ color: "#10B981" }} />
                </div>
                <p style={{ fontSize: "0.9375rem", fontWeight: 700, color: "#10B981" }}>No version conflicts</p>
                <p style={{ fontSize: "0.8125rem", color: "#3A4560" }}>All shared packages use consistent versions across repos.</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {conflicts.map((c) => (
                  <div key={`${c.ecosystem}:${c.name}`} style={{ borderRadius: 10, border: "1px solid rgba(245,158,11,0.20)", background: "rgba(245,158,11,0.03)", overflow: "hidden" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px" }}>
                      <AlertTriangle size={13} style={{ color: "#F59E0B", flexShrink: 0 }} />
                      <EcoBadge eco={c.ecosystem} />
                      <span style={{ fontFamily: "monospace", fontSize: "0.875rem", fontWeight: 600, color: "#D4D8E8", flex: 1 }}>{c.name}</span>
                      <span style={{ fontSize: "0.6875rem", color: "#F59E0B", fontWeight: 700, background: "rgba(245,158,11,0.12)", padding: "2px 8px", borderRadius: 5 }}>
                        {c.versions.length} versions
                      </span>
                    </div>
                    <div style={{ padding: "0 16px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
                      {c.versions.map(({ version, repos }) => (
                        <div key={version} style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                          <span style={{ fontFamily: "monospace", fontSize: "0.8125rem", fontWeight: 700, color: "#FBBF24", flexShrink: 0 }}>{version}</span>
                          <span style={{ fontSize: "0.75rem", color: "#4A5580", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{repos.join(", ")}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {}
        {hasResults && tab === "by-repo" && (
          <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {results.map((r) => <ByRepoCard key={r.repo_full_name} result={r} />)}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
