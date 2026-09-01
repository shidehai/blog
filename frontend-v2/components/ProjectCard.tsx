import Link from "next/link";
import { ArrowUpRight, Github, Star } from "lucide-react";
import type { Project } from "../lib/types";

interface ProjectCardProps {
  project: Project;
}

export function ProjectCard({ project }: ProjectCardProps) {
  return (
    <div className="p-5 rounded-lg bg-[var(--bg-card)] border border-[var(--border)] hover:border-[var(--accent)] transition-all group flex flex-col justify-between space-y-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-base text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors flex items-center gap-1.5">
            <span>{project.name}</span>
            {project.liveUrl && (
              <ArrowUpRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
            )}
          </h3>

          {project.stars !== undefined && (
            <div className="flex items-center gap-1 text-xs font-mono text-[var(--text-muted)]">
              <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
              <span>{project.stars}</span>
            </div>
          )}
        </div>

        <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed line-clamp-3">
          {project.description}
        </p>
      </div>

      <div className="space-y-3 pt-2 border-t border-[var(--border-card)]">
        <div className="flex flex-wrap gap-1.5">
          {project.techStack.map((tech) => (
            <span
              key={tech}
              className="px-2 py-0.5 rounded text-[10px] font-mono bg-[var(--code-bg)] text-[var(--text-secondary)]"
            >
              {tech}
            </span>
          ))}
        </div>

        <div className="flex items-center gap-3 text-xs font-medium">
          {project.githubUrl && (
            <Link
              href={project.githubUrl}
              target="_blank"
              className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center gap-1 transition-colors"
            >
              <Github className="w-3.5 h-3.5" />
              <span>源码</span>
            </Link>
          )}
          {project.liveUrl && (
            <Link
              href={project.liveUrl}
              target="_blank"
              className="text-[var(--accent)] hover:underline flex items-center gap-0.5"
            >
              <span>在线体验</span>
              <ArrowUpRight className="w-3 h-3" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
