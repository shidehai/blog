# Frontend Quality Guidelines

## Required Commands

Run focused commands while changing the V2 app:

```sh
pnpm --filter frontend-v2 typecheck
pnpm --filter frontend-v2 lint
pnpm --filter frontend-v2 selfcheck
pnpm --filter frontend-v2 build
pnpm --filter frontend-v2 verify
pnpm --filter frontend-v2 exec tsc --noUnusedLocals --noUnusedParameters
```

Run the root gate for shared contracts:

```sh
pnpm verify
sh tests/ops/run.sh
sh scripts/validate-operations.sh
```

The V2 selfchecks use Node `assert` and call the real decoder/snapshot path;
do not replace them with mocks that merely repeat implementation details.

## Route and Snapshot Regression Checks

- A production build must contain canonical `/archives/[slug]` pages for the
  current public snapshot.
- Verify a known `/writing/[slug]` returns a permanent redirect to its exact
  canonical archive URL. `/writing`, an unknown legacy slug, and `/notes/*`
  must remain 404.
- Test fixture default mode and directus-mode failures separately. A successful
  fixture build does not validate a failed-closed Directus build.
- When adding/removing snapshot members, update both selfchecks and search all
  pages/components before deleting a field or helper.

## Styling and Dependency Regression Checks

- Every newly introduced semantic class must have a stylesheet rule that can
  affect production output.
- Removing a styling dependency requires a repository search for configuration,
  package entries, and utility-only class strings, followed by a visual/manual
  check of the affected retained pages.
- Do not broadly format `app/globals.css` when it contains user changes. Add
  isolated selectors and retain unrelated visual adjustments.
- Do not add a library when React, browser APIs, existing CSS, or the standard
  library already covers the behavior.

## Forbidden Patterns

- No runtime CMS fallback, local public Markdown store, or page-local
  environment parsing.
- No dynamic catch-all redirect for legacy writing or notes URLs.
- No duplicate code-copy enhancement alongside `MarkdownContent`.
- No inactive Tailwind configuration, generated-utility dependency, or CSS
  class that has no active styling source.
- No unused imports, types, mock catalogs, or content projections retained only
  for a deleted route.

## Formatting Scope

Format application-owned code deliberately. Planning artifacts, user tooling,
and pre-existing unrelated worktree changes are not cleanup targets. Finish by
checking `git diff --check` and reviewing the exact changed-file list.
