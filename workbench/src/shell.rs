//! The interactive shell: renders the tiling layout, statusline, command
//! palette, file tree, and fuzzy picker with the Terminal Brutalism theme,
//! and routes key events to chords, modals, or the focused pane (terminal
//! or editor). Pane content lives in the `PaneStore`; everything here is
//! cloneable value-state.

use crate::file_tree::{FileTree, PickerAction, PickerState, TreeAction};
use crate::layout::{Layout, PaneId, SplitDir};
use crate::palette::{CommandId, Keymap, PaletteState};
use crate::pane_store::PaneStore;
use crate::theme::{self, StatuslineState, Theme};
use crossterm::event::{Event, KeyEvent, KeyEventKind};
use ratatui::layout::Rect;
use ratatui::widgets::{Block, Borders, Clear, List, ListItem, Paragraph};
use ratatui::Frame;
use std::collections::HashMap;
use std::path::PathBuf;

/// What the pane should show; the `PaneStore` reconciles toward this.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum PaneDesire {
    Terminal,
    Editor(PathBuf),
}

/// Whole-shell state. Cloned-and-replaced per event (immutable convention).
#[derive(Clone)]
pub struct Shell {
    pub layout: Layout,
    pub palette: PaletteState,
    pub keymap: Keymap,
    pub theme: Theme,
    pub status: StatuslineState,
    pub running: bool,
    pub desires: HashMap<PaneId, PaneDesire>,
    pub tree: Option<FileTree>,
    pub picker: Option<PickerState>,
}

impl Shell {
    pub fn new(theme: Theme, workspace: String) -> Self {
        let cwd = std::env::current_dir()
            .map(|p| p.display().to_string())
            .unwrap_or_else(|_| "?".into());
        Self {
            layout: Layout::new(),
            palette: PaletteState::default(),
            keymap: Keymap::default_bindings(),
            theme,
            status: StatuslineState {
                mode: "SHELL".into(),
                cwd,
                workspace,
                ..Default::default()
            },
            running: true,
            desires: HashMap::new(),
            tree: None,
            picker: None,
        }
    }

    fn cwd_path(&self) -> PathBuf {
        PathBuf::from(&self.status.cwd)
    }

    pub fn focused_desire(&self) -> PaneDesire {
        self.desires
            .get(&self.layout.tab().focused)
            .cloned()
            .unwrap_or(PaneDesire::Terminal)
    }

    fn any_modal_open(&self) -> bool {
        self.palette.open || self.tree.is_some() || self.picker.is_some()
    }

    /// Apply one terminal event, returning the next state.
    pub fn on_event(&self, event: &Event) -> Shell {
        let Event::Key(KeyEvent {
            code,
            modifiers,
            kind,
            ..
        }) = event
        else {
            return self.clone();
        };
        if *kind != KeyEventKind::Press {
            return self.clone();
        }
        if self.palette.open {
            let (palette, invoked) = self.palette.on_key(*code);
            let next = Shell {
                palette,
                ..self.clone()
            };
            return match invoked {
                Some(cmd) => next.run_command(cmd),
                None => next,
            };
        }
        if let Some(tree) = &self.tree {
            let (tree, action) = tree.on_key(*code);
            let mut next = Shell {
                tree: Some(tree),
                ..self.clone()
            };
            match action {
                TreeAction::Close => next.tree = None,
                TreeAction::OpenFile(path) => return next.open_in_focused(path),
                TreeAction::None => {}
            }
            return next;
        }
        if let Some(picker) = &self.picker {
            let (picker, action) = picker.on_key(*code);
            let mut next = Shell {
                picker: Some(picker),
                ..self.clone()
            };
            match action {
                PickerAction::Close => next.picker = None,
                PickerAction::OpenFile(path) => return next.open_in_focused(path),
                PickerAction::None => {}
            }
            return next;
        }
        match self.keymap.lookup(*code, *modifiers) {
            Some(cmd) => self.run_command(cmd),
            None => self.clone(),
        }
    }

    /// Open a file in the focused pane's editor, closing any modal.
    fn open_in_focused(&self, path: PathBuf) -> Shell {
        let mut next = self.clone();
        next.tree = None;
        next.picker = None;
        next.desires
            .insert(self.layout.tab().focused, PaneDesire::Editor(path));
        next
    }

    /// True when a key press belongs to the focused pane (terminal or
    /// editor) rather than a chord or an open modal.
    pub fn forwards_to_pane(&self, event: &Event) -> bool {
        let Event::Key(KeyEvent {
            code,
            modifiers,
            kind,
            ..
        }) = event
        else {
            return false;
        };
        *kind == KeyEventKind::Press
            && !self.any_modal_open()
            && self.keymap.lookup(*code, *modifiers).is_none()
    }

    pub fn run_command(&self, cmd: CommandId) -> Shell {
        let mut next = self.clone();
        match cmd {
            CommandId::SplitHorizontal => {
                next.layout = self.layout.split_focused(SplitDir::Horizontal).0
            }
            CommandId::SplitVertical => {
                next.layout = self.layout.split_focused(SplitDir::Vertical).0
            }
            CommandId::ClosePane => match self.layout.close_focused() {
                Some(layout) => next.layout = layout,
                None => next.running = false,
            },
            CommandId::FocusNext => next.layout = self.layout.focus_next(),
            CommandId::FocusPrev => next.layout = self.layout.focus_prev(),
            CommandId::NewTab => next.layout = self.layout.new_tab().0,
            CommandId::NextTab => next.layout = self.layout.next_tab(),
            CommandId::OpenPalette => next.palette = PaletteState::open(),
            CommandId::ToggleEditor => {
                let focused = self.layout.tab().focused;
                match self.focused_desire() {
                    PaneDesire::Editor(_) => {
                        next.desires.insert(focused, PaneDesire::Terminal);
                    }
                    // No file yet: the picker chooses one, sharing the cwd.
                    PaneDesire::Terminal => {
                        next.picker = Some(PickerState::open(&self.cwd_path()));
                    }
                }
            }
            CommandId::OpenFileTree => next.tree = Some(FileTree::open(&self.cwd_path())),
            CommandId::OpenFilePicker => next.picker = Some(PickerState::open(&self.cwd_path())),
            CommandId::Quit => next.running = false,
        }
        next
    }

    /// The pane rectangles for the active tab, given the full frame area
    /// (bottom line reserved for the statusline).
    pub fn pane_rects(&self, area: Rect) -> Vec<(PaneId, Rect)> {
        if area.height < 2 {
            return Vec::new();
        }
        let body = Rect {
            height: area.height - 1,
            ..area
        };
        self.layout.tab().root.rects(body)
    }

    pub fn draw(&self, frame: &mut Frame, panes: &mut PaneStore) {
        let area = frame.area();
        if area.height < 2 {
            return;
        }
        let body = Rect {
            height: area.height - 1,
            ..area
        };
        let status_row = Rect {
            y: area.y + body.height,
            height: 1,
            ..area
        };

        let tab = self.layout.tab();
        for (pane, rect) in tab.root.rects(body) {
            self.draw_pane(frame, panes, pane, rect, pane == tab.focused);
        }

        let mut status = self.status.clone();
        if let PaneDesire::Editor(_) = self.focused_desire() {
            if let Some(editor) = panes.editor(tab.focused) {
                status.mode = editor.status();
            }
        }
        frame.render_widget(
            Paragraph::new(theme::statusline(&self.theme, &status)),
            status_row,
        );

        if self.palette.open {
            self.draw_palette(frame, area);
        }
        if self.tree.is_some() || self.picker.is_some() {
            self.draw_files_modal(frame, area);
        }
    }

    fn draw_pane(
        &self,
        frame: &mut Frame,
        panes: &mut PaneStore,
        pane: PaneId,
        rect: Rect,
        focused: bool,
    ) {
        let (border_style, border_set) = if focused {
            self.theme.border_focus()
        } else {
            self.theme.border_inactive()
        };
        let desire = self
            .desires
            .get(&pane)
            .cloned()
            .unwrap_or(PaneDesire::Terminal);
        let title = match &desire {
            PaneDesire::Editor(path) => format!(
                " {} ",
                path.file_name()
                    .map(|n| n.to_string_lossy())
                    .unwrap_or_default()
            ),
            PaneDesire::Terminal => format!(" pane {pane} "),
        };
        let block = Block::default()
            .borders(Borders::ALL)
            .border_set(border_set)
            .border_style(border_style)
            .title(title);
        let inner_height = rect.height.saturating_sub(2) as usize;
        let widget = match &desire {
            PaneDesire::Editor(_) => match panes.editor_mut(pane) {
                Some(editor) => Paragraph::new(editor.render_lines(inner_height)).block(block),
                None => Paragraph::new("opening…")
                    .style(self.theme.muted())
                    .block(block),
            },
            PaneDesire::Terminal => match panes.term(pane) {
                Some(term) => Paragraph::new(term.render_lines()).block(block),
                None => Paragraph::new("no shell - ctrl-k for commands")
                    .style(self.theme.muted())
                    .block(block),
            },
        };
        frame.render_widget(widget, rect);
    }

    fn modal_rect(&self, area: Rect) -> Rect {
        let width = (area.width * 6 / 10).clamp(20, 72).min(area.width);
        let height = 16.min(area.height);
        Rect {
            x: area.x + (area.width - width) / 2,
            y: area.y + (area.height - height) / 3,
            width,
            height,
        }
    }

    fn draw_palette(&self, frame: &mut Frame, area: Rect) {
        let modal = self.modal_rect(area);
        let (style, set) = self.theme.border_emphasis();
        let block = Block::default()
            .borders(Borders::ALL)
            .border_set(set)
            .border_style(style)
            .title(format!(" ▸ {} ", self.palette.query));
        let items: Vec<ListItem> = self
            .palette
            .matches()
            .into_iter()
            .enumerate()
            .map(|(i, c)| {
                let style = if i == self.palette.selected {
                    self.theme.active_item()
                } else {
                    self.theme.text()
                };
                ListItem::new(c.title).style(style)
            })
            .collect();
        frame.render_widget(Clear, modal);
        frame.render_widget(List::new(items).block(block), modal);
    }

    fn draw_files_modal(&self, frame: &mut Frame, area: Rect) {
        let modal = self.modal_rect(area);
        let (style, set) = self.theme.border_emphasis();
        let (title, items, selected) = if let Some(tree) = &self.tree {
            let items: Vec<String> = tree
                .rows()
                .iter()
                .map(|r| {
                    let name = r.path.file_name().map(|n| n.to_string_lossy().to_string());
                    let glyph = match (r.is_dir, r.expanded) {
                        (true, true) => "▾ ",
                        (true, false) => "▸ ",
                        _ => "  ",
                    };
                    format!(
                        "{}{glyph}{}",
                        "  ".repeat(r.depth),
                        name.unwrap_or_default()
                    )
                })
                .collect();
            (" files ".to_string(), items, tree.selected)
        } else if let Some(picker) = &self.picker {
            let items = picker.matches().into_iter().map(|(rel, _)| rel).collect();
            (format!(" ▸ {} ", picker.query), items, picker.selected)
        } else {
            return;
        };
        let rows: Vec<ListItem> = items
            .into_iter()
            .enumerate()
            .map(|(i, label)| {
                let style = if i == selected {
                    self.theme.active_item()
                } else {
                    self.theme.text()
                };
                ListItem::new(label).style(style)
            })
            .collect();
        let block = Block::default()
            .borders(Borders::ALL)
            .border_set(set)
            .border_style(style)
            .title(title);
        frame.render_widget(Clear, modal);
        frame.render_widget(List::new(rows).block(block), modal);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::theme::ColorSupport;
    use crossterm::event::{KeyCode, KeyModifiers};

    fn shell() -> Shell {
        Shell::new(Theme::new(ColorSupport::TrueColor), "test-ws".into())
    }

    fn key(code: KeyCode, mods: KeyModifiers) -> Event {
        Event::Key(KeyEvent::new(code, mods))
    }

    #[test]
    fn keybindings_drive_split_focus_and_close() {
        let s = shell().on_event(&key(KeyCode::Char('s'), KeyModifiers::ALT));
        assert_eq!(s.layout.tab().root.panes().len(), 2);
        let s = s.on_event(&key(KeyCode::Char('n'), KeyModifiers::ALT));
        assert_eq!(s.layout.tab().focused, 0);
        let s = s.on_event(&key(KeyCode::Char('x'), KeyModifiers::ALT));
        assert_eq!(s.layout.tab().root.panes().len(), 1);
        assert!(s.running);
    }

    #[test]
    fn closing_the_last_pane_quits() {
        let s = shell().on_event(&key(KeyCode::Char('x'), KeyModifiers::ALT));
        assert!(!s.running);
    }

    #[test]
    fn palette_opens_captures_keys_and_invokes() {
        let s = shell().on_event(&key(KeyCode::Char('k'), KeyModifiers::CONTROL));
        assert!(s.palette.open);
        let s = s.on_event(&key(KeyCode::Char('q'), KeyModifiers::NONE));
        let s = s.on_event(&key(KeyCode::Char('u'), KeyModifiers::NONE));
        assert!(s.running);
        let s = s.on_event(&key(KeyCode::Enter, KeyModifiers::NONE));
        assert!(!s.palette.open);
        assert!(!s.running, "fuzzy 'qu' selects workbench: quit");
    }

    #[test]
    fn picker_opens_a_file_in_the_focused_pane_sharing_cwd() {
        let root = std::env::temp_dir().join(format!("wb_shell_{}", std::process::id()));
        std::fs::create_dir_all(&root).unwrap();
        std::fs::write(root.join("pick_me.rs"), "fn a() {}\n").unwrap();
        let mut s = shell();
        s.status.cwd = root.display().to_string();

        let s = s.on_event(&key(KeyCode::Char('o'), KeyModifiers::CONTROL));
        assert!(s.picker.is_some(), "ctrl-o opens the picker at cwd");
        let s = "pickme".chars().fold(s, |s, c| {
            s.on_event(&key(KeyCode::Char(c), KeyModifiers::NONE))
        });
        let s = s.on_event(&key(KeyCode::Enter, KeyModifiers::NONE));
        assert!(s.picker.is_none());
        let PaneDesire::Editor(path) = s.focused_desire() else {
            panic!("focused pane must become an editor");
        };
        assert!(path.ends_with("pick_me.rs"));

        // Alt-e flips the same pane back to its terminal.
        let s = s.on_event(&key(KeyCode::Char('e'), KeyModifiers::ALT));
        assert_eq!(s.focused_desire(), PaneDesire::Terminal);
        std::fs::remove_dir_all(root).ok();
    }

    #[test]
    fn file_tree_modal_opens_and_closes() {
        let s = shell().on_event(&key(KeyCode::Char('f'), KeyModifiers::ALT));
        assert!(s.tree.is_some());
        assert!(!s.forwards_to_pane(&key(KeyCode::Char('j'), KeyModifiers::NONE)));
        let s = s.on_event(&key(KeyCode::Esc, KeyModifiers::NONE));
        assert!(s.tree.is_none());
    }
}
