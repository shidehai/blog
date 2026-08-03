# Frontend Development Guidelines

The repository contains one Astro 7 application at its root. Public pages are
prerendered, use project-owned HTML/CSS, and add client JavaScript only for a
specific progressive enhancement.

## Pre-Development Checklist

- Read [Directory Structure](./directory-structure.md) before adding a page or
  moving code.
- Read [Component Guidelines](./component-guidelines.md) before adding UI.
- Read [Type Safety](./type-safety.md) before consuming environment or CMS data.
- Read [Quality Guidelines](./quality-guidelines.md) before changing scripts or
  tests.
- Search the repository before adding a helper, dependency, or client island.
- Preserve PostgreSQL/Directus as the content source; do not add local Markdown
  content collections.

## Guidelines

| Guide | Owns |
| --- | --- |
| [Directory Structure](./directory-structure.md) | Astro routes, styles, tests, and root configuration |
| [Component Guidelines](./component-guidelines.md) | Astro-first UI and accessibility baseline |
| [Type Safety](./type-safety.md) | Strict TypeScript and runtime boundary validation |
| [Quality Guidelines](./quality-guidelines.md) | Formatting, linting, checks, build, and browser tests |

React hook and global-state templates were removed because the project has no
client framework or state library. Add guidance only after real code establishes
such a pattern.

## Quality Check

Run `pnpm verify`. It must cover formatting, ESLint, `astro check`, unit tests,
the production/Pagefind build, and the Chromium smoke test.
