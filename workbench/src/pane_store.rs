//! Owns the live `TermPane` processes behind the layout tree. The layout is
//! immutable value-state; the pty children are real OS resources, so they
//! live here and are reconciled against the layout every frame: new pane ids
//! get a shell spawned, closed ids are dropped (killing the pty), and sizes
//! follow the computed rects.

use crate::layout::PaneId;
use crate::term_pane::TermPane;
use ratatui::layout::Rect;
use std::collections::HashMap;

#[derive(Default)]
pub struct PaneStore {
    panes: HashMap<PaneId, Entry>,
}

struct Entry {
    term: Option<TermPane>,
    size: (u16, u16),
}

/// A pane's drawable interior (inside its border).
fn inner(rect: Rect) -> (u16, u16) {
    (
        rect.width.saturating_sub(2).max(1),
        rect.height.saturating_sub(2).max(1),
    )
}

impl PaneStore {
    /// Reconcile the store with the current layout: spawn/resize/reap.
    pub fn sync(&mut self, rects: &[(PaneId, Rect)]) {
        let live: Vec<PaneId> = rects.iter().map(|(id, _)| *id).collect();
        self.panes.retain(|id, _| live.contains(id));
        for (id, rect) in rects {
            let (cols, rows) = inner(*rect);
            match self.panes.get_mut(id) {
                Some(entry) => {
                    if entry.size != (cols, rows) {
                        entry.size = (cols, rows);
                        if let Some(term) = entry.term.as_mut() {
                            term.resize(cols, rows);
                        }
                    }
                }
                None => {
                    let term = TermPane::spawn(None, cols, rows).ok();
                    self.panes.insert(
                        *id,
                        Entry {
                            term,
                            size: (cols, rows),
                        },
                    );
                }
            }
        }
    }

    pub fn get_mut(&mut self, id: PaneId) -> Option<&mut TermPane> {
        self.panes.get_mut(&id).and_then(|e| e.term.as_mut())
    }

    pub fn get(&self, id: PaneId) -> Option<&TermPane> {
        self.panes.get(&id).and_then(|e| e.term.as_ref())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sync_spawns_reaps_and_resizes() {
        let mut store = PaneStore::default();
        let r = |x, w, h| (x as PaneId, Rect::new(0, 0, w, h));
        store.sync(&[r(0, 40, 20)]);
        assert!(store.get(0).is_some());

        store.sync(&[r(0, 40, 20), r(1, 40, 20)]);
        assert!(store.get(1).is_some());

        // Pane 0 closed: reaped. Pane 1 resized without respawn.
        store.sync(&[r(1, 60, 12)]);
        assert!(store.get(0).is_none());
        assert_eq!(store.get(1).unwrap().render_lines().len(), 10);
    }
}
