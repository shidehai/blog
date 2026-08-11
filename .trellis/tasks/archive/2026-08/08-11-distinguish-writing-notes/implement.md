# Implementation Plan

1. Read the frontend pre-development checklist and inspect the existing route/list styles and discovery tests.
2. Update the writing and notes index markup/classes/copy so each route communicates its distinct browsing mode while preserving shared components and links.
3. Adjust `src/styles/global.css` with scoped notes-stream and writing-discovery rules, including mobile and theme behavior; avoid changing global card tokens.
4. Extend focused Playwright coverage for the two route contracts and content separation; update snapshots/assertions only when behavior intentionally changes.
5. Run Prettier check, ESLint, `astro check`, focused tests, and `pnpm verify`; inspect responsive output if a visual contract changes.
6. Review the diff for unrelated changes, update the task/spec journal as required, and prepare the final commit/finish workflow.

## Risk and Rollback

- Risk: route-specific CSS can accidentally alter shared `PostList` rows. Keep selectors under `.writing-page` / `.notes-page` and verify both routes.
- Risk: stronger timeline decoration can reduce contrast or create overflow on narrow screens. Prefer existing semantic colors and measured spacing; test at mobile width.
- Rollback: revert the route-local markup/style/test changes; content filtering and URLs remain untouched.
