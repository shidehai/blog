import { z } from "zod";

export const contentKindSchema = z.enum([
  "article",
  "tutorial",
  "note",
  "topic",
]);
export const slugSchema = z
  .string()
  .trim()
  .min(1)
  .max(180)
  .regex(
    /^[\p{L}\p{N}]+(?:[-_][\p{L}\p{N}]+)*$/u,
    "地址只能包含文字、数字、短横线或下划线",
  );
const uniqueIds = z
  .array(z.uuid())
  .max(100)
  .refine((ids) => new Set(ids).size === ids.length, "不能重复选择");
export const draftSchema = z.object({
  kind: contentKindSchema,
  title: z.string().trim().max(240),
  slug: z.union([z.literal(""), slugSchema]),
  summary: z.string().max(2000),
  content: z.string().max(2_000_000),
  categoryId: z.uuid().nullable(),
  tagIds: uniqueIds,
  seriesId: z.uuid().nullable(),
  seriesOrder: z.number().int().nonnegative().nullable(),
  topicIds: uniqueIds,
  coverId: z.uuid().nullable(),
  featured: z.boolean(),
  publishedAt: z.iso.datetime({ offset: true }).nullable(),
  extra: z.record(z.string(), z.unknown()).default({}),
});
export type ContentDraft = z.infer<typeof draftSchema>;
export function emptyDraft(
  kind: ContentDraft["kind"] = "article",
): ContentDraft {
  return {
    kind,
    title: "",
    slug: "",
    summary: "",
    content: "",
    categoryId: null,
    tagIds: [],
    seriesId: null,
    seriesOrder: null,
    topicIds: [],
    coverId: null,
    featured: false,
    publishedAt: null,
    extra: {},
  };
}
export const adminContentSchema = z.object({
  id: z.uuid(),
  version: z.number().int(),
  draftRevisionId: z.uuid(),
  publishedRevisionId: z.uuid().nullable(),
  archived: z.boolean(),
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
  draft: draftSchema,
  publishedSlug: z.string().nullable(),
});
export type AdminContent = z.infer<typeof adminContentSchema>;
export const taxonomySchema = z.object({
  id: z.uuid(),
  kind: z.enum(["category", "tag", "series"]),
  name: z.string().trim().min(1).max(120),
  slug: slugSchema,
  description: z.string().max(2000).default(""),
});
export type Taxonomy = z.infer<typeof taxonomySchema>;
const safeLink = z
  .string()
  .max(2000)
  .refine((value) => {
    if (!value) return true;
    if (/[\u0000-\u0020\\]/.test(value)) return false;
    if (value.startsWith("/") && !value.startsWith("//")) return true;
    try {
      const url = new URL(value);
      return (
        ["http:", "https:"].includes(url.protocol) &&
        !url.username &&
        !url.password
      );
    } catch {
      return false;
    }
  }, "请使用完整的 HTTP(S) 链接或站内地址");
export const siteProfileSchema = z.object({
  name: z.string().trim().min(1).max(120),
  handle: z.string().max(120),
  title: z.string().max(240),
  avatar: safeLink,
  bio: z.string().max(4000),
  hitokoto: z.string().max(500),
  location: z.string().max(120),
  socials: z.object({
    github: safeLink,
    about: safeLink,
    email: z.union([
      z.literal(""),
      z
        .string()
        .max(2000)
        .regex(/^mailto:[^\s?<>]+@[^\s?<>]+$/),
    ]),
  }),
});
export type SiteProfile = z.infer<typeof siteProfileSchema>;
export const DEFAULT_PROFILE: SiteProfile = {
  name: "作者",
  handle: "",
  title: "个人知识日志",
  avatar: "",
  bio: "记录学习与思考。",
  hitokoto: "",
  location: "",
  socials: { github: "", about: "", email: "" },
};
export const postSummarySchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  summary: z.string(),
  publishedAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }).optional(),
  category: z.string(),
  tags: z.array(z.string()),
  cover: z.string().optional(),
  featured: z.boolean().optional(),
  series: z
    .object({
      name: z.string(),
      slug: z.string(),
      order: z.number().optional(),
    })
    .optional(),
  readingMinutes: z.number().int().positive(),
  wordCount: z.number().int().nonnegative(),
});
export type PostSummary = z.infer<typeof postSummarySchema>;
export const postSchema = postSummarySchema.extend({ content: z.string() });
export type Post = z.infer<typeof postSchema>;
export const categorySchema = z.object({
  name: z.string(),
  slug: z.string(),
  count: z.number().int(),
});
export type Category = z.infer<typeof categorySchema>;
export type Tag = Category;
export const seriesSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  description: z.string(),
  count: z.number().int(),
  posts: z.array(
    z.object({ title: z.string(), slug: z.string(), publishedAt: z.string() }),
  ),
});
export type Series = z.infer<typeof seriesSchema>;
export const catalogSchema = z.object({
  generation: z.number().int().nonnegative(),
  profile: siteProfileSchema,
  posts: z.array(postSummarySchema),
  categories: z.array(categorySchema),
  tags: z.array(categorySchema),
  series: z.array(seriesSchema),
});
export type PublicCatalog = z.infer<typeof catalogSchema>;
export const publicDetailSchema = z.object({
  generation: z.number().int(),
  canonicalSlug: z.string(),
  post: postSchema,
});
export const mediaSchema = z.object({
  id: z.uuid(),
  filename: z.string(),
  mime: z.string(),
  bytes: z.number().int(),
  width: z.number().int(),
  height: z.number().int(),
  sha256: z.string(),
  publishable: z.boolean(),
  createdAt: z.iso.datetime({ offset: true }),
  references: z.number().int().nonnegative(),
});
export type Media = z.infer<typeof mediaSchema>;
export const publicationSchema = z.object({
  contentId: z.uuid(),
  revisionId: z.uuid(),
  generation: z.number().int(),
  slug: z.string(),
  publishedAt: z.string(),
});
export type Publication = z.infer<typeof publicationSchema>;
export const saveSchema = z.object({
  version: z.number().int().positive(),
  draft: draftSchema,
});
export const publishSchema = z.object({
  version: z.number().int().positive(),
  revisionId: z.uuid(),
  key: z.uuid(),
});
