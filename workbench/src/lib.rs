//! Library surface of the Workbench so integration tests (and later panes)
//! can use the in-process API handle and shell components directly.

pub mod api;
pub mod layout;
pub mod manifest;
pub mod markdown;
pub mod palette;
pub mod pane_store;
pub mod shell;
pub mod term_pane;
pub mod theme;
pub mod views;
