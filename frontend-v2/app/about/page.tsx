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
  title: "关于",
  description: "关于作者、技术栈与本博客的建设理念",
};

export default async function AboutPage() {
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
          <span aria-current="page">关于</span>
        </nav>

        <header className="about-hero">
          <p>ABOUT THIS SPACE</p>
          <h1>关于这个博客</h1>
          <span>把实践整理成可以复用的经验。</span>
        </header>

        <div className="glass about-card">
          <div className="article-content about-intro">
            <h2>关于我</h2>
            <p>你好，我是 {profile.name}，一名以后端与系统开发为主的工程师。</p>
            <p>
              日常工作和个人项目主要围绕 Go、Web 服务、分布式架构与 Linux
              展开。我喜欢把环境配置、故障排障和架构实践整理成严谨可复现的记录，方便自己回顾，也希望能给遇到相同技术挑战的朋友提供一手参考。
            </p>
            <p>
              近期聚焦在两个领域：一是 AI Agent
              体系建设，从最小工具调用闭环到带自我反思的编码工作流；二是嵌入式硬件与通信中枢，包括串口驱动、容错通信与安全调度引擎。
            </p>
            <p>
              工作之余，喜欢折腾 Arch Linux、KDE 与 Hyprland
              工作流，并保持对前沿技术的持续好奇心。
            </p>
          </div>

          <div className="competency-grid" aria-label="技术方向">
            <section>
              <span>长期使用</span>
              <h2>后端与系统</h2>
              <p>Go、Linux、Docker、MySQL、Redis</p>
            </section>
            <section>
              <span>项目实践</span>
              <h2>Web 与实时通信</h2>
              <p>WebSocket、HTTP 接口设计、React、Next.js、SQLite</p>
            </section>
            <section>
              <span>持续学习</span>
              <h2>工程方向</h2>
              <p>AI Agent、硬件驱动接入、微服务高可用架构</p>
            </section>
          </div>

          <section className="about-section">
            <h2>这里会写什么</h2>
            <div className="about-topic-list">
              <div>
                <h3>开发实践</h3>
                <p>记录 Go、接口设计、实时通信、并发控制与数据库优化过程。</p>
              </div>
              <div>
                <h3>Linux 与桌面环境</h3>
                <p>
                  整理系统安装、窗口管理器配置、驱动问题与日常运维排查经验。
                </p>
              </div>
              <div>
                <h3>项目复盘</h3>
                <p>深入探讨真实生产环境中的技术选型、架构权衡与避坑指南。</p>
              </div>
            </div>
          </section>

          <section className="about-section">
            <h2>关于这个站点</h2>
            <p>
              本博客采用极简纸质美学与轻量级现代化 Web
              栈构建。追求极致的内容阅读体验、像素级排版美感与毫秒级的静态加载速度。
            </p>
          </section>
        </div>
      </main>

      {/* 3. Right Sidebar (224px) */}
      <SideRight posts={posts} />
    </div>
  );
}
