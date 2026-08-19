import { describe, expect, it } from "vitest";

import {
  deriveChronologicalNavigation,
  deriveRelatedPosts,
  formatContentDate,
  loadPreviewSnapshot,
  loadPublishedSnapshot,
  parsePublishedSnapshot,
  PRIVATE_ASSETS_FOLDER_ID,
  PUBLISHABLE_ASSETS_FOLDER_ID,
} from "../../src/lib/content";
import { renderMarkdown } from "../../src/lib/markdown";

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

function nullableTimestamp(value: string | null): string | null {
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
        body: "## 边界\n\n中文 content 与 Latin words 共用同一份快照。",
        cover_alt: nullable("蓝色数据边界示意图"),
        cover_decorative: false,
        cover_image: IDS.file,
        date_created: "2026-08-01T00:30:00+08:00",
        date_updated: nullableTimestamp(null),
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

    expect(snapshot.posts).toHaveLength(12);
    expect(snapshot.posts.every((post) => post.status === "published")).toBe(
      true,
    );
    expect(
      Object.fromEntries(
        ["article", "tutorial", "note"].map((kind) => [
          kind,
          snapshot.posts.filter((post) => post.kind === kind).length,
        ]),
      ),
    ).toEqual({ article: 5, note: 3, tutorial: 4 });
    expect(snapshot.posts.map((post) => post.route)).toEqual(
      expect.arrayContaining([
        "/writing/production-llm-reliability-boundaries/",
        "/writing/typescript-observable-rag-pipeline/",
        "/notes/chunk-size-is-not-global/",
      ]),
    );
    expect(snapshot.topics).toHaveLength(6);
    expect(
      snapshot.topics.every((topic) =>
        snapshot.posts.some((post) =>
          post.topics.some((candidate) => candidate.id === topic.id),
        ),
      ),
    ).toBe(true);
    expect(snapshot.posts.filter((post) => post.featured)).toHaveLength(1);
    expect(snapshot.posts.find((post) => post.featured)?.slug).toBe(
      "production-llm-reliability-boundaries",
    );
    expect(snapshot.settings).toMatchObject({
      authorName: "关山",
      siteName: "海边的小卖部",
      socialLinks: [],
    });
    expect(snapshot.settings.defaultOgImage?.id).toBe(
      "f5000000-0000-4000-8000-000000000001",
    );
  });

  it("renders the observable RAG tutorial through every Markdown primitive", async () => {
    const snapshot = await loadPublishedSnapshot({ source: "fixture" });
    const tutorial = first(
      snapshot.posts.filter(
        (post) => post.slug === "typescript-observable-rag-pipeline",
      ),
    );
    const mediaId = "f5000000-0000-4000-8000-000000000001";
    const rendered = await renderMarkdown(tutorial.body, {
      media: new Map([
        [
          mediaId,
          {
            height: 900,
            id: mediaId,
            mimeType: "image/webp",
            src: "/images/ai-reliability-boundaries.webp",
            width: 1600,
          },
        ],
      ]),
      source: `post ${tutorial.id} body`,
    });

    expect(rendered.outline).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ level: 2, text: "先定义可追踪的数据形状" }),
        expect.objectContaining({ level: 3, text: "校验引用没有越界" }),
      ]),
    );
    expect(rendered.html).toContain('class="table-wrapper"');
    expect(rendered.html).toContain('type="checkbox"');
    expect(rendered.html).toContain("callout--important");
    expect(rendered.html).toContain("callout--note");
    expect(rendered.html).toContain("callout--warning");
    expect(rendered.html).toContain('class="responsive-figure"');
    expect(rendered.html).toContain('class="code-frame"');
    expect(rendered.html).toContain("is-highlighted diff-add");
    expect(rendered.html).toContain("data-footnotes");
    expect(rendered.links.map((link) => link.href)).toEqual([
      "/notes/chunk-size-is-not-global/",
      "/writing/prompt-regression-golden-set/#把失败写成可复现样本",
      "/writing/rag-retrieval-reranking-attribution/#四个阶段四种责任",
    ]);
  });

  it("derives stable related writing from the canonical topic assignments", async () => {
    const snapshot = await loadPublishedSnapshot({ source: "fixture" });
    const relatedSlugs = (slug: string) => {
      const post = snapshot.posts.find((candidate) => candidate.slug === slug);
      if (!post) throw new Error(`Missing canonical post ${slug}`);
      return deriveRelatedPosts(post, snapshot.posts).map(
        (candidate) => candidate.slug,
      );
    };

    expect(relatedSlugs("production-llm-reliability-boundaries")).toEqual([
      "llm-evaluation-regression-loop",
      "streaming-llm-sse-cancellation",
      "temperature-is-not-confidence",
    ]);
    expect(relatedSlugs("typescript-observable-rag-pipeline")).toEqual([
      "prompt-regression-golden-set",
      "temperature-is-not-confidence",
      "llm-evaluation-regression-loop",
    ]);
    expect(relatedSlugs("safe-tool-calling-typescript")).toEqual([
      "prompt-injection-data-flow",
      "llm-cache-key-versioning",
      "structured-output-schema-retry-validation",
    ]);
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

  it("ignores Directus maintenance timestamps until a later local day", () => {
    const input = validInput();
    const [post] = input.posts;
    if (!post) throw new Error("test fixture is empty");
    post.date_created = "2026-08-10T09:00:00.000Z";
    post.date_updated = "2026-08-10T12:00:00.000Z";
    expect(
      first([...parsePublishedSnapshot(input).posts]).updatedAt,
    ).toBeNull();

    post.date_updated = "2026-08-11T00:00:00.000Z";
    expect(first([...parsePublishedSnapshot(input).posts]).updatedAt).toBe(
      "2026-08-11T00:00:00.000Z",
    );
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
    expect(postsRequest?.searchParams.get("fields")).toContain("date_created");
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

  it("loads a versioned preview with private draft media", async () => {
    const input = validInput();
    first(input.files).folder = PRIVATE_ASSETS_FOLDER_ID;
    const requests: URL[] = [];
    const mockFetch: typeof fetch = async (request) => {
      const url = new URL(
        request instanceof Request ? request.url : String(request),
      );
      requests.push(url);
      let data: unknown;
      if (url.pathname === `/items/posts/${IDS.post}`)
        data = first(input.posts);
      else if (url.pathname === "/items/topics") data = input.topics;
      else if (url.pathname === "/items/posts_topics") data = input.postTopics;
      else if (url.pathname === "/items/site_settings") data = input.settings;
      else if (url.pathname === "/items/social_links") data = input.socialLinks;
      else if (url.pathname === "/files") data = input.files;
      else return new Response(null, { status: 404 });
      return Response.json({ data });
    };

    const snapshot = await loadPreviewSnapshot({
      fetch: mockFetch,
      id: IDS.post,
      token: "preview-reader-token-for-unit-tests",
      url: "https://cms.example.test",
      version: "draft",
    });

    expect(snapshot.posts).toHaveLength(1);
    expect(first([...snapshot.files]).folderId).toBe(PRIVATE_ASSETS_FOLDER_ID);
    const postRequest = requests.find(
      (url) => url.pathname === `/items/posts/${IDS.post}`,
    );
    expect(postRequest?.searchParams.get("version")).toBe("draft");
    expect(postRequest?.searchParams.get("fields")).not.toContain("*");
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

describe("deriveChronologicalNavigation", () => {
  const snapshot = parsePublishedSnapshot(validInput());
  const samplePosts = [
    {
      ...snapshot.posts[0]!,
      id: "post-1",
      publishedAt: "2026-08-01T10:00:00.000Z",
      title: "Post 1",
    },
    {
      ...snapshot.posts[0]!,
      id: "post-2",
      publishedAt: "2026-08-02T10:00:00.000Z",
      title: "Post 2",
    },
    {
      ...snapshot.posts[0]!,
      id: "post-3",
      publishedAt: "2026-08-03T10:00:00.000Z",
      title: "Post 3",
    },
  ];

  it("identifies earlier and later posts accurately for middle post", () => {
    const nav = deriveChronologicalNavigation(samplePosts[1]!, samplePosts);
    expect(nav.prevPost?.id).toBe("post-1");
    expect(nav.nextPost?.id).toBe("post-3");
  });

  it("returns null prevPost for the earliest post", () => {
    const nav = deriveChronologicalNavigation(samplePosts[0]!, samplePosts);
    expect(nav.prevPost).toBeNull();
    expect(nav.nextPost?.id).toBe("post-2");
  });

  it("returns null nextPost for the latest post", () => {
    const nav = deriveChronologicalNavigation(samplePosts[2]!, samplePosts);
    expect(nav.prevPost?.id).toBe("post-2");
    expect(nav.nextPost).toBeNull();
  });
});
