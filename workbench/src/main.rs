//! Workbench entry point. For now (build-order phase 1) it proves the
//! in-process linkage: builds the shared `lifeos-api` state from env config,
//! hits `/api/health` with no socket, and reports readiness. The TUI shell
//! (pane manager / terminal / editor) lands in later phases on top of this
//! same `InProcessApi` handle.

use lifeos_api::config::Config;
use lifeos_workbench::api::InProcessApi;

#[tokio::main]
async fn main() {
    let config = Config::from_env();
    let api = match InProcessApi::new(config).await {
        Ok(api) => api,
        Err(e) => {
            eprintln!("workbench: failed to open Life OS state: {e}");
            std::process::exit(1);
        }
    };
    let health = api.get("/api/health", None).await;
    if health.is_success() {
        println!(
            "workbench {}: lifeos-api linked in-process, health OK",
            env!("CARGO_PKG_VERSION")
        );
    } else {
        eprintln!(
            "workbench: in-process health check failed: {}",
            health.status
        );
        std::process::exit(1);
    }
}
