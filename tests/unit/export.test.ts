import { describe, expect, it } from "vitest";

import { buildPortabilityExport } from "../../scripts/export-content.ts";
import { loadPublishedSnapshot } from "../../src/lib/content.ts";

describe("published portability export", () => {
  it("keeps Markdown bodies separate from documented JSON metadata", async () => {
    const snapshot = await loadPublishedSnapshot({ source: "fixture" });
    const files = buildPortabilityExport(snapshot);
    const manifest = JSON.parse(files.get("content.json") ?? "") as {
      posts: Array<{ bodyFile: string; id: string; status: string }>;
      schemaVersion: number;
    };

    expect(manifest.schemaVersion).toBe(1);
    expect(manifest.posts).toHaveLength(snapshot.posts.length);
    expect(manifest.posts.every((post) => post.status === "published")).toBe(
      true,
    );
    for (const post of manifest.posts) {
      expect(files.get(post.bodyFile)).toContain("边界");
      expect(post.id).toMatch(/^[0-9a-f-]{36}$/);
    }
  });
});
