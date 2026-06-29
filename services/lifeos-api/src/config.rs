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
    /// Address the local API binds to. Localhost-only by design (single-owner).
    pub bind_addr: SocketAddr,
    /// HMAC secret for signing/verifying `key_token` JWTs.
    pub jwt_secret: String,
    /// Working directory agent CLIs are spawned in (OpenDesign-style managed cwd).
    pub agent_cwd: Option<String>,
    /// Hard ceiling on how long a single agent invocation may run.
    pub agent_timeout_secs: u64,
}

impl Config {
    pub fn from_env() -> Self {
        let db_path = std::env::var("LIFEOS_DB_PATH").unwrap_or_else(|_| "lifeos.db".to_string());

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

        Self {
            db_path,
            bind_addr,
            jwt_secret,
            agent_cwd,
            agent_timeout_secs,
        }
    }
}
