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

## Local Build Environment Gotchas (Windows)

> **Warning**: On Windows without Developer Mode or an elevated shell,
> `pnpm --filter frontend-v2 build` fails at "Collecting build traces" with
> `EPERM: operation not permitted, symlink` while copying the standalone
> output. Compilation and static page generation still succeed, so a failure
> at that exact step is environmental, not a code regression. Confirm via
> `HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\AppModelUnlock` →
> `AllowDevelopmentWithoutDevLicense`; the authoritative standalone-image
> check is the Linux CI job (`docker build --target runtime`).

> **Warning**: The repo enforces `engines.node >=24.15.0 <25` with
> `engine-strict=true`. Tooling-bundled Node (e.g. harness runners) may be
> older; run pnpm with an nvm-installed 24.15.0+ on PATH
> (`$env:LOCALAPPDATA\nvm\v24.15.0`) instead of bypassing the engine check.

## Lint Gate Ownership

`frontend-v2/eslint.config.mjs` is the sole lint config for the V2 app; the
root `eslint.config.js` intentionally ignores `frontend-v2/**` because the
root gate only owns `scripts/` and `directus/`. `pnpm --filter frontend-v2
lint` runs the ESLint CLI (`eslint .`), not the deprecated `next lint`;
`next.config.ts` sets `eslint.ignoreDuringBuilds` so builds do not lint
twice.

> **Warning**: Deleting `frontend-v2/eslint.config.mjs` silently reverts the
> gate to a false green — config discovery walks up to the root config, every
> V2 file matches the root ignore, and `eslint .` exits 0 having checked
> nothing. After touching lint configuration, prove the gate is real by
> introducing a deliberate violation (e.g. a conditional hook) and confirming
> lint fails.

`eslint-config-next` is deliberately NOT used: its peer range stops at
eslint 9 while the workspace root runs eslint 10 under
`strict-peer-dependencies=true`. The V2 config composes
`@next/eslint-plugin-next` (pinned to the Next version) and
`eslint-plugin-react-hooks` directly. `@next/next/no-img-element` is off
because the project intentionally uses native `<img>` and carries no
next/image consumer.

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
