# Component Guidelines

## Astro First

Use `.astro` components and native HTML/CSS by default. The established page
shape is `src/pages/index.astro`: typed frontmatter, explicit prerendering,
semantic HTML, a document language, and project-owned CSS.

Client framework islands are not a baseline dependency. Introduce one only
when a named interaction cannot be expressed with Astro, CSS, or native HTML;
keep that island local instead of adding a site-wide client runtime.

## Accessibility Baseline

- Every document declares the validated locale (`zh-CN` initially), charset,
  viewport, unique title, and description.
- Use landmarks and heading order before adding visual wrappers.
- Public content remains useful without JavaScript.
- Native controls keep their keyboard behavior; do not replace them with
  clickable generic elements.
- Visual state must survive forced colors and reduced motion. CSS shadows never
  carry meaning alone.

## Composition

The application has an established semantic component layer. `AppLayout` owns
the document shell; `SiteHeader`, `SiteFooter`, and `PageHeader` own shared
navigation and page framing; `PostList`, `FeaturePost`, and `PostPage` own the
repeated discovery, feature, and reading surfaces. Reuse those boundaries
before creating another route-local version, and type component props in the
frontmatter.

Do not turn those components into a variant factory or speculative UI kit.
Create another component only when two real consumers share a semantic unit.

### Discovery Route Contract

The `/writing/` and `/notes/` routes intentionally share `PostList` semantics
but must communicate different browsing jobs. Writing discovery stays grouped
by article/tutorial sections and may use scoped section accents. Notes discovery
uses a chronological stream wrapper (`.notes-stream`) with lightweight rows;
route-specific presentation belongs under `.writing-page` / `.notes-page` and
must not change the shared post-row contract or content filters. Keep an
observable route marker when a browser test needs to distinguish the modes.

`src/styles/global.css` is the authoritative visual-token and material-state
layer, with local font declarations in `src/styles/fonts.css`. Components and
route-local styles consume those semantic values instead of embedding private
shadow, color, radius, breakpoint, or motion formulas.

## Calibrated Material Contract

The shell reproduces the measured reference material while keeping meaningful
text WCAG 2.2 AA-safe. Preserve the shared roles instead of substituting the
signal swatch directly for text:

```css
:root {
  --surface: #e8e6e3;
  --signal: #4a8fe7;
  --signal-text: #2367ba;
  --signal-ink: #132842;
  --depth-raised:
    6px 6px 14px var(--shadow-dark), -6px -6px 14px var(--shadow-light);
}

:root[data-theme="dark"] {
  --surface: #1e1e2a;
  --signal-text: #76b2ff;
  --signal-ink: #10131d;
}
```

The desktop/tablet/mobile boundaries are inclusive `64rem`, `48rem`, and
`40rem`. Image `sizes` hints must follow the same boundary that changes the
rendered grid. CMS-driven modules use the measured height as `min-block-size`,
not `block-size`, so normal fixture content retains the calibrated geometry and
long valid content expands without overlap.

When `FeaturePost` includes media, its copy and media siblings occupy separate
grid cells while rendered side by side. Do not use absolute positioning or
percentage child widths that cross their column boundary; curved media edges
are clipping treatments only. At the established `48rem` boundary, return the
siblings to source-ordered rows. Browser coverage must assert that their
bounding boxes do not intersect at representative desktop and tablet widths.

When a `type="search"` field has a project-owned reset button, suppress the
WebKit cancel pseudo-element as well as applying `appearance: none`; otherwise
Chromium renders two clear controls. Keep the semantic search input and the
accessible reset button rather than replacing either with a generic element.

## Article Artifact Layout

In a code frame, the generated `pre.shiki` is the horizontal scroller. Keep it
shrinkable with `min-inline-size: 0`, bounded by the prose column, and
`overflow: auto`; preserve long source lines inside that scroller. Do not put
`min-inline-size: max-content` on `.shiki`, because it expands the frame and can
be hidden by page-level overflow clipping instead of scrolling internally.

## Search Request Generations

Every search execution must advance its request generation before inspecting
query/filter state or taking an empty-query early return. Async success and
failure handlers may update the DOM only when their captured generation is
still current, and reset/clear must invalidate any in-flight request before
restoring the default state. Otherwise a slow Pagefind response can resurrect
stale results after the user clears the search.

Pagefind excerpts are parsed as HTML but rebuilt from text nodes plus `mark`
elements only. Never inject a returned excerpt with `innerHTML`.

## Article Artifact Contracts

### 1. Scope / Trigger

The Markdown pipeline crosses the build-time content boundary and the
browser's progressive-enhancement boundary. Changes to Mermaid diagrams,
Shiki code frames, or their reading controls must preserve the contracts below.

### 2. Signatures

- `renderMarkdown(markdown, options): Promise<RenderedMarkdown>` is the single
  entry point for article Markdown.
- Mermaid fenced blocks are transformed by
  `renderMermaidToHast(code, identity)` during the build; there is no client
  Mermaid import or hydration island.
- `CodeCopyBehavior.astro` may enhance generated `.code-frame` markup after
  page load, but it must not be required to read the source or print it.

### 3. Contracts

- A valid Mermaid block emits `figure.mermaid-diagram > svg.mermaid-svg` with
  `role="img"`, a labelled `<title>`, and no executable content or external
  resource URL. The SVG remains inline so the article is useful before any
  client script runs.
- A Mermaid failure includes the Markdown source name and fenced-block line in
  the thrown error. Unsupported code languages and invalid code metadata follow
  the same source-context rule.
- A code block longer than 35 source lines emits a stable `pre` `id`,
  `data-line-count`, `aria-controls`, and an initially expanded disclosure in
  HTML. JavaScript may add `data-code-enhanced="true"` and collapse it only as
  progressive enhancement.
- No-JavaScript and print styles must force complete code visibility. Interactive
  copy/expand controls are hidden in print, while source lines remain selectable
  and readable.

### 4. Validation & Error Matrix

| Condition | Required behavior |
| --- | --- |
| Valid Mermaid syntax and local SVG paint references | Emit sanitized static SVG |
| Malformed Mermaid syntax | Throw `source line N: could not render Mermaid diagram: ...` |
| SVG `data:`, `http(s):`, `javascript:`, `@import`, or non-local `url(...)` | Reject the diagram before returning HTML |
| Mermaid SVG missing after render | Throw a source-context rendering error |
| Code block with 35 or fewer lines | Render complete code without a disclosure |
| Code block over 35 lines | Render complete code and an enhancement-only disclosure |

### 5. Good / Base / Bad Cases

- **Good**: render a fenced `mermaid` block at build time, sanitize its SVG,
  and assert real SVG dimensions in a browser test.
- **Base**: render a short code block as a normal Shiki frame with its language
  badge and copy control.
- **Bad**: ship Mermaid to the browser, trust raw SVG, or make the server
  output collapsed so no-JavaScript readers lose source lines.

### 6. Tests Required

- Unit tests in `tests/unit/markdown.test.ts` cover flowchart and sequence
  syntax, malformed connectors, source-context errors, and remote paint
  rejection.
- Browser tests in `tests/e2e/reading.spec.ts` assert that the diagram is a
  real visible SVG with non-trivial `boundingBox()` dimensions, that long code
  expands/collapses through `aria-expanded`, and that no-JavaScript and print
  modes expose the complete source.

### 7. Wrong vs Correct

#### Wrong

```ts
// The browser downloads and executes a large Mermaid runtime.
<div class="mermaid">{code}</div>
```

#### Correct

```ts
// The Markdown transformer returns an inline, sanitized SVG at build time.
const figure = await renderMermaidToHast(code, `${source}:${line}`);
```

The build-time boundary prevents runtime bundle growth and makes malformed or
unsafe diagrams fail the build with actionable source context.
