//! Shared, cheaply-cloneable application state handed to every handler.

use crate::agents::DetectedAgent;
use crate::config::Config;
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
}

impl AppState {
    /// The default agent id (first detected in preference order), if any.
    pub fn default_agent(&self) -> Option<String> {
        self.agents.first().map(|a| a.id.clone())
    }
}
