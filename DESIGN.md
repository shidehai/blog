---
name: Personal Knowledge Journal
description: A precise, expressive reading system for technical articles and tutorials.
---

<!-- SEED: re-run $impeccable document once there is code to capture the actual tokens and components. -->

# Design System: Personal Knowledge Journal

## Overview

**Creative North Star: "The Sculpted Workbench"**

The public shell should feel machined from one continuous matte surface: content
modules rise from it, active controls press into it, and a precise blue signal
marks the path through the site. The primary visual reference is
<https://aiayy.cn>, especially its floating capsule header, asymmetric Bento
homepage, paired soft shadows, clipped media hero, and light/dark behavior.

This is an adaptation, not a clone. The reference's avatar, wording, navigation,
stock image, visitor statistics, clock, 3D module, category icons, and
implementation are not reused. Its measured material constants are reproduced,
while low-contrast metadata, sub-44px controls, and opacity-gated content motion
are corrected.

**Physical scene:** a quiet developer at a matte graphite desk after sunset,
with a few blue instrument lights guiding a focused reading session; in daylight
the same desk becomes a cool neutral relief surface. The three material words
are **sculpted, focused, lucid**.

**Key Characteristics:**

- A floating capsule navigation that becomes more compact after scrolling
- An asymmetric Bento homepage whose module size follows content importance
- One cool neutral surface per theme with a precise blue signal color
- Raised, inset, and flat states built from a small semantic elevation scale
- Real article media and code as the primary visual material
- A flatter, higher-contrast long-form reading surface inside the tactile shell
- Responsive feedback with one restrained type rhythm and no content gating

## Colors

Use the calibrated reference materials: `#e8e6e3` in light mode, `#1e1e2a` in
dark mode, strong theme-specific ink, and `#4a8fe7` as the signal. Small
semantic green/red/amber values are reserved for actual state or code diffs,
not decoration. Meaningful text uses separate AA-safe ink/signal tokens where
the observed reference color fails contrast.

**The Signal Color Rule.** Blue identifies selection, focus, links, progress,
and the one hero emphasis. It never becomes gradient text or washes the article
body.

**The Single-Surface Rule.** A theme has one dominant base material. Raised and
inset states come from light/shadow relationships around that same material,
not a stack of unrelated gray cards.

## Typography

Use the self-hosted Inter v20 Latin face for weights 300-900, with a robust
Simplified Chinese platform fallback. The font binary and OFL license ship with
the site; no runtime Google Fonts request is allowed. Weight, scale, and spacing
create hierarchy, while a separate monospace face is reserved for code and
technical literals only.

Body copy stays near 34–42 Han glyphs or 65–75 Latin characters per line. The
shell uses the measured 16px base; long-form prose uses 17px on wider reading
surfaces and 16px on narrow screens, with roughly 1.75–1.9 line height for
Chinese prose. Headings balance naturally and use zero letter spacing rather
than compressed display tracking.

**The Mixed-Script Rule.** Chinese and Latin text must feel intentional in the
same line. Reject any font choice that makes one script appear like a fallback
afterthought.

## Elevation

Neumorphic depth is a core shell material, expressed through semantic `flat`,
`raised`, `raised-compact`, `inset`, `pressed`, and `floating` recipes. Raised
modules use one dark and one light shadow tuned per theme; pressed controls
switch to inset shadows. No component nests a fully raised card inside another
fully raised card, and no raised surface also receives a decorative border or
glow.

**The Reading Plane Rule.** Homepage modules, archive rows, search controls, and
small utility surfaces may use relief. The prose column itself stays flat, with
shadows reserved for media, code frames, the outline surface, and actual
interactive controls. Forced-colors mode removes material shadows and restores
explicit borders.

## Content Artifacts

Code, diagrams, screenshots, tables, and article media are the imagery system.
The large clipped-media Hero borrows the reference's composition but uses a real
artifact from a featured post. It becomes a deliberate text-led blue relief
module when no suitable media exists; it never falls back to a stock coding
photo, generated decoration, or another site's asset.

Code blocks may show a filename, highlighted lines, or diff state when the
author declares them. Those states use labels, symbols, and contrast together;
color alone never carries meaning. Print output removes navigation and controls
but keeps code, URLs, footnotes, and useful media.

**The Annotation Spine.** On long-form pages, outline position, reading
progress, code filenames, captions, and callout labels share one precise margin
rhythm. This is the site's recognizable visual signature, but each mark still
communicates document structure; it never becomes a decorative ruler or grid.

**The Bento Content Rule.** The homepage reinterprets the reference's profile,
hero, statistics, clock, and project cells as author identity, featured writing,
search/archive shortcuts, and latest articles. There are no visitor counters,
fake popularity, binary clocks, or decorative 3D cells.

## Interaction and Motion

Theme selection is applied before first paint to avoid a light/dark flash. The
floating header compresses after meaningful scroll without changing route
positions. Pointer hover may lift a raised module by at most 2–3px; active state
presses it inward. A short hero phrase can type or rotate once, but equivalent
text is present in the HTML and reduced motion shows the final phrase instantly.

The homepage may reveal its first Bento row with one coordinated sequence, but
content is visible by default and never waits for JavaScript, scroll observers,
or animation completion. Standalone controls keep comfortable touch targets,
and mobile navigation uses native dialog/disclosure behavior with predictable
keyboard and focus handling.

On mobile, the featured piece appears before the expanded profile module so the
reference's stacked-card style does not push actual writing below several
screens. Desktop preserves the profile-plus-featured asymmetric composition.

## Do's and Don'ts

### Do:

- **Do** make article typography, code blocks, diagrams, and screenshots the
  visual center of the product.
- **Do** use paired light/dark shadows consistently through semantic elevation
  tokens rather than inventing a shadow for every component.
- **Do** let Bento cell size communicate content priority and collapse to a
  reading-first mobile order.
- **Do** distinguish tutorials and articles through rhythm, metadata, and
  hierarchy rather than separate visual brands.
- **Do** make every motion optional under reduced-motion preferences.
- **Do** keep controls familiar, keyboard accessible, and stable across content
  lengths and viewport sizes.

### Don't:

- **Don't** copy the reference site's identity, content, imagery, route set,
  visitor counters, clock, 3D module, or source implementation.
- **Don't** turn every route into an identical icon-card grid. The topic overview
  may use a compact selector grid, while archive, search, and article discovery
  remain quieter list or reading surfaces.
- **Don't** use beige editorial templates, italic-display-serif affectation, or
  tiny monospace labels as a shortcut to sophistication.
- **Don't** use dark neon developer dashboards, terminal cosplay, purple
  gradients, glassmorphism, or decorative grid backgrounds.
- **Don't** hide content behind reader accounts, social metrics, or infinite
  scroll.
- **Don't** use gradient text, colored side-stripe borders, nested raised cards,
  low-contrast metadata, or motion that begins with essential content hidden.
