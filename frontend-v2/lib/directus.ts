/**
 * Directus 读取层：拉取已发布内容，并映射为 lib/types.ts 的视图模型。
 *
 * CMS 行是蛇形字段（见 lib/fixture.ts），视图模型是驼峰且反范式的。映射只在
 * 本文件发生一次，页面组件永远只看到视图模型。
 *
 * 无凭据或请求失败时返回 null，由 lib/content.ts 降级到夹具。
 */
import {
  createDirectus,
  readItems,
  readSingleton,
  rest,
  staticToken,
} from "@directus/sdk";
import { z } from "zod";

import { readDirectusCredentials } from "./env";

import { deriveExcerpt, deriveReadingMinutes } from "./markdown";
import { MOCK_PROFILE } from "./mock";
import type {
  Category,
  Note,
  Post,
  Series,
  SiteProfile,
  Tag,
  Topic,
} from "./types";

const PAGE_SIZE = 100;

/**
 * 运行时解码：SDK 的返回类型来自本地 Schema 声明，不是服务端保证，
 * 直接断言等于信任未校验的网络数据。这里从 unknown 解码一次。
 *
 * published_at 在 schema.yaml 里可为空，而它要参与排序（Date.parse），
 * 为空会静默产出 NaN 打乱顺序，所以按非空 ISO 时间校验，让它显式失败。
 */
const rawTaxonomySchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullish(),
});

export const rawPostSchema = z.object({
  id: z.string(),
  kind: z.enum(["article", "tutorial", "note"]),
  status: z.enum(["published", "draft", "archived"]),
  title: z.string(),
  slug: z.string(),
  summary: z.string().nullable(),
  body: z.string(),
  published_at: z.string().datetime({ offset: true }),
  date_updated: z.string().nullable(),
  featured: z.boolean().nullable(),
  cover_image: z.string().nullable(),
  series_order: z.number().nullable(),
  category: rawTaxonomySchema.nullable(),
  series: rawTaxonomySchema.nullable(),
  tags: z.array(z.object({ tags_id: rawTaxonomySchema.nullable() })).nullable(),
  topics: z
    .array(z.object({ topics_id: rawTaxonomySchema.nullable() }))
    .nullable(),
});

const rawSettingsSchema = z.object({
  site_name: z.string(),
  author_name: z.string(),
  tagline: z.string().nullable(),
  biography: z.string().nullable(),
  homepage_intro: z.string().nullable(),
  avatar: z.string().nullable(),
});

const rawSocialLinkSchema = z.object({
  label: z.string(),
  url: z.string(),
  icon: z.string().nullable(),
  sort: z.number().nullable(),
});

/**
 * CMS 原始行类型由上面的 schema 推导，不手写第二份：
 * 两份并存时改了 interface 而漏改 schema，校验会失效且编译器不报错。
 */
type RawTaxonomy = z.infer<typeof rawTaxonomySchema>;
type RawPost = z.infer<typeof rawPostSchema>;
type RawSettings = z.infer<typeof rawSettingsSchema>;
type RawSocialLink = z.infer<typeof rawSocialLinkSchema>;

interface Schema {
  posts: RawPost[];
  categories: RawTaxonomy[];
  tags: RawTaxonomy[];
  series: RawTaxonomy[];
  topics: RawTaxonomy[];
  site_settings: RawSettings;
  social_links: RawSocialLink[];
}

const TAXONOMY_LEAF = ["id", "name", "slug"] as const;

const POST_FIELDS = [
  "id",
  "kind",
  "title",
  "slug",
  "summary",
  "body",
  "published_at",
  "date_updated",
  "featured",
  "cover_image",
  "series_order",
  { category: TAXONOMY_LEAF },
  { series: TAXONOMY_LEAF },
  { tags: [{ tags_id: TAXONOMY_LEAF }] },
  { topics: [{ topics_id: TAXONOMY_LEAF }] },
] as const;

const TAXONOMY_FIELDS = ["id", "name", "slug", "description"] as const;

/**
 * 站点内容全量快照，供 content.ts 派生各视图。
 *
 * profile 只含 CMS 有的字段；handle / hitokoto / location / socials.about
 * 在 site_settings 里没有对应列，由 content.ts 用 mock 兜底。
 */
export interface ContentSnapshot {
  posts: Post[];
  notes: Note[];
  categories: Category[];
  tags: Tag[];
  series: Series[];
  topics: Topic[];
  /** 专题 slug -> 该专题下文章 slug，供 getPostsByTopic 走真实 M2M 关系。 */
  postSlugsByTopic: Map<string, string[]>;
  profile: SiteProfile;
}

/** 拉完所有分页；Directus 单次上限 100。 */
async function readAll<T>(
  fetchPage: (page: number) => Promise<T[]>,
): Promise<T[]> {
  const all: T[] = [];
  for (let page = 1; ; page += 1) {
    const batch = await fetchPage(page);
    all.push(...batch);
    if (batch.length < PAGE_SIZE) return all;
  }
}

function assetUrl(base: string, id: string | null): string | undefined {
  return id ? `${base}/assets/${id}` : undefined;
}

function mapPost(raw: RawPost, base: string): Post {
  const tags = (raw.tags ?? [])
    .map((row) => row.tags_id?.name)
    .filter((name): name is string => Boolean(name));

  return {
    id: raw.id,
    slug: raw.slug,
    title: raw.title,
    summary: raw.summary || deriveExcerpt(raw.body),
    content: raw.body,
    publishedAt: raw.published_at,
    ...(raw.date_updated ? { updatedAt: raw.date_updated } : {}),
    category: raw.category?.name ?? "未分类",
    tags,
    ...(assetUrl(base, raw.cover_image)
      ? { cover: assetUrl(base, raw.cover_image) }
      : {}),
    ...(raw.featured ? { featured: true } : {}),
    ...(raw.series
      ? {
          series: {
            name: raw.series.name,
            slug: raw.series.slug,
            ...(raw.series_order === null ? {} : { order: raw.series_order }),
          },
        }
      : {}),
    readingMinutes: deriveReadingMinutes(raw.body),
    wordCount: raw.body.length,
  };
}

/** 计数从 posts 现算，避免 CMS 侧冗余计数字段与实际不同步。 */
function countBy(posts: Post[], pick: (post: Post) => string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const post of posts)
    for (const key of pick(post))
      counts.set(key, (counts.get(key) ?? 0) + 1);
  return counts;
}

export function buildSnapshot(
  rows: {
    posts: RawPost[];
    categories: RawTaxonomy[];
    tags: RawTaxonomy[];
    series: RawTaxonomy[];
    topics: RawTaxonomy[];
    settings: RawSettings;
    socialLinks: RawSocialLink[];
  },
  base: string,
): ContentSnapshot {
  // 发布时间倒序在此统一保证：Directus 查询已排序，夹具路径靠这里兜住。
  const byNewest = <T extends { published_at: string }>(a: T, b: T) =>
    Date.parse(b.published_at) - Date.parse(a.published_at);

  const articleRows = rows.posts
    .filter((raw) => raw.kind !== "note")
    .sort(byNewest);
  const articles = articleRows.map((raw) => mapPost(raw, base));

  const notes: Note[] = rows.posts
    .filter((raw) => raw.kind === "note")
    .sort(byNewest)
    .map((raw) => ({
      id: raw.id,
      title: raw.title,
      content: raw.body,
      category: raw.category?.name ?? "随记",
      tags: (raw.tags ?? [])
        .map((row) => row.tags_id?.name)
        .filter((name): name is string => Boolean(name)),
      publishedAt: raw.published_at,
    }));

  const byCategory = countBy(articles, (post) => [post.category]);
  const byTag = countBy(articles, (post) => post.tags);

  // 主题是独立 M2M 关系，Post 视图类型不带它，所以从原始行建索引。
  const postSlugsByTopic = new Map<string, string[]>();
  for (const raw of articleRows)
    for (const row of raw.topics ?? []) {
      const slug = row.topics_id?.slug;
      if (!slug) continue;
      const list = postSlugsByTopic.get(slug);
      if (list) list.push(raw.slug);
      else postSlugsByTopic.set(slug, [raw.slug]);
    }

  const socialsByIcon = new Map(
    rows.socialLinks.map((link) => [link.icon ?? link.label.toLowerCase(), link.url]),
  );

  return {
    posts: articles,
    notes,
    categories: rows.categories.map((row) => ({
      name: row.name,
      slug: row.slug,
      count: byCategory.get(row.name) ?? 0,
    })),
    tags: rows.tags.map((row) => ({
      name: row.name,
      slug: row.slug,
      count: byTag.get(row.name) ?? 0,
    })),
    series: rows.series.map((row) => {
      const members = articles
        .filter((post) => post.series?.slug === row.slug)
        .sort((a, b) => (a.series?.order ?? 0) - (b.series?.order ?? 0));
      return {
        id: row.id,
        name: row.name,
        slug: row.slug,
        description: row.description ?? "",
        count: members.length,
        posts: members.map((post) => ({
          title: post.title,
          slug: post.slug,
          publishedAt: post.publishedAt,
        })),
      };
    }),
    topics: rows.topics.map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description ?? "",
      count: postSlugsByTopic.get(row.slug)?.length ?? 0,
    })),
    postSlugsByTopic,
    profile: {
      // handle / hitokoto / location 与 socials.about 在 site_settings 里没有对应列，
      // 沿用 mock 的值，等 CMS 补字段后再接过来。
      handle: MOCK_PROFILE.handle,
      hitokoto: MOCK_PROFILE.hitokoto,
      location: MOCK_PROFILE.location,
      name: rows.settings.author_name,
      title: rows.settings.tagline ?? "",
      bio: rows.settings.biography ?? rows.settings.homepage_intro ?? "",
      avatar: assetUrl(base, rows.settings.avatar) ?? "/avatar.png",
      socials: {
        about: MOCK_PROFILE.socials.about,
        github: socialsByIcon.get("github") ?? MOCK_PROFILE.socials.github,
        email: socialsByIcon.get("email") ?? MOCK_PROFILE.socials.email,
        rss: socialsByIcon.get("rss") ?? MOCK_PROFILE.socials.rss,
      },
    },
  };
}

/**
 * 从 Directus 读取全量已发布内容。缺凭据或任意请求失败时返回 null，
 * 由调用方降级到夹具。
 */
export async function loadFromDirectus(): Promise<ContentSnapshot | null> {
  const credentials = readDirectusCredentials();
  if (!credentials) return null;
  const { url, token } = credentials;

  const client = createDirectus<Schema>(url)
    .with(staticToken(token))
    .with(rest());

  const taxonomy = (collection: "categories" | "tags" | "series" | "topics") =>
    readAll((page) =>
      client.request(
        readItems(collection, {
          fields: [...TAXONOMY_FIELDS],
          limit: PAGE_SIZE,
          page,
          sort: ["slug"],
        }),
      ),
    ).then((rows) => z.array(rawTaxonomySchema).parse(rows));

  try {
    const [posts, categories, tags, series, topics, settings, socialLinks] =
      await Promise.all([
        readAll((page) =>
          client.request(
            readItems("posts", {
              // SDK 无法为中间表（posts_tags / posts_topics）推导 M2M 展开，
              // 因为它们的元素类型不是 Schema 注册的集合。返回值仍由 RawPost 约束。
              fields: [...POST_FIELDS] as unknown as ["*"],
              filter: { status: { _eq: "published" } },
              limit: PAGE_SIZE,
              page,
              sort: ["-published_at", "slug"],
            }),
          ),
        ).then((rows) => z.array(rawPostSchema).parse(rows)),
        taxonomy("categories"),
        taxonomy("tags"),
        taxonomy("series"),
        taxonomy("topics"),
        client.request(readSingleton("site_settings", { fields: ["*"] })),
        readAll((page) =>
          client.request(
            readItems("social_links", {
              fields: ["label", "url", "icon"],
              limit: PAGE_SIZE,
              page,
              sort: ["sort"],
            }),
          ),
        ).then((rows) => z.array(rawSocialLinkSchema).parse(rows)),
      ]);

    return buildSnapshot(
      {
        posts,
        categories,
        tags,
        series,
        topics,
        settings: rawSettingsSchema.parse(settings),
        socialLinks,
      },
      url,
    );
  } catch (error) {
    console.warn(
      "[directus] 读取失败，降级到夹具：",
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}
