import { expect, test } from "@playwright/test";

const viewports = [
  { width: 320, height: 800 },
  { width: 768, height: 1024 },
  { width: 1440, height: 1000 },
  { width: 1920, height: 1080 },
] as const;

for (const viewport of viewports) {
  test(`keeps Home readable at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");

    const feature = page.locator(".feature-post");
    await expect(feature).toBeVisible();
    const featureBox = await feature.boundingBox();
    expect(featureBox?.y).toBeLessThan(viewport.height);

    const dimensions = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
  });
}

test("mobile navigation closes by control or Escape and restores focus", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/");

  const trigger = page.getByRole("button", { name: "打开导航菜单" });
  const menu = page.locator("#mobile-navigation");
  await trigger.click();
  await expect(menu).toBeVisible();
  await expect(menu.getByRole("link", { name: "写作" })).toBeVisible();

  await menu.getByRole("button", { name: "关闭导航菜单" }).click();
  await expect(menu).toBeHidden();
  await expect(trigger).toBeFocused();

  await trigger.click();
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("theme choice persists and is applied on reload", async ({ page }) => {
  await page.goto("/");
  const theme = page.getByRole("button", { name: "主题：系统" });

  await theme.click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.getByRole("button", { name: "主题：浅色" })).toBeVisible();

  await page.getByRole("button", { name: "主题：浅色" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.getByRole("button", { name: "主题：深色" })).toBeVisible();
});

test("skip link and current route remain explicit", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");

  await page.keyboard.press("Tab");
  const skipLink = page.getByRole("link", { name: "跳到正文" });
  await expect(skipLink).toBeFocused();
  await skipLink.press("Enter");
  await expect(page.locator("#main-content")).toBeFocused();

  await expect(
    page.getByRole("navigation", { name: "主导航" }).getByRole("link", {
      name: "首页",
    }),
  ).toHaveAttribute("aria-current", "page");
});

test("header compresses without changing its reserved frame", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 800 });
  await page.goto("/");

  const frame = page.locator(".site-header-frame");
  const initialHeight = await frame.evaluate((element) => element.clientHeight);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect(page.locator("[data-site-header]")).toHaveAttribute(
    "data-compact",
    "true",
  );
  expect(await frame.evaluate((element) => element.clientHeight)).toBe(
    initialHeight,
  );
});

test("two hundred percent text size reflows without header overlap", async ({
  page,
}) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto("/");
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "212.5%";
  });

  const layout = await page.evaluate(() => {
    const brand = document
      .querySelector(".site-brand")
      ?.getBoundingClientRect();
    const actions = document
      .querySelector(".header-actions")
      ?.getBoundingClientRect();
    return {
      brandRight: brand?.right ?? 0,
      actionsLeft: actions?.left ?? 0,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    };
  });

  expect(layout.brandRight).toBeLessThanOrEqual(layout.actionsLeft);
  expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth);
});

test("reduced motion and forced colors retain visible structure", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce", forcedColors: "active" });
  await page.goto("/");

  const feature = page.locator(".feature-post");
  await expect(feature).toBeVisible();
  expect(
    await feature.evaluate((element) => getComputedStyle(element).borderStyle),
  ).toBe("solid");
  const duration = await feature.evaluate((element) =>
    Number.parseFloat(getComputedStyle(element).animationDuration),
  );
  expect(duration).toBeLessThan(0.001);
});
