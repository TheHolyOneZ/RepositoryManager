# Changelog

## v0.5.0 — 2026-04-20

### New Features

---

#### Environments & Secrets

Full lifecycle management for GitHub repository secrets and environments — including a bulk-copy operation that GitHub's own UI cannot do.

- **Repo Secrets tab**: list all secrets for the selected repository with name and last-updated date; create new secrets via name + masked value input; delete secrets with one click
- **Environments tab**: list all deployment environments (production, staging, etc.) per repo; create and delete environments; select an environment to manage its environment-scoped secrets separately
- **Bulk Copy tab**: enter a secret name and value once, select any number of target repos via a compact multi-column grid, and push the secret to all of them in a single operation — per-repo success/failure results displayed inline
- Secret values are encrypted client-side using a correct libsodium `crypto_box_seal` implementation (ephemeral X25519 keypair, Blake2b-24 nonce, XSalsa20Poly1305) before being sent to the GitHub API

---

#### Dependabot / Security Alerts

Portfolio-wide vulnerability visibility without opening the browser.

- **Repo Alerts tab**: list open, dismissed, or fixed Dependabot alerts for the selected repo; expand any alert to see CVE ID, GHSA ID, affected package, ecosystem, and a direct link to GitHub; filter by state (open / dismissed / fixed) and severity (critical / high / medium / low)
- Critical vulnerability banner appears at the top of the list when any critical alerts are open
- Enable or disable Dependabot alerts for the selected repo via a toggle button
- **Portfolio Overview tab**: select multiple repos via a compact grid, click Scan at the top (always visible), and get a cross-repo severity table — each row shows counts of critical (C), high (H), medium (M), and low (L) alerts; archived repos are surfaced as "Archived" instead of crashing
- Archived repositories no longer cause an error toast — they degrade gracefully to an empty state

---

#### Dependency Scanner

Parse package manifests across your entire portfolio without cloning anything locally.

- Fetches and parses `package.json` (npm), `Cargo.toml` (cargo), `requirements.txt` (pip), `go.mod` (go modules), and `pom.xml` (maven) via the GitHub Contents API for each selected repo
- **Packages tab**: unified list of every dependency found across all scanned repos; search by name; filter by ecosystem (npm / cargo / pip / go / maven); each entry shows all versions in use and how many repos use each version; conflict rows highlighted in amber
- **Conflicts tab**: packages where two or more repos use different versions — each conflict group shows version → list of repos using it; "no conflicts" success state when the portfolio is clean
- **By Repo tab**: expandable card per repo showing which manifest files were found and the full dependency list in a compact chip grid
- Summary stats in the page header: total packages, conflict count, repos with manifests found

---

#### Full Keyboard Shortcut System

Keyboard-first navigation for the Repositories page.

- `J` / `K` — move cursor up and down the repo list
- `Space` — toggle selection for the row under the cursor
- `Enter` — open the detail slide-over for the row under the cursor
- `D` — queue delete for selected repos (or cursor row if nothing selected)
- `A` — queue archive for selected repos (or cursor row if nothing selected)
- `R` — force-refresh the repo list
- `?` — open the keyboard shortcuts overlay listing all available shortcuts
- `⌘K` — open the Command Palette (existing, now documented in the overlay)

---

#### Cleanup Mode Presets

One-click bulk cleanup without manually picking repos.

- **Spring Clean**: targets all repos flagged as Dead or Empty — shows a preview list before queuing
- **Portfolio Mode**: targets repos that are not Active and not starred — keeps your best repos safe
- **Minimal Mode**: ranks all repos by health score and targets the bottom 20
- Each preset opens a slide-over panel with a preview of affected repos; clicking "Queue N repos" sends them to the queue with the appropriate action (archive or delete) and requires the standard confirmation modal

---

#### Saved Filter Presets

Save and recall filter combinations from the sidebar.

- Type a name and click the bookmark icon to save the current filter state (search text, visibility, language, health category, topic, size) as a named preset
- Click any saved preset to instantly restore all its filters
- Delete presets with the × button
- Persisted to localStorage — presets survive restarts

---

#### Notification Center — Persistence

- Notifications now survive app restarts — persisted to localStorage via Zustand `persist` middleware
- Capped at 200 in memory and 100 persisted to keep storage lean

---

#### Notification Center — Persistence & Desktop Notifications

- Notifications now survive app restarts — persisted to localStorage via Zustand `persist` middleware
- Capped at 200 in memory and 100 persisted to keep storage lean
- **Desktop OS notifications** wired to the queue `finished` event; dispatches `new Notification(...)` when `desktopNotificationsEnabled` is on, respecting the per-event `notifyOnQueueComplete` / `notifyOnQueueFailure` toggles from Settings

---

#### Keyboard Shortcuts

- `J` / `K` — move cursor up and down the repo list
- `Space` — toggle selection for the row under the cursor
- `Enter` — open the detail slide-over for the row under the cursor
- `D` — queue delete for selected repos (or cursor row if nothing selected)
- `A` — queue archive for selected repos (or cursor row if nothing selected)
- `R` — force-refresh the repo list
- `F` — focus the filter search input
- `?` — open the keyboard shortcuts overlay
- `⌘K` — open the Command Palette (existing, now documented in the overlay)

---

#### Cleanup Mode Presets

- **Spring Clean**: targets all repos flagged as Dead or Empty — shows a preview list before queuing
- **Portfolio Mode**: targets repos that are not Active and not starred
- **Minimal Mode**: ranks all repos by health score and targets the bottom 20
- Each preset opens a slide-over panel with a preview; clicking "Queue N repos" sends them to the queue and requires the standard confirmation modal

---

#### Saved Filter Presets

- Type a name and click the bookmark icon to save the current filter state (search text, visibility, language, health category, topic, size) as a named preset
- Click any saved preset to instantly restore all its filters; delete presets with the × button
- Persisted to localStorage — presets survive restarts

---

### Bug Fixes

- **Secret name sanitization**: `AddSecretForm` and bulk copy now strip all non-alphanumeric/underscore characters with `replace(/[^A-Z0-9_]/g, '_')` — fixes GitHub's "Secret names can only contain alphanumeric characters" rejection
- **Repo selector dropdown z-index**: All three pages (Environments, Security, Deps) now use a portal-based `RepoSelectorDropdown` that renders into `document.body` with `position: fixed` — fixes dropdown being clipped under page content with `overflow: hidden` parents
- **Portfolio multi-repo picker z-index**: Same portal fix applied to the SecurityPage portfolio picker and the new `MultiRepoPicker` component
- **pnpm / yarn ecosystem detection**: `deps_scanner.rs` now probes for `pnpm-lock.yaml` and `yarn.lock` alongside `package.json` and labels deps with the correct package manager instead of always showing "npm"
- **Dropdown not opening (AnimatePresence + createPortal)**: Removed `AnimatePresence` wrapping `createPortal(...)` — framer-motion cannot track a React portal as a direct child, causing silent render suppression. Enter animation preserved via `motion.div` `initial`/`animate` props
- **403 error message leaks full URL**: `delete_repo`, `archive_repo`, `set_visibility`, `rename_repo`, and `update_topics` now use `check_ok`/`check_json` instead of reqwest's `error_for_status()`, which was producing `"HTTP 403 for url (https://api.github.com/repos/...)"`. They now surface GitHub's actual error body (e.g. "Must have admin rights to Repository")
- **Queue double-start**: `queue_start` now checks the current status and returns `QUEUE_BUSY` if a run is already active — prevents spawning a second concurrent worker
- **Queue backend accumulation**: `queue_start` now purges non-pending items before starting a new run; `queue_clear` Tauri command added (with `keepPending` flag); `queueStore.reset()` and `clearCompleted()` now call it so frontend and backend stay in sync
- **Dependabot toggle error message**: The opaque GitHub error "Failed to change dependabot alerts status." is now intercepted and replaced with a clear explanation pointing to the `security_events` write scope requirement or org-level control

---

### Other Changes

- Version bumped to 0.5.0 across all config files (`package.json`, `Cargo.toml`, `tauri.conf.json`)

---

## v0.4.0 — 2026-04-19

### New Features

---

#### Pull Requests

Full PR management per repository.

- List open, closed, or all PRs with author avatar, head→base branch, label chips, review status badge, and draft indicator
- Inline diff viewer using Monaco `createDiffEditor` — click a changed file to see the patch rendered as a split diff
- Create PRs from within the app: title, head/base branch selectors, draft toggle, Monaco markdown body editor, reviewer multi-select
- Review panel: list reviews with state badges (APPROVED / CHANGES_REQUESTED / COMMENTED), submit new reviews, post comments
- Merge with strategy selector (merge / squash / rebase)
- Details tab: toggle labels, add/remove assignees, set milestone — all reflected live without reopening
- Mark as Ready button converts draft PRs to ready-for-review in one click
- Bulk close PRs, bulk request reviewer across selected PRs

---

#### Issues

Issue tracking built-in, no browser needed.

- List open/closed issues with label chips, assignee avatars, comment count, and date
- Expand any issue for full Markdown-rendered body, label picker, milestone selector, and inline comment thread with reply box
- Create issues with title, Monaco body editor, label multi-select, assignee multi-select, and milestone selector
- Bulk close issues; bulk apply a label to many issues at once

---

#### Release Manager

Create and manage GitHub Releases.

- List releases per repo: tag badge, draft/prerelease badges, asset count, published date
- Expand to read release notes (Markdown rendered), upload assets via native file dialog, download or delete individual assets, edit metadata inline, or delete the release
- Create releases: tag name, release name, target branch selector, Markdown body editor, draft and pre-release toggles
- Queue files before clicking Create — they upload sequentially with a live progress bar after the release is created; the button label shows "Create & Upload N file(s)" as a reminder
- After creation the new release auto-expands so you can upload additional assets
- Cross-repo Overview tab: table of selected repos with their latest release tag and date, sorted oldest-first to surface stale repos

---

#### Workflow Run Logs

View full CI logs without leaving the app.

- Click any completed run (success, failure, or cancelled) to expand a log panel
- Left column: job list with step-level status icons; click a job to load its logs
- Right column: raw log output with ANSI codes stripped, clipboard copy button, keyword search
- Tabs: Logs | Artifacts — switching tabs never closes the panel

---

#### Organization Support

Manage org repositories alongside personal repos.

- ContextSwitcher in the sidebar lists all orgs you belong to
- Select an org to load its repositories in the Repos page — same filtering, sorting, and bulk operations
- Org context persists across sessions via localStorage

---

#### Settings Enhancements

- **General Behavior**: default grace window slider, default execution mode, stale branch threshold, and repo cache TTL
- **Appearance**: accent color picker with 6 presets + custom hex input; applied globally to `--accent` CSS variable on mount
- **Notifications**: desktop notification toggle (graceful fallback on Linux Tauri WebView), notify-on-queue-complete and failure checkboxes
- **Saved Filter Presets**: save current repo filter state as a named preset; recall or delete via dropdown in the filter panel
- **Background refresh**: repo list silently refreshes every 30 seconds without showing a loading spinner

---

## v0.3.0 — 2026-04-18

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


