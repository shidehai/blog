# Research: Local frontend audit for the aiayy visual migration

- Query: Inventory the existing frontend, public routes and states, Astro presentation boundaries, design tokens/themes/fonts, content variants, client behavior, hero media, responsive behavior, and browser-test facilities before a visual rebuild.
- Scope: internal
- Date: 2026-08-05

## Findings

### Executive summary

The repository already contains a substantial implementation of the visual direction described in `DESIGN.md`: a floating capsule header, an asymmetric featured-content homepage, semantic raised/inset/floating elevations, light/dark themes, a flat long-form reading plane, and responsive/reduced-motion/forced-color handling. The visual migration is therefore a system-wide refinement or replacement of an existing shell, not a greenfield homepage exercise. The design intent is explicit at `DESIGN.md:12-38`, and many of those decisions are implemented centrally in `src/styles/global.css:1-102` and `src/styles/global.css:238-270`.

The application is a single Astro 7 site. Every public page and feed is prerendered; `/preview/[id]` is the only on-demand route and reuses the same `PostPage` component as public article and note pages (`src/pages/preview/[id].astro:21`, `src/pages/preview/[id].astro:169`, `src/pages/writing/[slug].astro:12-34`, `src/pages/notes/[slug].astro:12-34`). A safe visual migration should normally leave the Directus schemas and normalized frontend models unchanged, preserve the shared `PostPage` and `AppLayout` boundaries, and concentrate changes in the global tokens/styles, the small set of shared Astro presentation components, the homepage composition, search's route-local CSS, and visual/behavioral tests.

There is no visual-regression screenshot suite today. Playwright provides a good behavioral base, but it only configures Chromium, stores traces on first retry, and has no `toHaveScreenshot` calls or checked-in snapshots (`playwright.config.ts:3-31`). Adding a small screenshot matrix would materially reduce migration risk.

The task itself is still underspecified: `prd.md` contains only TBD placeholders (`.trellis/tasks/08-05-aiayy-visual-rebuild/prd.md:1-17`). This audit can identify boundaries and risk, but cannot determine which current visual decisions are intended to remain without a completed requirement/acceptance-criteria pass.

### Files found

| File or area | Role in the current frontend |
| --- | --- |
| `.trellis/spec/frontend/index.md` | Frontend entry point: prerendered Astro, project-owned CSS, progressive enhancement, Directus as source (`:3-17`). |
| `.trellis/spec/frontend/directory-structure.md` | Route/style/test placement and the prerender/preview contract (`:20-39`). |
| `.trellis/spec/frontend/component-guidelines.md` | Astro-first, semantic/accessibility, no speculative UI-kit guidance (`:3-33`). |
| `.trellis/spec/frontend/type-safety.md` | Strict TypeScript and fail-closed environment/CMS boundaries (`:3-35`). |
| `.trellis/spec/frontend/quality-guidelines.md` | `pnpm verify`, Pagefind build, browser-test and forbidden-pattern contracts (`:3-37`). |
| `DESIGN.md` | Current intended visual system and explicit aiayy adaptation constraints (`:12-158`). |
| `PRODUCT.md` | Reading-first product, content artifacts, durable Directus workflow, WCAG 2.2 AA (`:11-28`, `:70-93`). |
| `src/layouts/AppLayout.astro` | One document shell: CMS metadata lookup, head, prepaint theme, header/main/footer (`:11-128`). |
| `src/components/SiteHeader.astro` | Desktop/mobile navigation, native popover, compact-on-scroll behavior (`:11-127`). |
| `src/components/ThemeControl.astro` | System/light/dark control backed by `localStorage` (`:9-90`). |
| `src/components/MetadataHead.astro` | Canonical/social/JSON-LD/feed/manifest/icons/theme-color output (`:39-139`). |
| `src/components/FeaturePost.astro` | Featured homepage hero, with media and media-less signal variants (`:13-83`). |
| `src/components/PostList*.astro`, `PostMeta.astro`, `TopicLink.astro` | Shared content-row/list metadata presentation (`PostList.astro:6-38`, `PostListRow.astro:10-48`). |
| `src/components/PostPage.astro` | Shared public and preview long-form page, cover, outline, prose, related content (`:14-139`). |
| `src/components/Outline.astro`, `ReadingProgress.astro`, `CodeCopyBehavior.astro` | Long-form progressive enhancements and annotation surfaces. |
| `src/styles/global.css` | All global tokens, shell, homepage, discovery, article, responsive, accessibility and print styling; 2,109 lines. |
| `src/pages/search/index.astro` | Search markup, Pagefind client logic, dynamically-created result markup, and the only route-local `<style>` block (`:32-683`). |
| `src/lib/content.ts` | Directus schemas, normalization, fixture content, route derivation, related-content rules (`:127-239`, `:484-698`). |
| `src/lib/site.ts` | Loads `.generated/site.json`, renders Markdown once, validates generated internal links/routes (`:12-110`). |
| `src/lib/markdown.ts` | Directus Markdown validation and generated figure/table/callout/code markup (`:244-340`, `:407-553`, `:559-695`). |
| `src/lib/media.ts` | Public/preview media validation, sanitization, responsive transforms and hashed URLs (`:11-22`, `:618-777`). |
| `scripts/prepare-content.ts` | Build-time snapshot/media preparation; owns and recreates `public/_media` (`:16-94`). |
| `scripts/generate-assets.ts` | Generates the fixture hero/social diagram assets (`:6-61`). |
| `tests/e2e/*.spec.ts` | Browser behavior, accessibility, route/discovery, preview and responsive checks. |
| `playwright.config.ts` | Chromium-only Playwright server/project configuration (`:3-31`). |
| `deploy/Caddyfile` and `scripts/verify-csp-hash.mjs` | CSP, caching and exact executable inline-script hash contract (`deploy/Caddyfile:24-64`, `scripts/verify-csp-hash.mjs:13-55`). |

### Public route and state inventory

#### HTML surfaces

| Route | Rendering and composition | Representative states that affect visual work |
| --- | --- | --- |
| `/` | Prerendered homepage from the prepared snapshot (`src/pages/index.astro:11-46`). | Featured article/tutorial with cover; featured without cover; no writing; avatar image/fallback initial; latest-writing list/empty; recent notes/list-empty; active topics/list-empty (`src/pages/index.astro:20-46`, `:57-219`). |
| `/writing/` | Prerendered discovery page split into optional tutorial and article sections (`src/pages/writing/index.astro:8-14`, `:28-96`). | Both sections, only one kind, and no writing empty state. Toolbar anchors exist only for populated kinds (`:28-47`). |
| `/writing/[slug]/` | One prerendered path for each normalized article/tutorial (`src/pages/writing/[slug].astro:12-31`). | Article versus tutorial metadata; cover/no cover; topics/no topics; outline/no outline; related/no related; every supported Markdown artifact through shared `PostPage`. |
| `/notes/` | Prerendered note stream using the same `PostList` with denser note CSS (`src/pages/notes/index.astro:8-53`, `src/styles/global.css:1093-1103`). | Populated list or empty state. |
| `/notes/[slug]/` | One prerendered path for each normalized note, also using `PostPage` (`src/pages/notes/[slug].astro:12-34`). | Note variant hides the visible summary and reading duration, uses the `article-page--note` modifier, and can still have topics, cover, outline and related items (`src/components/PostPage.astro:23-27`, `:40-84`, `src/styles/global.css:1630-1636`). |
| `/topics/` | Prerendered directory over all topics (`src/pages/topics/index.astro:8-18`). | Topic with recent content, topic with zero content and action, or no topics at all (`:31-85`). |
| `/topics/[slug]/` | One prerendered route per topic, even when it has no posts (`src/pages/topics/[slug].astro:14-33`). | Writing-only, notes-only, mixed, or empty topic; conditional in-page filters (`:47-109`). |
| `/archive/` | Prerendered all-content timeline grouped by year (`src/pages/archive/index.astro:10-18`). | One/multiple years, mixed kinds/topics, or completely empty archive (`:32-93`). |
| `/search/` | Prerendered shell plus a local Pagefind enhancement (`src/pages/search/index.astro:7-32`, `:151-481`). | Default recent content; URL-seeded query/filters; loading; results; no results; Pagefind failure fallback; reset; mobile one-column controls (`:123-147`, `:370-479`, `:652-670`). |
| `/about/` | Prerendered author/settings page (`src/pages/about/index.astro:6-20`). | Avatar image/fallback; biography fallback chain; social links/list-empty; optional footer note (`:22-102`). |
| custom `404` | Prerendered `404.html` reused for missing URLs (`src/pages/404.astro:6-47`). | Current writing CTA when content exists, plus stable writing/archive/home exits. |
| `/preview/[id]` | Runtime-only, trusted-header protected route that renders `PostPage` (`src/pages/preview/[id].astro:21-49`, `:164-169`). | Untrusted/malformed/missing/error return plain-text 404; valid fixture or Directus version renders the shared article/note layout with `noindex`, no-store and possibly data-URI media (`:35-65`, `:72-161`). |

The currently built Directus seed output contains three post routes (one note, one article, one tutorial) and three topic routes under `dist/client/`. Those exact paths are snapshot-dependent, not hardcoded product routes. Dynamic routes are derived from normalized `kind` and `slug` (`src/lib/content.ts:531-533`) and sorted newest first (`src/lib/content.ts:570-603`).

#### Non-HTML public endpoints/assets

- `/healthz` is a tiny prerendered text endpoint (`src/pages/healthz.ts:1-7`).
- `/rss.xml`, `/sitemap.xml`, `/sitemap-index.xml`, `/robots.txt`, and `/site.webmanifest` are prerendered endpoints (`src/pages/rss.xml.ts:1-12`, `src/pages/sitemap.xml.ts:1-12`, `src/pages/sitemap-index.xml.ts:1-12`, `src/pages/robots.txt.ts:1-10`, `src/pages/site.webmanifest.ts:1-13`).
- Sitemap HTML routes are explicitly enumerated and then extended by all post/topic paths (`src/lib/discovery.ts:3-11`, `:50-88`). Preview, Pagefind internals, 404 and RSS are intentionally excluded from the HTML sitemap.
- `/pagefind/*` is generated after Astro by `pagefind --site dist/client` (`package.json:16-17`) and loaded by the search page only after a query/filter is used (`src/pages/search/index.astro:281-298`).
- `/_astro/*` and `/_media/*` are immutable in production, while public documents revalidate and preview is private/no-store (`deploy/Caddyfile:27-56`).

### Current page composition and content-driven variants

#### Homepage selection rules

- Only articles/tutorials can become the homepage feature. It selects the first newest writing item with `featured=true`, otherwise the newest writing item (`src/pages/index.astro:15-20`, normalized sort at `src/lib/content.ts:599-603`). A featured note is ignored by this surface.
- The next four writing items exclude the feature. If that list is empty, the fallback list includes the feature again, so a site with exactly one writing post repeats it in the feature and recent-writing section (`src/pages/index.astro:21-26`). This is existing behavior to decide explicitly during a redesign.
- Recent notes are capped at three and active topics at six, with topic rank based on published-post count and slug tie-break (`src/pages/index.astro:27-41`).
- The homepage has real empty states for no writing, no recent notes and no active topics (`src/pages/index.astro:97-106`, `:153-159`, `:173-192`, `:204-216`). These cannot be dropped even if the normal production snapshot is populated.
- Feature media is the feature post's `cover`; if missing, `FeaturePost` renders a text-led `POSTGRESQL -> ASTRO` signal instead (`src/pages/index.astro:42-44`, `src/components/FeaturePost.astro:56-81`). The media is eager/high-priority and supplies intrinsic dimensions/srcset (`src/components/FeaturePost.astro:58-73`).
- Avatar state comes from Directus site settings; the current fixture/seed uses `null`, so existing e2e tests only exercise the initial-based fallback (`src/pages/index.astro:45-46`, `:109-129`, `src/lib/content.ts:1060-1073`).

#### Long-form content primitives

- Public article/tutorial/note and trusted preview all use `PostPage`, which owns metadata, cover, topics, responsive outline, prose, related content, reading progress and copy behavior (`src/components/PostPage.astro:30-139`). Visual changes here affect all long-form surfaces automatically.
- Article bodies are not Astro content collections. Directus Markdown is parsed, validated, normalized and rendered at the data boundary (`src/lib/markdown.ts:660-695`). GFM tables, task lists, safe links, callouts, images, headings/outlines, footnotes, code filenames, highlighted lines and diffs are supported.
- Several nominal Astro components are not the actual renderer for body artifacts. `Callout.astro`, `CodeBlock.astro`, `Footnotes.astro`, and `TableWrapper.astro` have no route/component consumers; equivalent DOM is constructed directly by `src/lib/markdown.ts:446-549` and `src/lib/markdown.ts:559-655`. `ResponsiveFigure.astro` renders the post cover, while body figures are also generated in `markdown.ts`. A structural redesign must update the renderer and its unit tests, not just these component files. Purely visual changes can target their shared CSS classes.
- Code highlighting is explicitly fixed to `github-dark-default` in the custom Directus Markdown renderer (`src/lib/markdown.ts:583-618`). Changing only Astro's parallel Shiki config (`astro.config.ts:11-13`) will not change published post code blocks.
- Pagefind indexes only indexable post bodies. `PostPage` supplies title, description, kind, topic and date attributes (`src/components/PostPage.astro:39-84`); `AppLayout` ignores whole non-post/preview documents (`src/layouts/AppLayout.astro:86-87`, `:121`). Preserve these attributes and their semantic values when moving wrappers.

### Shared design-system boundaries

#### Tokens and material states

`src/styles/global.css` is the de facto design-system boundary despite the older spec describing it as a foundation. It centralizes:

- Light semantic color tokens: `surface`, `surface-high`, `surface-low`, `ink`, `ink-muted`, `signal`, `signal-ink`, `signal-soft`, `line`, and semantic success/warning/danger (`src/styles/global.css:1-16`).
- Four elevation states: flat, raised, inset and floating plus a two-ring focus treatment (`src/styles/global.css:17-25`, `:238-270`). Semantic utility classes (`surface--*`, `control--raised`) are shared by nearly every page.
- Dark tokens in both automatic-system and explicit-data-theme branches (`src/styles/global.css:62-102`). These declarations are duplicated and can drift; a migration should keep one authoritative token set if CSS structure changes.
- A system-only Simplified Chinese-first sans stack and a system monospace stack (`src/styles/global.css:26-29`). There are no `@font-face` declarations and no font files in `public/`. The root is 17px (`106.25%`), prose is 1.05rem desktop/1rem mobile, and body/prose line heights are 1.8/1.85 (`src/styles/global.css:30-35`, `:55-59`, `:117-124`, `:1470-1474`, `:1932-1934`).
- A restrained type scale, eight-step spacing scale, 4/6/8px semantic radii, 44px control size, 76rem content width, 70ch reading width, responsive gutter and shared motion timings (`src/styles/global.css:30-54`).

Nearly all presentation is global. `AppLayout` imports `global.css` once (`src/layouts/AppLayout.astro:9`); the only component/page-scoped style block is search (`src/pages/search/index.astro:483-683`). Thus a token or common-selector change has a broad blast radius, while a search visual change can be missed unless its local styles are audited separately.

#### Theme and brand-color duplication

- The prepaint inline script reads `pkj-theme` and sets only explicit light/dark before content paint (`src/layouts/AppLayout.astro:87-88`, `:118`). `ThemeControl` then cycles system -> light -> dark and persists/removes the key (`src/components/ThemeControl.astro:36-90`).
- Explicit theme choice is tested across reload (`tests/e2e/shell.spec.ts:50-63`). System preference itself and a system-preference change during an open page are not tested.
- Browser theme colors are hardcoded separately in `MetadataHead.astro:130-139`; manifest colors are hardcoded in `src/lib/discovery.ts:170-196`; favicon colors are hardcoded in `public/favicon.svg:2-5`; generated hero/social art has its own palette in `scripts/generate-assets.ts:13-40`. A palette migration must review all of these. The media-query-only theme-color metadata can also disagree with a user who explicitly selects the opposite theme from their OS.
- Production CSP allows only self-hosted fonts/images for public pages (`deploy/Caddyfile:55-56`). An external webfont or remote hero URL will be blocked. A local font would need licensed files under an owned static path and should be checked for bundle/Chinese glyph cost.

#### Shared semantic components

- `AppLayout` is the document contract, not just a visual wrapper. It validates that preview metadata props arrive as a complete set, otherwise reads the prepared static site; it computes canonical/noindex/social image/author image and wraps the shared header/footer (`src/layouts/AppLayout.astro:21-88`, `:91-128`).
- `SiteHeader`, `SiteFooter`, `PageHeader`, `PostList`, `PostListRow`, `PostMeta`, `TopicLink`, `EmptyState`, `FeaturePost`, and `PostPage` are the appropriate semantic change boundaries. Keep props typed and avoid a speculative variant framework per `component-guidelines.md:24-33`.
- CSS surface utilities are already the smallest cross-route design primitive. New design tokens belong beside the current root tokens; route-specific formulas would violate the existing spec (`.trellis/spec/frontend/component-guidelines.md:31-33`).

### Client scripts and progressive enhancement

There is no React/Vue/Svelte runtime, client state store, or icon package. Client behavior is limited to:

1. Prepaint theme bootstrap: small inline script in `AppLayout` (`src/layouts/AppLayout.astro:87-88`, `:118`).
2. Theme cycling: local component script and `localStorage` (`src/components/ThemeControl.astro:36-90`).
3. Header compaction after 72px scroll, throttled by `requestAnimationFrame` (`src/components/SiteHeader.astro:99-126`).
4. Native Popover-based mobile navigation; open/close/Escape/focus restoration comes from the platform (`src/components/SiteHeader.astro:46-96`).
5. Reading progress based on prose offsets, updated on scroll/resize with `requestAnimationFrame` (`src/components/ReadingProgress.astro:13-48`).
6. Delegated clipboard copying with stable 1.8s feedback (`src/components/CodeCopyBehavior.astro:1-33`).
7. Search-only Pagefind import, URL state, filters, debounce, result DOM creation, loading/empty/error states (`src/pages/search/index.astro:151-481`).

Public article content remains useful with JavaScript disabled and is covered by a browser test (`tests/e2e/reading.spec.ts:72-88`). A visual migration should preserve that property: initial markup must remain visible, mobile navigation can use a native disclosure/popover, and animations cannot gate content.

Changing any executable inline script is operationally coupled to CSP. `scripts/verify-csp-hash.mjs` hashes every generated executable inline script and requires each hash in both public and preview Caddy policies (`scripts/verify-csp-hash.mjs:13-55`); the maintenance contract explicitly requires coordinated expansion/deployment (`docs/operations/maintenance-security.md:45-50`). CSS-only and bundled Astro component-script changes avoid this specific hash update, but modifying the prepaint theme string does not.

### Hero and other visual assets

Available bitmap/static assets are:

| Asset | Current purpose and dimensions |
| --- | --- |
| `public/images/publishing-workbench.webp` | 1600x900 generated publishing pipeline diagram; fixture feature/body media. |
| `public/images/publishing-workbench-960.webp` | 960x540 responsive fixture variant and Directus seed source. |
| `public/images/publishing-workbench-640.webp` | 640x360 responsive fixture variant. |
| `public/images/default-social.png` | 1200x630 generated social fallback. |
| `public/_media/<uuid>-640w-<hash>.webp`, `...960w...` | Current Directus-prepared cover variants; generated, hashed and ephemeral. |
| `public/favicon.svg`, `favicon-32x32.png`, `apple-touch-icon.png`, `icon-192.png`, `icon-512.png` | Current blue workbench mark and manifest/browser icons. |

The publishing-workbench image is a crisp dark diagram labeled DIRECTUS -> VALIDATE -> ASTRO -> DEPLOY, generated from code in `scripts/generate-assets.ts:8-61`. The current prepared Directus snapshot points its featured article and default OG image at a 960x540 copy of this same artifact; production resolution generated two 640/960 WebP variants. The fixture path supplies 640/960/1600 variants (`scripts/prepare-content.ts:34-65`). There is no stock photo, real author portrait, or second candidate hero asset in the repository.

The authoritative production hero choice should remain content-driven: upload a suitable artifact to Directus's publishable-assets folder, set it as the featured writing post's cover with alt/decorative semantics, and let the build create local hashed variants. The frontend already consumes that model. Do not manually add a production content record or a hand-managed file beneath `public/_media`; `prepare-content.ts` deletes that whole directory before every preparation (`scripts/prepare-content.ts:32-33`).

Raster uploads can be JPEG, PNG, WebP, AVIF or GIF but are normalized to responsive WebP at widths up to 640/960/1440; SVG is sanitized and retained as SVG (`src/lib/media.ts:11-22`, `:618-751`). Public media must be in the publishable folder, while preview can resolve both public and private folders (`src/lib/media.ts:24-35`, `src/lib/content.ts:423-437`). Preview embeds protected media as data URIs rather than exposing token-bearing asset URLs (`src/pages/preview/[id].astro:114-150`).

### Responsive, accessibility and alternate-media behavior

The CSS uses logical properties throughout, establishes a 320px minimum document width, and keeps content widths bounded (`src/styles/global.css:49-51`, `:110-124`). Main responsive thresholds are:

- `68rem`: desktop article outline rail; below it the rail is hidden and a native `<details>` outline appears (`src/styles/global.css:1648-1669`).
- `62rem`: desktop navigation switches to mobile popover, action labels become visually hidden, homepage feature moves before identity, secondary/about grids collapse (`src/styles/global.css:1671-1730`).
- `48rem`: mobile type overrides and single-column/stacked layouts. Feature media moves below copy with a clipped top edge, content rows/topics/archive/about/404 collapse, and prose/table/callout sizing adapts (`src/styles/global.css:1747-1953`). Search independently collapses its three filters and submit layout at the same threshold (`src/pages/search/index.astro:652-670`).
- `48rem` and above: only the first homepage feature/identity row receives the 8px reveal motion; content is never opacity-hidden (`src/styles/global.css:1732-1745`, `:1955-1959`).

The DOM order puts the feature before identity, while desktop grid areas place identity on the left; mobile therefore becomes reading-first without duplicated markup (`src/pages/index.astro:57-145`, `src/styles/global.css:457-464`, `:1703-1708`).

Accessibility/alternate presentation is intentionally part of the visual system:

- A skip link, semantic landmarks, native controls/popover/details, `aria-current`, live search/copy status, intrinsic image sizes and one document language are present (`src/layouts/AppLayout.astro:91-128`).
- Reduced motion removes practical animation/transition duration and smooth scrolling (`src/styles/global.css:1961-1975`).
- Forced colors removes material shadows, restores explicit borders and preserves highlighted states (`src/styles/global.css:1977-2018`); search adds its own forced-color borders (`src/pages/search/index.astro:672-681`).
- Print removes shell/controls/outline/related content but retains prose, media, tables, footnotes, code and link URLs (`src/styles/global.css:2020-2109`).
- Current Playwright responsive checks cover 320, 768, 1440 and 1920 widths, no horizontal overflow, 200% text, mobile menu focus, header frame stability, reduced motion and forced colors (`tests/e2e/shell.spec.ts:3-143`).

### Tests, Playwright and screenshot facilities

The quality gate is `pnpm verify`: formatting, ESLint, Astro typecheck, Vitest, production Astro + Pagefind build, operations/CSP tests and Playwright (`package.json:49`; `.trellis/spec/frontend/quality-guidelines.md:3-23`). Relevant coverage:

- `tests/e2e/smoke.spec.ts:3-15`: homepage shell and health endpoint.
- `tests/e2e/shell.spec.ts:3-143`: responsive homepage, mobile navigation, theme persistence, skip link/current route, compact header, text zoom, reduced motion/forced colors.
- `tests/e2e/reading.spec.ts:5-111`: public route reachability, desktop/mobile reading layout, all Markdown primitives, copy feedback, JS-off content, print and custom 404.
- `tests/e2e/discovery.spec.ts:3-187`: metadata, discovery endpoints/assets, Pagefind lazy load/results/filters and mobile search overflow.
- `tests/e2e/preview.spec.ts:3-47`: fail-closed and valid preview behavior.
- `tests/e2e/a11y.spec.ts:4-40`: axe serious/critical checks on home, one long-form page, notes, search, about, missing page and protected preview.
- Unit tests cover normalized content variants, Markdown markup contracts, media dimensions/transforms, metadata and discovery output (`tests/unit/content.test.ts`, `markdown.test.ts`, `media.test.ts`, `metadata.test.ts`, `discovery.test.ts`).

Current screenshot capabilities/gaps:

- `@playwright/test` 1.62.1 is installed and can support `expect(page).toHaveScreenshot`, but the repository has no screenshot calls, snapshot directories, or visual-diff configuration.
- Playwright config has only Chromium Desktop Chrome, no Firefox/WebKit or explicit mobile-device project (`playwright.config.ts:13-18`). Tests emulate widths manually.
- Trace is `on-first-retry`; screenshots and video are not configured as failure artifacts (`playwright.config.ts:9-12`). `test-results/.last-run.json` is the only existing test result artifact.
- There is a standalone Lighthouse command (`package.json:39`), but it is not part of `pnpm verify`.
- Behavioral tests exercise the default fixture state, not avatar-present, hero-without-cover, all empty states, very long real titles/topic labels, system-dark preference, or real production Directus media. These are the most valuable representative states for migration-specific screenshots or fixture-level tests.
- Running `pnpm test:e2e` alone starts the existing `dist/server`; it does not rebuild the fixture. The aggregate gate builds immediately before e2e. During visual iteration, use a fresh fixture build before interpreting browser results, especially because the checked-in working `dist` may reflect a Directus seed snapshot with different IDs/routes than `fixtureInput()` (`package.json:14-17`, `playwright.config.ts:19-31`).

### Likely change map

| Priority | Likely files | Why / boundary |
| --- | --- | --- |
| Core visual system | `src/styles/global.css` | Authoritative tokens, elevation, typography, shell, homepage, discovery, article, responsive, alternate-media rules. Most of the migration belongs here. |
| Search | `src/pages/search/index.astro` | Only route-local CSS and runtime-created result/empty markup; global changes alone will not fully migrate it (`:335-390`, `:483-683`). |
| Shared shell | `src/layouts/AppLayout.astro`, `src/components/SiteHeader.astro`, `ThemeControl.astro`, `SiteFooter.astro`, `PageHeader.astro` | Header/footer/theme/landmarks across every HTML route. Preserve metadata and prepaint/CSP behavior. |
| Homepage | `src/pages/index.astro`, `src/components/FeaturePost.astro`, possibly `EmptyState.astro` | Bento hierarchy, identity, feature/media fallback, list/module ordering and empty states. |
| Discovery surfaces | `PostList.astro`, `PostListRow.astro`, `PostMeta.astro`, `TopicLink.astro`, `src/pages/writing/index.astro`, `notes/index.astro`, `topics/*.astro`, `archive/index.astro`, `about/index.astro`, `404.astro` | Repeated semantic rows/toolbars and route-specific structures. Prefer shared CSS/props over per-route duplication. |
| Reading system | `PostPage.astro`, `Outline.astro`, `ReadingProgress.astro`, `ResponsiveFigure.astro`, `CodeCopyBehavior.astro`, `src/lib/markdown.ts` only if markup changes | Shared public/preview reading contract and renderer-generated artifacts. CSS-only treatment does not require content parsing changes. |
| Brand/meta surfaces | `MetadataHead.astro`, `src/lib/discovery.ts`, `public/favicon.svg`, PNG icons, `scripts/generate-assets.ts` | Hardcoded browser/manifest/icon/social colors and fixture imagery must track an intentional palette/brand change. |
| Media/content fixtures | `scripts/prepare-content.ts`, `directus/seed/fixtures.mjs`, `directus/seed/index.mjs`, related media/content tests only if fixture art or data changes | Build owns generated assets and test content. Do not patch generated `_media` output directly. |
| Browser verification | `tests/e2e/shell.spec.ts`, `reading.spec.ts`, `discovery.spec.ts`, `a11y.spec.ts`, `playwright.config.ts`, optional new focused visual spec | Preserve behavior and add a bounded light/dark + desktop/mobile screenshot matrix. |

`src/lib/content.ts`, Directus schema/database files and API permissions should not need changes for a purely visual migration. The current normalized model already exposes feature, post kind, cover/alt/decorative state, author/avatar/biography/tagline/home intro/footer, topics, dates, SEO fields and social links (`src/lib/content.ts:467-509`). Only a genuinely new author-controlled field should expand that contract, in which case schema, SDK field lists, runtime validation, seed, export and unit tests must change together.

### Directus/static behavior risks

1. **Do not turn public pages into runtime pages.** The frontend spec forbids silent runtime conversion (`.trellis/spec/frontend/quality-guidelines.md:31-37`). Astro uses server output solely to host the preview route; public routes explicitly prerender.
2. **Preserve one normalization/rendering path.** Public and preview data both become `PublishedSnapshot`/`Post` and flow through `PostPage`; moving raw Directus concerns into components would violate the type-safety contract (`.trellis/spec/frontend/type-safety.md:27-29`).
3. **Preview data is a smaller snapshot.** Production preview fetches only the selected post plus its topic/settings/media dependencies (`src/lib/content.ts:847-916`), so `deriveRelatedPosts` produces no related items there; fixture preview uses the full prepared site and can show related content (`src/pages/preview/[id].astro:72-94`, `:166`). Do not use related-section presence as the sole proof of public/preview visual parity.
4. **Generated media ownership is strict.** `prepare-content.ts` deletes `public/_media`, fetches only referenced files, validates folders/MIME/dimensions/bytes, and writes hashed output (`scripts/prepare-content.ts:28-92`). Hand-managed assets there will disappear. Hash changes are expected and Caddy caches them immutably.
5. **Hero/media must remain optional.** Cover is nullable and the current hero has a deliberate no-media fallback; production content cannot be assumed to match the seed (`src/lib/content.ts:484-503`, `src/components/FeaturePost.astro:56-81`).
6. **Keep intrinsic dimensions and `srcset`.** These are generated at the media boundary and used to avoid layout shifts in feature, cover and body images (`src/components/FeaturePost.astro:58-73`, `src/components/ResponsiveFigure.astro:15-26`, `src/lib/markdown.ts:500-547`).
7. **Preserve Pagefind markers.** Moving or replacing `data-pagefind-*` attributes can silently remove posts or filters from search even though pages still render (`src/components/PostPage.astro:39-84`, `src/layouts/AppLayout.astro:121`). A valid migration gate must include the production/Pagefind build and a real search query.
8. **Keep public/preview CSP constraints in view.** Public images/fonts/connections are self-only; preview alone allows data images; Pagefind needs WASM; executable inline scripts require exact hashes (`deploy/Caddyfile:34`, `:55-56`). Remote fonts, image CDNs, analytics, or animation libraries are not drop-in visual choices.
9. **Metadata colors/assets are outside CSS tokens.** A CSS palette update alone leaves theme-color, manifest, favicon, icon and generated social media stale. Conversely, changing the inline theme bootstrap requires Caddy hash maintenance.
10. **Fixture and production content differ.** `fixtureInput()` supplies a 1600px local image and fixed routes (`src/lib/content.ts:931-1099`); Directus production preparation may have fewer variants and arbitrary valid titles/topics/media. Test both deterministic fixture behavior and content-length/media-state extremes.
11. **Internal links are build-validated.** `getPreparedSite` validates generated routes, headings and media references before rendering (`src/lib/site.ts:74-103`). Preserve stable route/heading semantics when restyling; route renames are a content/discovery migration, not a visual edit.
12. **No local content store.** Specs explicitly require PostgreSQL/Directus as the content source and forbid local Markdown collections (`.trellis/spec/frontend/index.md:15-17`, `.trellis/spec/frontend/directory-structure.md:38-39`). Repository fixture assets/content are test infrastructure, not a second production source.

### Suggested migration verification matrix

At minimum, verify these observable states after implementation:

| Axis | Cases |
| --- | --- |
| Viewport | 320x800, 768x1024, 1440x1000, 1920x1080; additionally a long mobile page and desktop article rail. |
| Theme | System light, system dark, explicit light on dark OS, explicit dark on light OS, reload before-paint behavior. |
| Homepage content | Featured with media, feature without media, avatar/fallback, no writing, no notes, no active topics, long mixed Chinese/Latin title. |
| Reading | Article/tutorial/note; cover/no cover; outline/no outline; callout/table/code/diff/figure/footnotes; related/no related; JS disabled. |
| Search | Default, loading, result, no result, failure fallback, query/filter URL restoration, 320px controls. |
| Accessibility | Keyboard menu/theme/search/copy, skip link, 200% text, reduced motion, forced colors, axe, visible focus. |
| Alternate output | Print article and noindex/private preview with data-URI media. |
| Discovery/build | Pagefind query/filter, canonical/OG/JSON-LD, manifest/icon/theme colors, RSS/sitemap, CSP hash verification. |

A focused visual suite should favor a few stable, representative page screenshots rather than snapshotting every route: home light/dark at desktop and 320px, one long tutorial at desktop/mobile, search results at mobile, and one discovery list. Keep existing semantic assertions so screenshots do not become the only contract.

### External references and versions

No external web research was needed for this local audit. Relevant pinned versions and platform capabilities found in the repository are:

- Astro `7.1.6` with `@astrojs/node` `11.0.3`; standalone server output with explicit per-route prerendering (`package.json:51-55`, `astro.config.ts:8-15`).
- Directus SDK `24.0.0` (`package.json:51-54`).
- Pagefind `1.5.2` (`package.json:80-82`).
- Playwright `1.62.1` and axe-playwright `4.12.1` (`package.json:68-72`).
- Sharp `0.35.3`, Shiki `4.4.1`, Zod `4.4.3` (`package.json:60-65`).
- Browser primitives relied on by the UI include native Popover, `<details>`, CSS logical properties, OKLCH/color-mix, `:has()`, forced-colors and reduced-motion media queries. Only Chromium is currently exercised in CI.

### Related specs

- `.trellis/spec/frontend/index.md:3-17`: single Astro app, prerendering, progressive enhancement, Directus source.
- `.trellis/spec/frontend/directory-structure.md:20-39`: explicit public prerender, sole preview exception, shared presentation placement, no content under source/public.
- `.trellis/spec/frontend/component-guidelines.md:3-33`: Astro-first, accessibility, JS-independent content, centralized tokens.
- `.trellis/spec/frontend/type-safety.md:3-35`: strict TypeScript and validated external boundaries.
- `.trellis/spec/frontend/quality-guidelines.md:3-37`: aggregate verification, Pagefind, browser tests and forbidden runtime/dependency patterns.
- `.trellis/spec/guides/cross-layer-thinking-guide.md`: relevant because hero media and search span Directus -> normalization -> build assets/index -> components.
- `.trellis/spec/guides/code-reuse-thinking-guide.md`: relevant to shared tokens/surface states and renderer/component markup duplication.
- `DESIGN.md:12-158`: authoritative current creative direction and aiayy adaptation/non-cloning constraints.
- `PRODUCT.md:70-93`: reading-first, artifact-first, durable CMS/static publishing and accessibility principles.

## Caveats / Not Found

- The active task has no usable requirements or acceptance criteria yet; `prd.md` is still entirely TBD. The intended delta from the already-aiayy-inspired implementation is therefore unknown.
- No target screenshots, measured reference-site inventory, or approved before/after visual states were present in the task directory. This report audits only the local implementation.
- No Playwright screenshot baselines or visual-regression artifacts exist. Browser tests are behavioral and Chromium-only.
- No production content corpus, actual author avatar, or second real hero candidate is stored in the repository. The current prepared snapshot and `dist/` are generated Directus seed artifacts and may be replaced on the next build.
- Tests were not run because this research role is write-restricted to the task research directory; the full build/test gate rewrites `.generated`, `public/_media`, `dist` and test artifacts. Findings are based on source and existing generated output inspection.
- Frontend specs show some drift from the implementation: directory guidance calls `/preview/[id]` future even though it exists (`directory-structure.md:25-26`), component guidance says there is not yet a reusable component API despite a mature component set (`component-guidelines.md:24-29`), and it calls `global.css` a foundation despite the file now implementing the full visual system (`component-guidelines.md:31-33`). This should be reconciled in the normal post-implementation spec-update phase, not in research.
