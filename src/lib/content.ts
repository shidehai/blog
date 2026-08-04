import {
  createDirectus,
  readFiles,
  readItems,
  readSingleton,
  rest,
  staticToken,
} from "@directus/sdk";
import { z } from "zod";

import { IDS } from "../../directus/constants.mjs";
import { readBuildEnv } from "../../scripts/env.mjs";
import {
  deriveExcerpt,
  deriveReadingMinutes,
  extractDirectusMediaIds,
} from "./markdown.ts";

const PAGE_SIZE = 100;
const MAX_FILE_SIZE = 20 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set([
  "image/avif",
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/svg+xml",
  "image/webp",
]);

export const PUBLISHABLE_ASSETS_FOLDER_ID = IDS.folders.publishable;

const POST_FIELDS = [
  "id",
  "status",
  "kind",
  "title",
  "slug",
  "published_at",
  "summary",
  "body",
  "featured",
  "cover_image",
  "cover_alt",
  "cover_decorative",
  "seo_title",
  "seo_description",
  "date_updated",
] as const;
const TOPIC_FIELDS = ["id", "name", "slug", "description"] as const;
const POST_TOPIC_FIELDS = ["id", "posts_id", "topics_id"] as const;
const SETTINGS_FIELDS = [
  "id",
  "site_name",
  "author_name",
  "tagline",
  "homepage_intro",
  "biography",
  "default_seo_description",
  "avatar",
  "default_og_image",
  "footer_text",
  "locale",
  "timezone",
  "date_updated",
] as const;
const SOCIAL_LINK_FIELDS = [
  "id",
  "site_settings_id",
  "label",
  "url",
  "icon",
  "sort",
] as const;
const FILE_FIELDS = [
  "id",
  "storage",
  "filename_disk",
  "filename_download",
  "title",
  "type",
  "folder",
  "filesize",
  "width",
  "height",
  "duration",
  "description",
  "metadata",
  "focal_point_x",
  "focal_point_y",
  "modified_on",
] as const;

const requiredText = z.string().trim().min(1);
const optionalText = requiredText.nullable();
const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const timestamp = z
  .string()
  .refine(
    (value) =>
      /T.+(?:Z|[+-]\d{2}:\d{2})$/.test(value) &&
      !Number.isNaN(Date.parse(value)),
    "must be an ISO timestamp with a UTC offset",
  )
  .transform((value) => new Date(value).toISOString());
const nullableTimestamp = timestamp.nullable();
const httpOrMailUrl = z.url().refine((value) => {
  const protocol = new URL(value).protocol;
  return (
    protocol === "http:" || protocol === "https:" || protocol === "mailto:"
  );
}, "must use http, https, or mailto");
const timezone = requiredText.refine((value) => {
  try {
    new Intl.DateTimeFormat("en", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}, "must be a valid IANA timezone");
const fileSize = z
  .union([z.number().int(), z.string().regex(/^\d+$/)])
  .transform(Number)
  .pipe(z.number().int().nonnegative().max(MAX_FILE_SIZE));

const rawPostSchema = z
  .object({
    body: requiredText,
    cover_alt: optionalText,
    cover_decorative: z.boolean(),
    cover_image: z.uuid().nullable(),
    date_updated: nullableTimestamp,
    featured: z.boolean(),
    id: z.uuid(),
    kind: z.enum(["article", "tutorial", "note"]),
    published_at: timestamp,
    seo_description: optionalText,
    seo_title: optionalText,
    slug,
    status: z.enum(["published", "archived"]),
    summary: optionalText,
    title: requiredText,
  })
  .strict();

const rawTopicSchema = z
  .object({
    description: optionalText,
    id: z.uuid(),
    name: requiredText,
    slug,
  })
  .strict();

const rawPostTopicSchema = z
  .object({
    id: z.uuid(),
    posts_id: z.uuid(),
    topics_id: z.uuid(),
  })
  .strict();

const rawSettingsSchema = z
  .object({
    author_name: requiredText,
    avatar: z.uuid().nullable(),
    biography: optionalText,
    date_updated: nullableTimestamp,
    default_og_image: z.uuid().nullable(),
    default_seo_description: requiredText,
    footer_text: optionalText,
    homepage_intro: optionalText,
    id: z.uuid(),
    locale: z.literal("zh-CN"),
    site_name: requiredText,
    tagline: optionalText,
    timezone,
  })
  .strict();

const rawSocialLinkSchema = z
  .object({
    icon: z.enum([
      "github",
      "rss",
      "email",
      "website",
      "mastodon",
      "x",
      "linkedin",
    ]),
    id: z.uuid(),
    label: requiredText,
    site_settings_id: z.uuid(),
    sort: z.number().int(),
    url: httpOrMailUrl,
  })
  .strict();

const rawFileSchema = z
  .object({
    description: optionalText,
    duration: z.number().nonnegative().nullable(),
    filename_disk: requiredText,
    filename_download: requiredText,
    filesize: fileSize,
    focal_point_x: z.number().int().nullable(),
    focal_point_y: z.number().int().nullable(),
    folder: z.uuid().nullable(),
    height: z.number().int().positive().nullable(),
    id: z.uuid(),
    metadata: z.record(z.string(), z.unknown()).nullable(),
    modified_on: timestamp,
    storage: requiredText,
    title: requiredText,
    type: requiredText.refine(
      (value) => ALLOWED_IMAGE_TYPES.has(value),
      "must be a supported image MIME type",
    ),
    width: z.number().int().positive().nullable(),
  })
  .strict();

const rawSnapshotBaseSchema = z.object({
  postTopics: z.array(rawPostTopicSchema),
  posts: z.array(rawPostSchema),
  settings: rawSettingsSchema,
  socialLinks: z.array(rawSocialLinkSchema),
  topics: z.array(rawTopicSchema),
});

type RawPost = z.output<typeof rawPostSchema>;
type RawTopic = z.output<typeof rawTopicSchema>;
type RawPostTopic = z.output<typeof rawPostTopicSchema>;
type RawSettings = z.output<typeof rawSettingsSchema>;
type RawSocialLink = z.output<typeof rawSocialLinkSchema>;
type RawFile = z.output<typeof rawFileSchema>;
type RawSnapshotBase = z.output<typeof rawSnapshotBaseSchema>;

interface DirectusSchema {
  posts: RawPost[];
  posts_topics: RawPostTopic[];
  site_settings: RawSettings;
  social_links: RawSocialLink[];
  topics: RawTopic[];
}

function addDuplicateIssues<T>(
  items: readonly T[],
  key: (item: T) => string,
  path: string,
  field: string,
  context: z.RefinementCtx,
): void {
  const firstIndex = new Map<string, number>();
  items.forEach((item, index) => {
    const value = key(item);
    const existing = firstIndex.get(value);
    if (existing === undefined) {
      firstIndex.set(value, index);
      return;
    }
    context.addIssue({
      code: "custom",
      message: `duplicates ${path}[${existing}].${field}`,
      path: [path, index, field],
    });
  });
}

function referencedFileIds(data: RawSnapshotBase, context?: z.RefinementCtx) {
  const ids = new Set<string>();
  if (data.settings.avatar) ids.add(data.settings.avatar);
  if (data.settings.default_og_image) ids.add(data.settings.default_og_image);

  data.posts.forEach((post, index) => {
    if (post.cover_image) ids.add(post.cover_image);
    try {
      for (const id of extractDirectusMediaIds(
        post.body,
        `post ${post.id} body`,
      )) {
        ids.add(id);
      }
    } catch (error) {
      if (!context) throw error;
      context.addIssue({
        code: "custom",
        message:
          error instanceof Error ? error.message : "contains invalid media",
        path: ["posts", index, "body"],
      });
    }
  });
  return ids;
}

function validateSnapshot(
  data: RawSnapshotBase & { files: RawFile[] },
  context: z.RefinementCtx,
): void {
  addDuplicateIssues(data.posts, (post) => post.id, "posts", "id", context);
  addDuplicateIssues(data.posts, (post) => post.slug, "posts", "slug", context);
  addDuplicateIssues(data.topics, (topic) => topic.id, "topics", "id", context);
  addDuplicateIssues(
    data.topics,
    (topic) => topic.slug,
    "topics",
    "slug",
    context,
  );
  addDuplicateIssues(
    data.postTopics,
    (relation) => relation.id,
    "postTopics",
    "id",
    context,
  );
  addDuplicateIssues(
    data.postTopics,
    (relation) => `${relation.posts_id}:${relation.topics_id}`,
    "postTopics",
    "topics_id",
    context,
  );
  addDuplicateIssues(
    data.socialLinks,
    (link) => link.id,
    "socialLinks",
    "id",
    context,
  );
  addDuplicateIssues(data.files, (file) => file.id, "files", "id", context);

  const postIds = new Set(data.posts.map((post) => post.id));
  const topicIds = new Set(data.topics.map((topic) => topic.id));
  const references = referencedFileIds(data, context);
  const fileIds = new Set(data.files.map((file) => file.id));

  data.posts.forEach((post, index) => {
    if (post.status !== "published") {
      context.addIssue({
        code: "custom",
        message: `post ${post.id} is not published`,
        path: ["posts", index, "status"],
      });
    }
    if (post.kind !== "note" && !post.summary) {
      context.addIssue({
        code: "custom",
        message: `post ${post.id} requires a summary`,
        path: ["posts", index, "summary"],
      });
    }
    if (post.cover_image && !post.cover_decorative && !post.cover_alt) {
      context.addIssue({
        code: "custom",
        message: `post ${post.id} requires cover alternative text`,
        path: ["posts", index, "cover_alt"],
      });
    }
  });

  data.postTopics.forEach((relation, index) => {
    if (!postIds.has(relation.posts_id)) {
      context.addIssue({
        code: "custom",
        message: `references unknown published post ${relation.posts_id}`,
        path: ["postTopics", index, "posts_id"],
      });
    }
    if (!topicIds.has(relation.topics_id)) {
      context.addIssue({
        code: "custom",
        message: `references unknown topic ${relation.topics_id}`,
        path: ["postTopics", index, "topics_id"],
      });
    }
  });

  data.socialLinks.forEach((link, index) => {
    if (link.site_settings_id !== data.settings.id) {
      context.addIssue({
        code: "custom",
        message: `references unknown site settings ${link.site_settings_id}`,
        path: ["socialLinks", index, "site_settings_id"],
      });
    }
  });

  data.files.forEach((file, index) => {
    if (!references.has(file.id)) {
      context.addIssue({
        code: "custom",
        message: `file ${file.id} was not referenced by this snapshot`,
        path: ["files", index, "id"],
      });
    }
    if (file.folder !== PUBLISHABLE_ASSETS_FOLDER_ID) {
      context.addIssue({
        code: "custom",
        message: `file ${file.id} is not in publishable-assets`,
        path: ["files", index, "folder"],
      });
    }
  });

  for (const id of references) {
    if (!fileIds.has(id)) {
      context.addIssue({
        code: "custom",
        message: `referenced publishable file ${id} is missing`,
        path: ["files"],
      });
    }
  }
}

export const directusSnapshotSchema = rawSnapshotBaseSchema
  .extend({ files: z.array(rawFileSchema) })
  .strict()
  .superRefine(validateSnapshot);

export interface MediaFile {
  description: string | null;
  filename: string;
  filesize: number;
  height: number | null;
  id: string;
  mimeType: string;
  modifiedAt: string;
  title: string;
  width: number | null;
}

export interface Topic {
  description: string | null;
  id: string;
  name: string;
  slug: string;
}

export interface SocialLink {
  icon: RawSocialLink["icon"];
  id: string;
  label: string;
  sort: number;
  url: string;
}

export interface SiteSettings {
  authorName: string;
  avatar: MediaFile | null;
  biography: string | null;
  defaultOgImage: MediaFile | null;
  defaultSeoDescription: string;
  footerText: string | null;
  homepageIntro: string | null;
  id: string;
  locale: "zh-CN";
  siteName: string;
  socialLinks: readonly SocialLink[];
  tagline: string | null;
  timezone: string;
  updatedAt: string | null;
}

export interface Post {
  body: string;
  cover: MediaFile | null;
  coverAlt: string | null;
  coverDecorative: boolean;
  featured: boolean;
  id: string;
  kind: RawPost["kind"];
  publishedAt: string;
  readingMinutes: number;
  route: string;
  seoDescription: string | null;
  seoTitle: string | null;
  slug: string;
  status: "published";
  summary: string;
  title: string;
  topics: readonly Topic[];
  updatedAt: string | null;
}

export interface PublishedSnapshot {
  files: readonly MediaFile[];
  posts: readonly Post[];
  settings: SiteSettings;
  topics: readonly Topic[];
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function mediaFile(file: RawFile): MediaFile {
  return {
    description: file.description,
    filename: file.filename_download,
    filesize: file.filesize,
    height: file.height,
    id: file.id,
    mimeType: file.type,
    modifiedAt: file.modified_on,
    title: file.title,
    width: file.width,
  };
}

export function postRoute(kind: Post["kind"], postSlug: string): string {
  return kind === "note" ? `/notes/${postSlug}/` : `/writing/${postSlug}/`;
}

function formatSchemaError(error: z.ZodError): Error {
  const details = error.issues
    .map((issue) => `${issue.path.join(".") || "snapshot"}: ${issue.message}`)
    .join("; ");
  return new Error(`Invalid Directus content: ${details}`);
}

export function parsePublishedSnapshot(input: unknown): PublishedSnapshot {
  const result = directusSnapshotSchema.safeParse(input);
  if (!result.success) throw formatSchemaError(result.error);
  const raw = result.data;

  const files = raw.files
    .map(mediaFile)
    .sort((a, b) => compareStrings(a.id, b.id));
  const filesById = new Map(files.map((file) => [file.id, file]));
  const topics = raw.topics
    .map<Topic>((topic) => ({
      description: topic.description,
      id: topic.id,
      name: topic.name,
      slug: topic.slug,
    }))
    .sort((a, b) => compareStrings(a.slug, b.slug));
  const topicsById = new Map(topics.map((topic) => [topic.id, topic]));
  const topicIdsByPost = new Map<string, string[]>();
  for (const relation of raw.postTopics) {
    const ids = topicIdsByPost.get(relation.posts_id) ?? [];
    ids.push(relation.topics_id);
    topicIdsByPost.set(relation.posts_id, ids);
  }

  const posts = raw.posts
    .map<Post>((post) => {
      const postTopics = (topicIdsByPost.get(post.id) ?? [])
        .map((id) => topicsById.get(id))
        .filter((topic): topic is Topic => topic !== undefined)
        .sort((a, b) => compareStrings(a.slug, b.slug));
      return {
        body: post.body,
        cover: post.cover_image
          ? (filesById.get(post.cover_image) ?? null)
          : null,
        coverAlt: post.cover_alt,
        coverDecorative: post.cover_decorative,
        featured: post.featured,
        id: post.id,
        kind: post.kind,
        publishedAt: post.published_at,
        readingMinutes: deriveReadingMinutes(post.body),
        route: postRoute(post.kind, post.slug),
        seoDescription: post.seo_description,
        seoTitle: post.seo_title,
        slug: post.slug,
        status: "published",
        summary: (post.summary ?? deriveExcerpt(post.body)) || post.title,
        title: post.title,
        topics: postTopics,
        updatedAt: post.date_updated,
      };
    })
    .sort(
      (a, b) =>
        b.publishedAt.localeCompare(a.publishedAt) ||
        compareStrings(a.slug, b.slug),
    );

  const socialLinks = raw.socialLinks
    .map<SocialLink>((link) => ({
      icon: link.icon,
      id: link.id,
      label: link.label,
      sort: link.sort,
      url: link.url,
    }))
    .sort((a, b) => a.sort - b.sort || compareStrings(a.id, b.id));
  const settings: SiteSettings = {
    authorName: raw.settings.author_name,
    avatar: raw.settings.avatar
      ? (filesById.get(raw.settings.avatar) ?? null)
      : null,
    biography: raw.settings.biography,
    defaultOgImage: raw.settings.default_og_image
      ? (filesById.get(raw.settings.default_og_image) ?? null)
      : null,
    defaultSeoDescription: raw.settings.default_seo_description,
    footerText: raw.settings.footer_text,
    homepageIntro: raw.settings.homepage_intro,
    id: raw.settings.id,
    locale: raw.settings.locale,
    siteName: raw.settings.site_name,
    socialLinks,
    tagline: raw.settings.tagline,
    timezone: raw.settings.timezone,
    updatedAt: raw.settings.date_updated,
  };

  const snapshot = {
    files,
    posts,
    settings,
    topics,
  } satisfies PublishedSnapshot;
  assertPublishedSnapshot(snapshot);
  return snapshot;
}

export function assertPublishedSnapshot(snapshot: PublishedSnapshot): void {
  const routes = new Set<string>();
  for (const post of snapshot.posts) {
    if (post.status !== "published") {
      throw new Error(`Post ${post.id} is not published`);
    }
    if (routes.has(post.route)) {
      throw new Error(`Duplicate public route ${post.route}`);
    }
    routes.add(post.route);
  }
}

export function formatContentDate(
  utcTimestamp: string,
  timeZone: string,
  locale = "zh-CN",
): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "long",
    timeZone,
  }).format(new Date(utcTimestamp));
}

export function deriveRelatedPosts(
  post: Post,
  posts: readonly Post[],
  limit = 3,
): readonly Post[] {
  const topicIds = new Set(post.topics.map((topic) => topic.id));
  return posts
    .filter((candidate) => candidate.id !== post.id)
    .map((candidate) => ({
      candidate,
      score:
        candidate.topics.filter((topic) => topicIds.has(topic.id)).length * 10 +
        Number(candidate.kind === post.kind),
    }))
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.candidate.publishedAt.localeCompare(a.candidate.publishedAt) ||
        compareStrings(a.candidate.slug, b.candidate.slug),
    )
    .slice(0, limit)
    .map(({ candidate }) => candidate);
}

async function readAll(
  page: (pageNumber: number) => Promise<readonly unknown[]>,
): Promise<unknown[]> {
  const records: unknown[] = [];
  for (let pageNumber = 1; ; pageNumber += 1) {
    const batch = await page(pageNumber);
    records.push(...batch);
    if (batch.length < PAGE_SIZE) return records;
  }
}

export interface DirectusContentSource {
  fetch?: typeof fetch;
  source: "directus";
  token: string;
  url: string;
}

export interface FixtureContentSource {
  source: "fixture";
}

export type ContentSource = DirectusContentSource | FixtureContentSource;

async function loadDirectusInput(
  options: DirectusContentSource,
): Promise<unknown> {
  const client = createDirectus<DirectusSchema>(
    options.url,
    options.fetch ? { globals: { fetch: options.fetch } } : undefined,
  )
    .with(staticToken(options.token))
    .with(rest());

  try {
    const [posts, topics, postTopics, settings, socialLinks] =
      await Promise.all([
        readAll((page) =>
          client.request(
            readItems("posts", {
              fields: [...POST_FIELDS],
              filter: { status: { _eq: "published" } },
              limit: PAGE_SIZE,
              page,
              sort: ["-published_at", "slug", "id"],
            }),
          ),
        ),
        readAll((page) =>
          client.request(
            readItems("topics", {
              fields: [...TOPIC_FIELDS],
              limit: PAGE_SIZE,
              page,
              sort: ["slug", "id"],
            }),
          ),
        ),
        readAll((page) =>
          client.request(
            readItems("posts_topics", {
              fields: [...POST_TOPIC_FIELDS],
              limit: PAGE_SIZE,
              page,
              sort: ["id"],
            }),
          ),
        ),
        client.request(
          readSingleton("site_settings", { fields: [...SETTINGS_FIELDS] }),
        ),
        readAll((page) =>
          client.request(
            readItems("social_links", {
              fields: [...SOCIAL_LINK_FIELDS],
              limit: PAGE_SIZE,
              page,
              sort: ["sort", "id"],
            }),
          ),
        ),
      ]);

    const baseResult = rawSnapshotBaseSchema.safeParse({
      postTopics,
      posts,
      settings,
      socialLinks,
      topics,
    });
    if (!baseResult.success) throw formatSchemaError(baseResult.error);
    const fileIds = [...referencedFileIds(baseResult.data)].sort();
    const files = fileIds.length
      ? await readAll((page) =>
          client.request(
            readFiles({
              fields: [...FILE_FIELDS],
              filter: { id: { _in: fileIds } },
              limit: PAGE_SIZE,
              page,
              sort: ["id"],
            }),
          ),
        )
      : [];

    return { ...baseResult.data, files };
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.startsWith("Invalid Directus content:")
    ) {
      throw error;
    }
    throw new Error(
      `Could not load published Directus snapshot: ${error instanceof Error ? error.message : "request failed"}`,
      { cause: error },
    );
  }
}

function fixtureInput(): unknown {
  const settingsId = "f0000000-0000-4000-8000-000000000001";
  const topicId = "f1000000-0000-4000-8000-000000000001";
  const articleId = "f2000000-0000-4000-8000-000000000001";
  const noteId = "f2000000-0000-4000-8000-000000000002";
  const fileId = "f5000000-0000-4000-8000-000000000001";
  return {
    files: [
      {
        description: "开发夹具封面",
        duration: null,
        filename_disk: "fixture-cover.png",
        filename_download: "fixture-cover.png",
        filesize: 70,
        focal_point_x: null,
        focal_point_y: null,
        folder: PUBLISHABLE_ASSETS_FOLDER_ID,
        height: 1,
        id: fileId,
        metadata: null,
        modified_on: "2026-07-30T00:00:00.000Z",
        storage: "local",
        title: "示例封面（非真实内容）",
        type: "image/png",
        width: 1,
      },
    ],
    postTopics: [
      {
        id: "f4000000-0000-4000-8000-000000000001",
        posts_id: articleId,
        topics_id: topicId,
      },
      {
        id: "f4000000-0000-4000-8000-000000000002",
        posts_id: noteId,
        topics_id: topicId,
      },
    ],
    posts: [
      {
        body: "# 静态发布的数据边界\n\n公开构建只读取已经发布的完整快照。",
        cover_alt: "浅蓝色的开发夹具封面",
        cover_decorative: false,
        cover_image: fileId,
        date_updated: "2026-07-30T03:00:00.000Z",
        featured: true,
        id: articleId,
        kind: "article",
        published_at: "2026-07-28T02:00:00.000Z",
        seo_description: null,
        seo_title: null,
        slug: "static-publishing-data-boundary",
        status: "published",
        summary: "从内容数据库到静态页面，说明校验和完整快照如何协作。",
        title: "示例：静态发布的数据边界",
      },
      {
        body: "短记录也走同一条发布边界。失败必须可诊断。",
        cover_alt: null,
        cover_decorative: false,
        cover_image: null,
        date_updated: null,
        featured: false,
        id: noteId,
        kind: "note",
        published_at: "2026-07-30T16:30:00+00:00",
        seo_description: null,
        seo_title: null,
        slug: "diagnosable-failures-first",
        status: "published",
        summary: null,
        title: "示例随记：先让失败可诊断",
      },
    ],
    settings: {
      author_name: "示例作者",
      avatar: null,
      biography: "此身份仅用于开发测试。",
      date_updated: "2026-07-30T00:00:00.000Z",
      default_og_image: fileId,
      default_seo_description: "一个中文优先个人出版系统的开发夹具。",
      footer_text: "示例内容，不代表真实个人。",
      homepage_intro: "这里展示文章、教程与随记。",
      id: settingsId,
      locale: "zh-CN",
      site_name: "示例知识手记",
      tagline: "把复杂问题写清楚",
      timezone: "Asia/Shanghai",
    },
    socialLinks: [
      {
        icon: "github",
        id: "f3000000-0000-4000-8000-000000000001",
        label: "示例代码仓库",
        site_settings_id: settingsId,
        sort: 1,
        url: "https://example.com/source",
      },
    ],
    topics: [
      {
        description: "Astro 与静态内容交付。",
        id: topicId,
        name: "Astro",
        slug: "astro",
      },
    ],
  };
}

function sourceFromEnvironment(): ContentSource {
  const environment = readBuildEnv();
  if (environment.CONTENT_SOURCE === "fixture") return { source: "fixture" };
  if (!environment.DIRECTUS_URL || !environment.DIRECTUS_BUILD_TOKEN) {
    throw new Error(
      "Invalid build environment: Directus credentials are incomplete",
    );
  }
  return {
    source: "directus",
    token: environment.DIRECTUS_BUILD_TOKEN,
    url: environment.DIRECTUS_URL,
  };
}

export async function loadPublishedSnapshot(
  source: ContentSource = sourceFromEnvironment(),
): Promise<PublishedSnapshot> {
  const input =
    source.source === "fixture"
      ? fixtureInput()
      : await loadDirectusInput(source);
  return parsePublishedSnapshot(input);
}
