<div align="center">

<img src="main.png" alt="ZRepoManager" width="100%" />

<h1>ZRepoManager</h1>

<p>A blazing-fast desktop app for managing every GitHub repository you've ever touched.<br/>
Bulk operations, smart queues, analytics, PR/Issue/Release management — all from one native window.</p>

<p>
  <a href="https://zsync.eu/repomanager/">🌐 Website</a> &nbsp;·&nbsp;
  <a href="https://zsync.eu/repomanager/">⬇️ Download Builds</a> &nbsp;·&nbsp;
  <a href="https://github.com/TheHolyOneZ/RepositoryManager/">📦 Repository</a> &nbsp;·&nbsp;
  <a href="./LICENSE">GPL-3.0</a>
</p>

<p>
  <img src="https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-blue?style=flat-square" />
  <img src="https://img.shields.io/badge/built%20with-Tauri%202%20%2B%20Rust-orange?style=flat-square" />
  <img src="https://img.shields.io/badge/license-GPL--3.0-green?style=flat-square" />
  <img src="https://img.shields.io/badge/version-0.4.0-purple?style=flat-square" />
</p>

</div>

---

## What it does

ZRepoManager replaces 50 browser tabs and endless GitHub UI clicking. Connect your GitHub account, load all your repos, and do in seconds what normally takes minutes:

- **Select hundreds of repos** and archive, delete, rename, transfer, or change visibility in one shot
- **Queue complex batches** with dry-run preview, grace periods, pause/resume/skip/cancel mid-run
- **Manage Pull Requests** — create, review, merge, toggle labels/assignees/milestone, convert drafts to ready
- **Track Issues** — list, create, comment, bulk-close, apply labels and milestones
- **Manage Releases** — create with queued asset uploads, edit, upload more assets, cross-repo overview
- **View CI logs** — expand any completed run to read full job logs with step-level status
- **Browse and manage files** inside any repo — rename, move, delete, commit atomically
- **Upload local folders** straight to a repo without hitting GitHub's 100-file drag limit
- **Analyze your portfolio** — language stats, growth timeline, health decay, per-repo breakdowns
- **Get smart suggestions** — surfaces dead repos, empty repos, abandoned forks, near-duplicate names
- **Manage org repos** — switch between personal and org context, same tools for both

---

## Features

<details>
<summary><strong>Pull Requests</strong></summary>

- List open, closed, or all PRs with author avatar, head→base branch, label chips, and review status badge
- Click any PR to expand an inline Monaco diff editor — click a changed file to see the full patch
- Create PRs: title, head/base branch selectors, draft toggle, Markdown body editor, reviewer multi-select
- Review panel: list reviews with APPROVED/CHANGES_REQUESTED/COMMENTED badges, submit new reviews, post comments
- Details tab: toggle labels on/off, add/remove assignees, set milestone — all reflected live
- "Mark as Ready" button converts draft PRs to ready-for-review in one click
- Merge with strategy selector: merge / squash / rebase
- Bulk close PRs, bulk request reviewer across selected PRs

</details>

<details>
<summary><strong>Issues</strong></summary>

- List open/closed issues with label chips, assignee avatars, comment count, and date
- Expand any issue into a chat-style thread: Markdown-rendered body, full comment list, inline reply box
- Label picker and milestone selector — applied immediately via API
- Create issues with title, Monaco Markdown body, label multi-select, assignee multi-select, milestone
- Close/Reopen toggle, open in browser
- Bulk close issues; bulk apply a label to many issues at once

</details>

<details>
<summary><strong>Release Manager</strong></summary>

- List releases per repo: tag badge, draft/prerelease badges, asset count, published date
- Queue files before clicking Create — uploads sequentially with a live progress bar after release creation
- Expand any release to read Markdown notes, upload more assets, download or delete individual assets
- Edit release metadata inline (tag, name, body, draft/prerelease toggles)
- Delete releases or individual assets (with confirmation)
- Cross-repo Overview tab: each repo's latest tag + date, sorted oldest-first

</details>

<details>
<summary><strong>Workflow Run Logs</strong></summary>

- Click any completed run (success/failure/cancelled) to expand a log panel
- Left column: job list with step-level status icons; click a job to load its logs
- Right column: raw log output with ANSI codes stripped, clipboard copy, keyword search
- Tabs: Logs | Artifacts — switching never closes the panel
- In-progress runs show live status badge; logs load once complete

</details>

<details>
<summary><strong>Organization Support</strong></summary>

- ContextSwitcher in the sidebar lists all orgs you belong to
- Select an org to load its repositories — same filtering, sorting, and bulk operations as personal repos
- Org context persists across sessions via localStorage
- Background silent refresh every 30 seconds — repo list stays fresh without a loading spinner

</details>

<details>
<summary><strong>Repositories & Bulk Operations</strong></summary>

- Multi-select with checkboxes, keyboard shortcuts, and `Ctrl+K` command palette
- Bulk: archive, unarchive, delete, rename, transfer, change visibility, update topics, star/unstar
- Configurable grace period countdown before destructive operations execute
- Operation queue with dry-run mode — preview exactly what will happen before committing
- Pause, resume, skip, and cancel running queues at any point
- Custom persistent tags on any repo — filter, bulk-apply, survives restarts
- Background silent refresh every 30 s keeps the list current

</details>

<details>
<summary><strong>GitHub Actions</strong></summary>

- View all workflows and runs across every repo from a single tab
- Trigger workflows manually — button shows "Running" state; click again to jump to the Runs tab
- Enable or disable workflows in bulk across your portfolio
- Right-click any workflow row for enable/disable, trigger, or delete options
- Right-click any run row to rerun failed jobs or open the run link
- Click the artifact badge on any completed run to expand and download workflow artifacts
- **Create Workflow tab** — author YAML in a Monaco editor, pick from CI/Tauri Release/Deploy/Manual templates, and commit to one or many repos at once
- **Run Log viewer** — expand completed runs to read full job logs with step details

</details>

<details>
<summary><strong>Branch Governance</strong></summary>

- View all branches portfolio-wide with last-commit date and configurable stale detection
- Bulk-apply branch protection rules across multiple repos
- Rename default branches at scale
- Create new branches from a source branch across many repos in parallel
- Per-item results with progress tracking

</details>

<details>
<summary><strong>Collaborators & Webhooks</strong></summary>

- View every collaborator and their permission level per repo
- Bulk add or remove access across multiple repos at once
- Track pending invites and accept/decline from the UI
- List, create, edit, and delete webhooks
- Ping or re-deliver any webhook payload with one click
- Inspect delivery history and spot failed payloads

</details>

<details>
<summary><strong>File Manager, Upload & Code Editor</strong></summary>

- Browse every file inside any repo in a flat list or hierarchical folder tree
- Rename, move, and delete files — all changes staged and committed as one atomic operation
- Upload local folders to any repo: full file tree with checkboxes, select exactly what you want, single atomic commit via the Git Tree API — no 100-file drag limit
- **Inline code editor** — click any file to open a Monaco editor split-view; Ctrl+S saves directly to GitHub
- **Pop-out editor window** — fully detached VS Code-style window with collapsible file tree, file search, Markdown preview (with sync scroll), and bottom status bar

</details>

<details>
<summary><strong>Settings</strong></summary>

- **General Behavior**: default grace window (slider), default execution mode, stale branch threshold, repo cache TTL
- **Appearance**: accent color picker with 6 presets + custom hex, applied globally to `--accent` CSS variable
- **Notifications**: desktop notification toggle (graceful fallback on Linux Tauri WebView), notify-on-queue-complete/failure
- **Saved Filter Presets**: save current repo filter state as a named preset; recall or delete via dropdown

</details>

<details>
<summary><strong>Analytics</strong></summary>

- Language distribution across your entire portfolio
- Repo growth timeline (new repos per month)
- Health decay curve (activity over time)
- Per-repo full language breakdown in the detail panel

</details>

<details>
<summary><strong>Cleanup Suggestions</strong></summary>

Automatically surfaces repos that need attention:

- Dead repos — no activity in 6+ months
- Empty repos — no content at all
- Abandoned forks — no stars, inactive
- Near-duplicate names — Levenshtein similarity detection

</details>

<details>
<summary><strong>Multi-Account & Export</strong></summary>

- Connect multiple GitHub accounts side by side
- PAT tokens and OAuth both supported — sessions persist across restarts
- Export READMEs, release assets, and full repo metadata in batch

</details>

---

## Download

Pre-built installers are available at **[zsync.eu/repomanager](https://zsync.eu/repomanager/)**.

| Platform | Format | |
|----------|--------|---|
| Windows | `.msi` installer *(recommended)* | [Download](https://zsync.eu/repomanager/) |
| Windows | `.exe` NSIS installer | [Download](https://zsync.eu/repomanager/) |
| macOS (Apple Silicon) | `.dmg` | [Download](https://zsync.eu/repomanager/) |
| macOS (Intel) | `.dmg` | [Download](https://zsync.eu/repomanager/) |
| Ubuntu / Debian | `.deb` | [Download](https://zsync.eu/repomanager/) |
| Fedora / RHEL | `.rpm` | [Download](https://zsync.eu/repomanager/) |
| Linux (universal) | `.AppImage` | [Download](https://zsync.eu/repomanager/) |

---

## Build from source

**Requirements:** Node.js 18+, Rust 1.70+, pnpm

```bash
# Clone
git clone https://github.com/TheHolyOneZ/RepositoryManager.git
cd RepositoryManager

# Install frontend dependencies
pnpm install

# Dev server with hot reload
pnpm tauri dev

# Build release installers (output: src-tauri/target/release/bundle/)
pnpm tauri build
```

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Backend | **Rust** — GitHub API, file I/O, credential storage |
| Desktop shell | **Tauri 2** — native webview, OS credential paths, ~8 MB installer |
| Frontend | **React 18** + **TypeScript** |
| State | **Zustand** |
| Animations | **Framer Motion** |
| Editor | **Monaco** — inline editor, diff viewer, YAML/Markdown authoring |
| Virtualization | **TanStack Virtual** — handles thousands of repos without lag |
| Build | **Vite** + **pnpm** |

---

## License

**GPL-3.0** — see [LICENSE](./LICENSE) for full terms.

Copyright © 2026 [TheHolyOneZ](https://github.com/TheHolyOneZ)
