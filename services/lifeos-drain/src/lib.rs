//! lifeos-drain queue core: atomic claim, reaper, and dispatch-by-kind.
//!
//! The Mac drains heavy work enqueued to `jobs`. Claims must be atomic so two
//! drainers never run the same job; crashed claims must be reaped and retried.
//! These functions are split out of `main` so the concurrency and reaper
//! guarantees can be tested directly against a libSQL connection.
//!
//! `module_requests` (issue #76, docs/SELF-EXTENSION.md §1) gets its own
//! queued->building->installed|failed transitions below, guarded by the same
//! CAS-via-WHERE-clause discipline as `complete_job`/`fail_job`. This crate
//! has no dependency on `lifeos-api` (it's a standalone binary against the
//! same DB file), so `emit_event` is a small self-contained mirror of
//! `lifeos_api::audit::emit` rather than a cross-crate import.

use libsql::{params, Connection};
use ulid::{Generator, Ulid};
use std::sync::Mutex;

static EVENT_ID_GENERATOR: Mutex<Generator> = Mutex::new(Generator::new());

fn new_event_id() -> String {
    let ulid = EVENT_ID_GENERATOR
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .generate()
        .unwrap_or_else(|_| Ulid::new());
    format!("evt_{ulid}")
}

/// Append one `events` row. Mirrors `lifeos_api::audit::emit`'s shape exactly
/// (same table, same id scheme) so events this crate writes are
/// indistinguishable from ones the API writes.
async fn emit_event(
    conn: &Connection,
    workspace_id: &str,
    event_type: &str,
    entity_id: &str,
    actor: &str,
    attrs: &serde_json::Value,
    now: i64,
) -> libsql::Result<()> {
    let attrs_str = serde_json::to_string(attrs).unwrap_or_else(|_| "{}".into());
    conn.execute(
        "INSERT INTO events (id, workspace_id, ts, type, entity_id, actor, attrs) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![new_event_id(), workspace_id, now, event_type, entity_id, actor, attrs_str],
    )
    .await?;
    Ok(())
}

/// A job a drainer has exclusively claimed.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ClaimedJob {
    pub id: String,
    pub kind: String,
    pub payload: String,
    pub workspace_id: String,
}

/// Tunables, all overridable via env in `main`.
#[derive(Debug, Clone, Copy)]
pub struct DrainConfig {
    /// Seconds a `running` job may go untouched before it is reaped.
    pub stuck_ttl_secs: i64,
    /// Max claim attempts before a job is marked `failed` for good.
    pub max_attempts: i64,
}

impl Default for DrainConfig {
    fn default() -> Self {
        Self {
            stuck_ttl_secs: 300,
            max_attempts: 3,
        }
    }
}

/// Atomically claim the highest-priority eligible job, if any.
///
/// SQLite serializes writers, so the `UPDATE ... WHERE id = (SELECT ...
/// status='queued' ...)` re-checks `status` under the write lock - two drainers
/// racing this statement can never select-and-claim the same row. We bump
/// `attempts` here so the count survives a crash (the reaper requeues without
/// re-incrementing).
pub async fn claim_job(
    conn: &Connection,
    worker_id: &str,
    now: i64,
    cfg: DrainConfig,
) -> libsql::Result<Option<ClaimedJob>> {
    let sql = "UPDATE jobs \
         SET status='running', claimed_by=?1, claimed_at=?2, attempts=attempts+1 \
         WHERE id = ( \
            SELECT id FROM jobs \
            WHERE status='queued' \
              AND (run_after IS NULL OR run_after <= ?2) \
              AND attempts < ?3 \
            ORDER BY priority DESC, created_at ASC LIMIT 1 \
         ) \
         RETURNING id, kind, payload, workspace_id";
    let mut rows = conn
        .query(sql, params![worker_id, now, cfg.max_attempts])
        .await?;
    match rows.next().await? {
        Some(row) => Ok(Some(ClaimedJob {
            id: row.get(0)?,
            kind: row.get(1)?,
            payload: row.get(2)?,
            workspace_id: row.get(3)?,
        })),
        None => Ok(None),
    }
}

/// Mark a claimed job done. Guarded by `claimed_by` + `status='running'` so a
/// worker can only finalize a job it still holds: if this worker stalled, the
/// reaper requeued the job, and another worker re-claimed it, this stale update
/// matches zero rows instead of clobbering the new owner's claim (double-run).
/// Returns the number of rows updated (0 = lease lost).
pub async fn complete_job(conn: &Connection, id: &str, worker_id: &str) -> libsql::Result<u64> {
    let n = conn
        .execute(
            "UPDATE jobs SET status='done' WHERE id=?1 AND claimed_by=?2 AND status='running'",
            params![id, worker_id],
        )
        .await?;
    Ok(n)
}

/// Mark a claimed job failed (no further retries). Same lease guard as
/// `complete_job`. Returns the number of rows updated (0 = lease lost).
pub async fn fail_job(conn: &Connection, id: &str, worker_id: &str) -> libsql::Result<u64> {
    let n = conn
        .execute(
            "UPDATE jobs SET status='failed' WHERE id=?1 AND claimed_by=?2 AND status='running'",
            params![id, worker_id],
        )
        .await?;
    Ok(n)
}

/// Reap jobs stuck in `running` past the TTL. Those under the attempt cap go
/// back to `queued`; those that have exhausted their retries become `failed`.
/// Returns the number of rows reaped.
pub async fn reap_stuck(conn: &Connection, now: i64, cfg: DrainConfig) -> libsql::Result<u64> {
    let threshold = now - cfg.stuck_ttl_secs;
    let n = conn
        .execute(
            "UPDATE jobs \
             SET status = CASE WHEN attempts >= ?1 THEN 'failed' ELSE 'queued' END, \
                 claimed_by = NULL, claimed_at = NULL \
             WHERE status='running' AND claimed_at IS NOT NULL AND claimed_at < ?2",
            params![cfg.max_attempts, threshold],
        )
        .await?;
    Ok(n)
}

/// Result of dispatching a claimed job to its (eventual) handler.
#[derive(Debug, PartialEq, Eq)]
pub enum Dispatch {
    /// A known kind whose real handler lands in a later phase (no-op stub).
    Stub(&'static str),
    /// Unknown kind - cannot be handled, will be failed.
    Unknown,
}

/// Route a job to its handler by kind. Real handlers (ingest/pipeline/
/// module_build/eval) land in later phases; until then known kinds are
/// acknowledged as no-op stubs and unknown kinds are rejected.
///
/// `reconcile` (docs/DATA-MODEL.md §4.2) already has a real handler -
/// `lifeos_api::reconcile::reconcile_entity`, reachable today via
/// `POST /api/entity/:id/reconcile`. It is dispatched here as a stub too so a
/// queued `jobs` row of this kind is acknowledged rather than rejected as
/// Unknown; wiring drain to actually call the API is a later phase, same as
/// the other stub kinds.
pub fn dispatch(kind: &str) -> Dispatch {
    match kind {
        "ingest" => Dispatch::Stub("lifeos-ingest"),
        "pipeline" => Dispatch::Stub("lifeos-pipelines"),
        "module_build" => Dispatch::Stub("scaffold.js"),
        "eval" => Dispatch::Stub("harness eval"),
        "reconcile" => Dispatch::Stub("lifeos-api reconcile"),
        _ => Dispatch::Unknown,
    }
}

// ----------------------------------------------------- module_requests (#76)
//
// A `module_build` job's payload carries `request_id` - the linked
// `module_requests` row a requester polls via `GET /api/module-request/:id`.
// These three functions are the queued->building->installed|failed state
// machine, each guarded by the current status exactly like `complete_job`/
// `fail_job`'s lease guard (a mismatched WHERE = 0 rows = someone else
// already moved this request, don't clobber it) and each emitting the
// matching `module.*` event only when the transition actually applied.
//
// Deliberately NOT called from `run_job`/`dispatch` yet: `module_build` is
// still a `Dispatch::Stub` (no real `scaffold.js` invocation - that's #78's
// job), and marking a request `installed` for a build that never actually
// ran would be exactly the kind of false-confidence result this project's
// validators (#74/#75) were built to avoid. #78's real drain loop calls
// these in lockstep with `claim_job`/`complete_job`/`fail_job` once it
// actually invokes `scaffoldModule()`.

/// `queued` -> `building`. Call right after `claim_job` claims the linked
/// `module_build` job. Returns rows affected (0 = already transitioned).
pub async fn claim_module_request(
    conn: &Connection,
    request_id: &str,
    workspace_id: &str,
    now: i64,
) -> libsql::Result<u64> {
    let n = conn
        .execute(
            "UPDATE module_requests SET status='building', updated_at=?2 WHERE id=?1 AND status='queued'",
            params![request_id, now],
        )
        .await?;
    if n > 0 {
        emit_event(conn, workspace_id, "module.building", request_id, "mac-drain", &serde_json::json!({}), now).await?;
    }
    Ok(n)
}

/// `building` -> `installed`. Call once the real build (§1 step 5) lands the
/// module. Returns rows affected (0 = lease lost / already transitioned).
pub async fn complete_module_request(
    conn: &Connection,
    request_id: &str,
    workspace_id: &str,
    module_id: &str,
    now: i64,
) -> libsql::Result<u64> {
    let n = conn
        .execute(
            "UPDATE module_requests SET status='installed', updated_at=?2 WHERE id=?1 AND status='building'",
            params![request_id, now],
        )
        .await?;
    if n > 0 {
        emit_event(
            conn,
            workspace_id,
            "module.installed",
            request_id,
            "mac-drain",
            &serde_json::json!({ "id": module_id }),
            now,
        )
        .await?;
    }
    Ok(n)
}

/// `building` -> `failed`, with the honest error message a requester's
/// `GET /api/module-request/:id` surfaces directly (issue #76's acceptance:
/// "failure surfaces honestly to the requester", not a generic "something
/// went wrong"). Returns rows affected (0 = lease lost / already transitioned).
pub async fn fail_module_request(
    conn: &Connection,
    request_id: &str,
    workspace_id: &str,
    error: &str,
    now: i64,
) -> libsql::Result<u64> {
    let n = conn
        .execute(
            "UPDATE module_requests SET status='failed', error=?2, updated_at=?3 WHERE id=?1 AND status='building'",
            params![request_id, error, now],
        )
        .await?;
    if n > 0 {
        emit_event(
            conn,
            workspace_id,
            "module.failed",
            request_id,
            "mac-drain",
            &serde_json::json!({ "error": error }),
            now,
        )
        .await?;
    }
    Ok(n)
}

#[cfg(test)]
mod tests {
    use super::*;
    use libsql::Builder;

    async fn fresh_conn(path: &str) -> Connection {
        let _ = std::fs::remove_file(path);
        let db = Builder::new_local(path).build().await.unwrap();
        let conn = db.connect().unwrap();
        conn.execute(
            "CREATE TABLE module_requests (\
                id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, prompt TEXT NOT NULL, \
                status TEXT NOT NULL DEFAULT 'queued', error TEXT, \
                created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)",
            (),
        )
        .await
        .unwrap();
        conn.execute(
            "CREATE TABLE events (\
                id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, ts INTEGER NOT NULL, \
                type TEXT NOT NULL, entity_id TEXT, actor TEXT NOT NULL, attrs TEXT NOT NULL)",
            (),
        )
        .await
        .unwrap();
        conn
    }

    async fn insert_queued(conn: &Connection, id: &str, workspace_id: &str, now: i64) {
        conn.execute(
            "INSERT INTO module_requests (id, workspace_id, prompt, status, error, created_at, updated_at) \
             VALUES (?1, ?2, 'add a widget module', 'queued', NULL, ?3, ?3)",
            params![id, workspace_id, now],
        )
        .await
        .unwrap();
    }

    async fn status_of(conn: &Connection, id: &str) -> String {
        let mut rows = conn
            .query("SELECT status FROM module_requests WHERE id=?1", params![id])
            .await
            .unwrap();
        rows.next().await.unwrap().unwrap().get(0).unwrap()
    }

    async fn event_count(conn: &Connection, event_type: &str) -> i64 {
        let mut rows = conn
            .query("SELECT COUNT(*) FROM events WHERE type=?1", params![event_type])
            .await
            .unwrap();
        rows.next().await.unwrap().unwrap().get(0).unwrap()
    }

    #[tokio::test]
    async fn walks_queued_building_installed_with_an_event_at_each_step() {
        let conn = fresh_conn("test_mr_happy.db").await;
        insert_queued(&conn, "req_1", "ws1", 100).await;

        assert_eq!(claim_module_request(&conn, "req_1", "ws1", 101).await.unwrap(), 1);
        assert_eq!(status_of(&conn, "req_1").await, "building");
        assert_eq!(event_count(&conn, "module.building").await, 1);

        assert_eq!(
            complete_module_request(&conn, "req_1", "ws1", "widgets", 102).await.unwrap(),
            1
        );
        assert_eq!(status_of(&conn, "req_1").await, "installed");
        assert_eq!(event_count(&conn, "module.installed").await, 1);

        let _ = std::fs::remove_file("test_mr_happy.db");
    }

    #[tokio::test]
    async fn walks_queued_building_failed_with_the_error_surfaced() {
        let conn = fresh_conn("test_mr_failed.db").await;
        insert_queued(&conn, "req_2", "ws1", 100).await;

        claim_module_request(&conn, "req_2", "ws1", 101).await.unwrap();
        assert_eq!(
            fail_module_request(&conn, "req_2", "ws1", "PreToolUse hook denied", 103)
                .await
                .unwrap(),
            1
        );

        assert_eq!(status_of(&conn, "req_2").await, "failed");
        let mut rows = conn
            .query("SELECT error FROM module_requests WHERE id='req_2'", ())
            .await
            .unwrap();
        let error: String = rows.next().await.unwrap().unwrap().get(0).unwrap();
        assert_eq!(error, "PreToolUse hook denied");
        assert_eq!(event_count(&conn, "module.failed").await, 1);

        let _ = std::fs::remove_file("test_mr_failed.db");
    }

    #[tokio::test]
    async fn claim_is_a_noop_on_a_request_that_is_not_queued() {
        let conn = fresh_conn("test_mr_claim_noop.db").await;
        insert_queued(&conn, "req_3", "ws1", 100).await;
        claim_module_request(&conn, "req_3", "ws1", 101).await.unwrap();

        // Second claim attempt on an already-building request is a no-op,
        // not a re-transition or a duplicate event - same discipline as a
        // job whose lease was already taken.
        assert_eq!(claim_module_request(&conn, "req_3", "ws1", 102).await.unwrap(), 0);
        assert_eq!(event_count(&conn, "module.building").await, 1);

        let _ = std::fs::remove_file("test_mr_claim_noop.db");
    }

    #[tokio::test]
    async fn complete_and_fail_are_noops_outside_the_building_state() {
        let conn = fresh_conn("test_mr_wrong_state.db").await;
        insert_queued(&conn, "req_4", "ws1", 100).await;

        // Still 'queued' - neither transition should apply, and neither
        // should emit an event for a state change that didn't happen.
        assert_eq!(
            complete_module_request(&conn, "req_4", "ws1", "widgets", 101).await.unwrap(),
            0
        );
        assert_eq!(fail_module_request(&conn, "req_4", "ws1", "boom", 101).await.unwrap(), 0);
        assert_eq!(status_of(&conn, "req_4").await, "queued");
        assert_eq!(event_count(&conn, "module.installed").await, 0);
        assert_eq!(event_count(&conn, "module.failed").await, 0);

        let _ = std::fs::remove_file("test_mr_wrong_state.db");
    }
}
