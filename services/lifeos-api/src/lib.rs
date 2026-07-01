//! `lifeos-api` library surface. The binary (`main.rs`) is a thin wrapper; the
//! whole app is here so integration tests can build the router in-process.

pub mod agents;
pub mod audit;
pub mod auth;
pub mod config;
pub mod crypto;
pub mod db;
pub mod error;
pub mod ids;
pub mod kite;
pub mod models;
pub mod nango;
pub mod reconcile;
pub mod routes;
pub mod state;

use crate::config::Config;
use crate::kite::{HttpKiteClient, KiteClient};
use crate::nango::{HttpNangoClient, NangoClient};
use crate::state::AppState;
use std::sync::Arc;

fn kite_from_config(config: &Config) -> Option<Arc<dyn KiteClient>> {
    match (&config.kite_api_key, &config.kite_api_secret, &config.secret_encryption_key) {
        (Some(key), Some(secret), Some(_)) => {
            Some(Arc::new(HttpKiteClient::new(key.clone(), secret.clone())))
        }
        _ => None,
    }
}

/// Open the DB, detect agents, and assemble shared state from a config.
/// Wires the real HTTP Nango client when `nango_server_url`/`nango_secret_key`
/// are both configured, and the real Kite client when a Kite app + encryption
/// key are configured; `None` otherwise (routes then surface a clean
/// NotImplemented - see docs/MANUAL-SETUP.md #47-55).
pub async fn build_state(config: Config) -> Result<AppState, libsql::Error> {
    let nango: Option<Arc<dyn NangoClient>> =
        match (&config.nango_server_url, &config.nango_secret_key) {
            (Some(url), Some(key)) => {
                Some(Arc::new(HttpNangoClient::new(url.clone(), key.clone())))
            }
            _ => None,
        };
    let kite = kite_from_config(&config);
    build_state_with_clients(config, nango, kite).await
}

/// Same as `build_state`, but with an explicit Nango client (or `None`) -
/// lets tests inject `nango::mock::MockNangoClient` instead of hitting a real
/// deployment. The Kite client is still wired from `config` if configured.
pub async fn build_state_with_nango(
    config: Config,
    nango: Option<Arc<dyn NangoClient>>,
) -> Result<AppState, libsql::Error> {
    let kite = kite_from_config(&config);
    build_state_with_clients(config, nango, kite).await
}

/// Same as `build_state`, but with an explicit Kite client (or `None`) - lets
/// tests inject `kite::mock::MockKiteClient`. The Nango client is still wired
/// from `config` if configured.
pub async fn build_state_with_kite(
    config: Config,
    kite: Option<Arc<dyn KiteClient>>,
) -> Result<AppState, libsql::Error> {
    let nango: Option<Arc<dyn NangoClient>> =
        match (&config.nango_server_url, &config.nango_secret_key) {
            (Some(url), Some(key)) => {
                Some(Arc::new(HttpNangoClient::new(url.clone(), key.clone())))
            }
            _ => None,
        };
    build_state_with_clients(config, nango, kite).await
}

async fn build_state_with_clients(
    config: Config,
    nango: Option<Arc<dyn NangoClient>>,
    kite: Option<Arc<dyn KiteClient>>,
) -> Result<AppState, libsql::Error> {
    let db = db::connect(&config).await?;
    let agents = agents::detect();
    Ok(AppState {
        conn: Arc::new(db.conn),
        database: Arc::new(db.database),
        config,
        agents: Arc::new(agents),
        nango,
        kite,
    })
}
