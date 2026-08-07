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

When a `type="search"` field has a project-owned reset button, suppress the
WebKit cancel pseudo-element as well as applying `appearance: none`; otherwise
Chromium renders two clear controls. Keep the semantic search input and the
accessible reset button rather than replacing either with a generic element.
