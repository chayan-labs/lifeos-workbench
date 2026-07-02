//! The interactive shell: renders the tiling layout, statusline, and command
//! palette with the Terminal Brutalism theme, and routes key events through
//! the keybinding layer / palette. Pane *content* is a placeholder until the
//! terminal (issue #4) and editor (issue #7) panes land - the shell chrome
//! (split/close/focus/tabs/palette) is fully live.

use crate::layout::{Layout, SplitDir};
use crate::palette::{CommandId, Keymap, PaletteState};
use crate::pane_store::PaneStore;
use crate::theme::{self, StatuslineState, Theme};
use crossterm::event::{Event, KeyEvent, KeyEventKind};
use ratatui::layout::Rect;
use ratatui::widgets::{Block, Borders, Clear, List, ListItem, Paragraph};
use ratatui::Frame;

/// Whole-shell state. Cloned-and-replaced per event (immutable convention).
#[derive(Clone)]
pub struct Shell {
    pub layout: Layout,
    pub palette: PaletteState,
    pub keymap: Keymap,
    pub theme: Theme,
    pub status: StatuslineState,
    pub running: bool,
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
        }
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
        match self.keymap.lookup(*code, *modifiers) {
            Some(cmd) => self.run_command(cmd),
            None => self.clone(),
        }
    }

    /// True when a key press is neither a chord nor palette input, so it
    /// belongs to the focused terminal pane.
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
            && !self.palette.open
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
            CommandId::Quit => next.running = false,
        }
        next
    }

    /// The pane rectangles for the active tab, given the full frame area
    /// (bottom line reserved for the statusline).
    pub fn pane_rects(&self, area: Rect) -> Vec<(crate::layout::PaneId, Rect)> {
        if area.height < 2 {
            return Vec::new();
        }
        let body = Rect {
            height: area.height - 1,
            ..area
        };
        self.layout.tab().root.rects(body)
    }

    pub fn draw(&self, frame: &mut Frame, panes: &PaneStore) {
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
            let focused = pane == tab.focused;
            let (border_style, border_set) = if focused {
                self.theme.border_focus()
            } else {
                self.theme.border_inactive()
            };
            let block = Block::default()
                .borders(Borders::ALL)
                .border_set(border_set)
                .border_style(border_style)
                .title(format!(" pane {pane} "));
            let widget = match panes.get(pane) {
                Some(term) => Paragraph::new(term.render_lines()).block(block),
                None => Paragraph::new("no shell - ctrl-k for commands")
                    .style(self.theme.muted())
                    .block(block),
            };
            frame.render_widget(widget, rect);
        }

        frame.render_widget(
            Paragraph::new(theme::statusline(&self.theme, &self.status)),
            status_row,
        );

        if self.palette.open {
            self.draw_palette(frame, area);
        }
    }

    fn draw_palette(&self, frame: &mut Frame, area: Rect) {
        let width = (area.width * 6 / 10).clamp(20, 72).min(area.width);
        let height = 12.min(area.height);
        let modal = Rect {
            x: area.x + (area.width - width) / 2,
            y: area.y + (area.height - height) / 3,
            width,
            height,
        };
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
        // While open, plain chars go to the query, not the keymap.
        let s = s.on_event(&key(KeyCode::Char('q'), KeyModifiers::NONE));
        let s = s.on_event(&key(KeyCode::Char('u'), KeyModifiers::NONE));
        assert!(s.running);
        let s = s.on_event(&key(KeyCode::Enter, KeyModifiers::NONE));
        assert!(!s.palette.open);
        assert!(!s.running, "fuzzy 'qu' selects workbench: quit");
    }
}
