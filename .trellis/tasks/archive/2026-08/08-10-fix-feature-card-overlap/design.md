# Technical design

## Boundaries

- `src/components/FeaturePost.astro` keeps its existing semantic sibling
  structure. The featured-card correction is owned by `src/styles/global.css`.
- `src/pages/topics/index.astro` owns the topic overview information hierarchy.
  Existing `/topics/[slug]/` routes continue to own descriptions and article
  discovery.
- `src/styles/global.css` remains the single source for typography, layout,
  material states, and responsive behavior. No new dependency or client script
  is introduced.
- `tests/e2e/visual-contract.spec.ts` proves geometry, computed type, responsive
  behavior, and interaction contracts.

## Featured card

Use real grid columns for copy and media. The copy remains in the first column
and the media remains in the second; neither receives a percentage width that
crosses the grid boundary. Keep one curved edge on the media as a visual
transition and use an explicit object position that favors the diagram's stage
nodes. At the existing 48rem breakpoint, retain the current copy-above-media
stack. If the two-column card becomes too narrow immediately above that page
breakpoint, use a component-width condition rather than creating a new global
viewport breakpoint.

## Topic overview

The overview becomes a semantic `ul` of full-card anchors. Each anchor contains
a 64px visual topic marker, an `h2`, and a published-content count. The marker
uses deterministic route-local text derived from the topic name, so the page
has a visual anchor without copying the reference icons or adding an icon
runtime. Descriptions and latest-post data are removed only from this overview;
the information remains available on each existing detail route.

The grid keeps the established 900px discovery width and 24px gap. An auto-fill
minimum track of 220px produces three 284px columns at 1440px, three 224px
columns at 768px, two columns through narrower tablet widths, and one 342px
column at 390px. The topic page adds 8px inline padding inside the existing 16px
mobile shell gutter to reproduce the reference's 24px total gutter. Cards reuse
`--radius-module`, `--depth-raised`, `--depth-lifted`, and `--depth-pressed`.
The anchor fills the card, so the visible affordance and hit area are the same
element. Only the topic overview's shared page header is centered.

## Typography

Do not change the 16px body baseline, self-hosted Inter stack, article prose, or
navigation target geometry. Reduce the shared discovery-page display pair from
40px/18px to 32px/16px. Reduce the featured title through existing desktop,
tablet, and mobile selectors so the title no longer dominates the media or
forces excessive wrapping. Secondary list and metadata sizes already sit in the
reference's 12-14px range and remain unchanged.

## Compatibility and rollback

All output remains prerendered HTML and CSS and stays usable without JavaScript.
Light/dark tokens, forced-colors fallbacks, reduced-motion behavior, and the
64/48/40rem responsive contract remain intact. Rollback is a direct revert of
the page markup, related CSS selectors, and focused visual assertions; no data
migration or CMS change is involved.
