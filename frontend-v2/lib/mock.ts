import type {
  ActivityDay,
  Post,
  Project,
  SiteProfile,
  ToolItem,
} from "./types";

export const MOCK_PROFILE: SiteProfile = {
  name: "shidehai",
  handle: "@shidehai",
  title: "开发者 / AI 架构与 Linux 爱好者",
  avatar: "/avatar.jpg",
  bio: "专注于 Go、大模型系统落地、RAG 检索工程与分布式架构。坚持用确定性的工程护栏驾驭概率模型。",
  hitokoto: "记录 Go、LLM 系统、Linux 与真实项目中的解决方案。",
  location: "Shanghai, China",
  socials: {
    github: "https://github.com/shidehai",
    about: "/about",
    email: "mailto:author@example.com",
    rss: "/feed.xml",
  },
};

export const MOCK_POSTS: Post[] = [
  {
    id: "p1",
    slug: "go-agent-zero-to-one-learning-roadmap",
    title: "从零开始用 Go 开发 AI Agent：一条可执行的六周学习路线",
    summary:
      "面向 Go 和 AI Agent 初学者，以个人任务助理为主线，把 Go 语法、HTTP、JSON、接口、测试 与模型调用、工具循环、状态管理和安全边界串成一条六周可执行路线。",
    category: "AI / LLM",
    tags: ["Go", "AI Agent", "Tool Calling", "工程实践"],
    cover:
      "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80",
    featured: true,
    series: {
      name: "AI Agent 实战",
      slug: "ai-agent-in-action",
      order: 1,
    },
    publishedAt: "2026-08-12T09:00:00.000Z",
    readingMinutes: 6,
    wordCount: 3200,
    content: `面向 Go 和 AI Agent 初学者，以个人任务助理为主线，把 Go 语法、HTTP、JSON、接口、测试与模型调用、工具循环、状态管理和安全边界串成一条六周可执行路线。

## 为什么选择 Go 开发 AI Agent？

在 Python 生态中，LangChain、LlamaIndex 等框架虽然丰富，但在生产环境落地时常常面临内存开销大、多线程并发复杂、类型安全不足等挑战。

Go 语言具备：
- **极低的运行时开销**：单机轻松支撑万级 Goroutine 并发连接。
- **静态类型安全**：编译期捕获参数与 Schema 错误。
- **单文件二进制分发**：零依赖部署，对运维极其友好。

\`\`\`go
package main

import (
	"context"
	"fmt"
	"log"
)

type AgentWorker struct {
	modelName string
	tools     []Tool
}

func (w *AgentWorker) Run(ctx context.Context, prompt string) (string, error) {
	log.Printf("[Agent] executing task with model: %s", w.modelName)
	return fmt.Sprintf("Finished processing: %s", prompt), nil
}
\`\`\`

## 六周学习路线总览

1. **第一周：Go 基础与网络请求** —— 掌握 Struct、Interface、Channel、JSON 编解码与 HTTP Client 超时控制。
2. **第二周：大模型 API 契约与流式传输** —— 实现 SSE（Server-Sent Events）流式响应解析与 Token 计量。
3. **第三周：工具调用（Tool Calling）闭环** —— 动态注册 JSON Schema、解析参数、反射执行与结果回调。
4. **第四周：状态管理与持久化** —— 构建有限状态机（FSM），将 Agent 对话与任务栈持久化至 SQLite/PostgreSQL。
5. **第五周：多 Agent 分工与工作流** —— 侦察、编写、审查与验收流水线。
6. **第六周：安全沙箱与生产监控** —— 权限边界隔离、幂等键设计、OpenTelemetry 链路追踪。`,
  },
  {
    id: "p2",
    slug: "ai-agent-feedback-loop-silent-failure",
    title: "AI Agent 第四章：沉默不是正常，给编码 Agent 补上反馈回路",
    summary:
      "多 Agent 系统跑起来之后的第一个问题不在模型质量上：任务派出去了，界面什么都不显示。用桌面通知、并行任务状态槽和缓存命中告警三个真实案例，拆解 fail-silent 缺陷的形状与对策。",
    category: "AI / LLM",
    tags: ["AI Agent", "可观测性", "工程实践"],
    cover:
      "https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?w=800&auto=format&fit=crop&q=80",
    featured: false,
    series: {
      name: "AI Agent 实战",
      slug: "ai-agent-in-action",
      order: 2,
    },
    publishedAt: "2026-08-07T14:30:00.000Z",
    readingMinutes: 5,
    wordCount: 2600,
    content: `多 Agent 系统跑起来之后的第一个问题往往不在模型质量上：任务派出去了，界面什么都不显示，或者子 Agent 在后台死循环。

## Fail-Silent（静默失败）的典型危害

在没有明确反馈回路的 Agent 架构中，系统失败时往往表现为：
1. **无限悬挂**：等待某个永远不会返回结果的子进程。
2. **错误吞没**：某个工具调用返回 404，模型却误以为“找不到数据是正常的”，继续生成无意义的后续推理。
3. **成本失控**：在后台不断重试高昂的 API 调用。

\`\`\`typescript
export interface AgentProgressEvent {
  taskId: string;
  stepIndex: number;
  status: "running" | "waiting_tool" | "completed" | "errored";
  message: string;
  timestamp: number;
}
\`\`\`

## 解决方案：三级响应心跳

- **心跳机制**：每个运行中的 Agent 必须每 3 秒向父总线发送保活事件。
- **状态槽可视化**：为每个并发任务分配独立的状态槽（Status Slot），暴露当前调用的具体工具与参数预览。
- **主动通知**：关键节点触发桌面或 Webhook 通知，绝不让用户在黑暗中等待。`,
  },
  {
    id: "p3",
    slug: "pi-multi-model-workflow",
    title: "AI Agent 第三章：Pi Agent 与多模型分工，构建可验收的编码工作流",
    summary:
      "以 Pi Agent 等终端编码工具为例，区分模型切换、多模型路由和多 Agent 编排，设计侦察、架构、实现、审查与确定性验证的分工协议，并解决上下文交接、并行冲突、成本和安全问题。",
    category: "AI / LLM",
    tags: ["AI Agent", "工作流", "架构与性能"],
    cover:
      "https://images.unsplash.com/photo-1634017839464-5c339ebe3cb4?w=800&auto=format&fit=crop&q=80",
    featured: false,
    series: {
      name: "AI Agent 实战",
      slug: "ai-agent-in-action",
      order: 3,
    },
    publishedAt: "2026-08-07T10:00:00.000Z",
    readingMinutes: 4,
    wordCount: 2100,
    content: `在复杂的代码重构与大型工程任务中，单一模型（Single-Agent）很难兼顾全局架构设计与细致入微的边缘测试编写。

## 多模型协作四步分工法

\`\`\`text
[ 用户任务输入 ]
      │
      ▼
1. 侦察 Agent (Fast Model: Claude 3.5 Haiku) ──> 快速搜寻代码库依赖与上下文
      │
      ▼
2. 架构 Agent (Deep Reasoning: Claude 3.5 Sonnet) ──> 制定修改计划与严格接口契约
      │
      ▼
3. 编码 Agent (Specialized Coding Agent) ──> 分块执行代码变更与补全
      │
      ▼
4. 验证 Agent (Deterministic Test Runner) ──> 编译检查、Lint、跑单元测试与回归
\`\`\`

这种流水线将昂贵的大参数推理集中在决策节点，执行与搜索交给轻量模型，既降低了 70% 的 Token 开销，又大幅提升了代码交付的可靠性。`,
  },
  {
    id: "p4",
    slug: "production-llm-reliability-boundaries",
    title: "从演示到生产：LLM 应用的五层可靠性边界",
    summary:
      "把一次 LLM 请求拆解为输入、上下文、模型、工具与验证五层，并为每一层定义明确的所有权、可观测指标与失败降级策略。",
    category: "架构与性能",
    tags: ["后端", "AI Agent", "可观测性"],
    cover:
      "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=800&auto=format&fit=crop&q=80",
    featured: false,
    publishedAt: "2026-07-29T16:00:00.000Z",
    readingMinutes: 5,
    wordCount: 2840,
    content: `一次原型演示只要模型返回一句像样的话就算成功，但要让 LLM 在生产系统中持续稳定运行，必须构建五层严格的工程边界：
1. **输入边界（Input Boundary）**：身份鉴权、配额控制与提示词注入防御。
2. **上下文边界（Context Boundary）**：文档切分、混合召回与 Token 预算控制。
3. **模型边界（Model Boundary）**：统一调用抽象、超时熔断与温度锁定。
4. **工具边界（Tool Boundary）**：Schema 强校验与权限沙箱。
5. **验证边界（Verification Boundary）**：格式断言与证据归因检验。`,
  },
  {
    id: "p5",
    slug: "rag-retrieval-reranking-attribution",
    title: "RAG 不是一次向量搜索：拆解检索、重排与答案归因",
    summary:
      "高质量 RAG 的核心在于多路召回、交叉编码器重排、Token 预算裁剪与端到端引用归因，而不是单纯把向量检索接到模型前面。",
    category: "项目实战",
    tags: ["RAG", "后端", "MySQL"],
    cover:
      "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=800&auto=format&fit=crop&q=80",
    featured: false,
    series: {
      name: "RAG 检索增强工程实战",
      slug: "rag-engineering-in-action",
      order: 1,
    },
    publishedAt: "2026-07-20T09:30:00.000Z",
    readingMinutes: 4,
    wordCount: 2150,
    content: `在实际业务知识库中，单纯使用稠密向量检索往往会遇到专有名词漏召回、数字与版本号不敏感等问题。

通过将 BM25 与 Dense Vector 混合检索，并通过 Cross-Encoder 重排，能够显著提升前 3 位候选片段的相关度与事实密度。`,
  },
];

// 52-week realistic contribution heatmap data
export function generateActivityData(): {
  days: ActivityDay[];
  activeDaysCount: number;
  totalUpdates: number;
} {
  const days: ActivityDay[] = [];
  const today = new Date("2026-08-20");
  const totalDays = 52 * 7;
  let activeDaysCount = 0;
  let totalUpdates = 0;

  // Specific dates with high activity
  const activeDatesMap: Record<string, number> = {
    "2026-08-12": 3,
    "2026-08-07": 4,
    "2026-08-04": 6,
    "2026-07-29": 12,
    "2026-07-24": 2,
    "2026-07-23": 1,
    "2026-07-22": 1,
    "2026-07-20": 1,
    "2026-07-17": 1,
    "2026-07-12": 1,
    "2026-07-09": 1,
    "2026-07-03": 1,
    "2026-06-22": 1,
    "2026-06-11": 1,
    "2026-05-29": 1,
    "2026-05-27": 1,
    "2025-12-10": 1,
    "2025-09-15": 1,
    "2025-09-12": 1,
    "2025-09-11": 1,
    "2025-09-10": 1,
    "2025-09-05": 1,
    "2025-08-29": 1,
    "2025-08-27": 2,
    "2025-08-26": 1,
  };

  for (let i = totalDays - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0]!;

    const count = activeDatesMap[dateStr] || 0;
    let level: 0 | 1 | 2 | 3 | 4 = 0;
    if (count >= 6) level = 4;
    else if (count >= 3) level = 3;
    else if (count >= 2) level = 2;
    else if (count >= 1) level = 1;

    if (count > 0) {
      activeDaysCount++;
      totalUpdates += count;
    }

    days.push({
      date: dateStr,
      count,
      level,
    });
  }

  return { days, activeDaysCount, totalUpdates };
}

export const MOCK_TOOLS: ToolItem[] = [
  {
    id: "tool-1",
    name: "JSON Schema to Zod",
    description: "快速将 JSON Schema 转换为可执行的 TypeScript Zod 校验定义。",
    url: "https://transform.tools/json-schema-to-zod",
    category: "代码工具",
  },
  {
    id: "tool-2",
    name: "Tiktoken Web Tokenizer",
    description: "在线计算与可视化 OpenAI/Claude 提示词 Token 消耗及边界。",
    url: "https://tiktokenizer.vercel.app",
    category: "AI 工具",
  },
  {
    id: "tool-3",
    name: "Crontab Guru",
    description: "快速验证与调试复杂 Cron 定时表达式。",
    url: "https://crontab.guru",
    category: "系统工具",
  },
];

/** 专题描述表：只为需要展示简介的标签补一句说明，其余标签走兜底文案。 */

export const MOCK_PROJECTS: Project[] = [
  {
    id: "proj-1",
    name: "trellis",
    description:
      "面向 AI 编码代理的任务与规格工作流框架：把需求、设计与执行计划固化成可复用的任务产物，跨会话保持上下文。",
    techStack: ["Python", "TypeScript", "CLI"],
    githubUrl: "https://github.com/shidehai/trellis",
    stars: 128,
  },
  {
    id: "proj-2",
    name: "vecrerank",
    description:
      "轻量向量重排工具：在检索与生成之间插入一层可解释的重排与归因，支持本地模型与远端 API 双通道。",
    techStack: ["Go", "SQLite", "ONNX"],
    githubUrl: "https://github.com/shidehai/vecrerank",
    stars: 76,
  },
  {
    id: "proj-3",
    name: "pi-agent",
    description:
      "多模型分工的编码代理实验：用有限状态机约束工具调用顺序，给每一步补上可验收的反馈回路。",
    techStack: ["Go", "TypeScript", "FSM"],
    githubUrl: "https://github.com/shidehai/pi-agent",
    liveUrl: "https://pi-agent.dev",
    stars: 214,
  },
  {
    id: "proj-4",
    name: "blog",
    description:
      "本站：Astro 静态前端 + Directus CMS，附带一套 Next.js 重构版前端与完整的部署与备份脚本。",
    techStack: ["Astro", "Next.js", "Directus", "Docker"],
    githubUrl: "https://github.com/shidehai/blog",
    liveUrl: "https://qingshan.dev",
    stars: 42,
  },
];
