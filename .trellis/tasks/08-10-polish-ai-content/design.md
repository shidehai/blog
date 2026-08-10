# Technical Design

## Overview

The implementation keeps the Astro/Directus/PostgreSQL architecture intact and
changes two coordinated surfaces: the canonical development/seed content and
the existing Astro presentation layer. Content density is part of the visual
input, so the final UI is validated only after the 12-piece fixture has built
and Pagefind has indexed it.

No child task tree is needed. The content boundary and frontend polish are
independently editable but converge through the same fixture, generated routes,
search index, and browser gate. Phase 2 can dispatch them as parallel workstreams
with explicit file ownership, then integrate tests after both land.

## Content Architecture

### Canonical definition

Add `directus/seed/content.mjs` as the one development editorial definition. It
exports checked constants for legacy fixture IDs and a builder such as
`buildEditorialFixture({ coverId })`, returning raw Directus-shaped `topics`,
`posts`, and `postTopics` arrays.

The returned records use the exact field names already validated by
`parsePublishedSnapshot`. `src/lib/content.ts` composes them with fixture-only
settings, files, and social links; `directus/seed/index.mjs` feeds the same
records into its existing idempotent upsert boundary. Runtime Directus reads are
unchanged and remain validated from `unknown` once by Zod.

```text
directus/seed/content.mjs
  |-- fixture build -> fixtureInput() -> Zod -> .generated/site.json
  `-- Directus seed -> idempotent upserts -> PostgreSQL -> Directus snapshot

.generated/site.json -> Markdown render/reference validation -> Astro routes
                     -> Pagefind / RSS / sitemap / metadata / export
```

The module uses JSDoc and passes repository `checkJs`. It contains fixture data,
not a production Markdown store: PostgreSQL remains the only live authority.

### IDs, taxonomy, and migration

- New post IDs use deterministic suffixes `0101` through `0112`; slugs follow
  the approved catalog and are never changed after publication.
- Six topic IDs use suffixes `0001` through `0006`. Known old topic identities
  may be repurposed because topic slugs are not immutable and every final topic
  is used by at least two pieces.
- Junction IDs are deterministic. The seed reassigns/removes the known old
  fixture joins before a public Directus snapshot can observe an archived-post
  relation.
- Four known legacy post IDs remain under their original slugs and become
  archived. The seed never mutates their published slugs.
- Only known deterministic fake records may be migrated. Unknown posts, topics,
  joins, files, and social records are not broadly queried for deletion.
- The known fake external social link is removed from the canonical fixture and
  may be deleted by exact deterministic ID in Directus; no replacement external
  identity is invented. Existing first-party RSS/navigation remains available.

Exactly one post is featured. Related writing remains derived from shared-topic
count, same-kind bonus, recency, and slug; topic assignments are designed so the
featured, RAG, evaluation, and tool-calling clusters yield useful deterministic
results without a schema field for manual pinning.

### Editorial contract

Bodies are authored as template strings in the canonical module. Stable root-
relative links and GitHub-style heading fragments are validated during
`getPreparedSite()`. Fenced languages stay within Shiki's supported set; code
metadata uses the existing filename/highlight/diff grammar. Notes keep
`summary: null` so the established excerpt derivation remains exercised.

References are claim-local footnotes to primary sources. Examples use typed
fake adapters, deterministic in-memory data, and no provider SDK. The prose
contains no fabricated production claim, benchmark, audience metric, incident,
or biography.

## Media Architecture

`scripts/generate-assets.ts` generates one content-owned 16:9 reliability-
boundary diagram at 640, 960, and 1600px. The visual is an actual system
artifact labelled around `输入 -> 上下文 -> 模型 -> 工具 -> 验证`, not generic
decoration. It reuses the approved blue signal and graphite material palette,
remains readable in the feature crop, and avoids copied reference assets.

`directus/seed/fixtures.mjs` loads the committed 960px WebP bytes and keeps the
existing SHA-256 digest-addressed title contract. Directus mode transforms those
exact bytes through the normal media boundary. Fixture mode maps the sole media
record explicitly to the three committed public variants in
`scripts/prepare-content.ts`. Adding a second fixture media identity remains out
of scope; the mapping must not silently point arbitrary future files at this
diagram.

The old publishing-workbench files may remain for historical tests until no
contract references them. They are not rendered by the new catalog and their
bytes are never overwritten or automatically deleted.

## Public Identity

Fixture and seeded Directus settings use:

- site name: `海边的小卖部`
- author: `关山`
- tagline: `把复杂问题写清楚`
- homepage introduction: a short statement about tracing AI systems from ideas
  to reliable operation and preserving engineering judgments worth revisiting
- biography: a bounded description of the publication's AI application-
  engineering focus, without invented personal history
- footer: a concise first-party publication line with no fixture disclaimer
- social links: none until the owner supplies real destinations

The generated author mark naturally becomes `关`. Existing metadata, manifest,
RSS, JSON-LD, footer, header, and About projections continue to derive from the
single normalized settings model.

## Frontend Design

### Preserved foundation

`src/styles/global.css` remains the authoritative palette, elevation, radius,
spacing, type, breakpoint, motion, forced-colors, and print layer. The calibrated
light/dark swatches and exact geometry tests remain unchanged unless a content-
expansion defect requires a documented minimum-height adjustment.

### Feature and homepage

- `FeaturePost.astro` keeps its media-led composition. Its no-media fallback is
  driven by the supplied topic/content context and contains no hardcoded stack
  names.
- Homepage labels use reader-facing terms such as publication totals rather
  than “内容快照”. The 12-piece set fills the existing four-item recent-writing
  cap, latest-note module, and six-topic cap.
- `.identity-note` loses its one-line clamp. Profile/feature cells continue to
  align at normal lengths and expand from `min-block-size` for valid long CMS
  content.
- The approved mobile feature-before-identity order remains. A larger structural
  reorder is unnecessary once real secondary writing fills the existing module.

### Discovery rows and truthful interaction

`PostListRow.astro` exposes content-kind classes while preserving one semantic
component. Article rows retain summary-led hierarchy; tutorials receive a
practical rhythm through metadata/type weight; notes become quieter and denser.
Context containers (`.related-writing`, notes, homepage, discovery routes) tune
subordination through CSS, avoiding variant props and duplicate components.

Static raised modules no longer lift or press merely because empty card space is
hovered. Interactive surface feedback is attached to a real primary link or
`:focus-within`, and keyboard/pointer states remain visually equivalent without
layout shift. Secondary topic/social links keep independent focus.

### Search excerpts

The Pagefind body boundary moves to authored prose so indexed excerpts do not
include the visible article header. Title and filters/meta stay explicitly
indexed. Search rendering accepts only the narrow Pagefind excerpt structure it
needs, preserving contextual match emphasis without injecting arbitrary markup.
A title-only query and filter-only query still produce useful fallback text.

### Reading metadata and annotation spine

`PostMeta.astro` gains optional update metadata. `PostPage.astro` compares
publication/update dates in the configured locale/timezone and renders
`更新于` only when the local calendar date is later. The visible value must agree
with `article:modified_time`/JSON-LD.

The desktop and embedded outlines share links but not duplicate visible labels.
A small Astro-owned progressive-enhancement script tracks the current section,
sets `aria-current="location"`, and applies the existing signal state. All links
and prose are visible and usable before the script runs; reduced motion avoids
animated tracking.

### About and long content

The About identity surface uses content-earned minimum height rather than a
large empty fixed composition. Short biography content no longer leaves most of
the module blank; long content and avatar/fallback states still expand without
clipping. The long-form prose plane remains flat and within the existing 72ch
measure.

## Search, Discovery, and Compatibility

No route or schema is added. The normalized snapshot automatically projects the
catalog into home, writing, notes, topics, topic detail, archive, RSS, sitemap,
manifest/metadata, preview, export, and related writing. Tests protect those
projections rather than duplicating selection logic in components.

Public routes remain prerendered and framework-free. Search, theme, menu, code
copy, progress, and outline tracking are bounded progressive enhancements. The
preview route continues to reuse `PostPage` and remains noindex/protected.

## Verification Design

### Automated contracts

- Unit/content: 12 records, 5/4/3 mix, six used topics, one featured record,
  canonical routes, representative related order, Markdown primitives, media,
  metadata, discovery, references, and export.
- Directus: seed twice, stable counts/relations, four known archived posts,
  immutable slugs, no archived joins, exact media digest, and Directus-backed
  snapshot/build parity.
- Browser: updated identity, all route families, search excerpt quality and
  filters, three post kinds, update metadata, full intro, outline state,
  no-JS/print, theme/accessibility states, and real-content counts.
- Overflow: assert both document width and zero visible offender boxes after
  explicit exemptions for code/table scrollers and top-layer controls.

### Visual evidence

After the final production/Pagefind build, capture deterministic Chromium DPR 1
evidence with explicit theme, reduced motion, fonts/images settled, and console/
network diagnostics. Required human-review surfaces are home, writing, notes,
topics, densest topic, archive, broad search results, richest tutorial, longest
article, shortest note, About, compact header, mobile menu, and open mobile
outline at representative desktop/mobile sizes. Existing exact material tests
remain the oracle for palette/geometry; full-page screenshots prove editorial
hierarchy and content density rather than pixel equality with the sparse fixture.

## Rollout and Rollback

Implementation lands in dependency order: canonical content/media, UI polish,
tests, then Directus-backed verification. A failed fixture build stops before
routes are published. A failed Directus migration leaves old content available;
the known legacy rows are archived only through idempotent exact-ID operations.

Rollback is a normal source revert plus rebuild. Because old fixture records and
media bytes are retained rather than destroyed, their archived states and joins
can be restored explicitly if needed. No schema contraction or data-volume
operation is part of this task.

## Trade-offs and Deferred Items

- Twelve substantial pieces increase review cost but are necessary to exercise
  the real publication density the user requested.
- A shared JavaScript fixture definition is intentionally development/seed data,
  not an alternative live content store.
- Topic scoring controls related writing indirectly; manual editorial pinning is
  deferred because it would require a schema/product change.
- Real social links, avatar, personal biography details, and truthful production
  publication timestamps remain owner launch inputs.
- A second authored media identity is deferred until fixture media mapping is
  generalized deliberately.
