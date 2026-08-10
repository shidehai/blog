# Research: Typography assessment for `/` and `/topics/`

- Query: Assess font choice, hierarchy, scale consistency, readability, weights,
  and letter spacing on the homepage and topic overview; identify exact scoped
  typography changes for the current task.
- Scope: mixed
- Date: 2026-08-10

## Findings

### Files found

- `DESIGN.md:57` - approved typography intent, mixed-script rule, line lengths,
  body/prose sizes, and zero-tracking requirement.
- `src/styles/fonts.css:1` - self-hosted Inter v20 variable face declaration and
  Latin unicode range.
- `src/styles/global.css:49` - shared font stack and discrete type-size tokens.
- `src/styles/global.css:172` - body typography baseline.
- `src/styles/global.css:869` - homepage featured-title and summary typography.
- `src/styles/global.css:1639` - shared discovery-page heading typography.
- `src/styles/global.css:1761` - current topic-directory row typography.
- `src/components/FeaturePost.astro` - semantic source of the homepage feature
  title, metadata, summary, and action.
- `src/components/PageHeader.astro` - semantic source of the shared discovery
  heading pair.
- `src/pages/index.astro:3` - homepage use of `FeaturePost`.
- `src/pages/topics/index.astro:25` - current topic overview hierarchy.
- `.trellis/tasks/08-10-fix-feature-card-overlap/research/reference-category.md:7`
  - measured reference type and layout values.
- `.trellis/tasks/08-10-fix-feature-card-overlap/prd.md:27` - task-approved type
  targets and preservation boundary.
- `.trellis/tasks/08-10-fix-feature-card-overlap/design.md:43` - scoped technical
  typography decision.
- `.trellis/tasks/08-10-fix-feature-card-overlap/final-visual/home-desktop-light.png`
  - archived desktop evidence of the featured title dominating the card.
- `.trellis/tasks/08-10-fix-feature-card-overlap/final-visual/home-mobile-light.png`
  - archived mobile evidence for the retained compact scale.
- `.trellis/tasks/08-10-fix-feature-card-overlap/final-visual/topics-desktop-light.png`
  - archived desktop evidence of the current information-heavy topic hierarchy.

### 1. Font choice

The font choice is correct and should remain unchanged. `src/styles/fonts.css:2`
declares self-hosted Inter v20 as a variable face for weights 300-900, uses
`font-display: swap` at `src/styles/fonts.css:6`, and loads the local WOFF2 at
`src/styles/fonts.css:7`. The Latin-only unicode range is intentional: the
shared stack starts with Inter and then supplies Simplified Chinese platform
faces (`Noto Sans CJK SC`, `Source Han Sans SC`, `PingFang SC`, and
`Microsoft YaHei`) at `src/styles/global.css:49`. This directly follows the
approved mixed-script contract in `DESIGN.md:59` and avoids a runtime font
request.

Recommendation: keep the `@font-face`, `--font-sans`, `--font-mono`,
`font-synthesis: none`, and unicode range unchanged. The requested compactness
does not require a new family, an additional webfont, or smaller body text.

### 2. Hierarchy

The underlying hierarchy is coherent, but two display levels are too large for
these discovery surfaces:

- Shell navigation is an appropriate 14px/500 at
  `src/styles/global.css:458`.
- The shared discovery heading is currently 40px/800, with 18px/1.7 supporting
  copy, at `src/styles/global.css:1639` and `src/styles/global.css:1645`.
- The homepage feature title is currently 52px/800/1.1 with a 12ch maximum at
  `src/styles/global.css:869`. Its summary is already a restrained 15px/1.6 at
  `src/styles/global.css:882`.
- The current topic rows combine a 20px name, 12px count/metadata, 14px
  description, and 14px/650 latest-post title at
  `src/styles/global.css:1761`, `src/styles/global.css:1771`,
  `src/styles/global.css:1784`, and `src/styles/global.css:1796`. The number of
  competing levels matches the current route markup at
  `src/pages/topics/index.astro:37` and makes the overview slower to scan.

For the planned topic selector grid, use only three visual levels: a 64px marker
as a non-type visual anchor, a 16px/700 topic name, and a 13px muted count. This
matches the measured reference at
`.trellis/tasks/08-10-fix-feature-card-overlap/research/reference-category.md:14`
without importing its identity or assets. Keep marker geometry separate from the
text scale; marker text must not become another display heading.

### 3. Scale consistency

The size tokens themselves form a useful discrete scale at
`src/styles/global.css:54`; the inconsistency comes from selector assignment,
not from missing global tokens.

Exact changes:

- Change `.page-heading h1` from `var(--font-size-40)` to
  `var(--font-size-32)` and `.page-heading p` from `var(--font-size-18)` to
  `var(--font-size-16)` in the desktop/base rules at
  `src/styles/global.css:1639`. The existing 48rem rules already compute to
  32px/16px at `src/styles/global.css:2504`, so they can remain as an explicit
  responsive contract.
- Change the base `.feature-post h2` from 52px to 40px at
  `src/styles/global.css:869`.
- Change the `max-width: 64rem` `.feature-post h2` from 40px to 32px at
  `src/styles/global.css:2356`.
- Retain 32px at `max-width: 48rem` and 28px at `max-width: 40rem`, currently
  defined at `src/styles/global.css:2450` and `src/styles/global.css:2618`.
- In the replacement topic-card selectors, set the topic name to 16px/700 with
  approximately 1.6 line height and the count to 13px with approximately 1.6
  line height. These are measured values, not candidates for changing the
  global body or heading tokens.

The featured-title reduction improves balance and wrapping, but it is not a
substitute for the task's structural non-overlap fix. The current feature copy
still spans 70% over a 45%/55% grid at `src/styles/global.css:795` and
`src/styles/global.css:806`.

### 4. Readability

Readability baselines are already correct:

- Body text is 16px with 1.6 line height at `src/styles/global.css:67` and
  `src/styles/global.css:172`.
- Long-form prose is 17px/1.85 on wide screens at
  `src/styles/global.css:2111` and returns to 16px on narrow screens at
  `src/styles/global.css:2691`.
- Article headings retain their separate 32px/20px/18px scale at
  `src/styles/global.css:2125`.
- The feature summary is 15px/1.6 and clamped to two lines at
  `src/styles/global.css:882`; it is secondary shell copy rather than article
  prose.
- The existing ink and muted roles maintain hierarchy without reducing type
  size; the page lead, feature summary, and topic metadata all use
  `var(--ink-muted)` in their owning selectors.

Recommendation: do not reduce body, article prose, feature summary, topic count,
or other secondary metadata below their existing/reference ranges. At 200% text,
the planned topic cards must expand rather than clip, and the feature title must
remain fully present; browser geometry tests should verify those contracts as
required by the PRD.

### 5. Weights and letter spacing

The weight system is appropriate and should remain localized:

- Display titles use 800 (`.page-heading h1` and `.feature-post h2`).
- Topic/card names should use an explicit 700 so they remain the primary card
  label after shrinking to 16px.
- Body copy remains regular/default weight.
- Secondary controls and linked labels use 600-650 where emphasis is needed;
  for example, the current latest-topic link uses 650 at
  `src/styles/global.css:1796`.
- Small feature labels and actions use 700 at `src/styles/global.css:840` and
  `src/styles/global.css:894`, which is appropriate at 11-14px.

Zero letter spacing is already enforced for the root and inherited controls at
`src/styles/global.css:98` and `src/styles/global.css:185`, and explicitly for
headings at `src/styles/global.css:249`. Preserve it. Do not add negative display
tracking or positive all-caps tracking; mixed Chinese/Latin lines should gain
hierarchy from size and weight instead.

### Change summary

Change only the shared discovery heading pair, the responsive featured-title
selectors, and the replacement topic-card name/count selectors. Keep these
changes in `src/styles/global.css`, the authoritative visual layer identified by
`.trellis/spec/frontend/component-guidelines.md:36`.

Do not change the font files or stack, global size tokens, 16px body baseline,
navigation size, feature summary, article title/prose selectors, metadata and
caption range, ink/muted color roles, zero letter spacing, established weights,
or the 64/48/40rem breakpoint contract. The task PRD also excludes a broad
typography redesign at
`.trellis/tasks/08-10-fix-feature-card-overlap/prd.md:89`.

### External references

- `https://aiayy.cn/category` - measured in Chromium on 2026-08-10; the retained
  local record reports a 32px/51.2px heading, 16px/25.6px supporting copy,
  16px/25.6px 700-weight category names, and 13px/20.8px counts. See
  `.trellis/tasks/08-10-fix-feature-card-overlap/research/reference-category.md:1`.
- No external font documentation is needed: the repository records Inter v20,
  its local file, unicode range, and OFL licensing directly.

### Related specs

- `DESIGN.md:57` - project typography and mixed-script rules.
- `.trellis/spec/frontend/component-guidelines.md:13` - semantic headings,
  accessibility, and ownership of the visual/font layers.
- `.trellis/spec/frontend/component-guidelines.md:64` - established responsive
  boundaries and content-expansion behavior.
- `.trellis/spec/frontend/quality-guidelines.md:20` - computed browser geometry,
  responsive, overflow, and interaction assertions for visual changes.
- `.trellis/tasks/08-10-fix-feature-card-overlap/prd.md:60` - task-specific type
  targets and preservation requirements.
- `.trellis/tasks/08-10-fix-feature-card-overlap/design.md:43` - approved scoped
  implementation boundary.

## Caveats / Not Found

- No local service was running on port 4321 during this assessment. Findings use
  source CSS, built `dist/client` HTML, and the task's archived light-theme
  screenshots rather than fresh computed-style browser inspection.
- Dark-theme typography was not separately screenshotted. Size, weight, and
  tracking selectors are shared across themes; contrast remains governed by the
  existing semantic tokens and is outside this typography-only change.
- The topic overview still has row-oriented markup and selectors. Exact new
  selector names will be chosen during implementation; the required computed
  values and hierarchy are specified here independent of naming.
- The mechanical detector was intentionally not run, per the task boundary.
