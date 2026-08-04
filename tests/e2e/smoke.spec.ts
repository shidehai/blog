import { expect, test } from "@playwright/test";

test("serves the public shell and health check", async ({ page, request }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      name: "从一次失败回滚，设计真正可恢复的静态发布流水线",
    }),
  ).toBeVisible();
  await expect(page.getByRole("navigation", { name: "主导航" })).toBeVisible();

  const health = await request.get("/healthz");
  expect(health.ok()).toBe(true);
  expect(await health.text()).toBe("ok\n");
});
