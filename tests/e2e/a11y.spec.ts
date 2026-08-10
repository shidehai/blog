import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const routes = [
  "/",
  "/writing/typescript-observable-rag-pipeline/",
  "/notes/",
  "/search/",
  "/about/",
  "/missing-page/",
] as const;

test("dense tutorial has no serious accessibility violations in dark mode", async ({
  page,
}) => {
  await page.addInitScript(() => localStorage.setItem("pkj-theme", "dark"));
  await page.goto("/writing/typescript-observable-rag-pipeline/");

  const { violations } = await new AxeBuilder({ page }).analyze();
  const serious = violations.filter(({ impact }) =>
    ["serious", "critical"].includes(impact ?? ""),
  );

  expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
});

for (const route of routes) {
  test(`${route} has no serious accessibility violations`, async ({ page }) => {
    await page.goto(route);

    const { violations } = await new AxeBuilder({ page }).analyze();
    const serious = violations.filter(({ impact }) =>
      ["serious", "critical"].includes(impact ?? ""),
    );

    expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
  });
}

test("protected preview has no serious accessibility violations", async ({
  page,
}) => {
  await page.setExtraHTTPHeaders({
    "x-preview-trusted": "test-preview-header-at-least-24-chars",
  });
  await page.goto("/preview/f2000000-0000-4000-8000-000000000103");

  const { violations } = await new AxeBuilder({ page }).analyze();
  const serious = violations.filter(({ impact }) =>
    ["serious", "critical"].includes(impact ?? ""),
  );

  expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
});
