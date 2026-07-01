//! Shared, cheaply-cloneable application state handed to every handler.

use crate::agents::DetectedAgent;
use crate::config::Config;
use crate::nango::NangoClient;
use libsql::{Connection, Database};
use std::sync::Arc;

#[derive(Clone)]
pub struct AppState {
    pub conn: Arc<Connection>,
    /// Retained so the embedded-replica's background replicator stays alive for the
    /// process lifetime and so periodic `database.sync()` can be triggered. Held even
    /// in local-only mode (where it is an inert local handle).
    pub database: Arc<Database>,
    pub config: Config,
    /// Agent CLIs detected on PATH at boot (the `/api/llm` engines).
    pub agents: Arc<Vec<DetectedAgent>>,
    /// Self-hosted Nango client. `None` until infra/nango/ is deployed and a
    /// secret key is configured - connection routes surface NotImplemented
    /// rather than pretending to work (docs/MANUAL-SETUP.md #47-55).
    pub nango: Option<Arc<dyn NangoClient>>,
}

impl AppState {
    /// The default agent id (first detected in preference order), if any.
    pub fn default_agent(&self) -> Option<String> {
        self.agents.first().map(|a| a.id.clone())
    }
}
