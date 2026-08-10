import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { readBuildEnv } from "./env.mjs";
import { EDITORIAL_IDS } from "../directus/seed/content.mjs";
import {
  loadPublishedInput,
  parsePublishedSnapshot,
  PUBLISHABLE_ASSETS_FOLDER_ID,
  type ContentSource,
} from "../src/lib/content.ts";
import {
  resolvePublicMediaAsset,
  type PublicMediaAsset,
} from "../src/lib/media.ts";

const generatedDirectory = join(process.cwd(), ".generated");
const mediaDirectory = join(process.cwd(), "public", "_media");
const environment = readBuildEnv();

function contentSource(): ContentSource {
  if (environment.CONTENT_SOURCE === "fixture") return { source: "fixture" };
  const { DIRECTUS_BUILD_TOKEN: token, DIRECTUS_URL: url } = environment;
  if (!token || !url)
    throw new Error("Directus build credentials are incomplete");
  return { source: "directus", token, url };
}

const source = contentSource();
const input = await loadPublishedInput(source);
const snapshot = parsePublishedSnapshot(input);

await rm(mediaDirectory, { force: true, recursive: true });
const media: Record<string, PublicMediaAsset> = {};
if (source.source === "fixture") {
  const fixtureAssets: ReadonlyMap<
    string,
    Omit<PublicMediaAsset, "id" | "mimeType" | "srcset">
  > = new Map([
    [
      EDITORIAL_IDS.cover,
      {
        height: 900,
        src: "/images/ai-reliability-boundaries.webp",
        variants: [
          {
            height: 360,
            mimeType: "image/webp" as const,
            src: "/images/ai-reliability-boundaries-640.webp",
            width: 640,
          },
          {
            height: 540,
            mimeType: "image/webp" as const,
            src: "/images/ai-reliability-boundaries-960.webp",
            width: 960,
          },
          {
            height: 900,
            mimeType: "image/webp" as const,
            src: "/images/ai-reliability-boundaries.webp",
            width: 1600,
          },
        ],
        width: 1600,
      },
    ],
  ]);
  for (const file of snapshot.files) {
    const asset = fixtureAssets.get(file.id);
    if (!asset) throw new Error(`No fixture media mapping for ${file.id}`);
    media[file.id] = {
      height: asset.height,
      id: file.id,
      mimeType: "image/webp",
      src: asset.src,
      srcset: asset.variants
        .map(({ src, width }) => `${src} ${width}w`)
        .join(", "),
      variants: asset.variants,
      width: asset.width,
    };
  }
} else {
  for (const file of snapshot.files) {
    media[file.id] = await resolvePublicMediaAsset(
      {
        filename_download: file.filename,
        filesize: file.filesize,
        folder: PUBLISHABLE_ASSETS_FOLDER_ID,
        height: file.height,
        id: file.id,
        type: file.mimeType,
        width: file.width,
      },
      {
        directusUrl: source.url,
        outputDirectory: mediaDirectory,
        token: source.token,
      },
    );
  }
}

await mkdir(generatedDirectory, { recursive: true });
await writeFile(
  join(generatedDirectory, "site.json"),
  `${JSON.stringify({ input, media })}\n`,
  "utf8",
);
console.log(
  `Prepared ${snapshot.posts.length} published posts and ${snapshot.files.length} media records`,
);
