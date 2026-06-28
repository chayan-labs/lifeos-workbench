# Security & permissions

Layered, fail-closed boundaries. Auditability over speed; gate the irreversible.

---

## 1. Permission boundary (hard, layered)

- **Common DB:** harness = full RW; Haiku bot = full RW **within its workspace**.
- **Trading: read-only for any agent/bot.** No order tool registered anywhere. A fail-closed `broker-guard` PreToolUse hook denies place/modify/cancel/GTT even if the Kite MCP is mis-loaded; broker keys are read-scoped. Orders flow agent → `proposed_order` entity → Telegram approve → a **separate interactive `trade-exec`** (never agent/hook/cron-callable; typed confirmation). **No autonomous trading.**
- **Outward actions (social/marketing publish, email send, calendar write, drive share, browser actions):** `gated` agent tools produce **drafts only**; publishing requires Telegram (or PWA) approval, then a Worker/Mac executor performs the provider call.
- **Secrets:** OAuth tokens live in **Nango** (encrypted), the agent holds only a `connectionId`; the few non-Nango secrets (Kite daily token, WhatsApp) are envelope-encrypted in `connections.secret_enc`. **Never in agent context, never in logs.**
- **`events` append-only:** no UPDATE/DELETE route, so even the RW token cannot rewrite history.

---

## 2. The gating state machine

```
agent tool (gated:true) ──► draft entity + events('*.drafted')
                              │
                              ▼
              Telegram/PWA approve  ──deny──► events('*.rejected'), stop
                              │ approve
                              ▼
        Mac/Worker executor ──► Nango proxy / browser actuator / trade-exec
                              ▼
                        events('*.published'|'*.sent'|'*.executed')
```
Every transition is an `event`. Nothing outward happens without a human approve.

---

## 3. Self-extension & marketplace sandbox

Codegen and untrusted manifests run under three layers ([SELF-EXTENSION.md](./SELF-EXTENSION.md) §2):
1. `allowedTools`/`disallowedTools` + `permissionMode:"dontAsk"` (hard-deny).
2. PreToolUse hook confining writes to `modules/<id>/` (absolute, holds under bypass).
3. macOS Seatbelt sandbox (`failIfUnavailable:true`) confining Bash; credential files/env denied.
Plus: only `modules/` is writable (never `core/`); every install is a git commit (one `git revert` away); marketplace manifests are signature-verified and re-validated locally.

---

## 4. Browser actuator containment

- Mac-only (trusted host), loaded on-demand, unloaded after.
- Sessions/cookies encrypted at rest like `connections`; never in agent context.
- Every state-changing action is gated; reads/scrapes are free.
- It can do anything a logged-in you can - therefore it is **never** allowed an un-gated outward action.

---

## 5. Tenancy isolation

- Every query is `workspace_id`-scoped at the API layer (RLS-style); a second workspace cannot see the first's rows.
- SaaS path: Turso database-per-workspace; per-workspace envelope key for non-Nango secrets.
- Derived state (`lifeos-derived.db`) and blobs (CAS) are local/keyed and never leak cross-workspace.

---

## 6. Must-pass verification (security)

- Order attempt via agent **and** via a mis-loaded Kite MCP → `broker-guard` denies both; no order tool registered.
- `events` UPDATE/DELETE → 404.
- Social publish / email send blocked without approval; reads succeed.
- Tokens absent from agent context and logs; a leaked-token grep finds nothing.
- A second workspace cannot read the first's entities.
- Break the scaffold template → validator fails cleanly, no partial register, worktree discarded.
