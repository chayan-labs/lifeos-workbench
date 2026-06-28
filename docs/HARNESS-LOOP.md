# Harness loop - Event store, Eval+Gate, Observe, Release

> Closes the four "diagram gaps" by reusing existing harness infra at near-zero new always-on cost.
> Everything is logged, scored, and auto-improved; boundaries are enforced.

---

## 1. Event store (the foundation)

The `events` table doubles as the harness run-log (see [DATA-MODEL.md](./DATA-MODEL.md) §2.3).
A **`lifeos-sync-events` bridge** in the existing **Stop hook** joins:
- `~/.claude/logs/route.jsonl` (routing decisions),
- `~/.claude/metrics/costs.jsonl` (tokens/cost),
- `session-capture` (session outcome),

into **one append-only `events` row per run** (`run_id, tier, model, tokens_in/out, cost, latency_ms, error, outcome, eval_score, gated`).
Cloud rows are written by the Worker for bot runs. No new event store - the domain log *is* the run log.

---

## 2. Eval + Gate

- **LLM-as-judge on the Mac** via the existing `claude -p --model haiku` pattern, reusing archived `eval-harness` / `agent-eval` rubrics.
- **Sampled + ship-class only + content-cached** → cents/day.
- **`eval-gate`** wraps the commit/sync/job-complete boundary: below threshold → `gated=1`, ship blocked, rationale to Telegram.
- **Trade analysis is judged on data-grounding only - never PnL, never auto-acts.** (Reinforces the trading read-only guarantee in [SECURITY.md](./SECURITY.md).)

---

## 3. Observe

A `harness observe` case beside `route-stats`:
- Reads `events` + quotas.
- Breaks down tokens / cost / latency / error / gated **per tier / module / phase**.
- Surfaces a **cloud free-tier + Haiku-spend meter** (so the always-on lane never surprises you).
- Feeds the per-module dashboards (see [PLATFORM-SYSTEMS.md](./PLATFORM-SYSTEMS.md) §2) - same `events` source, different lens.

---

## 4. Release loop

A `lifeos-release` learner turns logged outcomes into **candidate** versioned `configs`:
- Includes a "learned reranking prior" as a JSON bias on `route_core.py`.
- **Shadow-replayed** against recent runs → **Telegram-approved** → `config promote` (human-gated) flips active atomically.
- Rollback = one pointer flip; every flip is an `event`.
- Nothing auto-activates: a candidate only goes live after explicit human `config promote`.

---

## 5. Cloud ↔ Mac queue (recap)

`jobs` table in Turso (not Cloudflare Queues); atomic `UPDATE … RETURNING` claim + reaper; `lifeos-drain` (Rust) runs headless harness jobs; triggered by a `launchd` poller while awake + on wake.
Turso is the only always-on piece.
See [DATA-MODEL.md](./DATA-MODEL.md) §2.5 for the claim SQL.

---

## 6. Agent pipelines integration

User/module-defined agent DAGs ([PLATFORM-SYSTEMS.md](./PLATFORM-SYSTEMS.md) §1) run through this same loop: each stage writes `events` (run_id, stage, tokens, outcome), is subject to Eval+Gate, and surfaces in Observe.
The Eval rubric for a publish pipeline gates the final outward stage.

---

## 7. Why this is near-zero new always-on cost

- The event store reuses logs you already produce.
- Eval is sampled + cached + Haiku.
- Observe is a read over `events`.
- Release is shadow-replay + a pointer.
- The only always-on piece is Turso (free tier) and the Worker (free tier).
