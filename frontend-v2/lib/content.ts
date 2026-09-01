import {
  buildSnapshot,
  loadFromDirectus,
  type ContentSnapshot,
} from "./directus";
import { FIXTURE_ROWS } from "./fixture";
import {
  generateActivityData,
  MOCK_PROJECTS,
  MOCK_TOOLS,
} from "./mock";
import type {
  ActivityDay,
  Category,
  Note,
  Post,
  Project,
  Series,
  SiteProfile,
  Tag,
  Topic,
  ToolItem,
} from "./types";

/**
 * 每个进程构建一次内容快照：Directus 优先，失败或缺凭据时降级到夹具。
 * 两条路径共用 buildSnapshot，派生字段（阅读时长、计数、索引）只有一份实现。
 */
let cached: Promise<ContentSnapshot> | undefined;

function snapshot(): Promise<ContentSnapshot> {
  // 夹具的 cover_image 全为 null，不需要资源前缀，base 传空串。
  cached ??= loadFromDirectus().then(
    (snap) => snap ?? buildSnapshot(FIXTURE_ROWS, ""),
  );
  return cached;
}

export async function getProfile(): Promise<SiteProfile> {
  return (await snapshot()).profile;
}

export async function getAllPosts(): Promise<Post[]> {
  return (await snapshot()).posts;
}

export async function getFeaturedPosts(): Promise<Post[]> {
  const { posts } = await snapshot();
  const featured = posts.filter((p) => p.featured);
  if (featured.length > 0) return featured;
  return posts.slice(0, 1);
}

export async function getPostBySlug(slug: string): Promise<Post | undefined> {
  return (await snapshot()).posts.find((p) => p.slug === slug);
}

export async function getCategories(): Promise<Category[]> {
  return (await snapshot()).categories;
}

export async function getTags(): Promise<Tag[]> {
  return (await snapshot()).tags;
}

export async function getSeriesList(): Promise<Series[]> {
  return (await snapshot()).series;
}

export async function getSeriesBySlug(slug: string): Promise<Series | undefined> {
  return (await snapshot()).series.find((s) => s.slug === slug);
}

export async function getTools(): Promise<ToolItem[]> {
  return MOCK_TOOLS;
}

export async function getActivityInfo(): Promise<{
  days: ActivityDay[];
  activeDaysCount: number;
  totalUpdates: number;
}> {
  return generateActivityData();
}

export async function getNavigationPosts(currentPost: Post): Promise<{
  prevPost: Post | null;
  nextPost: Post | null;
}> {
  const { posts } = await snapshot();
  const index = posts.findIndex((p) => p.id === currentPost.id);
  if (index === -1) return { prevPost: null, nextPost: null };

  const nextPost = index > 0 ? posts[index - 1]! : null;
  const prevPost = index < posts.length - 1 ? posts[index + 1]! : null;

  return { prevPost, nextPost };
}

export async function getCategoryBySlug(
  slug: string,
): Promise<Category | undefined> {
  const decoded = decodeURIComponent(slug).toLowerCase();
  return (await snapshot()).categories.find(
    (c) => c.slug.toLowerCase() === decoded || c.name.toLowerCase() === decoded,
  );
}

export async function getPostsByCategory(categoryName: string): Promise<Post[]> {
  const target = categoryName.toLowerCase();
  return (await snapshot()).posts.filter(
    (p) => p.category.toLowerCase() === target,
  );
}

export async function getAllTopics(): Promise<Topic[]> {
  return (await snapshot()).topics;
}

export async function getTopicBySlug(slug: string): Promise<Topic | undefined> {
  const decoded = decodeURIComponent(slug).toLowerCase();
  return (await snapshot()).topics.find(
    (t) => t.slug.toLowerCase() === decoded || t.name.toLowerCase() === decoded,
  );
}

/** 专题下的文章：走 posts_topics M2M 索引，不再借标签名近似匹配。 */
export async function getPostsByTopic(slug: string): Promise<Post[]> {
  const snap = await snapshot();
  const slugs = new Set(snap.postSlugsByTopic.get(slug) ?? []);
  return snap.posts.filter((p) => slugs.has(p.slug));
}

export async function getAllNotes(): Promise<Note[]> {
  return (await snapshot()).notes;
}

export async function getAllProjects(): Promise<Project[]> {
  return MOCK_PROJECTS;
}
