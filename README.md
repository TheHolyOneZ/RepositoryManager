# ZRepoManager

> A blazing-fast desktop app for managing every GitHub repository you've ever touched.

![ZRepoManager Main Interface](./landing/main.png)

Bulk operations. Analytics. Queued execution. Smart cleanup suggestions. All from a single native window — no browser tabs, no rate-limit anxiety, no clicking through GitHub's UI 50 times.

**Windows native. Linux supported.**

---

## Features

### Core

| Feature | Description |
|---------|-------------|
| **Bulk Operations** | Select any number of repos and archive, delete, rename, transfer, or change visibility in one shot — with a configurable grace period before execution |
| **Operation Queue** | Build a queue of complex batches, dry-run first, then execute with pause, resume, skip, and cancel support mid-run |
| **Smart Filtering** | Filter repos by language, health status, fork/mirror, visibility, star count, tags, and more simultaneously |
| **Tag System** | Custom persistent tags on any repo — survives app restarts, applies in bulk, filters the repo table |
| **Command Palette** | Hit `⌘K` / `Ctrl+K` anywhere to search repos, navigate, or trigger actions instantly |
| **Upload to Repository** | Pick a local folder, select/deselect individual files via a full file tree, and push only what you want as one atomic commit — no GitHub 100-file drag limit |

### Analytics

- Language distribution across your entire portfolio
- Repo growth timeline (new repos per month)
- Health decay curve (activity over time)
- Per-repo full language breakdown when you open a repo detail

### Cleanup Suggestions

Automatically surfaces:
- Dead repos (no activity 6+ months)
- Empty repos (no content)
- Abandoned forks (no stars, inactive)
- Near-duplicate repo names (Levenshtein similarity)

### Migration

Batch operations through the safe queue system:
- Transfer repos to another account or org
- Rename repos in bulk
- Change visibility (public ↔ private) at scale

### Advanced Export

- Export README files from multiple repos to a local folder
- Download release assets in batch
- Dump full repo metadata as structured JSON

### Multi-Account

- Connect multiple GitHub accounts side-by-side
- PAT tokens and OAuth both supported
- Instant account switching — sessions persist across restarts

---

## Installation

### Windows *(native)*

| Format | Link |
|--------|------|
| `.msi` installer *(recommended)* | [Download](https://zsync.eu/github/manager/releases/zrepomanager_0.1.0_x64_en-US.msi) |
| `.exe` NSIS installer | [Download](https://zsync.eu/github/manager/releases/zrepomanager_0.1.0_x64-setup.exe) |

### Linux *(supported)*

Built with Tauri + WebKitGTK — runs on any modern x64 distro.

| Format | Distro | Link |
|--------|--------|------|
| `.deb` | Ubuntu / Debian | [Download](https://zsync.eu/github/manager/releases/zrepomanager_0.1.0_amd64.deb) |
| `.rpm` | Fedora / RHEL | [Download](https://zsync.eu/github/manager/releases/zrepomanager-0.1.0-1.x86_64.rpm) |

---

## Screenshot

<div align="center">
  <img src="./landing/main.png" alt="ZRepoManager UI" width="900" />
</div>

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | **Rust** — native GitHub API calls, file I/O, credential storage |
| Desktop shell | **Tauri 2** — native webview, OS credential paths, ~8MB installer |
| Frontend | **React 18** + **TypeScript** |
| State | **Zustand** |
| Animations | **Framer Motion** |
| Virtualization | **TanStack Virtual** (handles thousands of repos without lag) |
| Build | **Vite** + **pnpm** |

---

## Roadmap

These four modules are in active development:

- [ ] **GitHub Actions** — view, trigger, and manage workflows across all repos
- [ ] **Webhooks** — create, inspect, re-deliver webhooks at scale
- [ ] **Collaborators** — audit and bulk-manage repo access permissions
- [ ] **Branch Governance** — apply protection rules and rename branches across your portfolio

---

## Development

```bash
# Install dependencies
pnpm install

# Start dev server (hot reload)
pnpm tauri dev

# Build release installers
pnpm tauri build

# Strip all comments from source files
node strip-comments.mjs --dry-run   # preview
node strip-comments.mjs             # apply
```

**Requirements**: Node.js 18+, Rust 1.70+, pnpm

---

## Project Structure

```
ZRepoManager/
├── src/                        # React/TypeScript frontend
│   ├── components/             # UI components (glass, layout, repos, queue)
│   ├── routes/                 # Page components
│   ├── stores/                 # Zustand state stores
│   ├── lib/tauri/              # Tauri command bindings
│   └── styles/                 # CSS (tokens, glass, typography, animations)
├── src-tauri/src/              # Rust backend
│   ├── commands/               # Tauri command handlers
│   ├── github/                 # GitHub API client
│   ├── models/                 # Shared data types
│   ├── queue_engine/           # Operation queue state machine
│   └── health/                 # Repo health scoring
├── landing/                    # Landing page (static HTML)
└── strip-comments.mjs          # Dev tool: strip source comments
```

---

## License

MIT
