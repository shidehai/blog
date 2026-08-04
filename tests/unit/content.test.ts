import { describe, expect, it } from "vitest";

import {
  formatContentDate,
  loadPublishedSnapshot,
  parsePublishedSnapshot,
  PUBLISHABLE_ASSETS_FOLDER_ID,
} from "../../src/lib/content";

const IDS = {
  file: "15000000-0000-4000-8000-000000000001",
  join: "14000000-0000-4000-8000-000000000001",
  post: "12000000-0000-4000-8000-000000000001",
  settings: "10000000-0000-4000-8000-000000000001",
  social: "13000000-0000-4000-8000-000000000001",
  topic: "11000000-0000-4000-8000-000000000001",
};

function nullable(value: string): string | null {
  return value;
}

function validInput() {
  return {
    files: [
      {
        description: "夹具封面",
        duration: null,
        filename_disk: "fixture.png",
        filename_download: "fixture.png",
        filesize: "70",
        focal_point_x: null,
        focal_point_y: null,
        folder: PUBLISHABLE_ASSETS_FOLDER_ID,
        height: 1,
        id: IDS.file,
        metadata: null,
        modified_on: "2026-07-31T08:00:00+08:00",
        storage: "local",
        title: "夹具封面",
        type: "image/png",
        width: 1,
      },
    ],
    postTopics: [
      {
        id: IDS.join,
        posts_id: IDS.post,
        topics_id: IDS.topic,
      },
    ],
    posts: [
      {
        body: "# 边界\n\n中文 content 与 Latin words 共用同一份快照。",
        cover_alt: nullable("蓝色数据边界示意图"),
        cover_decorative: false,
        cover_image: IDS.file,
        date_updated: null,
        featured: true,
        id: IDS.post,
        kind: "article",
        published_at: "2026-08-01T00:30:00+08:00",
        seo_description: null,
        seo_title: null,
        slug: "typed-content-boundary",
        status: "published",
        summary: "验证数据库记录进入静态页面前的唯一内容边界。",
        title: "类型化内容边界",
      },
    ],
    settings: {
      author_name: "示例作者",
      avatar: null,
      biography: null,
      date_updated: null,
      default_og_image: IDS.file,
      default_seo_description: "开发测试站点",
      footer_text: null,
      homepage_intro: null,
      id: IDS.settings,
      locale: "zh-CN",
      site_name: "示例知识手记",
      tagline: null,
      timezone: "Asia/Shanghai",
    },
    socialLinks: [
      {
        icon: "github",
        id: IDS.social,
        label: "代码仓库",
        site_settings_id: IDS.settings,
        sort: 1,
        url: "https://example.com/source",
      },
    ],
    topics: [
      {
        description: null,
        id: IDS.topic,
        name: "工程手艺",
        slug: "engineering-craft",
      },
    ],
  };
}

function first<T>(items: T[]): T {
  const item = items[0];
  if (!item) throw new Error("test fixture is empty");
  return item;
}

describe("published content boundary", () => {
  it("loads and normalizes the built-in fixture without CMS credentials", async () => {
    const snapshot = await loadPublishedSnapshot({ source: "fixture" });

    expect(snapshot.posts.map((post) => post.status)).toEqual([
      "published",
      "published",
    ]);
    expect(snapshot.posts[0]?.route).toBe("/notes/diagnosable-failures-first/");
    expect(snapshot.posts[0]?.summary).toContain("短记录");
    expect(snapshot.posts[1]?.topics[0]?.slug).toBe("astro");
    expect(snapshot.settings.defaultOgImage?.id).toBe(
      "f5000000-0000-4000-8000-000000000001",
    );
  });

  it("normalizes timestamps to UTC and formats the configured local date", () => {
    const snapshot = parsePublishedSnapshot(validInput());
    const post = first([...snapshot.posts]);

    expect(post.publishedAt).toBe("2026-07-31T16:30:00.000Z");
    expect(
      formatContentDate(
        post.publishedAt,
        snapshot.settings.timezone,
        snapshot.settings.locale,
      ),
    ).toBe("2026年8月1日");
    expect(post.route).toBe("/writing/typed-content-boundary/");
    expect(post.topics.map((topic) => topic.slug)).toEqual([
      "engineering-craft",
    ]);
  });

  it("uses explicit SDK fields and filters posts at the API", async () => {
    const input = validInput();
    const requests: URL[] = [];
    const mockFetch: typeof fetch = async (request) => {
      const url = new URL(
        request instanceof Request ? request.url : String(request),
      );
      requests.push(url);
      let data: unknown;
      if (url.pathname === "/items/posts") data = input.posts;
      else if (url.pathname === "/items/topics") data = input.topics;
      else if (url.pathname === "/items/posts_topics") data = input.postTopics;
      else if (url.pathname === "/items/site_settings") data = input.settings;
      else if (url.pathname === "/items/social_links") data = input.socialLinks;
      else if (url.pathname === "/files") data = input.files;
      else return new Response(null, { status: 404 });
      return Response.json({ data });
    };

    const snapshot = await loadPublishedSnapshot({
      fetch: mockFetch,
      source: "directus",
      token: "build-reader-token-for-unit-tests",
      url: "https://cms.example.test",
    });

    expect(snapshot.posts).toHaveLength(1);
    const postsRequest = requests.find(
      (url) => url.pathname === "/items/posts",
    );
    expect(postsRequest).toBeDefined();
    expect(postsRequest?.search).toContain("published");
    expect(postsRequest?.searchParams.get("fields")).toContain("status");
    expect(postsRequest?.searchParams.get("fields")).not.toContain("*");
    expect(requests.map((url) => url.pathname)).toEqual(
      expect.arrayContaining([
        "/items/posts",
        "/items/topics",
        "/items/posts_topics",
        "/items/site_settings",
        "/items/social_links",
        "/files",
      ]),
    );
  });

  it.each([
    {
      message: "duplicates posts[0].slug",
      mutate(input: ReturnType<typeof validInput>) {
        input.posts.push({
          ...first(input.posts),
          id: "12000000-0000-4000-8000-000000000002",
        });
      },
      name: "duplicate post slugs",
    },
    {
      message: "is not published",
      mutate(input: ReturnType<typeof validInput>) {
        first(input.posts).status = "archived";
      },
      name: "an archived row returned by the API",
    },
    {
      message: "references unknown topic",
      mutate(input: ReturnType<typeof validInput>) {
        first(input.postTopics).topics_id =
          "11000000-0000-4000-8000-000000000099";
      },
      name: "a broken topic relationship",
    },
    {
      message: "must use http, https, or mailto",
      mutate(input: ReturnType<typeof validInput>) {
        first(input.socialLinks).url = "javascript:alert(1)";
      },
      name: "an unsafe social URL",
    },
    {
      message: "requires cover alternative text",
      mutate(input: ReturnType<typeof validInput>) {
        first(input.posts).cover_alt = null;
      },
      name: "a meaningful cover without alt text",
    },
    {
      message: "must be an ISO timestamp with a UTC offset",
      mutate(input: ReturnType<typeof validInput>) {
        first(input.posts).published_at = "2026-08-01";
      },
      name: "a date without a UTC offset",
    },
  ])("rejects $name", ({ mutate, message }) => {
    const input = validInput();
    mutate(input);
    expect(() => parsePublishedSnapshot(input)).toThrow(message);
  });
});
