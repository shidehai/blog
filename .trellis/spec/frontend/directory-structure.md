# Frontend Directory Structure

## Current Layout

```text
src/
  pages/       # Astro file routes and endpoints
  styles/      # Project-owned CSS
tests/
  unit/        # Boundary and pure-logic tests
  e2e/         # Browser-visible behavior
scripts/       # Build/runtime utilities shared by configuration and containers
```

Root files such as `astro.config.ts`, `playwright.config.ts`,
`vitest.config.ts`, and `eslint.config.js` own tool configuration. Keep the
single application at the repository root; there is no package boundary that
justifies a monorepo.

## Route Rules

- Normal public routes live in `src/pages/` and explicitly export
  `prerender = true`. See `src/pages/index.astro` and
  `src/pages/healthz.ts`.
- Only the `/preview/[id]` route may render on demand. It must not create
  a second rendering or content-normalization path.
- Shared presentation belongs in `src/components/` or `src/layouts/` only after
  a second consumer exists. Do not create empty architecture folders.
- Global tokens, font declarations, and reset styles belong in `src/styles/`.
  `AppLayout.astro` imports `global.css` once for every shared HTML route.

## Naming and Placement

- Astro components and layouts use PascalCase filenames; routes follow Astro's
  lowercase file-routing conventions.
- Pure content/config boundary code belongs in `src/lib/` once introduced.
- Tests name the behavior they prove and stay under `tests/unit` or `tests/e2e`.
- Do not put content records under `src/` or `public/`; PostgreSQL is the only
  live content source.
