import { expect, test } from "@playwright/test";

const previewPath = "/preview/f2000000-0000-4000-8000-000000000003";
const trustedHeader = "test-preview-header-at-least-24-chars";

test("preview fails closed without the proxy trust boundary", async ({
  request,
}) => {
  const response = await request.get(previewPath);

  expect(response.status()).toBe(404);
  expect(response.headers()["cache-control"]).toBe("private, no-store");
  expect(response.headers()["x-robots-tag"]).toBe("noindex, nofollow");
  expect(await response.text()).toBe("预览不可用\n");
});

test("trusted preview reuses the public post layout without leaking secrets", async ({
  page,
}) => {
  await page.setExtraHTTPHeaders({ "x-preview-trusted": trustedHeader });
  const response = await page.goto(`${previewPath}?version=draft`);

  expect(response?.status()).toBe(200);
  expect(response?.headers()["cache-control"]).toBe("private, no-store");
  expect(response?.headers()["x-robots-tag"]).toBe("noindex, nofollow");
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "示例教程：验证一份发布快照",
    }),
  ).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    "noindex, nofollow",
  );
  expect(await page.content()).not.toContain(
    "test-preview-token-at-least-24-chars",
  );
});

test("preview rejects malformed version selectors", async ({ request }) => {
  const response = await request.get(`${previewPath}?version=../../secret`, {
    headers: { "x-preview-trusted": trustedHeader },
  });

  expect(response.status()).toBe(404);
});
