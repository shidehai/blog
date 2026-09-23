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
