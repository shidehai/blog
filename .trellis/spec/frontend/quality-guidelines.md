# Frontend Quality Guidelines

## Required Commands

Each app owns its type/lint gate; root ignores app files intentionally.

```sh
pnpm --filter frontend-v2 verify
CMS_TEST_DATABASE_URL=postgres://.../author_cms_test pnpm --filter author-cms verify
CMS_TEST_DATABASE_URL=postgres://.../author_cms_test pnpm test:runtime
CMS_TEST_DATABASE_URL=postgres://.../isolated_launch_test xvfb-run --auto-servernum pnpm test:runtime --site-port 4341 --cms-port 4342 --browser
```

Shared changes require root verify/operations checks. Tests exercise real schemas,
renderers/store/HTTP boundaries. DB tests need isolated local _test config and no
preview sharing its schema. A skipped DB test is not passing DB evidence.

## Runtime and visual regression

Build without CMS/DB credentials; start production with runtime config. Prove
formerly404/new URLs, update, archive/media, category/series/search and outage503
without build/restart. Known writing returns308; unknown writing/note404. Browser
checks cover404 boundary, focus/history, conflicts and images; see runtime spec.

Inspect desktop/mobile390px list/editor/media with Chinese long titles, code,
tables, landscape/portrait images and covered/uncovered posts. Check overflow,
title growth, tabs/dialog/focus/navigation, save failure and publish success.
Save actual screenshots. Bound visual work to inspection, one batch of fixes,
one confirmation pass. Report any UI gestures not actually exercised.

## Styling/dependencies/formatting

Semantic classes need active CSS. Preserve unrelated styles/journals/assets.
Shared Markdown is the sole article grammar/style and code-copy owner. Avoid
second CSS/global-state systems or unused projections. Check resolved licenses,
including transitive binaries, separately from dependency audits. Finish with
git diff --check and scope review.

## Platform/lint gotchas

Node >=24.15.0 <25 and pnpm9.15.9; do not bypass engine checks. Windows standalone
symlinks may require Developer Mode/elevation; Linux Docker is authoritative.
Each app needs eslint.config.mjs: deleting it can reach the root ignore and falsely
pass without checking app files. After lint config changes prove a deliberate
violation is caught. Use ESLint CLI, not next lint. Compose Next plugin/hooks
because ESLint10 is outside eslint-config-next peers. Native img is intentional.
Fixture/environment selfchecks exercise the current runtime parser and shared
public projection. No old SDK/build/media adapter is retained. Runtime image
checks read a self-contained CMS test fixture, never a retired seed directory.

Public Inter/JetBrains Mono compile from locked Fontsource OFL packages through
next/font/local. Builds must not fetch Google Fonts. Retain font/native notices.
Both image smokes verify actual patched Next/Sharp versions and shipping assets;
CI quality and publish both enforce Trivy HIGH/CRITICAL without ignore/bypass.
