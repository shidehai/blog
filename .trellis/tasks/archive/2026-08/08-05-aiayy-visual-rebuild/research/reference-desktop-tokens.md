# Research: aiayy desktop visual-system evidence

- Query: Measure `https://aiayy.cn/` as a desktop material-language reference for the blog without reusing its identity, content, media, exact palette, or implementation.
- Scope: mixed (public source snapshot plus Chromium computed-style/runtime evidence)
- Date: 2026-08-05

## Findings

### Evidence set and reproducibility

The primary evidence is a snapshot of public code loaded by the homepage at a
`1440x900` viewport with Chrome 141 user-agent semantics. The manifest records
the origin URL, byte size, content type, and SHA-256 for every saved file, and
states the exclusions: images, media, API payloads, cookies, credentials,
source maps, and font binaries
(`reference-source/manifest.json:1`).

Primary hashes:

| Snapshot file | Origin | SHA-256 |
| --- | --- | --- |
| `reference-source/index.html` | `https://aiayy.cn/` | `8cd4ae072f24e6fd3dda3594414ce7b7afdaf03b3ee58da2505c4bb44a709b9b` |
| `reference-source/assets/index-SiT6AZgS.css` | `/assets/index-SiT6AZgS.css` | `5d8847c9f307cc471d613710fea892ff53e2da65bc30811a313e36dadd271414` |
| `reference-source/assets/HomeView-CFVxZpYC.css` | `/assets/HomeView-CFVxZpYC.css` | `a0965e07bf512b7375c86c73feb94c4c4e71be72d64c95cdfe628b656c83c3b2` |
| `reference-source/assets/index-DOBNqoKs.js` | `/assets/index-DOBNqoKs.js` | `dc754dddfc464bfe56e0c8c275429122fb3822b3c4bfa52d90cd71febcd1f36f` |
| `reference-source/assets/HomeView-D9C386vz.js` | `/assets/HomeView-D9C386vz.js` | `b5a5e5c87f9700c9f5f097520a353cf3fcabf2bd3fa5f9a1ddf51a98d7c4e520` |
| `reference-source/fonts/inter-google.css` | Google Fonts declaration URL | `5a1e4e2125ee061a97fa81cf618425b969fd3c9e8f6bc69e55275963eaeda69d` |

The other four linked/runtime JS files and hashes are listed in
`reference-source/manifest.json:45`. The repeatable collectors are
`snapshot-reference-source.mjs` and `probe-reference.mjs`. Raw computed results
are in `reference-computed-measurements.json`; the light reference screenshot is
`reference-1440x900-light.png` at exactly `1440x900` CSS pixels.

### Source token model

The two reference CSS bundles define **zero CSS custom properties**. A source
scan found no `--name:` declaration. All palette, shadow, radius, spacing, and
motion values are hard-coded in the minified rules
(`reference-source/assets/index-SiT6AZgS.css:1`,
`reference-source/assets/HomeView-CFVxZpYC.css:1`). For adaptation, these values
should therefore be normalized into the local semantic token model, not copied
as component-private formulas.

Reference-only color evidence:

| Role | Light | Dark |
| --- | --- | --- |
| Page and main raised surface | `#e8e6e3` / `rgb(232, 230, 227)` | `#1e1e2a` / `rgb(30, 30, 42)` |
| Primary ink | `#3a3a4a` | `#e0e0ec` |
| Secondary ink | `#6a6a7a` | `#a0a0b4` |
| Quiet metadata | `#9a9aaa` | `#6a6a80` |
| Signal blue | `#4a8fe7` | `#4a8fe7` |
| Link hover | `#3a7bd5` | `#3a7bd5` |
| Secondary green | `#4abe7a` | `#4abe7a` |
| Nested article surface | `#e8e6e3` | `#242433` (`#2b2b3c` on hover) |
| Main shadow pair | `#c8c6c3` + `#fff` | `#16161f` + `#282838` |
| Hero surface | `linear-gradient(135deg,#dce8f8,#e4eef9,#e8e6e3)` | `linear-gradient(135deg,#1a2a44,#1e3050,#1e1e2a)` |

Chromium confirmed the body/app computed backgrounds and ink in both themes
(`reference-computed-1440x900.json:2085`). The exact hex palette is measurement
evidence only; `DESIGN.md:40` requires locally resolved, contrast-tested OKLCH
colors and explicitly rejects copying the reference palette.

### Elevation and shape

The material system is a small set of paired shadows:

| State | Light source value | Dark source value |
| --- | --- | --- |
| Main raised card/header | `6px 6px 14px #c8c6c3, -6px -6px 14px #fff` | `6px 6px 14px #16161f, -6px -6px 14px #282838` |
| Small raised control/item | `3px 3px 6px #c8c6c3, -3px -3px 6px #fff` | reference often reuses the main dark `6/14` pair |
| Selected/inset | `inset 4px 4px 8px #c8c6c3, inset -4px -4px 8px #fff` | same geometry with `#16161f` + `#282838` |
| Hover/pressed inset | `inset 2px 2px 5px #c8c6c3, inset -2px -2px 5px #fff` | dark rules retain theme-specific inset colors |
| Lifted hover | `8px 8px 20px #c8c6c3, -8px -8px 20px #fff` | blue 3D card uses `#15519d` + `#a4c7f3` |

No decorative card border accompanies the raised shadows. Major header/cards
use `1.875rem` = `30px`; article items use `1.5rem` = `24px`; icon wells,
controls, and navigation links use `1.25rem` = `20px`; footer icon buttons use
`1rem` = `16px`; chips/tabs/avatar use `9999px`. At `<=768px`, main cards drop
to `24px` and article items to `20px`
(`reference-source/assets/HomeView-CFVxZpYC.css:1`).

### Typography and loaded fonts

The HTML requests Inter weights `300,400,500,600,700,800,900` with
`display=swap` (`reference-source/index.html:35`). Body CSS is
`Inter,-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif`
(`reference-source/assets/index-SiT6AZgS.css:1`). The captured Google stylesheet
identifies Inter v20 and maps the Latin ranges for all requested weights to:

`https://fonts.gstatic.com/s/inter/v20/UcC73FwrK3iLTeHuS_nVMrMxCp50SjIa1ZL7.woff2`

(`reference-source/fonts/inter-google.css:55`, repeated through line 439).
Network evidence showed that single Latin WOFF2 response loaded. Chrome platform
font inspection showed Latin glyphs rendered with the custom Inter face while
Han glyphs rendered with platform `Noto Sans CJK SC`; Inter supplies no Chinese
range (`reference-computed-1440x900.json:1241`).

Measured desktop scale at `1440x900`:

| Element | Size / weight / line-height | Other |
| --- | --- | --- |
| Body | `16px / 400 / 25.6px` | default tracking |
| Logo | `18px / 700 / 28.8px` | `-0.02em` (`-0.36px`) |
| Navigation | `14px / 500 / 22.4px`; active `600` | compact state `13px` |
| Card label | `12px / 700 / 19.2px` | uppercase, `0.08em` (`0.96px`) |
| Profile name | `20px / 800 / 32px` | primary ink |
| Profile role/body | `13px / 600` and `13px / 400 / 20.8px` | signal/secondary ink |
| Hero badge | `11px / 700 / 17.6px` | capsule |
| Hero title | `52px / 800 / 57.2px` | `-0.03em` (`-1.56px`) |
| Hero description | `15px / 400 / 24px` | secondary ink |
| Clock/stat number | `24px / 800 / 38.4px`; `20px / 800 / 32px` | clock `-0.02em` |
| Article title/excerpt | `16px / 700 / 25.6px`; `13px / 400 / 19.5px` | excerpt clamped to 2 lines |
| Project description | `14px / 400 / 21px` | secondary ink |

The hero title steps to `40px` at `<=1024px`, `32px` at `<=768px`, and
`28px` at `<=640px`; there is no fluid `clamp()` type scaling. These values are
source-visible in `reference-source/assets/HomeView-CFVxZpYC.css:1` and computed
evidence starts at `reference-computed-1440x900.json:906`.

### Desktop container and header geometry

The homepage and header share `width:calc(100% - 3rem)` and `max-width:1200px`.
Thus the side gutter is `24px` until the cap, then the container centers. The
homepage uses a vertical `24px` gap; main content reserves `80px` for the fixed
header, and the home view adds `24px` top / `64px` bottom padding.

Computed initial header:

| Viewport | Header box | Notes |
| --- | --- | --- |
| `1440x900` | `x=120, y=16, w=1200, h=68` | `16px 32px` padding, `30px` radius |
| `1280x800` | `x=40, y=16, w=1200, h=68` | container remains capped |
| `1100x900` | `x=24, y=16, w=1052, h=68` | fluid `viewport - 48px` |

The header is fixed and centered. Its nav is absolutely centered; desktop nav
is hidden at `<=1024px`. Source JS sets the compact class when
`window.scrollY > 100`, throttled with `requestAnimationFrame`
(`reference-source/assets/index-DOBNqoKs.js:1`). At scrollY `300`, measured
compact geometry was `x=360, y=8, w=720, h=48`, with `8px 24px` padding,
`3px/6px` paired shadow, `28px` avatar, hidden logo text, `13px` nav text, and
`32px` action control (`reference-computed-1440x900.json:1876`). Initial controls
are only `36px`, below this project's `44px` target.

### Homepage Bento geometry

At `1440x900`, after network idle plus 2 seconds, the container was
`x=120, y=104, w=1200`; all rows use a `24px` gap
(`reference-computed-1440x900.json:331`):

| Module/row | Computed box or columns | Internal spacing |
| --- | --- | --- |
| Hero row | `1200 x 355.59`; `320px + 24px + 856px` | profile `48px`; hero text `64px` |
| Hero image | `x=849.20, w=470.80, h=355.59` | `55%` of hero card; right pinned; SVG/path clip |
| Info row | `1200 x 192`; `516px + 24px + 516px + 24px + 120px` | cards `48px`; clock inner gap `32px` |
| Article module | `1200 x 760.14` | `32px 48px`; first item `1104 x 195.78`, `32px`, radius `24px` |
| Bottom row | `1200 x 235.19`; `588px + 24px + 588px` | cards `48px` |

At `1100x900`, the same system computes a `1052px` container at `x=24`:
hero `320 + 24 + 708`, info `442 + 24 + 442 + 24 + 120`, and bottom
`514 + 24 + 514` (`reference-computed-1100x900.json:331`). At `1280x800`, the
layout already reaches the 1200px cap.

Source breakpoints are only `1024px`, `768px`, and `640px`:

- `<=1024px`: hero first column becomes `280px`; info becomes two equal columns;
  desktop nav hides; hero title becomes `40px`; the narrow 3D cell changes to a
  horizontal composition.
- `<=768px`: outer width becomes `calc(100% - 2rem)`, row gaps become `16px`,
  hero and bottom rows become one column, card padding becomes `32px`, hero text
  becomes `48px`, and hero media becomes full-width x `200px`.
- `<=640px`: info row becomes one column, hero title becomes `28px`, binary dots
  become `12px`, and the technology grid becomes two columns.

### Hover, focus, and motion

Representative computed states at `1440x900`
(`reference-computed-1440x900.json:1574`):

- Header action hover: ink `#6a6a7a -> #4a8fe7`; shadow changes from raised
  `3/3/6` to inset `2/2/5`; geometry stays fixed; `transition:all .25s`.
- Project-card hover: `translateY(-3px)` and shadow `6/14 -> 8/20`; its arrow
  moves `translate(2px,-2px)`; `all .3s cubic-bezier(.4,0,.2,1)`.
- Article hover: raised `3/3/6` becomes inset `2/2/5`; in dark mode its nested
  surface also changes `#242433 -> #2b2b3c`.
- Active nav: signal blue, weight 600, and inset `4/4/8` shadow.

Neither CSS bundle contains an authored `:focus` or `:focus-visible` rule. A
keyboard-tabbed active nav link did match `:focus-visible`, but only Chrome's UA
`outline:auto` was present. This is evidence of a reference defect, not a style
to reproduce; the local design already defines an explicit focus ring.

Bundle-derived motion values:

- Header size/padding/margin transitions: `.5s cubic-bezier(.4,0,.2,1)`;
  shadow `.3s`.
- Common card/control transition: `.3s cubic-bezier(.4,0,.2,1)`; header controls
  and nav use `.25s`.
- Cursor blink: `1s step-end infinite`, opacity 1 at 0/100% and 0 at 50%.
- Typewriter JS: `120ms` per entered character, `2000ms` hold, `80ms` per deleted
  character, then `400ms` before the next phrase
  (`reference-source/assets/HomeView-D9C386vz.js:1`).
- Clock refresh: `setInterval(..., 1000)` in the same homepage bundle.
- Theme source cycle: `system -> light -> dark -> system`, stored under
  `localStorage.themeMode`; system mode follows `(prefers-color-scheme: dark)`
  (`reference-source/assets/index-DOBNqoKs.js:1`).

The reference CSS has no `prefers-reduced-motion` rule, so its infinite cursor
and JS typewriter continue for reduced-motion users. The local implementation
must retain the design spec's instant/static alternative.

### Files found

- `reference-source/manifest.json` - authoritative origin/size/SHA-256 map and snapshot exclusions.
- `reference-source/index.html` - public document shell and linked/preloaded assets.
- `reference-source/assets/index-SiT6AZgS.css` - global shell, header, footer, theme, reset, and base type rules.
- `reference-source/assets/HomeView-CFVxZpYC.css` - homepage Bento geometry, card states, responsive rules, and hero styling.
- `reference-source/assets/index-DOBNqoKs.js` - public runtime including header scroll threshold and theme state machine.
- `reference-source/assets/HomeView-D9C386vz.js` - public homepage runtime including typewriter and clock intervals.
- `reference-source/fonts/inter-google.css` - browser-specific public Inter v20 font-face declarations; no font binaries saved.
- `reference-computed-measurements.json` - merged Playwright geometry/computed-style results for `1440x900`, `1280x800`, and `1100x900`.
- `reference-1440x900-light.png` - exact-viewport light screenshot for visual cross-checking, research use only.
- `src/styles/global.css:1` - current local semantic OKLCH/elevation/type/spacing tokens to adapt rather than replace with hard-coded reference formulas.
- `src/pages/index.astro:44` - current content-owned homepage module mapping.

### Related specs

- `DESIGN.md:12` names the reference and the floating header, asymmetric Bento,
  paired shadows, clipped hero, and light/dark behavior as the intended material
  language.
- `DESIGN.md:20` and `DESIGN.md:145` prohibit reusing reference identity,
  wording, navigation, stock imagery, statistics, clock, 3D module, exact colors,
  or implementation.
- `DESIGN.md:57` rejects copying Inter and requires robust Simplified Chinese
  metrics/fallbacks.
- `DESIGN.md:74` limits local elevation to semantic `flat`, `raised`, `inset`,
  and `floating` states.
- `.trellis/spec/frontend/component-guidelines.md:13` requires keyboard,
  reduced-motion, forced-colors, and no-JS resilience beyond the reference.

### External references

- Live reference: `https://aiayy.cn/`, HTTP 200, captured 2026-08-05.
- Public font declaration URL:
  `https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap`.
- Font file declarations identify `fonts.gstatic.com/s/inter/v20/`; only the
  declaration CSS and observed URL were retained, not the binary.

## Caveats / Not Found

- Snapshotting public client bundles is replication evidence, not a license to
  transplant their source. No bundle or reference asset should be imported into
  product code.
- The screenshot contains the live site's identity/content/media solely as
  research evidence under `.trellis/tasks/.../research/`; it is not a reusable
  product asset.
- Heights for the hero, article module, and bottom row are content-dependent.
  The reported decimals are exact for the captured public data and viewport;
  column widths, gaps, padding, radii, and source breakpoints are the more stable
  implementation contracts.
- The reference has no CSS variables, explicit focus system, forced-colors
  handling, or reduced-motion override. Those absences were verified and must
  not be treated as omissions in the local build.
- Inter's public CSS covers Latin/Greek/Cyrillic/Vietnamese, not Han. The observed
  `Noto Sans CJK SC` fallback is specific to the probe host; other platforms will
  select a different installed Chinese sans unless the local project defines a
  durable mixed-script stack.
- The reference's exact light base is a warm gray and several metadata colors are
  low contrast. The project spec requires a cooler, contrast-tested adaptation.
