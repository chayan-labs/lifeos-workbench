//! Standalone window host: a winit window painted by a wgpu glyph-grid
//! renderer (`ratatui-wgpu`) implementing ratatui's `Backend`, so the whole
//! shell - panes, editor, terminals, agent, Life OS views - runs unmodified.
//! This is the primary face of the app; `--tui` keeps the crossterm path.

pub mod fonts;
pub mod input;

use std::num::NonZeroU32;
use std::sync::Arc;
use std::time::{Duration, Instant};

use ratatui::Terminal;
use ratatui_wgpu::{Builder, Dimensions, WgpuBackend};
use winit::application::ApplicationHandler;
use winit::event::{ElementState, WindowEvent};
use winit::event_loop::{ActiveEventLoop, ControlFlow, EventLoop};
use winit::keyboard::ModifiersState;
use winit::window::{Window, WindowAttributes};

use crate::api::InProcessApi;
use crate::driver;
use crate::pane_store::PaneStore;
use crate::shell::Shell;
use crate::theme::{ColorSupport, Theme, BG};

/// Frame cadence while idle: terminal panes produce output asynchronously,
/// so redraw on a short tick (mirrors the 50ms poll of the TUI loop).
const IDLE_FRAME: Duration = Duration::from_millis(50);
const DEFAULT_FONT_PT: f64 = 13.0;

pub fn run_gui(api: InProcessApi, workspace: String) -> Result<(), String> {
    let event_loop = EventLoop::new().map_err(|e| e.to_string())?;
    event_loop.set_control_flow(ControlFlow::WaitUntil(Instant::now() + IDLE_FRAME));
    let cwd = std::env::current_dir().unwrap_or_default();
    let mut app = GuiApp {
        window: None,
        terminal: None,
        shell: Some(Shell::new(Theme::new(ColorSupport::TrueColor), workspace)),
        panes: PaneStore::new(&cwd, Some(api)),
        modifiers: ModifiersState::empty(),
    };
    event_loop.run_app(&mut app).map_err(|e| e.to_string())
}

struct GuiApp {
    window: Option<Arc<Window>>,
    terminal: Option<Terminal<WgpuBackend<'static, 'static>>>,
    /// Owned by `Option` so dispatch can move the immutable shell through
    /// `Shell::on_event` and put the successor back.
    shell: Option<Shell>,
    panes: PaneStore,
    modifiers: ModifiersState,
}

impl GuiApp {
    fn font_size_px(window: &Window) -> u32 {
        let pt = std::env::var("WORKBENCH_FONT_SIZE")
            .ok()
            .and_then(|v| v.parse::<f64>().ok())
            .unwrap_or(DEFAULT_FONT_PT);
        // pt → CSS px (4/3) → device px.
        ((pt * 4.0 / 3.0) * window.scale_factor()).round().max(8.0) as u32
    }

    fn redraw(&mut self) {
        let (Some(terminal), Some(shell)) = (self.terminal.as_mut(), self.shell.as_ref()) else {
            return;
        };
        let area = terminal.get_frame().area();
        self.panes.sync(&shell.pane_rects(area), &shell.desires);
        let panes = &mut self.panes;
        let _ = terminal.draw(|frame| shell.draw(frame, panes));
    }

    fn handle_event(&mut self, ev: &crossterm::event::Event, event_loop: &ActiveEventLoop) {
        if let Some(shell) = self.shell.take() {
            let next = driver::dispatch(shell, &mut self.panes, ev);
            let running = next.running;
            self.shell = Some(next);
            if !running {
                event_loop.exit();
            }
        }
        if let Some(window) = self.window.as_ref() {
            window.request_redraw();
        }
    }
}

impl ApplicationHandler for GuiApp {
    fn resumed(&mut self, event_loop: &ActiveEventLoop) {
        let attrs = WindowAttributes::default()
            .with_title("Life OS Workbench")
            .with_inner_size(winit::dpi::LogicalSize::new(1280.0, 860.0));
        let window = match event_loop.create_window(attrs) {
            Ok(w) => Arc::new(w),
            Err(e) => {
                eprintln!("workbench: failed to create window: {e}");
                event_loop.exit();
                return;
            }
        };

        let (primary, fallbacks) = match fonts::load_fonts() {
            Ok(f) => f,
            Err(e) => {
                eprintln!("workbench: {e}");
                event_loop.exit();
                return;
            }
        };

        let size = window.inner_size();
        let backend = pollster::block_on(
            Builder::from_font(primary)
                .with_fonts(fallbacks)
                .with_font_size_px(Self::font_size_px(&window))
                .with_bg_color(BG.resolve(ColorSupport::TrueColor))
                .with_width_and_height(Dimensions {
                    width: NonZeroU32::new(size.width.max(1)).unwrap(),
                    height: NonZeroU32::new(size.height.max(1)).unwrap(),
                })
                .build_with_target(window.clone()),
        );
        match backend
            .map_err(|e| e.to_string())
            .and_then(|b| Terminal::new(b).map_err(|e| e.to_string()))
        {
            Ok(t) => self.terminal = Some(t),
            Err(e) => {
                eprintln!("workbench: failed to initialize GPU renderer: {e}");
                event_loop.exit();
                return;
            }
        }
        self.window = Some(window);
        self.redraw();
    }

    fn window_event(
        &mut self,
        event_loop: &ActiveEventLoop,
        _window_id: winit::window::WindowId,
        event: WindowEvent,
    ) {
        match event {
            WindowEvent::CloseRequested => event_loop.exit(),
            WindowEvent::ModifiersChanged(mods) => self.modifiers = mods.state(),
            WindowEvent::Resized(size) => {
                if let Some(terminal) = self.terminal.as_mut() {
                    terminal
                        .backend_mut()
                        .resize(size.width.max(1), size.height.max(1));
                }
                if let Some(window) = self.window.as_ref() {
                    window.request_redraw();
                }
            }
            WindowEvent::KeyboardInput { event: key, .. } => {
                if key.state != ElementState::Pressed {
                    return;
                }
                if let Some(ev) = input::translate_key(&key.logical_key, self.modifiers) {
                    self.handle_event(&ev, event_loop);
                }
            }
            WindowEvent::RedrawRequested => self.redraw(),
            _ => {}
        }
    }

    fn about_to_wait(&mut self, event_loop: &ActiveEventLoop) {
        if let Some(window) = self.window.as_ref() {
            window.request_redraw();
        }
        event_loop.set_control_flow(ControlFlow::WaitUntil(Instant::now() + IDLE_FRAME));
    }
}
