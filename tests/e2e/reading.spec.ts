import { expect, test } from "@playwright/test";

const tutorialPath = "/writing/typescript-observable-rag-pipeline/";

const publishedRoutes = [
  "/writing/production-llm-reliability-boundaries/",
  "/writing/rag-retrieval-reranking-attribution/",
  tutorialPath,
  "/notes/chunk-size-is-not-global/",
  "/writing/structured-output-schema-retry-validation/",
  "/writing/safe-tool-calling-typescript/",
  "/notes/llm-cache-key-versioning/",
  "/writing/llm-evaluation-regression-loop/",
  "/writing/prompt-regression-golden-set/",
  "/notes/temperature-is-not-confidence/",
  "/writing/prompt-injection-data-flow/",
  "/writing/streaming-llm-sse-cancellation/",
] as const;

test("all public discovery routes are reachable without authentication", async ({
  request,
}) => {
  const routes = [
    "/writing/",
    "/notes/",
    "/topics/",
    "/topics/llm-systems/",
    "/topics/retrieval-augmented-generation/",
    "/topics/ai-evaluation/",
    "/topics/agents-and-tools/",
    "/topics/ai-safety-reliability/",
    "/topics/inference-performance/",
    "/search/",
    "/about/",
    "/archive/",
    "/rss.xml",
    ...publishedRoutes,
  ];

  for (const route of routes) {
    const response = await request.get(route);
    expect(response.ok(), route).toBe(true);
  }
});

test("long tutorial renders the complete reading contract", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(tutorialPath);

  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  await expect(page.locator(".article-rail .article-outline")).toBeVisible();
  await expect(page.locator(".prose table")).toBeVisible();
  await expect(page.locator(".prose .callout")).toHaveCount(3);
  await expect(page.locator(".prose .callout").first()).toBeVisible();
  await expect(page.locator(".prose .footnotes")).toBeVisible();
  await expect(page.locator(".prose .code-frame")).toHaveCount(5);
  await expect(page.locator(".prose .code-frame").first()).toBeVisible();
  await expect(
    page.locator(".article-header .post-meta-updated"),
  ).toContainText("更新于");

  const image = page.locator(".prose .responsive-figure img");
  await expect(image).toBeVisible();
  await expect(image).toHaveAttribute("width", "1600");
  await expect(image).toHaveAttribute("height", "900");
  await expect(image).toHaveAttribute("srcset", /640w.*960w.*1600w/);
});

test("mobile tutorial keeps the reading column primary", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto(tutorialPath);

  await expect(page.locator("details.article-outline-mobile")).toBeVisible();
  await expect(
    page.locator("details.article-outline-mobile .annotation-label"),
  ).toHaveCount(0);
  await expect(page.locator(".article-rail")).toBeHidden();
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
});

test("code copy gives stable success feedback", async ({ context, page }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto(tutorialPath);

  const copy = page.locator("[data-copy-code]").first();
  const width = await copy.evaluate((element) => element.clientWidth);
  await copy.click();
  await expect(copy.locator("[data-copy-label]")).toHaveText("已复制");
  expect(await copy.evaluate((element) => element.clientWidth)).toBe(width);
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(
    "type Document",
  );
});

test("outline tracks the current section through the end of the article", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 700 });
  await page.goto(tutorialPath);

  const links = page.locator(".article-rail [data-outline-link]");
  await expect(links.first()).toHaveAttribute("aria-current", "location");

  await page.evaluate(() =>
    window.scrollTo(0, document.documentElement.scrollHeight),
  );
  await expect(links.last()).toHaveAttribute("aria-current", "location");
  await expect(
    page.locator('.article-rail [data-outline-link][aria-current="location"]'),
  ).toHaveCount(1);
});

test("tutorial content remains useful without JavaScript", async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(tutorialPath);

  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "实作：用 TypeScript 搭建可观测的 RAG 最小链路",
    }),
  ).toBeVisible();
  await expect(page.locator(".prose table")).toBeVisible();
  await expect(page.locator(".prose .responsive-figure img")).toBeVisible();
  await context.close();
});

test("print keeps tutorial artifacts and removes interactive chrome", async ({
  page,
}) => {
  await page.goto(tutorialPath);
  await page.emulateMedia({ media: "print" });

  await expect(page.locator(".site-header-frame")).toBeHidden();
  for (const button of await page.locator("[data-copy-code]").all()) {
    await expect(button).toBeHidden();
  }
  await expect(page.locator(".prose table")).toBeVisible();
  await expect(page.locator(".prose .footnotes")).toBeVisible();
  await expect(page.locator(".prose .responsive-figure img")).toBeVisible();
});

test("custom 404 sends readers back to current writing", async ({ page }) => {
  const response = await page.goto("/not-a-real-route/");

  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("没有");
  await expect(
    page.getByRole("link", { name: /写作|阅读/ }).first(),
  ).toBeVisible();
});
