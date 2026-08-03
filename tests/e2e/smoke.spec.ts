import { expect, test } from "@playwright/test";

test("serves the foundation page and health check", async ({
  page,
  request,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "博客基础设施已就绪" }),
  ).toBeVisible();

  const health = await request.get("/healthz");
  expect(health.ok()).toBe(true);
  expect(await health.text()).toBe("ok\n");
});
