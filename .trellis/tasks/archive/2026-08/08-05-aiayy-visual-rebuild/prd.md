# Reproduce aiayy visual system

## Goal

Rework the public blog so its frontend reproduces the visual system and
responsive material behavior of <https://aiayy.cn/> at 1:1 design-system
fidelity, while preserving this site's content, information architecture,
identity, Directus-backed publishing flow, and accessible reading experience.

The result should feel like the same visual system across the entire site, not
like a reference-inspired homepage attached to otherwise unchanged routes.

## Background

- The user explicitly requested 1:1 fidelity for card radii, shadows, theme
  colors, font family, font sizes, and the overall frontend style, and allowed
  direct browser inspection and iterative visual debugging.
- `PRODUCT.md` identifies the product as a personal knowledge journal for
  developers, learners, and curious peers. Reading remains its primary action.
- `DESIGN.md` already names aiayy.cn as the primary visual reference and maps
  its floating header, asymmetric Bento composition, paired soft shadows,
  clipped media hero, and light/dark behavior to this site's own content.
- The current Astro frontend already implements a first-pass neumorphic token
  system, floating navigation, light/dark themes, a Bento-like homepage, and a
  flatter long-form reading plane. This task calibrates and completes that
  system rather than replacing the content or publishing architecture.

## Requirements

### R1. Reference fidelity

- Download and retain a reproducible research snapshot of the reference site's
  publicly served HTML, CSS, JavaScript bundles, and font declarations, with
  origin URLs and content hashes. Exclude credentials and binary media assets.
- Treat those deployed bundles as primary evidence for exact design tokens,
  breakpoints, component geometry, and transitions; validate the extracted
  rules against browser-computed styles and screenshots.
- Derive typography, colors, spacing, radii, shadows, layout geometry,
  breakpoints, transitions, and interactive states from browser-observed
  reference evidence at representative desktop, tablet, and mobile viewports.
- Use the reference's deployed core light/dark palette and Inter Latin family
  with the same shipped weights. Self-host the font under its license and retain
  a robust platform Chinese fallback; do not add a runtime Google Fonts request.
- Centralize shared values in the existing global token layer. Components must
  not invent unrelated private shadow, color, or radius systems.
- Match the reference's material behavior in both light and dark themes,
  including raised, inset, pressed, floating, and hover states, while supplying
  the explicit accessible focus state missing from the reference.

### R2. Site-wide application

- Apply the calibrated system to the shared header, mobile navigation, footer,
  page background, controls, typography, links, metadata, and focus treatment.
- Recompose the homepage using this site's real author identity, featured
  writing, notes, topics, and discovery shortcuts in a reference-faithful
  asymmetric Bento hierarchy.
- Bring writing, notes, topics, topic detail, archive, search, about, article,
  note, preview, empty, and 404 surfaces into the same visual system.
- Preserve a flatter, high-contrast prose column for sustained reading while
  matching the shell, media, code, outline, table, callout, and utility-control
  treatments to the reference language.

### R3. Identity and content integrity

- Keep all existing routes, Chinese labels, content records, author identity,
  metadata, real article media, and Directus-backed data flow.
- Do not copy the reference site's logo, avatar, wording, navigation labels,
  stock imagery, counters, clocks, 3D scene, source code, or other proprietary
  assets/content.
- Reimplement the measured behavior in this project's Astro components and
  token layer; do not paste whole minified bundles or transplant unrelated
  reference implementation code into the product.
- Use the project's existing real media. When media is absent, use a
  content-led treatment rather than a copied or generic stock asset.

### R4. Responsive and interaction behavior

- Support at least 320px mobile width through wide desktop without overflow,
  overlap, clipped text, layout shift, or inaccessible off-screen controls.
- Preserve the mobile reading-first order: featured writing precedes expanded
  author/profile material on narrow screens.
- Keep theme selection before first paint, native keyboard behavior, visible
  current-page state, and predictable mobile navigation/focus handling.
- Motion must remain optional under `prefers-reduced-motion`; essential content
  is visible without JavaScript and is never gated by entrance animation.

### R5. Accessibility and production constraints

- Preserve semantic landmarks, heading order, skip navigation, useful alt
  text, keyboard access, visible focus, forced-colors support, and WCAG 2.2 AA
  contrast. Where the reference conflicts with these invariants, reproduce its
  composition/material intent while correcting the defect.
- Keep public routes prerendered and Astro-first. Do not add a client framework,
  global runtime, local Markdown store, or visual dependency when CSS/native
  browser behavior covers the requirement.
- Do not alter Directus schemas, content normalization, search indexing,
  metadata contracts, RSS/sitemap behavior, or deployment architecture unless
  a verified visual requirement makes a narrowly scoped change necessary.

### R6. Evidence-based visual verification

- Establish reference and local baseline screenshots at fixed desktop, tablet,
  and mobile viewports before implementation.
- After implementation, compare representative routes and interaction states in
  light and dark themes using screenshots and computed-style checks.
- Validate fonts, font sizes, primary colors, module radii, shadow recipes,
  container geometry, header behavior, responsive ordering, and overflow
  explicitly rather than relying only on subjective inspection.

## Acceptance Criteria

- [x] AC1: At 1440x900, 768x1024, and 390x844, the homepage's shell, header,
      Bento proportions, gaps, card geometry, radii, paired shadows, typography,
      and theme materials match the documented reference while showing this
      site's own content. Shared CSS constants are exact; content-independent
      geometry is within 1 CSS px for spacing/radii and 2 CSS px for boxes,
      except the deliberate accessibility/product deviations in `design.md`.
- [x] AC1a: The task retains a URL-and-hash manifest for the downloaded public
      HTML/CSS/JS/font-declaration snapshot, and every calibrated core token or
      breakpoint is traceable to bundle evidence or a browser measurement.
- [x] AC2: Light and dark themes use one coherent calibrated surface system;
      theme switching is stable before paint and every raised/inset/pressed
      control remains legible and visually consistent.
- [x] AC3: Every public HTML route uses the calibrated shared typography,
      background, navigation, footer, controls, metadata, links, and focus
      states; no route visibly falls back to the previous visual language.
- [x] AC4: Writing/note detail pages preserve comfortable long-form reading,
      readable code and tables, working outline/progress/copy behavior, and
      reference-consistent surrounding surfaces in both themes.
- [x] AC5: At 320px and the fixed mobile/tablet/desktop viewports, automated and
      manual browser checks find no horizontal page overflow, incoherent
      overlap, truncated controls, text escaping its container, or content
      hidden behind the floating header/navigation.
- [x] AC6: Keyboard navigation, skip link, native mobile menu, theme control,
      search, visible focus, reduced motion, forced colors, and WCAG 2.2 AA
      checks continue to pass; reference-site defects are not inherited.
- [x] AC7: Existing route/content behavior, Directus-backed builds, Pagefind,
      metadata, RSS, sitemaps, preview behavior, and public prerender contracts
      remain intact.
- [x] AC8: Browser evidence is retained for the representative homepage,
      discovery/list, article, search/empty, mobile navigation, compact header,
      and light/dark states, with key computed measurements recorded.
- [x] AC9: `pnpm verify` and final visual regression checks pass from the
      production build used for handoff.
- [x] AC10: Inter is served locally in every used UI weight with its license,
      no page requests Google Fonts at runtime, and mixed Chinese/Latin text
      retains stable wrapping across the required viewports.

## Out Of Scope

- Copying the reference site's identity, copy, data, imagery, icons, source
  implementation, counters, clock, 3D module, or route set.
- Changing the CMS schema, authoring workflow, publishing model, backend,
  deployment topology, or adding reader accounts/social engagement features.
- Rewriting published article or note content to resemble the reference site.
- Pixel-equal raster output where text/content length, operating-system font
  rasterization, accessibility corrections, or proprietary reference assets
  make literal screenshot identity impossible.

## Technical Notes

- Implementation is expected to concentrate in `src/styles/global.css` and the
  existing shared Astro components/layouts. Markup changes should be driven by
  verified layout or accessibility needs.
- Reference measurements, source hashes, the local frontend inventory, and the
  complete pre-implementation screenshot/computed-style baseline are persisted
  under `research/`.
- No blocking product questions remain: the user's request establishes full
  public-site scope, browser-based fidelity review, and permission to proceed;
  repository contracts establish the accessibility and content-integrity
  boundaries.
