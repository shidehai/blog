import { beforeAll, describe, expect, test } from "vitest";

import type { PublishedSnapshot } from "../../src/lib/content.ts";
import { loadPublishedSnapshot } from "../../src/lib/content.ts";
import {
  buildStructuredData,
  serializeStructuredData,
} from "../../src/lib/metadata.ts";

let snapshot: PublishedSnapshot;

beforeAll(async () => {
  snapshot = await loadPublishedSnapshot({ source: "fixture" });
});

describe("public metadata", () => {
  test("emits website, person, page, and BlogPosting identity from one snapshot", () => {
    const post = snapshot.posts[0];
    expect(post).toBeDefined();
    if (!post) return;

    const serialized = serializeStructuredData(
      buildStructuredData({
        article: {
          kind: post.kind,
          publishedAt: post.publishedAt,
          title: post.title,
          topics: post.topics.map((topic) => topic.name),
          updatedAt: post.updatedAt,
        },
        authorName: snapshot.settings.authorName,
        canonicalUrl: `https://journal.example${post.route}`,
        description: post.summary,
        image: {
          alt: post.coverAlt ?? post.title,
          height: 630,
          mimeType: "image/png",
          src: "/images/default-social.png",
          width: 1200,
        },
        locale: snapshot.settings.locale,
        pageTitle: `${post.title} | ${snapshot.settings.siteName}`,
        siteDescription: snapshot.settings.defaultSeoDescription,
        siteName: snapshot.settings.siteName,
        siteUrl: "https://journal.example/",
        socialLinks: snapshot.settings.socialLinks,
      }),
    );

    expect(serialized).toContain('"@type":"WebSite"');
    expect(serialized).toContain('"@type":"Person"');
    expect(serialized).toContain('"@type":"WebPage"');
    expect(serialized).toContain('"@type":"BlogPosting"');
    expect(serialized).toContain(`"datePublished":"${post.publishedAt}"`);
    expect(serialized).toContain(
      `"contentUrl":"https://journal.example/images/default-social.png"`,
    );
    expect(serialized).toContain(
      '"urlTemplate":"https://journal.example/search/?q={search_term_string}"',
    );
  });

  test("serializes JSON-LD without allowing a closing script sequence", () => {
    const serialized = serializeStructuredData(
      buildStructuredData({
        authorName: snapshot.settings.authorName,
        canonicalUrl: "https://journal.example/",
        description: "</script><script>alert(1)</script>",
        locale: snapshot.settings.locale,
        pageTitle: snapshot.settings.siteName,
        siteDescription: snapshot.settings.defaultSeoDescription,
        siteName: snapshot.settings.siteName,
        siteUrl: "https://journal.example/",
        socialLinks: snapshot.settings.socialLinks,
      }),
    );

    expect(serialized).not.toContain("</script>");
    expect(serialized).toContain("\\u003c/script>");
    expect(() => JSON.parse(serialized)).not.toThrow();
  });
});
