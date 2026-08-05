import { expect, test } from "@playwright/test";

const tutorialPath = "/writing/validate-a-published-snapshot/";

test("all public discovery routes are reachable without authentication", async ({
  request,
}) => {
  const routes = [
    "/writing/",
    "/notes/",
    "/topics/",
    "/topics/astro/",
    "/search/",
    "/about/",
    "/archive/",
    "/rss.xml",
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
  await expect(page.locator(".prose .callout")).toBeVisible();
  await expect(page.locator(".prose .footnotes")).toBeVisible();
  await expect(page.locator(".prose .code-frame")).toBeVisible();

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
    "loadFixturePosts",
  );
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
      name: "示例教程：验证一份发布快照",
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
  await expect(page.locator("[data-copy-code]")).toBeHidden();
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
