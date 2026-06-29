//! Planned routes the frontend declares but whose services aren't built in the
//! base. Honest behavior, never a silent mock:
//!   - ingest / pipeline.run  -> enqueue a real job, return 202 + job_id
//!   - vcs.* / broker.*        -> 501 Not Implemented
//!
//! As `lifeos-ingest` / `lifeos-pipelines` / `lifeos-vcs` come online in later
//! phases, these enqueue paths already feed them via the job queue.

use crate::auth::resolve_workspace;
use crate::db::workspace_exists;
use crate::error::{ApiError, ApiResult};
use crate::state::AppState;
use axum::{extract::State, http::HeaderMap, http::StatusCode, Json};
use serde::Deserialize;
use serde_json::{json, Value};

#[derive(Deserialize)]
pub struct IngestRequest {
    uri: Option<String>,
    kind: Option<String>,
    blob_ref: Option<String>,
    workspace_id: Option<String>,
}

pub async fn ingest(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(req): Json<IngestRequest>,
) -> ApiResult<(StatusCode, Json<Value>)> {
    let workspace_id =
        resolve_workspace(&headers, &state.config.jwt_secret, req.workspace_id.as_deref());
    if !workspace_exists(&state.conn, &workspace_id).await? {
        return Err(ApiError::BadRequest(format!("unknown workspace '{workspace_id}'")));
    }
    let payload = json!({ "uri": req.uri, "kind": req.kind, "blob_ref": req.blob_ref });
    let job_id = super::job::enqueue(&state, &workspace_id, "ingest", &payload, 0).await?;
    Ok((StatusCode::ACCEPTED, Json(json!({ "status": "queued", "job_id": job_id }))))
}

#[derive(Deserialize)]
pub struct PipelineRequest {
    pipeline: String,
    #[serde(default)]
    input: Value,
    workspace_id: Option<String>,
}

pub async fn pipeline_run(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(req): Json<PipelineRequest>,
) -> ApiResult<(StatusCode, Json<Value>)> {
    if req.pipeline.trim().is_empty() {
        return Err(ApiError::BadRequest("pipeline is required".into()));
    }
    let workspace_id =
        resolve_workspace(&headers, &state.config.jwt_secret, req.workspace_id.as_deref());
    if !workspace_exists(&state.conn, &workspace_id).await? {
        return Err(ApiError::BadRequest(format!("unknown workspace '{workspace_id}'")));
    }
    let payload = json!({ "pipeline": req.pipeline, "input": req.input });
    let job_id = super::job::enqueue(&state, &workspace_id, "pipeline", &payload, 0).await?;
    Ok((StatusCode::ACCEPTED, Json(json!({ "status": "queued", "job_id": job_id }))))
}

/// 501 for routes whose service genuinely isn't built in the base.
pub async fn not_implemented() -> ApiError {
    ApiError::NotImplemented("not implemented in the base - planned for a later phase".into())
}
