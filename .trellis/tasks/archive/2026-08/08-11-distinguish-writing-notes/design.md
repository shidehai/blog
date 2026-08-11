# Technical Design

## Boundaries

- Keep `src/pages/writing/index.astro` and `src/pages/notes/index.astro` as the two public route owners.
- Reuse `PostList` / `PostListRow` for content semantics and links; add only route-scoped classes or small semantic wrappers where the presentation needs to diverge.
- Keep shared tokens and material recipes in `src/styles/global.css`; do not introduce a second CSS system or client island.

## Presentation Model

- Writing remains a categorized discovery surface: its existing tutorial/article sections, counts, section copy, reading minutes, and topic links stay visible.
- Notes becomes a compact chronological stream: preserve title, summary, date, and topic links, while using a lighter row rhythm and an explicit timeline/stream landmark so the page is not perceived as the same grouped writing index.
- Page descriptions and toolbar labels should describe the distinct jobs of each route. Existing topic/archive links remain available for cross-navigation.

## Compatibility and Accessibility

- Data filters remain unchanged (`article`/`tutorial` vs `note`), so no content or URL migration is needed.
- Keep `prerender = true`, heading order, landmark labels, `aria-current`, keyboard focus styles, and empty-state cross-links.
- CSS must work in light/dark themes, reduced motion, forced colors, and the existing inclusive breakpoints (`64rem`, `48rem`, `40rem`).

## Verification

- Add or update browser assertions for route-specific landmarks/classes and content-type separation.
- Run focused formatting/lint/type/unit checks, then the full `pnpm verify` gate if the environment supports the production browser run.
