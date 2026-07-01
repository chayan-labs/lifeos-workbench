//! Notion thin proxy tool (issue #53, docs/INTEGRATIONS.md). `list` reads
//! straight through Nango's proxy; `create` only ever drafts
//! (docs/SECURITY.md §2) - this file has no code path that calls Notion's
//! page-create API. Two-way sync (#59) is separate, later work.

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

const PROVIDER: &str = "notion";

#[derive(Deserialize)]
pub struct ListParams {
    workspace_id: Option<String>,
}

/// `GET /api/notion/list` - free read: proxies to Notion's `/v1/search`
/// (Notion models "list everything" as a search with an empty query).
pub async fn list(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(params): Query<ListParams>,
) -> ApiResult<Json<Value>> {
    let workspace_id = resolve_workspace(&headers, &state.config.jwt_secret, params.workspace_id.as_deref());
    let body = proxy_call(&state, &workspace_id, PROVIDER, "POST", "v1/search", &[], Some(json!({}))).await?;
    Ok(Json(body))
}

#[derive(Deserialize)]
pub struct CreatePage {
    parent_id: String,
    title: String,
    workspace_id: Option<String>,
}

/// `POST /api/notion/create` - gated (docs/SECURITY.md §2): only creates a
/// draft entity, never calls Notion.
pub async fn create(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(req): Json<CreatePage>,
) -> ApiResult<Json<Entity>> {
    if req.parent_id.trim().is_empty() || req.title.trim().is_empty() {
        return Err(ApiError::BadRequest("parent_id and title are required".into()));
    }
    let workspace_id = resolve_workspace(&headers, &state.config.jwt_secret, req.workspace_id.as_deref());
    let attrs = json!({ "parent_id": req.parent_id, "title": req.title });
    let entity = draft_action(&state, &workspace_id, "notion", "create", attrs).await?;
    Ok(Json(entity))
}
