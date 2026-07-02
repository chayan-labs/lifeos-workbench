# Life OS Workbench

A terminal-weight, agent-native fork of [Life OS](https://github.com/chayan-bit/life-os) that pulls the personal-operating-system *inside a single Rust binary* alongside a modal code editor, an embedded terminal, an AI agent, and a time-travel debugger.

Where upstream Life OS is a Rust backend + a heavy React/Vite SPA talking over HTTP, the Workbench keeps the Rust backend, **deletes the browser**, and renders every Life OS module as a TUI over the *same* declarative manifests - linking `lifeos-api` in-process instead of bridging to it.

This README is the canonical architecture document for the fork. `CLAUDE.md` is the short working-rules companion. `frontend/DESIGN.md` is the TUI design system (replacing the old Neo-Brutalist web system).

> Fork status: design-complete specification, pre-implementation. The upstream Life OS backend (schema, modules, services, worker, harness loop) is inherited **unchanged**; only the presentation layer and the process boundary change. Nothing in this repo is built yet - it specifies what will be.

---

## 0. Relationship to the other two repos

This project is one of three that compose a single system. Do not merge them; they stay separate repos with clean contracts.

| Repo | Role | Contract to the Workbench |
|---|---|---|
| [`life-os`](https://github.com/chayan-bit/life-os) (upstream) | The personal-OS backend: generic entity-graph DB, declarative modules, self-extension, Telegram lane, harness loop. | The Workbench **is a fork** of it. Backend crates (`lifeos-api`, `lifeos-vcs`, `lifeos-ingest`, `lifeos-drain`, `broker-guard`), `modules/`, `migrations/`, `worker/` are inherited and reused. Only `frontend/` (React → TUI) and the client↔API boundary (HTTP → in-process) change. |
| [`Mirrorscope`](https://github.com/chayan-bit/Mirrorscope) (sibling, local `../Mirrorscope`) | A cross-platform, eBPF-assisted **time-travel debugger** for C / Rust / Go with first-class async-Rust and goroutine semantics, exposed over **DAP**. | The Workbench is Mirrorscope's **primary DAP client and host UI**. Mirrorscope stays a standalone tool (also usable from VS Code); the Workbench renders its task-tree / timeline / watchpoint panes natively and hands its operations to the agent. See [§8](#8-mirrorscope-integration-the-debug-surface). |

The three share one spine - **time-travel as a universal primitive** ([§9](#9-the-spine-why-this-is-one-system)).

---

## 1. Why fork instead of extend upstream

Upstream Life OS made a deliberate, correct choice for a *web-first, SaaS-ready* product: a React + Vite SPA (Refine, Cytoscape, Tailwind v4) served to a browser, talking to the local Rust API over `127.0.0.1:8080`.

That choice carries weight this fork rejects for *personal, daily-driver* use:

- **A browser is not terminal-weight.** The SPA is the heavy part of Life OS; a Chromium/webview surface is orders of magnitude heavier than a terminal.
- **The HTTP bridge is an artificial seam.** The app and the API are both Rust, yet they talk over a socket with JSON serialization, CORS, and a second process. For a single-user local tool that boundary buys nothing.
- **The daily surface is textual.** Capture, tasks, trading journal, learning, project status, search, and the agent loop are ~80% of real use, and all of it is structured text - exactly what a TUI renders best.
- **Mobile is already solved.** The Telegram/Cloudflare lane covers laptop-off control, so the fork owes nothing to a PWA.

The fork's thesis: **an IDE that is a terminal, with your whole life OS inside it.** One Rust process; "editor", "debugger", and each Life OS module are *modes/panes* of a terminal, not separate apps.

---

## 2. The two architectural changes (everything else is inherited)

Everything in upstream Life OS's [architecture](https://github.com/chayan-bit/life-os) - the generic multi-tenant `entities`/`edges`/`events`/`jobs` schema, declarative modules, self-extension builder, owned-credential Nango model, the two-brains/one-DB tiering, the harness Eval/Release loop, every hard security invariant - is **carried over verbatim**. Two things change:

### 2.1 Frontend: React SPA → TUI renderers over the same manifests

A Life OS module is a *declarative manifest* (`entityTypes`, `attrs`, `views:[{kind:'list'|'board'|'table'|'calendar'|'gallery'|'graph'|'timeline'|'map'}]`) that contains **no DOM/router/DB code** - an invariant upstream already enforces. The React SPA is merely *one* renderer backend that interprets those manifests.

The Workbench adds a **second renderer backend written in Rust/ratatui** that consumes the *identical* manifests:

| `view.kind` | Upstream (React) | Workbench (TUI) |
|---|---|---|
| `list` / `table` | React list/table | ratatui `Table` / `List` |
| `board` | React Kanban | ratatui column-pane Kanban |
| `calendar` | React calendar | cell-grid calendar widget |
| `detail` | React detail page | stacked field pane + markdown |
| `timeline` | React timeline | horizontal scrubber widget |
| `gallery` | React image grid | **terminal graphics protocol** thumbnails ([§6](#6-what-the-tui-can-and-cannot-do)) |
| `graph` | Cytoscape | small: box-drawing node-link; large: **external viewer escape hatch** |
| `map` | React map | weak (ASCII) / external viewer |

The manifests, the seven seed modules, the self-extension scaffolder's output, and `modules/_template/` are **unchanged**. Writing a new renderer backend is exactly the swap the manifest architecture was designed to allow; the fork is the first consumer to exercise it.

### 2.2 Process boundary: HTTP bridge → in-process linking

The Workbench binary is Rust. `lifeos-api` is a Rust crate that owns the DB write token. Instead of a browser hitting `localhost:8080`, the Workbench **links `lifeos-api` as a library and calls it in one address space** - no HTTP, no JSON round-trip, no second process, no CORS.

- The `127.0.0.1` HTTP server is retained **only** for external consumers that genuinely need it (scripts, future clients). The Telegram/Worker lane already talks to Turso directly, not through the local API, so it is unaffected.
- Semantic search (`memvec`/mgrep), recall, and every `lifeos entity|edge|event` call become in-process function calls, not `fetch`.
- The single-DB-token-owner + workspace-scoping + append-only-`events` invariants hold identically; they are enforced in the same Rust code, now called directly.

**This is what "Life OS inside the app, not bridged" means literally: one process, one address space.**

---

## 3. Three surfaces, one binary

```
┌──────────────────────────────────────────────────────────────┐
│  Life OS Workbench  (single Rust binary, terminal-weight)      │
│                                                                │
│  ┌───────────┬───────────┬────────────┬─────────────────────┐ │
│  │ TERMINAL  │  EDITOR   │  AGENT     │  LIFE OS             │ │
│  │ panes     │  (modal,  │  (ACP →    │  (TUI renderers over │ │
│  │ (VTE+PTY) │  LSP, TS) │  harness)  │  module manifests)   │ │
│  └─────┬─────┴─────┬─────┴──────┬─────┴──────────┬──────────┘ │
│        │           │            │                │            │
│   tiling / pane manager (Zellij-model) · command palette      │
│        │           │            │                │            │
│  ┌─────▼───────────▼────────────▼────────────────▼──────────┐ │
│  │ in-process: lifeos-api · lifeos-vcs · memvec · DAP client │ │
│  └───────────────────────────┬──────────────────────────────┘ │
└──────────────────────────────┼─────────────────────────────────┘
                               │ DAP (child process / thread)
                    ┌──────────▼───────────┐
                    │  Mirrorscope server  │  ← sibling repo
                    │  (record/replay +    │
                    │   semantic decoder)  │
                    └──────────────────────┘
```

- **Terminal** - `alacritty_terminal` (VTE parsing) over `portable-pty`. A pane is a real terminal by default; one keybind flips it into any other mode. "Switchable with a terminal" is the *native state*, not a feature.
- **Editor** - embed **Helix** core (`helix-core`/`helix-view`): rope buffer, multi-selection, tree-sitter highlighting, built-in LSP, zero config. We do **not** write an editor.
- **Agent** - an **ACP (Agent Client Protocol)** client. Claude Code / the existing harness / any ACP agent plugs in interchangeably. Agent edits land in the buffer as a reviewable diff layer (accept/reject inline). We do **not** write a model.
- **Life OS** - the TUI renderer backend from [§2.1](#21-frontend-react-spa--tui-renderers-over-the-same-manifests), driven by `lifeos-api` in-process.

---

## 4. Inherited from Life OS - do not re-derive or violate

The fork keeps every upstream global invariant. Summarized (authoritative source: [`life-os/docs/`](https://github.com/chayan-bit/life-os)):

1. **One generic schema, no per-domain tables.** Task/trade/topic/post/campaign/asset are rows in `entities`, keyed by `workspace_id` + `module` + `type` + `attrs` JSON. New domains = zero migration.
2. **Multi-tenant from the first commit.** Every row carries `workspace_id`; personal use is one workspace.
3. **Local-first, no lock-in.** libSQL embedded replica (`offline:true`); sync is last-push-wins with single-writer-per-row discipline and `events` as reconciliation truth.
4. **Codegen only on the trusted Mac.** The cloud lane only enqueues; self-extension builds run locally behind two validators, each a revertable git commit.
5. **Auditability over speed; gate the irreversible.** Append-only `events`; outward actions (social/marketing publish, sends, browser actions, any trade action) are human-gated.
6. **Owned credentials only.** Nango vault + proxy; the agent holds a `connectionId`, never a token. Never the claude.ai MCP connectors.
7. **Trading is read-only for any agent/bot.** `broker-guard` fails closed on place/modify/cancel/GTT; orders only via a separate human-typed-confirmation executor.
8. **`events` is append-only.** No UPDATE/DELETE route.
9. **Derived state in a separate un-synced DB** (`lifeos-derived.db`: FTS5 + sqlite-vec).
10. **Rust where it is security- or throughput-critical.** Now *more* of the stack is Rust, because the frontend is too.

---

## 5. Tech stack (fork deltas)

| Layer | Upstream Life OS | Workbench |
|---|---|---|
| Presentation | React + Vite SPA, Refine, Tailwind v4, Cytoscape | **ratatui** (TUI widgets), terminal graphics protocol for images |
| Editor | — (none) | **Helix core** (`helix-core`, `helix-view`) - rope, tree-sitter, LSP |
| Terminal | — (browser) | **`alacritty_terminal`** (VTE) + **`portable-pty`** |
| Pane/session mgmt | — (browser tabs) | **Zellij model** (tiling), or a small ratatui layout engine |
| Client↔API | HTTP `@libsql/client` fetch | **in-process crate link** to `lifeos-api` |
| Agent surface | AI Console (React) | **ACP client** pane |
| Debug surface | — (none) | **DAP client** → Mirrorscope ([§8](#8-mirrorscope-integration-the-debug-surface)) |
| Backend (all) | Rust services + libSQL + Nango + Worker/Telegram | **unchanged** |
| Mobile | PWA | dropped (Telegram lane covers it) |

All additions are reuse: Helix, ratatui, alacritty's VTE, Zellij's model, ACP, DAP - none is hand-rolled. Net-new code is the **fusion glue** (renderer backend + pane manager wiring + agent/debug tool exposure), which is exactly the part with no prior art.

---

## 6. What the TUI can and cannot do

A TUI is a monospace character grid: everything reduces to styled text cells (+ optional terminal graphics protocol). This is the honest capability boundary.

### Excellent (≈80% of daily use)
Modal code editing, LSP, tree-sitter highlighting · terminal emulation · lists / tables / trees / Kanban boards / forms · command palette + fuzzy finder · markdown (styled) · sparkline/bar/line charts (equity curves, token/cost meters) · timeline scrubbers · async task trees. This covers the whole editor + debug surface and the structured majority of Life OS (tasks, learning, trading journal, projects, search, agent).

### The visual ≈20% - handled by three escape hatches, in priority order
1. **Terminal graphics protocols** (Kitty / Sixel / iTerm2) give *real* inline images: the Design asset gallery, Figma thumbnails, Higgsfield media, media-intelligence thumbnails, rendered flamegraphs/heatmaps. Requires a graphics-capable terminal (ship/recommend **ghostty / kitty / wezterm**).
2. **On-demand external viewer** for the true-graphical tail - large interactive graph exploration, Figma canvas editing, video playback: a keybind opens *just that artifact* externally, only when asked. The app stays terminal-weight; you pay for weight only in the rare heavy moment.
3. **Optional GPUI sidecar** (a native GPU app with an embedded terminal, ~10× lighter than the old browser SPA) - reserved for *if* design/graph work proves daily-critical. This violates "terminal-weight" and is the deliberate fallback, not the default.

### Genuinely out of scope for the TUI itself
Large zoomable node-link graphs (Cytoscape-class), Figma canvas *editing*, inline video/audio *playback*, proportional-font typography/animation, real maps. All routed to escape hatch 2 or 3. See [`frontend/DESIGN.md`](./frontend/DESIGN.md) for how each `view.kind` degrades.

---

## 7. Editor + agent, concretely

- The editor pane and a terminal pane share cwd, env, and the in-process `lifeos-api` handle - no IPC wall between "the code", "the shell", and "the life OS".
- **Agentic coding** = the ACP agent's toolbelt is the existing harness: mgrep/memvec semantic search over code *and* the second brain, `recall`/`remember`, skills routing, and MCPs. The agent reads your past decisions and OPINIONS while editing - something a browser IDE bridged to a separate CLI cannot do in one context.
- Agent edits are a CRDT/diff layer on the Helix rope: propose → review inline → accept/reject, terminal-native (the equivalent of Cursor's "apply", CRDT-sound and in a terminal).

---

## 8. Mirrorscope integration (the debug surface)

Contract: **DAP.** The Workbench is a DAP *client*; [Mirrorscope](https://github.com/chayan-bit/Mirrorscope) is a DAP *server* with `reverseContinue`/`stepBack` plus custom requests (`listCheckpoints`, `taskTimeline`, `jumpToEvent`). Keep this boundary even though both are Rust - it keeps Mirrorscope independently usable (e.g. from VS Code) and separately valuable. Run the Mirrorscope server as a child process or in-process thread behind the DAP interface.

The synergy: Mirrorscope's spec calls for a *"thin companion VS Code extension"* to render its task-tree and scrub-timeline, because raw DAP clients can't. **The Workbench owns its client, so that companion UI is just native TUI panes** - no extension needed:

| Mirrorscope output | Workbench pane |
|---|---|
| Async logical stack / task tree | TUI tree widget |
| Timeline / `taskTimeline` | horizontal scrubber (arrows scrub; Enter = `jumpToEvent`) |
| `listCheckpoints` | list pane; select → replay-to-checkpoint |
| Retroactive watchpoint ("every write to X") | results table |
| Waker causality ("why did this wake") | small: inline tree; large: graphics-protocol image |

**The flagship capability - agentic time-travel debugging:** because the Workbench is both an ACP agent host *and* a Mirrorscope DAP client, Mirrorscope's operations (`reverseContinue`, `setWatchpoint`, `jumpToEvent`, `readLogicalStack`) are exposed to the agent as tools. The agent can hit a failing test, replay to the fault, set a retroactive watchpoint on the corrupted value, scrub backward to the causing write, read the *logical async task state* (not raw poll frames), and propose a fix - autonomously. No existing tool has this; it exists only because the editor, the agent, and the debugger live in one process.

Debug sessions, checkpoints, and root-cause findings are written back as `events`/`entities` in the Coding/Projects module - searchable via memvec, versioned like everything else. Full protocol detail lives in the Mirrorscope repo's `README.md` §"Workbench integration".

---

## 9. The spine: why this is one system

All three repos are instances of one primitive - **time-travel / replay over state**:

- **Mirrorscope** = time-travel over *execution* (checkpoint + deterministic replay).
- **`lifeos-vcs`** = time-travel over *files* (content-addressed history; "version history *is* the `events` log").
- **Life OS memory** = time-travel over *knowledge* (append-only event-sourced `events`, bi-temporal forgetting).

Three time machines, one append-only event model, one semantic index (memvec/mgrep over code + execution history + second brain), one agent operating across all of them. The product, stated in one line: **a terminal-weight personal computing surface where replay is the universal primitive and an agent can time-travel across your code's execution, your files' history, and your own memory.** That is the answer to "what is genuinely new here vs. building an IDE / a debugger / a Notion clone" - nothing on the market unifies those.

---

## 10. Directory layout (fork deltas)

Inherited from upstream unchanged unless noted.

```
lifeos-workbench/
  workbench/                  # NEW - the terminal-native app (Rust)
    src/
      shell/                  #   tiling pane manager (Zellij-model), command palette
      terminal/               #   alacritty_terminal (VTE) + portable-pty panes
      editor/                 #   Helix core embed (rope, tree-sitter, LSP)
      agent/                  #   ACP client + review/apply diff layer
      debug/                  #   DAP client → Mirrorscope; timeline/tree/watchpoint panes
      lifeos_tui/             #   TUI renderer backend over module manifests
      render/                 #   ratatui widgets + terminal-graphics-protocol images
  modules/                    # UNCHANGED - declarative manifests (learning, tasks, …)
  migrations/                 # UNCHANGED - 0001_core.sql, 0002_control_plane.sql, …
  services/                   # UNCHANGED - lifeos-api, lifeos-vcs, lifeos-ingest, lifeos-drain, broker-guard
  worker/                     # UNCHANGED - Cloudflare Worker (grammY bot, Haiku)
  server/                     # scaffold.js (Agent SDK) + validators; memvec.py reused
  frontend/                   # RETIRED - React SPA superseded by workbench/lifeos_tui;
    DESIGN.md                 #   kept only for the TUI DESIGN system (rewritten)
  docs/                       # upstream spec tree (still authoritative for the backend)
  CLAUDE.md README.md
```

`frontend/`'s React sources become dead once `workbench/lifeos_tui` reaches parity; `frontend/DESIGN.md` is repurposed as the TUI design system.

---

## 11. Build order (de-risk the spine first)

Each phase is independently usable and ships with tests (≥80%, TDD) + conventional commits.

1. **Workbench shell** - tiling pane manager + embedded terminal (`alacritty_terminal`+`portable-pty`) + command palette. Prove instant terminal↔pane switching. → *a usable terminal multiplexer.*
2. **Editor pane** - embed Helix core; a pane flips terminal→editor with shared cwd; LSP + tree-sitter free. → *a terminal-native modal IDE.*
3. **Life OS TUI renderer** - link `lifeos-api` in-process; implement `list`/`board`/`table` renderers over existing manifests. → *"Life OS inside, not bridged" on the highest-value views.*
4. **Agent pane (ACP)** - plug in the harness; agent edits as reviewable diffs. → *Cursor-level agentic coding, reused not built.*
5. **Mirrorscope DAP client** - only after Mirrorscope Phases 1-2 exist standalone; wire `stepBack` + task-tree + scrubber panes. → *time-travel debugging in the workbench.*
6. **Agentic time-travel debugging** - expose Mirrorscope's DAP ops to the agent. → *the flagship; needs 1-5 under it.*
7. **Visual-tail polish** - graphics-protocol galleries, external-viewer escape hatch, remaining renderers.

Phases 1-4 alone are a shippable, differentiated lightweight terminal-native agentic IDE with Life OS built in - *before* touching the research-grade debugger.

---

## 12. Status

Design-complete specification, pre-implementation. Backend inherited from upstream Life OS; presentation and process-boundary redesigned for the terminal. See `CLAUDE.md` for working rules, [`frontend/DESIGN.md`](./frontend/DESIGN.md) for the TUI design system, and `docs/` (upstream) for the authoritative backend spec.
