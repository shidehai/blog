# Polish frontend and add AI technical articles

## Goal

Turn the visually complete but visibly fake fixture into a convincing Chinese
AI engineering publication. Preserve the established aiayy-inspired material
system, refine the reading and discovery experience where evidence shows real
gaps, and publish a coherent 12-piece editorial collection under the identity
`海边的小卖部`, written by `关山`.

## Background

- The previous visual rebuild established the single-surface shell, asymmetric
  homepage, light/dark themes, responsive behavior, WCAG safeguards, and 22
  passing visual-contract checks.
- The current public build contains only three posts labelled as examples, and
  public copy still exposes fixture and publishing-pipeline language.
- The built-in fixture and Directus seed define different catalogs under
  overlapping deterministic IDs. Local/CI and Directus-backed builds therefore
  need one canonical editorial definition.
- Research is recorded in `research/content-plan.md`,
  `research/ui-polish-audit.md`, and `research/visual-validation.md`.

## Requirements

### R1. Public identity and voice

- Use `海边的小卖部` as the public site name and `关山` as the author name in
  fixture and Directus-seeded settings.
- Use a restrained Chinese engineering voice: precise, direct, evidence-led,
  and personal only when expressing an explicit design judgment.
- Remove `示例` identity, fake-repository links, and build-system explanations
  from public chrome. Do not invent employment history, incidents, readership,
  benchmarks, credentials, or external social URLs.
- Keep the existing core proposition, “把复杂问题写清楚”, while adapting the
  homepage introduction, biography, and footer copy to the confirmed identity.

### R2. Complete AI application-engineering collection

- Publish exactly 12 original Chinese pieces: five conceptual articles, four
  practical tutorials, and three concise notes.
- Use six all-active topics: `LLM 系统`, `检索增强生成`, `AI 评测`,
  `智能体与工具`, `安全与可靠性`, and `推理性能`.
- Include the following catalog:

| Kind | Title |
| --- | --- |
| Article | 从演示到生产：LLM 应用的五层可靠性边界 |
| Article | RAG 不是一次向量搜索：拆解检索、重排与答案归因 |
| Tutorial | 实作：用 TypeScript 搭建可观测的 RAG 最小链路 |
| Note | 切块大小不是一个全局常数 |
| Article | 结构化输出的真正边界：Schema、重试与语义校验 |
| Tutorial | 实作：为工具调用加上参数校验、幂等与超时 |
| Note | 缓存键应包含模型、提示词与工具版本 |
| Article | 为 LLM 应用建立评测闭环：从样本集到回归门禁 |
| Tutorial | 实作：用小型黄金集守住提示词回归 |
| Note | 温度不是可信度旋钮 |
| Article | 把 Prompt Injection 当作数据流问题 |
| Tutorial | 实作：流式回答中的取消、背压与错误收口 |

- Long-form pieces must contain useful structure, original examples, coherent
  code, explicit failure cases, and internal links. Notes must lead with one
  clear conclusion and consequence.
- The observable RAG tutorial must exercise the complete Markdown reading
  contract: H2/H3 outline, table, checklist, supported callouts, meaningful
  image, caption, highlighted/diff code, footnote, and validated internal links.
- Use primary references only where they support a specific claim. Do not copy
  source prose, hotlink media, or present paper results as this site's results.
- Use one original AI reliability-boundary diagram as the meaningful featured
  cover and tutorial artifact, with Chinese alternative text and responsive
  raster variants.

### R3. Canonical content and migration

- Keep PostgreSQL/Directus as the only live content authority; do not introduce
  a local Markdown collection or a second production content store.
- Define topics, posts, joins, IDs, metadata, and bodies once in a checked
  JavaScript fixture module consumed by both the built-in build source and the
  idempotent Directus seed.
- Use new deterministic post IDs and immutable slugs for all 12 pieces. Archive
  the four known legacy fixture posts under their original slugs and ensure no
  public relation references them.
- Migrate or remove only known deterministic fixture records. Never delete or
  overwrite unknown owner content, media bytes, or social links.
- Produce exactly one featured public post, six used topics, valid joins, and
  deterministic related-writing results without changing the Directus schema.
- Keep the generated diagram source digest-addressed in the Directus seed; old
  media bytes may remain unreferenced and must not be overwritten or broadly
  deleted.

### R4. Frontend precision pass

- Preserve the calibrated palette, Inter-based type system, radii, shadow
  recipes, breakpoints, theme prepaint behavior, and flatter long-form plane.
- Make no-media featured artwork reflect the post/topic rather than hardcoded
  PostgreSQL/Astro pipeline labels.
- Replace fixture/build language in homepage and discovery copy with reader-
  facing publication language.
- Scope Pagefind excerpts to useful body prose so result cards do not repeat
  the separately rendered title, kind, date, topic, or reading metadata.
- Display `更新于` only when a post's meaningful update falls on a later local
  calendar day than publication, matching machine metadata.
- Render the full CMS-owned homepage introduction without a silent one-line
  clamp; valid long content must expand modules without overlap.
- Give article, tutorial, note, search, and related rows distinct editorial
  rhythm through existing shared components and content-kind/context classes;
  do not create a uniform card grid or a component variant factory.
- Tie hover, pressed, and focus material states to actual interactive targets.
  Empty space in static modules must not imply a card-wide action.
- Give the article outline one restrained current-section state, remove the
  duplicated mobile directory label, and retain complete no-JavaScript use.
- Reduce content-unearned empty space on the About surface while allowing long
  biography content to expand.

### R5. Accessibility, compatibility, and verification

- Preserve public prerendering, minimal client JavaScript, Pagefind, RSS,
  sitemap, metadata, preview, export, print, and Directus publication behavior.
- Maintain WCAG 2.2 AA contrast, semantic landmarks/headings, keyboard access,
  visible focus, forced-colors support, reduced motion, useful alt text, and
  44px standalone controls.
- Strengthen horizontal-overflow tests so clipped visible elements fail even
  when root `overflow-x: clip` prevents `scrollWidth` growth; explicit code and
  table scrollers remain allowed.
- Validate the densest real content at 320, 390, 768, 1024, 1440, and 1920px as
  applicable, with fresh light/dark screenshots for home, discovery, long-form,
  note, search, topic, archive, and relevant interaction states.

## Acceptance Criteria

- [ ] AC1: The public fixture and Directus seed expose exactly 12 published
      posts with a 5/4/3 kind mix, six used topics, one featured article, unique
      IDs/slugs/joins, and no relation to an archived fixture post.
- [ ] AC2: Home, writing, notes, topics, topic detail, archive, search, RSS,
      sitemap, metadata, export, related writing, and all 12 detail routes show
      the expected new content with valid internal links and no fake public
      identity or example repository link.
- [ ] AC3: The RAG tutorial renders every required Markdown artifact and remains
      useful with JavaScript disabled and in print; all code/examples are
      original, vendor-neutral, and free of real credentials or invented data.
- [ ] AC4: The featured diagram decodes at every responsive size, has stable
      intrinsic dimensions and useful Chinese alt text, and the exact seeded
      bytes pass the Directus media transform contract.
- [ ] AC5: Search renders one title, one metadata group, and a contextual prose
      excerpt per result; type/topic/month filters return the expected catalog.
- [ ] AC6: Publish/update metadata, full homepage introduction, content-aware
      hero fallback, content-kind rhythm, truthful interaction states, article
      outline state, and About geometry work in light/dark and desktop/mobile.
- [ ] AC7: At 320px and all representative widths, no visible element clips,
      escapes, overlaps, or creates page overflow; code and tables scroll only
      inside their declared frames.
- [ ] AC8: Keyboard, 200% text, forced colors, reduced motion, no-JavaScript,
      print, touch targets, focus, and serious/critical Axe checks pass on the
      representative dense-content states.
- [ ] AC9: Seeding Directus twice is idempotent, four known legacy fixture posts
      stay archived with immutable slugs, unknown records are untouched, and a
      Directus-backed build exposes the same 12-piece catalog.
- [ ] AC10: `pnpm verify`, focused Directus/media tests, production build with
      Pagefind, and the final browser/screenshot review pass cleanly.

## Out of Scope

- Changing the Directus schema, deployment topology, static publication model,
  related-content algorithm, or authoring permissions.
- Inventing or linking personal accounts, employment history, audience data,
  analytics, comments, reactions, reader accounts, or social features.
- Copying aiayy identity/content/source, third-party article prose, vendor
  quickstarts, stock developer imagery, or remote authored images.
- Replacing the approved material identity, adding a UI framework, or turning
  every route into a new Bento/card treatment.
- Manufacturing older publication years or claiming the deterministic fixture
  dates are the owner's real publication history.

## Open Questions

None.
