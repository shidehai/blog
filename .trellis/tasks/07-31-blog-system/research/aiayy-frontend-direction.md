# Frontend Direction: `aiayy.cn` Adaptation

- Decision date: 2026-08-03
- Primary reference: <https://aiayy.cn>
- Surfaces inspected: Home desktop/mobile, Article desktop/mobile, Archive,
  Category, About CSS, global theme/navigation CSS, and shipped motion hooks
- Scope: the complete public Astro frontend; Directus Studio keeps its native UI

## Design Brief

### Feature summary

Build the public blog as a production-ready, Chinese-first adaptation of
`aiayy.cn`'s tactile visual language. Readers should immediately recognize the
floating capsule navigation, single-surface neumorphism, blue signal color,
asymmetric Bento homepage, clipped featured media, and responsive light/dark
behavior while receiving a more readable and accessible long-form experience.

This is not a pixel clone. No reference identity, copy, image, data, route,
category artwork, or source implementation is reused.

### Primary user action

Open the featured or latest piece of writing, then continue through related
writing, notes, topics, Search, Archive, or RSS without visual clutter.

### Design direction

- Strategy: Restrained. One relief surface per theme, strong ink, and blue used
  for focus, selection, links, progress, and the primary feature moment.
- Scene: a developer reads at a matte graphite desk after sunset, guided by a
  few blue instrument lights; in daylight the same desk becomes a cool-neutral
  sculpted surface.
- Anchors: `aiayy.cn` for material/composition/motion, the existing
  "Annotation Spine" for document structure, and the project's real code,
  diagrams, screenshots, and article media for imagery.
- Fidelity: production-ready.
- Breadth: every public route, not the Directus admin.
- Interactivity: shipped-quality theme, navigation, search, copy, outline,
  progress, press/lift, header compression, and optional hero phrase behavior.

### Layout strategy

- Desktop Home: floating header; compact identity card beside a larger feature
  module; a second row of varied utility/content modules; a large latest-writing
  area with recent notes/topics/shortcuts placed by importance.
- Mobile Home: header, featured/current writing, latest choice, then expanded
  identity and lower-priority modules. A profile-first stack would delay the
  actual product too much.
- Discovery routes: compact raised list rows and inset search/filter controls.
  Topics use content-led rows or varied modules rather than a uniform icon grid.
- Article/tutorial: flat 34–42-Han-character reading plane, with controlled
  relief only for outline, code/media frames, callouts, and controls.
- About: a small identity Bento composition is appropriate because identity is
  the page content.

### Key states

- Light, dark, system, and persisted theme without first-paint flash.
- Resting raised, pointer hover, keyboard focus, pressed/inset, current route,
  disabled, and loading states with non-shadow cues.
- Populated, empty, long-title, missing-feature-media, and large-archive states.
- JavaScript disabled, reduced motion, forced colors, 200% zoom, 320px reflow,
  print, and headless rendering.
- Search idle, typing, results, no results, and index-load failure.
- Preview authorized, unauthorized, malformed, unavailable, and no-store states.

### Interaction model

- Header compresses after meaningful scroll but keeps reserved height and stable
  navigation order.
- Raised pointer targets may lift 2–3px; activation becomes inset. Touch does not
  depend on hover.
- One first-row reveal and one optional hero phrase sequence are allowed. The
  DOM starts visible, and reduced motion shows final state immediately.
- Theme cycles system/light/dark, is applied before paint, and has an accessible
  text label in addition to its icon.
- Mobile navigation uses a native focus-managed primitive. Escape closes it and
  focus returns to the trigger.

### Content and asset requirements

- Site name, author name, avatar, introduction, biography, social links, and
  footer come from `site_settings`.
- Feature media must be a real post cover, screenshot, diagram, or code artifact.
  If absent, the feature becomes a deliberate text-led signal module.
- No stock coding photo, generic generated illustration, fake visitor number,
  popularity claim, clock, 3D room, or decorative technology-logo inventory.
- UI copy stays project-specific; reference phrases and labels are not reused.

### Implementation references

- `impeccable` `typeset`: mixed Chinese/Latin hierarchy and long-form metrics.
- `impeccable` `layout`: Bento proportions, responsive order, and route rhythm.
- `impeccable` `animate`: header compression, press/lift, phrase, and reduced
  motion behavior.
- `impeccable` `adapt`: 320px through wide desktop, zoom, and touch handling.
- `impeccable` `audit` and `polish`: measurable implementation review after real
  HTML/CSS exists.

## Reference Evidence

### What creates the recognizable effect

- Floating rounded header, centered navigation, avatar/name brand lockup, and
  compact theme/menu buttons.
- Header shrinks from a wide shell to a narrower capsule after scroll.
- One background material per theme:
  - reference light surface `#e8e6e3`;
  - reference dark surface `#1e1e2a`;
  - paired lower-right dark and upper-left light shadows;
  - inset versions for active tabs, wells, and pressed controls.
- Blue reference signal `#4a8fe7` for current navigation, links, hero phrase,
  pills, and illuminated details.
- Desktop Home begins with a narrow profile card and wide clipped-photo Hero,
  followed by uneven Bento rows and a large article module.
- Mobile stacks the modules, changes the clipped photo to a lower media band,
  and replaces desktop navigation with a menu trigger.
- Small lift/press feedback, a typewriter phrase, blinking cursor, clock updates,
  and entrance transitions create the perceived motion language.
- Archive uses a blue year capsule with compact raised rows. Article pages remove
  most card chrome and use a centered reading column. Category uses a uniform
  icon-card grid.

### Problems not to reproduce

- Reference secondary metadata `#6a6a80` on `#1e1e2a` measures 3.13:1; light
  metadata `#9a9aaa` on `#e8e6e3` measures 2.23:1. Both fail normal-text AA.
- Several reference icon buttons are 36–40px instead of the planned 44px target.
- Some motion starts content translucent; the inspected Article screenshots
  remained visibly dim in a headless/virtual-time context. Essential content
  must never depend on an animation reaching its end state.
- Mobile Home puts a large profile module before the featured content, delaying
  the primary reading action.
- The Category grid repeats identical cards and arbitrary technology colors,
  which feels templated and does not match topic descriptions.
- Visitor statistics, popularity, binary clock, technology-logo grid, and 3D
  room do not serve this publication's confirmed reader tasks.
- The reference loads Inter from Google and is a client-rendered Vue SPA. This
  project retains its self-hosted/system-font decision and Astro static HTML.
- Neumorphic shadow alone is not a sufficient focus, selection, or forced-color
  affordance.

## Adaptation Boundary

### Preserve

- floating/compressing capsule header;
- single-surface relief in intentional light and dark themes;
- blue signal family;
- asymmetric Bento Home;
- narrow identity + wide feature composition on desktop;
- clipped feature media and mobile bottom-media transformation;
- semantic raised/inset/pressed states;
- restrained entry, typing, and hover feedback;
- compact raised discovery rows and pills.

### Improve

- AA text and focus contrast;
- 44px standalone targets;
- visible-by-default/reduced-motion-safe content;
- reading-first mobile order;
- flat long-form prose with outline/progress/code/media support;
- real content artifacts instead of stock/decorative modules;
- forced-color borders and state labels;
- custom Chinese-first type and content hierarchy.

### Reject

- identity, text, avatar, images, exact palette values, data, and code copying;
- visitor/view counters and popularity sorting without analytics;
- clock, 3D space, projects showcase, guestbook, résumé, and friend-link routes;
- generic technology/category icon grids;
- gradient text, nested raised cards, and essential opacity-gated animation.

## Acceptance Lens

The adaptation is successful when a side-by-side review clearly recognizes the
reference's material, composition, and motion family, while the new site remains
unmistakably the owner's publication and outperforms the reference on reading
hierarchy, contrast, mobile content priority, static delivery, reduced motion,
keyboard use, and forced-color resilience.
