//! Workbench entry point: opens the in-process `lifeos-api` state (no
//! socket), then runs the TUI shell - tiling panes, command palette, and the
//! Terminal Brutalism statusline. `workbench --check` skips the TUI and just
//! proves the in-process linkage (used by CI/scripts).

use crossterm::event;
use lifeos_api::config::{Config, DEFAULT_WORKSPACE};
use lifeos_workbench::api::InProcessApi;
use lifeos_workbench::shell::Shell;
use lifeos_workbench::theme::{ColorSupport, Theme};
use std::time::Duration;

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
    if !health.is_success() {
        eprintln!(
            "workbench: in-process health check failed: {}",
            health.status
        );
        std::process::exit(1);
    }
    if std::env::args().any(|a| a == "--check") {
        println!(
            "workbench {}: lifeos-api linked in-process, health OK",
            env!("CARGO_PKG_VERSION")
        );
        return;
    }
    if let Err(e) = run_shell() {
        eprintln!("workbench: shell error: {e}");
        std::process::exit(1);
    }
}

fn run_shell() -> std::io::Result<()> {
    let mut terminal = ratatui::init();
    let theme = Theme::new(ColorSupport::detect());
    let mut shell = Shell::new(theme, DEFAULT_WORKSPACE.to_string());
    let result = (|| -> std::io::Result<()> {
        while shell.running {
            terminal.draw(|frame| shell.draw(frame))?;
            if event::poll(Duration::from_millis(100))? {
                let ev = event::read()?;
                shell = shell.on_event(&ev);
            }
        }
        Ok(())
    })();
    ratatui::restore();
    result
}
