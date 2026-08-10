# Refine featured card, topic directory, and type scale

## Goal

Make the public site feel as compact and deliberate as the approved reference:
repair the homepage featured card, reshape the topic directory into a scannable
category grid, and reduce oversized display text without compromising body-copy
readability.

## Background

- The reported desktop screenshot shows the featured copy surface visibly
  covering the media region.
- In `src/styles/global.css`, `.feature-post.has-media .feature-post-copy` uses
  `inline-size: 70%` while `.feature-post-media` occupies the rightmost `55%`.
  The resulting 25% overlap is structural, not caused by the CMS title.
- The current featured title is substantially longer than the old fixture and
  exposes the overlap more clearly.
- At 1440px, `https://aiayy.cn/category` renders a centered 900px three-column
  grid with 284px cards, 24px gaps, 48px/32px card padding, 30px radii, a 64px
  visual marker, 16px titles, and 13px counts. At 390px it becomes a single
  342px column inside 24px page gutters.
- The local topic route instead renders six 900px-wide information rows with a
  topic name, count, description, latest post, and date in each row. This makes
  the overview slower to scan and does not match the requested category-grid
  layout.
- Local display sizes are visibly larger than the reference: the shared page
  heading is 40px/18px rather than 32px/16px, and the desktop featured title is
  52px. The site body is already the reference's readable 16px and must not be
  reduced below that baseline.
- The established palette, self-hosted Inter typography, shadows, radii,
  64/48/40rem breakpoints, feature-first mobile order, and responsive diagram
  remain the approved visual foundation.

## Requirements

- On desktop and tablet, place the featured copy and media in coordinated grid
  columns so their layout boxes do not overlap.
- Retain one restrained curved media edge as the transition between copy and
  diagram; it must not read as a second card laid over the first.
- Frame the diagram on its useful stage content rather than showing a clipped
  fragment of its title.
- Keep the full current title, summary, topic, and primary action legible and
  contained while reducing the featured display title from its oversized
  desktop treatment.
- Preserve the existing stacked mobile composition, semantic HTML, keyboard
  states, light/dark themes, reduced motion, and no-JavaScript behavior.
- Add a browser regression assertion that the copy and media bounding boxes do
  not intersect at representative desktop and tablet widths.
- Replace the topic overview rows with a centered responsive selector grid that
  mirrors the reference geometry: three columns at wide desktop and 768px,
  two when space is constrained further, and one on narrow mobile screens.
- Center the topic-page heading and supporting copy over the grid, matching the
  reference page's overview hierarchy without changing headings on article or
  detail routes.
- Make each topic card one complete link containing a local topic marker, topic
  name, and published-content count. Keep descriptions and latest-post details
  on the existing topic detail routes instead of repeating them in the overview.
- Reuse local content, URLs, palette, radius, depth, and typography tokens; do
  not copy reference-site names, icons, article data, imagery, or source code.
- Use raised, lifted, focus, and pressed states consistently: hover/focus lifts
  the whole topic card, and active presses it inward.
- Calibrate display typography to the reference density: shared page headings
  use 32px titles and 16px supporting copy; the featured title uses a compact
  responsive scale. Keep navigation at 14px, body at 16px, secondary metadata at
  12-14px, and long-form article prose unchanged.

## Acceptance Criteria

- [ ] At 1440px and 1024px, the copy and media boxes have no horizontal
      intersection and all featured content stays inside the card.
- [ ] At 768px and below, the existing copy-above-media stack remains intact,
      with no clipping or page overflow.
- [ ] The diagram remains decoded and visually useful; its stage boxes are the
      dominant crop instead of a partial heading fragment.
- [ ] Light/dark, focus, hover, active, 200% text, and reduced-motion contracts
      remain unchanged.
- [ ] Focused Playwright coverage and the full frontend verification gate pass.
- [ ] Fresh desktop and mobile screenshots show no incoherent overlap.
- [ ] At 1440px, `/topics/` displays a centered 900px three-column grid with
      24px gaps; topic cards use the established 30px module radius, raised
      depth, centered marker/name/count hierarchy, and a full-card link.
- [ ] At tablet widths the topic grid reduces without squeezed text, and at
      768px it remains three 224px columns; at 390px it is one 342px column
      inside 24px total page gutters with no horizontal overflow.
- [ ] Topic card hover/focus and active states are visually distinct and every
      card remains keyboard operable with at least a 44px interactive target.
- [ ] Shared discovery-page headings compute to 32px/16px on desktop, the
      featured title is smaller than its current 52px desktop size, and body and
      long-form prose remain at least 16px.

## Out of Scope

- Changing homepage content, site identity, publication data, topic data, or
  article media.
- Redesigning other Bento modules, global material tokens, typography, or
  breakpoints.
- Removing the feature card's media or replacing the reliability diagram.
- Copying the reference site's identity, icons, content, images, or frontend
  source code.
- Adding client-side topic expansion, a new icon dependency, or changing topic
  detail pages.
