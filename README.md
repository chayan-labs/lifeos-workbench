# Life OS

A self-extending, agent-driven personal operating system - one place to manage **learning, tasks, coding/projects, trading, social, marketing, and design** (and anything else you add later: health, finance, …), backed by a single common database, controllable from Telegram even when the laptop is off, and able to **build its own new features on request**.

It is personal today but **architected to become a multi-tenant SaaS** with no rewrite.

This README is the canonical architecture document - a superset of the original plan. `CLAUDE.md` is the short working-rules companion.

---

## 1. Why this exists

Two problems drove it:

1. **Notion's free AI is too weak and forces manual database-building.** Every tracker had to be hand-modeled, and the AI couldn't populate or evolve it. Life OS inverts this: a generic graph schema means you *never* hand-build a database per domain, and the agent reads/writes it directly.
2. **Tools and data were siloed** - Postgres apps, broker APIs, JSON task files, a SQLite memory DB, markdown vaults, social accounts, Figma files - none talking to each other. Life OS unifies them under one database and one agent loop.

Four requirements reshaped the design:

- **Mobile-first control with the laptop off** - manage everything from a Telegram bot 24/7.
- **Self-extension** - an AI inside the app that, when asked, edits the codebase to add a brand-new module itself.
- **Real-world integrations from day 1** - social (multi-account OAuth), marketing, and design are first-class, not "addable later."
- **SaaS-ready** - multi-tenant, secret-isolated, and billable if it ever leaves personal use.

The result is a **generic multi-tenant entity-graph + a module/plugin system + a self-extension builder + the local Claude Code harness as the brain**, with seven seed domains and infinite room to grow.

---

## 2. Design principles

- **One generic schema, specialized by declarative manifests.** Storage is generic; per-domain behavior is metadata. The opposite of Notion's per-database modeling tax.
- **Multi-tenant from the first commit.** Every data row carries `workspace_id`; personal use is just one workspace. No single-user assumptions anywhere.
- **Local-first, no lock-in.** SQLite-compatible store; offline on the Mac; data is yours and portable.
- **Codegen only on the trusted Mac.** The always-on cloud surface can only enqueue; all file-writing and reasoning-heavy work happens locally.
- **Auditability over speed; gate the irreversible.** Append-only event log; outward/irreversible actions (social posts, trades) are human-gated; every self-built module is a revertable git commit.
- **Minimum always-on context, token-disciplined.** API-first thin tools over heavy MCPs; on-demand loading only.
- **Reuse before build.** Generalize the existing `knowledge-atlas` app, the existing harness, and existing skills (copywriting, figma-*, mcp-*).

---

## 3. Architecture overview — three tiers, two brains, one DB

```
                         ┌─────────────────────────────┐
   Telegram  ──────────► │  Cloudflare Worker (free)    │   LIGHT/MEDIUM brain
   (laptop off-OK)       │  bot — Claude Haiku          │   full DB (workspace) +
                         │  full common-DB + memory +   │   memory + audit;
                         │  audit; enqueues heavy → jobs│   gated outward actions
                         └──────────────┬──────────────┘
                                        │  HTTPS (workspace-scoped, authed)
                         ┌──────────────▼──────────────┐
                         │   Turso / libSQL  lifeos.db  │   CANONICAL, always-on
                         │ control-plane + data-plane   │   multi-tenant,
                         │ entities·edges·events·jobs…  │   SQLite-compatible
                         └──────────────┬──────────────┘
                                        │  embedded replica (periodic sync)
   ┌────────────────────────────────────▼────────────────────────────────┐
   │  MAC (when awake)                                                     │
   │  • lifeos local API  (single DB-token owner, 127.0.0.1, authed)     │   HEAVY brain
   │  • Life OS SPA (generalized knowledge-atlas, light theme)           │   deep work
   │  • Claude Code harness: module scaffolder, Eval, Release, deep agents│
   │  • thin curl tools in ~/.claude/bin (allow-listed) + broker-guard    │
   │  • integration callers: Figma, Higgsfield, social APIs (on-demand)   │
   └──────────────────────────────────────────────────────────────────────┘
```

**Two brains, one database:**

- **Light/medium brain (cloud, always-on).** A Telegram bot on Cloudflare Workers (scale-to-zero compute = free) running on **Claude Haiku**. It has **full common-DB access scoped to its workspace** (entities/edges/events/annotations RW), **harness memory recall** (shared-DB FTS5/vector), and **audit logging** (`events`). It handles capture, queries, and medium actions, **gates outward actions** (social posts, trades) for approval, and **enqueues** anything heavy/codegen for the Mac. Works with the laptop off. (Compute is free; Haiku tokens are minimal.)
- **Heavy brain (Mac).** The existing Claude Code harness (Claude) does deep work: study authoring, coding, trade analysis, the self-extension builder, integration-heavy design/marketing work, and the Eval/Release loop. Syncs to the same DB.

**Why Turso/libSQL:** SQLite wire-compatible (all existing FTS5 / `memvec.py` code ports unchanged), hosted and always reachable, and **purpose-built for multi-tenant SaaS** (cheap database-per-tenant when we scale). An **embedded replica** on the Mac preserves local-first/offline; the cloud copy is always awake for Telegram.

**Key invariant:** request/state is **data** in the synced DB (survives the Mac being off); **codegen + heavy reasoning only ever run on the trusted Mac**; the cloud surface stays trivial.

---

## 4. The common database

### 4.1 Data plane (one generic schema, per workspace)
A task / trade / topic / post / campaign / asset are all rows in `entities`, distinguished by `workspace_id` + `module` + `type` + a flexible `attrs` JSON. **New domains and fields need zero migration by default.**

| Table | Purpose |
|---|---|
| `entities` | Every typed node: `workspace_id`, `module`, `type` (topic/task/project/trade/social_account/post/campaign/content/lead/design_file/asset/component/note/gap/…), `parent_id` hierarchy, `status`, `tier`, `ts`, **`attrs` JSON** (escape hatch), `source`. FTS5-backed. |
| `edges` | Typed cross-domain links (generalizes the atlas's `connections`): `connection`/`depends_on`/`blocks`/`derived_from`/`owns`/`publishes_to`/`uses_asset`/…; `state` (pending/accepted), `created_by`; nullable `dst_id` + `dst_ref`. |
| `events` | **Append-only** log: domain events (study.review, task.completed, trade.closed, post.published, campaign.sent) **and** harness run-rows (run_id, tier, model, tokens, cost, latency, error, outcome, eval_score, gated). Powers Observe/Eval/Release. |
| `annotations` | Reader notes (generalizes the atlas's localStorage comment/link/question layer). |
| `jobs` | Heavy-work queue: bot enqueues, Mac drains. |
| `module_requests` | Self-extension queue: survives the Mac being off. |

### 4.2 Control plane (SaaS-ready, single-row for personal use)

| Table | Purpose |
|---|---|
| `workspaces` | Tenant. Personal = one seeded row. Carries plan/limits. |
| `users` | Identity. Personal = one row (you). |
| `memberships` | `user_id ↔ workspace_id` + role (owner/admin/member). |
| `connections` | Per-workspace, per-account integration credentials: `provider` (instagram/x/whatsapp/slack/reddit/figma/notion/kite/…), `account_handle`, `scopes`, **`access_token_enc` / `refresh_token_enc` (encrypted at rest)**, `expires_at`, `status`. Supports **multiple accounts per provider**. |
| `subscriptions` / `plans` | Billing seam (stub now; gates module/quota access in SaaS). |

**Tenancy strategy:** schema is `workspace_id`-scoped everywhere; personal deployment uses **one shared DB**, and the API enforces workspace filtering (RLS-style). SaaS scales via **Turso database-per-workspace** - the local API abstracts "which DB" so this is a deployment swap, not a code change. Secrets are **never** synced into the agent context or the replica's reach of the bot; the API injects them at call time using a per-workspace envelope key.

### 4.3 Search & recall
- **Lexical:** `entities_fts` (FTS5; triggers flatten `attrs` → `attrs_text`).
- **Semantic:** local-only `entity_vec` reusing `~/.claude/bin/memvec.py` (MiniLM-384, `vec0`); fuse with FTS5 via RRF like `~/.claude/bin/memory-recall`. The shared DB *is* the cross-tier memory the Haiku bot recalls from.
- Embeddings/FTS are **derived state - never synced** (rebuilt locally); cannot cause sync conflicts.

### 4.4 No-migration growth & sync
Hot query paths get **additive** `GENERATED … VIRTUAL` columns over `attrs` (e.g. `due`) - indexable without a rewrite; ~90% of new modules ship with no SQL. Sync: `events`/`jobs`/`module_requests` append-only (conflict-free); `entities`/`edges` last-writer-wins on `updated_at`; derived state rebuilt locally.

---

## 5. Modules — the plugin system

Each module ships `modules/<id>/module.js` calling `osRegisterModule({...})` - the generalization of the knowledge-atlas's `atlasAdd` merge-by-id contract. A manifest is **declarative**: data + how to render generic entities, never DOM/router/DB code.

```js
osRegisterModule({
  id, name, icon, color /* light palette */, num, version,
  entityTypes: { <typeId>: { label, plural, icon,
    attrs: { <field>: { type:'text|number|date|enum|ref|bool|secret', enum?, ref?, required? } },
    display: { title, subtitle?, badge? }, lifecycle: [/* statuses */] } },
  views: [ { id, label, kind:'list|board|table|calendar|detail|graph|gallery', type, groupBy?, sortBy?, filter?, columns? } ],
  events:      [ /* emitted event types */ ],
  botCommands: [ { cmd, help, handler } ],        // Telegram surface
  agentTools:  [ { name, schema, impl, gated? } ],// harness surface; gated=true → draft/approve
  integrations:[ { provider, scopes, onConnect } ],// OAuth/API providers this module uses
  syncTargets: [ { kind:'notion', db, map } ],     // optional outbound sync, no lock-in
  seed:        [ /* optional starter entities/edges */ ],
});
```

### Day-1 seed modules

- **Learning / Study** - the knowledge-atlas generalized to *any subject*: domains → topics → subtopics → resources, cross-domain edges, gaps inbox, spaced repetition, examiner/teach-back. Atlas data files wrapped via an `atlasAdd → osRegisterModule` shim. Telegram: `add topic`, `quiz me`, `what's due`.
- **Tasks / Productivity** - tasks/projects/schedule; Kanban board + "today" list. Telegram: `/task`, `/done`, `/today`.
- **Coding / Projects** - seeded from a git scan of the ~27 repos in `04_Projects`; status, gaps, CI/review state, harness links. Telegram: project status, what's blocked.
- **Trading** - **from scratch (not `ai-trade`)**: trade journal (entry/exit/stop/target/R-multiple/PnL/emotion), reusable setups/playbooks, equity-curve from `events`. `thesis` edges to learning topics → journal and atlas are one graph. **Broker read-only; logging/analysis only**; order placement is human-gated and out-of-agent (see §7). Telegram: `/buy` (logs a *planned* trade), `/close`, `/pnl`.
- **Social** - **multi-account OAuth** for Instagram, X, WhatsApp, Slack, Reddit. Each connected account is an `entity` (`type=social_account`) backed by an encrypted `connections` row; you can hold **many accounts per platform**. The AI can **read** (feeds, mentions, DMs, threads) freely and **draft** posts/replies/DMs, but **publishing is human-gated** (draft → Telegram approve → publish), because it is outward and irreversible. Posts/mentions/threads are entities; engagement is `events`. Telegram: `/inbox`, `/draft`, approve/deny buttons.
- **Marketing** - campaigns, a content calendar, audiences/segments, leads, channels, and analytics. Content is drafted with the `copywriting` + `marketingskills-ai-agents` skills, **publishes via Social** accounts (`publishes_to` edge), and **uses Design assets** (`uses_asset` edge); funnel/UTM metrics arrive as `events`. Outward sends (broadcast email, ad launch, scheduled posts) are human-gated. Telegram: campaign status, draft content, approve sends.
- **Design** - **Figma (read+write)** via `mcp-figma`, **image/video generation** via `mcp-higgsfield`, plus a design-system/asset library. Entities: `design_file` (Figma ref), `component`, `token`, `asset` (exported media), `brief`. The AI can read/inspect Figma, generate assets, build/maintain a design system (`figma-generate-library`), and implement designs to code (`figma-implement-design`). Assets feed Marketing/Social via edges. Integration MCPs are loaded **on-demand via mcp-multiplexer** and unloaded after. Views include an asset **gallery** and a component library.

Future domains (health, finance, CRM, …) are added the same way - via the self-extension builder. **You never enumerate domains up front.**

---

## 6. Self-extension — the headline feature

An in-app "**+ Ask AI to add a module**" affordance grows the system by talking to it.

**Mac online (synchronous):**
1. `POST /api/module-request { prompt, workspace_id }` → `module_requests` row + `events('module.requested')`.
2. `server/scaffold.js` spawns the harness headless (`claude -p`), **tool-restricted** to `modules/` + at most one migration, given `_template/` and existing manifests as examples.
3. The agent copies `modules/_template` → `modules/<id>/`, fills the manifest (entity types, attrs, views, integrations, bot commands, light color), registers the `<script>`.
4. **Two validators:** structural (loads, manifest matches schema, no duplicate type ids, no dangling `view.type`) + render (headless Playwright, 0 JS errors, views mount; migrations applied to a scratch replica).
5. Insert `modules` row + `events('module.installed')`; **SSE hot-reload** - new tile appears, no restart.
6. On failure → `status='failed'` surfaced in-app, one retry.

**Mac offline (queued):** Telegram `/addmodule …` → the bot writes `module_requests(status='queued')` to cloud Turso, replies "queued". A LaunchAgent poller on the Mac (modeled on `~/.claude/bin/route-daemon`) drains on wake, runs the identical local build, commits to git, bot notifies "✅ live".

**Safety:** the cloud bot only enqueues; codegen only ever runs on the Mac; the agent writes only under `modules/` (never `core/`); every install is a git commit → one `git revert` away.

---

## 7. Harness integration, permissions & the agent loop

### Single writer + thin tools
One local `lifeos` API (extending the atlas's zero-dep Node server; FastAPI acceptable) owns the DB write token at `127.0.0.1` and enforces **workspace scoping + auth**. Agent tools are **thin curl wrappers** in `~/.claude/bin/` (`lifeos entity|edge|event|job|config`, `tg send`, `social draft`, `design gen`), allow-listed in `settings.json`. **CRUD is never an MCP.** mcp-multiplexer hot-loads heavy MCPs (Figma, Higgsfield, social) only when needed; a bounded `UserPromptSubmit` context-injection hook replaces always-mounted MCPs.

### Permission boundary (hard, layered)
- **Common DB:** harness = full RW; Haiku bot = full RW **within its workspace**.
- **Trading:** **read-only** for any agent/bot. No order tool registered anywhere; fail-closed `broker-guard` PreToolUse hook denies place/modify/cancel/GTT even if the Kite MCP is mis-loaded; broker keys read-scoped. Orders flow agent → `proposed_order` entity → Telegram approve → separate interactive `trade-exec` (never agent/hook/cron-callable, typed confirmation). **No autonomous trading.**
- **Outward actions (social/marketing publish):** `gated` agent tools produce **drafts only**; publishing requires Telegram approval, then a worker/Mac executor calls the provider API.
- **Secrets:** OAuth tokens live encrypted in `connections`, **never** in agent context; the API injects them at call time.
- **`events` append-only:** no UPDATE/DELETE route, so even the RW token cannot rewrite history.

### The four diagram gaps (reuse existing infra, near-zero new always-on cost)
- **Event store** - the `events` table doubles as the harness run-log; a `lifeos-sync-events` bridge in the existing **Stop hook** joins `~/.claude/logs/route.jsonl` + `~/.claude/metrics/costs.jsonl` + `session-capture` into one append-only row per run. Cloud rows written by the Worker.
- **Eval + Gate** - LLM-as-judge on the Mac via the existing `claude -p --model haiku` pattern (reusing archived `eval-harness`/`agent-eval` rubrics), **sampled + ship-class only + content-cached** → cents/day. `eval-gate` wraps the commit/sync/job-complete boundary; below threshold → `gated=1`, ship blocked, rationale to Telegram. Trade analysis judged on **data-grounding only, never PnL, never auto-acts**.
- **Observe** - a `harness observe` case beside `route-stats`; reads `events` + quotas, breaks down tokens/cost/latency/error/gated per tier/module/phase, with a cloud free-tier + Haiku-spend meter.
- **Release loop** - a `lifeos-release` learner turns logged outcomes into **candidate** versioned `configs` (incl. the "learned reranking prior" as a JSON bias on `route_core.py`); shadow-replayed → Telegram-approved → `config promote` (human-gated) flips active atomically; rollback = one pointer flip; every flip is an event.

### Cloud ↔ Mac queue
`jobs` table; bot enqueues heavy requests; `lifeos-drain` atomically claims (`RETURNING`) and runs a headless harness job; triggered by a LaunchAgent poller while awake + on wake. Turso is the only always-on piece.

---

## 8. Interface

A generalization of the `knowledge-atlas` SPA (vanilla-JS, no-build, offline-capable) into a multi-module shell, with a **light, minimalist, more polished** palette.

- **Reuse:** `app.js` (router, SVG cross-module graph, markdown engine, search), `annotations.js`, `intelligence.js`, `styles.css` (retinted), `tools/server.js`, `tools/memory.js`.
- **New:** `core/registry.js` (`osRegisterModule`), `core/db.js` (libSQL + replica sync + workspace context), `core/auth.js` (session/workspace; no-op locally, real in SaaS), `core/views/{list,board,table,calendar,detail,graph,gallery}.js`, `core/palette.css`, the seven manifests, `server/{bot,sync,scaffold,db,oauth}.js`.

Each module renders generically from its manifest's `views` + `entityTypes.display`: a trade → journal table + equity calendar; a task → Kanban board; a topic → atlas article + connection chips; a design asset → gallery; a campaign → calendar/funnel - all from the same `entities`/`edges` rows. You get cross-domain edges, one search index, one event log, and one graph across every module for free.

---

## 9. Directory layout

```
life-os/
  index.html                 # shell; loads core/ then each enabled module's module.js
  core/
    registry.js db.js auth.js router.js render.js graph.js search.js
    views/ list.js board.js table.js calendar.js detail.js graph.js gallery.js
    annotations.js intelligence.js palette.css styles.css
  modules/
    learning/  module.js data/01_dsa.js … 13_gpu.js   # migrated atlas data
    tasks/     module.js
    projects/  module.js                              # git-seeded
    trading/   module.js                              # from scratch
    social/    module.js                              # multi-account OAuth
    marketing/ module.js
    design/    module.js                              # Figma + Higgsfield
    _template/ module.js views.md README.md           # scaffold skeleton
  server/
    server.js db.js auth.js bot.js sync.js scaffold.js oauth.js memvec.py memory.js
  worker/                    # Cloudflare Worker: Telegram bot (Haiku) + OAuth callbacks
  migrations/ 0001_core.sql 0002_control_plane.sql …
  store/                     # offline write-queue / spool
  CLAUDE.md README.md
```

---

## 10. Build order (phased; each phase independently usable)

1. **Foundations** - Turso project + `0001_core.sql` + `0002_control_plane.sql` (workspace/users/memberships/connections); local `lifeos` API (single DB-token owner, workspace-scoped); embedded-replica sync; thin `~/.claude/bin/lifeos` tool + allow-list; seed the personal workspace/user. → *agent can CRUD the common DB, tenant-aware.*
2. **App shell + seed modules** - generalize the atlas into `core/` (light palette), `osRegisterModule`, generic `views/`; ship Learning, Tasks, Projects, Trading, Social, Marketing, Design. → *usable multi-module SPA over the DB.*
3. **Integrations** - OAuth flows + encrypted `connections` for Instagram/X/WhatsApp/Slack/Reddit; Figma + Higgsfield via mcp-multiplexer; read paths live, write paths drafted. → *real accounts/files connected, AI can read & draft.*
4. **Telegram lane (Haiku)** - Cloudflare Worker bot on Claude Haiku with full workspace DB + memory recall + audit; capture/query/medium actions; gated approve/deny for outward actions; enqueue heavy → `jobs`. → *control + capture from phone, laptop off.*
5. **Self-extension builder** - `/api/module-request`, `scaffold.js`, `_template/`, two validators, SSE hot-reload, offline queued variant + drain poller. → *"ask AI to add a module" works.*
6. **Harness loop** - event-store bridge, Eval+Gate, `harness observe`, Release loop, `broker-guard` + read-only broker tools + gated executors. → *everything logged, scored, auto-improved, boundaries enforced.*
7. **SaaS hardening (when needed)** - real auth/sessions, database-per-workspace swap, plan/quota gating, billing. → *flip from personal to multi-tenant product.*

Each phase ships with tests (≥80%, TDD) and a conventional-commit history.

---

## 11. Verification (per phase)

- **DB/tools:** `lifeos entity create … && lifeos event add …`; assert rows + FTS5 hit + memvec recall; **workspace isolation** (a second workspace can't see the first's rows); kill cloud, write offline, reconnect, assert replica converges.
- **SPA:** load offline then with the local API; each module's views render; cross-module graph draws from `edges`; search works; manual light/minimalist UI check.
- **Integrations:** connect a throwaway account per provider; AI reads feed/mentions; a draft post is created but **not published** until approved; tokens stored encrypted, absent from agent context/logs.
- **Telegram (Haiku):** with the Mac **off**, capture/query/`/pnl`/`/inbox`/`/addmodule` respond; outward action shows approve/deny and only acts on approve; heavy `/addmodule` shows `queued`; wake Mac → drain builds + notifies.
- **Self-extension:** "add a health tracker" → new tile after validators; `git log` shows the commit; break the template → validator fails cleanly, no partial register.
- **Permissions (must-pass):** order attempt via agent and via mis-loaded Kite MCP → `broker-guard` denies both; no order tool registered; `events` UPDATE/DELETE → 404; social publish blocked without approval; broker/social reads succeed.
- **Harness loop:** `harness observe` shows tokens/cost/latency/gated per tier/module; a low-quality run is Eval-gated + Telegram rationale; `lifeos-release propose` → shadow-replayed candidate that only activates after human `config promote`.

---

## 12. Tech stack

| Layer | Choice | Why |
|---|---|---|
| Canonical DB | Turso / libSQL | SQLite-compatible (reuse FTS5/memvec), always-on, embedded replica = local-first, built for multi-tenant SaaS |
| Always-on compute | Cloudflare Workers (free) | Scale-to-zero, webhook-shaped; hosts bot + OAuth callbacks |
| Bot LLM | **Claude Haiku** | Capable + cheap; full DB + memory + audit on the always-on lane |
| Heavy-lane LLM | Claude (existing Claude Code harness) | Deep reasoning, codegen, Eval/Release |
| Bot transport | Telegram | Free, ubiquitous, works laptop-off |
| Frontend | Vanilla-JS SPA (generalized knowledge-atlas) | No-build, offline, matches existing style |
| Local API | Node (extend atlas server) / FastAPI | Single DB-token owner, workspace-scoped |
| Semantic search | sqlite-vec + MiniLM-384 (`memvec.py`) | Reuse existing harness infra |
| Integrations | Figma + Higgsfield + social OAuth via mcp-multiplexer / thin APIs | On-demand, token-disciplined |
| Secrets | Encrypted `connections` (per-workspace envelope key) | SaaS-safe, never in agent context |

---

*Status: scaffolding. See `CLAUDE.md` for working rules. Build proceeds phase-by-phase per §10.*
