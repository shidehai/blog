import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

import {
  loadPublishedSnapshot,
  type PublishedSnapshot,
} from "../src/lib/content.ts";

interface ExportOptions {
  dryRun: boolean;
  output: string;
}

export function buildPortabilityExport(
  snapshot: PublishedSnapshot,
): ReadonlyMap<string, string> {
  const posts = snapshot.posts.map((post) => {
    const bodyFile = `posts/${post.kind}-${post.slug}.md`;
    return {
      bodyFile,
      coverId: post.cover?.id ?? null,
      featured: post.featured,
      id: post.id,
      kind: post.kind,
      publishedAt: post.publishedAt,
      seoDescription: post.seoDescription,
      seoTitle: post.seoTitle,
      slug: post.slug,
      status: post.status,
      summary: post.summary,
      title: post.title,
      topicSlugs: post.topics.map((topic) => topic.slug),
      updatedAt: post.updatedAt,
    };
  });
  const manifest = {
    files: snapshot.files,
    posts,
    schemaVersion: 1,
    settings: snapshot.settings,
    topics: snapshot.topics,
  };
  return new Map([
    ["content.json", `${JSON.stringify(manifest, null, 2)}\n`],
    ...snapshot.posts.map(
      (post) =>
        [
          `posts/${post.kind}-${post.slug}.md`,
          `${post.body.replace(/\s+$/, "")}\n`,
        ] as const,
    ),
  ]);
}

function parseOptions(args: readonly string[]): ExportOptions {
  let dryRun = false;
  let output = "exports/content";
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--") continue;
    if (argument === "--dry-run") dryRun = true;
    else if (argument === "--output") {
      const value = args[index + 1];
      if (!value) throw new Error("--output requires a directory");
      output = value;
      index += 1;
    } else throw new Error(`Unknown option: ${argument}`);
  }
  return { dryRun, output };
}

async function main(): Promise<void> {
  const options = parseOptions(process.argv.slice(2));
  const snapshot = await loadPublishedSnapshot();
  const files = buildPortabilityExport(snapshot);

  if (options.dryRun) {
    console.log(
      `Portability export is valid: ${snapshot.posts.length} posts, ${snapshot.files.length} media records, ${files.size} files`,
    );
    return;
  }
  if (existsSync(options.output)) {
    throw new Error(`Export target already exists: ${options.output}`);
  }

  await mkdir(dirname(options.output), { recursive: true });
  await mkdir(options.output);
  for (const [relativePath, contents] of files) {
    const destination = join(options.output, relativePath);
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, contents, { encoding: "utf8", flag: "wx" });
  }
  console.log(
    `Exported ${snapshot.posts.length} published posts to ${options.output}`,
  );
}

const invokedPath = process.argv[1] && pathToFileURL(process.argv[1]).href;
if (invokedPath === import.meta.url) {
  main().catch((error: unknown) => {
    console.error(
      error instanceof Error ? error.message : "Content export failed",
    );
    process.exitCode = 1;
  });
}
