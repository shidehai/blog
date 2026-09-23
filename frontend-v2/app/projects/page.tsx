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
    <main className="projects-page" id="main-content">
      <header className="projects-header">
        <p className="projects-eyebrow">
          <Code2 aria-hidden="true" />
          <span>Open Source & Crafted Work</span>
        </p>
        <h1>开源项目与工具</h1>
        <p>个人开源的智能体框架、RAG 向量重排工具与工程实验作品。</p>
      </header>

      <section className="projects-grid" aria-label="开源项目列表">
        {projects.map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
      </section>
    </main>
  );
}
