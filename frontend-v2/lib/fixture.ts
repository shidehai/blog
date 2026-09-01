/**
 * Directus 形状的夹具数据（蛇形字段，对应 CMS 列名），供 lib/content.ts 接入
 * Directus 后作为离线降级来源使用。
 *
 * 类型在本文件内自带：这里描述的是 CMS 原始行，与 lib/types.ts 里面向视图的
 * Post/Topic 是两套模型，不要合并。接入时在 content.ts 里做一次映射。
 *
 * ponytail: 目前尚无 lib/directus.ts，本文件未被引用；接线时一并补映射层。
 */

interface FixtureTopic {
  id: string;
  name: string;
  slug: string;
  description: string;
  postCount: number;
}

interface FixtureSettings {
  site_name: string;
  author_name: string;
  tagline: string;
  homepage_intro: string;
  biography: string;
  default_seo_description: string;
  avatar: string;
  footer_text: string;
  locale: string;
  timezone: string;
}

interface FixtureSocialLink {
  id: string;
  label: string;
  url: string;
  icon: string;
  sort: number;
}

interface FixtureTaxonomy {
  id: string;
  name: string;
  slug: string;
  description?: string;
}

interface FixturePost {
  id: string;
  kind: "article" | "tutorial" | "note";
  status: "published";
  title: string;
  slug: string;
  published_at: string;
  date_updated: string | null;
  summary: string;
  featured: boolean;
  cover_image: string | null;
  category: FixtureTaxonomy | null;
  series: FixtureTaxonomy | null;
  series_order: number | null;
  /** M2M 结果形状，与 Directus REST 返回一致，供 buildSnapshot 直接消费。 */
  tags: { tags_id: FixtureTaxonomy }[];
  topics: { topics_id: FixtureTopic }[];
  body: string;
}

export const FIXTURE_TOPICS: FixtureTopic[] = [
  {
    id: "f1000000-0000-4000-8000-000000000001",
    name: "LLM 系统",
    slug: "llm-systems",
    description: "大模型应用的边界、编排、可观测性与运行时设计。",
    postCount: 3,
  },
  {
    id: "f1000000-0000-4000-8000-000000000002",
    name: "检索增强生成",
    slug: "retrieval-augmented-generation",
    description: "文档切分、召回、重排、上下文编排与答案归因。",
    postCount: 2,
  },
  {
    id: "f1000000-0000-4000-8000-000000000003",
    name: "AI 评测",
    slug: "ai-evaluation",
    description: "样本集、指标、回归测试与上线判断。",
    postCount: 2,
  },
  {
    id: "f1000000-0000-4000-8000-000000000004",
    name: "智能体与工具",
    slug: "agents-and-tools",
    description: "结构化输出、工具调用和受控执行。",
    postCount: 2,
  },
  {
    id: "f1000000-0000-4000-8000-000000000005",
    name: "安全与可靠性",
    slug: "ai-safety-reliability",
    description: "输入信任、失败边界、降级与安全控制。",
    postCount: 2,
  },
  {
    id: "f1000000-0000-4000-8000-000000000006",
    name: "推理性能",
    slug: "inference-performance",
    description: "流式传输、缓存、延迟与资源权衡。",
    postCount: 1,
  },
];

export const FIXTURE_CATEGORIES: FixtureTaxonomy[] = [
  {
    id: "f3000000-0000-4000-8000-000000000001",
    name: "工程实践",
    slug: "engineering",
    description: "系统设计、可靠性与工程方法。",
  },
  {
    id: "f3000000-0000-4000-8000-000000000002",
    name: "技术笔记",
    slug: "notes",
    description: "调试发现与未成体系的思考。",
  },
];

export const FIXTURE_TAGS: FixtureTaxonomy[] = [
  {
    id: "f4000000-0000-4000-8000-000000000001",
    name: "TypeScript",
    slug: "typescript",
  },
  {
    id: "f4000000-0000-4000-8000-000000000002",
    name: "架构",
    slug: "architecture",
  },
  {
    id: "f4000000-0000-4000-8000-000000000003",
    name: "可观测性",
    slug: "observability",
  },
  {
    id: "f4000000-0000-4000-8000-000000000004",
    name: "性能",
    slug: "performance",
  },
];

export const FIXTURE_SERIES: FixtureTaxonomy[] = [
  {
    id: "f5000000-0000-4000-8000-000000000001",
    name: "LLM 应用生产化",
    slug: "productionizing-llm-apps",
    description: "把演示级 LLM 应用推到可运维生产系统的完整路径。",
  },
];

export const FIXTURE_SETTINGS: FixtureSettings = {
  site_name: "Personal Knowledge Journal",
  author_name: "shidehai",
  tagline: "Complex ideas, made clear; small ideas, kept alive.",
  homepage_intro:
    "这里记录关于 LLM 系统架构、RAG 检索工程、智能体设计与软件工程可靠性的实践思考与技术笔记。",
  biography:
    "专注于大语言模型应用架构、检索增强生成（RAG）与高可靠分布式系统。推崇清晰的工程边界与务实的实践主义。",
  default_seo_description:
    "专注于 LLM 系统、RAG、AI 评测与智能体工具链的技术知识库与工程随记。",
  avatar: "/avatar.png",
  footer_text: "© 2026 shidehai. Crafted with precision & clarity.",
  locale: "zh-CN",
  timezone: "Asia/Shanghai",
};

export const FIXTURE_SOCIAL_LINKS: FixtureSocialLink[] = [
  {
    id: "s1",
    label: "GitHub",
    url: "https://github.com",
    icon: "github",
    sort: 1,
  },
  {
    id: "s2",
    label: "RSS",
    url: "/rss.xml",
    icon: "rss",
    sort: 2,
  },
  {
    id: "s3",
    label: "Email",
    url: "mailto:author@example.com",
    icon: "email",
    sort: 3,
  },
];

const topic0 = FIXTURE_TOPICS[0]!;
const topic1 = FIXTURE_TOPICS[1]!;
const topic2 = FIXTURE_TOPICS[2]!;
const topic3 = FIXTURE_TOPICS[3]!;
const topic4 = FIXTURE_TOPICS[4]!;
const topic5 = FIXTURE_TOPICS[5]!;

export const FIXTURE_POSTS: FixturePost[] = [
  {
    id: "f2000000-0000-4000-8000-000000000101",
    kind: "article",
    status: "published",
    title: "从演示到生产：LLM 应用的五层可靠性边界",
    slug: "production-llm-reliability-boundaries",
    published_at: "2026-05-20T01:00:00.000Z",
    summary:
      "把一次 LLM 请求拆成输入、上下文、模型、工具与验证五层，并为每层定义可观测的失败边界与重试策略。",
    featured: true,
    cover_image: null,
    date_updated: null,
    category: FIXTURE_CATEGORIES[0]!,
    series: FIXTURE_SERIES[0]!,
    series_order: 1,
    tags: [{ tags_id: FIXTURE_TAGS[1]! }, { tags_id: FIXTURE_TAGS[2]! }],
    topics: [{ topics_id: topic0 }, { topics_id: topic2 }, { topics_id: topic4 }],
    body: `一次演示只要返回一句像样的话，生产系统却要回答更难的问题：输入是否可信、检索依据是否完整、模型输出能否进入业务流程、工具副作用是否可控，以及最终答案由谁验收。把这些问题都归到“模型效果”里，会让故障定位失去抓手。

## 五层不是调用顺序，而是责任边界

我把 LLM 应用拆成**输入、上下文、模型、工具、验证**五层。这个划分不是某个框架的标准，而是一种工程综合：每层都要有明确的所有者、可观察的输入输出，以及失败后的收口动作。

| 边界 | 必须回答的问题 | 最小失败信号 |
| --- | --- | --- |
| **输入** | 请求来自谁，允许做什么 | 拒绝原因与请求类别 |
| **上下文** | 依据从哪里来，是否过期 | 文档 ID、版本与召回为空 |
| **模型** | 使用哪个版本与约束 | 模型版本、结束原因与耗时 |
| **工具** | 会产生什么副作用 | 工具名、幂等键与终态 |
| **验证** | 什么结果可以交付 | 规则结果、证据与降级路径 |

> 💡 **工程原则**
> 
> 五层模型是本文用于分配责任的工程方法。它的核心价值在于：**让每一次模型调用失败都能精准定位到具体责任层，而不是笼统的“AI 不稳定”。**

## 1. 输入边界：先决定能力，再处理文本

### 所有权与鉴权前置
输入层不只做长度限制。它要把身份、租户、会话目的、允许的能力和原始文本分开保存。用户说“帮我查订单”和用户拥有查订单权限，是两件不同的事。权限必须来自可信系统，不能从提示词里推断。

### 可观察失败
记录输入类别、规则版本和拒绝代码，不记录不必要的正文。遇到超长文本、缺少身份或能力不匹配时，应在调用模型前停止。这样既节省资源，也避免把鉴权责任推给概率模型。

## 2. 上下文边界：来源比相似度更重要

### 检索与预算管理
上下文层负责检索、重排、版本过滤和预算分配。一个片段进入提示词时，应携带文档 ID、版本、时间和召回分数。

### 优雅降级
“找不到”必须是一等结果。召回为空、候选过旧、来源互相冲突时，不要用模型的流畅性掩盖证据缺口。系统可以请求补充条件、展示候选来源，或明确降级为不带知识库依据的通用回答。

## 3. 模型边界：适配不等于信任

模型层把供应商响应归一为本地契约，并固定模型修订、提示词修订、采样参数和超时。业务代码不应直接依赖某个 SDK 的松散响应。

\`\`\`typescript
export interface ModelResult {
  modelRevision: string;
  text: string;
  finishReason: "stop" | "length" | "blocked" | "unknown";
  usage: { inputTokens: number; outputTokens: number };
  durationMs: number;
}
\`\`\`

## 4. 工具边界：副作用必须可重放

工具层负责参数校验、权限、幂等、超时和审计。模型只能提出动作请求，不能直接获得数据库或网络能力。

- **幂等性保障**：每一个写操作必须携带客户端生成的幂等键（Idempotency Key）。
- **超时与重试**：超时不代表未执行，必须先查幂等状态再决定是否重放。

## 5. 验证边界：交付判断不能省略

验证层检查结构、业务语义、引用归因和风险规则。确定性规则先运行，需要判断的样本再进入评审。

\`\`\`typescript
export async function validateOutput(output: ModelResult): Promise<ValidationResult> {
  // 1. JSON Schema 刚性结构校验
  const schemaValid = await validateSchema(output.text);
  if (!schemaValid.ok) return { pass: false, reason: "SCHEMA_ERROR" };

  // 2. 事实归因一致性校验
  const attributionCheck = await verifyAttribution(output.text);
  return attributionCheck;
}
\`\`\`

## 总结清单

- [x] 每层有一个明确的输入与输出契约类型
- [x] 每层具备稳定的版本标识与可追踪事件
- [x] 每种失败类型有明确的所有者、重试预算和终态
- [x] 最终答案能够完全追溯到原始上下文来源与工具调用历史`,
  },
  {
    id: "f2000000-0000-4000-8000-000000000102",
    kind: "article",
    status: "published",
    title: "RAG 不是一次向量搜索：拆解检索、重排与答案归因",
    slug: "rag-retrieval-reranking-attribution",
    published_at: "2026-05-27T01:00:00.000Z",
    summary:
      "RAG 的质量来自召回、重排、上下文编排与引用闭环，而不是单纯把向量检索接到模型前面。",
    featured: true,
    cover_image: null,
    date_updated: null,
    category: FIXTURE_CATEGORIES[0]!,
    series: FIXTURE_SERIES[0]!,
    series_order: 2,
    tags: [{ tags_id: FIXTURE_TAGS[1]! }],
    topics: [{ topics_id: topic1 }, { topics_id: topic2 }],
    body: `检索增强生成（RAG）经常被压缩成“问题转向量，再取最相近的几段”。这一步只产生候选，离可交付答案还隔着重排、上下文编排和归因。四个阶段混在一个函数里时，最终的错误只剩一句“模型答错了”。

## 四个阶段，四种责任

| 阶段 | 输入 | 输出 | 主要失败信号 |
| --- | --- | --- | --- |
| **候选召回** | 查询、权限、时间范围 | 带来源的候选片段 | 相关来源未进入候选 |
| **重排 (Rerank)** | 查询与候选 | 可比较的相关性顺序 | 高相关片段被低质量内容挤出 |
| **上下文编排** | 排序结果与预算 | 有来源标记的提示上下文 | 截断、重复、证据冲突 |
| **答案归因** | 答案声明与来源 | 声明到证据的映射 | 引用存在但不支持声明 |

\`\`\`typescript
// RAG 核心流水分阶段调用示例
export async function executeRagPipeline(query: string): Promise<RagResponse> {
  // 1. 混合多路召回 (Dense + Sparse/BM25)
  const candidates = await hybridRetrieve(query, { topK: 50 });
  
  // 2. 交叉编码重排 (Cross-Encoder Rerank)
  const ranked = await crossEncoderRerank(query, candidates, { topN: 5 });
  
  // 3. 动态上下文打包与预算裁剪
  const promptContext = assembleContext(ranked, { maxTokens: 3000 });
  
  // 4. 生成与归因对齐
  return generateWithAttribution(query, promptContext);
}
\`\`\`

## 候选召回：目标是覆盖，不是立即定案

候选生成要保留文档身份和可追溯字段。向量相似度可以和关键词、结构字段、权限及时间约束组合。接口应返回候选事实，而不是拼好的提示词。`,
  },
  {
    id: "f2000000-0000-4000-8000-000000000103",
    kind: "article",
    status: "published",
    title: "TypeScript 下的受控工具调用设计",
    slug: "safe-tool-calling-typescript",
    published_at: "2026-06-05T03:00:00.000Z",
    summary:
      "使用 Zod 与 TypeScript 严格类型构建具有参数校验、权限控制与沙箱隔离的 Agent 工具执行器。",
    featured: false,
    cover_image: null,
    date_updated: null,
    category: FIXTURE_CATEGORIES[0]!,
    series: FIXTURE_SERIES[0]!,
    series_order: 3,
    tags: [{ tags_id: FIXTURE_TAGS[0]! }, { tags_id: FIXTURE_TAGS[1]! }],
    topics: [{ topics_id: topic3 }, { topics_id: topic4 }],
    body: `在构建智能体（Agent）系统时，直接让 LLM 的输出调用远程 API 是极其危险的。我们需要在模型决策与实际系统执行之间建立严格的类型契约与执行沙箱。

## 工具定义的类型安全

利用 Zod 既可以生成给 LLM 的 JSON Schema，又能在运行时完成绝对安全的 TypeScript 类型收窄：

\`\`\`typescript
import { z } from "zod";

export const QueryDatabaseTool = {
  name: "query_database",
  description: "根据 SQL 条件查询只读数据表",
  parameters: z.object({
    table: z.enum(["users", "orders", "products"]),
    filter: z.string().max(200),
    limit: z.number().int().min(1).max(50).default(10),
  }),
  execute: async (args, context) => {
    // 强制只读连接与上下文鉴权
    return context.db.readOnlyQuery(args.table, args.filter, args.limit);
  },
};
\`\`\`

## 执行阶段的三层防护

1. **Schema 校验**：拦截一切字段缺失与类型错误。
2. **上下文权限校验**：确认当前发起用户的 Token 拥有执行对应 tool 的 RBAC 权限。
3. **副作用隔离**：写操作要求二次确认或模拟试运行（Dry-run）。`,
  },
  {
    id: "f2000000-0000-4000-8000-000000000104",
    kind: "note",
    status: "published",
    title: "关于流式响应中的首字延迟与 TTFT 优化",
    slug: "streaming-ttft-optimization-note",
    published_at: "2026-06-15T08:30:00.000Z",
    summary:
      "在 Web 端体验中，TTFT (Time to First Token) 往往比总生成速度更影响用户的感知流畅度。",
    featured: false,
    cover_image: null,
    date_updated: null,
    category: FIXTURE_CATEGORIES[1]!,
    series: null,
    series_order: null,
    tags: [{ tags_id: FIXTURE_TAGS[3]! }],
    topics: [{ topics_id: topic5 }],
    body: `今天在调试 SSE (Server-Sent Events) 流式传输时，测试了不同 Prefetch 策略对 TTFT 的影响。

几个关键经验：
1. **不要在服务端积攒整个 Markdown 块才 flush**：客户端解析器完全可以处理不完整的 AST 片段。
2. **连接预热**：在用户输入焦点离开或即将敲击回车时提前建立双工连接。
3. **分块流式解析**：前端使用 \`TextDecoderStream\` 配合轻量状态机渲染，体验丝滑许多。`,
  },
  {
    id: "f2000000-0000-4000-8000-000000000105",
    kind: "note",
    status: "published",
    title: "AI 评测的陷阱：避免用 LLM 评测 LLM 带来的同质化盲区",
    slug: "ai-eval-llm-as-a-judge-pitfalls",
    published_at: "2026-06-22T09:15:00.000Z",
    summary:
      "LLM-as-a-Judge 很高效，但容易产生位置偏见、冗长度偏见和风格迎合。",
    featured: false,
    cover_image: null,
    date_updated: null,
    category: FIXTURE_CATEGORIES[1]!,
    series: null,
    series_order: null,
    tags: [],
    topics: [{ topics_id: topic2 }],
    body: `在自动化评估指标中，LLM 裁判往往偏爱**更长、排版更精美但可能包含幻觉**的回答。

**建议实践**：
- 先用确定性规则（正则、精确词表、JSON Schema）过滤 70% 的低级错误。
- 裁判提示词中剥离排版与修辞，只给纯事实命题列表让模型做真值判断。
- 关键生产变更必须保留小样本人工标注回流。`,
  },
  {
    id: "f2000000-0000-4000-8000-000000000106",
    kind: "note",
    status: "published",
    title: "设计模式思考：在 Agent 中拥抱有限状态机 (FSM)",
    slug: "agent-finite-state-machine",
    published_at: "2026-07-02T14:20:00.000Z",
    summary:
      "不要让 Agent 在无边界的 ReAct 循环中无限发散，显式状态机能大幅提升确定性。",
    featured: false,
    cover_image: null,
    date_updated: null,
    category: FIXTURE_CATEGORIES[1]!,
    series: null,
    series_order: null,
    tags: [{ tags_id: FIXTURE_TAGS[1]! }],
    topics: [{ topics_id: topic0 }, { topics_id: topic3 }],
    body: `纯 ReAct (Reason + Act) 循环经常在复杂分支上迷失或陷入死循环。

将业务流程建模为明确的 **FSM（状态机）**，让 LLM 仅负责状态转移条件判断与单状态动作决策，系统可维护性立刻提升一个数量级。`,
  },
];

/** 聚合成 buildSnapshot 的入参形状，让夹具与 Directus 走同一条映射。 */
export const FIXTURE_ROWS = {
  posts: FIXTURE_POSTS,
  categories: FIXTURE_CATEGORIES,
  tags: FIXTURE_TAGS,
  series: FIXTURE_SERIES,
  topics: FIXTURE_TOPICS,
  settings: FIXTURE_SETTINGS,
  socialLinks: FIXTURE_SOCIAL_LINKS,
};
