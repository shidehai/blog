/** Pure projector for explicitly selected offline development fixtures. */
import { z } from "zod";
import { deriveExcerpt, deriveReadingMinutes } from "./markdown";
import { MOCK_PROFILE } from "./mock";
import type { Category, Post, Series, SiteProfile, Tag } from "./types";
export const rawTaxonomySchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullish(),
});

export const rawPostSchema = z.object({
  id: z.string(),
  kind: z.enum(["article", "tutorial"]),
  status: z.literal("published"),
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

export const rawSettingsSchema = z.object({
  site_name: z.string(),
  author_name: z.string(),
  tagline: z.string().nullable(),
  biography: z.string().nullable(),
  homepage_intro: z.string().nullable(),
  avatar: z.string().nullable(),
});

export const rawSocialLinkSchema = z.object({
  label: z.string(),
  url: z.string(),
  icon: z.string().nullable(),
  // Ordering is fixture metadata rather than part of the public profile.
  sort: z.number().nullish(),
});

/**
 * 样本输入类型由上面的 schema 推导，不手写第二份：
 * 两份并存时改了 interface 而漏改 schema，校验会失效且编译器不报错。
 */
export type RawTaxonomy = z.infer<typeof rawTaxonomySchema>;
export type RawPost = z.infer<typeof rawPostSchema>;
export type RawSettings = z.infer<typeof rawSettingsSchema>;
export type RawSocialLink = z.infer<typeof rawSocialLinkSchema>;

export interface ContentSnapshot {
  posts: Post[];
  categories: Category[];
  tags: Tag[];
  series: Series[];
  profile: SiteProfile;
}

function mapPost(raw: RawPost): Post {
  const tags = (raw.tags ?? [])
    .map((row) => row.tags_id?.name)
    .filter((name): name is string => Boolean(name));
  const cover = raw.cover_image || undefined;

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
    ...(cover ? { cover } : {}),
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

/** 样本计数从 posts 现算，与公开投影保持一致。 */
function countBy(
  posts: Post[],
  pick: (post: Post) => string[],
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const post of posts)
    for (const key of pick(post)) counts.set(key, (counts.get(key) ?? 0) + 1);
  return counts;
}

export function buildSnapshot(rows: {
  posts: RawPost[];
  categories: RawTaxonomy[];
  tags: RawTaxonomy[];
  series: RawTaxonomy[];
  settings: RawSettings;
  socialLinks: RawSocialLink[];
}): ContentSnapshot {
  // 样本书写顺序不能影响展示顺序。
  const byNewest = <T extends { published_at: string }>(a: T, b: T) =>
    Date.parse(b.published_at) - Date.parse(a.published_at);

  const articles = [...rows.posts].sort(byNewest).map(mapPost);

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
      // 补足样本中未提供的展示字段；真实站点资料从 CMS 读取。
      handle: MOCK_PROFILE.handle,
      hitokoto: MOCK_PROFILE.hitokoto,
      location: MOCK_PROFILE.location,
      name: rows.settings.author_name,
      title: rows.settings.tagline ?? "",
      bio: rows.settings.biography ?? rows.settings.homepage_intro ?? "",
      avatar: rows.settings.avatar || MOCK_PROFILE.avatar,
      socials: {
        about: MOCK_PROFILE.socials.about,
        github: socialsByIcon.get("github") ?? MOCK_PROFILE.socials.github,
        email: socialsByIcon.get("email") ?? MOCK_PROFILE.socials.email,
      },
    },
  };
}
