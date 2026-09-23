import {
  buildSnapshot,
  loadFromDirectus,
  type ContentSnapshot,
} from "./directus";
import { readBuildEnvironment } from "./env";
import { FIXTURE_ROWS } from "./fixture";
import { generateActivityData, MOCK_PROJECTS } from "./mock";
import type {
  ActivityDay,
  Category,
  Post,
  Project,
  Series,
  SiteProfile,
  Tag,
} from "./types";

/**
 * 每个进程构建一次内容快照。fixture 是显式离线默认值；Directus 构建必须
 * 成功读取已发布数据。两条路径共用 buildSnapshot，派生字段只有一份实现。
 */
let cached: Promise<ContentSnapshot> | undefined;

export function snapshot(): Promise<ContentSnapshot> {
  if (!cached) {
    const environment = readBuildEnvironment();
    // 夹具的 cover_image 全为 null，不需要资源前缀，base 传空串。
    cached =
      environment.source === "fixture"
        ? Promise.resolve(buildSnapshot(FIXTURE_ROWS, ""))
        : loadFromDirectus(environment.directus);
  }
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

export async function getSeriesBySlug(
  slug: string,
): Promise<Series | undefined> {
  return (await snapshot()).series.find((s) => s.slug === slug);
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

export async function getPostsByCategory(
  categoryName: string,
): Promise<Post[]> {
  const target = categoryName.toLowerCase();
  return (await snapshot()).posts.filter(
    (p) => p.category.toLowerCase() === target,
  );
}

export async function getAllProjects(): Promise<Project[]> {
  return MOCK_PROJECTS;
}
