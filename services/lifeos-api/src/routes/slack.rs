//! Slack thin proxy tool (issue #53, docs/INTEGRATIONS.md). `list` reads
//! straight through Nango's proxy; `post` only ever drafts (docs/SECURITY.md
//! §2) - this file has no code path that calls Slack's `chat.postMessage`.

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

const PROVIDER: &str = "slack";

#[derive(Deserialize)]
pub struct ListParams {
    workspace_id: Option<String>,
}

/// `GET /api/slack/list` - free read: proxies to `conversations.list`.
pub async fn list(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(params): Query<ListParams>,
) -> ApiResult<Json<Value>> {
    let workspace_id = resolve_workspace(&headers, &state.config.jwt_secret, params.workspace_id.as_deref());
    let body = proxy_call(&state, &workspace_id, PROVIDER, "GET", "conversations.list", &[], None).await?;
    Ok(Json(body))
}

#[derive(Deserialize)]
pub struct PostMessage {
    channel: String,
    text: String,
    workspace_id: Option<String>,
}

/// `POST /api/slack/post` - gated (docs/SECURITY.md §2): only creates a
/// draft entity, never calls Slack.
pub async fn post(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(req): Json<PostMessage>,
) -> ApiResult<Json<Entity>> {
    if req.channel.trim().is_empty() || req.text.trim().is_empty() {
        return Err(ApiError::BadRequest("channel and text are required".into()));
    }
    let workspace_id = resolve_workspace(&headers, &state.config.jwt_secret, req.workspace_id.as_deref());
    let attrs = json!({ "channel": req.channel, "text": req.text });
    let entity = draft_action(&state, &workspace_id, "slack", "post", attrs).await?;
    Ok(Json(entity))
}
