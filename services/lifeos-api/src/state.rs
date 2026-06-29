//! Shared, cheaply-cloneable application state handed to every handler.

use crate::agents::DetectedAgent;
use crate::config::Config;
use libsql::Connection;
use std::sync::Arc;

#[derive(Clone)]
pub struct AppState {
    pub conn: Arc<Connection>,
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
