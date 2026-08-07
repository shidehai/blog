# Local candidate visual verification

- Fixture: `http://127.0.0.1:4321`
- Production fixture timestamp observed: 2026-08-07 07:49 UTC
- Browser: bundled Playwright Chromium, DPR 1
- Capture viewports: `1440x1000` and `390x844`
- Theme coverage: light and dark, with reduced motion enabled for stable evidence

## Automated result

```text
pnpm verify
9 unit files / 56 unit tests passed
55 Chromium tests passed, including 22 visual-contract tests
```

The suite passed exact light/dark palette and shadow checks, Inter/16px type,
1200px/900px shells, breakpoint-adjacent geometry, the strict `scrollY > 100`
compact threshold, 44px targets, theme persistence, mobile menu behavior,
featured-first mobile order, 320px overflow, search states, long CMS content,
reduced motion, forced colors, accessibility, preview, metadata, operations,
and CSP hash synchronization.

## Manual capture result

`capture-local-candidate.mjs` generated 19 fresh screenshots and
`verification-report.json` for writing/discovery, the long article, search
default/result/empty states, about, 404, the open mobile menu, and resting and
compact header states.

- All 17 normal captures returned HTTP 200; both missing-route captures returned
  HTTP 404 as expected.
- No capture had page-level horizontal overflow.
- No capture emitted a page exception or request failure.
- The only console errors are Chromium's expected top-level 404 resource message
  on the two intentional missing-route captures.
- Human inspection found no text clipping, incoherent overlap, blank media,
  escaped controls, or material mismatch on the captured surfaces.
- Runtime search results use the compact raised recipe in both themes:
  `.search-result` is `24px`/`20px` radius on desktop/mobile with the `3px/6px`
  paired shadow. Chromium displays only the project-owned accessible clear
  button; its native search cancel pseudo-element is suppressed.
- AA-safe light-theme signal text uses `#2367ba` on `#e8e6e3` (`4.53:1`),
  while signal-button ink uses `#132842` on `#4a8fe7` (`4.52:1`). These are the
  documented minimal accessibility deviations from the measured swatches.
- The article stays at a `720px` prose/code/table column on desktop and `358px`
  at 390px. Wide table/code content remains internally scrollable without
  widening the document.
- The mobile menu is `358x259px` at x=16 with two columns, a 24px radius, the
  floating shadow, and 54px-high links. Its height is intentionally shorter than
  the reference's approximately 320px panel because the product preserves six
  routes rather than copying the reference's nine.

## Brand-name check

The current resting `.site-brand-name` is **not ellipsized**. At every tested
width from 1025px through 1440px, the full `示例知识手记` label measured
`clientWidth=108px`, `scrollWidth=108px`, and `isEllipsized=false`. At 1025px,
the brand ends at x=200 and desktop navigation starts at x=322.5, leaving
122.5px of clearance. The fresh screenshot is
`shell-resting-1440x1000-light.png`.

The CSS retains `text-overflow: ellipsis` as a fallback at
`src/styles/global.css:426`, but it is inactive for the current label. In the
compact state only, `src/styles/global.css:444` intentionally collapses the
label to `max-inline-size: 0` and `opacity: 0`; the avatar and accessible brand
label remain. The compact header measures `720x48px` at x=360/y=8.

## Evidence

- `verification-report.json`: computed boxes, materials, document dimensions,
  console/network diagnostics, and brand measurements.
- `capture-local-candidate.mjs`: reproducible local capture probe.
- `writing-*.png`, `article-*.png`, `search-*.png`, `about-*.png`, `404-*.png`,
  and `shell-*.png`: fresh rendered evidence.
