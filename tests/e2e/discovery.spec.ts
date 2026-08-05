import { expect, test } from "@playwright/test";

test("public pages expose canonical social and structured metadata", async ({
  page,
}) => {
  await page.goto("/");

  await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    "http://localhost:4321/",
  );
  await expect(page.locator('meta[property="og:site_name"]')).toHaveAttribute(
    "content",
    "示例知识手记",
  );
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
    "content",
    "summary_large_image",
  );
  await expect(
    page.locator('link[rel="alternate"][type="application/rss+xml"]'),
  ).toHaveAttribute("href", "http://localhost:4321/rss.xml");
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
    "href",
    "/site.webmanifest",
  );

  const homeJsonLd = await page
    .locator('script[type="application/ld+json"]')
    .textContent();
  expect(homeJsonLd).toContain('"@type":"WebSite"');
  expect(homeJsonLd).toContain('"@type":"Person"');

  await page.goto("/writing/static-publishing-data-boundary/");
  await expect(page.locator('meta[property="og:type"]')).toHaveAttribute(
    "content",
    "article",
  );
  const postJsonLd = await page
    .locator('script[type="application/ld+json"]')
    .textContent();
  expect(postJsonLd).toContain('"@type":"BlogPosting"');
  expect(postJsonLd).toContain('"datePublished":"2026-07-28T02:00:00.000Z"');
});

test("preview is noindex and emits no public discovery metadata", async ({
  page,
}) => {
  await page.setExtraHTTPHeaders({
    "x-preview-trusted": "test-preview-header-at-least-24-chars",
  });
  await page.goto("/preview/f2000000-0000-4000-8000-000000000001");

  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    "noindex, nofollow",
  );
  await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
  await expect(page.locator('meta[property^="og:"]')).toHaveCount(0);
  await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(
    0,
  );
  await expect(
    page.locator('link[rel="alternate"][type="application/rss+xml"]'),
  ).toHaveCount(0);
});

test("RSS, sitemap, robots, manifest, and icon assets are reachable", async ({
  request,
}) => {
  const rss = await request.get("/rss.xml");
  expect(rss.ok()).toBe(true);
  expect(rss.headers()["content-type"]).toContain("application/xml");
  expect(await rss.text()).toContain(
    "http://localhost:4321/writing/static-publishing-data-boundary/",
  );

  const sitemapIndex = await request.get("/sitemap-index.xml");
  expect(sitemapIndex.ok()).toBe(true);
  expect(await sitemapIndex.text()).toContain(
    "http://localhost:4321/sitemap.xml",
  );

  const robots = await request.get("/robots.txt");
  expect(robots.ok()).toBe(true);
  expect(await robots.text()).toContain("Disallow: /preview/");

  const manifest = await request.get("/site.webmanifest");
  expect(manifest.ok()).toBe(true);
  expect(manifest.headers()["content-type"]).toContain(
    "application/manifest+json",
  );
  expect(await manifest.json()).toMatchObject({
    icons: [{ src: "/icon-192.png" }, { src: "/icon-512.png" }],
    lang: "zh-CN",
  });

  for (const path of [
    "/favicon.svg",
    "/favicon-32x32.png",
    "/apple-touch-icon.png",
    "/icon-192.png",
    "/icon-512.png",
    "/images/default-social.png",
  ]) {
    expect((await request.get(path)).ok()).toBe(true);
  }
});

test("search loads Pagefind only on use and finds Chinese fixture content", async ({
  page,
}) => {
  const pagefindRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/pagefind/"))
      pagefindRequests.push(request.url());
  });

  await page.goto("/search/");
  await expect(page.getByRole("heading", { name: "最近发布" })).toBeVisible();
  expect(pagefindRequests).toHaveLength(0);

  await page.getByLabel("关键词").fill("静态发布");
  await expect(page.locator("[data-search-status]")).toContainText("找到");
  await expect(
    page.getByRole("link", { name: "示例：静态发布的数据边界" }),
  ).toBeVisible();
  expect(
    pagefindRequests.some((url) => url.endsWith("/pagefind/pagefind.js")),
  ).toBe(true);

  await page.getByRole("button", { name: "清除搜索" }).click();
  await page
    .getByRole("combobox", { name: "类型", exact: true })
    .selectOption("note");
  await expect(page.locator("[data-search-status]")).toContainText(
    "找到 1 条结果",
  );
  await expect(
    page.getByRole("link", { name: "示例随记：先让失败可诊断" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "示例：静态发布的数据边界" }),
  ).toHaveCount(0);

  await page
    .getByRole("combobox", { name: "类型", exact: true })
    .selectOption("");
  await page
    .getByRole("combobox", { name: "主题", exact: true })
    .selectOption("fixture-engineering-craft");
  await expect(page.locator("[data-search-status]")).toContainText(
    "找到 1 条结果",
  );
  await expect(
    page.getByRole("link", { name: "示例教程：验证一份发布快照" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "示例随记：先让失败可诊断" }),
  ).toHaveCount(0);

  await page
    .getByRole("combobox", { name: "主题", exact: true })
    .selectOption("");
  await page
    .getByRole("combobox", { name: "时间", exact: true })
    .selectOption("2026-07");
  await expect(page.locator("[data-search-status]")).toContainText(
    "找到 3 条结果",
  );
  await expect(page.locator("[data-search-results] > li")).toHaveCount(3);
});

test("search controls reflow without horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/search/");

  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
  await expect(
    page.getByRole("button", { name: "搜索", exact: true }),
  ).toBeVisible();
});
