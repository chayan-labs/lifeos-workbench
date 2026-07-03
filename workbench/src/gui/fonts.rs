//! Font discovery for the window host. Picks the user's preferred monospace
//! face from the system font database (override via `WORKBENCH_FONT`) and
//! collects the remaining monospace faces as shaping fallbacks. Font bytes
//! are leaked once at startup - they must outlive the glyph atlas anyway.
//! Color-emoji collections are deliberately skipped for now (Apple Color
//! Emoji alone is ~180MB resident); tracked in the text-stack issue.

use fontdb::Database;
use ratatui_wgpu::Font;

/// Preference order when `WORKBENCH_FONT` is unset. First match wins.
pub const PREFERRED_FAMILIES: &[&str] = &[
    "JetBrains Mono",
    "JetBrainsMono Nerd Font Mono",
    "SF Mono",
    "Menlo",
    "Cascadia Mono",
    "Fira Code",
    "Monaco",
];

/// Case-insensitive pick of the first preferred family present.
pub fn pick_family(available: &[String], preferred: &[&str]) -> Option<String> {
    preferred.iter().find_map(|want| {
        available
            .iter()
            .find(|have| have.eq_ignore_ascii_case(want))
            .cloned()
    })
}

/// Load the primary face + monospace fallbacks from the system database.
pub fn load_fonts() -> Result<(Font<'static>, Vec<Font<'static>>), String> {
    let mut db = Database::new();
    db.load_system_fonts();

    let families: Vec<String> = db
        .faces()
        .filter(|f| f.monospaced && f.index == 0)
        .filter_map(|f| f.families.first().map(|(name, _)| name.clone()))
        .collect();

    let env_font = std::env::var("WORKBENCH_FONT").ok();
    let mut preferred: Vec<&str> = Vec::new();
    if let Some(name) = env_font.as_deref() {
        preferred.push(name);
    }
    preferred.extend_from_slice(PREFERRED_FAMILIES);

    let primary_family = pick_family(&families, &preferred)
        .or_else(|| families.first().cloned())
        .ok_or("no monospace font found on this system")?;

    let mut primary: Option<Font<'static>> = None;
    let mut fallbacks: Vec<Font<'static>> = Vec::new();
    let mut seen: Vec<String> = Vec::new();

    for info in db.faces() {
        if !info.monospaced || info.index != 0 {
            continue;
        }
        let Some((family, _)) = info.families.first() else {
            continue;
        };
        let is_primary = *family == primary_family && primary.is_none();
        if !is_primary && seen.iter().any(|s| s == family) {
            continue;
        }
        let Some(data) = db.with_face_data(info.id, |d, _| d.to_vec()) else {
            continue;
        };
        let leaked: &'static [u8] = Box::leak(data.into_boxed_slice());
        let Some(font) = Font::new(leaked) else {
            continue;
        };
        if is_primary {
            primary = Some(font);
        } else {
            fallbacks.push(font);
        }
        seen.push(family.clone());
    }

    let primary = primary.ok_or(format!("failed to load face for '{primary_family}'"))?;
    Ok((primary, fallbacks))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn avail(names: &[&str]) -> Vec<String> {
        names.iter().map(|s| s.to_string()).collect()
    }

    #[test]
    fn picks_first_preferred_family_present() {
        let a = avail(&["Menlo", "SF Mono", "Courier"]);
        assert_eq!(
            pick_family(&a, PREFERRED_FAMILIES),
            Some("SF Mono".to_string())
        );
    }

    #[test]
    fn pick_is_case_insensitive() {
        let a = avail(&["jetbrains mono"]);
        assert_eq!(
            pick_family(&a, PREFERRED_FAMILIES),
            Some("jetbrains mono".to_string())
        );
    }

    #[test]
    fn returns_none_when_nothing_matches() {
        let a = avail(&["Comic Sans MS"]);
        assert_eq!(pick_family(&a, PREFERRED_FAMILIES), None);
    }

    #[test]
    fn env_override_wins_over_defaults() {
        let a = avail(&["Menlo", "Hack"]);
        let mut preferred = vec!["Hack"];
        preferred.extend_from_slice(PREFERRED_FAMILIES);
        assert_eq!(pick_family(&a, &preferred), Some("Hack".to_string()));
    }
}
