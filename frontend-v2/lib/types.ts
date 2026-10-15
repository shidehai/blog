export type { SiteProfile, Post, PostSummary, Category, Tag, Series } from "@blog/content-contracts";

export interface Project {
  id: string;
  name: string;
  description: string;
  techStack: string[];
  githubUrl?: string;
  liveUrl?: string;
  stars?: number;
}

export interface ActivityDay {
  date: string;
  count: number;
  level: 0 | 1 | 2 | 3 | 4;
}

export interface HeadingItem {
  id: string;
  text: string;
  level: number;
}
