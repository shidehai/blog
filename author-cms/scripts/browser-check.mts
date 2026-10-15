import assert from "node:assert/strict";
import {
  chmod,
  mkdir,
  open,
  readFile,
  readdir,
  writeFile,
} from "node:fs/promises";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import path from "node:path";
import { chromium, expect, type Page } from "@playwright/test";
import { mediaSchema } from "@blog/content-contracts";
import { cmsPath } from "@blog/content-contracts/paths";
import { z } from "zod";
import sharp from "sharp";

async function capture(page: Page, filename: string) {
  await page.evaluate(() =>
    window.scrollTo({ top: 0, left: 0, behavior: "instant" }),
  );
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
  await page.screenshot({ path: filename, fullPage: true });
}

async function nativeBrowser(root: string) {
  const profile = path.join(root, "browser-profile");
  await mkdir(profile, { mode: 0o700 });
  const log = await open(path.join(root, "browser-process.log"), "w", 0o600);
  const process = spawn(
    chromium.executablePath(),
    [
      "--no-first-run",
      "--no-default-browser-check",
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--remote-debugging-address=127.0.0.1",
      "--remote-debugging-port=0",
      `--user-data-dir=${profile}`,
      "--window-size=1440,1100",
      "about:blank",
    ],
    { stdio: ["ignore", log.fd, log.fd] },
  );
  await log.close();
  try {
    for (let attempt = 0; attempt < 50; attempt++) {
      assert.equal(process.exitCode, null, "隔离 Chromium 意外退出");
      const portFile = await readFile(
        path.join(profile, "DevToolsActivePort"),
        "utf8",
      ).catch(() => "");
      const port = Number(portFile.split("\n")[0]);
      if (Number.isInteger(port) && port > 0) {
        const browser = await chromium.connectOverCDP(
          `http://127.0.0.1:${port}`,
          { noDefaults: true },
        );
        return { browser, process };
      }
      await delay(200);
    }
    throw new Error("隔离 Chromium 启动超时；Linux 请使用 xvfb-run");
  } catch (error) {
    process.kill("SIGTERM");
    throw error;
  }
}

// Only the isolated runtime harness calls this, after seeding its own _test DB.
// One Chromium, one context, sequential checks; no daily database or account.
export async function checkBrowser(preview: {
  cms: string;
  site: string;
  editor: string;
  logDirectory: string;
}) {
  // noDefaults applies only to the default CDP context. This is a fresh test
  // profile, never the user's browser; do not create an overridden new context.
  const { browser, process: browserProcess } = await nativeBrowser(
    preview.logDirectory,
  );
  const context = browser.contexts()[0];
  assert.ok(context);
  const errors: string[] = [];
  await context.tracing.start({
    screenshots: true,
    snapshots: true,
    sources: true,
  });
  await context.addInitScript(() => {
    // Inline listeners avoid tsx/esbuild's Node-only __name helper being
    // serialized into the browser with a named local callback.
    for (const type of ["focus", "blur", "visibilitychange"]) {
      const target = type === "visibilitychange" ? document : window;
      target.addEventListener(type, (event) => {
        if (!["http:", "https:"].includes(location.protocol)) return;
        const previous: unknown = JSON.parse(
          sessionStorage.getItem("native-events") || "[]",
        );
        const records: unknown[] = Array.isArray(previous) ? previous : [];
        records.push({
          type: event.type,
          trusted: event.isTrusted,
          visibility: document.visibilityState,
        });
        sessionStorage.setItem("native-events", JSON.stringify(records));
      });
    }
  });
  const editor = await context.newPage();
  const reader = await context.newPage();
  await editor.setViewportSize({ width: 1440, height: 1000 });
  await reader.setViewportSize({ width: 1440, height: 1000 });
  const cdp = await context.newCDPSession(editor);
  const downloads = path.join(preview.logDirectory, "downloads");
  await mkdir(downloads, { mode: 0o700 });
  await cdp.send("Browser.setDownloadBehavior", {
    behavior: "allowAndName",
    downloadPath: downloads,
    eventsEnabled: true,
  });
  for (const page of [editor, reader])
    page.on("pageerror", (error) => errors.push(error.message));
  try {
    await editor.bringToFront();
    await editor.goto(`${preview.cms}/login`);
    await editor
      .getByLabel("密码", { exact: true })
      .fill("isolated-preview-owner-2026");
    await editor.getByRole("button", { name: "进入写作空间" }).click();
    await expect(editor).toHaveURL(preview.cms);
    const navigation = editor.getByRole("navigation", { name: "后台导航" });
    await navigation.getByRole("link", { name: "媒体库", exact: true }).click();
    await expect(editor).toHaveURL(`${preview.cms}/media`);
    await expect(
      navigation.getByRole("link", { name: "媒体库", exact: true }),
    ).toHaveAttribute("aria-current", "page");
    await navigation
      .getByRole("link", { name: "站点资料", exact: true })
      .click();
    await expect(editor).toHaveURL(`${preview.cms}/settings`);
    await expect(editor.locator(".avatar-setting img")).toHaveAttribute(
      "src",
      cmsPath("/avatar.svg"),
    );
    await expect
      .poll(() =>
        editor
          .locator(".avatar-setting img")
          .evaluate(
            (image) =>
              image instanceof HTMLImageElement && image.naturalWidth > 0,
          ),
      )
      .toBe(true);
    const exportResponse = await context.request.get(
      `${preview.cms}/api/admin/export`,
    );
    assert.equal(exportResponse.status(), 200);
    assert.match(
      exportResponse.headers()["content-disposition"] ?? "",
      /attachment; filename=blog-content.json/,
    );
    await editor.getByRole("link", { name: "导出内容", exact: true }).click();
    // The native noDefaults CDP context does not forward Playwright's download
    // event. Verify the actual browser-written file, not just the API response.
    await expect
      .poll(
        async () =>
          (await readdir(downloads)).filter(
            (name) => !name.endsWith(".crdownload"),
          ).length,
      )
      .toBe(1);
    const [downloadedName] = (await readdir(downloads)).filter(
      (name) => !name.endsWith(".crdownload"),
    );
    assert.ok(downloadedName);
    const downloaded: unknown = JSON.parse(
      await readFile(path.join(downloads, downloadedName), "utf8"),
    );
    const expectedExport: unknown = await exportResponse.json();
    const exportSchema = z.object({
      data: z.record(z.string(), z.array(z.unknown())),
    });
    assert.deepEqual(
      exportSchema.parse(downloaded).data,
      exportSchema.parse(expectedExport).data,
    );
    const blogLink = editor.getByRole("link", {
      name: "查看博客",
      exact: true,
    });
    await expect(blogLink).toHaveAttribute("href", cmsPath("/blog"));
    const blogRedirect = await context.request.get(`${preview.cms}/blog`, {
      maxRedirects: 0,
    });
    assert.equal(blogRedirect.status(), 302);
    assert.equal(
      new URL(blogRedirect.headers().location!).origin,
      new URL(preview.site).origin,
    );
    await editor.goto(preview.editor);
    const title = "浏览器原生拖图与即时发布验收";
    await editor.getByLabel("文章标题", { exact: true }).fill(title);
    const body = editor.getByRole("textbox", { name: "Markdown 正文" });
    await expect(body).toBeVisible();
    await body.click();
    await editor.keyboard.press("Control+End");
    await editor.keyboard.insertText("\n\n原生拖图验收正文。\n\n");
    await editor.evaluate(() => {
      window.addEventListener(
        "drop",
        (event) => {
          sessionStorage.setItem(
            "native-drop",
            JSON.stringify({
              trusted: event.isTrusted,
              files: Array.from(event.dataTransfer?.files ?? []).map(
                (file) => ({ name: file.name, type: file.type }),
              ),
            }),
          );
        },
        { capture: true, once: true },
      );
    });
    const imagePath = path.join(
      preview.logDirectory,
      "native-browser-drop.png",
    );
    await sharp({
      create: { width: 480, height: 280, channels: 3, background: "#08776f" },
    })
      .png()
      .toFile(imagePath);
    await chmod(imagePath, 0o600);
    await body.scrollIntoViewIfNeeded();
    const box = await body.boundingBox();
    assert.ok(box);
    const data = { items: [], files: [imagePath], dragOperationsMask: 1 };
    const upload = editor.waitForResponse(
      (response) =>
        response.url() === `${preview.cms}/api/admin/media` &&
        response.request().method() === "POST",
    );
    for (const type of ["dragEnter", "dragOver", "drop"] as const) {
      await cdp.send("Input.dispatchDragEvent", {
        type,
        x: box.x + 80,
        y: box.y + Math.min(160, box.height / 2),
        data,
      });
    }
    const uploaded = await upload;
    assert.equal(uploaded.status(), 201);
    const media = mediaSchema.parse(await uploaded.json());
    await expect(body).toContainText(`/media/${media.id}`);
    const previewImage = editor.locator(
      `.preview-content img[src="${cmsPath(`/api/admin/media/${media.id}`)}"]`,
    );
    await expect(previewImage).toBeVisible();
    await expect
      .poll(() =>
        previewImage.evaluate(
          (image) => image instanceof HTMLImageElement && image.naturalWidth,
        ),
      )
      .toBe(480);
    const nativeDrop = z
      .object({
        trusted: z.boolean(),
        files: z.array(z.object({ name: z.string(), type: z.string() })),
      })
      .parse(
        JSON.parse(
          await editor.evaluate(
            () => sessionStorage.getItem("native-drop") || "null",
          ),
        ),
      );
    assert.deepEqual(nativeDrop, {
      trusted: true,
      files: [{ name: "native-browser-drop.png", type: "image/png" }],
    });
    assert.equal(
      (await context.request.get(`${preview.site}/media/${media.id}`)).status(),
      404,
    );
    await expect(editor.locator(".save-state")).toHaveText("已保存");
    await capture(
      editor,
      path.join(preview.logDirectory, "browser-editor-desktop.png"),
    );

    // A real previous not-found document and a prefetch transport response.
    // The product disables speculative Link prefetch; do not claim a populated
    // client prefetch cache when only this HTTP boundary was exercised.
    const articleUrl = `${preview.site}/archives/a-quiet-writing-room`;
    await reader.bringToFront();
    assert.equal((await reader.goto(articleUrl))?.status(), 404);
    await expect(
      reader.getByRole("heading", { name: "404", exact: true }),
    ).toBeVisible();
    const beforePrefetch = await context.request.get(articleUrl, {
      headers: { RSC: "1", "Next-Router-Prefetch": "1" },
    });
    // Dynamic App Router prefetch returns a 200 Flight shell even for a 404.
    // The real document above must still be 404, and this shell must not cache.
    assert.equal(beforePrefetch.status(), 200);
    assert.match(
      beforePrefetch.headers()["content-type"] || "",
      /text\/x-component/,
    );
    assert.match(await beforePrefetch.text(), /"S":false/);
    assert.match(beforePrefetch.headers()["cache-control"] || "", /no-store/);
    await reader.locator('.nav-links a[href="/about"]').click();
    await expect(reader).toHaveURL(`${preview.site}/about`);
    await expect(
      reader.getByRole("heading", { name: "关于这个博客" }),
    ).toBeVisible();
    await editor.bringToFront();
    await expect
      .poll(() => reader.evaluate(() => document.visibilityState))
      .toBe("hidden");
    await editor.getByRole("button", { name: "发布文章", exact: true }).click();
    await expect(editor.locator(".notice.success")).toContainText(
      "已发布，博客已更新。",
    );
    const focusReload = reader.waitForEvent(
      "framenavigated",
      (frame) => frame === reader.mainFrame(),
    );
    await reader.bringToFront();
    await focusReload;
    await reader.waitForLoadState("domcontentloaded");
    await expect
      .poll(() =>
        reader
          .evaluate(() => document.visibilityState)
          .catch(() => "navigating"),
      )
      .toBe("visible");
    await reader.goBack();
    await expect(
      reader.getByRole("heading", { level: 1, name: title, exact: true }),
    ).toBeVisible();
    await expect(reader.locator(".article-content")).toContainText(
      "原生拖图验收正文。",
    );
    const publishedBytes = await context.request.get(
      `${preview.site}/media/${media.id}`,
    );
    assert.equal(publishedBytes.status(), 200);
    assert.deepEqual(await publishedBytes.body(), await readFile(imagePath));
    const afterPrefetch = await context.request.get(articleUrl, {
      headers: { RSC: "1", "Next-Router-Prefetch": "1" },
    });
    assert.equal(afterPrefetch.status(), 200);
    assert.match(afterPrefetch.headers()["cache-control"] || "", /no-store/);
    await reader.goForward();
    await expect(
      reader.getByRole("heading", { name: "关于这个博客" }),
    ).toBeVisible();
    await reader.goBack();
    await expect(
      reader.getByRole("heading", { level: 1, name: title, exact: true }),
    ).toBeVisible();

    // Native tab activation changes visibility/focus; never dispatch JS events.
    await editor.bringToFront();
    await expect
      .poll(() => reader.evaluate(() => document.visibilityState))
      .toBe("hidden");
    const updatedTitle = "原生焦点恢复后已经显示最新文章";
    await editor.getByLabel("文章标题", { exact: true }).fill(updatedTitle);
    await body.click();
    await editor.keyboard.press("Control+End");
    await editor.keyboard.insertText("\n\n焦点恢复可见正文第二版。\n");
    await expect(editor.locator(".save-state")).toHaveText("已保存");
    await editor.getByRole("button", { name: "发布更新", exact: true }).click();
    await expect(editor.locator(".notice.success")).toBeVisible();
    await reader.bringToFront();
    await expect(
      reader.getByRole("heading", {
        level: 1,
        name: updatedTitle,
        exact: true,
      }),
    ).toBeVisible();
    await expect(reader.locator(".article-content")).toContainText(
      "焦点恢复可见正文第二版。",
    );
    const nativeEvents = z
      .array(
        z.object({
          type: z.string(),
          trusted: z.boolean(),
          visibility: z.enum(["visible", "hidden"]),
        }),
      )
      .parse(
        JSON.parse(
          await reader.evaluate(
            () => sessionStorage.getItem("native-events") || "[]",
          ),
        ),
      );
    assert.ok(
      nativeEvents.some(
        (event) =>
          event.type === "visibilitychange" &&
          event.visibility === "hidden" &&
          event.trusted,
      ),
    );
    assert.ok(
      nativeEvents.some(
        (event) =>
          event.type === "visibilitychange" &&
          event.visibility === "visible" &&
          event.trusted,
      ),
    );
    assert.ok(
      nativeEvents.some((event) => event.type === "focus" && event.trusted),
    );
    await capture(
      reader,
      path.join(preview.logDirectory, "browser-article-desktop.png"),
    );
    await reader.goto(`${preview.site}/tools`);
    await expect(reader.getByText("筹备中", { exact: true })).toHaveCount(6);
    await expect(reader.getByText("打开", { exact: true })).toHaveCount(0);
    await capture(
      reader,
      path.join(preview.logDirectory, "browser-tools-desktop.png"),
    );
    await reader.setViewportSize({ width: 390, height: 844 });
    await expect
      .poll(() =>
        reader
          .locator(".nav-logo")
          .evaluate((element) => element.getBoundingClientRect().height <= 44),
      )
      .toBe(true);
    await expect
      .poll(() =>
        reader
          .locator(".toolbox-header > span")
          .evaluate((element) => element.getBoundingClientRect().height <= 24),
      )
      .toBe(true);
    await expect
      .poll(() =>
        reader.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      )
      .toBe(true);
    await capture(
      reader,
      path.join(preview.logDirectory, "browser-tools-mobile.png"),
    );
    await reader.goto(articleUrl);
    await expect(
      reader.getByRole("heading", {
        level: 1,
        name: updatedTitle,
        exact: true,
      }),
    ).toBeVisible();
    await expect
      .poll(() =>
        reader.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      )
      .toBe(true);
    await capture(
      reader,
      path.join(preview.logDirectory, "browser-article-mobile.png"),
    );
    await editor.bringToFront();
    await editor.setViewportSize({ width: 390, height: 844 });
    await expect
      .poll(() =>
        editor
          .locator(".studio-sidebar")
          .evaluate((element) => element.getBoundingClientRect().right <= 0),
      )
      .toBe(true);
    await expect
      .poll(() =>
        editor.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      )
      .toBe(true);
    await capture(
      editor,
      path.join(preview.logDirectory, "browser-editor-mobile.png"),
    );

    await editor.bringToFront();
    await editor.getByRole("button", { name: "文章属性", exact: true }).click();
    await editor
      .getByRole("button", { name: "归档这篇内容", exact: true })
      .click();
    await editor.getByRole("button", { name: "确认归档", exact: true }).click();
    await expect(editor.locator(".status-badge")).toHaveText("已归档");
    await reader.bringToFront();
    await expect(
      reader.getByRole("heading", { name: "404", exact: true }),
    ).toBeVisible();
    assert.equal(
      (await context.request.get(`${preview.site}/media/${media.id}`)).status(),
      404,
    );
    assert.ok(
      !(
        await (await context.request.get(`${preview.site}/sitemap.xml`)).text()
      ).includes("a-quiet-writing-room"),
    );
    await editor.bringToFront();
    await editor.setViewportSize({ width: 1440, height: 1000 });
    await editor.getByRole("button", { name: "退出登录", exact: true }).click();
    await expect(editor).toHaveURL(`${preview.cms}/login`);
    assert.equal(
      (await context.request.get(`${preview.cms}/api/admin/contents`)).status(),
      401,
    );
    assert.equal(
      (
        await context.request.get(`${preview.cms}/api/admin/media/${media.id}`)
      ).status(),
      401,
    );
    assert.deepEqual(errors, [], "浏览器不得产生未处理页面错误");
    const evidence = {
      passed: true,
      chromium: browser.version(),
      nativeBrowserDefaults: true,
      nativeDrop,
      nativeEvents,
      checks: [
        "trusted CDP file drop and live preview",
        "published image exact bytes and revocation",
        "UI publish from previous 404 and real back/forward",
        "trusted native focus/visibility reloads visible title and body",
        "RSC prefetch transport no-store before/after publication",
        "desktop/mobile overflow and planned tool states",
        "UI archive refreshes existing reader to 404",
        "/admin navigation, active sidebar, JSON download, blog link and logout",
      ],
      limits: [
        "CDP injects trusted browser file gestures; no physical desktop file-manager drag",
        "Link speculative prefetch remains disabled; no claim of populated client prefetch cache",
      ],
    };
    const evidencePath = path.join(
      preview.logDirectory,
      "browser-evidence.json",
    );
    await writeFile(evidencePath, JSON.stringify(evidence, null, 2), {
      mode: 0o600,
    });
    console.log(`browser checks status=success evidence=${evidencePath}`);
  } catch (error) {
    await editor
      .screenshot({
        path: path.join(preview.logDirectory, "browser-failure-editor.png"),
        fullPage: true,
      })
      .catch(() => {});
    await reader
      .screenshot({
        path: path.join(preview.logDirectory, "browser-failure-reader.png"),
        fullPage: true,
      })
      .catch(() => {});
    throw error;
  } finally {
    const trace = path.join(preview.logDirectory, "browser-trace.zip");
    await context.tracing.stop({ path: trace });
    await chmod(trace, 0o600);
    await browser.close();
    browserProcess.kill("SIGTERM");
  }
}
