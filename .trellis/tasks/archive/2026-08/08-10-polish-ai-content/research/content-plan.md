# Research: Chinese AI editorial content plan

- Query: Inspect the existing Directus seed/schema, fixture content path, content preparation and rendering contracts, discovery/feed/search routes and tests, and archived task decisions; recommend a concrete, coherent set of original Chinese AI engineering content and enumerate affected files/contracts.
- Scope: mixed (repository implementation and primary external references)
- Date: 2026-08-10

## Findings

### Executive recommendation

Replace the three visibly fake public fixture posts with one canonical, mirrored editorial dataset of **12 published pieces: 5 conceptual articles, 4 practical tutorials, and 3 concise notes**. Use exactly six active topics, one featured article, one original AI-systems diagram in three raster sizes, and topic assignments designed to produce useful deterministic related-content results.

Do not change the Directus schema or public route model. The existing fields and Markdown renderer already express the requested content shapes. The important implementation change is to stop maintaining two independent fixture inventories: add one checked JavaScript content-definition module consumed by both `directus/seed/index.mjs` and `src/lib/content.ts`.

The recommended collection is vendor-neutral. Code should define local interfaces and deterministic fake adapters rather than claim support for a particular model provider. Technical claims should link to primary papers, standards, or platform-neutral browser/security documentation, and no article should report an unmeasured benchmark.

### Existing content flow

```text
Directus seed or fixtureInput()
  -> loadPublishedInput()
  -> Zod parse + relationship/media validation
  -> scripts/prepare-content.ts writes .generated/site.json
  -> getPreparedSite() renders Markdown and validates all routes/fragments/media
  -> Astro prerenders post/discovery/feed/sitemap pages
  -> Pagefind indexes PostPage body + kind/topic/month metadata
```

Key contracts:

- `src/lib/content.ts:127-145` accepts only `article`, `tutorial`, and `note`; requires UUIDs, offset-bearing timestamps, ASCII slugs, non-empty body/title, and the existing post metadata fields.
- `src/lib/content.ts:299-420` rejects duplicate IDs/slugs/joins, unpublished rows in a public snapshot, long-form posts without summaries, meaningful covers without alt text, missing relationships, orphan file records, and media outside the publishable folder.
- `src/lib/content.ts:531-533` maps notes to `/notes/<slug>/` and both articles/tutorials to `/writing/<slug>/`.
- `src/lib/content.ts:570-603` sorts by descending publication timestamp, derives reading time, derives a note summary when absent, and sorts a post's topics by slug.
- `src/lib/content.ts:677-698` has no editorial related-post field. Related entries are derived by `10 * shared topic count + same-kind bonus`, then recency and slug. Topic design therefore is the editorial related-content control.
- `src/lib/site.ts:74-102` renders every post before build completion and validates every internal route, fragment, and media reference against the generated route set.
- `src/lib/markdown.ts:99-104` accepts only Shiki-bundled language identifiers (plus text aliases); unsupported languages fail the build.
- `src/lib/markdown.ts:284-337` forbids body H1 headings, validates links and Directus-only images, requires image alt text, and validates code metadata.
- `src/lib/markdown.ts:446-490` supports only `[!NOTE]`, `[!IMPORTANT]`, and `[!WARNING]` callouts and wraps GFM tables accessibly.
- `src/lib/markdown.ts:500-547` resolves authored images only through `directus://<uuid>` or `/assets/<uuid>` and emits intrinsic dimensions; remote hotlinked images are outside the authored-media contract.
- `src/lib/markdown.ts:559-655` supports `filename="..."`, highlighted line ranges, and `diff` on fenced code blocks, then adds the copy control.

No schema expansion is justified. The current `posts` fields already include kind, title, immutable slug, timestamp, summary, Markdown body, many-to-many topics, featured flag, cover/alt/decorative fields, and optional SEO overrides (`directus/schema.yaml:277-318`, `directus/schema.yaml:337-425`, `directus/schema.yaml:428-565`, `directus/schema.yaml:568-635`, `directus/schema.yaml:637-860`). Database checks agree with those publication rules and make every published post slug immutable (`directus/database.sql:14-35`, `directus/database.sql:55-70`).

### Current seed and fixture inventory

There are two separate public datasets today, and they have already drifted.

| Source | Public posts | Topics | Important difference |
| --- | ---: | ---: | --- |
| Built-in fixture, `src/lib/content.ts:931-1099` | 3 (article, tutorial, note) | 2 | Drives normal local/CI Astro and Pagefind builds. Tutorial ID ends in `0003` and route is `/writing/validate-a-published-snapshot/`. |
| Directus seed, `directus/seed/index.mjs:12-25`, `:143-292` | 3 published + 1 archived | 3 | Drives real Directus integration. Tutorial ID ends in `0002` and route is `/writing/publish-from-content-version/`. |

Both inventories use overlapping deterministic post/topic IDs for different records. That is a correctness hazard, not only an editorial inconvenience. The previous production-readiness verification explicitly observed different fixture and Directus routes and only three indexed pages (`.trellis/tasks/archive/2026-08/08-05-blog-production-readiness/verification.md:25`, `:62-67`).

The current public fixture intentionally exercises one instance of every major renderer primitive: H2/H3 outline, GFM table/task list, important callout, inline Directus image, highlighted diff code, footnote, and two internal links (`src/lib/content.ts:1013-1043`; asserted at `tests/unit/content.test.ts:149-188`). Preserve that breadth in one new representative tutorial rather than spreading each primitive into a different post and weakening the reading regression.

The current cover is an actual rasterized publishing-pipeline diagram, but its visible text says `PUBLISHING WORKBENCH` and `DEVELOPMENT FIXTURE`; it should not remain the hero for the AI collection. It is generated at 640/960/1600 widths in `scripts/generate-assets.ts:37-99`, loaded into Directus through the digest-addressed media helper (`directus/seed/fixtures.mjs:4-18`), and hardcoded as the fixture-mode media result (`scripts/prepare-content.ts:34-65`).

### Seed migration constraints

The Directus seed is idempotent upsert logic and does not reset existing data (`directus/seed/index.mjs:34-79`; `README.md:74-85`). The migration must account for that:

1. Do not reuse post IDs `f200...0001` through `f200...0003` for new slugs. The database trigger rejects changing a published post slug.
2. Keep legacy post IDs `f200...0001` through `f200...0004` and upsert them as archived with their original slugs. This is an explicit migration of known fake seed records, not a general content cleanup.
3. Reuse topic IDs `f100...0001` through `f100...0003` for the first three new topics and add IDs ending `0004` through `0006`. Topic slugs are not immutable.
4. Reassign the four existing deterministic join IDs to new public post/topic pairs, then add the remaining joins under new deterministic IDs. This matters because the Directus loader currently fetches **all** junction rows (`src/lib/content.ts:767-775`) while validation rejects a junction whose post is not in the published snapshot (`src/lib/content.ts:368-383`). Archiving old posts while leaving their old joins would fail a real Directus-backed build.
5. Use new post IDs ending `0101` through `0112`. This keeps public fixture identities stable and clearly separates the collection from archived legacy records.
6. Set exactly one public post to `featured: true`. The schema does not enforce uniqueness; homepage selection uses the first featured writing item in date-sorted order (`src/pages/index.astro:18-23`).

### Discovery behavior the collection should exercise

- Homepage: one featured writing item; four latest non-featured writing rows; only the latest note is displayed in the note module; six highest-count active topics appear (`src/pages/index.astro:18-42`, `:191-204`, `:248-295`). Twelve posts and six all-used topics fill every module without changing page caps.
- Writing: articles and tutorials are separately counted and rendered, preserving date order within each kind (`src/pages/writing/index.astro:10-14`, `:50-83`).
- Notes: every note appears in one date-ordered stream and uses its derived excerpt when `summary` is null (`src/pages/notes/index.astro:10-40`; `src/lib/content.ts:593`).
- Topics: every topic is generated even when empty, and the topic index visibly includes empty topics (`src/pages/topics/index.astro:12-17`, `:31-75`). Seed exactly six topics and attach every one to at least two posts; do not leave old unused topics behind.
- Topic detail: writing and notes split into separate sections, so at least one topic should contain both (`src/pages/topics/[slug].astro:28-33`, `:47-99`). All proposed topics do.
- Archive: all published kinds appear in one complete year-grouped timeline (`src/pages/archive/index.astro:12-18`, `:41-86`). The proposed dates are honest deterministic fixture metadata within 2026; do not fabricate older years merely to make another heading.
- Search: the default state shows five newest posts; Pagefind filters by kind, topic slug, and publication month (`src/pages/search/index.astro:9-28`, `:79-109`; `src/components/PostPage.astro:39-81`). The proposed dates span May-August, producing useful month filters.
- RSS: every published post appears with its normalized summary and categories for kind plus topics (`src/lib/discovery.ts:91-125`). Notes therefore need strong opening sentences because their excerpt becomes the feed description.
- Sitemap: every post and every topic gets a route (`src/lib/discovery.ts:50-88`).
- Metadata: `seoTitle`/`seoDescription` override title/summary only where set, while topic names become article tags/JSON-LD keywords (`src/components/PostPage.astro:24-35`; `src/lib/metadata.ts:100-121`). Use SEO overrides selectively so both override and fallback paths remain exercised.

## Proposed Editorial Set

### Topic taxonomy

Use stable English ASCII slugs with concise Chinese labels. These six topics fit the homepage cap exactly and are broad enough to survive beyond this initial series.

| ID suffix | Name | Slug | Description | Proposed count |
| --- | --- | --- | --- | ---: |
| `0001` | LLM 系统 | `llm-systems` | 大模型应用的边界、编排、可观测性与运行时设计。 | 6 |
| `0002` | 检索增强生成 | `retrieval-augmented-generation` | 文档切分、召回、重排、上下文编排与答案归因。 | 3 |
| `0003` | AI 评测 | `ai-evaluation` | 样本集、指标、回归测试与上线判断。 | 7 |
| `0004` | 智能体与工具 | `agents-and-tools` | 结构化输出、工具调用和受控执行。 | 4 |
| `0005` | 安全与可靠性 | `ai-safety-reliability` | 输入信任、失败边界、降级与安全控制。 | 6 |
| `0006` | 推理性能 | `inference-performance` | 流式传输、缓存、延迟与资源权衡。 | 2 |

### Catalog and metadata

Publication timestamps below are deterministic fixture metadata, all with an explicit UTC offset. Before loading the set into an owner production database, use actual publication timestamps rather than presenting these as historical owner activity.

| ID suffix | Date (UTC) | Kind | Title | Slug | Topics | Featured |
| --- | --- | --- | --- | --- | --- | --- |
| `0101` | `2026-05-20T01:00:00.000Z` | article | 从演示到生产：LLM 应用的五层可靠性边界 | `production-llm-reliability-boundaries` | LLM 系统；AI 评测；安全与可靠性 | yes |
| `0102` | `2026-05-27T01:00:00.000Z` | article | RAG 不是一次向量搜索：拆解检索、重排与答案归因 | `rag-retrieval-reranking-attribution` | 检索增强生成；AI 评测 | no |
| `0103` | `2026-06-04T01:00:00.000Z` | tutorial | 实作：用 TypeScript 搭建可观测的 RAG 最小链路 | `typescript-observable-rag-pipeline` | LLM 系统；检索增强生成；AI 评测 | no |
| `0104` | `2026-06-11T01:00:00.000Z` | note | 切块大小不是一个全局常数 | `chunk-size-is-not-global` | 检索增强生成；AI 评测 | no |
| `0105` | `2026-06-20T01:00:00.000Z` | article | 结构化输出的真正边界：Schema、重试与语义校验 | `structured-output-schema-retry-validation` | 智能体与工具；安全与可靠性 | no |
| `0106` | `2026-06-29T01:00:00.000Z` | tutorial | 实作：为工具调用加上参数校验、幂等与超时 | `safe-tool-calling-typescript` | 智能体与工具；安全与可靠性 | no |
| `0107` | `2026-07-06T01:00:00.000Z` | note | 缓存键应包含模型、提示词与工具版本 | `llm-cache-key-versioning` | 智能体与工具；安全与可靠性；推理性能 | no |
| `0108` | `2026-07-14T01:00:00.000Z` | article | 为 LLM 应用建立评测闭环：从样本集到回归门禁 | `llm-evaluation-regression-loop` | LLM 系统；AI 评测 | no |
| `0109` | `2026-07-23T01:00:00.000Z` | tutorial | 实作：用小型黄金集守住提示词回归 | `prompt-regression-golden-set` | LLM 系统；AI 评测 | no |
| `0110` | `2026-07-30T01:00:00.000Z` | note | 温度不是可信度旋钮 | `temperature-is-not-confidence` | LLM 系统；AI 评测 | no |
| `0111` | `2026-08-04T01:00:00.000Z` | article | 把 Prompt Injection 当作数据流问题 | `prompt-injection-data-flow` | 智能体与工具；安全与可靠性 | no |
| `0112` | `2026-08-08T01:00:00.000Z` | tutorial | 实作：流式回答中的取消、背压与错误收口 | `streaming-llm-sse-cancellation` | LLM 系统；安全与可靠性；推理性能 | no |

Recommended summaries for the nine long-form pieces:

| ID | Summary |
| --- | --- |
| `0101` | 把一次 LLM 请求拆成输入、上下文、模型、工具与验证五层，并为每层定义可观测的失败边界。 |
| `0102` | RAG 的质量来自召回、重排、上下文编排与引用闭环，而不是把向量搜索接到模型前面。 |
| `0103` | 从文档切分、召回、重排到答案引用，搭建一条可测试、可追踪的 TypeScript RAG 最小链路。 |
| `0105` | 结构正确只是起点；生产系统还要处理语义约束、重试预算、版本兼容与失败收口。 |
| `0106` | 用参数 Schema、幂等键、超时和结果校验包住工具调用，让失败可重试也可诊断。 |
| `0108` | 用小而可信的样本集、可解释指标和变更门禁，把“感觉更好”变成可重复的工程判断。 |
| `0109` | 建立一个小型黄金样本集，计算可解释结果，并把提示词变更接入自动化回归门禁。 |
| `0111` | 从不可信输入如何穿过检索和工具链出发，建立 Prompt Injection 的数据流威胁模型。 |
| `0112` | 实现一条支持取消、心跳、背压与错误事件的流式回答通道，并验证断线后的收口行为。 |

Set `summary: null` on all three notes so excerpt derivation remains covered. Give `0101` explicit SEO overrides (`seo_title: "生产级 LLM 应用的五层可靠性边界"`; `seo_description` matching its summary but written as a complete search snippet). Give `0102` an explicit SEO title only and `0111` an explicit SEO description only. Leave the other records null to exercise normal fallback behavior.

### Content briefs and artifact opportunities

#### 0101 — Five reliability boundaries

- Target shape: 1,800-2,400 Chinese characters; H2 sections for request/input, context, model, tools, verification, then an operational checklist. H3s should describe ownership and observable failure at each boundary.
- Artifact: one original 16:9 diagram labelled `INPUT -> CONTEXT -> MODEL -> TOOLS -> VERIFY`, generated as 640/960/1600 WebP. Use it as the meaningful featured cover with Chinese alt text such as “一次 LLM 请求经过输入、上下文、模型、工具与验证五层边界”.
- Renderer coverage: comparison table, `[!IMPORTANT]` callout that the five-layer model is the author's engineering synthesis, task checklist, one compact TypeScript boundary interface, and footnotes to NIST.
- Internal links: link context retrieval to `0102`, tool boundary to `0106`, and verification to `0108`.
- Related outcome: topic scoring should surface `0108`, `0112`, and `0109` without any schema change.

#### 0102 — Retrieval, reranking, attribution

- Target shape: 1,600-2,100 characters; define candidate generation, reranking, context packing, and attribution as separate stages. Avoid claiming one universal chunk size or top-k.
- Artifact: pipeline table with input/output/failure signal for each stage; pseudocode that returns chunks with document IDs and scores; `[!WARNING]` callout that generated citations are not proof unless grounded in retrieved source IDs.
- Internal links: implementation to `0103`, chunking qualification to `0104`, evaluation to `0108`.
- References: Lewis et al. RAG and Karpukhin et al. DPR. Explain what each paper establishes; do not borrow prose or report paper results as this site's benchmark.

#### 0103 — Observable TypeScript RAG tutorial

- This should replace the old fixture tutorial as the **complete reading-contract fixture**.
- Target shape: 1,500-2,200 characters with prerequisites, typed interfaces, deterministic in-memory documents, split/retrieve/rerank/answer stages, trace events, assertions, and a verification checklist.
- Include H2/H3 outline, a GFM table, task list, one each of NOTE/IMPORTANT/WARNING across the article, the AI systems diagram as an inline `directus://<file-id>` figure with a caption, two or three `ts` code blocks with filenames and line highlights, one small `diff` block, footnotes, and internal links with validated fragments.
- All code must run against local fake adapters. Do not include credentials, provider SDKs, or a copied vendor quickstart.
- Internal links: conceptual RAG model `0102`, chunking note `0104`, golden-set tutorial `0109`.

#### 0104 — Chunk size is not global

- Target shape: 250-450 characters, no headings required. Open with the conclusion so its derived excerpt is useful in lists and RSS.
- Cover semantic boundaries, document structure, retrieval unit, and evaluation set. Avoid prescribing a numeric default.
- Internal links: `0102` and `0103`; no external citation is necessary beyond the RAG paper already used by the longer pieces.

#### 0105 — Structured output boundaries

- Target shape: 1,500-2,000 characters; separate syntax validation, schema validation, domain validation, retry classification, and versioning.
- Code: original TypeScript with Zod 4.4-style parsing at an `unknown` boundary, a discriminated result, retry budget, and explicit terminal error. Use `json` only for a small schema/example payload.
- Callout: `[!WARNING]` that schema-valid output can still be semantically wrong.
- Internal links: safe execution to `0106`, cache versioning to `0107`, injection/data trust to `0111`.
- References: JSON Schema Draft 2020-12 and Zod documentation. Do not imply a provider implements all of Draft 2020-12.

#### 0106 — Safe tool-calling tutorial

- Target shape: 1,400-2,000 characters; typed tool registry, input validation, allowlist, idempotency key, `AbortController` timeout, output validation, and structured audit event.
- Code: original TypeScript only; use a fake `create_ticket` tool so no network service or product capability is claimed.
- Test matrix: malformed arguments, duplicate request, timeout, tool exception, invalid result, successful result.
- Internal links: `0105`, `0107`, and `0111`.

#### 0107 — Cache-key versioning note

- Target shape: 220-380 characters. Show a compact tuple such as `(modelRevision, promptRevision, toolSchemaRevision, normalizedInputHash)` and explain invalidation ownership.
- Do not claim a universal cost or latency saving. Keep `summary: null`.
- Internal links: `0105`, `0106`, and `0112`.

#### 0108 — Evaluation loop

- Target shape: 1,700-2,300 characters; scope -> dataset -> evaluator -> review -> gate -> failure analysis. Distinguish deterministic checks, rubric judgments, and human review.
- Artifact: table mapping claim, sample, evaluator, threshold owner, and failure action. Use illustrative fake cases and label them as examples, not measurements.
- Code: a small TypeScript evaluator returning per-case evidence and aggregate counts; no invented accuracy number.
- Callout: `[!IMPORTANT]` that a metric is useful only with a named decision and failure action.
- Internal links: `0109`, `0110`, `0101`.
- References: NIST AI RMF / Generative AI Profile and HELM as background, without treating either as a drop-in test suite.

#### 0109 — Golden-set regression tutorial

- Target shape: 1,300-1,900 characters; define a tiny checked-in case format, deterministic graders, review-needed outcomes, report generation, and a CI exit policy.
- Code: `ts` types and a small `json` case list; one diff block showing a prompt revision with a corresponding new regression case.
- Use fake expected phrases and source IDs, not real user prompts or private logs.
- Internal links: `0108`, `0103`, `0110`.

#### 0110 — Temperature is not confidence

- Target shape: 250-450 characters, no headings required. Explain narrowly that sampling temperature reshapes token selection and does not measure factual correctness or calibrated certainty.
- Avoid numerical recommendations and avoid conflating model-reported confidence with probability calibration.
- Internal links: `0108` and `0109`; keep `summary: null`.

#### 0111 — Prompt injection as data flow

- Target shape: 1,600-2,200 characters; mark system instructions, user input, retrieved text, tool output, and tool arguments by trust level and capability.
- Artifact: threat table covering source, reachable capability, validation, and safe failure. Use `[!WARNING]` for the central rule: retrieved text is data, not authority.
- Code: a small typed taint/source model and allowlisted action request; do not promise that prompt text alone provides isolation.
- Internal links: `0102`, `0105`, `0106`.
- Reference: OWASP LLM01 Prompt Injection and NIST risk guidance.

#### 0112 — Streaming cancellation/backpressure tutorial

- Target shape: 1,400-2,000 characters; server event model, client parser, cancellation propagation, heartbeat, backpressure, terminal error event, and cleanup test.
- Code: browser-standard `ReadableStream`, `TextDecoderStream`, and `AbortController`; do not depend on a specific AI SDK. Use explicit event types rather than ad hoc string splitting where a parser/state machine is needed.
- Callout: `[!NOTE]` that transport completion and model-task completion are separate states.
- Internal links: `0101`, `0107`, and `0106`.
- References: MDN Streams API, AbortController, and the HTML Server-sent events model if SSE is used.

### Depth and voice constraints

- Articles: target roughly 1,500-2,400 Chinese characters, 4-6 H2 sections, and evidence before recommendations. Reading time is derived; do not hardcode or promise a duration.
- Tutorials: target roughly 1,300-2,200 characters, 2-4 original code blocks, prerequisites, an explicit verification step, and failure cases. Code should be coherent enough to type-check when assembled, even though the site does not execute it.
- Notes: target 220-450 characters, one claim plus one consequence, usually no headings, no manual summary, and at most one compact code fragment.
- Write in a direct first-person engineering voice only where the author is expressing a design judgment. Do not invent production incidents, user numbers, benchmarks, or personal employment history.
- Define English technical terms at first use, then use one consistent term. Prefer `检索增强生成（RAG）`, `重排`, `黄金样本集`, `工具调用`, `背压`, and `失败收口` consistently across the series.
- External references should be footnotes attached to the claim they support, not a decorative bibliography. Internal links should use root-relative generated routes; fragment links must match the renderer's GitHub-style heading IDs.

## Exact Files and Contracts Affected

### Recommended product changes

| File | Change | Contract impact |
| --- | --- | --- |
| `directus/seed/content.mjs` (new) | Own the six topics, 12 public post definitions, bodies, metadata, deterministic IDs, and joins; expose a builder that accepts the runtime cover file ID. | Creates one canonical public fixture definition shared by local builds and the Directus seed. Use JSDoc because `checkJs` is enabled. |
| `directus/seed/index.mjs` | Consume the canonical definitions; archive four known legacy posts; repurpose old join IDs; upsert the 12 new posts and all topic relations. | Must remain idempotent and must not reset/delete arbitrary content. Preserve `ensureFile` behavior. |
| `src/lib/content.ts` | Replace the inline three-post `fixtureInput()` content with the canonical builder, while still supplying fixture settings/social/file metadata. | Parser, normalization, routes, and related algorithm stay unchanged. Built-in fixture becomes 12 posts/6 topics. |
| `scripts/generate-assets.ts` | Add an original AI reliability-boundaries diagram in 640/960/1600 WebP sizes. Keep default social/brand generation separate. | Article artifact, not decorative stock imagery. Stable 16:9 dimensions remain required. |
| `public/images/ai-reliability-boundaries-640.webp`, `public/images/ai-reliability-boundaries-960.webp`, `public/images/ai-reliability-boundaries.webp` (generated/committed) | New raster variants. | Used by fixture build and exact Directus seed bytes. |
| `directus/seed/fixtures.mjs` | Point the digest-addressed cover helper at the new committed 960px WebP and update filename/title semantics. | Must retain SHA-256 title suffix and exact-byte loading (`.trellis/spec/backend/database-guidelines.md:34-62`). |
| `scripts/prepare-content.ts` | Map the fixture media record to the new three public raster paths rather than the publishing-workbench paths. | Directus mode continues to transform the uploaded original normally. If more than one fixture file is added, replace the single hardcoded mapping with an explicit per-file map; the current loop maps every file to the same asset. |

No changes are recommended to `directus/schema.yaml`, `directus/database.sql`, `src/lib/discovery.ts`, `src/lib/markdown.ts`, `src/lib/references.ts`, route components, or Pagefind markup for the content addition itself. Those are existing contracts the new data must pass. Visual-polish work may independently change components/styles, but it should not be justified as a content-model requirement.

### Tests that must change because they name the old fixture

| File | Required update |
| --- | --- |
| `tests/unit/content.test.ts` | Replace exact three-post order/routes with the 12-post 5/4/3 editorial contract; assert all six topics are used; move the complete Markdown primitive test to `0103`; assert representative intended related-post order. |
| `tests/directus.mjs` | Update seeded counts from 3 published/1 archived to 12 published/4 known archived; assert one featured post, six topics, join migration with no archived-post junction, new digest media reference, and second-seed idempotency. |
| `tests/unit/media.test.ts` | Update exact source byte length/digest/title/filename and deterministic transformed paths for the new 960px diagram. |
| `tests/unit/brand-assets.test.ts` | Add the three new diagram dimensions and, if treated as immutable content-owned media, exact digests. Existing publishing-workbench checks may remain until those assets are intentionally retired. |
| `tests/e2e/smoke.spec.ts` | Expect featured heading `从演示到生产：LLM 应用的五层可靠性边界`. |
| `tests/e2e/discovery.spec.ts` | Point article metadata/RSS assertions at a new route/date; search for a distinctive Chinese AI term; update note/topic/month filter counts (3 notes, 3 RAG pieces, 4 July pieces). Avoid assertions that merely repeat total catalog size when the behavior under test is filtering. |
| `tests/e2e/reading.spec.ts` | Use `/writing/typescript-observable-rag-pipeline/`; keep outline/table/callout/footnote/code/media/no-JS/print/copy assertions and update copied-code/title text. |
| `tests/e2e/preview.spec.ts` | Use post ID ending `0103` and the new tutorial title. |
| `tests/e2e/a11y.spec.ts` | Replace the old representative tutorial and preview ID paths. |
| `tests/e2e/visual-contract.spec.ts` | Replace old representative reading/forced-colors paths, update search term, and change the exact `kind=note` result count from 1 to 3. Keep geometry/material assertions content-agnostic. |

`tests/unit/discovery.test.ts`, `tests/unit/export.test.ts`, `tests/unit/metadata.test.ts`, and `tests/unit/references.test.ts` already derive their expectations from the snapshot or use generic manifests. They should continue to pass without fixture-specific rewrites; adding a focused assertion is reasonable only when it protects a new editorial contract.

### Acceptance checks for the implementation

1. Fixture parse returns exactly 12 published records, kind mix 5/4/3, six used topics, one featured post, and no duplicate IDs/slugs/joins.
2. Directus seed run twice produces the same 12 public records and relations, keeps four known legacy records archived, leaves obsolete media bytes unmodified and unreferenced, and exposes no junction to an archived post.
3. The representative RAG tutorial alone exercises outline, table, task list, all supported callout families across the collection, image/caption, code filename/highlight/diff, footnote, and internal route+fragment validation.
4. Every proposed internal link resolves during `getPreparedSite()`; no remote image is present in Markdown.
5. Related results are asserted for at least the featured article, RAG article/tutorial, and tool-calling tutorial so taxonomy drift is visible.
6. Homepage shows the explicit featured article, four current non-featured writing entries, latest note, and all six active topics; the five-newest search default remains bounded.
7. Pagefind returns Chinese results and filters correctly by all three kinds, one topic with mixed kinds, and one month.
8. RSS item count equals 12 and contains all three kinds; sitemap contains 12 post routes and six topic routes; archived legacy routes are absent.
9. The new meaningful cover has non-empty Chinese alt text and 640/960/1600 intrinsic variants in fixture mode; the same 960 source bytes pass Directus transforms.
10. Portability export emits 12 Markdown files plus `content.json`, preserving IDs, timestamps, slugs, topics, and SEO metadata (`scripts/export-content.ts:16-54`).

## Files Found

- `directus/schema.yaml` — Directus 12.2 content, topic, settings, and media field definitions plus Studio validation.
- `directus/database.sql` — PostgreSQL enum/slug/publishability checks, indexes, and immutable published-slug trigger.
- `directus/seed/index.mjs` — idempotent Directus settings/topic/post/junction/media seed; currently owns a three-public/one-archived dataset.
- `directus/seed/fixtures.mjs` — exact committed raster loader with digest-addressed title.
- `src/lib/content.ts` — Directus query, Zod trust boundary, fixture source, normalization, routes, reading time, and related scoring.
- `scripts/prepare-content.ts` — build-time source selection, media preparation, and `.generated/site.json` writer.
- `src/lib/site.ts` — post Markdown rendering and generated reference validation before route generation.
- `src/lib/markdown.ts` — CommonMark/GFM, callout/code/media/outline renderer and validation grammar.
- `src/lib/references.ts` — generated route, fragment, and media integrity validation.
- `src/lib/discovery.ts` — RSS, sitemap, robots, and manifest generation from the normalized snapshot.
- `src/components/PostPage.astro` — shared public/preview article surface and Pagefind body/filter/meta declarations.
- `src/pages/index.astro` — featured/latest/notes/topic homepage selection caps.
- `src/pages/writing/index.astro`, `src/pages/notes/index.astro`, `src/pages/topics/index.astro`, `src/pages/topics/[slug].astro`, `src/pages/archive/index.astro` — content discovery projections.
- `src/pages/search/index.astro` — lazy Pagefind UI, filters, result validation, and five-post default state.
- `scripts/export-content.ts` — portable JSON/Markdown export contract.
- `tests/unit/content.test.ts`, `tests/unit/markdown.test.ts`, `tests/unit/references.test.ts`, `tests/unit/discovery.test.ts`, `tests/unit/export.test.ts`, `tests/unit/metadata.test.ts` — content/render/reference/feed/export/metadata regression coverage.
- `tests/e2e/discovery.spec.ts`, `tests/e2e/reading.spec.ts`, `tests/e2e/preview.spec.ts`, `tests/e2e/smoke.spec.ts`, `tests/e2e/a11y.spec.ts`, `tests/e2e/visual-contract.spec.ts` — public discovery, search, representative reading, preview, shell, accessibility, and responsive visual contracts.
- `.trellis/tasks/archive/2026-08/07-31-blog-system/design.md` — original content boundary, Markdown/media, routes, static search, related selection, and publishing architecture.
- `.trellis/tasks/archive/2026-08/07-31-blog-system/verification.md` — historical evidence for three-page fixture Pagefind and cross-route reading behavior.
- `.trellis/tasks/archive/2026-08/08-05-blog-production-readiness/verification.md` — historical Directus-backed fixture/media/routes/Pagefind evidence and remaining owner-content gate.

## External References

All URLs below returned HTTP 200 on 2026-08-10. Cite only the relevant supported claim and retain the publication/version label in the footnote.

- Lewis et al., **Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks** (2020), <https://arxiv.org/abs/2005.11401> — primary background for `0102`/`0103`; not evidence for this implementation's quality.
- Karpukhin et al., **Dense Passage Retrieval for Open-Domain Question Answering** (2020), <https://arxiv.org/abs/2004.04906> — retrieval-stage background for `0102`.
- JSON Schema **Draft 2020-12**, <https://json-schema.org/draft/2020-12> — schema vocabulary/version reference for `0105`; distinguish it from any provider's partial structured-output dialect.
- Zod documentation, <https://zod.dev/>; repository dependency is Zod `4.4.3` (`package.json:60-65`) — local TypeScript runtime-validation example for `0105`/`0106`.
- NIST **AI Risk Management Framework 1.0** and Generative AI Profile, <https://www.nist.gov/itl/ai-risk-management-framework> — risk/evaluation framing for `0101`, `0108`, and `0111`; the proposed five boundaries remain the author's synthesis.
- Liang et al., **Holistic Evaluation of Language Models (HELM)** (2022), <https://arxiv.org/abs/2211.09110> — evaluation-dimension background for `0108`; do not copy its scenarios or imply comparable coverage.
- OWASP GenAI Security Project, **LLM01: Prompt Injection**, <https://genai.owasp.org/llmrisk/llm01-prompt-injection/> — threat terminology and mitigations for `0111`.
- MDN **Streams API**, <https://developer.mozilla.org/en-US/docs/Web/API/Streams_API>, and **AbortController**, <https://developer.mozilla.org/en-US/docs/Web/API/AbortController> — browser primitives for original code in `0106`/`0112`.
- WHATWG HTML Living Standard, **Server-sent events**, <https://html.spec.whatwg.org/multipage/server-sent-events.html> — transport behavior if `0112` chooses SSE.

## Related Specs

- `.trellis/spec/backend/database-guidelines.md:3-8` — PostgreSQL is live authority; Astro consumes a validated Directus snapshot.
- `.trellis/spec/backend/database-guidelines.md:23-32` — schema/CMS/database constraints must agree; avoid speculative schema changes.
- `.trellis/spec/backend/database-guidelines.md:34-62` — exact immutable seeded raster bytes, digest identity, reference migration, and no automatic deletion.
- `.trellis/spec/backend/database-guidelines.md:86-97` — exact media regression and real Directus-backed build requirements.
- `.trellis/spec/frontend/type-safety.md:3-8` — strictest TypeScript/checkJs, no unchecked or duplicated data definitions.
- `.trellis/spec/frontend/type-safety.md:27-29` — decode Directus once and expose normalized frontend models.
- `.trellis/spec/frontend/quality-guidelines.md:5-13` — aggregate formatting/lint/type/unit/build/Pagefind/Playwright gate.
- `.trellis/spec/frontend/quality-guidelines.md:15-27` — observable browser behavior and Pagefind are part of a passing build.
- `.trellis/spec/guides/cross-layer-thinking-guide.md:19-50` — map formats, failures, and validation ownership across the full data flow.
- `.trellis/spec/guides/cross-layer-thinking-guide.md:62-72` — validation belongs at one boundary and components should not know database records.
- `.trellis/tasks/archive/2026-08/07-31-blog-system/design.md:192-212` — normalized dates/relations, note excerpts, deterministic related selection, archived filtering, and kind+slug routes.
- `.trellis/tasks/archive/2026-08/07-31-blog-system/design.md:214-246` — portable Markdown primitives, Directus media IDs, internal reference validation, and print preservation.
- `.trellis/tasks/archive/2026-08/07-31-blog-system/design.md:248-266` — complete static route and zh-CN/Pagefind behavior.

## Caveats / Not Found

- No owner name, biography, avatar, real social URL, or preferred public site title is available in the task or product docs. Do not invent a personal identity. The new content can remove `示例` from post titles, but fixture `site_settings` still visibly identify a test author/site until the user supplies owner metadata. Treat that as a separate launch input.
- The recommendation provides editorial briefs, metadata, factual boundaries, references, and code opportunities, not full publish-ready prose. Every article still needs an original drafting and technical-review pass.
- Current fixture and Directus seed content are not mirrored. Adding posts to only one source will pass some tests while leaving the other public build unchanged.
- Directus topics have no archive/status field, and all topics are fetched and routed. Repurpose the known old topic IDs and use every resulting topic; merely adding six topics would leave stale empty Astro/database/craft topic pages.
- Directus post slugs are immutable after publication. New editorial posts need new IDs; known old fixtures should be archived under their old slugs.
- The Directus loader fetches all junction rows. Known legacy joins must be reassigned or removed when their posts become archived, or snapshot validation fails.
- More than one fixture media record cannot be represented correctly by the current `scripts/prepare-content.ts` fixture loop because every ID maps to the same publishing-workbench asset. This plan intentionally needs only one new shared diagram. Generalize the map before adding a second image.
- Related entries cannot be manually pinned without a schema change. The topic plan is intentionally shaped around the existing score; future unrelated content can change recency tie-breaks, so tests should protect only high-value representative relationships.
- External-link availability is not a release dependency; the build validates protocols but intentionally does not fetch third-party references. Primary URLs were checked during this research, but future link maintenance remains editorial work.
- Dates in the catalog are deterministic development-fixture dates. A real Directus publication should use truthful release times and preserve the same relative editorial order only if that matches actual publication.
- Archived task verification records describe historical three-post fixtures. They are evidence, not files to update for this task.
