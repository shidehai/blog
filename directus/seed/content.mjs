/**
 * @param {string} family
 * @param {number} suffix
 */
const id = (family, suffix) =>
  `${family}000000-0000-4000-8000-${String(suffix).padStart(12, "0")}`;

export const EDITORIAL_IDS = Object.freeze({
  cover: "f5000000-0000-4000-8000-000000000001",
  settings: "f0000000-0000-4000-8000-000000000001",
  socialLinks: Object.freeze([
    "f3000000-0000-4000-8000-000000000001",
    "f3000000-0000-4000-8000-000000000002",
  ]),
});

export const LEGACY_FIXTURE_POSTS = Object.freeze(
  [
    {
      id: id("f2", 1),
      kind: "article",
      title: "示例：静态发布为何仍需要清晰的数据边界",
      slug: "static-publishing-data-boundary",
      summary: "已归档的开发夹具。",
      body: "这条已知开发夹具已被新的编辑内容替代。",
      published_at: "2026-07-28T02:00:00.000Z",
    },
    {
      id: id("f2", 2),
      kind: "tutorial",
      title: "示例教程：从草稿版本发布一篇文章",
      slug: "publish-from-content-version",
      summary: "已归档的开发夹具。",
      body: "这条已知开发夹具已被新的编辑内容替代。",
      published_at: "2026-07-25T06:30:00.000Z",
    },
    {
      id: id("f2", 3),
      kind: "note",
      title: "示例随记：先让失败可诊断",
      slug: "diagnosable-failures-first",
      summary: null,
      body: "这条已知开发夹具已被新的编辑内容替代。",
      published_at: "2026-07-30T11:20:00.000Z",
    },
    {
      id: id("f2", 4),
      kind: "note",
      title: "示例归档随记",
      slug: "archived-fixture-note",
      summary: null,
      body: "这条已知开发夹具保持归档。",
      published_at: "2026-07-20T01:00:00.000Z",
    },
  ].map((post) =>
    Object.freeze({
      ...post,
      status: "archived",
      featured: false,
      cover_image: null,
      cover_alt: null,
      cover_decorative: false,
      seo_title: null,
      seo_description: null,
    }),
  ),
);

const TOPICS = Object.freeze([
  {
    key: "llm",
    id: id("f1", 1),
    name: "LLM 系统",
    slug: "llm-systems",
    description: "大模型应用的边界、编排、可观测性与运行时设计。",
  },
  {
    key: "rag",
    id: id("f1", 2),
    name: "检索增强生成",
    slug: "retrieval-augmented-generation",
    description: "文档切分、召回、重排、上下文编排与答案归因。",
  },
  {
    key: "evaluation",
    id: id("f1", 3),
    name: "AI 评测",
    slug: "ai-evaluation",
    description: "样本集、指标、回归测试与上线判断。",
  },
  {
    key: "tools",
    id: id("f1", 4),
    name: "智能体与工具",
    slug: "agents-and-tools",
    description: "结构化输出、工具调用和受控执行。",
  },
  {
    key: "safety",
    id: id("f1", 5),
    name: "安全与可靠性",
    slug: "ai-safety-reliability",
    description: "输入信任、失败边界、降级与安全控制。",
  },
  {
    key: "performance",
    id: id("f1", 6),
    name: "推理性能",
    slug: "inference-performance",
    description: "流式传输、缓存、延迟与资源权衡。",
  },
]);

const POST_DEFINITIONS = Object.freeze([
  {
    id: id("f2", 101),
    kind: "article",
    title: "从演示到生产：LLM 应用的五层可靠性边界",
    slug: "production-llm-reliability-boundaries",
    published_at: "2026-05-20T01:00:00.000Z",
    summary:
      "把一次 LLM 请求拆成输入、上下文、模型、工具与验证五层，并为每层定义可观测的失败边界。",
    featured: true,
    topics: ["llm", "evaluation", "safety"],
    seo_title: "生产级 LLM 应用的五层可靠性边界",
    seo_description:
      "把 LLM 请求拆成输入、上下文、模型、工具与验证五层，为每层建立可观测、可恢复的生产边界。",
    body: (
      /** @type {{ coverId: string }} */ { coverId },
    ) => `一次演示只要返回一句像样的话，生产系统却要回答更难的问题：输入是否可信、检索依据是否完整、模型输出能否进入业务流程、工具副作用是否可控，以及最终答案由谁验收。把这些问题都归到“模型效果”里，会让故障定位失去抓手。

![一次 LLM 请求经过输入、上下文、模型、工具与验证五层边界](directus://${coverId} "五层边界分别建立输入契约、上下文来源、模型适配、工具执行和结果验证")

## 五层不是调用顺序，而是责任边界

我把 LLM 应用拆成输入、上下文、模型、工具、验证五层。这个划分不是某个框架的标准，而是一种工程综合：每层都要有明确的所有者、可观察的输入输出，以及失败后的收口动作。

| 边界 | 必须回答的问题 | 最小失败信号 |
| --- | --- | --- |
| 输入 | 请求来自谁，允许做什么 | 拒绝原因与请求类别 |
| 上下文 | 依据从哪里来，是否过期 | 文档 ID、版本与召回为空 |
| 模型 | 使用哪个版本与约束 | 模型版本、结束原因与耗时 |
| 工具 | 会产生什么副作用 | 工具名、幂等键与终态 |
| 验证 | 什么结果可以交付 | 规则结果、证据与降级路径 |

> [!IMPORTANT]
> 五层模型是本文用于分配责任的工程方法，不是安全认证。它的价值取决于每层是否真的拥有可执行的契约和失败动作。

## 输入边界：先决定能力，再处理文本

### 所有权

输入层不只做长度限制。它要把身份、租户、会话目的、允许的能力和原始文本分开保存。用户说“帮我查订单”和用户拥有查订单权限，是两件不同的事。权限必须来自可信系统，不能从提示词里推断。

### 可观察失败

记录输入类别、规则版本和拒绝代码，不记录不必要的正文。遇到超长文本、缺少身份或能力不匹配时，应在调用模型前停止。这样既节省资源，也避免把鉴权责任推给概率模型。

## 上下文边界：来源比相似度更重要

### 所有权

上下文层负责检索、重排、版本过滤和预算分配。一个片段进入提示词时，应携带文档 ID、版本、时间和召回分数。详细的检索链路见[RAG 的分阶段设计](/writing/rag-retrieval-reranking-attribution/#四个阶段四种责任)。

### 可观察失败

“找不到”必须是一等结果。召回为空、候选过旧、来源互相冲突时，不要用模型的流畅性掩盖证据缺口。系统可以请求补充条件、展示候选来源，或明确降级为不带知识库依据的通用回答。

## 模型边界：适配不等于信任

### 所有权

模型层把供应商响应归一为本地契约，并固定模型修订、提示词修订、采样参数和超时。业务代码不应直接依赖某个 SDK 的松散响应。

~~~ts filename="model-boundary.ts" {2-7}
export interface ModelResult {
  modelRevision: string;
  text: string;
  finishReason: "stop" | "length" | "blocked" | "unknown";
  usage: { inputTokens: number; outputTokens: number };
  durationMs: number;
}
~~~

### 可观察失败

超时、内容阻断、长度截断和未知结束原因要分开处理。把所有异常变成空字符串，会让后面的验证层误以为模型成功返回了一个合法但空的答案。

## 工具边界：副作用必须可重放

### 所有权

工具层负责参数校验、权限、幂等、超时和审计。模型只能提出动作请求，不能直接获得数据库或网络能力。完整实现可参考[工具调用的安全外壳](/writing/safe-tool-calling-typescript/#执行器把五个控制点串起来)。

### 可观察失败

工具事件至少包含工具名、参数摘要、幂等键、开始时间和终态。超时不是“没发生”：远端可能已经执行，因此重试前必须先查询幂等结果。

## 验证边界：交付判断不能省略

### 所有权

验证层检查结构、业务语义、引用归因和风险规则。确定性规则先运行，需要判断的样本再进入评审。如何把这些判断变成持续门禁，见[LLM 评测闭环](/writing/llm-evaluation-regression-loop/#门禁必须连接一个决定)。

### 可观察失败

验证失败应保留证据：哪条规则失败、依据来自哪里、是否允许重试、最终向用户展示什么。不要只记录一个总分；总分无法告诉维护者下一步该修检索、提示词还是工具。

## 把边界变成运行清单

- [ ] 每层有一个明确的输入与输出类型
- [ ] 每层有稳定的版本标识和追踪事件
- [ ] 每种失败有所有者、重试预算和终态
- [ ] 能从最终答案追到上下文来源与工具结果
- [ ] 降级输出不会假装完成原任务

可靠性不是在模型外再包一层重试。它来自一组彼此独立、能够被观察和验证的责任边界。NIST 的生成式 AI 风险管理资料强调在设计、开发、使用和评估全周期管理风险；这里的五层划分是把那类治理要求落实到一次请求上的方法。[^nist]

[^nist]: NIST, [Artificial Intelligence Risk Management Framework: Generative Artificial Intelligence Profile](https://doi.org/10.6028/NIST.AI.600-1), 2024。
`,
  },
  {
    id: id("f2", 102),
    kind: "article",
    title: "RAG 不是一次向量搜索：拆解检索、重排与答案归因",
    slug: "rag-retrieval-reranking-attribution",
    published_at: "2026-05-27T01:00:00.000Z",
    summary:
      "RAG 的质量来自召回、重排、上下文编排与引用闭环，而不是把向量搜索接到模型前面。",
    topics: ["rag", "evaluation"],
    seo_title: "RAG 的检索、重排、上下文与答案归因",
    body: () => `检索增强生成（RAG）经常被压缩成“问题转向量，再取最相近的几段”。这一步只产生候选，离可交付答案还隔着重排、上下文编排和归因。四个阶段混在一个函数里时，最终的错误只剩一句“模型答错了”。

## 四个阶段，四种责任

| 阶段 | 输入 | 输出 | 主要失败信号 |
| --- | --- | --- | --- |
| 候选召回 | 查询、权限、时间范围 | 带来源的候选片段 | 相关来源未进入候选 |
| 重排 | 查询与候选 | 可比较的相关性顺序 | 高相关片段被低质量内容挤出 |
| 上下文编排 | 排序结果与预算 | 有来源标记的提示上下文 | 截断、重复、证据冲突 |
| 答案归因 | 答案声明与来源 | 声明到证据的映射 | 引用存在但不支持声明 |

早期 RAG 工作把参数化模型与外部非参数记忆结合起来，说明了检索与生成可以成为一个整体问题；DPR 则展示了密集表示用于开放域问答检索的路径。它们为设计提供基础，却不会替具体语料决定切块、过滤和门禁。[^rag][^dpr]

## 候选召回：目标是覆盖，不是立即定案

候选生成要保留文档身份和可追溯字段。向量相似度可以和关键词、结构字段、权限及时间约束组合。接口应返回候选事实，而不是拼好的提示词：

~~~ts filename="retrieve.ts" {1-7}
type Candidate = {
  documentId: string;
  chunkId: string;
  text: string;
  retrievalScore: number;
  revision: string;
};

async function retrieve(query: string): Promise<readonly Candidate[]> {
  return index.search({ query, limit: 24, filters: activeScope });
}
~~~

召回阶段关注“该出现的证据有没有进入候选”，因此它需要覆盖型评测。只盯最终回答，无法区分是检索漏掉了依据，还是模型忽略了已经给出的依据。

## 重排：让候选适合当前问题

重排器接收查询和候选，输出新的顺序或分数。它可以更昂贵，因为候选已经缩小；但它仍应保留原始召回分数，便于发现分数漂移和过度集中。不要先设一个全局 top-k 再寻找理由。候选数量应由语料分布、查询类型和上下文预算共同决定。

切块同样没有脱离语料的通用值。[切块大小不是全局常数](/notes/chunk-size-is-not-global/)解释了为什么标题层级、表格和代码段需要不同边界。

## 上下文编排：预算要分给证据

编排不是简单连接前几段。应先去重，再按来源、时间和观点分配预算；对冲突内容显式标记，不要偷偷选一边。每个片段进入提示词时附带稳定来源 ID，让生成阶段只能引用实际提供过的证据。

> [!WARNING]
> 模型生成了格式正确的引用，不代表引用支持相邻声明。归因必须核对声明与被检索来源的关系，不能只检查脚注编号是否存在。

## 答案归因：从漂亮链接回到声明

答案可以先被拆成可验证声明，再为每条声明寻找支持片段。确定性检查至少确认来源 ID 存在、版本可公开、引用文本确实进入过上下文；需要语义判断的部分进入评测或人工复核。没有依据时，正确结果是缩小结论，不是补一个看起来可信的链接。

## 分阶段测量，才能分阶段修复

一条最小链路应同时保留查询、候选、重排结果、最终上下文、答案声明和引用映射。实现方法见[可观测 RAG 教程](/writing/typescript-observable-rag-pipeline/#先定义可追踪的数据形状)，回归判断可接入[评测闭环](/writing/llm-evaluation-regression-loop/#样本集要覆盖失败形状)。当每个阶段都有独立证据，“RAG 效果不好”才会变成可执行的修改。

[^rag]: Lewis et al., [Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks](https://arxiv.org/abs/2005.11401), 2020。
[^dpr]: Karpukhin et al., [Dense Passage Retrieval for Open-Domain Question Answering](https://arxiv.org/abs/2004.04906), 2020。
`,
  },
  {
    id: id("f2", 103),
    kind: "tutorial",
    title: "实作：用 TypeScript 搭建可观测的 RAG 最小链路",
    slug: "typescript-observable-rag-pipeline",
    published_at: "2026-06-04T01:00:00.000Z",
    date_updated: "2026-08-09T03:00:00.000Z",
    summary:
      "从文档切分、召回、重排到答案引用，搭建一条可测试、可追踪的 TypeScript RAG 最小链路。",
    topics: ["llm", "rag", "evaluation"],
    body: (
      /** @type {{ coverId: string }} */ { coverId },
    ) => `这条最小链路不连接模型供应商，也不需要凭据。我们用内存文档和确定性适配器，把切分、召回、重排、回答和追踪串起来。目标不是模拟真实质量，而是得到一条能定位失败、能写回归测试的骨架。

## 先定义可追踪的数据形状

每个片段保留文档与修订身份，每个阶段追加追踪事件。这样答案出错时，测试可以指出候选缺失、排序错误或引用越界。

| 记录 | 必需字段 | 用途 |
| --- | --- | --- |
| 文档 | ID、修订、标题、正文 | 建立权威来源 |
| 片段 | 文档 ID、片段 ID、文本 | 保持切分可追溯 |
| 候选 | 片段、召回分、重排分 | 比较阶段变化 |
| 追踪 | 阶段、输入数、输出数、耗时 | 定位空结果与异常 |

~~~ts filename="rag-types.ts" {1-13}
type Document = { id: string; revision: string; title: string; body: string };
type Chunk = { id: string; documentId: string; text: string };
type Candidate = Chunk & { retrievalScore: number; rerankScore: number };
type TraceEvent = {
  stage: "split" | "retrieve" | "rerank" | "answer";
  inputCount: number;
  outputCount: number;
  durationMs: number;
};
type Answer = {
  text: string;
  citations: readonly { documentId: string; chunkId: string }[];
};
~~~

> [!NOTE]
> 教程中的分数只是确定性排序信号，不代表真实相关性，也不用于声称任何模型效果。

## 实现切分、召回与重排

### 切分保留语义边界

示例按空行切段，并丢弃纯空白。真实系统应针对标题、表格和代码等结构选择策略，不能把这个示例长度当作默认值。进一步的判断见[切块大小不是全局常数](/notes/chunk-size-is-not-global/)。

~~~ts filename="pipeline.ts" {1-6,15-20}
const documents: readonly Document[] = [
  { id: "handbook", revision: "r3", title: "退款手册", body: "退款申请需要订单号。\n\n审核通过后原路返回。" },
  { id: "shipping", revision: "r2", title: "配送说明", body: "配送查询需要运单号。" },
];

function split(document: Document): Chunk[] {
  return document.body.split(String.fromCharCode(10, 10)).map((text, index) => ({
    id: document.id + "-c" + String(index + 1),
    documentId: document.id,
    text,
  }));
}

function retrieve(query: string, chunks: readonly Chunk[]): Candidate[] {
  const terms = query.split(" ").filter(Boolean);
  return chunks.map((chunk) => ({
    ...chunk,
    retrievalScore: terms.filter((term) => chunk.text.includes(term)).length,
    rerankScore: 0,
  })).filter((item) => item.retrievalScore > 0);
}
~~~

### 重排显式接收候选

重排器不能重新读取全库，否则追踪无法解释候选为何变化。这里用问题词命中和标题优先作为可预测规则：

~~~ts filename="pipeline.ts" {2-8}
function rerank(query: string, candidates: readonly Candidate[]): Candidate[] {
  return candidates
    .map((item) => ({
      ...item,
      rerankScore: item.retrievalScore * 10 + Number(query.includes("退款") && item.documentId === "handbook"),
    }))
    .sort((left, right) => right.rerankScore - left.rerankScore);
}
~~~

> [!IMPORTANT]
> 每个阶段只消费上一阶段的显式输出。不要让回答器在背后再次检索，否则测试看到的候选与模型实际看到的上下文会分叉。

![一次 LLM 请求经过输入、上下文、模型、工具与验证五层边界](directus://${coverId} "本教程位于上下文边界，并把结果交给模型与验证边界")

## 生成带来源约束的答案

本地回答器只复述第一个候选，并从候选本身生成引用。真实模型适配器也应接收带来源标签的上下文，再把输出解析为本地 Answer 类型。

~~~ts filename="answer.ts" {1-11}
function answer(candidates: readonly Candidate[]): Answer {
  const first = candidates[0];
  if (!first) return { text: "没有找到可引用的依据。", citations: [] };
  return {
    text: first.text,
    citations: [{ documentId: first.documentId, chunkId: first.id }],
  };
}

const chunks = documents.flatMap(split);
const result = answer(rerank("退款 订单号", retrieve("退款 订单号", chunks)));
~~~

### 校验引用没有越界

引用必须指向本次候选中的片段。这个确定性断言很便宜，却能拦住模型编造来源 ID 或代码错误串错请求：

~~~ts filename="answer.test.ts" {2} diff
-expect(result.citations.length).toBeGreaterThan(0);
+expect(result.citations.every((citation) => chunks.some((chunk) => chunk.id === citation.chunkId && chunk.documentId === citation.documentId))).toBe(true);
~~~

> [!WARNING]
> “引用 ID 存在”只证明引用没有越界，不证明文本支持答案。声明与证据是否一致仍要进入[黄金样本回归](/writing/prompt-regression-golden-set/#把失败写成可复现样本)或人工复核。

## 验证完整链路

- [x] 切分后仍能追到文档与修订
- [x] 召回为空时返回明确结果
- [x] 重排只处理显式候选
- [x] 引用只来自本次上下文
- [ ] 接入真实适配器前补齐超时、取消和敏感字段清理

把这些记录放进同一个 trace ID 下，就能分别统计各阶段输入输出和终态。可观察性不负责让答案自动变好，它负责让下一次修改有证据，而不是靠猜。分阶段设计的理论背景可回看[RAG 的四阶段责任](/writing/rag-retrieval-reranking-attribution/#四个阶段四种责任)。[^trace]

[^trace]: 本文的事件字段是教学用本地契约；接入生产追踪系统时，应按数据最小化原则处理查询和文档正文。
`,
  },
  {
    id: id("f2", 104),
    kind: "note",
    title: "切块大小不是一个全局常数",
    slug: "chunk-size-is-not-global",
    published_at: "2026-06-11T01:00:00.000Z",
    summary: null,
    topics: ["rag", "evaluation"],
    body: () => `切块大小不是一个全局常数。它首先取决于语义边界：标题下的段落、表格、代码和对话轮次承担不同结构，硬按字符数切开会损失关系；其次取决于检索单位和上下文预算，适合召回的片段未必适合直接交给模型。

结果是，切块参数必须跟语料类型和评测样本一起版本化。先在[RAG 的四阶段设计](/writing/rag-retrieval-reranking-attribution/#候选召回目标是覆盖不是立即定案)里定义召回目标，再用[可观测最小链路](/writing/typescript-observable-rag-pipeline/#实现切分召回与重排)记录漏召回、重复和截断；没有这些证据时，争论一个统一数字没有工程意义。`,
  },
  {
    id: id("f2", 105),
    kind: "article",
    title: "结构化输出的真正边界：Schema、重试与语义校验",
    slug: "structured-output-schema-retry-validation",
    published_at: "2026-06-20T01:00:00.000Z",
    summary:
      "结构正确只是起点；生产系统还要处理语义约束、重试预算、版本兼容与失败收口。",
    topics: ["tools", "safety"],
    body: () => `让模型返回 JSON，只解决了传输格式的一小部分。一个对象可以通过解析和 Schema 校验，却仍然引用不存在的订单、选择越权动作，或把相互矛盾的字段组合在一起。结构化输出真正的边界，是把未知文本变成业务可以承担责任的结果。

## 第一层：语法只回答能否解析

JSON 解析失败意味着响应不完整或格式错误。此时可以在有限预算内重试，但必须保留原始结束原因，并区分模型截断、网络中断和普通格式错误。盲目把同一请求重放三次，只会让不可恢复错误变得更慢。

## 第二层：Schema 固定机器契约

Schema 负责字段类型、枚举、必填项和组合形状。JSON Schema Draft 2020-12 定义了通用验证词汇；具体模型接口支持哪些子集，要以该接口的明确契约为准。应用侧仍应在 unknown 边界重新验证。[^schema]

~~~ts filename="decision.ts" {1-13}
import { z } from "zod";

const Decision = z.discriminatedUnion("action", [
  z.object({ action: z.literal("answer"), text: z.string().min(1) }),
  z.object({ action: z.literal("create_ticket"), subject: z.string().min(3).max(120) }),
]);

type DecodeResult =
  | { ok: true; value: z.infer<typeof Decision> }
  | { ok: false; retryable: boolean; reason: "json" | "schema" | "semantic" };

function decode(value: unknown): DecodeResult {
  const parsed = Decision.safeParse(value);
  return parsed.success ? { ok: true, value: parsed.data } : { ok: false, retryable: true, reason: "schema" };
}
~~~

Zod 的 safeParse 适合把成功与失败变成显式分支，但它只执行我们声明的规则。[^zod]

## 第三层：语义校验连接业务事实

> [!WARNING]
> Schema 合法不等于语义正确。一个格式完美的工具参数，仍可能越权、过期或指向不存在的对象。

语义层需要可信数据：当前用户是否允许创建工单，主题是否包含敏感字段，引用的实体是否存在。这个阶段不要让模型自我裁决。校验器应返回稳定错误码，并指出是否值得用更具体的反馈重试。

~~~ts filename="semantic-check.ts" {1-7}
async function validateDecision(decision: z.infer<typeof Decision>, scope: Scope): Promise<DecodeResult> {
  if (decision.action === "answer") return { ok: true, value: decision };
  if (!scope.capabilities.has("ticket:create")) {
    return { ok: false, retryable: false, reason: "semantic" };
  }
  return { ok: true, value: decision };
}
~~~

## 第四层：重试需要分类和预算

语法错误可能通过一次带错误摘要的重试修复；缺少权限永远不应重试；依赖服务超时是否重试，则取决于幂等保证。重试状态至少包含尝试次数、上次错误类别、模型与提示词版本。达到预算后返回终态，不要回落到未校验文本。

## 第五层：版本兼容决定能否演进

工具 Schema 与提示词一起变化。缓存键应包含这些修订，详见[缓存键版本化](/notes/llm-cache-key-versioning/)。消费者升级时，可以同时接受旧、新两个版本，再逐步停止生成旧版本；直接覆盖字段语义会让历史追踪无法重放。

结构化结果如果要触发副作用，应继续经过[工具调用执行器](/writing/safe-tool-calling-typescript/#执行器把五个控制点串起来)。如果输出混入检索文本或工具反馈，还要按[Prompt Injection 数据流](/writing/prompt-injection-data-flow/#给每类数据标记信任与能力)划分信任。边界的终点不是“拿到 JSON”，而是系统知道这个值为什么可以继续流动。

[^schema]: JSON Schema, [Draft 2020-12 specification](https://json-schema.org/draft/2020-12), 2020。
[^zod]: Zod, [Basic usage and parsing](https://zod.dev/basics), accessed 2026-08-10。
`,
  },
  {
    id: id("f2", 106),
    kind: "tutorial",
    title: "实作：为工具调用加上参数校验、幂等与超时",
    slug: "safe-tool-calling-typescript",
    published_at: "2026-06-29T01:00:00.000Z",
    summary:
      "用参数 Schema、幂等键、超时和结果校验包住工具调用，让失败可重试也可诊断。",
    topics: ["tools", "safety"],
    body: () => `模型提出工具调用，只代表它生成了一份动作建议。真正的执行权限仍在应用侧。本教程用假的 create_ticket 工具建立一层执行器：它校验参数、检查允许列表、生成幂等键、传播超时、验证结果，并写入不含正文的审计事件。

## 准备一个受控工具注册表

先从[结构化输出边界](/writing/structured-output-schema-retry-validation/#第二层schema-固定机器契约)取得经过语法和 Schema 校验的请求。工具注册表只暴露明确允许的能力，不允许模型传入任意 URL 或函数名。

~~~ts filename="tools.ts" {1-15}
import { createHash } from "node:crypto";
import { z } from "zod";

const TicketArgs = z.object({ subject: z.string().min(3).max(120) });
const TicketResult = z.object({ ticketId: z.string().regex(/^T-[0-9]+$/) });

type ToolContext = { actorId: string; requestId: string; signal: AbortSignal };
type AuditEvent = { tool: string; key: string; outcome: "ok" | "rejected" | "timeout" | "error" };

const registry = {
  create_ticket: async (args: z.infer<typeof TicketArgs>, context: ToolContext) => {
    context.signal.throwIfAborted();
    return { ticketId: "T-1001", subject: args.subject };
  },
};
~~~

示例返回固定编号，只用于演示边界，不表示连接了真实工单服务。

## 执行器把五个控制点串起来

幂等键来自调用者、请求身份、工具版本和规范化参数。它不能只用模型生成的调用 ID，因为重试时模型可能换一个值。缓存与版本原则也适用于这里，见[缓存键版本化](/notes/llm-cache-key-versioning/)。

~~~ts filename="execute-tool.ts" {1-8,14-24}
async function executeTool(name: string, rawArgs: unknown, context: Omit<ToolContext, "signal">) {
  if (name !== "create_ticket") return { ok: false, code: "tool_not_allowed" } as const;
  const args = TicketArgs.safeParse(rawArgs);
  if (!args.success) return { ok: false, code: "invalid_arguments" } as const;

  const normalized = JSON.stringify(args.data);
  const key = createHash("sha256")
    .update([context.actorId, "create_ticket", "v1", normalized].join(":"))
    .digest("hex");
  const previous = await idempotencyStore.get(key);
  if (previous) return previous;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2_000);
  try {
    const rawResult = await registry.create_ticket(args.data, { ...context, signal: controller.signal });
    const result = TicketResult.safeParse(rawResult);
    if (!result.success) return { ok: false, code: "invalid_result" } as const;
    const completed = { ok: true, value: result.data } as const;
    await idempotencyStore.put(key, completed);
    return completed;
  } catch (error) {
    return { ok: false, code: controller.signal.aborted ? "timeout" : "tool_error" } as const;
  } finally {
    clearTimeout(timeout);
  }
}
~~~

超时之后不要立刻假设远端没有执行。真实适配器要把同一个幂等键传给服务端，或者在重试前查询操作状态。

## 用失败矩阵验证收口

| 场景 | 预期终态 | 是否重试 |
| --- | --- | --- |
| 参数格式错误 | invalid_arguments | 可让模型修正一次 |
| 相同幂等键 | 返回已有终态 | 不重复执行 |
| 超时 | timeout 并查询状态 | 取决于远端幂等 |
| 工具抛错 | tool_error | 按错误类别决定 |
| 返回格式错误 | invalid_result | 停止向下游传播 |
| 成功 | 保存结果与审计摘要 | 不重试 |

- [x] 工具名来自允许列表
- [x] 参数和结果分别校验
- [x] 超时信号传播到适配器
- [x] 只有成功终态进入幂等存储
- [ ] 生产接入前定义远端状态查询

审计事件记录工具名、键摘要、版本和终态即可，不要默认写入完整参数。若参数可能来自检索内容，还应套用[Prompt Injection 的能力隔离](/writing/prompt-injection-data-flow/#能力必须由可信代码授予)。工具边界的目标不是让模型“更谨慎”，而是即使建议错误，副作用仍被普通软件控制住。
`,
  },
  {
    id: id("f2", 107),
    kind: "note",
    title: "缓存键应包含模型、提示词与工具版本",
    slug: "llm-cache-key-versioning",
    published_at: "2026-07-06T01:00:00.000Z",
    summary: null,
    topics: ["tools", "safety", "performance"],
    body: () => `LLM 缓存键应包含 (modelRevision, promptRevision, toolSchemaRevision, normalizedInputHash)，而不只是用户问题。相同文本在模型、系统指令或工具契约变化后，已经不是同一个计算；复用旧结果会把部署差异伪装成随机行为。

后果是，版本发布必须同时定义缓存失效责任：谁提升修订号，旧条目保留多久，追踪记录怎样还原键。结构化契约可参考[Schema 版本兼容](/writing/structured-output-schema-retry-validation/#第五层版本兼容决定能否演进)，副作用工具还要结合[幂等键](/writing/safe-tool-calling-typescript/#执行器把五个控制点串起来)。对流式请求，缓存命中也必须遵守相同的取消与终态语义，见[流式错误收口](/writing/streaming-llm-sse-cancellation/#终态只能出现一次)。`,
  },
  {
    id: id("f2", 108),
    kind: "article",
    title: "为 LLM 应用建立评测闭环：从样本集到回归门禁",
    slug: "llm-evaluation-regression-loop",
    published_at: "2026-07-14T01:00:00.000Z",
    summary:
      "用小而可信的样本集、可解释指标和变更门禁，把“感觉更好”变成可重复的工程判断。",
    topics: ["llm", "evaluation"],
    body: () => `LLM 应用的评测不是上线前跑一次总分。真正有用的闭环是：从产品声明选样本，为每个声明指定判断方法，把失败送回检索、提示词或工具层，并让下一次变更重新经过同一门禁。

## 先写清楚要保护的声明

“回答质量高”无法直接测试。可以拆成更窄的声明：无依据时明确拒答；引用只来自允许文档；工具参数满足业务约束；取消后不再发送内容。每条声明都要连接一个维护者能采取的动作。

| 声明 | 示例样本 | 评测器 | 门槛所有者 | 失败动作 |
| --- | --- | --- | --- | --- |
| 引用不越界 | 缺失来源 ID | 确定性规则 | 检索负责人 | 阻止发布 |
| 回答覆盖依据 | 多来源问题 | 规则量表与复核 | 内容负责人 | 检查重排与上下文 |
| 工具不越权 | 请求未授权动作 | 权限断言 | 工具负责人 | 阻止发布 |
| 拒答表达清楚 | 证据为空 | 人工复核 | 产品负责人 | 修改交互与提示词 |

> [!IMPORTANT]
> 指标只有连接到一个明确决定和失败动作时才有价值。没有所有者的分数，只会制造“已经评过”的错觉。

## 样本集要覆盖失败形状

样本来自产品边界，而不是只收集顺利路径。至少包含正常、空结果、冲突来源、超长输入、越权工具和中途取消。每个样本保留输入类别、允许来源、预期规则和评审说明，避免把真实用户正文直接复制进仓库。

NIST AI RMF 及其生成式 AI Profile 把测量、治理和持续管理放在同一个风险流程中；HELM 则说明透明记录场景、指标和模型条件的重要性。它们能帮助我们检查覆盖面，但不是可以直接安装的应用测试套件。[^nist][^helm]

## 组合三类评测器

确定性检查适合格式、ID、权限和终态；规则量表适合有明确维度但需要判断的文本；人工复核负责模糊、高风险或规则冲突样本。不要用一个模型裁判替代全部三类，也不要隐藏裁判版本。

~~~ts filename="evaluate.ts" {1-14}
type Evidence = { caseId: string; check: string; passed: boolean; detail: string };
type Case = { id: string; allowedSourceIds: readonly string[]; answerSourceIds: readonly string[] };

function evaluate(item: Case): Evidence[] {
  const allowed = new Set(item.allowedSourceIds);
  return [{
    caseId: item.id,
    check: "citations-within-context",
    passed: item.answerSourceIds.every((sourceId) => allowed.has(sourceId)),
    detail: "答案引用必须来自该样本提供的上下文。",
  }];
}

const report = cases.flatMap(evaluate);
const failed = report.filter((item) => !item.passed);
~~~

报告保留逐样本证据和聚合计数，不编造一个看似精确的综合准确率。变更评测器时，同样要提升版本并重新审阅门槛。

## 门禁必须连接一个决定

门禁可以是“任何越权样本失败即停止”，也可以是“指定样本进入人工复核”。关键是规则写进版本控制，并输出失败 ID 与检查名。教程[用小型黄金集守住回归](/writing/prompt-regression-golden-set/#在-ci-中只比较可解释结果)给出一个最小实现。

## 失败分析回到系统边界

漏召回修检索，引用越界修上下文与验证，参数错误修 Schema，取消后继续输出则修传输状态机。不要用提示词覆盖所有失败类别。[五层可靠性边界](/writing/production-llm-reliability-boundaries/#五层不是调用顺序而是责任边界)提供了归属地图；[温度不是可信度旋钮](/notes/temperature-is-not-confidence/)则提醒我们不要把采样参数误当评测结果。

闭环成立的标志不是分数持续上升，而是每次上线判断都能说明：保护了哪些声明，哪些样本失败，由谁决定接受或修复。

[^nist]: NIST, [AI Risk Management Framework](https://www.nist.gov/itl/ai-risk-management-framework) and [Generative AI Profile](https://doi.org/10.6028/NIST.AI.600-1)。
[^helm]: Stanford CRFM, [Holistic Evaluation of Language Models](https://arxiv.org/abs/2211.09110), 2022。
`,
  },
  {
    id: id("f2", 109),
    kind: "tutorial",
    title: "实作：用小型黄金集守住提示词回归",
    slug: "prompt-regression-golden-set",
    published_at: "2026-07-23T01:00:00.000Z",
    summary:
      "建立一个小型黄金样本集，计算可解释结果，并把提示词变更接入自动化回归门禁。",
    topics: ["llm", "evaluation"],
    body: () => `黄金样本集不是一批永远正确的标准答案，而是一组经过审阅、用于保护具体行为的回归案例。我们用假的问题、来源 ID 和预期短语建立最小格式，再把确定性检查与“需要复核”分开。

## 把失败写成可复现样本

每个案例说明为什么存在、允许引用哪些来源，以及哪些条件必须满足。不要把真实对话或私有日志直接提交进仓库。

~~~json filename="golden-cases.json" {2-9}
[
  {
    "id": "refund-source",
    "question": "退款申请需要什么？",
    "allowedSourceIds": ["handbook-r3"],
    "requiredPhrases": ["订单号"],
    "forbiddenPhrases": ["保证当天到账"]
  }
]
~~~

案例格式也要版本化。新增字段时提供迁移或同时支持两个版本，避免旧报告无法重放。

## 让评测器输出证据

~~~ts filename="grade.ts" {1-16}
type GoldenCase = {
  id: string;
  requiredPhrases: readonly string[];
  forbiddenPhrases: readonly string[];
  allowedSourceIds: readonly string[];
};
type CandidateAnswer = { text: string; sourceIds: readonly string[] };

function grade(test: GoldenCase, answer: CandidateAnswer) {
  const checks = [
    ...test.requiredPhrases.map((phrase) => ({ name: "contains:" + phrase, passed: answer.text.includes(phrase) })),
    ...test.forbiddenPhrases.map((phrase) => ({ name: "excludes:" + phrase, passed: !answer.text.includes(phrase) })),
    { name: "sources-allowed", passed: answer.sourceIds.every((id) => test.allowedSourceIds.includes(id)) },
  ];
  return { caseId: test.id, checks, needsReview: checks.every((item) => item.passed) };
}
~~~

这里把通过样本也标为待复核，是为了强调确定性规则只覆盖声明的一部分。实际流程可按风险把部分成功样本抽样复核，把任何来源越界直接判为失败。

## 在 CI 中只比较可解释结果

门禁输出案例 ID、失败检查和提示词修订，不记录完整敏感上下文。策略可以很简单：确定性安全规则失败时退出非零；文本判断不确定时生成复核清单；所有检查通过才允许进入下一阶段。

~~~diff filename="prompt-and-cases.diff" {1-5}
-回答问题，并尽量提供帮助。
+只依据标记为 SOURCE 的内容回答；依据不足时明确说明。
+
+新增回归案例：empty-evidence
+预期：不生成来源 ID，不承诺未知事实。
~~~

修改提示词而不增加暴露该问题的案例，下一次很容易复发。反过来，只堆案例不写失败动作，也会得到没人处理的红色报告。

## 接入现有链路

- [x] 案例不含真实凭据与用户数据
- [x] 来源 ID 与[RAG 追踪结构](/writing/typescript-observable-rag-pipeline/#先定义可追踪的数据形状)一致
- [x] 报告保留逐项证据
- [x] 安全规则与内容复核分流
- [ ] 发布前由门槛所有者确认待复核项

完整的评测角色划分见[评测闭环](/writing/llm-evaluation-regression-loop/#组合三类评测器)。采样温度变化可能让输出字面不同，却不能替代这些结果判断，参见[温度不是可信度旋钮](/notes/temperature-is-not-confidence/)。黄金集的价值不在规模，而在每个案例都对应一个不愿再次失去的行为。
`,
  },
  {
    id: id("f2", 110),
    kind: "note",
    title: "温度不是可信度旋钮",
    slug: "temperature-is-not-confidence",
    published_at: "2026-07-30T01:00:00.000Z",
    summary: null,
    topics: ["llm", "evaluation"],
    body: () => `温度不是可信度旋钮。它改变的是采样时 token 分布的形状，会影响输出的多样性与稳定性，却不测量事实正确率，也不表示概率已经校准。把温度调低，可能得到更一致的错误；让模型报告“90% 确信”，也不自动得到可验证的置信度。

后果是，可信度必须回到外部证据：来源是否支持声明、确定性规则是否通过、黄金样本是否回归、风险样本是否复核。建立判断框架可看[评测闭环](/writing/llm-evaluation-regression-loop/#组合三类评测器)，最小自动化实现见[黄金样本教程](/writing/prompt-regression-golden-set/#在-ci-中只比较可解释结果)。采样参数应随模型与提示词版本记录，但不能代替评测。`,
  },
  {
    id: id("f2", 111),
    kind: "article",
    title: "把 Prompt Injection 当作数据流问题",
    slug: "prompt-injection-data-flow",
    published_at: "2026-08-04T01:00:00.000Z",
    summary:
      "从不可信输入如何穿过检索和工具链出发，建立 Prompt Injection 的数据流威胁模型。",
    topics: ["tools", "safety"],
    seo_description:
      "沿着用户输入、检索文本、模型输出和工具参数的数据流，划分 Prompt Injection 的信任与能力边界。",
    body: () => `Prompt Injection 的危险不只来自一句“忽略之前指令”。真正的问题是，不可信文本会经过检索、上下文拼接和模型解释，最终靠近有副作用的工具。只在系统提示词里要求模型保持警惕，无法形成隔离边界。

## 先画出数据怎样流动

系统指令来自受控配置；用户输入、网页文本和上传文档默认不可信；工具输出即使来自内部服务，也可能包含被外部数据污染的字段。模型输出则是未验证的建议。每一步都要问：这份数据接下来能触达什么能力？

| 来源 | 初始信任 | 可达能力 | 必需控制 | 安全失败 |
| --- | --- | --- | --- | --- |
| 系统配置 | 受控 | 定义流程 | 版本与变更审查 | 停止启动 |
| 用户输入 | 不可信 | 查询与建议 | 身份、长度、类型 | 拒绝或缩小范围 |
| 检索文本 | 不可信数据 | 模型上下文 | 来源标记、内容隔离 | 丢弃片段 |
| 模型输出 | 未验证 | 工具请求候选 | Schema、权限、语义校验 | 不执行 |
| 工具输出 | 条件可信 | 后续上下文 | 结果 Schema 与转义 | 终止链路 |

> [!WARNING]
> 检索到的文本是数据，不是权威指令。无论相似度多高，它都不能授予权限、修改系统策略或跳过工具校验。

## 给每类数据标记信任与能力

类型标记不能自动提供安全，但能迫使代码显式转换。只有可信代码可以把未验证文本变成允许执行的动作请求。

~~~ts filename="trust-flow.ts" {1-13}
type Source = "system" | "user" | "retrieved" | "tool" | "model";
type TaintedText = { source: Source; value: string };
type ProposedAction = { tool: "create_ticket"; arguments: unknown };
type AuthorizedAction = ProposedAction & { actorId: string; capability: "ticket:create" };

function authorize(proposal: ProposedAction, scope: Scope): AuthorizedAction | null {
  if (!scope.capabilities.has("ticket:create")) return null;
  return {
    ...proposal,
    actorId: scope.actorId,
    capability: "ticket:create",
  };
}
~~~

能力来自会话身份和服务端策略，而不是 proposal 里的文本。结构化输出仍需经过[语义校验](/writing/structured-output-schema-retry-validation/#第三层语义校验连接业务事实)。

## 检索边界要保留来源

RAG 系统应把来源 ID、文档版本和信任标签与片段一起传递。不要把检索结果无标记地粘到系统指令后面。候选、重排和归因的拆分见[RAG 四阶段](/writing/rag-retrieval-reranking-attribution/#四个阶段四种责任)。如果文档包含“调用工具发送数据”之类文本，它只能作为待回答的内容，不能进入动作允许列表。

## 能力必须由可信代码授予

工具注册表、参数 Schema、对象级权限、幂等和超时都应位于模型之外。[安全工具调用教程](/writing/safe-tool-calling-typescript/#准备一个受控工具注册表)展示了这一外壳。对于读取类工具，也要限制查询范围和返回字段，避免模型通过多轮调用逐步扩大信息边界。

## 用失败路径验证隔离

测试不应只放几句攻击短语。更重要的是验证数据流：检索文本能否改变工具名，工具输出能否注入下一轮系统字段，未经授权的动作是否在模型调用前后都被拒绝，审计是否能追到来源。

- 用户文本请求提升权限，能力集合保持不变
- 检索片段伪造系统消息，仍标记为 retrieved
- 模型生成未知工具名，允许列表拒绝
- 合法工具返回额外字段，结果 Schema 丢弃或拒绝
- 任一步失败后，不继续执行后续副作用

OWASP 将 Prompt Injection 列为 LLM 应用的核心风险之一，并强调输入处理、最小权限和人工批准等分层措施；NIST 的生成式 AI 风险资料同样要求把风险控制放入完整生命周期。[^owasp][^nist] 对工程实现而言，最稳妥的起点是追踪不可信数据能走到哪里，再逐段切断不必要的能力。

[^owasp]: OWASP, [LLM01: Prompt Injection](https://genai.owasp.org/llmrisk/llm01-prompt-injection/), accessed 2026-08-10。
[^nist]: NIST, [Artificial Intelligence Risk Management Framework: Generative Artificial Intelligence Profile](https://doi.org/10.6028/NIST.AI.600-1), 2024。
`,
  },
  {
    id: id("f2", 112),
    kind: "tutorial",
    title: "实作：流式回答中的取消、背压与错误收口",
    slug: "streaming-llm-sse-cancellation",
    published_at: "2026-08-08T01:00:00.000Z",
    summary:
      "实现一条支持取消、心跳、背压与错误事件的流式回答通道，并验证断线后的收口行为。",
    topics: ["llm", "safety", "performance"],
    body: () => `流式回答让首段内容更早出现，也增加了状态数量：客户端可能断线，模型任务可能继续，缓冲区可能增长，错误可能发生在已经发送部分文本之后。可靠实现需要把传输状态和任务状态分开，并规定唯一终态。

## 定义事件，而不是拼接字符串

示例使用换行分隔的 JSON 事件。生产若选择 Server-Sent Events，应遵循其事件帧规则，不能假设网络分块刚好对齐消息。[^sse]

~~~ts filename="stream-events.ts" {1-9}
type StreamEvent =
  | { type: "token"; text: string }
  | { type: "heartbeat"; at: string }
  | { type: "complete"; usage: { outputTokens: number } }
  | { type: "error"; code: "cancelled" | "upstream" | "invalid_event" };

function encode(event: StreamEvent): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(event) + "\\n");
}
~~~

## 服务端传播取消和背压


~~~ts filename="stream-answer.ts" {1-18}
function streamAnswer(run: (signal: AbortSignal) => AsyncIterable<string>) {
  const controller = new AbortController();
  const body = new ReadableStream<Uint8Array>({
    async pull(stream) {
      try {
        const next = await iterator.next();
        if (next.done) {
          stream.enqueue(encode({ type: "complete", usage: { outputTokens: count } }));
          stream.close();
          return;
        }
        count += 1;
        stream.enqueue(encode({ type: "token", text: next.value }));
      } catch {
        stream.enqueue(encode({ type: "error", code: "upstream" }));
        stream.close();
      }
    },
    cancel() { controller.abort(); },
  });
  let count = 0;
  const iterator = run(controller.signal)[Symbol.asyncIterator]();
  return body;
}
~~~




~~~ts filename="consume.ts" {1-12}
async function consume(response: Response, signal: AbortSignal) {
  const reader = response.body
    ?.pipeThrough(new TextDecoderStream())
    .getReader();
  if (!reader) throw new Error("missing_stream");
  signal.addEventListener("abort", () => reader.cancel(), { once: true });
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    parser.push(value);
  }
}
~~~

> [!NOTE]
> HTTP 传输结束与模型任务结束是两个状态。客户端断线后，服务端必须显式取消或接管后台任务，不能把 socket 关闭当成上游已经停止。

## 心跳和错误都进入同一状态机

心跳用于区分长时间无 token 与连接失活，但它不重置模型总超时。解析器应缓存不完整帧，只在读到完整分隔符后解码，并拒绝未知事件。开始输出后再发生错误，不能改写 HTTP 状态码；应发送一个可识别的终止事件，并阻止后续 token。

## 终态只能出现一次

取消、上游完成和异常可能竞争。用一个本地状态保护 complete 或 error 只发一次，并在 finally 中停止心跳、释放 reader、撤销监听器。断线后若工具仍在执行，还要遵守[工具调用的幂等与超时](/writing/safe-tool-calling-typescript/#用失败矩阵验证收口)。

| 场景 | 可见终态 | 清理要求 |
| --- | --- | --- |
| 正常完成 | complete | 停止心跳、关闭流 |
| 用户取消 | error:cancelled 或静默断开 | 传播 AbortSignal |
| 上游异常 | error:upstream | 不再发送 token |
| 无效事件 | error:invalid_event | 丢弃后续帧 |
| 客户端读取慢 | 等待 pull | 不无限预取 |

- [x] 取消从浏览器传播到上游适配器
- [x] pull 控制读取节奏，不在后台无限缓存
- [x] 心跳与 token 使用同一事件编码
- [x] 完成和错误互斥
- [ ] 集成测试模拟半帧、断线和慢消费者

缓存命中也应发出同一事件协议，并把模型、提示词和工具修订放进键中，参见[缓存键版本化](/notes/llm-cache-key-versioning/)。这条传输链路属于[五层可靠性边界](/writing/production-llm-reliability-boundaries/#模型边界适配不等于信任)里的模型与验证交界：速度优化不能绕过终态和证据。

[^sse]: WHATWG, [Server-sent events](https://html.spec.whatwg.org/multipage/server-sent-events.html); MDN, [Streams API](https://developer.mozilla.org/docs/Web/API/Streams_API) and [AbortController](https://developer.mozilla.org/docs/Web/API/AbortController)。
`,
  },
]);

export const EDITORIAL_POST_IDS = Object.freeze(
  Object.fromEntries(POST_DEFINITIONS.map((post) => [post.slug, post.id])),
);

export const EDITORIAL_SETTINGS = Object.freeze({
  id: EDITORIAL_IDS.settings,
  site_name: "海边的小卖部",
  author_name: "关山",
  tagline: "把复杂问题写清楚",
  homepage_intro:
    "这里记录 AI 应用从想法走向可靠运行的过程：拆解系统边界，验证关键判断，也保留值得回看的工程取舍。",
  biography:
    "关山在「海边的小卖部」记录 AI 应用工程中的系统设计、检索、评测、工具调用与可靠性问题。文章尽量从可验证的边界和失败路径出发，把复杂问题写清楚。",
  default_seo_description:
    "海边的小卖部是一份由关山撰写的中文 AI 应用工程出版物，关注 LLM 系统、RAG、评测、工具与可靠性。",
  footer_text: "海边的小卖部，记录 AI 应用工程中值得反复验证的判断。",
  locale: "zh-CN",
  timezone: "Asia/Shanghai",
});

/**
 * Build the Directus-shaped editorial snapshot shared by local fixtures and seed data.
 * @param {{ coverId: string, publishedAtMap?: Map<string, string> | Record<string, string> }} options
 */
export function buildEditorialFixture({ coverId, publishedAtMap }) {
  const getPublishedAt = (
    /** @type {string} */ postId,
    /** @type {string} */ fallback,
  ) => {
    if (!publishedAtMap) return fallback;
    if (publishedAtMap instanceof Map)
      return publishedAtMap.get(postId) ?? fallback;
    return publishedAtMap[postId] ?? fallback;
  };
  const topicsByKey = new Map(TOPICS.map((topic) => [topic.key, topic]));
  const topics = TOPICS.map((topic) => ({
    description: topic.description,
    id: topic.id,
    name: topic.name,
    slug: topic.slug,
  }));
  const posts = POST_DEFINITIONS.map((definition) => {
    const publishedAt = getPublishedAt(definition.id, definition.published_at);
    return {
      body: definition.body({ coverId }),
      cover_alt: definition.featured
        ? "一次 LLM 请求经过输入、上下文、模型、工具与验证五层边界"
        : null,
      cover_decorative: false,
      cover_image: definition.featured ? coverId : null,
      date_created: publishedAt,
      date_updated: definition.date_updated ?? null,
      featured: definition.featured ?? false,
      id: definition.id,
      kind: definition.kind,
      published_at: publishedAt,
      seo_description: definition.seo_description ?? null,
      seo_title: definition.seo_title ?? null,
      slug: definition.slug,
      status: "published",
      summary: definition.summary,
      title: definition.title,
    };
  });
  let joinNumber = 0;
  const postTopics = POST_DEFINITIONS.flatMap((post) =>
    post.topics.map((topicKey) => {
      const topic = topicsByKey.get(topicKey);
      if (!topic) throw new Error(`Unknown editorial topic ${topicKey}`);
      joinNumber += 1;
      return {
        id: id("f4", joinNumber),
        posts_id: post.id,
        topics_id: topic.id,
      };
    }),
  );

  if (posts.length !== 12 || topics.length !== 6 || postTopics.length !== 28) {
    throw new Error(
      "Canonical editorial fixture has an unexpected record count",
    );
  }
  return { posts, postTopics, topics };
}
