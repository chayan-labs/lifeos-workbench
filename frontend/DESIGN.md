---
name: Life OS Neo-Brutal
colors:
  surface: '#ffffff'
  surface-dim: '#dedbc6'
  surface-bright: '#fdfae4'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f7f4df'
  surface-container: '#f2efd9'
  surface-container-high: '#ece9d3'
  surface-container-highest: '#e6e3ce'
  on-surface: '#1c1c0f'
  on-surface-variant: '#484831'
  inverse-surface: '#323123'
  inverse-on-surface: '#f5f1dc'
  outline: '#79785f'
  outline-variant: '#cac8aa'
  surface-tint: '#626200'
  primary: '#2f29e8'
  on-primary: '#ffffff'
  primary-container: '#ffff00'
  on-primary-container: '#757500'
  inverse-primary: '#cdcd00'
  secondary: '#2f29e8'
  on-secondary: '#ffffff'
  secondary-container: '#4b4cff'
  on-secondary-container: '#e8e6ff'
  tertiary: '#ff4b4b'
  on-tertiary: '#ffffff'
  tertiary-container: '#fff5f4'
  on-tertiary-container: '#d72d32'
  error: '#ff4b4b'
  on-error: '#ffffff'
  background: '#fdfae4'
  on-background: '#1c1c0f'
typography:
  headline-xl:
    fontFamily: Montserrat
    fontSize: 48px
    fontWeight: '900'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Montserrat
    fontSize: 32px
    fontWeight: '800'
    lineHeight: '1.2'
  headline-md:
    fontFamily: Montserrat
    fontSize: 24px
    fontWeight: '800'
    lineHeight: '1.2'
  body-lg:
    fontFamily: Hanken Grotesk
    fontSize: 18px
    fontWeight: '500'
    lineHeight: '1.5'
  body-md:
    fontFamily: Hanken Grotesk
    fontSize: 16px
    fontWeight: '500'
    lineHeight: '1.5'
  label-md:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '700'
    lineHeight: '1.2'
  label-sm:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '700'
    lineHeight: '1.2'
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  margin-page: 32px
  gutter: 24px
  stack-sm: 8px
  stack-md: 16px
  stack-lg: 32px
  border-width-thin: 2px
  border-width-thick: 4px
  shadow-offset: 4px
---

## Brand & Style

This design system is built on the principles of **Neo-Brutality**, matching the creative workspace aesthetic of StudioFlow. It uses bold layouts, high-impact visuals, and a tactile, physical structure to represent the robust, self-extending personal operating system.

The key change is the introduction of the **Rotating Globe Logo (`BrandMark.jsx`)**, replacing standard geometric monograms. The globe consists of high-contrast latitude and longitude paths orbiting a solid primary core, rotating dynamically via a custom CSS hardware-accelerated spin animation to symbolize the cloud-local sync networks and modular extension of Life OS.

## Colors

The palette utilizes high-contrast, saturated tones:
- **Primary (Blue):** `#2f29e8` used for highlight active states, buttons, and system controls.
- **Accent (Yellow):** `#ffff00` used for main focus cards and alerts.
- **Alert (Red):** `#ff4b4b` reserved for gating notifications, block states, and errors.
- **Success (Mint):** `#00ff9d` representing synchronized status and validated modules.
- **Neutral:** Stark black border outlines (`#1c1c0f`) combined with a soft cream background (`#fdfae4`) to enhance readability.

## Elevation & Depth

All interactive cards, tables, and buttons feature rigid **Hard Shadows**:
- **Level 1 (Buttons/Cards):** `4px 4px 0 0 #1c1c0f` shadow offsets.
- **Level 2 (Hover Action):** Translation of `-4px -4px` with a shadow increase to `8px 8px`.
- **Level 3 (Pressed Action):** Translation of `4px 4px` with shadow offset reduced to `0px`.

## Layout & Components

1. **Dashboard Widgets:** Boxy layout cards containing telemetry metrics and sync state indicators.
2. **Unified Database schemas:** SQL tables and JSON document displays built inside monospace blocks.
3. **Sandbox Console:** Real-time logging terminal displaying Zod schema generation and headless validator loops.
4. **VCS Commit History:** Interactive diff widgets outlining video, design, and audio versioning structures.
