# Build plan (revised for the adopted stack)

Phased; each phase independently usable, ships with tests (≥80%, TDD) and a conventional-commit history.
Revised from the original §10 to reflect the tools we adopt (which compress several phases).

---

## Phase 1 - Foundations
- Turso project + `0001_core.sql` + `0002_control_plane.sql` (workspaces/users/memberships/connections).
- **lifeos-api (Rust, axum)** - single DB-token owner, workspace-scoped, auth; embedded-replica sync with **`offline:true`**.
- **`lifeos-derived.db`** split (ATTACH; FTS5 + sqlite-vec live here, never synced).
- Thin **`bin/lifeos` (Rust)** CLI + allow-list; seed the personal workspace/user.
- **Drizzle** schema for typed access (Worker + Mac).
- → *agent can CRUD the common DB, tenant-aware; offline writes work; derived state isolated.*

## Phase 2 - App shell + seed modules
- Generalize the atlas into `core/` (light palette), `osRegisterModule`, generic `views/`; **adopt Refine** for the admin shell + list/board/table/calendar/gallery; Cytoscape for graph.
- Ship Learning, Tasks, Projects, Trading, Social, Marketing, Design manifests.
- `core/command.js` (command bar) + `core/analytics.js` (dashboards over `events`).
- → *usable multi-module SPA over the DB.*

## Phase 3 - Integrations (owned-OAuth via Nango)
- Stand up **self-hosted Nango**; register **your own** Google/Notion/Slack/Meta/X/Reddit/GitHub/Figma/Kite apps.
- Thin proxy tools (`lifeos gmail|cal|drive|notion|slack …`) in the Rust API; **Email/Calendar/Files/Notion/Slack** modules.
- Custom connectors: Kite (read-only), WhatsApp.
- **browser actuator** (fork browser-use) as a gated tool.
- Read paths live; write paths drafted/gated.
- → *real owned accounts/files connected; AI can read & draft; no claude.ai-MCP dependency.*

## Phase 4 - Telegram lane (Haiku)
- **grammY** bot on Cloudflare Workers (Haiku) with full workspace DB (`@libsql/client/web`) + memory recall + audit; inline approve/deny.
- Capture/query/medium actions; gated outward; enqueue heavy → `jobs`.
- **lifeos-drain (Rust)** + `launchd` poller (atomic claim + reaper).
- → *control + capture from phone, laptop off.*

## Phase 5 - Self-extension builder
- `scaffold.js` on the **Claude Agent SDK** (3-layer tool-lock, Zod structured output); `_template/`; two validators; SSE hot-reload; offline queued variant + drain.
- First self-extension demos: **Reading**, **Travel** modules.
- → *"ask AI to add a module" works, end to end.*

## Phase 6 - Heavy systems & harness loop
- **lifeos-vcs (Rust)** universal versioning (CAS, FastCDC, jj model, per-type diff).
- **lifeos-ingest (Rust)** media pipeline (whisper-rs → memvec); "find the clip".
- **lifeos-pipelines** agent DAGs + **Life OS Actions** engine.
- Event-store bridge, Eval+Gate, `harness observe`, Release loop; `broker-guard` + read-only broker tools + gated `trade-exec`.
- → *everything versioned, searchable, logged, scored, auto-improved; boundaries enforced.*

## Phase 7 - SaaS hardening (when needed)
- Real auth/sessions; **PWA** (service worker + Web Push); **module marketplace** (publish/sign/install); database-per-workspace swap; plan/quota gating; billing.
- → *flip from personal to multi-tenant product.*

---

## Verification (per phase)
See each sub-doc's verification section; summary of must-pass gates:
- **DB/tools:** CRUD + FTS5 hit + memvec recall; workspace isolation; kill cloud, write offline (`offline:true`), reconnect, replica converges; events reconciliation on a forced conflict.
- **SPA:** offline then live; each module's views render; cross-module graph from `edges`; command bar + dashboards work; light/minimalist check.
- **Integrations:** connect a throwaway owned account per provider; AI reads feed/mentions; a draft is created but not published until approved; tokens encrypted in Nango, absent from agent context/logs.
- **Telegram:** Mac off → capture/query/`/pnl`/`/inbox`/`/addmodule` respond; outward shows approve/deny; heavy shows `queued`; wake → drain builds + notifies.
- **Self-extension:** "add a health tracker" → tile after validators; `git log` shows the commit; broken template fails cleanly.
- **VCS/media:** commit a video → version timeline + semantic diff; "find the clip where I said X" → correct timestamp.
- **Permissions (must-pass):** order attempt via agent + mis-loaded Kite MCP → both denied; `events` UPDATE/DELETE → 404; publish blocked without approval.
- **Harness loop:** `harness observe` shows tokens/cost/latency/gated per tier/module; a low-quality run is Eval-gated + Telegram rationale; `lifeos-release propose` → shadow-replayed candidate that only activates after human `config promote`.
