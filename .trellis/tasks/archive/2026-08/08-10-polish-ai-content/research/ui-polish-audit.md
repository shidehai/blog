# Research: Current frontend visual-polish audit

- Query: Identify the current Astro frontend's highest-value visual-polish opportunities before adding a dense Chinese AI engineering corpus; rank concrete issues by impact, distinguish confirmed defects from taste, and define observable acceptance checks.
- Scope: internal (product/design/spec review, source inspection, retained browser evidence, and test-contract review)
- Date: 2026-08-10

## Findings

### Audit standard

The existing frontend is not a failed visual build. The archived aiayy task already
established the intended single-surface material, exact desktop/mobile geometry,
light/dark themes, reading plane, and accessibility protections. Its final gate
passed 56 unit tests and 55 Chromium tests, including 22 visual-contract tests
(`.trellis/tasks/archive/2026-08/08-05-aiayy-visual-rebuild/research/local-candidate/verification-summary.md:9-22`). The retained captures also showed no clipping, overlap, page overflow, blank media, or material mismatch in the sparse fixture state (`verification-summary.md:24-48`).

The present pass should therefore preserve the material identity and concentrate
on editorial hierarchy, trust, content density, and truthful interaction. That is
the delta named by the active PRD: move from a visually complete fixture to an
intentional publication, while preserving the established direction
(`.trellis/tasks/08-10-polish-ai-content/prd.md:3-19`).

Labels used below:

- **Confirmed defect**: rendered/source behavior objectively contradicts a product,
  design, accessibility, or active-task contract.
- **Confirmed gap**: the capability or visual distinction is objectively absent;
  the exact aesthetic remedy still needs implementation judgment.
- **Directional taste**: the implementation is valid, but the retained evidence
  suggests a higher-value hierarchy. Treat these as approval-dependent.

### Ranked opportunities

#### 1. P0 - Search results repeat their own title and metadata

**Status: confirmed defect.** `data-pagefind-body` is placed on the whole article,
so the indexed body includes the visible article header and metadata as well as
the prose (`src/components/PostPage.astro:39-85`). Search then strips the Pagefind
excerpt to plain text and renders a separate metadata line, heading, and excerpt
(`src/pages/search/index.astro:223-229`, `src/pages/search/index.astro:335-365`).
The retained mobile dark capture visibly repeats the result title, date, topic,
and reading time inside the excerpt after already showing them above
(`.trellis/tasks/archive/2026-08/08-05-aiayy-visual-rebuild/research/local-candidate/search-result-390x844-dark.png`). This lowers scan speed precisely where the product promises readers they can find material quickly (`PRODUCT.md:13-16`).

The current browser checks prove loading/result/empty/reset behavior and the
raised material recipe, but do not assert snippet quality
(`tests/e2e/visual-contract.spec.ts:533-600`, `tests/e2e/discovery.spec.ts:111-172`).

**Recommended direction:** make the excerpt prose-owned and context-bearing. Keep
kind/date/topic as one metadata group, title as one heading, and a short body
snippet that does not restate either. Preserve Pagefind's query context or an
equivalent accessible emphasis instead of flattening every match into an
undifferentiated 180-character string.

**Observable acceptance checks:**

- A query matching article body text shows each result title exactly once and
  date/topic/kind exactly once.
- The excerpt contains body prose around the match, not the article title,
  reading duration, publication date, or topic list.
- The result remains useful for a title-only query and a filter-only search.
- The result list passes the existing loading, empty, failure, reset, 320px,
  keyboard, and light/dark checks.

#### 2. P0 - Public chrome still reads like fixture and build-system scaffolding

**Status: confirmed defect against the active goal.** The no-media hero always
renders `POSTGRESQL -> ASTRO`, regardless of the featured post's subject
(`src/components/FeaturePost.astro:75-81`). The public writing introduction says
all content is generated from a "公开内容快照" (`src/pages/writing/index.astro:23-26`),
and the homepage gives a primary module the implementation-oriented label
"内容快照" (`src/pages/index.astro:214-235`). Those phrases made sense as fixture
proof, but they expose the publishing machinery instead of the author's point of
view. A future AI feature without cover media would misleadingly advertise a
PostgreSQL/Astro pipeline.

This directly works against the PRD's requirement that the site read as a
convincing technical publication rather than a sparse demo
(`.trellis/tasks/08-10-polish-ai-content/prd.md:5-9`,
`.trellis/tasks/08-10-polish-ai-content/prd.md:16-19`). It also weakens the product
belief ladder, where proof should come from evidence, examples, diagrams, and
source links rather than claims about the site's own stack (`PRODUCT.md:35-45`).

**Recommended direction:** keep the existing hero and Bento geometry, but make
fallback graphics and labels content-aware. Use the featured topic, a short
content-derived phrase, or a neutral reading signal. Rewrite route chrome in
reader language; reserve infrastructure vocabulary for articles whose subject is
actually that infrastructure.

**Observable acceptance checks:**

- A featured AI post with no cover does not display unrelated platform names.
- Public route chrome contains no fixture-only words such as "示例" and no
  publishing-pipeline explanation unless it is authored article content.
- The no-media hero remains visually complete in both themes at 1440px, 768px,
  390px, and 320px, with a stable accessible heading and CTA.
- Fixture/empty states remain explicit, but do not masquerade as production
  identity.

#### 3. P1 - Readers cannot see when technical material was updated

**Status: confirmed gap.** The normalized `Post` already carries `updatedAt`, and
the value is preserved from Directus (`src/lib/content.ts:484-503`,
`src/lib/content.ts:575-597`). Machine metadata also emits a modified timestamp
(`src/components/MetadataHead.astro:90-96`). The visible `PostMeta`, however, only
supports kind, publication date, and reading duration
(`src/components/PostMeta.astro:1-21`), and `PostPage` passes no update value
(`src/components/PostPage.astro:45-55`).

For AI engineering articles, visible maintenance history is editorial proof, not
administrative trivia. The product explicitly asks readers to believe that the
author "maintains the material over time" (`PRODUCT.md:40-42`).

**Recommended direction:** add a quiet, semantically marked "更新于" value when
the meaningful update date differs from publication. Keep it in the existing
annotation/meta rhythm rather than adding a badge or card.

**Observable acceptance checks:**

- A post updated on a later calendar day displays both publish and update dates;
  an unchanged post displays no duplicate date.
- The visible date agrees with `article:modified_time` and structured metadata.
- Metadata wraps without collision at 320px and at 200% text size.
- Article, tutorial, and note labels remain understandable without color.

#### 4. P1 - The author's homepage introduction is silently clamped to one line

**Status: confirmed defect.** The CMS-controlled `homepageIntro` is rendered as
the identity module's `.identity-note` (`src/pages/index.astro:139-144`), but CSS
hard-clamps that text to one line and hides the overflow
(`src/styles/global.css:763-770`). This contradicts the frontend material contract
that CMS-driven modules use minimum heights and allow valid long content to
expand without overlap (`.trellis/spec/frontend/component-guidelines.md:64-68`).
It also hides the very human voice the publication is supposed to make
recognizable (`PRODUCT.md:24-28`, `PRODUCT.md:47-51`).

The long-CMS-copy visual test mutates `.identity-statement`, not
`.identity-note`, so it does not detect this loss (`tests/e2e/visual-contract.spec.ts:477-530`).

**Recommended direction:** allow a short multi-line introduction or the full
author-controlled text and let the module expand. Keep the statement/tagline and
intro visually distinct, but do not discard valid CMS copy solely to retain the
reference height.

**Observable acceptance checks:**

- A long mixed Chinese/Latin `homepageIntro` is fully readable with no line clamp,
  overlap, or internal scrollbar.
- The identity and feature modules remain aligned on desktop by expanding
  together; downstream rows start after the taller pair.
- The same fixture remains readable at 390px, 320px, and 200% text size.
- The existing long-copy/no-horizontal-overflow checks cover `.identity-note` in
  addition to `.identity-statement`.

#### 5. P1 - Dense discovery surfaces will become visually repetitive

**Status: confirmed gap against the active acceptance criterion; exact treatment
is a design choice.** Every shared discovery entry renders as the same raised
`.post-row` with the same title/summary/topic arrangement
(`src/components/PostListRow.astro:33-47`, `src/styles/global.css:1144-1238`). The
same component is used for tutorial and article sections, the note stream,
homepage latest writing, search defaults, topic pages, and related writing
(`src/pages/writing/index.astro:50-83`, `src/pages/notes/index.astro:34-41`,
`src/components/PostPage.astro:123-134`). Notes get slightly tighter padding and
type, but retain the same card silhouette (`src/styles/global.css:1674-1684`).

This was acceptable with two writing entries and one note in the archived
capture. With the requested corpus, it risks becoming the "repeated
template-like cards" explicitly rejected by the active acceptance criteria
(`.trellis/tasks/08-10-polish-ai-content/prd.md:44-50`). It also underuses the
design rule that tutorials, articles, and notes should be distinguished through
rhythm, metadata, and hierarchy (`DESIGN.md:139-142`).

**Recommended direction:** keep `PostList`/`PostListRow` as the shared semantic
boundary, but expose content kind/context to styling. Use a denser, quieter note
stream; preserve more summary/metadata hierarchy for articles; give tutorials a
clear practical cue; and make related writing quieter than primary discovery.
Avoid introducing three unrelated card components or a variant factory.

**Observable acceptance checks:**

- With at least eight writing entries and five notes, `/writing/` and `/notes/`
  are scanable at 1440px and 390px without every item presenting the same visual
  weight.
- Tutorial, article, and note remain identifiable without relying only on the
  literal kind label or color.
- At 390x844, at least two concise note entries can be scanned without clipping;
  long titles and summaries expand rather than overlap.
- Related writing is subordinate to the finished article and does not visually
  restart a second primary discovery page.

#### 6. P1 - Surface hover states overstate the actual click target

**Status: confirmed interaction defect.** Entire rows press inward on hover
(`src/styles/global.css:2248-2253`), while the row itself is not a link and only
its title/topic descendants are interactive (`src/components/PostListRow.astro:33-47`).
Likewise, identity, snapshot, topic, discovery, and featured modules lift when the
pointer is anywhere over their non-interactive area
(`src/styles/global.css:2237-2246`). The motion therefore suggests a card-wide
action that does not exist. This contradicts the product rule that motion should
clarify state (`PRODUCT.md:78-79`). Keyboard focus also does not receive an
equivalent module-level `:focus-within` treatment.

**Recommended direction:** tie pressed/lifted material to the actual primary link
or `:focus-within`, or deliberately provide a card-wide primary action without
invalidly nesting the existing topic/social links. Static informational modules
should not mimic clickable cards.

**Observable acceptance checks:**

- Hovering empty space in a non-clickable row/module does not produce a click
  affordance; hovering its primary link does.
- Keyboard focus on the primary link yields the same visible surface state as
  pointer hover.
- Topic/social secondary links retain independent focus and hover feedback.
- Layout geometry does not shift when entering hover, focus, or active state.

#### 7. P1 - The annotation spine does not communicate current reading position

**Status: confirmed gap.** The design names outline position, reading progress,
captions, filenames, and callout labels as the publication's recognizable
annotation spine (`DESIGN.md:103-106`). The current rail is a static list of links
with no current-section state (`src/components/Outline.astro:16-29`), while the
reading progress script updates only the top meter
(`src/components/ReadingProgress.astro:21-46`). On mobile, the outer summary says
"文章目录" and the embedded outline repeats "目录" when opened
(`src/components/PostPage.astro:100-109`, `src/components/Outline.astro:20`). The
reading tests prove only that desktop/mobile outlines are present
(`tests/e2e/reading.spec.ts:25-55`).

**Recommended direction:** give the rail one restrained current-section marker
and remove the duplicated mobile label. Reuse the existing signal color and
annotation rhythm; do not turn the rail into a decorative ruler. If active
tracking is added, keep every link and all prose useful without JavaScript and
honor reduced motion.

**Observable acceptance checks:**

- Opening the mobile outline shows one directory heading, not "文章目录" plus a
  second "目录" label.
- Following an outline link exposes a visible current state and an appropriate
  `aria-current` value; scrolling updates it if scroll tracking is implemented.
- The current state survives forced colors and is not conveyed by color alone.
- JS-disabled article content and outline links remain fully usable.

#### 8. P2 - Mobile secondary writing is buried behind identity and utility modules

**Status: directional taste.** The feature is correctly first on mobile, as the
design requires (`DESIGN.md:127-129`; `src/styles/global.css:2340-2345`). After it,
however, DOM order places the expanded author identity, recent-note card, content
counts, and discovery signal before the latest-writing list
(`src/pages/index.astro:58-246`, `src/pages/index.astro:248-271`). The retained
390px capture shows the writing module beginning only after these large stacked
modules (`.trellis/tasks/archive/2026-08/08-05-aiayy-visual-rebuild/research/local-candidate/home-390x844-light.png`). A denser corpus increases the value of bringing a second real piece of writing into view sooner.

**Recommended direction:** test a mobile-only ordering where featured writing is
followed by a compact recent-writing entry or list, then author identity and
utility modules. Desktop should retain the approved asymmetric Bento.

**Observable acceptance checks:**

- At 390x844, the feature remains the first content module and at least one
  additional writing entry appears before purely statistical/utility content.
- Desktop 1200px Bento geometry and featured/profile asymmetry remain unchanged.
- Semantic DOM order stays coherent for keyboard and screen-reader navigation;
  do not duplicate content to achieve CSS placement.

#### 9. P2 - About-page geometry spends too much space on an empty identity card

**Status: directional taste, supported by retained evidence.** The identity card
has a forced 27rem minimum height, spans both grid rows, and uses
`justify-content: space-between` for only an avatar plus name/tagline
(`src/styles/global.css:1834-1855`). It still forces 19rem on mobile
(`src/styles/global.css:2477-2484`). The archived desktop capture consequently
shows a large unoccupied card next to a very short biography
(`.trellis/tasks/archive/2026-08/08-05-aiayy-visual-rebuild/research/local-candidate/about-1440x1000-light.png`). That geometry emphasizes the reference module more than the author's credibility.

**Recommended direction:** let actual portrait/artifact/biography content earn the
height. Without such material, reduce the minimum, align identity and biography
as one stronger author introduction, and keep external links as a quieter
utility section.

**Observable acceptance checks:**

- A short biography does not leave most of the identity card visibly empty at
  1440px or 390px.
- A long multi-paragraph biography expands naturally with no clipping.
- Avatar-present and fallback-initial states retain stable dimensions and
  light/dark contrast.

### Verification priorities

The existing visual contract is valuable but mostly locks material constants,
exact geometry, breakpoints, overflow, and state mechanics. Its representative
route matrix covers home, writing, search, and one tutorial
(`tests/e2e/visual-contract.spec.ts:383-463`); it does not assert editorial scan
quality, update metadata, intro visibility, result-snippet quality, or visual
distinction across a dense corpus. The archived screenshot pass used only the old
sparse fixture and is not a durable screenshot regression suite
(`.trellis/tasks/archive/2026-08/08-05-aiayy-visual-rebuild/research/local-candidate/verification-summary.md:24-29`).

Highest-value post-polish evidence:

| Surface | Viewports/themes | Observable review target |
| --- | --- | --- |
| Home with dense corpus | 1440x1000 and 390x844, light/dark | Writing priority, full author intro, content-aware fallback, no repeated utility emphasis |
| Writing + notes | 1440x1000 and 390x844, light/dark | Kind rhythm, note density, long-title wrapping, related-list subordination |
| Long AI tutorial | 1440x1000 and 390x844, light/dark | Publish/update metadata, annotation spine, code/table/callout/caption rhythm |
| Search result/empty/error | 390x844 plus desktop light/dark | Non-duplicated contextual snippets, filters, focus, state parity |
| About | 1440x1000 and 390x844, light/dark | Author credibility, content-earned height, avatar/fallback behavior |

Keep the existing computed assertions for material identity and accessibility.
Add semantic checks for the objective defects above, and retain a bounded fresh
screenshot set for human hierarchy review; screenshots should support, not
replace, the browser assertions, as required by the frontend quality spec
(`.trellis/spec/frontend/quality-guidelines.md:15-27`).

### Files found

- `PRODUCT.md` - reading-first purpose, human-voice proof, artifact-first visuals,
  selective tactile depth, and WCAG 2.2 AA (`:11-28`, `:35-51`, `:70-93`).
- `DESIGN.md` - approved Sculpted Workbench identity, annotation spine, Bento
  mapping, reading plane, responsive order, and anti-patterns (`:12-39`,
  `:75-129`, `:131-160`).
- `.trellis/spec/frontend/component-guidelines.md` - shared component/token
  boundaries, CMS expansion rule, accessibility, and calibrated breakpoints
  (`:13-39`, `:64-73`).
- `.trellis/spec/frontend/quality-guidelines.md` - observable browser tests and
  computed visual-contract requirements (`:15-27`).
- `.trellis/tasks/08-10-polish-ai-content/prd.md` - active publication-density and
  frontend-polish acceptance contract (`:3-58`).
- `.trellis/tasks/archive/2026-08/08-05-aiayy-visual-rebuild/research/local-frontend-audit.md` - route/state/component/test inventory and known sparse-state gaps (`:50-110`, `:179-246`).
- `.trellis/tasks/archive/2026-08/08-05-aiayy-visual-rebuild/research/local-candidate/verification-summary.md` - previous passing automated and retained screenshot evidence (`:9-52`).
- `src/styles/global.css` - authoritative tokens plus shell, homepage, discovery,
  reading, responsive, hover, forced-color, reduced-motion, and print rules.
- `src/pages/index.astro` and `src/components/FeaturePost.astro` - homepage
  selection/order, identity, Bento modules, hero copy/media/fallback.
- `src/components/PostListRow.astro`, `PostMeta.astro`, and `PostPage.astro` -
  repeated discovery, visible metadata, long-form and Pagefind boundaries.
- `src/pages/search/index.astro` - search markup, result construction, snippet
  normalization, all runtime states, and route-local styling.
- `tests/e2e/visual-contract.spec.ts`, `reading.spec.ts`, `discovery.spec.ts`, and
  `a11y.spec.ts` - current material, responsive, reading, search, and accessibility
  coverage.

### External references

- The relevant external reference remains `https://aiayy.cn/`, captured and
  measured by the archived visual-rebuild task on 2026-08-05. Its material
  constants and responsive behavior are already normalized into local specs and
  tests; no new live-site research was needed for this polish audit.
- The archived research explicitly treats the reference as material-language
  evidence rather than a source of identity, copy, imagery, data, or code
  (`.trellis/tasks/archive/2026-08/08-05-aiayy-visual-rebuild/research/reference-desktop-tokens.md:227-264`).

### Related specs

- `PRODUCT.md:70-86` - reading and content artifacts precede decoration; tactile
  depth is selective and article reading stays quiet.
- `DESIGN.md:90-111` - real artifacts and the annotation spine are the imagery and
  document-structure system; homepage modules map to real content rather than
  fake statistics or decoration.
- `DESIGN.md:127-129` - mobile keeps featured writing ahead of the expanded author
  profile.
- `.trellis/spec/frontend/component-guidelines.md:24-39` - reuse the established
  semantic components and global token layer rather than adding route-local
  variants.
- `.trellis/spec/frontend/quality-guidelines.md:15-27` - browser-visible behavior
  and material changes require observable Playwright assertions; screenshots are
  supporting evidence only.

## Caveats / Not Found

- Retained screenshots are from the 2026-08-07 sparse fixture (two writing items,
  one note, two active topics). They are authoritative evidence of current
  composition tendencies, not evidence of how the future AI corpus will wrap.
- No local server was running at `127.0.0.1:4321`, and this research role did not
  run a build or test command because those commands rewrite generated product
  output outside the permitted task research directory. Source and retained
  evidence were inspected instead.
- No fresh avatar, portrait, or second real hero asset was present in the audited
  frontend evidence. About/identity recommendations must be rechecked with the
  actual author-controlled media state.
- Items 8 and 9 are explicitly taste calls. They should not override the approved
  Bento/material identity without a before/after browser comparison.
- This report proposes acceptance behavior, not implementation architecture.
  Search indexing and outline tracking in particular must preserve Pagefind,
  JavaScript-off, CSP, preview, and reduced-motion contracts during implementation.
