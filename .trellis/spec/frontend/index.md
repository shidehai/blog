# Frontend Development Guidelines

The repository is a pnpm workspace with two frontend packages: the Astro 7
application at the root (V1, port 4321) and `frontend-v2`, a Next.js 15
application (V2, port 4322). Public pages are prerendered, use project-owned
HTML/CSS, and add client JavaScript only for a specific progressive
enhancement.

Each package owns its own quality gate and dependency set. A guideline below
applies to both unless it names Astro- or Next-specific files.

## Pre-Development Checklist

- Read [Directory Structure](./directory-structure.md) before adding a page or
  moving code.
- Read [Component Guidelines](./component-guidelines.md) before adding UI.
- Read [Type Safety](./type-safety.md) before consuming environment or CMS data.
- Read [Quality Guidelines](./quality-guidelines.md) before changing scripts or
  tests.
- Search the repository before adding a helper, dependency, or client island.
- Confirm which package you are editing. V1 and V2 have separate dependency
  sets; a package present in one is not resolvable from the other. `tsconfig`
  `paths` are type-check only, so they cannot make a cross-package import work
  at build time.
- Preserve PostgreSQL/Directus as the content source; do not add local Markdown
  content collections.

## Guidelines

| Guide | Owns |
| --- | --- |
| [Directory Structure](./directory-structure.md) | Astro routes, styles, tests, and root configuration |
| [Component Guidelines](./component-guidelines.md) | Astro-first UI and accessibility baseline |
| [Type Safety](./type-safety.md) | Strict TypeScript and runtime boundary validation |
| [Quality Guidelines](./quality-guidelines.md) | Formatting, linting, checks, build, and browser tests |

V1 has no client framework or state library, so React hook and global-state
templates stay out of its guidance. V2 is React via Next.js, but its pages are
server components by default; it has no global state library either. Add
guidance for a pattern only after real code establishes it in the package that
needs it.

## Quality Check

V1: run `pnpm verify` at the root. It must cover formatting, ESLint,
`astro check`, unit tests, the production/Pagefind build, and the Chromium
smoke test.

V2: run `pnpm verify:v2` (or `pnpm --filter frontend-v2 verify`). It must cover
`tsc --noEmit`, ESLint, the fixture selfcheck, and the production build.

The two gates are deliberately separate. Folding V2 into the root `verify`
would make every V1 change pay for V2's Playwright and operations suites while
the packages still evolve independently. Run both gates when a change touches
shared contracts such as `directus/schema.yaml`.
