import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const tutorialPath = "/writing/typescript-observable-rag-pipeline/";
const testOrigin = `http://127.0.0.1:${process.env.E2E_PORT ?? "4321"}`;

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
  const diagram = page.locator(".prose .mermaid-diagram");
  await expect(diagram).toBeVisible();
  await expect(diagram).toContainText("校验通过");
  const diagramBox = await diagram.locator("svg").boundingBox();
  expect(diagramBox?.width).toBeGreaterThan(200);
  expect(diagramBox?.height).toBeGreaterThan(50);
  expect(
    await diagram.evaluate((element) => getComputedStyle(element).overflowX),
  ).toBe("auto");
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
  const longFrame = page.locator(".code-frame--collapsible");
  await expect(longFrame).not.toHaveClass(/is-collapsed/);
  await expect(longFrame.locator("[data-code-expand-toggle]")).toBeHidden();
  expect(
    await longFrame
      .locator("pre")
      .evaluate((element) => element.scrollHeight <= element.clientHeight + 1),
  ).toBe(true);
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
  const longCode = page.locator(".code-frame--collapsible pre");
  expect(
    await longCode.evaluate(
      (element) => element.scrollHeight <= element.clientHeight + 1,
    ),
  ).toBe(true);
});

test("custom 404 sends readers back to current writing", async ({ page }) => {
  const response = await page.goto("/not-a-real-route/");

  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("没有");
  await expect(
    page.getByRole("link", { name: /写作|阅读/ }).first(),
  ).toBeVisible();
});

test("renders article context navigation cards and share actions", async ({
  context,
  page,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto(tutorialPath);

  // 1. Article Navigation (Prev / Next)
  const nav = page.locator(".article-navigation");
  await expect(nav).toBeVisible();
  const navCards = nav.locator(".article-nav-card");
  expect(await navCards.count()).toBeGreaterThanOrEqual(1);

  // 2. Article Share & Citation
  const share = page.locator("[data-article-share]");
  await expect(share).toBeVisible();
  const copyCitationBtn = share.locator('[data-share-action="copy-citation"]');
  await expect(copyCitationBtn).toBeVisible();
  await copyCitationBtn.click();
  const toast = share.locator("[data-share-toast]");
  await expect(toast).toHaveText("已复制 Markdown 引用");
  const clipboardText = await page.evaluate(() =>
    navigator.clipboard.readText(),
  );
  expect(clipboardText).toBe(
    `[实作：用 TypeScript 搭建可观测的 RAG 最小链路](${testOrigin}/writing/typescript-observable-rag-pipeline/) - 关山 / 海边的小卖部`,
  );
  await expect(toast).toHaveText("", { timeout: 2500 });

  const headingAnchor = page.locator(".prose h2 .heading-anchor").first();
  await expect(headingAnchor).toHaveAttribute("href", /^#/);
  await headingAnchor.click();
  const sectionUrl = await page.evaluate(() => navigator.clipboard.readText());
  expect(decodeURI(sectionUrl)).toBe(
    `${testOrigin}/writing/typescript-observable-rag-pipeline/#先定义可追踪的数据形状`,
  );
  await expect(
    page.locator(".prose h2 [data-heading-anchor-feedback]").first(),
  ).toHaveText("小节链接已复制");

  const codeBadge = page.locator(".code-lang-badge").first();
  await expect(codeBadge).toBeVisible();
});

test("long code expands and collapses with an accessible disclosure", async ({
  page,
}) => {
  await page.goto(tutorialPath);

  const frame = page.locator(".code-frame--collapsible");
  const toggle = frame.locator("[data-code-expand-toggle]");
  const code = frame.locator("pre");
  const controls = await toggle.getAttribute("aria-controls");

  expect(Number(await frame.getAttribute("data-line-count"))).toBeGreaterThan(
    35,
  );
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(code).toHaveAttribute("id", controls ?? "missing");
  expect(
    await code.evaluate(
      (element) => element.scrollHeight > element.clientHeight,
    ),
  ).toBe(true);

  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  expect(
    await code.evaluate(
      (element) => element.scrollHeight <= element.clientHeight + 1,
    ),
  ).toBe(true);

  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
});

test("share error feedback is distinct and remains Axe-clean", async ({
  page,
}) => {
  await page.goto(tutorialPath);
  await page.evaluate(() => {
    Object.defineProperty(navigator.clipboard, "writeText", {
      configurable: true,
      value: async () => Promise.reject(new Error("permission denied")),
    });
  });

  await page.locator('[data-share-action="copy-url"]').click();
  const toast = page.locator("[data-share-toast]");
  await expect(toast).toHaveText("复制失败，请重试");
  await expect(toast).toHaveAttribute("data-state", "error");

  const { violations } = await new AxeBuilder({ page })
    .include("[data-article-share]")
    .analyze();
  expect(
    violations.filter(({ impact }) =>
      ["serious", "critical"].includes(impact ?? ""),
    ),
  ).toEqual([]);
});

test("reduced motion skips the circular theme transition", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    const state = window as Window & { transitionCalls?: number };
    state.transitionCalls = 0;
    Object.defineProperty(document, "startViewTransition", {
      configurable: true,
      value: () => {
        state.transitionCalls = (state.transitionCalls ?? 0) + 1;
        return { ready: Promise.resolve() };
      },
    });
  });
  await page.goto(tutorialPath);

  await page.locator("[data-theme-control]").click();
  expect(
    await page.evaluate(
      () => (window as Window & { transitionCalls?: number }).transitionCalls,
    ),
  ).toBe(0);
});
