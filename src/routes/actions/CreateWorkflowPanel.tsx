import React, { useState, useCallback, useEffect } from "react";
import Editor from "@monaco-editor/react";
import { CheckCircle2, XCircle, Loader2, ChevronRight, Info, Upload } from "lucide-react";
import { repoCreateWorkflow, readTextFile } from "../../lib/tauri/commands";
import { open as dialogOpen } from "@tauri-apps/plugin-dialog";
import { fanout } from "../../lib/utils/fanout";
import { formatInvokeError } from "../../lib/formatError";
import type { Repo } from "../../types/repo";

const T = {
  tauri: {
    name: "Tauri Release",
    description: "Builds .exe, .msi, .deb, .rpm, .AppImage, .dmg on tag push",
    filename: "release.yml",
    content: `name: Release
on:
  push:
    tags: ['v*']
  workflow_dispatch:
permissions:
  contents: write
jobs:
  release:
    strategy:
      fail-fast: false
      matrix:
        include:
          - platform: macos-latest
            args: '--target aarch64-apple-darwin'
          - platform: macos-latest
            args: '--target x86_64-apple-darwin'
          - platform: ubuntu-22.04
            args: ''
          - platform: windows-latest
            args: ''
    runs-on: \${{ matrix.platform }}
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: lts/*

      - uses: dtolnay/rust-toolchain@stable
        with:
          targets: \${{ matrix.platform == 'macos-latest' && 'aarch64-apple-darwin,x86_64-apple-darwin' || '' }}

      - uses: Swatinem/rust-cache@v2

      - name: Install Linux deps
        if: matrix.platform == 'ubuntu-22.04'
        run: |
          sudo apt-get update
          sudo apt-get install -y libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf

      # ── Detect package manager ─────────────────────────────────────────────
      - name: Detect package manager
        id: pkg
        shell: bash
        run: |
          if [ -f "pnpm-lock.yaml" ]; then
            echo "manager=pnpm" >> $GITHUB_OUTPUT
            echo "install=pnpm install" >> $GITHUB_OUTPUT
          elif [ -f "yarn.lock" ]; then
            echo "manager=yarn" >> $GITHUB_OUTPUT
            echo "install=yarn install --frozen-lockfile" >> $GITHUB_OUTPUT
          else
            echo "manager=npm" >> $GITHUB_OUTPUT
            echo "install=npm install" >> $GITHUB_OUTPUT
          fi

      - name: Setup pnpm
        if: steps.pkg.outputs.manager == 'pnpm'
        uses: pnpm/action-setup@v4
        with:
          version: latest
          run_install: false

      - name: Install dependencies
        run: \${{ steps.pkg.outputs.install }}

      # ── Signing keys (required for updater JSON) ──────────────────────────
      # Add these two secrets to your repo:
      #   TAURI_SIGNING_PRIVATE_KEY  — generate with: npx tauri signer generate
      #   TAURI_SIGNING_PRIVATE_KEY_PASSWORD — the password you chose (can be empty)
      # Without them the updater JSON is skipped (includeUpdaterJson: false below).

      # On tag push → build + upload to GitHub Release
      - name: Build and release (tag push)
        if: github.ref_type == 'tag'
        uses: tauri-apps/tauri-action@v0
        env:
          GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}
          TAURI_SIGNING_PRIVATE_KEY: \${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}
          TAURI_SIGNING_PRIVATE_KEY_PASSWORD: \${{ secrets.TAURI_SIGNING_PRIVATE_KEY_PASSWORD }}
        with:
          tagName: \${{ github.ref_name }}
          releaseName: 'v__VERSION__'
          releaseBody: 'See the assets below to download and install.'
          releaseDraft: true
          prerelease: false
          includeUpdaterJson: \${{ secrets.TAURI_SIGNING_PRIVATE_KEY != '' }}
          args: \${{ matrix.args }}

      # On manual dispatch → build only, upload as CI artifact
      - name: Build (manual dispatch)
        if: github.ref_type != 'tag'
        uses: tauri-apps/tauri-action@v0
        env:
          GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}
          TAURI_SIGNING_PRIVATE_KEY: \${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}
          TAURI_SIGNING_PRIVATE_KEY_PASSWORD: \${{ secrets.TAURI_SIGNING_PRIVATE_KEY_PASSWORD }}
        with:
          includeUpdaterJson: false
          args: \${{ matrix.args }}

      - name: Upload CI artifacts (manual dispatch)
        if: github.ref_type != 'tag'
        uses: actions/upload-artifact@v4
        with:
          name: installers-\${{ matrix.platform }}
          path: |
            src-tauri/target/release/bundle/**/*.deb
            src-tauri/target/release/bundle/**/*.rpm
            src-tauri/target/release/bundle/**/*.AppImage
            src-tauri/target/release/bundle/**/*.exe
            src-tauri/target/release/bundle/**/*.msi
            src-tauri/target/release/bundle/**/*.dmg
            src-tauri/target/*/release/bundle/**/*.deb
            src-tauri/target/*/release/bundle/**/*.rpm
            src-tauri/target/*/release/bundle/**/*.AppImage
            src-tauri/target/*/release/bundle/**/*.exe
            src-tauri/target/*/release/bundle/**/*.msi
            src-tauri/target/*/release/bundle/**/*.dmg
          if-no-files-found: warn
`,
  },
  node_ci: {
    name: "Node.js CI",
    description: "Install, lint, and test on every push and pull request",
    filename: "ci.yml",
    content: `name: CI
on:
  push:
    branches: [main, master]
  pull_request:
    branches: [main, master]
jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [18.x, 20.x, 22.x]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: \${{ matrix.node-version }}
          cache: npm
      - run: npm ci
      - run: npm run build --if-present
      - run: npm test --if-present
`,
  },
  rust_ci: {
    name: "Rust CI",
    description: "fmt, clippy, and test on every push and pull request",
    filename: "ci.yml",
    content: `name: CI
on:
  push:
    branches: [main, master]
  pull_request:
    branches: [main, master]
env:
  CARGO_TERM_COLOR: always
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: dtolnay/rust-toolchain@stable
        with:
          components: rustfmt, clippy
      - uses: Swatinem/rust-cache@v2
      - run: cargo fmt --check
      - run: cargo clippy -- -D warnings
      - run: cargo build --verbose
      - run: cargo test --verbose
`,
  },
  python_ci: {
    name: "Python CI",
    description: "Lint with flake8 and run pytest across Python versions",
    filename: "ci.yml",
    content: `name: CI
on:
  push:
    branches: [main, master]
  pull_request:
    branches: [main, master]
jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        python-version: ['3.10', '3.11', '3.12']
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: \${{ matrix.python-version }}
      - run: pip install -r requirements.txt
      - run: pip install flake8 pytest
      - run: flake8 . --count --select=E9,F63,F7,F82 --show-source
      - run: pytest
`,
  },
  docker: {
    name: "Docker Build & Push",
    description: "Build and push to GitHub Container Registry on push/tag",
    filename: "docker.yml",
    content: `name: Docker
on:
  push:
    branches: [main]
    tags: ['v*']
env:
  REGISTRY: ghcr.io
  IMAGE_NAME: \${{ github.repository }}
jobs:
  build:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v4
      - uses: docker/login-action@v3
        with:
          registry: \${{ env.REGISTRY }}
          username: \${{ github.actor }}
          password: \${{ secrets.GITHUB_TOKEN }}
      - uses: docker/metadata-action@v5
        id: meta
        with:
          images: \${{ env.REGISTRY }}/\${{ env.IMAGE_NAME }}
      - uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: \${{ steps.meta.outputs.tags }}
          labels: \${{ steps.meta.outputs.labels }}
`,
  },
  pages: {
    name: "GitHub Pages Deploy",
    description: "Build a static site and deploy to GitHub Pages",
    filename: "pages.yml",
    content: `name: Deploy Pages
on:
  push:
    branches: [main]
  workflow_dispatch:
permissions:
  contents: read
  pages: write
  id-token: write
concurrency:
  group: pages
  cancel-in-progress: false
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: lts/*
          cache: npm
      - run: npm ci
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: ./dist
  deploy:
    environment:
      name: github-pages
      url: \${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    needs: build
    steps:
      - uses: actions/deploy-pages@v4
        id: deployment
`,
  },
  release_drafter: {
    name: "Release Drafter",
    description: "Auto-draft release notes from PR titles on every push",
    filename: "release-drafter.yml",
    content: `name: Release Drafter
on:
  push:
    branches: [main, master]
  pull_request:
    types: [opened, reopened, synchronize]
permissions:
  contents: read
  pull-requests: read
jobs:
  update_release_draft:
    permissions:
      contents: write
      pull-requests: write
    runs-on: ubuntu-latest
    steps:
      - uses: release-drafter/release-drafter@v6
        env:
          GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}
`,
  },
  blank: {
    name: "Blank",
    description: "Empty template — write your own from scratch",
    filename: "workflow.yml",
    content: `name: My Workflow
on:
  push:
    branches: [main]
  workflow_dispatch:
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run a script
        run: echo "Hello, world!"
`,
  },
};

type TemplateKey = keyof typeof T;

const INPUT_STYLE: React.CSSProperties = {
  height: 32, borderRadius: 7, background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.10)", color: "#C8CDD8",
  fontSize: "0.8125rem", padding: "0 10px", outline: "none",
};

interface Props {
  selectedRepos: Repo[];
}

export const CreateWorkflowPanel: React.FC<Props> = ({ selectedRepos }) => {
  const [template, setTemplate] = useState<TemplateKey | "upload">("tauri");
  const [yaml, setYaml] = useState(T.tauri.content);
  const [filename, setFilename] = useState(T.tauri.filename);
  const [useDefaultBranch, setUseDefaultBranch] = useState(true);
  const [branch, setBranch] = useState("main");
  const [commitMsg, setCommitMsg] = useState("chore: add GitHub Actions workflow");
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [results, setResults] = useState<Array<{ repo: string; ok: boolean; error?: string }> | null>(null);
  const [uploadLoading, setUploadLoading] = useState(false);

  useEffect(() => {
    if (selectedRepos.length > 0 && !useDefaultBranch) {
      setBranch(selectedRepos[0].default_branch ?? "main");
    }
  }, [selectedRepos]);

  const selectTemplate = useCallback((key: TemplateKey) => {
    setTemplate(key);
    setYaml(T[key].content);
    setFilename(T[key].filename);
  }, []);

  const handleUpload = useCallback(async () => {
    setUploadLoading(true);
    try {
      const path = await dialogOpen({
        filters: [{ name: "YAML workflow", extensions: ["yml", "yaml"] }],
        multiple: false,
      });
      if (path && typeof path === "string") {
        const content = await readTextFile(path);
        setYaml(content);
        const name = path.split("/").pop()?.split("\\").pop() ?? "workflow.yml";
        setFilename(name);
        setTemplate("upload");
      }
    } catch {

    } finally {
      setUploadLoading(false);
    }
  }, []);

  const handleCreate = useCallback(async () => {
    if (!selectedRepos.length || !yaml.trim() || !filename.trim()) return;
    setRunning(true);
    setResults(null);
    setProgress({ done: 0, total: selectedRepos.length });

    const rows = await fanout(selectedRepos, 4, async (repo) => {
      const targetBranch = useDefaultBranch ? (repo.default_branch ?? "main") : branch;
      await repoCreateWorkflow(repo.owner, repo.name, targetBranch, filename.trim(), yaml, commitMsg);
    }, (done, total) => setProgress({ done, total }));

    setResults(rows.map((r) => ({ repo: r.item.full_name, ok: r.ok, error: r.error })));
    setRunning(false);
    setProgress(null);
  }, [selectedRepos, yaml, filename, branch, useDefaultBranch, commitMsg]);

  const canCreate = selectedRepos.length > 0 && yaml.trim().length > 0 && filename.trim().length > 0 && !running;

  return (
    <div style={{ display: "flex", height: "100%", minHeight: 0, overflow: "hidden" }}>


      <div style={{ width: 268, flexShrink: 0, display: "flex", flexDirection: "column", borderRight: "1px solid rgba(255,255,255,0.065)", overflow: "hidden" }}>


        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "14px 13px 8px", scrollbarWidth: "thin" as const, scrollbarColor: "rgba(139,92,246,0.2) transparent" }}>
          <div style={{ padding: "8px 10px", borderRadius: 8, marginBottom: 12, background: "rgba(96,165,250,0.06)", border: "1px solid rgba(96,165,250,0.15)", display: "flex", gap: 8, alignItems: "flex-start" }}>
            <Info size={13} style={{ color: "#60A5FA", flexShrink: 0, marginTop: 1 }} />
            <p style={{ fontSize: "0.71rem", color: "#7A90B4", lineHeight: 1.55, margin: 0 }}>
              Pick a template, edit the YAML, then commit to <strong style={{ color: "#93B4D8" }}>{selectedRepos.length} repo{selectedRepos.length !== 1 ? "s" : ""}</strong> at once. Requires a PAT with the <code style={{ background: "rgba(255,255,255,0.06)", padding: "1px 4px", borderRadius: 3 }}>workflow</code> scope.
            </p>
          </div>

          <p style={{ fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase", color: "#3A4060", margin: "0 0 7px" }}>Template</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {(Object.keys(T) as TemplateKey[]).map((key) => (
              <button key={key} onClick={() => selectTemplate(key)}
                style={{ textAlign: "left", padding: "6px 9px", borderRadius: 7, cursor: "pointer", background: template === key ? "rgba(139,92,246,0.14)" : "transparent", border: template === key ? "1px solid rgba(139,92,246,0.28)" : "1px solid transparent", transition: "all 100ms" }}
                onMouseEnter={e => { if (template !== key) (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.03)"; }}
                onMouseLeave={e => { if (template !== key) (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
              >
                <p style={{ margin: 0, fontSize: "0.8125rem", fontWeight: 600, color: template === key ? "#C4B5FD" : "#8A91A8" }}>{T[key].name}</p>
                <p style={{ margin: "2px 0 0", fontSize: "0.6875rem", color: template === key ? "#7C6BAE" : "#3A4560", lineHeight: 1.4 }}>{T[key].description}</p>
              </button>
            ))}


            <button onClick={handleUpload} disabled={uploadLoading}
              style={{ textAlign: "left", padding: "6px 9px", borderRadius: 7, cursor: "pointer", background: template === "upload" ? "rgba(56,189,248,0.10)" : "transparent", border: template === "upload" ? "1px solid rgba(56,189,248,0.25)" : "1px solid rgba(56,189,248,0.10)", transition: "all 100ms", display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}
              onMouseEnter={e => { if (template !== "upload") (e.currentTarget as HTMLButtonElement).style.background = "rgba(56,189,248,0.05)"; }}
              onMouseLeave={e => { if (template !== "upload") (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
            >
              {uploadLoading
                ? <Loader2 size={13} style={{ color: "#38BDF8", animation: "spin 1s linear infinite", flexShrink: 0 }} />
                : <Upload size={13} style={{ color: "#38BDF8", flexShrink: 0 }} />
              }
              <div>
                <p style={{ margin: 0, fontSize: "0.8125rem", fontWeight: 600, color: template === "upload" ? "#7DD3FC" : "#38BDF8" }}>Upload .yml file</p>
                <p style={{ margin: "2px 0 0", fontSize: "0.6875rem", color: "#2A5070", lineHeight: 1.4 }}>Pick a local workflow file and edit it here</p>
              </div>
            </button>
          </div>
        </div>


        <div style={{ flexShrink: 0, borderTop: "1px solid rgba(255,255,255,0.06)", padding: "12px 13px", display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            <div>
              <label style={{ fontSize: "0.71rem", color: "#4A5580", display: "block", marginBottom: 3 }}>Filename</label>
              <input value={filename} onChange={e => setFilename(e.target.value)} style={{ ...INPUT_STYLE, width: "100%", height: 30 }}
                onFocus={e => { (e.target as HTMLInputElement).style.borderColor = "rgba(139,92,246,0.4)"; }}
                onBlur={e => { (e.target as HTMLInputElement).style.borderColor = "rgba(255,255,255,0.10)"; }}
              />
              <p style={{ fontSize: "0.6rem", color: "#2D3450", marginTop: 2 }}>.github/workflows/{filename || "…"}</p>
            </div>

            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                <label style={{ fontSize: "0.71rem", color: "#4A5580" }}>Branch</label>

                <button
                  type="button"
                  onClick={() => setUseDefaultBranch(v => !v)}
                  style={{
                    display: "flex", alignItems: "center", gap: 6, padding: "3px 8px 3px 5px",
                    borderRadius: 20, cursor: "pointer",
                    background: useDefaultBranch ? "rgba(139,92,246,0.18)" : "rgba(255,255,255,0.05)",
                    border: useDefaultBranch ? "1px solid rgba(139,92,246,0.35)" : "1px solid rgba(255,255,255,0.09)",
                    transition: "all 150ms",
                  }}
                >

                  <span style={{
                    position: "relative", display: "inline-block",
                    width: 26, height: 14, borderRadius: 7, flexShrink: 0,
                    background: useDefaultBranch ? "#7C3AED" : "rgba(255,255,255,0.10)",
                    transition: "background 150ms",
                  }}>

                    <span style={{
                      position: "absolute", top: 2,
                      left: useDefaultBranch ? 14 : 2,
                      width: 10, height: 10, borderRadius: "50%",
                      background: useDefaultBranch ? "#fff" : "#5A6890",
                      transition: "left 150ms",
                    }} />
                  </span>
                  <span style={{ fontSize: "0.65rem", color: useDefaultBranch ? "#C4B5FD" : "#4A5580", fontWeight: 500, whiteSpace: "nowrap" }}>
                    per-repo default
                  </span>
                </button>
              </div>
              {useDefaultBranch ? (
                <div style={{ ...INPUT_STYLE, height: 30, display: "flex", alignItems: "center", opacity: 0.45, userSelect: "none" as const, fontSize: "0.75rem", color: "#6070A0", fontStyle: "italic" }}>
                  {selectedRepos.length === 1 ? (selectedRepos[0].default_branch || "default branch") : "each repo's default branch"}
                </div>
              ) : (
                <input value={branch} onChange={e => setBranch(e.target.value)} style={{ ...INPUT_STYLE, width: "100%", height: 30 }}
                  onFocus={e => { (e.target as HTMLInputElement).style.borderColor = "rgba(139,92,246,0.4)"; }}
                  onBlur={e => { (e.target as HTMLInputElement).style.borderColor = "rgba(255,255,255,0.10)"; }}
                />
              )}
            </div>

            <div>
              <label style={{ fontSize: "0.71rem", color: "#4A5580", display: "block", marginBottom: 3 }}>Commit message</label>
              <input value={commitMsg} onChange={e => setCommitMsg(e.target.value)} style={{ ...INPUT_STYLE, width: "100%", height: 30 }}
                onFocus={e => { (e.target as HTMLInputElement).style.borderColor = "rgba(139,92,246,0.4)"; }}
                onBlur={e => { (e.target as HTMLInputElement).style.borderColor = "rgba(255,255,255,0.10)"; }}
              />
            </div>
          </div>

          {progress && (
            <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 7, padding: "7px 10px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: "0.71rem", color: "#7A88A6" }}>Creating…</span>
                <span style={{ fontSize: "0.71rem", color: "#C4B5FD" }}>{progress.done}/{progress.total}</span>
              </div>
              <div style={{ height: 3, borderRadius: 2, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                <div style={{ height: "100%", borderRadius: 2, background: "linear-gradient(90deg, #8B5CF6, #7C3AED)", width: `${(progress.done / progress.total) * 100}%`, transition: "width 200ms" }} />
              </div>
            </div>
          )}

          <button onClick={handleCreate} disabled={!canCreate}
            style={{ height: 34, borderRadius: 8, cursor: canCreate ? "pointer" : "not-allowed", fontWeight: 700, fontSize: "0.8125rem", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: canCreate ? "rgba(139,92,246,0.80)" : "rgba(139,92,246,0.15)", border: "1px solid rgba(139,92,246,0.40)", color: canCreate ? "#fff" : "#7C6BAE", transition: "all 130ms" }}>
            {running ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> : <ChevronRight size={13} />}
            {running ? "Creating…" : `Create in ${selectedRepos.length} repo${selectedRepos.length !== 1 ? "s" : ""}`}
          </button>

          {results && !running && (
            <div style={{ background: "rgba(255,255,255,0.025)", borderRadius: 7, padding: "7px 10px", maxHeight: 140, overflowY: "auto", scrollbarWidth: "thin" as const }}>
              <p style={{ fontSize: "0.6rem", fontWeight: 700, color: "#4A5580", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.07em" }}>
                Results — {results.filter(r => r.ok).length}/{results.length} succeeded
              </p>
              {results.map((r) => (
                <div key={r.repo} style={{ display: "flex", alignItems: "flex-start", gap: 5, padding: "2px 0" }}>
                  {r.ok
                    ? <CheckCircle2 size={11} style={{ color: "#10B981", flexShrink: 0, marginTop: 2 }} />
                    : <XCircle size={11} style={{ color: "#EF4444", flexShrink: 0, marginTop: 2 }} />
                  }
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: "0.72rem", color: r.ok ? "#C8CDD8" : "#F87171", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.repo}</p>
                    {r.error && <p style={{ fontSize: "0.62rem", color: "#EF4444", margin: "1px 0 0", lineHeight: 1.35 }}>{r.error}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>


      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 14px", borderBottom: "1px solid rgba(255,255,255,0.05)", flexShrink: 0, background: "rgba(255,255,255,0.01)" }}>
          <span style={{ fontSize: "0.75rem", color: "#4A5580" }}>.github/workflows/</span>
          <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#C4B5FD" }}>{filename || "workflow.yml"}</span>
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: "0.6875rem", color: "#2D3450" }}>Edit freely — this is what gets committed</span>
        </div>
        <Editor
          height="100%"
          language="yaml"
          value={yaml}
          onChange={v => setYaml(v ?? "")}
          theme="vs-dark"
          options={{
            fontSize: 13,
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            fontLigatures: true,
            minimap: { enabled: true },
            scrollBeyondLastLine: false,
            lineNumbers: "on",
            renderLineHighlight: "all",
            smoothScrolling: true,
            bracketPairColorization: { enabled: true },
            automaticLayout: true,
            padding: { top: 12, bottom: 12 },
          }}
        />
      </div>
    </div>
  );
};
