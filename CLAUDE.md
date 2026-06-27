# Life OS — Claude working notes

Self-extending personal (and SaaS-ready) operating system. One generic multi-tenant graph DB, a declarative module/plugin system, an in-app AI that scaffolds new modules on request, and the local Claude Code harness as the brain. Read `README.md` before non-trivial work - it is the canonical architecture spec.

## Mental model (don't violate these)
- **One generic schema, no per-domain tables.** A task / trade / topic / post / campaign / asset are all rows in `entities`, keyed by `workspace_id` + `module` + `type` + a flexible `attrs` JSON. New domains/fields = **zero migration** by default. Never hand-build a bespoke table per domain (the Notion failure mode we're killing).
- **Multi-tenant from day 1.** Every data row carries `workspace_id`. Personal use = one default workspace, but write all logic tenant-aware - no single-user assumptions, no hardcoded ids. SaaS is a deployment swap, not a rewrite.
- **Modules are declarative.** A module is `modules/<id>/module.js` calling `osRegisterModule({...})` - data + how to render generic entities, never DOM/router/DB code. Rendering lives in reused `core/`.
- **Codegen runs only on the trusted Mac.** The cloud Telegram bot may *enqueue* (`jobs`, `module_requests`) but never writes code/files. Self-extension builds happen locally, behind two validators; each install is a git commit (revertable).
- **Three tiers, one DB.** Cloud Worker bot (Claude Haiku, light/medium lane) + Turso/libSQL `lifeos.db` (always-on canonical, SQLite-compatible) + Mac harness (heavy lane). Embedded replica keeps the Mac local-first/offline.

## Day-1 modules
Learning, Tasks, Coding/Projects, Trading, **Social, Marketing, Design**. All others (health, finance, …) added later via the self-extension builder.

## Hard rules (security / safety)
- **Outward or irreversible actions are human-gated.** Social posts/DMs and any trade action go draft → Telegram approve → execute. **Reads are free.** Never let the agent or bot publish/trade autonomously.
- **Trading is read-only for any agent/bot.** No order tool registered anywhere; `broker-guard` PreToolUse hook fails closed on place/modify/cancel/GTT; broker keys read-scoped. Real orders only via a separate human-typed-confirmation executor.
- **OAuth/secret tokens live encrypted in `connections`, never in agent context.** The API injects them at call time. Per-workspace key (envelope encryption).
- **`events` is append-only.** No UPDATE/DELETE route. It is both the domain log and the harness run-log (Observe/Eval/Release read it).
- **Derived state is never synced** (FTS5 shadow, memvec vectors) - rebuilt locally.

## Telegram bot scope (Claude Haiku)
Full common-DB RW **within its workspace** (entities/edges/events/annotations) + harness memory recall (shared-DB FTS5/vector) + audit logging (`events`). **Cannot:** write code/files, place orders, publish without approval, promote configs. Heavy/deep work → enqueue to the Mac.

## Token discipline
API-first thin-HTTP tools over heavy MCPs; CRUD is never an MCP. mcp-multiplexer hot-loads heavy MCPs (Figma, Higgsfield, social APIs) only on demand, unloaded at cleanup. Bounded context injection replaces always-mounted MCPs.

## Reuse before build
Generalize `../../01_Inbox/knowledge-atlas/` (`app.js`, `annotations.js`, `intelligence.js`, `tools/server.js`, `tools/memory.js`). Reuse harness infra: `~/.claude/bin/memvec.py`, `memory-recall`, `session-capture`, `~/.claude/logs/route.jsonl`, `~/.claude/metrics/costs.jsonl`. Reuse skills: `copywriting`, `marketingskills-ai-agents`, `figma-*`, `mcp-figma`, `mcp-higgsfield`.

## Conventions
- Conventional commits; no co-author trailers. Many small files (200-400 lines, 800 max), functions <50 lines, immutable patterns. Tests ≥80%, TDD. Light, minimalist UI palette.
- Build is phased (README §"Build Order"); each phase independently usable, ships with tests + a commit.
