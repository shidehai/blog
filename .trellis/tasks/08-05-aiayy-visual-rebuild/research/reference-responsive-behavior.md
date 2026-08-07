# Research: aiayy responsive, dark-theme, and interaction behavior

- Query: Reproduce `https://aiayy.cn/` as a material-language reference without copying its identity, content, or assets; determine responsive layout, mobile navigation, dark theme, header compression, motion, touch targets, truncation, and accessibility defects.
- Scope: mixed (downloaded public frontend bundles plus live Chromium measurement)
- Date: 2026-08-05

## Findings

### Evidence and method

The live home page was captured in headless Chromium at `390x844`, `768x1024`, and `1440x1000`, in light and dark modes. The run also sampled the exact `640/641`, `768/769`, and `1024/1025` boundaries, the mobile-menu transition, the compressed-header transition, the theme transition, DOM semantics, overflow, target sizes, and axe-core results. The complete measurements are in `reference-runtime-report.json`; the repeatable probe is `reference-probe.mjs`.

The public shell names the analyzed production bundles in `reference-home-shell.html`. The independently captured `reference-source/manifest.json` records origin URL, byte size, and SHA-256 for the same public files; the hashes match this probe's bundle names. Local bundle copies were only formatted to make line anchors stable. They are evidence, not code to copy into this product.

No application source was changed.

### Files found

| File | Relevance |
| --- | --- |
| `.trellis/tasks/08-05-aiayy-visual-rebuild/research/reference-index.css` | Reference header, mobile menu, footer, global light/dark styles, announcement behavior, and global transitions. |
| `.trellis/tasks/08-05-aiayy-visual-rebuild/research/reference-home.css` | Reference home bento geometry, breakpoint rules, component colors, clipping, and hover states. |
| `.trellis/tasks/08-05-aiayy-visual-rebuild/research/reference-index.js` | Reference theme state machine, strict scroll threshold, mobile-menu state, announcement state, and route transitions. |
| `.trellis/tasks/08-05-aiayy-visual-rebuild/research/reference-home.js` | Reference typewriter/clock timers and clickable article tabs. |
| `.trellis/tasks/08-05-aiayy-visual-rebuild/research/reference-runtime-report.json` | Computed styles, rectangles, transition samples, boundary matrix, overflow, targets, and axe results. |
| `.trellis/tasks/08-05-aiayy-visual-rebuild/research/reference-source/manifest.json` | Canonical public-source snapshot manifest with origin URLs, exclusions, sizes, and SHA-256 hashes. |
| `.trellis/tasks/08-05-aiayy-visual-rebuild/research/reference-desktop-tokens.md` | Independent desktop/source analysis used to cross-check palette, depth, type, and geometry. |
| `.trellis/tasks/08-05-aiayy-visual-rebuild/research/reference-*-light.png` / `*-dark.png` | Full-page visual evidence at all three requested viewports. |
| `.trellis/tasks/08-05-aiayy-visual-rebuild/research/reference-*-menu-open.png` / `*-scrolled.png` | Open mobile menu and compressed fixed-header evidence. |
| `src/styles/global.css` | Product-owned token, responsive, focus, reduced-motion, and forced-colors implementation. |
| `src/components/SiteHeader.astro` | Current native-popover navigation and scroll-compression behavior. |
| `src/components/ThemeControl.astro` | Current three-state theme control. |
| `src/pages/index.astro` and `src/components/FeaturePost.astro` | Existing semantic home modules and feature-media structure to restyle rather than replace with reference content. |

### Responsive contract

All reference media queries are inclusive `max-width` boundaries. Live resizing confirmed the CSS at every adjacent boundary.

| Width | Header/navigation | Hero row | Info row | Bottom row and detail changes |
| --- | --- | --- | --- | --- |
| `>=1025px` | Centered desktop nav; menu trigger hidden | `320px 1fr` | `1fr 1fr 120px` | Two columns; 24px row gap |
| `769-1024px` | Desktop nav hidden; menu trigger shown | `280px 1fr` | Two equal columns; the third card wraps into the left half of a second row | Two columns; 3D card changes from vertical to horizontal |
| `641-768px` | Mobile navigation remains | One column, profile before hero | Two equal columns; third card remains left-aligned on row two | Bottom row becomes one column; card radius/padding and footer spacing compact |
| `<=640px` | Menu panel horizontal inset changes from 24px to 16px | One column | One column | Tech grid becomes two columns; article controls stack vertically |

Bundle anchors:

- The hero is `320px 1fr`, becomes `280px 1fr` through `1024px`, and becomes one column through `768px` (`reference-home.css:152`, `reference-home.css:157`, `reference-home.css:162`).
- The info row is `1fr 1fr 120px`, becomes two columns through `1024px`, then one column only through `640px` (`reference-home.css:366`, `reference-home.css:371`, `reference-home.css:377`). There is no placement override for the third child, which explains the empty right-hand cell at tablet widths.
- The bottom pair becomes one column through `768px`; the six-item tech grid remains three columns at `768px` and becomes two columns through `640px` (`reference-home.css:741`, `reference-home.css:746`, `reference-home.css:752`, `reference-home.css:757`, `reference-home.css:763`).
- Home outer width is `calc(100% - 3rem)` with a `1200px` cap, changing to `calc(100% - 2rem)` and 16px vertical gaps through `768px` (`reference-home.css:10`, `reference-home.css:18`).
- Generic cards use 30px radius/48px padding and compact to 24px radius/32px padding through `768px` (`reference-home.css:24`, `reference-home.css:34`). Nested article cards use 24px radius/32px padding and compact to 20px/24px (`reference-home.css:650`, `reference-home.css:668`).
- The article header switches to a vertical control stack through `640px` (`reference-home.css:585`, `reference-home.css:591`). Footer brand/actions and footer metadata both stack through `768px` (`reference-index.css:318`, `reference-index.css:324`, `reference-index.css:410`, `reference-index.css:417`).

Measured geometry:

| Viewport | Outer bento | Hero row | Info row | Bottom row |
| --- | --- | --- | --- | --- |
| `390x844` | `358px`, x=16 | Profile `358x323.6`, then hero `358x513.2` | Clock, stats, 3D all `358px` wide | Tech then projects, both `358px` |
| `768x1024` | `736px`, x=16 | Profile `736x323.6`, then hero `736x498.0` | Clock/stats `360px` each; 3D `360px` on the next row with an empty right cell | Two modules stacked at `736px` |
| `1440x1000` | `1200px`, x=120 | `320px / 856px` | `516px / 516px / 120px` | `588px / 588px` |

At `390px`, the visible order is profile, feature hero, clock, stats, 3D entry, article list, tech stack, projects, then footer. CSS changes placement but does not semantically reorder these reference nodes.

The product currently renders feature before identity at its tablet/mobile breakpoint (`src/styles/global.css:1703`). That is an intentional divergence required by `DESIGN.md:125`: mobile remains reading-first even though the reference puts profile first. Do not reverse it merely to match the screenshot.

### Header and navigation behavior

The reference header is fixed, not sticky, at z-index 1030. Its inner capsule is capped at `1200px`, with 24px outer horizontal clearance (16px through `768px`) and a 16px top offset (`reference-index.css:1`, `reference-index.css:10`, `reference-index.css:29`). Main content reserves 80px at the top (`reference-index.css:532`).

Compression turns on only when `scrollY > 100`; the listener is passive and requestAnimationFrame-throttled (`reference-index.js:8322`). It does not wait for scroll direction or velocity.

| Viewport | Resting capsule | Compressed capsule |
| --- | --- | --- |
| `390` | `358x68`, x=16, y=16 | `358x48`, x=16, y=8 |
| `768` | `736x68`, x=16, y=16 | `736x48`, x=16, y=8 |
| `1440` | `1200x68`, x=120, y=16 | `720x48`, x=360, y=8 |

Compression uses a 500ms `cubic-bezier(0.4, 0, 0.2, 1)` transition for width/max-width/padding/margin and 300ms default easing for shadow (`reference-index.css:19`, `reference-index.css:35`). At the same time:

- Avatar: `36px` to `28px` over 500ms (`reference-index.css:82`, `reference-index.css:101`).
- Brand text: 18px to zero size/width and opacity 0 (`reference-index.css:105`, `reference-index.css:115`).
- Header actions: `36px` to `32px` (`reference-index.css:176`, `reference-index.css:198`).
- Desktop nav links: padding `8px 16px` to `4px 8px`, font `14px` to `13px` (`reference-index.css:132`, `reference-index.css:153`).

Desktop navigation is hidden and the menu trigger shown through exactly `1024px`; live `1024/1025` resizing confirmed the switch (`reference-index.css:127`, `reference-index.css:212`).

The open mobile menu is a two-column, 4px-gap panel at both phone and tablet widths (`reference-index.css:220`). It measured `358x319.95` at 390px and `720x319.95` at 768px. Each of the nine live links measured 54.39px high. The active link uses an inset shadow rather than a filled accent (`reference-index.css:248`).

Menu entry/exit is 300ms with the same material curve, moving from `translateY(-8px)` and opacity 0 (`reference-index.css:276`). Runtime samples were opacity 0 at start, approximately 0.97 after 100ms, and 1 by 320ms.

The trigger only toggles component state and each menu link closes it (`reference-index.js:8437`, `reference-index.js:8455`). Runtime behavior:

- Escape does not close it.
- Clicking outside does not close it.
- There is no backdrop or modal focus management.
- The trigger lacks `aria-expanded` and `aria-controls`, and its label remains generic while the icon changes.

Do not inherit those defects. The product's current native `popover` in `src/components/SiteHeader.astro:46` already provides Escape/outside-click behavior and a close control; preserve that behavior while adapting the visual layout.

An optional announcement was not active during capture. Bundle behavior is a fixed 36px bar that moves the fixed header down 36px and increases main padding by the same amount; enter is 400ms and leave is 300ms (`reference-index.css:469`, `reference-index.css:486`, `reference-index.css:519`). Dismissal is session-local component state, not persisted (`reference-index.js:8810`).

### Theme state and computed palette

Theme has three states in this cycle: `system -> light -> dark -> system`. The reference stores every state under `localStorage.themeMode`, defaults to `system`, listens for `prefers-color-scheme` changes only in system mode, and toggles `body.dark` (`reference-index.js:3536`). The theme button exposes a current-mode title and a generic accessible label; its icon uses sun, moon, or monitor (`reference-index.js:8393`).

The app initializes theme after Vue mounts (`reference-index.js:8815`), so stored dark/system-dark can briefly expose the light shell. Do not copy that timing. The product's inline bootstrap in `src/layouts/AppLayout.astro:87` avoids this flash and should remain.

Computed core tokens were identical across all three viewports:

| Role | Light | Dark |
| --- | --- | --- |
| Page/card surface | `#e8e6e3` | `#1e1e2a` |
| Nested article surface | `#e8e6e3` | `#242433` (hover `#2b2b3c`) |
| Primary ink | `#3a3a4a` | `#e0e0ec` |
| Secondary ink | `#6a6a7a` | `#a0a0b4` |
| Low-emphasis ink | `#9a9aaa` | `#6a6a80` |
| Accent | `#4a8fe7` | `#4a8fe7` |
| Hero surface | `linear-gradient(135deg,#dce8f8,#e4eef9,#e8e6e3)` | `linear-gradient(135deg,#1a2a44,#1e3050,#1e1e2a)` |

The raised-depth recipes are:

- Light large: `6px 6px 14px #c8c6c3, -6px -6px 14px #fff`.
- Light small: `3px 3px 6px #c8c6c3, -3px -3px 6px #fff`.
- Light inset: `inset 4px 4px 8px #c8c6c3, inset -4px -4px 8px #fff`.
- Dark large: `6px 6px 14px #16161f, -6px -6px 14px #282838`.
- Dark inset: `inset 4px 4px 8px #16161f, inset -4px -4px 8px #282838`.

These recipes are declared for generic cards and wells at `reference-home.css:24`, `reference-home.css:40`, `reference-home.css:46`, and `reference-home.css:59` and for the header at `reference-index.css:10` and `reference-index.css:49`.

Body background and text interpolate over 300ms with `cubic-bezier(0.4, 0, 0.2, 1)` (`reference-index.css:555`). Live light-to-dark samples were still the light endpoints at event time, approximately `rgb(46,46,57)` background / `rgb(211,211,223)` ink at 100ms, and the dark endpoints by 350ms. Some surfaces switch background immediately because their transition lists omit background, while their shadow interpolates; copying the visual language should use one coherent token transition rather than reproduce that inconsistency.

### Motion and interaction language

- Most cards and controls use 250-300ms transitions; the dominant easing is `cubic-bezier(0.4, 0, 0.2, 1)` (`reference-home.css:24`, `reference-home.css:65`, `reference-home.css:95`).
- Raised icon controls press inward on hover by changing from an outer to inset shadow (`reference-home.css:65`, `reference-home.css:79`; header equivalent at `reference-index.css:176`).
- Article rows change from small raised to inset shadow in light mode; dark mode changes nested surface from `#242433` to `#2b2b3c` (`reference-home.css:650`, `reference-home.css:660`, `reference-home.css:674`).
- The 3D and project modules translate up 3px on hover; footer social controls translate up 2px (`reference-home.css:522`, `reference-home.css:537`, `reference-home.css:785`, `reference-home.css:788`, `reference-index.css:368`, `reference-index.css:382`).
- Brand hover is a 1.02 scale over 200ms (`reference-index.css:68`).
- Theme icon replacement rotates from -90 degrees and exits toward +90 degrees, scaled to 0.8, over 200ms (`reference-index.css:285`).
- Route enter is opacity 0 / y=20 to visible over 500ms `power2.out`; leave is y=-20 / opacity 0 over 300ms `power2.in` (`reference-index.js:8232`).
- The home headline types one character every 120ms, holds 2 seconds, deletes every 80ms, waits 400ms, and loops; its cursor blinks every second (`reference-home.js:139`, `reference-home.css:323`). The binary clock updates every second (`reference-home.js:159`).
- Global anchor color transitions take 150ms and HTML scrolling is smooth (`reference-index.css:552`, `reference-index.css:578`).

There is no `prefers-reduced-motion` or forced-colors rule in any downloaded reference CSS. Preserve the product safeguards at `src/styles/global.css:1961` and `src/styles/global.css:1977`; do not remove them to match motion literally.

### Truncation, overflow, and touch

- Article excerpts use a two-line clamp. At 390px the first excerpt was `278x39px`, while its unclipped scroll height was 98px (`reference-home.css:700`).
- Header nav and several stats use `white-space: nowrap` (`reference-index.css:132`, `reference-home.css:505`, `reference-home.css:514`).
- The document had no horizontal overflow at 390px. The root uses `overflow-x:hidden`, so this also masks component overflow (`reference-index.css:458`, `reference-index.css:555`).
- At 768px the clock card had 360px client width but 372px scroll width, clipped by `overflow:hidden`; at desktop the 120px 3D card had 130px scroll width, also clipped. Treat these as reference defects, not desired geometry.
- The phone/tablet hero reserves a 200px media block, but the live clipped image rendered blank at both requested non-desktop widths. The block is explicitly made relative and 200px tall through `768px` (`reference-home.css:279`). Do not preserve an empty media reservation when adapting product-owned imagery.

Many interactive targets miss the 44px baseline:

| Control | Resting | Compressed / note |
| --- | --- | --- |
| Header theme/menu | `36x36` | `32x32` after scroll |
| Profile icon links | `38x38` | Three links, also unlabeled |
| Footer social links | `40x40` | Labeled, but undersized |
| Desktop nav links | about `60x38.4` | Smaller after scroll |
| Article "more" link | about `138x35.2` | Undersized vertically |

Keep the product's existing `--control-size:2.75rem` (44px) at `src/styles/global.css:48` even when the visual shell is tightened.

### Accessibility defects not to inherit

Automated axe results were stable across the three widths:

- Light: 36-45 contrast failures. Observed failing pairs were `#9a9aaa/#e8e6e3` at 2.22:1, accent `#4a8fe7/#e8e6e3` at 2.64:1, and `#6a6a7a/#e8e6e3` at 4.26:1 for normal small text.
- Dark: 15-16 contrast failures. `#6a6a80/#1e1e2a` was 3.12:1 and `#6a6a80/#242433` was 2.89:1.
- Three profile icon links have no accessible name.
- Heading order begins with h2, then h1, then jumps to h4; axe reports an invalid heading order.
- The logo avatar alt duplicates adjacent brand text.

Additional manual/runtime defects:

- Mobile navigation lacks expanded-state relationships and keyboard dismissal.
- Programmatically focusing the theme control produced no visible outline and no shadow change. The reference defines no `:focus-visible` rule.
- The Latest/Popular controls are clickable `span` elements with no role, tabindex, keyboard handler, or selected-state semantics (`reference-home.js:405`). At 390px each measured about `74x36.8`.
- Shadows are the only boundary for most cards/controls, with no forced-colors fallback.
- Continuous typewriter/blink/route/header motion ignores reduced-motion preference.
- Low-emphasis type is often only 11-13px in addition to failing contrast.

The project already has a skip link and focus ring (`src/layouts/AppLayout.astro:121`, `src/styles/global.css:203`), semantic native controls, native popover dismissal, reduced-motion overrides, and forced-colors borders. Preserve those contracts while adopting reference geometry and depth.

### Product mapping

The reference behavior can be adapted without importing its Vue/GSAP runtime or assets:

- Use the measured surface/ink/accent/depth roles to refine the existing token block (`src/styles/global.css:1`), but resolve cooler, contrast-tested OKLCH values. `DESIGN.md:40` explicitly forbids transplanting the reference hex palette.
- Restyle the existing Astro shell and content components. Do not copy the reference card markup, text, social links, avatar, hero image, article data, timers, or 3D entry.
- Align shell boundaries to `1024px`, `768px`, and `640px`; the current product uses approximately 992px and 768px (`src/styles/global.css:1671`, `src/styles/global.css:1747`).
- Align compact-header activation from the current `>72` to the verified reference `>100` only if the desired scroll feel is part of acceptance (`src/components/SiteHeader.astro:106`).
- Keep the current three-state theme order and head bootstrap. Apply the new material tokens through `data-theme` rather than changing to `body.dark`.
- Keep native popover/focus/44px controls and reduced-motion/forced-colors protections even though these create intentional behavioral differences from the reference.

## External references

- Live reference: `https://aiayy.cn/`, captured 2026-08-05. The response was HTTP 200 and advertised `Last-Modified: Sat, 23 May 2026 09:46:33 GMT`.
- Public assets used as evidence: `/assets/index-SiT6AZgS.css`, `/assets/index-DOBNqoKs.js`, `/assets/HomeView-CFVxZpYC.css`, and `/assets/HomeView-D9C386vz.js`.
- Runtime tooling from this repository: Playwright `1.62.1` and `@axe-core/playwright` `4.12.1` (`package.json`).

## Related specs

- `DESIGN.md`: adaptation boundary, cooler contrast-tested palette, local mixed-script typography, semantic elevation, reading-first mobile order, 44px controls, pre-paint theme, and accessible motion.
- `.trellis/spec/frontend/component-guidelines.md`: Astro-first implementation, semantic controls, accessibility baseline, forced-colors and reduced-motion requirements, and centralized visual tokens.
- `.trellis/spec/frontend/quality-guidelines.md`: browser-visible behavior should be verified through Playwright and the full `pnpm verify` gate.
- `.trellis/spec/frontend/directory-structure.md`: shared presentation belongs in existing components; global tokens remain in `src/styles/`.

## Caveats / Not Found

- Runtime screenshots cover the reference home route. Article, archive, and about CSS were downloaded for corroboration, but those routes were not included in this viewport run.
- The announcement was disabled in live settings, so its behavior is bundle-derived rather than screenshot-verified.
- A Google Fonts CSS request was aborted during the 768px run; that run used the declared fallback stack for some text, causing sub-pixel text-width differences. Breakpoint and box geometry were unaffected.
- Headless Chromium used DPR 1 and desktop input capabilities at narrow viewport sizes. Physical safe-area insets, mobile browser chrome, and sticky-hover behavior were not tested.
- The reference is dynamic. Article counts/text and enabled navigation items can change independently of these bundle-defined layout rules.
- The screenshots contain reference-owned identity and assets solely as evidence. They must not be shipped or used as source assets.
