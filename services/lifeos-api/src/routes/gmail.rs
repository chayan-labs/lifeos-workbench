//! Gmail thin proxy tool (issue #53, docs/INTEGRATIONS.md). `list` reads
//! straight through Nango's proxy; `send` only ever drafts (docs/SECURITY.md
//! §2) - this file has no code path that calls Gmail's send API.

use crate::auth::resolve_workspace;
use crate::error::ApiError;
use crate::error::ApiResult;
use crate::integrations::{draft_action, proxy_call};
use crate::models::Entity;
use crate::state::AppState;
use axum::{
    extract::{Query, State},
    http::HeaderMap,
    Json,
};
use serde::Deserialize;
use serde_json::{json, Value};

const PROVIDER: &str = "google-mail";

#[derive(Deserialize)]
pub struct ListParams {
    workspace_id: Option<String>,
    #[serde(default)]
    q: Option<String>,
}

/// `GET /api/gmail/list` - free read: proxies to Gmail's `messages.list`.
pub async fn list(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(params): Query<ListParams>,
) -> ApiResult<Json<Value>> {
    let workspace_id = resolve_workspace(&headers, &state.config.jwt_secret, params.workspace_id.as_deref());
    let mut query = Vec::new();
    if let Some(q) = &params.q {
        query.push(("q", q.as_str()));
    }
    let body = proxy_call(&state, &workspace_id, PROVIDER, "GET", "gmail/v1/users/me/messages", &query, None).await?;
    Ok(Json(body))
}

#[derive(Deserialize)]
pub struct SendGmail {
    to: String,
    subject: String,
    #[serde(default)]
    body: String,
    workspace_id: Option<String>,
}

/// `POST /api/gmail/send` - gated (docs/SECURITY.md §2): only creates a
/// draft entity, never calls Gmail.
pub async fn send(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(req): Json<SendGmail>,
) -> ApiResult<Json<Entity>> {
    if req.to.trim().is_empty() || req.subject.trim().is_empty() {
        return Err(ApiError::BadRequest("to and subject are required".into()));
    }
    let workspace_id = resolve_workspace(&headers, &state.config.jwt_secret, req.workspace_id.as_deref());
    let attrs = json!({ "to": req.to, "subject": req.subject, "body": req.body });
    let entity = draft_action(&state, &workspace_id, "gmail", "send", attrs).await?;
    Ok(Json(entity))
}
