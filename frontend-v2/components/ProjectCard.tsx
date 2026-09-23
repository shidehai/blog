import Link from "next/link";
import { ArrowUpRight, Github, Star } from "lucide-react";

import type { Project } from "../lib/types";

interface ProjectCardProps {
  project: Project;
}

export function ProjectCard({ project }: ProjectCardProps) {
  return (
    <article className="project-card">
      <div className="project-card-content">
        <header className="project-card-header">
          <h2 className="project-card-title">
            <span>{project.name}</span>
            {project.liveUrl && (
              <ArrowUpRight
                className="project-card-live-icon"
                aria-hidden="true"
              />
            )}
          </h2>
          {project.stars !== undefined && (
            <span className="project-card-stars">
              <Star aria-hidden="true" />
              {project.stars}
            </span>
          )}
        </header>

        <p className="project-card-description">{project.description}</p>
      </div>

      <footer className="project-card-footer">
        <ul className="project-card-stack" aria-label="技术栈">
          {project.techStack.map((technology) => (
            <li key={technology}>{technology}</li>
          ))}
        </ul>

        <div className="project-card-links">
          {project.githubUrl && (
            <Link
              href={project.githubUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Github aria-hidden="true" />
              源码
            </Link>
          )}
          {project.liveUrl && (
            <Link
              href={project.liveUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="project-card-live-link"
            >
              在线体验
              <ArrowUpRight aria-hidden="true" />
            </Link>
          )}
        </div>
      </footer>
    </article>
  );
}
