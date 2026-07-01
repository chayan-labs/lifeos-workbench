//! `lifeos-api` library surface. The binary (`main.rs`) is a thin wrapper; the
//! whole app is here so integration tests can build the router in-process.

pub mod agents;
pub mod audit;
pub mod auth;
pub mod config;
pub mod db;
pub mod error;
pub mod ids;
pub mod models;
pub mod nango;
pub mod reconcile;
pub mod routes;
pub mod state;

use crate::config::Config;
use crate::nango::{HttpNangoClient, NangoClient};
use crate::state::AppState;
use std::sync::Arc;

/// Open the DB, detect agents, and assemble shared state from a config.
/// Wires the real HTTP Nango client when `nango_server_url`/`nango_secret_key`
/// are both configured; `None` otherwise (connection routes then surface a
/// clean NotImplemented - see docs/MANUAL-SETUP.md #47-55).
pub async fn build_state(config: Config) -> Result<AppState, libsql::Error> {
    let nango: Option<Arc<dyn NangoClient>> =
        match (&config.nango_server_url, &config.nango_secret_key) {
            (Some(url), Some(key)) => {
                Some(Arc::new(HttpNangoClient::new(url.clone(), key.clone())))
            }
            _ => None,
        };
    build_state_with_nango(config, nango).await
}

/// Same as `build_state`, but with an explicit Nango client (or `None`) -
/// lets tests inject `nango::mock::MockNangoClient` instead of hitting a real
/// deployment.
pub async fn build_state_with_nango(
    config: Config,
    nango: Option<Arc<dyn NangoClient>>,
) -> Result<AppState, libsql::Error> {
    let db = db::connect(&config).await?;
    let agents = agents::detect();
    Ok(AppState {
        conn: Arc::new(db.conn),
        database: Arc::new(db.database),
        config,
        agents: Arc::new(agents),
        nango,
    })
}
