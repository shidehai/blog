export interface SiteProfile {
  name: string;
  handle: string;
  title: string;
  avatar: string;
  bio: string;
  hitokoto: string;
  location: string;
  socials: {
    github: string;
    about: string;
    email: string;
    rss: string;
  };
}

export interface Post {
  id: string;
  slug: string;
  title: string;
  summary: string;
  content: string;
  publishedAt: string;
  updatedAt?: string;
  category: string;
  tags: string[];
  cover?: string;
  featured?: boolean;
  series?: {
    name: string;
    slug: string;
    order?: number;
  };
  readingMinutes: number;
  wordCount: number;
}

export interface Category {
  name: string;
  slug: string;
  count: number;
}

export interface Tag {
  name: string;
  slug: string;
  count: number;
}

export interface Series {
  id: string;
  name: string;
  slug: string;
  description: string;
  count: number;
  posts: {
    title: string;
    slug: string;
    publishedAt: string;
  }[];
}

/** 专题：按标签维度归纳的内容集合，`name` 与 Post.tags 对齐。 */
export interface Topic {
  id: string;
  name: string;
  slug: string;
  description: string;
  count: number;
}

/** 随记：短篇碎片记录，不进入文章详情页。 */
export interface Note {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  publishedAt: string;
}

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

export interface ToolItem {
  id: string;
  name: string;
  description: string;
  url: string;
  category: string;
  icon?: string;
}

export interface HeadingItem {
  id: string;
  text: string;
  level: number;
}
