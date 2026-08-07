# Technical Design

## Overview

The migration keeps the existing Astro and Directus architecture and replaces
the public presentation layer with a measured reproduction of aiayy.cn's
deployed visual system. The downloaded public bundles and browser-computed
styles are reference evidence; they are not runtime dependencies and are not
copied into product source.

The primary implementation boundary is the existing token and utility layer in
`src/styles/global.css`. Shared Astro components then expose the small markup
changes required for the header, footer, homepage Bento hierarchy, discovery
rows, and long-form shell. Data normalization, routes, metadata semantics,
Markdown rendering, Pagefind indexing, Directus schemas, and deployment remain
unchanged unless a presentation change requires an explicitly tested wrapper.

## Reference Contract

### Source evidence

The task retains a snapshot under `research/reference-source/` containing the
public homepage HTML, deployed CSS/JavaScript bundles, and Google Fonts
declarations with origin URLs and SHA-256 hashes. Browser probes cover the
reference at 390x844, 768x1024, and 1440x900/1000 in light, dark, scrolled, and
mobile-menu states.

Implementation values are selected in this order:

1. Deployed CSS declarations for exact constants and breakpoints.
2. Browser-computed styles and geometry for cascade/runtime confirmation.
3. Screenshots for composition, rhythm, and state comparison.
4. Project product/accessibility constraints when the reference has a defect.

### Calibrated foundation

The shared system will reproduce these reference constants:

| Role | Light | Dark |
| --- | --- | --- |
| Base material | `#e8e6e3` | `#1e1e2a` |
| Primary ink | `#3a3a4a` | `#e0e0ec` |
| Secondary ink | `#6a6a7a` | `#a0a0b4` |
| Signal | `#4a8fe7` | `#4a8fe7` |
| Raised dark edge | `#c8c6c3` | `#16161f` |
| Raised light edge | `#ffffff` | `#282838` |
| Secondary raised surface | base material | `#242433` |

Reference elevation recipes become semantic tokens rather than repeated
component declarations:

- raised: `6px 6px 14px` dark edge plus `-6px -6px 14px` light edge
- compact raised: `3px 3px 6px` plus `-3px -3px 6px`
- inset: `inset 4px 4px 8px` plus `inset -4px -4px 8px`
- pressed: `inset 2px 2px 5px` plus `inset -2px -2px 5px`
- floating menu: `8px 8px 20px` plus `-8px -8px 20px` in light mode,
  normalized to the dark raised recipe in dark mode

Primary modules use a 30px desktop radius and 24px mobile radius. Nested content
rows use 24px desktop and 20px mobile; small frames use 16px; controls use 20px
or a full pill. The 1200px content width, 24px desktop outer gutter/gap, 16px
mobile gutter/gap, and 1024/768/640px reference breakpoints remain authoritative.

The font stack mirrors the reference: Inter for Latin plus platform sans-serif
fallbacks for Chinese. Because production CSP permits only self-hosted fonts,
the Inter files needed by shipped weights will be self-hosted with their license
instead of loading Google Fonts at runtime. Base size is 16px and line height is
1.6; the reference's 52/40/32/28px hero steps and 20/18/16/15/14/13/12/11px
component hierarchy are mapped to semantic tokens. Letter spacing remains zero
per project typography rules even where the reference uses small negative
tracking.

Low-contrast reference metadata such as `#9a9aaa` on the light material is not
used for meaningful text unless it passes WCAG 2.2 AA at the rendered size.
Composition, weight, and relative hierarchy remain matched while the nearest
AA-safe value is substituted. Focus rings, forced-colors borders, reduced
motion, 44px touch targets, and visible text at 200% zoom are project invariants.

## Architecture And Boundaries

### Token and utility layer

`src/styles/global.css` remains the only global design-system source. It will:

- replace the current cool OKLCH surface palette with measured reference values
  and define accessible derived metadata/focus/semantic tokens;
- expose `flat`, `raised`, `raised-compact`, `inset`, `pressed`, and `floating`
  states using the calibrated paired shadows;
- define the reference radii, 1200px container, responsive gutters, type scale,
  easing, and transition durations;
- keep theme overrides in one maintainable logical block while supporting
  system preference and explicit `data-theme` selection;
- retain reduced-motion, forced-colors, print, and logical-property behavior.

No route may define a new raw shadow recipe or competing palette. Search's
existing local styles consume the shared tokens.

### Shared document shell

`AppLayout.astro` keeps metadata/noindex/Pagefind behavior and prepaint theme
selection. It passes existing author/avatar/tagline/social settings to the
shared shell without new CMS fields.

`SiteHeader.astro` becomes the measured fixed capsule:

- 1200px maximum, 30px radius, 16px top offset, and the reference's 68px
  resting visual height;
- scrolled state above 100px, narrowing to 720px with the
  measured 8px top offset, padding, avatar, navigation, and control changes;
- centered desktop navigation until 1024px, then a native Popover menu in the
  reference's two-column floating panel;
- an author avatar when available and the existing generated mark fallback;
- icon-only theme/menu controls with accessible names and tooltips;
- `data-theme` and native keyboard/focus contracts preserved.

The reference's 36px/32px visible action wells are drawn inside 44px button hit
areas. Resting/compact capsule padding is adjusted to preserve the closest
possible measured outer height without shrinking the keyboard/touch target.

`SiteFooter.astro` adopts the reference's centered identity rhythm while using
the site's own author, tagline, routes, RSS, and social links. Visitor counters,
ICP text, and reference identity are not reproduced.

### Homepage Bento mapping

The homepage keeps one semantic DOM order that becomes reading-first on mobile.
CSS grid placement recreates the reference's desktop Bento geometry:

1. Hero row: author profile module (320px) plus featured-writing hero (remaining
   width), with the current real cover/media fallback.
2. Information row: recent-note signal, content/topic snapshot, and a blue
   discovery shortcut. These replace the reference's clock, visitor metrics,
   and 3D module without changing the module proportions or material language.
3. Latest-writing group: reference-style segmented navigation and content rows,
   using real writing and links. The group is flat/inset rather than a raised
   card containing raised cards, preserving the visual grouping without nested
   fully raised cards.
4. Bottom row: active topics and Search/Archive/RSS discovery paths in the
   reference's two-column proportions.

At 1024px information modules move to a two-column pattern and desktop
navigation disappears. At 768px the Hero row and bottom row become one column.
At 640px all information cells stack. The featured item remains before the
expanded profile in narrow DOM flow, as required by the product's reading-first
rule even though the reference profile appears first.

Empty writing, notes, topics, missing avatar, missing hero media, and long
mixed-script strings use the same geometry and never collapse the page into a
different visual system.

### Discovery and utility routes

Writing, notes, topics, topic detail, archive, about, 404, and search reuse the
reference archive/article material language rather than cloning the homepage's
Bento on every route:

- 1200px shell with 900px reading/discovery sub-containers where appropriate;
- raised 16-24px content rows, inset segmented filters, compact metadata, and
  signal-colored actions;
- consistent page headings and vertical rhythm beneath the fixed header;
- search default/loading/results/empty/error states styled identically despite
  runtime-generated result DOM;
- familiar icons for icon actions, with text retained for commands and links.

### Long-form reading

`PostPage.astro` stays the sole public/preview reading component. The prose
column remains flatter and more contrast-heavy than the homepage while matching
the reference article bundle for title sizing, metadata rhythm, cover radius,
outline surface, body type, code/table/callout framing, related rows, and mobile
collapse.

Pagefind attributes, heading IDs, outline data, reading progress, intrinsic
media dimensions, copy behavior, related-content semantics, JS-off rendering,
and print output remain unchanged. `src/lib/markdown.ts` changes only if a
verified visual need cannot be solved through existing shared class names.

### Brand and browser surfaces

The measured palette must also update hardcoded browser-facing values in
`MetadataHead.astro`, `src/lib/discovery.ts`, favicon/manifest icons, and the
generated fixture/social artwork where applicable. This keeps browser chrome,
manifest surfaces, tests, and fixture screenshots consistent with the CSS.
Identity shapes and copy remain this site's own.

## Visual Verification Contract

A task-local Playwright probe captures the same matrix for the reference and
local production build:

- homepage at 390x844, 768x1024, and 1440x900/1000, light and dark;
- fixed header initial, compact/scrolled, and mobile menu open;
- one discovery/list page, archive, search default/result/empty, and about;
- one long article at desktop/mobile with cover, code, table, callout, outline,
  progress, and related content;
- empty/missing-page and no-media states where deterministic fixtures permit.

Computed assertions cover font family/size, core colors, container/header/module
geometry, radii, shadows, breakpoint visibility, DOM order, overflow, and theme
state. Screenshots are inspected side by side; a whole-page pixel threshold is
not used because the sites intentionally have different copy and media.

Existing semantic Playwright assertions remain release-blocking. Axe,
forced-colors, reduced-motion, 200% text, print, Pagefind, preview, metadata,
CSP, and full `pnpm verify` gates must pass.

## Compatibility, Rollout, And Rollback

- No database, CMS schema, content migration, public route, or API change is
  planned.
- Public pages stay prerendered; `/preview/[id]` remains the sole runtime HTML
  route and uses the same shared visual components.
- Font assets are self-hosted and covered by production CSP. No remote runtime
  asset is introduced.
- Theme storage key and prepaint behavior stay backward compatible, so existing
  user theme choices survive deployment.
- The work can roll back as one presentation commit because it does not migrate
  data. Generated build/media output is rebuilt from source rather than edited.

## Trade-offs And Deliberate Deviations

- Exact reference content, identity, imagery, counters, clock, 3D view, and Vue
  implementation are excluded; their visual slots are mapped to real blog data.
- AA contrast, zero letter spacing, 44px controls, visible focus, no essential
  opacity gating, and no fully raised nested cards take precedence over defects
  in the reference implementation.
- The mobile featured-writing-first order intentionally differs from the
  reference's author-first order to protect the site's primary reading action.
- Browser font rasterization and Chinese platform fallback can differ by OS;
  shipped Latin font files, CSS metrics, weights, and line heights remain fixed.
