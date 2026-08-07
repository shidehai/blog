import { beforeAll, describe, expect, test } from "vitest";

import type { PublishedSnapshot } from "../../src/lib/content.ts";
import { loadPublishedSnapshot } from "../../src/lib/content.ts";
import {
  buildManifest,
  buildRobotsTxt,
  buildRssXml,
  buildSitemapIndexXml,
  buildSitemapXml,
  escapeXml,
} from "../../src/lib/discovery.ts";

const siteUrl = new URL("https://journal.example/");
let snapshot: PublishedSnapshot;

beforeAll(async () => {
  snapshot = await loadPublishedSnapshot({ source: "fixture" });
});

describe("discovery and syndication", () => {
  test("RSS contains every published kind with absolute canonical URLs", () => {
    const xml = buildRssXml(snapshot, siteUrl);
    const itemCount = xml.match(/<item>/g)?.length ?? 0;

    expect(itemCount).toBe(snapshot.posts.length);
    expect(xml).toContain("<language>zh-CN</language>");
    expect(xml).toContain(
      '<atom:link href="https://journal.example/rss.xml" rel="self" type="application/rss+xml" />',
    );
    for (const post of snapshot.posts) {
      expect(xml).toContain(
        `<guid isPermaLink="true">https://journal.example${post.route}</guid>`,
      );
      expect(xml).toContain(`<category>${post.kind}</category>`);
    }
  });

  test("sitemap contains canonical HTML routes and excludes private or internal surfaces", () => {
    const xml = buildSitemapXml(snapshot, siteUrl);

    expect(xml).toContain("<loc>https://journal.example/search/</loc>");
    for (const post of snapshot.posts) {
      expect(xml).toContain(`<loc>https://journal.example${post.route}</loc>`);
    }
    for (const topic of snapshot.topics) {
      expect(xml).toContain(
        `<loc>https://journal.example/topics/${topic.slug}/</loc>`,
      );
    }
    expect(xml).not.toContain("/preview/");
    expect(xml).not.toContain("/pagefind/");
    expect(xml).not.toContain("/healthz");
    expect(xml).not.toContain("/404");
    expect(xml).not.toContain("/rss.xml");
  });

  test("sitemap index, robots, and manifest point to real public assets", () => {
    expect(buildSitemapIndexXml(snapshot, siteUrl)).toContain(
      "<loc>https://journal.example/sitemap.xml</loc>",
    );
    expect(buildRobotsTxt(siteUrl)).toBe(`User-agent: *
Allow: /
Disallow: /preview/
Disallow: /pagefind/

Sitemap: https://journal.example/sitemap-index.xml
`);

    expect(buildManifest(snapshot)).toMatchObject({
      background_color: "#e8e6e3",
      display: "browser",
      icons: [
        { sizes: "192x192", src: "/icon-192.png" },
        { sizes: "512x512", src: "/icon-512.png" },
      ],
      lang: "zh-CN",
      name: snapshot.settings.siteName,
      theme_color: "#4a8fe7",
    });
  });

  test("XML special characters are escaped once at the output boundary", () => {
    expect(escapeXml(`A & B < "C" > 'D'`)).toBe(
      "A &amp; B &lt; &quot;C&quot; &gt; &apos;D&apos;",
    );
  });
});
