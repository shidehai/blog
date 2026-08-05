import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { z } from "zod";

import { parsePublishedSnapshot } from "./content.ts";
import type { PublishedSnapshot } from "./content.ts";
import type { MarkdownMedia, RenderedMarkdown } from "./markdown.ts";
import { renderMarkdown } from "./markdown.ts";
import { validateGeneratedReferences } from "./references.ts";

const STATIC_ROUTES = [
  "/",
  "/about/",
  "/archive/",
  "/notes/",
  "/search/",
  "/topics/",
  "/writing/",
  "/rss.xml",
] as const;

const markdownMediaSchema = z.object({
  height: z.number().int().positive(),
  id: z.uuid(),
  mimeType: z.enum(["image/webp", "image/svg+xml"]),
  src: z.string().startsWith("/"),
  srcset: z.string().optional(),
  width: z.number().int().positive(),
});
const serializedSiteSchema = z
  .object({
    input: z.unknown(),
    media: z.record(z.string(), markdownMediaSchema),
  })
  .superRefine((site, context) => {
    for (const [id, asset] of Object.entries(site.media)) {
      if (id !== asset.id) {
        context.addIssue({
          code: "custom",
          message: `media key ${id} does not match ${asset.id}`,
          path: ["media", id, "id"],
        });
      }
    }
  });

export interface PreparedSite {
  media: ReadonlyMap<string, MarkdownMedia>;
  renderedPosts: ReadonlyMap<string, RenderedMarkdown>;
  snapshot: PublishedSnapshot;
}

async function prepareSite(): Promise<PreparedSite> {
  const serialized = serializedSiteSchema.parse(
    JSON.parse(
      await readFile(join(process.cwd(), ".generated", "site.json"), "utf8"),
    ),
  );
  const snapshot = parsePublishedSnapshot(serialized.input);
  const media = new Map<string, MarkdownMedia>(
    Object.entries(serialized.media).map(([id, asset]) => [
      id,
      {
        height: asset.height,
        id: asset.id,
        mimeType: asset.mimeType,
        src: asset.src,
        ...(asset.srcset ? { srcset: asset.srcset } : {}),
        width: asset.width,
      },
    ]),
  );
  const renderedPosts = new Map(
    await Promise.all(
      snapshot.posts.map(
        async (post) =>
          [
            post.id,
            await renderMarkdown(post.body, {
              media,
              source: `post ${post.id} body`,
            }),
          ] as const,
      ),
    ),
  );
  const routes = [
    ...STATIC_ROUTES,
    ...snapshot.posts.map((post) => post.route),
    ...snapshot.topics.map((topic) => `/topics/${topic.slug}/`),
  ];
  const documents = snapshot.posts.map((post) => {
    const output = renderedPosts.get(post.id);
    if (!output) throw new Error(`Post ${post.id} was not rendered`);
    return { output, route: post.route };
  });
  validateGeneratedReferences({
    documents,
    mediaIds: snapshot.files.map((file) => file.id),
    routes,
  });
  return { media, renderedPosts, snapshot };
}

const preparedSite = prepareSite();

export function getPreparedSite(): Promise<PreparedSite> {
  return preparedSite;
}
