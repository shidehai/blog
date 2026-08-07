import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const baseUrl = process.argv[2] ?? "http://127.0.0.1:4321/";
const outputDir = path.resolve(
  process.argv[3] ??
    ".trellis/tasks/08-05-aiayy-visual-rebuild/research/local-baseline",
);
const viewports = [
  { name: "390x844", width: 390, height: 844 },
  { name: "768x1024", width: 768, height: 1024 },
  { name: "1440x900", width: 1440, height: 900 },
];
const selectors = [
  "html",
  "body",
  ".site-header-frame",
  ".site-header",
  ".site-brand",
  ".desktop-navigation",
  ".header-actions",
  ".home-page",
  ".home-intro-grid",
  ".feature-post",
  ".identity-module",
  ".home-secondary-grid",
  ".shortcut-grid",
  ".site-footer",
];

const roundedRect = (rect) =>
  rect
    ? Object.fromEntries(
        ["x", "y", "width", "height", "top", "right", "bottom", "left"].map(
          (key) => [key, Math.round(rect[key] * 100) / 100],
        ),
      )
    : null;

await mkdir(outputDir, { recursive: true });
const browser = await chromium.launch();
const report = { baseUrl, capturedAt: new Date().toISOString(), viewports: {} };

try {
  for (const viewport of viewports) {
    report.viewports[viewport.name] = {};

    for (const theme of ["light", "dark"]) {
      const context = await browser.newContext({
        colorScheme: "light",
        viewport: { width: viewport.width, height: viewport.height },
      });
      const page = await context.newPage();
      await page.addInitScript((selectedTheme) => {
        localStorage.setItem("pkj-theme", selectedTheme);
      }, theme);
      await page.goto(baseUrl, { waitUntil: "networkidle" });
      await page.locator(".home-page").waitFor({ state: "visible" });
      await page.screenshot({
        fullPage: true,
        path: path.join(outputDir, `home-${viewport.name}-${theme}.png`),
      });

      const measurements = await page.evaluate((targets) => {
        const result = {};
        for (const selector of targets) {
          const element = document.querySelector(selector);
          if (!(element instanceof HTMLElement)) {
            result[selector] = null;
            continue;
          }
          const style = getComputedStyle(element);
          result[selector] = {
            rect: element.getBoundingClientRect().toJSON(),
            display: style.display,
            backgroundColor: style.backgroundColor,
            color: style.color,
            borderRadius: style.borderRadius,
            boxShadow: style.boxShadow,
            fontFamily: style.fontFamily,
            fontSize: style.fontSize,
            lineHeight: style.lineHeight,
            padding: style.padding,
            gap: style.gap,
          };
        }
        return result;
      }, selectors);

      for (const value of Object.values(measurements)) {
        if (value?.rect) value.rect = roundedRect(value.rect);
      }
      report.viewports[viewport.name][theme] = measurements;

      if (theme === "light") {
        await page.evaluate(() => window.scrollTo(0, 300));
        await page
          .locator("[data-site-header]")
          .waitFor({ state: "visible" });
        await page.waitForTimeout(350);
        await page.screenshot({
          path: path.join(outputDir, `home-${viewport.name}-scrolled.png`),
        });

        if (viewport.width <= 768) {
          await page.evaluate(() => window.scrollTo(0, 0));
          await page.getByRole("button", { name: "打开导航菜单" }).click();
          await page.locator("#mobile-navigation").waitFor({ state: "visible" });
          await page.screenshot({
            path: path.join(outputDir, `home-${viewport.name}-menu-open.png`),
          });
        }
      }

      await context.close();
    }
  }
} finally {
  await browser.close();
}

await writeFile(
  path.join(outputDir, "computed-measurements.json"),
  `${JSON.stringify(report, null, 2)}\n`,
);
