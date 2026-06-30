//! status / metrics / file / config commands.

use crate::cli::{ConfigCmd, FileCmd};
use crate::client::{CliError, Client};
use crate::config::CliConfig;
use crate::output::Output;
use reqwest::Method;
use serde_json::{json, Value};

pub async fn status(client: &Client, out: Output) -> Result<(), CliError> {
    match client.request(Method::GET, "/api/health", &[], None).await {
        Ok(v) => {
            let ws = v.get("workspace_id").and_then(Value::as_str).unwrap_or("?");
            out.ok(&format!("lifeos-api: ONLINE (workspace {ws})"), &v);
            Ok(())
        }
        Err(CliError::Connection(_)) => {
            out.ok(
                "lifeos-api: OFFLINE",
                &json!({ "status": "offline", "api": false }),
            );
            Ok(())
        }
        Err(e) => Err(e),
    }
}

pub async fn metrics(client: &Client, out: Output) -> Result<(), CliError> {
    let v = client.request(Method::GET, "/api/metrics", &[], None).await?;
    out.ok("metrics", &v);
    Ok(())
}

/// `file` maps to the lifeos-vcs HTTP surface. Those endpoints are 501 until
/// the VCS service lands (issues #81-#87); the CLI surfaces that honestly
/// rather than pretending. Still allow-listed: history (read) + commit (write).
pub async fn file(client: &Client, out: Output, cmd: FileCmd) -> Result<(), CliError> {
    match cmd {
        FileCmd::History { entity_id } => {
            let q = vec![("entity_id", entity_id.unwrap_or_default())];
            let v = client.request(Method::GET, "/api/vcs/history", &q, None).await?;
            out.ok("history", &v);
        }
        FileCmd::Commit {
            path,
            message,
            entity_id,
        } => {
            let mut body = serde_json::Map::new();
            body.insert("path".into(), Value::String(path));
            if let Some(m) = message {
                body.insert("message".into(), Value::String(m));
            }
            if let Some(e) = entity_id {
                body.insert("entity_id".into(), Value::String(e));
            }
            let v = client
                .request(Method::POST, "/api/vcs/commit", &[], Some(Value::Object(body)))
                .await?;
            out.ok("committed", &v);
        }
    }
    Ok(())
}

const KNOWN_KEYS: [&str; 3] = ["api_url", "token", "workspace"];

pub fn config(out: Output, cmd: ConfigCmd) -> Result<(), CliError> {
    match cmd {
        ConfigCmd::Path => {
            out.ok("", &json!({ "path": CliConfig::path().display().to_string() }));
        }
        ConfigCmd::List => {
            let cfg = CliConfig::load();
            // Mask the token so `config list` is safe to paste into a log.
            let masked = cfg.token.as_ref().map(|t| mask(t));
            out.ok(
                "",
                &json!({
                    "api_url": cfg.api_url,
                    "token": masked,
                    "workspace": cfg.workspace,
                }),
            );
        }
        ConfigCmd::Get { key } => {
            ensure_known(&key)?;
            let cfg = CliConfig::load();
            out.ok("", &json!({ &key: cfg.get(&key) }));
        }
        ConfigCmd::Set { key, value } => {
            ensure_known(&key)?;
            let mut cfg = CliConfig::load();
            cfg.set(&key, value);
            cfg.save().map_err(|e| CliError::Local(format!("could not write config: {e}")))?;
            out.ok(&format!("set {key}"), &json!({ "ok": true }));
        }
    }
    Ok(())
}

fn ensure_known(key: &str) -> Result<(), CliError> {
    if KNOWN_KEYS.contains(&key) {
        Ok(())
    } else {
        Err(CliError::Local(format!(
            "unknown config key '{key}' (known: {})",
            KNOWN_KEYS.join(", ")
        )))
    }
}

fn mask(token: &str) -> String {
    if token.len() <= 8 {
        "****".into()
    } else {
        format!("{}…{}", &token[..4], &token[token.len() - 4..])
    }
}
