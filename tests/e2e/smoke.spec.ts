import { expect, test } from "@playwright/test";

test("serves the public shell and health check", async ({ page, request }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      name: "从演示到生产：LLM 应用的五层可靠性边界",
    }),
  ).toBeVisible();
  await expect(page.getByRole("navigation", { name: "主导航" })).toBeVisible();

  const health = await request.get("/healthz");
  expect(health.ok()).toBe(true);
  expect(await health.text()).toBe("ok\n");
});
