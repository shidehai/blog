/**
 * Directus 读取层：拉取已发布内容，并映射为 lib/types.ts 的视图模型。
 *
 * CMS 行是蛇形字段（见 lib/fixture.ts），视图模型是驼峰且反范式的。映射只在
 * 本文件发生一次，页面组件永远只看到视图模型。
 *
 * fixture/directus 的来源选择由 lib/content.ts 与 lib/env.ts 在构建期决定。
 */
import {
  createDirectus,
  readItems,
  readSingleton,
  rest,
  staticToken,
} from "@directus/sdk";
import { z } from "zod";

import type { DirectusCredentials } from "./env";

import { deriveExcerpt, deriveReadingMinutes } from "./markdown";
import { MOCK_PROFILE } from "./mock";
import type { Category, Post, Series, SiteProfile, Tag } from "./types";

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
  kind: z.enum(["article", "tutorial"]),
  status: z.enum(["published", "draft", "archived"]),
  title: z.string(),
  slug: z.string(),
  summary: z.string().nullable(),
  body: z.string().min(1),
  published_at: z.iso.datetime({ offset: true }),
  date_updated: z.string().nullable(),
  featured: z.boolean().nullable(),
  cover_image: z.string().nullable(),
  series_order: z.number().nullable(),
  category: rawTaxonomySchema.nullable(),
  series: rawTaxonomySchema.nullable(),
  tags: z.array(z.object({ tags_id: rawTaxonomySchema.nullable() })).nullable(),
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
  // The field is needed for Directus ordering but is not selected into the
  // public profile payload, so an omitted value is valid at the decoder edge.
  sort: z.number().nullish(),
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
  site_settings: RawSettings;
  social_links: RawSocialLink[];
}

const TAXONOMY_LEAF = ["id", "name", "slug"] as const;

const POST_FIELDS = [
  "id",
  "status",
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
] as const;

const TAXONOMY_FIELDS = ["id", "name", "slug", "description"] as const;
const SETTINGS_FIELDS = [
  "site_name",
  "author_name",
  "tagline",
  "biography",
  "homepage_intro",
  "avatar",
] as const;

/**
 * 站点内容全量快照，供 content.ts 派生各视图。
 *
 * profile 只含 CMS 有的字段；handle / hitokoto / location / socials.about
 * 在 site_settings 里没有对应列，由 content.ts 用 mock 兜底。
 */
export interface ContentSnapshot {
  posts: Post[];
  categories: Category[];
  tags: Tag[];
  series: Series[];
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
function countBy(
  posts: Post[],
  pick: (post: Post) => string[],
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const post of posts)
    for (const key of pick(post)) counts.set(key, (counts.get(key) ?? 0) + 1);
  return counts;
}

export function buildSnapshot(
  rows: {
    posts: RawPost[];
    categories: RawTaxonomy[];
    tags: RawTaxonomy[];
    series: RawTaxonomy[];
    settings: RawSettings;
    socialLinks: RawSocialLink[];
  },
  base: string,
): ContentSnapshot {
  // 发布时间倒序在此统一保证：Directus 查询已排序，夹具路径靠这里兜住。
  const byNewest = <T extends { published_at: string }>(a: T, b: T) =>
    Date.parse(b.published_at) - Date.parse(a.published_at);

  const articles = rows.posts.sort(byNewest).map((raw) => mapPost(raw, base));

  const byCategory = countBy(articles, (post) => [post.category]);
  const byTag = countBy(articles, (post) => post.tags);

  const socialsByIcon = new Map(
    rows.socialLinks.map((link) => [
      link.icon ?? link.label.toLowerCase(),
      link.url,
    ]),
  );

  return {
    posts: articles,
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
    profile: {
      // handle / hitokoto / location 与 socials.about 在 site_settings 里没有对应列，
      // 沿用 mock 的值，等 CMS 补字段后再接过来。
      handle: MOCK_PROFILE.handle,
      hitokoto: MOCK_PROFILE.hitokoto,
      location: MOCK_PROFILE.location,
      name: rows.settings.author_name,
      title: rows.settings.tagline ?? "",
      bio: rows.settings.biography ?? rows.settings.homepage_intro ?? "",
      avatar: rows.settings.avatar?.startsWith("/")
        ? rows.settings.avatar
        : (assetUrl(base, rows.settings.avatar) ?? MOCK_PROFILE.avatar),
      socials: {
        about: MOCK_PROFILE.socials.about,
        github: socialsByIcon.get("github") ?? MOCK_PROFILE.socials.github,
        email: socialsByIcon.get("email") ?? MOCK_PROFILE.socials.email,
      },
    },
  };
}

/**
 * 从 Directus 读取全量已发布文章。调用方已确认这是 Directus 构建；
 * 任意网络或解码失败都必须让构建中止，不能改用夹具。
 */
export async function loadFromDirectus(
  credentials: DirectusCredentials,
): Promise<ContentSnapshot> {
  const { url, token } = credentials;

  const client = createDirectus<Schema>(url)
    .with(staticToken(token))
    .with(rest());

  const taxonomy = (collection: "categories" | "tags" | "series") =>
    readAll((page) =>
      client.request(
        readItems(collection, {
          fields: [
            ...(collection === "tags" ? TAXONOMY_LEAF : TAXONOMY_FIELDS),
          ],
          limit: PAGE_SIZE,
          page,
          sort: ["slug"],
        }),
      ),
    ).then((rows) => z.array(rawTaxonomySchema).parse(rows));

  try {
    const [posts, categories, tags, series, settings, socialLinks] =
      await Promise.all([
        readAll((page) =>
          client.request(
            readItems("posts", {
              // SDK 无法为中间表 posts_tags 推导 M2M 展开，
              // 因为它们的元素类型不是 Schema 注册的集合。返回值仍由 RawPost 约束。
              fields: [...POST_FIELDS] as unknown as ["*"],
              filter: {
                _and: [
                  { status: { _eq: "published" } },
                  { kind: { _in: ["article", "tutorial"] } },
                ],
              },
              limit: PAGE_SIZE,
              page,
              sort: ["-published_at", "slug"],
            }),
          ),
        ).then((rows) => z.array(rawPostSchema).parse(rows)),
        taxonomy("categories"),
        taxonomy("tags"),
        taxonomy("series"),
        client.request(
          readSingleton("site_settings", { fields: SETTINGS_FIELDS }),
        ),
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
        settings: rawSettingsSchema.parse(settings),
        socialLinks,
      },
      url,
    );
  } catch {
    throw new Error(
      "[directus] Failed to load the published build snapshot from Directus",
    );
  }
}
