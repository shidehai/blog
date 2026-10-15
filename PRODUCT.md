# Product

## Register

brand

## Platform

web

## Users

The primary audience is developers, learners, and curious peers arriving from
search, shared links, or the author's profile. They need to understand a topic
quickly, follow a tutorial without losing their place, or browse the author's
thinking over time.

The secondary user is the owner-author. They write and manage Markdown in a
dedicated browser CMS, revisit editorial history, and manage publication and site
identity without editing application code. There is permanently one owner: no registration,
teams, roles, approval workflow, or multi-author expansion.

## Product Purpose

This site is the author's durable public knowledge trail: in-depth technical
articles and tutorials form the public reading archive. Success means visitors
can read comfortably, find related material, and recognize a consistent point
of view, while the author has one dependable database-backed publishing
workflow with revisions and recovery. Notes and topics remain CMS editorial
data until a future public route deliberately supports them.

## Positioning

A carefully made personal knowledge journal where complex technical ideas are
explained clearly and smaller thoughts are still worth preserving.

## Conversion & proof

- The primary action is to read the latest or featured piece of writing.
- The secondary action is to browse the archive, categories, tags, and series.
- The line to remember is: "Complex ideas, made clear; small ideas, kept alive."
- The belief ladder is: the author understands the subject; explains with
  evidence and working examples; maintains the material over time; writes with
  a recognizable human voice.
- Proof comes from the published archive, runnable code examples, diagrams, and
  linked source repositories. Testimonials and marketing claims are not part of
  the product.

## Brand Personality

Calibrated, observant, and quietly playful. The voice is direct and technically
precise without becoming cold. It can show curiosity and personal judgment,
but never performs expertise through jargon or visual noise.

## Anti-references

- Generic SaaS landing pages made from uniform icon-card grids, feature lists,
  and large empty hero copy. Bento modules are welcome only when their size and
  placement reflect real content priority.
- Beige editorial templates that rely on an italic display serif, tiny
  monospace labels, and decorative rules to imitate a magazine.
- Dark neon developer dashboards, terminal cosplay, purple gradients, and
  glassmorphism.
- Social feeds designed around engagement metrics, reader accounts, reactions,
  or infinite scroll.
- Decoration that competes with code, diagrams, screenshots, or the writing
  itself.
- A literal clone of another author's avatar, copy, navigation, imagery, data,
  or source code. References establish interaction and material language, not
  borrowed identity.

## Design Principles

1. Reading is the main interaction. Typography, hierarchy, navigation, and
   performance protect attention before anything decorative is added.
2. Tutorials and long-form articles share one identity. Editorial notes may be
   preserved in the CMS, but a future public presentation must earn its own
   route and reading purpose.
3. Show artifacts, not atmosphere. Use real code, diagrams, screenshots, and
   article media instead of generic decorative imagery.
4. Make craft felt through details. Motion, color, and micro-interactions clarify
   state and reward attention; they never gate content or slow navigation.
5. Keep ownership durable. Markdown remains portable text in PostgreSQL, the
   schema and API boundary stay explicit, recoverable exports are routine, and
   public output uses minimal client JavaScript. Git stores code and schema
   snapshots, not a competing live copy of content.
6. Use tactile depth selectively. A single-surface neumorphic shell and
   asymmetric Bento homepage can establish identity, while the actual article
   remains flatter, higher-contrast, and quieter for sustained reading.

## Accessibility & Inclusion

Target WCAG 2.2 AA. All reading and navigation flows must work with a keyboard,
visible focus, zoomed text, high contrast, and reduced motion. Color is never
the only carrier of meaning. Public content requires no account, cookie banner,
or authentication step.

## Author Workspace and Publishing

The owner uses Markdown with live preview, autosave, images, covers and explicit
publication. The dedicated CMS uses a warm paper surface, sage navigation and
a restrained vermilion action color; desktop comparison and mobile editing
protect the same writing task. Draft edits and restored history never change
the published snapshot until the owner publishes.

Publishing commits immediately: public requests read the current CMS/database
state without rebuilding or restarting the site. Existing readers revalidate
on navigation, browser return or focus. CMS/database availability is now part
of public reading availability; outages are explicit, with no stale fixture
fallback. Code deployment remains a separate operational action.

PostgreSQL author_cms is the only live authority after cutover. Actual media,
immutable revisions, source archives and content exports remain recoverable.
A historical migration limitation must be reported and reconciled before
claiming a lossless production switch.
