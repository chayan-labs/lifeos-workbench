//! Runtime configuration, resolved from environment variables with safe defaults.
//!
//! The single DB-token owner reads everything it needs here so the rest of the
//! code never touches `std::env` directly.

use std::net::SocketAddr;

/// The seeded personal workspace. Used as the tenant fallback when a request
/// carries no explicit workspace (the current frontend does this on some calls).
pub const DEFAULT_WORKSPACE: &str = "default-personal-workspace";

#[derive(Clone, Debug)]
pub struct Config {
    /// libSQL/SQLite file path for the canonical DB (embedded replica on the Mac).
    pub db_path: String,
    /// Canonical Turso primary URL. When set (with `turso_token`), `db_path`
    /// becomes an embedded replica syncing against it; otherwise the canonical DB
    /// is a pure local file (fully offline - the personal-Mac default).
    pub turso_url: Option<String>,
    /// Auth token for the Turso primary. Held only by this single DB-token owner.
    pub turso_token: Option<String>,
    /// Background pull interval (seconds) for the embedded replica.
    pub sync_interval_secs: u64,
    /// Separate, NEVER-synced SQLite file holding derived/search state (FTS5 +
    /// sqlite-vec). Physically distinct from `db_path` so it can never be pushed
    /// to the primary (libSQL has no table-level sync-exclusion). See DATA-MODEL §5.
    pub derived_db_path: String,
    /// Address the local API binds to. Localhost-only by design (single-owner).
    pub bind_addr: SocketAddr,
    /// HMAC secret for signing/verifying `key_token` JWTs.
    pub jwt_secret: String,
    /// Working directory agent CLIs are spawned in (OpenDesign-style managed cwd).
    pub agent_cwd: Option<String>,
    /// Hard ceiling on how long a single agent invocation may run.
    pub agent_timeout_secs: u64,
    /// Base URL of the self-hosted Nango instance (infra/nango/). `None` means
    /// no Nango deployment is configured yet - connection routes return
    /// `ApiError::NotImplemented` rather than pretending to work.
    pub nango_server_url: Option<String>,
    /// Bearer secret lifeos-api authenticates to Nango's API with. Never sent
    /// to the client, never logged (docs/SECURITY.md §1).
    pub nango_secret_key: Option<String>,
}

impl Config {
    pub fn from_env() -> Self {
        let db_path = std::env::var("LIFEOS_DB_PATH").unwrap_or_else(|_| "lifeos.db".to_string());

        // Embedded-replica sync is opt-in: only when BOTH the URL and token are set.
        let turso_url = std::env::var("TURSO_URL").ok().filter(|s| !s.is_empty());
        let turso_token = std::env::var("TURSO_TOKEN").ok().filter(|s| !s.is_empty());
        let sync_interval_secs = std::env::var("LIFEOS_SYNC_INTERVAL_SECS")
            .ok()
            .and_then(|s| s.parse().ok())
            .unwrap_or(60);
        let derived_db_path =
            std::env::var("LIFEOS_DERIVED_DB_PATH").unwrap_or_else(|_| "lifeos-derived.db".to_string());

        let bind_addr = std::env::var("LIFEOS_BIND_ADDR")
            .ok()
            .and_then(|s| s.parse().ok())
            .unwrap_or_else(|| SocketAddr::from(([127, 0, 0, 1], 8080)));

        let jwt_secret = std::env::var("LIFEOS_JWT_SECRET").unwrap_or_else(|_| {
            tracing::warn!(
                "LIFEOS_JWT_SECRET not set - using an insecure dev secret. Set it before any non-local use."
            );
            "lifeos-dev-insecure-secret-change-me".to_string()
        });

        let agent_cwd = std::env::var("LIFEOS_AGENT_CWD").ok();

        let agent_timeout_secs = std::env::var("LIFEOS_AGENT_TIMEOUT_SECS")
            .ok()
            .and_then(|s| s.parse().ok())
            .unwrap_or(180);

        let nango_server_url = std::env::var("NANGO_SERVER_URL").ok().filter(|s| !s.is_empty());
        let nango_secret_key = std::env::var("NANGO_SECRET_KEY_DEV").ok().filter(|s| !s.is_empty());

        Self {
            db_path,
            turso_url,
            turso_token,
            sync_interval_secs,
            derived_db_path,
            bind_addr,
            jwt_secret,
            agent_cwd,
            agent_timeout_secs,
            nango_server_url,
            nango_secret_key,
        }
    }
}
