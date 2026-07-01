//! Google Drive thin proxy tool (issue #53, docs/INTEGRATIONS.md). `list`
//! reads straight through Nango's proxy; `upload` only ever drafts
//! (docs/SECURITY.md §2) - this file has no code path that calls Drive's
//! upload API.

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

const PROVIDER: &str = "google-drive";

#[derive(Deserialize)]
pub struct ListParams {
    workspace_id: Option<String>,
}

/// `GET /api/drive/list` - free read: proxies to `files.list`.
pub async fn list(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(params): Query<ListParams>,
) -> ApiResult<Json<Value>> {
    let workspace_id = resolve_workspace(&headers, &state.config.jwt_secret, params.workspace_id.as_deref());
    let body = proxy_call(&state, &workspace_id, PROVIDER, "GET", "drive/v3/files", &[], None).await?;
    Ok(Json(body))
}

#[derive(Deserialize)]
pub struct UploadFile {
    name: String,
    /// Where the file bytes actually live (e.g. a `lifeos-vcs` blob ref) -
    /// this route only drafts the intent, it never reads or sends bytes.
    source_ref: String,
    workspace_id: Option<String>,
}

/// `POST /api/drive/upload` - gated (docs/SECURITY.md §2): only creates a
/// draft entity, never calls Drive.
pub async fn upload(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(req): Json<UploadFile>,
) -> ApiResult<Json<Entity>> {
    if req.name.trim().is_empty() || req.source_ref.trim().is_empty() {
        return Err(ApiError::BadRequest("name and source_ref are required".into()));
    }
    let workspace_id = resolve_workspace(&headers, &state.config.jwt_secret, req.workspace_id.as_deref());
    let attrs = json!({ "name": req.name, "source_ref": req.source_ref });
    let entity = draft_action(&state, &workspace_id, "drive", "upload", attrs).await?;
    Ok(Json(entity))
}
