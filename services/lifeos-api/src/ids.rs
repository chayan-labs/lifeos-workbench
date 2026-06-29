//! ID + time helpers.
//!
//! The schema documents `id` as a ULID. We keep a short human-readable prefix
//! (`ent_`, `evt_`, ...) in front of the ULID so rows are debuggable at a glance;
//! the ULID body stays lexicographically sortable by creation time.

use ulid::Ulid;

pub fn new_id(prefix: &str) -> String {
    format!("{prefix}_{}", Ulid::new())
}

/// Unix epoch seconds. The whole schema stores integer seconds in `*_at`/`ts`.
pub fn now_secs() -> i64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}
