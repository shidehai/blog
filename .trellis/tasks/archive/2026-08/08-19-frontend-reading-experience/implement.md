# Implementation Plan: Frontend Reading Experience & Polish

## Execution Shape

This task delivers 5 frontend enhancements in a coherent, test-driven flow. All changes are purely client/build-side within Astro, CSS, and Markdown pipelines, requiring no changes to the backend schema.

---

## 1. Article Context & Sequence Navigation (上一篇 / 下一篇)

- [x] Add `deriveChronologicalNavigation(currentPost, allPosts)` in `src/lib/content.ts` returning `{ prevPost, nextPost }`.
- [x] Create `src/components/ArticleNavigation.astro` rendering responsive Prev/Next navigation cards with dates, titles, and topic hints.
- [x] Integrate `ArticleNavigation` into `src/components/PostPage.astro`.
- [x] Add unit tests in `tests/unit/discovery.test.ts` or `tests/unit/content.test.ts`.

## 2. Article Sharing & Markdown Citation (分享与引用)

- [x] Create `src/components/ArticleShare.astro` with Copy URL and Copy Markdown Citation actions and toast feedback.
- [x] Integrate `ArticleShare` into `src/components/PostPage.astro`.
- [x] Ensure full keyboard accessibility and screen-reader `aria-live` announcements.
- [x] Add E2E tests verifying clipboard interaction and visual feedback.

## 3. Code Block Ergonomics (代码块打磨)

- [x] Update `src/lib/markdown.ts` and `src/components/CodeBlock.astro` to expose explicit language badges.
- [x] Implement collapsible code blocks for snippets exceeding 35 lines with gradient fade and toggle button in `src/components/CodeCopyBehavior.astro`.
- [x] Update `src/styles/global.css` with language tag badges, line contrast, and collapsible container styling.
- [x] Add E2E tests verifying code block expand/collapse and language indicators.

## 4. Mermaid Architecture Diagrams (静态架构图)

- [x] Add Mermaid block detection and static SVG transformation in `src/lib/markdown.ts`.
- [x] Style Mermaid SVG diagrams in `src/styles/global.css` with responsive containers and dark/light color scheme adaptability.
- [x] Add unit tests in `tests/unit/markdown.test.ts` verifying ````mermaid` blocks render into valid static SVG without runtime JS.

## 5. Interactive Polish & Visual Nuances (微交互与质感)

- [x] Update `src/components/ThemeControl.astro` to implement circular `document.startViewTransition()` animations with safe fallback.
- [x] Inject `#` heading permalink anchors on `<h2>` and `<h3>` elements in `src/lib/markdown.ts`.
- [x] Add CSS for heading anchors, smooth scroll alignment (`scroll-margin-top`), and subtle hover transitions in `src/styles/global.css`.
- [x] Add E2E tests for heading permalinks and view transitions.

## 6. Full Verification & Review Gates

- [x] Run `pnpm format:check` (2026-08-19 remediation pass)
- [x] Run `pnpm lint` (2026-08-19 remediation pass)
- [x] Run `pnpm typecheck` (2026-08-19 remediation pass: 91 files, 0 diagnostics)
- [x] Run `pnpm test:unit` (2026-08-19 final remediation pass: 80 tests)
- [x] Run `pnpm build` (2026-08-19 remediation pass)
- [x] Run `pnpm test:operations` (2026-08-19 remediation pass; CSP hashes verified)
- [x] Run `pnpm test:e2e` including Axe a11y checks (2026-08-19 remediation pass: 69 tests)
- [x] Review scoped diff with `git diff --check` (2026-08-19 remediation pass)
