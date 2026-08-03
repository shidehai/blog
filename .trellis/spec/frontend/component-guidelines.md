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

There is not yet a reusable component API. Create a component when two real
routes share a semantic unit, then type its props in the component frontmatter.
Do not create variant factories, a UI kit, or speculative primitives ahead of
Phase 4's real shell.

The current `src/styles/global.css` is only a readable foundation. New visual
tokens must follow `DESIGN.md` and stay centralized rather than embedding
private shadow/color formulas in components.
