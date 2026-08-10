# Research: Visual polish validation plan

- Query: Define a focused, measurable browser and screenshot validation plan for
  polishing the established frontend while adding a denser collection of Chinese
  AI engineering content.
- Scope: internal
- Date: 2026-08-10

## Findings

### Executive summary

The previous rebuild left a strong **material contract** but only a partial
**publication-content contract**. Existing Playwright coverage precisely asserts
the two themes, 1200px shell, breakpoint geometry, mobile ordering, 44px targets,
long homepage copy, search states, reduced motion, forced colors, and document
overflow. The archived handoff also retained a useful 390/768/1440 screenshot
set. That foundation should remain release-blocking.

This task changes the risk profile. The archived candidate contains only two
pieces of writing and one note, so its screenshots cannot establish whether the
homepage, writing, notes, topics, archive, related-content lists, and search
results remain coherent with a real AI content collection. The richest article
evidence is a short one-minute fixture tutorial. There is no retained visual
evidence for topics, topic detail, notes, archive, a note detail, a long outline,
or multiple dense code/reference sections.

The focused validation strategy should therefore:

1. Keep exact computed-style and geometry checks for the calibrated shell.
2. Add content-driven assertions using the actual longest/densest new records.
3. Capture a small deterministic desktop/mobile matrix covering every distinct
   page shape rather than every route/theme permutation.
4. Treat screenshots as human-review evidence, with semantic assertions as the
   release oracle, as required by the frontend quality spec.
5. Fix the overflow helper's blind spot: it finds out-of-viewport elements but
   currently asserts only document `scrollWidth`, while the root deliberately
   uses `overflow-x: clip`.

### Product and design constraints that define “polished”

- Reading is the primary action and proof comes from runnable code, diagrams,
  linked sources, and the maintained archive (`PRODUCT.md:35-45`). The validation
  matrix must put homepage feature visibility and long-form artifacts ahead of
  ornamental shell states.
- The article plane must stay flatter, higher contrast, and quieter than the
  tactile discovery shell (`PRODUCT.md:70-86`, `DESIGN.md:75-88`). More content
  is not permission to wrap prose sections in repeated raised cards.
- The homepage must remain asymmetric and priority-led, while discovery routes
  remain quieter lists rather than becoming uniform card grids
  (`DESIGN.md:108-111`, `DESIGN.md:147-160`).
- Mobile must place the featured piece before the author profile
  (`DESIGN.md:127-129`). This is already encoded in the DOM and tests and should
  stay exact.
- Body measure remains 34-42 Han glyphs or 65-75 Latin characters; desktop prose
  is 17px, mobile prose is 16px, and Chinese line-height is about 1.75-1.9
  (`DESIGN.md:57-73`).
- WCAG 2.2 AA, keyboard access, visible focus, zoom, high contrast, and reduced
  motion are explicit product requirements (`PRODUCT.md:88-93`).

### Files found

| File or evidence | Description |
| --- | --- |
| `PRODUCT.md` | Reading-first purpose, proof model, anti-references, and WCAG 2.2 AA contract. |
| `DESIGN.md` | Calibrated material, typography, article-plane, responsive-order, motion, and content-artifact rules. |
| `.trellis/spec/frontend/component-guidelines.md` | Shared component ownership and exact visual token/breakpoint contract. |
| `.trellis/spec/frontend/quality-guidelines.md` | Requires semantic computed-style/geometry assertions; screenshots are supporting evidence. |
| `.trellis/tasks/08-10-polish-ai-content/prd.md` | Current task asks for real content density, all three post types, both themes, and 320px/long-content safety. |
| `.trellis/tasks/archive/2026-08/08-05-aiayy-visual-rebuild/research/local-candidate/verification-summary.md` | Previous passing gate and manual evidence summary. |
| `.trellis/tasks/archive/2026-08/08-05-aiayy-visual-rebuild/research/local-candidate/capture-local-candidate.mjs` | Reproducible Chromium/DPR 1/reduced-motion capture method. |
| `.trellis/tasks/archive/2026-08/08-05-aiayy-visual-rebuild/research/local-candidate/*.png` | Archived full-page and viewport screenshots for home, writing, one tutorial, search, shell, about, and 404. |
| `tests/e2e/visual-contract.spec.ts` | Exact token, geometry, breakpoint, overflow, long-copy, search-state, reduced-motion, and forced-colors checks. |
| `tests/e2e/visual-assertions.ts` | Shared geometry, hit-target, material, and overflow helpers. |
| `tests/e2e/reading.spec.ts` | One tutorial's artifact presence, mobile outline, copy, JS-off, and print contracts. |
| `tests/e2e/a11y.spec.ts` | Serious/critical Axe scans for six default-state routes plus trusted preview. |
| `tests/e2e/discovery.spec.ts` | Search query/filter behavior and one 320px search-shell overflow check. |
| `tests/e2e/shell.spec.ts` | Four home widths, menu/focus, theme persistence, header compaction, 200% text, reduced motion, and forced colors. |
| `src/styles/global.css` | Authoritative tokens and all shell, homepage, discovery, reading, responsive, forced-color, and print styles. |
| `src/pages/index.astro` | Homepage selection and module composition. |
| `src/components/FeaturePost.astro` | Media/no-media feature variants and responsive-image sizing. |
| `src/components/PostPage.astro` | Shared article/tutorial/note/preview reading surface. |
| `src/pages/search/index.astro` | Search default/loading/results/empty/error DOM and route-local visual styles. |
| `src/pages/topics/index.astro`, `src/pages/topics/[slug].astro`, `src/pages/archive/index.astro` | Dense discovery shapes not represented in archived screenshot evidence. |

### What is already well covered

- Exact light/dark surface, ink, signal, paired shadows, Inter family, 16px shell
  base, 30px header radius, and row surface are asserted at
  `tests/e2e/visual-contract.spec.ts:87-121`.
- Desktop, 1024px, 768px, and 640px homepage geometry and ordering are asserted
  within a 2px tolerance (`tests/e2e/visual-contract.spec.ts:123-298`, helper at
  `tests/e2e/visual-assertions.ts:25-37`).
- Header compaction is pinned to `scrollY > 100`, including 720x48 compact
  geometry and target size (`tests/e2e/visual-contract.spec.ts:300-338`).
- Mobile navigation verifies two columns, floating material, and every 44px
  target (`tests/e2e/visual-contract.spec.ts:340-381`); separate shell coverage
  verifies Escape/close focus restoration (`tests/e2e/shell.spec.ts:28-48`).
- Home, writing, search, and one tutorial are checked in both themes at 1440 and
  390, plus at 320px for document overflow
  (`tests/e2e/visual-contract.spec.ts:383-475`).
- The homepage is stress-tested with very long author copy and six long mixed-
  script topic labels (`tests/e2e/visual-contract.spec.ts:477-531`).
- Search default, loading, result, empty, reset, restored URL, and failure states
  are behaviorally covered (`tests/e2e/visual-contract.spec.ts:533-612`).
- The previous handoff reported 55 passing Chromium tests, including 22 visual
  contracts, and retained 19 fresh route/state captures
  (`.../local-candidate/verification-summary.md:9-38`). Treat that as the
  pre-content baseline, not a current pass result.

### Concrete visual issues and evidence gaps

#### P0: clipped content can pass the current “no overflow” helper

`html` and `body` both use `overflow-x: clip` (`src/styles/global.css:165-176`).
The helper correctly computes elements whose boxes extend more than 1px beyond
the viewport, but it only asserts `documentElement.scrollWidth <= clientWidth`;
the `offenders` array appears only in the failure message
(`tests/e2e/visual-assertions.ts:82-111`). A long technical identifier, topic
label, filter, or code-adjacent control can therefore be visibly clipped while
the assertion still passes. New AI titles and terminology make this a concrete
risk.

Recommended closure: assert `offenders` is empty after explicitly excluding
declared horizontal scrollers (`.code-frame pre`, `.table-wrapper`) and
top-layer/popover elements. Keep the document-width assertion too.

#### P0: current visual evidence is too sparse for this task

The archived desktop homepage visibly contains one latest-writing row, two
topics, and large quiet areas; the writing page contains only one tutorial and
one article. That matches the task background that the current site still reads
as a sparse fixture (`.trellis/tasks/08-10-polish-ai-content/prd.md:11-19`). The
new collection changes row counts, page height, title wrapping, topic-chip
wrapping, related-content density, search-result volume, and archive grouping.
Every retained raster predates those changes.

Recommended closure: recapture from the final production fixture after Pagefind
indexing, using the final real content rather than DOM-injected dummy text.

#### P1: distinct discovery routes have no retained visual review

The archived capture script covers writing, one tutorial, search, about, 404,
mobile menu, and compact/resting header
(`.../capture-local-candidate.mjs:223-394`). It does not capture `/notes/`,
`/topics/`, a populated topic detail, or `/archive/`. Those routes have distinct
layouts: dense note rows, two-column topic-directory rows, mixed writing/note
sections, and year rails (`src/styles/global.css:1674-1832`). They are precisely
the surfaces most affected by the new content.

#### P1: article coverage proves presence, not long-form composition

`reading.spec.ts` checks that one tutorial exposes a rail, table, callout,
footnotes, code, and image, but does not measure typography, successive-section
overlap, sticky rail bounds, progress behavior, outline navigation, image decode,
or internal code/table scrolling (`tests/e2e/reading.spec.ts:25-56`). No E2E test
opens a note detail or a second article/tutorial shape. The archived article is
a short one-minute fixture, not a dense AI tutorial with a long outline,
multiple code blocks, references, and mixed Chinese/Latin technical prose.

Recommended closure: select three canonical records from the final collection:
the richest tutorial, the longest conceptual article, and the shortest note.
Do not manufacture a special visual-only route.

#### P1: search result copy is visually noisy in archived evidence

The archived dark mobile result screenshot shows excerpts repeating the result
title and trailing date/topic metadata. The renderer derives an excerpt from
Pagefind `excerpt || content` and then prepends separately-rendered metadata and
title (`src/pages/search/index.astro:223-230`, `src/pages/search/index.astro:335-367`).
Current tests assert result counts and links, not excerpt quality or card height
with long results (`tests/e2e/discovery.spec.ts:111-173`). More AI content will
amplify duplicated or overlong snippets.

Recommended closure: visually inspect a broad query, a type-only filter, and an
exact technical query. Assert each result has one heading, one metadata line,
and a nonempty excerpt that stays inside its card; manually reject obvious title
or metadata duplication.

#### P1: accessibility checks do not cover theme/state parity

Axe runs only the default render of home, one tutorial, notes, search, about,
404, and trusted preview, and filters to serious/critical findings
(`tests/e2e/a11y.spec.ts:4-39`). It does not scan dark mode, the open mobile menu,
populated search results, topic/archive pages, or a note detail. Material relief
depends on subtle adjacent tones, so dark and light state parity should be
explicit even though core token contrast was previously calculated.

#### P2: no checked-in Playwright screenshot oracle exists

There are no `toHaveScreenshot` calls. The archived probe calls
`page.screenshot()` and writes a report outside the normal test gate. This is
consistent with the local rule that screenshots support rather than replace
semantic assertions (`.trellis/spec/frontend/quality-guidelines.md:15-27`), but
it means future changes cannot detect an unreviewed visual drift automatically.

Recommended closure: keep full-page captures as task-local human evidence. If
snapshot tests are added, limit them to stable crops such as the resting header,
open mobile menu, feature module, post row, code frame, and search result. Do not
compare the new content-rich full pages pixel-for-pixel with the sparse archived
fixtures.

#### P2: interactive visual states are mostly behavior-only

Focus restoration, current-route state, theme persistence, and copy feedback are
tested, but focused controls, hover/pressed material, open mobile menu in dark
mode, open mobile article outline, active reading progress, and sticky outline
at mid-article are not retained as visual evidence. These states are part of the
design language (`DESIGN.md:113-125`) and are cheap to include as viewport
captures.

### Recommended acceptance thresholds

These thresholds preserve the existing calibrated system while testing the
content added by this task.

| Concern | Release threshold |
| --- | --- |
| Document overflow | At 320, 390, 768, 1024, 1440, and 1920 widths: `scrollWidth <= clientWidth`; after scroller exclusions, zero visible element boxes beyond `[-1px, clientWidth + 1px]`. |
| Component containment | For feature, identity, homepage information modules, post/topic/archive/search rows, article header, related rows, and footer: `scrollHeight <= clientHeight + 1` and `scrollWidth <= clientWidth + 1`, except explicit code/table scrollers. |
| Internal scrollers | Wide code and tables may have `scrollWidth > clientWidth`, but their outer frame right/left edges remain within the prose column and the document remains unexpanded. Both must be keyboard focusable and horizontally scrollable. |
| Geometry | Preserve existing exact tokens; computed box checks remain within the established 2 CSS px tolerance. Shared spacing/radius constants remain exact. |
| Responsive order | At 768px and below, feature DOM/visual top precedes identity; topics precede discovery paths. At 640px and below, information modules form one column. |
| First viewport | At 390x844, feature heading and primary “start reading” action are fully visible before the identity module. At 1440x900, the complete profile/feature row is visible. At 320x800, at minimum the feature heading and CTA are visible without scroll. |
| Reading measure | At 1440, prose remains 17px/1.85 and no wider than 72ch (historically 720px); at 390/320 it is 16px with the same line-height range and fills the available shell without page overflow. |
| Titles and metadata | The longest real Chinese/Latin title, topic, date, reading time, and filter labels never overlap, escape, or clip. Wrapping may increase row/module height. Intentional summary clamps remain at two lines and do not hide commands. |
| Hit targets | Every standalone button/link well in header, menu, search, outline summary, copy control, and key CTAs is at least 44x44 CSS px. Inline prose links are exempt. |
| Contrast | Zero serious/critical Axe violations in light and dark representative states; normal text at least 4.5:1, large text and non-text UI boundaries at least 3:1. Preserve the documented light signal ratios of 4.53:1 and 4.52:1 or improve them. |
| Motion | With reduced motion, relevant animation/transition durations remain <= 0.01ms and all content is visible immediately. With normal motion, hover lift is <= 3px and does not reflow surrounding content. |
| Media | Every visible product-owned image has `naturalWidth > 0`, correct intrinsic dimensions, no layout shift after `document.fonts.ready` and image decode, and no distorted aspect ratio. |
| Content density | Final populated routes expose no content-empty state where applicable. Homepage recent-writing count matches its selection rule, topics/counts agree with discovery pages, archive rows equal published posts, and related rows are distinct from the current post. |
| Runtime hygiene | Every capture returns the expected status, with zero page errors, unexpected console errors, failed product-asset requests, or Google Fonts requests. |

For optional cropped `toHaveScreenshot` checks after human approval, use the
bundled Chromium at DPR 1, reduced motion, fonts/images settled, animations
disabled, and a conservative `threshold: 0.2` plus
`maxDiffPixelRatio: 0.01`. Full-page editorial captures should remain manual
evidence because copy and page height are intentional task outputs.

### Browser and screenshot verification matrix

`F` = full-page screenshot, `V` = viewport/state screenshot, `A` = semantic
assertions. Use explicit stored themes and `prefers-reduced-motion: reduce` for
all baseline captures unless the row specifically tests normal motion.

| Priority | Route/state | 1440x1000 | 768x1024 | 390x844 | 320x800 | What it proves |
| --- | --- | --- | --- | --- | --- | --- |
| P0 | `/`, final feature with media, resting | Light+dark `F,A` | Light `F,A` | Light+dark `F,A` | `A` | Real content density, feature/profile geometry, first viewport, mixed-script wrapping, theme parity. |
| P0 | `/`, scrollY 101 / compact header | Light `V,A` | - | Dark `V,A` | - | Compact frame, unobscured content, fixed-position stability. |
| P0 | `/`, mobile menu open | - | Light `V,A` | Light+dark `V,A` | `A` | Two-column panel, backdrop, contrast, focus, targets, no collision with feature. |
| P0 | Richest tutorial | Light+dark `F,A` and mid-article `V` | - | Light+dark `F,A`, outline open `V` | `A` | Long title/outline, code/table/callout/media/footnotes/references, sticky rail/progress, internal scrollers. |
| P0 | Longest conceptual article | Light `F,A` | - | Dark `F,A` | `A` | Long prose rhythm, dense headings/references, related content, no artifact-dependent assumptions. |
| P0 | Shortest note detail | Dark `F,A` | - | Light `F,A` | `A` | Note-specific compact header, absent visible summary/read-time, minimal body and related state. |
| P0 | `/writing/`, populated tutorial+article sections | Light+dark `F,A` | - | Light+dark `F,A` | `A` | Many rows, section rhythm, longest title/topic wrapping, no repetitive visual collapse. |
| P0 | `/notes/`, populated | Light `F,A` | - | Dark `F,A` | `A` | Dense note rhythm and metadata with many short records. |
| P0 | `/topics/`, populated directory | Light `F,A` | - | Dark `F,A` | `A` | Two-column-to-stack transition, topic counts, long names/descriptions/latest titles. |
| P0 | Densest `/topics/[slug]/` | Dark `F,A` | - | Light `F,A` | `A` | Mixed writing/note sections, filter wrapping, in-page anchor offsets. |
| P0 | `/archive/`, all final posts | Light `F,A` | - | Dark `F,A` | `A` | Year rail, mixed row density, topic wrapping, exact post count. |
| P0 | `/search/`, broad query with several results | Light `F,A` | - | Dark `F,A` | `A` | Result density, excerpt quality, focus ring, long metadata, Pagefind final index. |
| P1 | `/search/`, loading -> empty -> failure -> reset | Loading `V,A` | - | Empty+failure `V,A` | - | Stable workbench height, busy/error clarity, default fallback, no control shift. |
| P1 | `/about/` and 404 | Light `F,A` | - | Dark `F,A` | - | Shared shell regression and footer spacing; low content-change risk. |
| P1 | Trusted preview of canonical rich record | Light `V,A` | - | Dark `V,A` | - | Preview truly reuses the public reading surface and keeps private/noindex chrome behavior. |
| P1 | 200% text size on home + rich article | - | Light `V,A` | - | - | Header/action separation, text reflow, no clipping or horizontal page expansion. |
| P1 | Forced colors + reduced motion | Home `V,A`; rich article `V,A` | - | - | - | Explicit boundaries, artifact legibility, visible focus, no shadow-only state. |
| P2 | Print richest tutorial | Chromium PDF or print screenshot `A` | - | - | - | No shell controls; code, URLs, tables, footnotes, and media remain useful. |

This matrix deliberately avoids multiplying every route by every theme. Theme
tokens are global and already exact-tested; alternating light/dark on secondary
routes catches local hardcoding while keeping review focused. Home, the rich
tutorial, writing, and mobile menu receive both themes because they carry most
of the visual surface area and interaction risk.

### Recommended automated additions

1. Strengthen `expectNoHorizontalOverflow` to assert both document width and an
   empty offender list, with named exceptions for internal scrollers.
2. Parameterize route-overflow coverage with the final home, writing, notes,
   topics, densest topic, archive, search-result, rich tutorial, conceptual
   article, and note routes at 320 and 390.
3. Add a real-content containment test that selects the longest title, summary,
   topic name, code filename, and unbroken technical identifier from the final
   snapshot rather than replacing only two homepage DOM nodes.
4. Extend reading E2E coverage to three post kinds and assert rail bounds,
   progress from 0 to near 1, outline anchor landing below the fixed header,
   decoded media, and code/table internal scrolling.
5. Extend Axe coverage to one dark state, the open mobile menu, populated search
   results, topics/archive, and a note detail. Keep forced-colors structural
   assertions separate because pixel colors are browser-mapped there.
6. Add content-surface count assertions so visual density reflects the generated
   collection: home selection, writing/note totals, topic counts, archive total,
   search result links, and distinct related posts.
7. Retain a fresh task-local capture script/report modeled on the archived probe:
   Chromium, DPR 1, explicit theme, reduced motion, `document.fonts.ready`, image
   decode, two animation frames, expected HTTP status, and console/network error
   collection.

### Review sequence

1. Build and index the final production fixture before any capture. Capturing a
   dev server or pre-Pagefind output invalidates search evidence.
2. Run semantic P0 assertions first. Stop on overflow, overlap, missing media,
   bad count, route, or accessibility failures.
3. Capture P0 pages and compare them side-by-side with the archived candidate for
   shell continuity, not pixel identity. The expected differences are richer
   content density and refined shared components.
4. Review desktop light and mobile dark first; they expose the widest composition
   and the hardest low-light/stacked state. Then inspect the paired themes.
5. Run P1 accessibility, forced-color, zoom, preview, and error-state checks.
6. Rerun the capture once without edits. Unexpected raster, geometry, request,
   or page-height drift between identical runs is a capture or layout-stability
   failure and must be resolved before accepting the baseline.

### External references and versions

- No external web source was needed for this plan; repository contracts and the
  retained browser evidence are authoritative.
- Browser tooling recorded in the repository: Playwright `1.62.1`,
  `@axe-core/playwright` `4.12.1`, and Chromium-only project configuration
  (`package.json:67-81`, `playwright.config.ts:13-18`).
- The archived capture environment used bundled Playwright Chromium, DPR 1,
  explicit light/dark schemes, and reduced motion
  (`.../capture-local-candidate.mjs:9-45`). Reuse those conditions for comparable
  evidence.

### Related specs

- `.trellis/spec/frontend/component-guidelines.md:13-39`: semantics,
  accessibility, shared component ownership, and centralized global visual
  tokens.
- `.trellis/spec/frontend/component-guidelines.md:41-73`: calibrated theme,
  elevation, inclusive 64rem/48rem/40rem breakpoints, content-expanding module
  heights, and search reset behavior.
- `.trellis/spec/frontend/quality-guidelines.md:3-27`: `pnpm verify` and the rule
  that computed browser assertions remain primary while screenshots support
  human comparison.
- `DESIGN.md:41-129`: palette, type measure, elevation, reading plane, content
  artifacts, annotation spine, interaction, and responsive order.
- `PRODUCT.md:70-93`: reading priority, real artifacts, quiet article plane, and
  WCAG 2.2 AA.

### Proposed spec contracts from polish regressions

These are placement and wording proposals only. No spec file was changed.

#### 1. Shiki internal scroller sizing

**Best placement:** `.trellis/spec/frontend/component-guidelines.md`, immediately
after the calibrated material/search paragraphs, as a short “Article artifact
layout” paragraph. This is a rendered-component/CSS invariant, not an
infrastructure or Markdown parsing rule.

**Proposed wording:**

> In a code frame, the generated `pre.shiki` is the horizontal scroller. Keep it
> shrinkable with `min-inline-size: 0`, bounded by the prose column, and
> `overflow: auto`; preserve long source lines inside that scroller. Do not put
> `min-inline-size: max-content` on `.shiki`, because it expands the frame and can
> be hidden by page-level overflow clipping instead of scrolling internally.

Evidence: `.code-frame pre` owns `max-inline-size: 100%` and `overflow: auto`
(`src/styles/global.css:1507-1515`), while `.code-frame .shiki` now explicitly
uses `min-inline-size: 0` (`src/styles/global.css:2217-2219`). Shiki emits the
focusable `pre` at `src/lib/markdown.ts:627-638`.

#### 2. Visible-overflow assertions and explicit scroller exemptions

**Best placement:** `.trellis/spec/frontend/quality-guidelines.md`, under “Test
Shape,” directly after the material-system browser-test rule. This is a test
oracle contract shared by all responsive UI work.

**Proposed wording:**

> Responsive overflow tests must assert both document `scrollWidth <=
> clientWidth` and that no visible element bounding box crosses the viewport by
> more than the test tolerance. Page-level `overflow-x: clip` can make the first
> check pass while content is visibly clipped. Exempt only descendants of named,
> intentional horizontal scrollers such as `.code-frame pre` and
> `.table-wrapper`, and only when the ancestor's computed `overflow-x` is `auto`
> or `scroll`; do not blanket-exempt generic clipped/hidden surfaces.

Evidence: the root deliberately clips horizontal overflow
(`src/styles/global.css:165-176`). The updated helper now applies named scroller
exemptions and separately asserts an empty offender array
(`tests/e2e/visual-assertions.ts:82-124`).

#### 3. Search request invalidation before empty-query return

**Best placement:** `.trellis/spec/frontend/component-guidelines.md`, adjacent
to the existing project-owned search reset-button contract at lines 70-73. This
is a progressive-enhancement state-machine invariant owned by the search UI.

**Proposed wording:**

> Every search execution must advance its request generation before inspecting
> query/filter state or taking an empty-query early return. Async success and
> failure handlers may update the DOM only when their captured generation is
> still current, and reset/clear must invalidate any in-flight request before
> restoring the default state. Otherwise a slow Pagefind response can resurrect
> stale results after the user clears the search.

Evidence: `runSearch()` now increments `searchSequence` before the empty-state
branch and checks the captured generation after async work
(`src/pages/search/index.astro:423-469`); reset independently invalidates before
showing default (`src/pages/search/index.astro:490-499`). The browser test holds
the Pagefind request, clears search, releases it, and asserts the default state
remains visible (`tests/e2e/visual-contract.spec.ts:550-590`).

#### 4. Inline-script/CSP hash synchronization

**Best placement:** keep the authoritative contract in
`.trellis/spec/backend/quality-guidelines.md`; no additional spec wording is
needed. The current spec already records the command/signature, exact set
equality, both public and preview policies, stale-hash rejection, validation
matrix, required build/test order, and wrong/correct example
(`.trellis/spec/backend/quality-guidelines.md:11-19`, `:44-48`, `:65-66`,
`:94-97`, `:142-150`). Duplicating it in a frontend spec would create two
authorities.

If the existing paragraph is ever condensed, preserve this exact minimum:

> After changing any executable inline Astro script, run a fresh production
> build and synchronize `deploy/Caddyfile`: every generated executable inline
> script hash must occur in both public and preview `script-src`, and no stale
> hash may remain. External, empty, and `application/ld+json` scripts are
> excluded. Validate with `pnpm build` followed by `pnpm test:operations`.

Evidence: `scripts/verify-csp-hash.mjs:13-55` computes generated executable
inline-script hashes, requires each hash exactly twice in Caddy, and rejects
stale configured hashes. The two policies are at `deploy/Caddyfile:24-56`.

## Caveats / Not Found

- No service was started and no current browser run was performed, per dispatch.
  Findings about the rendered UI come from retained 2026-08-07 candidate
  screenshots/reports plus current source and test inspection.
- The archived report states that its full gate passed, but it is historical and
  must not be reported as the result of the final AI-content build.
- The final AI article/note slugs, counts, longest strings, densest topic, and
  richest artifact page do not yet exist in the inspected task artifacts.
  Replace the matrix's canonical-record labels with deterministic final routes
  after the editorial set is fixed.
- No screenshot snapshots are part of the current Playwright gate, and the
  archive does not include notes, topics, topic detail, archive, or note-detail
  captures.
- A whole-page pixel comparison against the archived sparse fixture would create
  false failures and conflict with the repository's screenshot guidance. Use the
  archive for visual continuity and approve a new baseline only after semantic
  checks pass.
