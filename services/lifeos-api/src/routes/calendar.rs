//! Google Calendar thin proxy tool (issue #53, docs/INTEGRATIONS.md). `list`
//! reads straight through Nango's proxy; `create` only ever drafts
//! (docs/SECURITY.md §2) - this file has no code path that calls Calendar's
//! insert API.

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

const PROVIDER: &str = "google-calendar";

#[derive(Deserialize)]
pub struct ListParams {
    workspace_id: Option<String>,
}

/// `GET /api/calendar/list` - free read: proxies to `events.list` on the
/// primary calendar.
pub async fn list(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(params): Query<ListParams>,
) -> ApiResult<Json<Value>> {
    let workspace_id = resolve_workspace(&headers, &state.config.jwt_secret, params.workspace_id.as_deref());
    let body =
        proxy_call(&state, &workspace_id, PROVIDER, "GET", "calendar/v3/calendars/primary/events", &[], None).await?;
    Ok(Json(body))
}

#[derive(Deserialize)]
pub struct CreateEvent {
    summary: String,
    start: String,
    end: String,
    workspace_id: Option<String>,
}

/// `POST /api/calendar/create` - gated (docs/SECURITY.md §2): only creates a
/// draft entity, never calls Calendar.
pub async fn create(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(req): Json<CreateEvent>,
) -> ApiResult<Json<Entity>> {
    if req.summary.trim().is_empty() || req.start.trim().is_empty() || req.end.trim().is_empty() {
        return Err(ApiError::BadRequest("summary, start, and end are required".into()));
    }
    let workspace_id = resolve_workspace(&headers, &state.config.jwt_secret, req.workspace_id.as_deref());
    let attrs = json!({ "summary": req.summary, "start": req.start, "end": req.end });
    let entity = draft_action(&state, &workspace_id, "calendar", "create", attrs).await?;
    Ok(Json(entity))
}
