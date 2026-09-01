import { Code2 } from "lucide-react";
import { getAllProjects } from "../../lib/content";
import { ProjectCard } from "../../components/ProjectCard";

export const metadata = {
  title: "开源项目与工具",
  description: "个人开源作品、工程架构工具与实验性项目",
};

export default async function ProjectsPage() {
  const projects = await getAllProjects();

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-2 pb-6 border-b border-[var(--border)]">
        <div className="flex items-center gap-2 text-xs font-mono uppercase text-[var(--accent)] font-bold">
          <Code2 className="w-4 h-4" />
          <span>Open Source & Crafted Work</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text-primary)]">
          开源项目与工具
        </h1>
        <p className="text-sm text-[var(--text-secondary)]">
          个人开源的智能体框架、RAG 向量重排工具与工程实验作品。
        </p>
      </div>

      {/* Projects Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {projects.map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
      </div>
    </div>
  );
}
