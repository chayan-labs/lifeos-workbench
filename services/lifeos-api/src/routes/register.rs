//! `POST /api/register` - create a tenant. Persists a workspace, a user, and the
//! membership joining them, then returns `{ workspace_id, key_token }` (the
//! frontend reads exactly those two fields).
//!
//! Idempotent on email: re-registering an existing email re-issues a token for
//! that user's workspace instead of failing on the UNIQUE(email) constraint.

use crate::auth::issue_token;
use crate::error::{ApiError, ApiResult};
use crate::ids::{new_id, now_secs};
use crate::state::AppState;
use axum::{extract::State, Json};
use serde::Deserialize;
use serde_json::{json, Value};

#[derive(Deserialize)]
pub struct RegisterRequest {
    email: String,
    name: String,
    workspace_name: String,
}

pub async fn register(
    State(state): State<AppState>,
    Json(req): Json<RegisterRequest>,
) -> ApiResult<Json<Value>> {
    let email = req.email.trim();
    if email.is_empty() || req.name.trim().is_empty() || req.workspace_name.trim().is_empty() {
        return Err(ApiError::BadRequest(
            "email, name and workspace_name are required".into(),
        ));
    }

    // Already registered? Re-issue a token for their existing workspace.
    if let Some((user_id, workspace_id)) = lookup_existing(&state, email).await? {
        let key_token = issue_token(&state.config.jwt_secret, &user_id, &workspace_id, email);
        return Ok(Json(json!({
            "user_id": user_id,
            "workspace_id": workspace_id,
            "key_token": key_token,
            "status": "existing",
        })));
    }

    let now = now_secs();
    let user_id = new_id("usr");
    let workspace_id = new_id("ws");
    let membership_id = new_id("memb");

    state
        .conn
        .execute(
            "INSERT INTO workspaces (id, name, plan, limits, created_at, updated_at) \
             VALUES (?1, ?2, 'free', '{}', ?3, ?4)",
            libsql::params![workspace_id.clone(), req.workspace_name, now, now],
        )
        .await?;
    state
        .conn
        .execute(
            "INSERT INTO users (id, email, name, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5)",
            libsql::params![user_id.clone(), email, req.name, now, now],
        )
        .await?;
    state
        .conn
        .execute(
            "INSERT INTO memberships (id, user_id, workspace_id, role, created_at, updated_at) \
             VALUES (?1, ?2, ?3, 'owner', ?4, ?5)",
            libsql::params![membership_id, user_id.clone(), workspace_id.clone(), now, now],
        )
        .await?;

    let key_token = issue_token(&state.config.jwt_secret, &user_id, &workspace_id, email);
    tracing::info!(%user_id, %workspace_id, "registered new tenant");

    Ok(Json(json!({
        "user_id": user_id,
        "workspace_id": workspace_id,
        "key_token": key_token,
        "status": "registered",
    })))
}

/// Returns `(user_id, workspace_id)` for an existing email, if any.
async fn lookup_existing(state: &AppState, email: &str) -> ApiResult<Option<(String, String)>> {
    let mut rows = state
        .conn
        .query(
            "SELECT u.id, m.workspace_id FROM users u \
             JOIN memberships m ON m.user_id = u.id \
             WHERE u.email = ?1 ORDER BY m.created_at ASC LIMIT 1",
            libsql::params![email],
        )
        .await?;
    match rows.next().await? {
        Some(row) => Ok(Some((row.get(0)?, row.get(1)?))),
        None => Ok(None),
    }
}
