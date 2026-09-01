import Link from "next/link";
import {
  getAllPosts,
  getCategories,
  getProfile,
  getSeriesList,
  getTags,
} from "../../lib/content";
import { SideLeft } from "../../components/SideLeft";
import { SideRight } from "../../components/SideRight";

export const metadata = {
  title: "工具箱",
  description: "在线求解器、开发实用工具与开源项目入口",
};

interface ToolItem {
  name: string;
  badge: string;
  difficulty?: string;
  iconColor: "cyan" | "purple" | "green" | "red";
  desc: string;
  link: string;
  meta: string[];
}

const TOOLS_DATA: ToolItem[] = [
  {
    name: "Markdown 流程图与序列图实时渲染器",
    badge: "实用工具",
    iconColor: "cyan",
    desc: "支持 Mermaid 语法的本地极速流程图预览与高分辨率 SVG 矢量导出工具。",
    link: "#",
    meta: ["客户端计算", "0 依赖", "离线可用"],
  },
  {
    name: "JSON Schema 校验与 Go Struct 生成器",
    badge: "代码生成",
    iconColor: "purple",
    desc: "将任意 JSON 结构自动解析并转换为带 bson/json/yaml tag 的标准 Go 结构体。",
    link: "#",
    meta: ["Go 1.24+", "Tag 定制", "即时生成"],
  },
  {
    name: "Cron 表达式时间线模拟器",
    badge: "定时任务",
    iconColor: "green",
    desc: "直观展示 5 位/6 位 Cron 表达式在未来 10 次的触发时间点与时区换算。",
    link: "#",
    meta: ["标准 Cron", "时区预览", "秒级计算"],
  },
  {
    name: "Air780E AT 指令与 PDU 编解码器",
    badge: "嵌入式",
    iconColor: "red",
    desc: "针对 4G Cat.1 模组的十六进制 PDU 短信编解码及常用 URC/AT 调试指令速查。",
    link: "#",
    meta: ["PDU 7/8/16-bit", "URC 过滤", "AT 自动化"],
  },
  {
    name: "Base64 / JWT 调试解密器",
    badge: "安全认证",
    iconColor: "cyan",
    desc: "无网络上传的安全客户端 JWT 签名验证、Header/Payload 解码与过期时间计算。",
    link: "#",
    meta: ["纯前端解析", "隐私安全", "毫秒响应"],
  },
  {
    name: "Linux 常用内核参数与 udev 规则生成器",
    badge: "系统运维",
    iconColor: "purple",
    desc: "快速生成针对 USB 串口固定设备节点、多网卡绑定的 udev rules 规则文件。",
    link: "#",
    meta: ["Arch / Debian", "热插拔规则", "一键复制"],
  },
];

export default async function ToolsPage() {
  const [profile, categories, tags, seriesList, posts] = await Promise.all([
    getProfile(),
    getCategories(),
    getTags(),
    getSeriesList(),
    getAllPosts(),
  ]);

  return (
    <div className="layout">
      {/* 1. Left Sidebar (184px) */}
      <SideLeft
        profile={profile}
        categories={categories}
        tags={tags}
        seriesList={seriesList}
      />

      {/* 2. Middle Main Content */}
      <main className="main-content" id="main-content">
        <nav className="breadcrumbs" aria-label="面包屑导航">
          <Link href="/">首页</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">工具箱</span>
        </nav>

        <header className="toolbox-header">
          <div>
            <h1>工具箱</h1>
            <p>可以直接用的在线求解器、开发实用工具，以及开源项目入口</p>
          </div>
          <span>{TOOLS_DATA.length} 个入口</span>
        </header>

        <section className="toolbox-section">
          <h2 className="toolbox-section-title">
            <svg
              className="ui-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
            开发与运维实用工具
          </h2>

          <div className="toolbox-grid">
            {TOOLS_DATA.map((tool) => (
              <div key={tool.name} className="glass info-card tool-card">
                <div className="tool-card-head">
                  <div className={`tool-icon ${tool.iconColor}`}>
                    <svg
                      className="ui-icon"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                    </svg>
                  </div>
                  <h3>{tool.name}</h3>
                </div>
                <div className="tool-card-meta">
                  <span>{tool.badge}</span>
                  {tool.meta.map((m) => (
                    <span key={m}>{m}</span>
                  ))}
                </div>
                <p className="tool-card-desc">{tool.desc}</p>
                <span className="link">
                  打开{" "}
                  <svg
                    className="ui-icon"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </span>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* 3. Right Sidebar (224px) */}
      <SideRight posts={posts} />
    </div>
  );
}
