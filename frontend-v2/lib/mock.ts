import type { ActivityDay, Project, SiteProfile } from "./types";

/**
 * 站点设置尚未在 Directus 中建模的展示字段。文章、分类和标签不在这里复制，
 * 它们始终来自 fixture 或 Directus 的同一份快照。
 */
export const MOCK_PROFILE: SiteProfile = {
  name: "shidehai",
  handle: "@shidehai",
  title: "开发者 / AI 架构与 Linux 爱好者",
  avatar: "/avatar.svg",
  bio: "专注于 Go、大模型系统落地、RAG 检索工程与分布式架构。坚持用确定性的工程护栏驾驭概率模型。",
  hitokoto: "记录 Go、LLM 系统、Linux 与真实项目中的解决方案。",
  location: "Shanghai, China",
  socials: {
    github: "https://github.com/shidehai",
    about: "/about",
    email: "mailto:author@example.com",
  },
};

// 52-week realistic contribution heatmap data
export function generateActivityData(): {
  days: ActivityDay[];
  activeDaysCount: number;
  totalUpdates: number;
} {
  const days: ActivityDay[] = [];
  const today = new Date();
  const totalDays = 52 * 7;
  let activeDaysCount = 0;
  let totalUpdates = 0;

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

  for (let i = totalDays - 1; i >= 0; i -= 1) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateString = date.toISOString().split("T")[0]!;
    const count = activeDatesMap[dateString] ?? 0;
    const level: ActivityDay["level"] =
      count >= 6 ? 4 : count >= 3 ? 3 : count >= 2 ? 2 : count >= 1 ? 1 : 0;

    if (count > 0) {
      activeDaysCount += 1;
      totalUpdates += count;
    }

    days.push({ date: dateString, count, level });
  }

  return { days, activeDaysCount, totalUpdates };
}

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
      "本站：Next.js 静态站点与 Directus CMS，配套可复现的部署与备份脚本。",
    techStack: ["Next.js", "Directus", "Docker"],
    githubUrl: "https://github.com/shidehai/blog",
    liveUrl: "https://qingshan.dev",
    stars: 42,
  },
];
