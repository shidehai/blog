# Frontend Development Guidelines

frontend-v2 is the public Next app (4321); author-cms is the single-owner writing
app (4322). Public routes read current published content at runtime. Both builds
are offline and need no CMS/DB credentials. Only the main AI conversation may
execute, concurrency 1, including visual review/tests; no subagents or delegation.

## Pre-Development Checklist

- Read [Directory Structure](./directory-structure.md) for route/ownership changes.
- Read [Components](./component-guidelines.md) for editor, UI and accessibility.
- Read [Type Safety](./type-safety.md) for env/schemas/projections.
- Read [Runtime Content](./runtime-content.md) for navigation/freshness/media.
- Read [Quality](./quality-guidelines.md) for checks; backend specs for auth/store changes.
- Search for existing helpers/styles before adding dependencies/abstractions.

## Quality Check

Each app owns its verify gate. Root pnpm verify covers shared/operations changes.
Runtime/browser checks verify publication/cache behavior a build cannot verify.
Use explicit isolated local _test database configuration.
