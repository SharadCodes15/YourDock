# Style Mode — Design Guide

Style Mode is a **rendering-layer-only** system. It changes how the app's
surfaces look — glass, shadows, borders, corner radius, accent color — without
touching component HTML, layout, or JS logic.

There are six built-in styles plus `Custom` (the app's original look):

| Style | Root class | Technique |
| --- | --- | --- |
| Liquid Glass | `style-liquid-glass` | Fluid glass: heavy blur, gradient edge ring, specular sheen |
| Neumorphism | `style-neumorphism` | Soft dual shadows on same-color opaque surfaces |
| Glassmorphism / Aero | `style-glassmorphism-aero` | Frosted translucent panels, glossy top highlight |
| Neobrutalism | `style-neobrutalism` | Flat, hard offset shadows, thick borders, no blur |
| Claymorphism | `style-claymorphism` | Puffy clay blobs, warm accent-tinted shadows |
| Fluent Acrylic | `style-fluent-acrylic` | Acrylic noise texture + Fluent elevation tokens |
| Custom | *(no class)* | The user's own glass intensity / color presets |

## Architecture

1. **Settings** — `settings.appearance.styleMode`
   (`liquidGlass | neumorphism | glassmorphismAero | neobrutalism | claymorphism | fluentAcrylic | custom`)
   and `settings.appearance.styleIntensity` (`subtle | standard | bold`).
2. **main.js** — `resolveThemeConfig()` resolves them into:
   - `styleClass` → e.g. `style-liquid-glass`
   - `intensityClass` → e.g. `style-intensity-bold`
   - `lowRamMode` → `low-ram-mode`
   - `accentByStyle` → per-style adjusted accents broadcast as CSS vars
     (`--accent-liquid-glass`, `--accent-neumorphism`, `--accent-glassmorphism-aero`,
     `--accent-neobrutalism`, `--accent-claymorphism`, `--accent-fluent-acrylic`, `--accent-custom`).
3. **Every window's `applyThemeConfig()`** swaps those classes on `<body>`,
   exactly like it already swaps `dark-theme` / `reduce-motion`.
4. **`shared/theme.css`** is the single `<link>` every window loads; it
   `@import`s all six modules in `styles/`.

## Writing style-compliant components

Always build surfaces on the existing **custom property tokens** instead of
hardcoding values. The styles re-tint those tokens per style:

- `--glass-blur`, `--glass-opacity` — blur strength & tint opacity
- `--corner-radius` — corner rounding
- `--accent-color`, `--accent-color-translucent`, `--accent-soft` — highlights
- `--shadow-resting`, `--shadow-raised`, `--shadow-floating` — elevation
- `--border-width`, `--border-color` — edges
- `--text-color`, `--text-muted`, `--text-strong` — typography

Then add per-style overrides **only** where a style genuinely needs a different
material treatment (e.g. Neumorphism needs `backdrop-filter: none`).

### Conventions

- Modules live in `styles/<styleName>.css` and are scoped to their root class,
  e.g. `.style-neumorphism .my-surface`.
- Selectors must **not** start with `body` — the same rules style the live
  preview cards in Settings → Appearance → Style Mode (each card carries its own
  style class).
- Define `:root` tokens at the top of each module so the whole module is easy
  to retune in one place.
- Include a `dark-theme` variant via the compound selector
  `.style-<name>.dark-theme` (dark/light surfaces, shadows, text).
- Guard hover transforms / active states behind `:hover` / `:active` so
  `reduce-motion` and static previews behave.
- Neobrutalism and Custom have **no intensity levels** — hide the Intensity
  control for them in the UI.
- Neumorphism must disable backdrop blur on all panels
  (`backdrop-filter: none !important`) to keep surfaces opaque.
- Low-RAM fallbacks: keep heavy blurs/noise/specular effects cheap when
  `low-ram-mode` is on the root.

## Settings gallery

`settings.html` → Appearance → Style Mode renders one live mini-dock preview
per style. Each card reuses real component class names (`.menu-bar`,
`.dock-container`, `.dock-item`, `.dock-icon`) inside `.style-mode-preview`, so
the shared modules style them automatically. Hovering a card re-tints all cards
to that style live; clicking persists `styleMode` + `styleIntensity`.
