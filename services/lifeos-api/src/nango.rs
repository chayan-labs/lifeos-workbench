//! Thin client for the self-hosted Nango OAuth vault (infra/nango/,
//! docs/INTEGRATIONS.md). This is the only place lifeos-api holds Nango's
//! secret key; every route talks to Nango through this module and only ever
//! passes a `connectionId` back to the caller - never a token
//! (docs/SECURITY.md §1).

use crate::error::{ApiError, ApiResult};
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use serde_json::json;

#[derive(Debug, Clone, Serialize)]
pub struct EndUser {
    pub id: String,
    pub email: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ConnectSession {
    pub token: String,
}

/// Connection metadata only. Deliberately has no field for the underlying
/// provider token - Nango's proxy injects it server-side, it never reaches
/// this struct.
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct NangoConnection {
    pub connection_id: String,
    pub provider_config_key: String,
}

#[async_trait]
pub trait NangoClient: Send + Sync {
    async fn create_connect_session(
        &self,
        end_user: EndUser,
        allowed_integrations: Vec<String>,
    ) -> ApiResult<ConnectSession>;

    async fn get_connection(&self, connection_id: &str, provider_config_key: &str) -> ApiResult<NangoConnection>;

    async fn delete_connection(&self, connection_id: &str, provider_config_key: &str) -> ApiResult<()>;
}

/// Real implementation, calling the self-hosted Nango REST API.
pub struct HttpNangoClient {
    base_url: String,
    secret_key: String,
    http: reqwest::Client,
}

impl HttpNangoClient {
    pub fn new(base_url: String, secret_key: String) -> Self {
        Self { base_url, secret_key, http: reqwest::Client::new() }
    }
}

#[async_trait]
impl NangoClient for HttpNangoClient {
    async fn create_connect_session(
        &self,
        end_user: EndUser,
        allowed_integrations: Vec<String>,
    ) -> ApiResult<ConnectSession> {
        let resp = self
            .http
            .post(format!("{}/connect/sessions", self.base_url))
            .bearer_auth(&self.secret_key)
            .json(&json!({ "end_user": end_user, "allowed_integrations": allowed_integrations }))
            .send()
            .await
            .map_err(nango_unreachable)?;
        decode_ok(resp, "create_connect_session").await
    }

    async fn get_connection(&self, connection_id: &str, provider_config_key: &str) -> ApiResult<NangoConnection> {
        let resp = self
            .http
            .get(format!("{}/connections/{connection_id}", self.base_url))
            .query(&[("provider_config_key", provider_config_key)])
            .bearer_auth(&self.secret_key)
            .send()
            .await
            .map_err(nango_unreachable)?;
        if resp.status() == reqwest::StatusCode::NOT_FOUND {
            return Err(ApiError::NotFound("nango connection not found".into()));
        }
        decode_ok(resp, "get_connection").await
    }

    async fn delete_connection(&self, connection_id: &str, provider_config_key: &str) -> ApiResult<()> {
        let resp = self
            .http
            .delete(format!("{}/connections/{connection_id}", self.base_url))
            .query(&[("provider_config_key", provider_config_key)])
            .bearer_auth(&self.secret_key)
            .send()
            .await
            .map_err(nango_unreachable)?;
        if resp.status().is_success() || resp.status() == reqwest::StatusCode::NOT_FOUND {
            Ok(())
        } else {
            tracing::error!("nango delete_connection returned {}", resp.status());
            Err(ApiError::Upstream("nango rejected delete_connection".into()))
        }
    }
}

fn nango_unreachable(e: reqwest::Error) -> ApiError {
    tracing::error!("nango request failed: {e}");
    ApiError::Upstream("nango unreachable".into())
}

async fn decode_ok<T: serde::de::DeserializeOwned>(resp: reqwest::Response, op: &str) -> ApiResult<T> {
    if !resp.status().is_success() {
        tracing::error!("nango {op} returned {}", resp.status());
        return Err(ApiError::Upstream(format!("nango rejected {op}")));
    }
    resp.json().await.map_err(|e| {
        tracing::error!("nango {op} response decode failed: {e}");
        ApiError::Upstream("malformed nango response".into())
    })
}

/// In-memory fake used by tests so the HTTP surface can be exercised without
/// a real Nango deployment. Exposed unconditionally (not `#[cfg(test)]`) so
/// the `tests/` integration crate can construct one too.
pub mod mock {
    use super::*;
    use std::sync::Mutex;

    pub struct MockNangoClient {
        connections: Mutex<std::collections::HashMap<String, NangoConnection>>,
    }

    impl MockNangoClient {
        pub fn new() -> Self {
            Self { connections: Mutex::new(std::collections::HashMap::new()) }
        }

        /// Seed a connection as if a real OAuth flow had already completed.
        pub fn seed(&self, connection_id: &str, provider_config_key: &str) {
            self.connections.lock().unwrap().insert(
                connection_id.to_string(),
                NangoConnection {
                    connection_id: connection_id.to_string(),
                    provider_config_key: provider_config_key.to_string(),
                },
            );
        }
    }

    impl Default for MockNangoClient {
        fn default() -> Self {
            Self::new()
        }
    }

    #[async_trait]
    impl NangoClient for MockNangoClient {
        async fn create_connect_session(
            &self,
            _end_user: EndUser,
            _allowed_integrations: Vec<String>,
        ) -> ApiResult<ConnectSession> {
            Ok(ConnectSession { token: "mock-session-token".into() })
        }

        async fn get_connection(&self, connection_id: &str, provider_config_key: &str) -> ApiResult<NangoConnection> {
            self.connections
                .lock()
                .unwrap()
                .get(connection_id)
                .filter(|c| c.provider_config_key == provider_config_key)
                .cloned()
                .ok_or_else(|| ApiError::NotFound("nango connection not found".into()))
        }

        async fn delete_connection(&self, connection_id: &str, _provider_config_key: &str) -> ApiResult<()> {
            self.connections.lock().unwrap().remove(connection_id);
            Ok(())
        }
    }
}
