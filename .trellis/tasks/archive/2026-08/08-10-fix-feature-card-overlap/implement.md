# Implementation plan

1. Update `src/pages/topics/index.astro` to render a semantic grid of full-card
   topic links with local markers, headings, and published-content counts.
2. Replace the topic-directory row CSS with the measured three/two/one-column
   selector grid, centered card content, existing material tokens, and distinct
   hover/focus/active states, including the centered topic-only page header.
3. Convert the featured media layout to non-overlapping grid columns, retain the
   mobile stack, tune the image crop, and reduce the responsive featured-title
   scale.
4. Reduce the shared discovery-page heading and lead sizes while preserving the
   16px body and long-form prose baselines.
5. Extend `tests/e2e/visual-contract.spec.ts` with featured sibling-boundary,
   topic-grid geometry, interaction-state, responsive, and computed-type
   assertions.
6. Run focused formatting, type checking, and Playwright visual contracts; take
   desktop and mobile screenshots and inspect them for overlap and overflow.
7. Run `pnpm verify`. If a regression appears, revert only the owning selector
   or assertion, then re-run the focused gate before the full gate.

## Risk points

- Percentage or absolute-positioned featured children can recreate overlap;
  test child bounding boxes directly.
- The responsive topic grid can squeeze at transition widths; test 1440, 1024,
  768, 640, and 390px.
- Broad type-token edits could affect article reading; keep size changes scoped
  to discovery headings and the featured title.
- Existing screenshots may use a long CMS title; validate real rendered content,
  not only fixture-length strings.
