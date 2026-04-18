# Changelog

## v0.3.0 — 2026-04-17

### New Features

---

#### Actions Tab — Improvements

Significant quality-of-life upgrades across the GitHub Actions tab.

- **Right-click context menus on workflow rows** — enable/disable, trigger, delete workflow (removes the `.yml` file from the repo)
- **Right-click context menus on run rows** — rerun failed jobs, view run link
- **Run → Running state** — clicking Run on a workflow changes the button to "Running" for that workflow; clicking it again while running jumps directly to the Runs tab
- **Artifact download in Runs tab** — click the artifact count badge on any completed run to expand an artifact card; each artifact row has a Download button that resolves the archive URL via the GitHub API
- **Delete Workflow** — removes the workflow `.yml` file via a commit to the default branch using the Git Data API

---

#### Create Workflow Tab

A full in-app workflow authoring and deployment tool, added as a dedicated tab inside GitHub Actions.

- Choose from ready-made templates: **CI** (Node/Python/Go/Rust/pnpm), **Tauri Release** (cross-platform desktop builds), **Deploy** (generic deployment), **Manual** — or upload your own `.yml`
- Monaco YAML editor with syntax highlighting, line numbers, and bracket colorization
- Pill-style per-repo branch toggle to target a specific branch per repo
- Multi-repo support — commit to one or many repos in a single operation
- Tauri Release template includes: tag-push path (auto-release + updater JSON) and manual-dispatch path (artifact upload without release), signing key wiring, and cross-compiled target glob coverage

---

#### Code Editor (File Manager)

A full code editor built directly into the File Manager, powered by Monaco (the same engine as VS Code).

- Click any file in the file tree or flat list to open it in an inline split view — file tree on the left, editor on the right
- Full Monaco editor with syntax highlighting for 20+ languages (auto-detected from file extension), line numbers, bracket colorization, smooth scrolling, and multi-cursor support
- Unsaved changes indicator (● dot) in the editor header
- **Save** button (also Ctrl+S) commits the edited file directly back to GitHub with a custom commit message
- Commit message input appears as a slim bar below the header only when there are unsaved changes
- **Pop out** button (icon-only, tooltip on hover) opens the full standalone editor window and closes the inline panel

---

#### Standalone Editor Window (File Manager)

A dedicated editor window that opens as a separate app window — completely detached from the main ZRepoManager window.

- Full VS Code-style layout: collapsible file tree on the left, Monaco editor filling the rest
- File search bar in the tree panel to filter by name across the entire repo
- Click any file in the tree to load and edit it; selected file is highlighted
- Save button + Ctrl+S commits changes to GitHub; shows a success banner with a "View commit" link
- Status bar at the bottom showing the current file path, detected language, and unsaved state
- If the window is already open for that repo, clicking Pop out again focuses the existing window instead of opening a duplicate

---

#### Markdown Preview (Standalone Editor Window only)

Side-by-side Markdown preview available in the pop-out editor window when a `.md` file is open.

- **Preview** button appears in the top bar only for `.md` files — hidden for all other file types
- Click it to split the view: Monaco editor on the left, live rendered preview on the right
- Preview renders full GitHub-Flavored Markdown (GFM): tables, strikethrough, task lists, code blocks with syntax styling, blockquotes, and inline code
- Switching to a non-`.md` file automatically closes the preview panel
- **Sync scroll** toggle (green, on by default) — scrolling either panel scrolls the other proportionally; click to disable for independent scrolling

---

### Other Changes

- Version bumped to 0.3.0 across all config files (`package.json`, `Cargo.toml`, `tauri.conf.json`)

---

## v0.2.0 — 2026-04-16

### New Tabs

---

#### GitHub Actions

A dedicated tab for managing GitHub Actions workflows across every repository you own — without opening a single browser tab.

- View all workflow files and their current status for any selected repo
- Trigger workflow runs manually, with support for `workflow_dispatch` input parameters
- Enable or disable individual workflows in bulk across multiple repos at once
- Monitor live run status — queued, in progress, succeeded, failed, cancelled
- Inspect individual run logs broken down by job and step
- Download workflow artifacts directly from any completed run
- Filter runs by branch, status, or workflow name

---

#### Collaborators

A full collaborator management tab that gives you a clear picture of who has access to what — and lets you act on it at scale.

- View every collaborator across all your repos in one unified list
- See each person's permission level: read, triage, write, maintain, or admin
- Add collaborators to one or multiple repos at once with a chosen permission level
- Remove collaborators in bulk across a selection of repos in a single operation
- Track all pending invitations — see who hasn't accepted yet and cancel invites if needed
- Filter the collaborator list by username, permission level, or repo

---

#### Webhooks

Full webhook lifecycle management across your entire repository portfolio — create, inspect, debug, and re-deliver without touching the GitHub UI.

- List every webhook attached to any of your repos, with endpoint URL and active status
- Create new webhooks from scratch or from saved templates across multiple repos at once
- Choose which events to subscribe to per webhook (push, pull_request, release, etc.)
- Inspect the full delivery history for any webhook — timestamp, response code, duration
- View the raw request and response payload for any delivery
- Identify failed deliveries at a glance with clear error indicators
- Re-deliver any failed payload with one click to retry without re-triggering the event
- Enable or disable webhooks across a selection of repos in bulk

---

#### Branches

A branch governance tab that gives you visibility and control over branches across all your repos, without cloning anything locally.

- View the default branch for every repo in your portfolio at a glance
- Rename default branches across many repos in a single batched operation
- Apply branch protection rules to multiple repos at once — required reviews, status checks, push restrictions
- View existing protection rules per branch and update or remove them in bulk
- Detect stale branches — branches with no commit activity beyond a configurable threshold
- List all branches per repo with last-commit date, author, and ahead/behind counts relative to default
- Delete stale or merged branches in bulk with dry-run preview before anything is removed

---

### Other Changes

- Added `.AppImage` as a Linux download format (universal, no install required)
- Removed "Coming Soon" roadmap section from the landing page — all four planned features shipped
- Landing page download buttons now carry the `download` attribute for bulletproof file saving
- Added `.htaccess` rules enforcing `Content-Disposition: attachment` for all installer formats (`.msi`, `.exe`, `.deb`, `.rpm`, `.AppImage`)


