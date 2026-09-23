# Frontend Component Guidelines

## Server First

Next App Router pages and layout components are server components by default.
Fetch the typed snapshot through `lib/content.ts` in that layer and pass only
view-model props to presentation components. Use `"use client"` only when a
component needs browser state, event handlers, storage, clipboard access, or
observers.

Current client boundaries are intentionally local: navigation/theme controls,
the command menu, the reading-page interaction layer, and Markdown copy
behavior. Do not add a global state library or client provider to move a
single interaction upward.

## Semantic CSS Ownership

`app/globals.css` is the authoritative token and component-style layer. JSX
uses semantic classes such as `command-menu-*` and `project-card-*`; those
classes must have a real project-owned rule in the stylesheet.

Tailwind, PostCSS utility generation, and utility-only class strings are not
part of this application. When changing a visible component, add or amend the
matching semantic rule rather than introducing an inert utility dependency.
Preserve existing global visual changes unless the requested behavior directly
requires an isolated merge.

## Accessibility Baseline

- Use a landmark, an ordered heading hierarchy, and native controls before
  adding visual wrappers.
- Keep keyboard navigation and focus-visible styles working for menus, search,
  theme controls, sharing, and table-of-contents links.
- Dialog-like client UI uses `role="dialog"`, `aria-modal`, and an accessible
  label; its result rows remain buttons or links rather than clickable generic
  elements.
- A `type="search"` field with a custom clear button must suppress the WebKit
  native cancel control, otherwise users see duplicate clear affordances.
- Motion and color decorate state but do not carry the only meaning. Preserve
  usable reduced-motion and narrow-width layouts.

## Article Reading Contract

`app/archives/[slug]/ArticleClient.tsx` owns reading progress, heading spy,
sharing feedback, adjacent article links, and related-article presentation.
All intra-site detail links in that component use `/archives/<slug>`.

`MarkdownContent` is the sole owner of generated code-copy controls. A reading
page must not append a second copy button or second listener. `extractHeadings`
and the Markdown heading renderer must retain matching IDs so the table of
contents can target actual article headings.

## Command Menu Contract

The command menu searches the already-built `Post[]` props; it does not fetch a
second content index. Article results navigate to `/archives/<slug>`. Keyboard
selection, pointer selection, and the empty-query navigation list use the same
result array so their indexes cannot diverge.

## Component Placement

Create a shared component only after two real consumers share a semantic unit.
Otherwise keep one-consumer client UI beside its route. Do not turn simple
components into variant factories, duplicate Directus mapping in a component,
or recreate page data from `window.location`.
