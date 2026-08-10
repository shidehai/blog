import { expect, test, type Page } from "@playwright/test";

import {
  computedMaterial,
  expectBoxNear,
  expectMinimumHitTarget,
  expectNoHorizontalOverflow,
  measuredBox,
} from "./visual-assertions";

const THEME_STORAGE_KEY = "pkj-theme";
const DESKTOP_VIEWPORT = { width: 1440, height: 1000 } as const;
const MOBILE_VIEWPORT = { width: 390, height: 844 } as const;

const themes = {
  dark: {
    background: "rgb(30, 30, 42)",
    compactRaised:
      "rgb(22, 22, 31) 3px 3px 6px 0px, rgb(40, 40, 56) -3px -3px 6px 0px",
    floating:
      "rgb(22, 22, 31) 6px 6px 14px 0px, rgb(40, 40, 56) -6px -6px 14px 0px",
    ink: "rgb(224, 224, 236)",
    inset:
      "rgb(22, 22, 31) 4px 4px 8px 0px inset, rgb(40, 40, 56) -4px -4px 8px 0px inset",
    raised:
      "rgb(22, 22, 31) 6px 6px 14px 0px, rgb(40, 40, 56) -6px -6px 14px 0px",
    raisedSurface: "rgb(36, 36, 51)",
    pressed:
      "rgb(22, 22, 31) 2px 2px 5px 0px inset, rgb(40, 40, 56) -2px -2px 5px 0px inset",
  },
  light: {
    background: "rgb(232, 230, 227)",
    compactRaised:
      "rgb(200, 198, 195) 3px 3px 6px 0px, rgb(255, 255, 255) -3px -3px 6px 0px",
    floating:
      "rgb(200, 198, 195) 8px 8px 20px 0px, rgb(255, 255, 255) -8px -8px 20px 0px",
    ink: "rgb(58, 58, 74)",
    inset:
      "rgb(200, 198, 195) 4px 4px 8px 0px inset, rgb(255, 255, 255) -4px -4px 8px 0px inset",
    raised:
      "rgb(200, 198, 195) 6px 6px 14px 0px, rgb(255, 255, 255) -6px -6px 14px 0px",
    raisedSurface: "rgb(232, 230, 227)",
    pressed:
      "rgb(200, 198, 195) 2px 2px 5px 0px inset, rgb(255, 255, 255) -2px -2px 5px 0px inset",
  },
} as const;

type Theme = keyof typeof themes;

async function installStoredTheme(page: Page, theme: Theme): Promise<void> {
  await page.addInitScript(
    ({ key, selectedTheme }) => {
      try {
        localStorage.setItem(key, selectedTheme);
      } catch {
        // about:blank has no storage origin; the script runs again on navigation.
      }
    },
    { key: THEME_STORAGE_KEY, selectedTheme: theme },
  );
}

async function settleLayout(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      }),
  );
}

async function scrollToAndSettle(page: Page, y: number): Promise<void> {
  await page.evaluate((scrollY) => window.scrollTo(0, scrollY), y);
  await settleLayout(page);
}

async function layoutViewportWidth(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.clientWidth);
}

function durationInMilliseconds(value: string): number {
  return Math.max(
    ...value.split(",").map((entry) => {
      const duration = entry.trim();
      return Number.parseFloat(duration) * (duration.endsWith("ms") ? 1 : 1000);
    }),
  );
}

for (const theme of Object.keys(themes) as Theme[]) {
  test(`${theme} theme exposes the calibrated material tokens`, async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize(DESKTOP_VIEWPORT);
    await installStoredTheme(page, theme);
    await page.goto("/");

    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    const body = await computedMaterial(page.locator("body"));
    const header = await computedMaterial(page.locator(".site-header"));
    const signal = await page.locator("body").evaluate((element) => {
      const probe = document.createElement("span");
      probe.style.color = "var(--signal)";
      element.append(probe);
      const color = getComputedStyle(probe).color;
      probe.remove();
      return color;
    });

    expect(body.backgroundColor).toBe(themes[theme].background);
    expect(body.color).toBe(themes[theme].ink);
    expect(body.fontFamily).toMatch(/^"?Inter"?,/);
    expect(body.fontSize).toBe("16px");
    expect(["0px", "normal"]).toContain(body.letterSpacing);
    expect(signal).toBe("rgb(74, 143, 231)");
    expect(header.backgroundColor).toBe(themes[theme].background);
    expect(header.borderRadius).toBe("30px");
    expect(header.boxShadow).toBe(themes[theme].raised);

    await page.goto("/writing/");
    const nestedRow = await computedMaterial(page.locator(".post-row").first());
    expect(nestedRow.backgroundColor).toBe(themes[theme].raisedSurface);
  });
}

test("desktop shell reproduces the measured container and Bento geometry", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize(DESKTOP_VIEWPORT);
  await installStoredTheme(page, "light");
  await page.goto("/");

  // The stable scrollbar gutter intentionally prevents route-to-route layout
  // shift, so content centers within the document's client area.
  const layoutWidth = await layoutViewportWidth(page);
  const pageX = (layoutWidth - 1200) / 2;

  expectBoxNear(await measuredBox(page.locator(".site-header")), {
    height: 68,
    width: 1200,
    x: pageX,
    y: 16,
  });
  expectBoxNear(await measuredBox(page.locator(".home-page")), {
    width: 1200,
    x: pageX,
  });

  const identity = await measuredBox(page.locator(".identity-module"));
  const feature = await measuredBox(page.locator(".feature-post"));
  expectBoxNear(identity, { width: 320, x: pageX });
  expectBoxNear(feature, { width: 856, x: pageX + 344 });
  expectBoxNear(feature, { height: identity.height, y: identity.y });

  const intro = await computedMaterial(page.locator(".home-intro-grid"));
  const identityMaterial = await computedMaterial(
    page.locator(".identity-module"),
  );
  expect(intro.columnGap).toBe("24px");
  expect(identityMaterial.borderRadius).toBe("30px");
  expect(identityMaterial.boxShadow).toBe(themes.light.raised);

  const note = await measuredBox(page.locator(".home-note-signal"));
  const snapshot = await measuredBox(page.locator(".home-snapshot"));
  const discovery = await measuredBox(page.locator(".home-discovery-signal"));
  expectBoxNear(note, { width: 516, x: pageX });
  expectBoxNear(snapshot, { width: 516, x: pageX + 540, y: note.y });
  expectBoxNear(discovery, { width: 120, x: pageX + 1080, y: note.y });

  const topics = await measuredBox(page.locator(".topics-module"));
  const paths = await measuredBox(page.locator(".discovery-module"));
  expectBoxNear(topics, { width: 588, x: pageX });
  expectBoxNear(paths, { width: 588, x: pageX + 612, y: topics.y });

  const writingMaterial = await computedMaterial(
    page.locator(".home-writing-module"),
  );
  expect(writingMaterial.borderRadius).toBe("30px");
  expect(writingMaterial.boxShadow).toBe(themes.light.inset);
  await expectMinimumHitTarget(page.locator(".navigation-link").first());
});

test("featured copy and media occupy separate grid cells", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await installStoredTheme(page, "light");

  for (const width of [1440, 1024] as const) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/");

    const feature = await measuredBox(page.locator(".feature-post"));
    const copy = await measuredBox(page.locator(".feature-post-copy"));
    const media = await measuredBox(page.locator(".feature-post-media"));
    const title = await measuredBox(page.locator(".feature-post h2"));
    const action = await measuredBox(page.locator(".feature-action"));
    const image = page.locator(".feature-post-media img");

    expect(copy.x + copy.width).toBeLessThanOrEqual(media.x + 1);
    expectBoxNear(copy, { x: feature.x, y: feature.y });
    expectBoxNear(media, {
      height: feature.height,
      x: copy.x + copy.width,
      y: feature.y,
    });
    expect(media.x + media.width).toBeLessThanOrEqual(
      feature.x + feature.width + 1,
    );
    expect(title.x + title.width).toBeLessThanOrEqual(copy.x + copy.width + 1);
    expect(action.y + action.height).toBeLessThanOrEqual(
      feature.y + feature.height + 1,
    );
    await expect(image).toHaveJSProperty("complete", true);
    expect(
      await image.evaluate((element) =>
        element instanceof HTMLImageElement ? element.naturalWidth : 0,
      ),
    ).toBeGreaterThan(0);
    expect(
      await image.evaluate(
        (element) => getComputedStyle(element).objectPosition,
      ),
    ).toBe("85% 58%");
    await expect(image).toHaveAttribute(
      "sizes",
      "(max-width: 48rem) calc(100vw - 2rem), (max-width: 56rem) calc(36vw - 8rem), (max-width: 64rem) calc(40vw - 8.8rem), (max-width: 78rem) calc(40vw - 9.8rem), 21.5rem",
    );
    await expectNoHorizontalOverflow(page);
  }
});

test("1024px is the inclusive navigation and tablet-grid breakpoint", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await installStoredTheme(page, "light");
  await page.setViewportSize({ width: 1025, height: 900 });
  await page.goto("/");

  await expect(page.locator(".desktop-navigation")).toBeVisible();
  await expect(page.locator(".mobile-navigation-trigger")).toBeHidden();
  const wideIdentity = await measuredBox(page.locator(".identity-module"));
  const wideFeature = await measuredBox(page.locator(".feature-post"));
  expectBoxNear(wideIdentity, { width: 320 });
  expectBoxNear(wideFeature, { y: wideIdentity.y });
  expect(
    (await computedMaterial(page.locator(".feature-post h2"))).fontSize,
  ).toBe("40px");

  await page.setViewportSize({ width: 1024, height: 900 });
  await settleLayout(page);
  await expect(page.locator(".desktop-navigation")).toBeHidden();
  await expect(page.locator(".mobile-navigation-trigger")).toBeVisible();
  await expect(page.locator(".feature-post-media img")).toHaveAttribute(
    "sizes",
    /\(max-width: 64rem\)/,
  );
  const tabletIdentity = await measuredBox(page.locator(".identity-module"));
  const tabletFeature = await measuredBox(page.locator(".feature-post"));
  expectBoxNear(tabletIdentity, { width: 280 });
  expectBoxNear(tabletFeature, { y: tabletIdentity.y });
  expect(
    (await computedMaterial(page.locator(".feature-post h2"))).fontSize,
  ).toBe("32px");
});

test("768px stacks hero and bottom modules with featured writing first", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await installStoredTheme(page, "light");
  await page.setViewportSize({ width: 769, height: 1024 });
  await page.goto("/");

  const wideIdentity = await measuredBox(page.locator(".identity-module"));
  const wideFeature = await measuredBox(page.locator(".feature-post"));
  const wideTopics = await measuredBox(page.locator(".topics-module"));
  const widePaths = await measuredBox(page.locator(".discovery-module"));
  expectBoxNear(wideFeature, { y: wideIdentity.y });
  expectBoxNear(widePaths, { y: wideTopics.y });
  expect(
    (await computedMaterial(page.locator(".feature-post h2"))).fontSize,
  ).toBe("32px");

  await page.setViewportSize({ width: 768, height: 1024 });
  await settleLayout(page);
  const layoutWidth = await layoutViewportWidth(page);
  const feature = await measuredBox(page.locator(".feature-post"));
  const identity = await measuredBox(page.locator(".identity-module"));
  const topics = await measuredBox(page.locator(".topics-module"));
  const paths = await measuredBox(page.locator(".discovery-module"));
  expectBoxNear(feature, { width: layoutWidth - 32, x: 16 });
  expectBoxNear(identity, { width: layoutWidth - 32, x: 16 });
  expect(feature.y).toBeLessThan(identity.y);
  expect(topics.y).toBeLessThan(paths.y);
  expect(
    (await computedMaterial(page.locator(".feature-post h2"))).fontSize,
  ).toBe("32px");
  expect(
    (await computedMaterial(page.locator(".identity-module"))).borderRadius,
  ).toBe("24px");

  const featurePrecedesIdentity = await page.evaluate(() => {
    const featureElement = document.querySelector(".feature-post");
    const identityElement = document.querySelector(".identity-module");
    return Boolean(
      featureElement &&
      identityElement &&
      featureElement.compareDocumentPosition(identityElement) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });
  expect(featurePrecedesIdentity).toBe(true);
});

test("640px is the inclusive single-column information breakpoint", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await installStoredTheme(page, "light");
  await page.setViewportSize({ width: 641, height: 1000 });
  await page.goto("/");

  const wideNote = await measuredBox(page.locator(".home-note-signal"));
  const wideSnapshot = await measuredBox(page.locator(".home-snapshot"));
  const wideDiscovery = await measuredBox(
    page.locator(".home-discovery-signal"),
  );
  expectBoxNear(wideSnapshot, { y: wideNote.y });
  expect(wideDiscovery.y).toBeGreaterThan(wideNote.y);
  expect(
    (await computedMaterial(page.locator(".feature-post h2"))).fontSize,
  ).toBe("32px");

  await page.setViewportSize({ width: 640, height: 1000 });
  await settleLayout(page);
  const layoutWidth = await layoutViewportWidth(page);
  const note = await measuredBox(page.locator(".home-note-signal"));
  const snapshot = await measuredBox(page.locator(".home-snapshot"));
  const discovery = await measuredBox(page.locator(".home-discovery-signal"));
  expectBoxNear(note, { width: layoutWidth - 32, x: 16 });
  expectBoxNear(snapshot, { width: layoutWidth - 32, x: 16 });
  expectBoxNear(discovery, { width: layoutWidth - 32, x: 16 });
  expect(note.y).toBeLessThan(snapshot.y);
  expect(snapshot.y).toBeLessThan(discovery.y);
  expect(
    (await computedMaterial(page.locator(".feature-post h2"))).fontSize,
  ).toBe("28px");
});

test("topic selector keeps its measured three, two, and one-column geometry", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await installStoredTheme(page, "light");

  for (const layout of [
    { cardWidth: 284, columns: 3, gridWidth: 900, width: 1440 },
    { cardWidth: 284, columns: 3, gridWidth: 900, width: 1024 },
    { cardWidth: 224, columns: 3, gridWidth: 720, width: 768 },
    { cardWidth: 284, columns: 2, gridWidth: 592, width: 640 },
    { cardWidth: 342, columns: 1, gridWidth: 342, width: 390 },
  ] as const) {
    await page.setViewportSize({ width: layout.width, height: 1000 });
    await page.goto("/topics/");

    const directory = page.locator(".topic-directory");
    const cards = directory.locator(".topic-directory-card");
    const first = await measuredBox(cards.first());
    const firstInNextRow = await measuredBox(cards.nth(layout.columns));
    const directoryBox = await measuredBox(directory);

    await expect(cards).toHaveCount(6);
    expectBoxNear(directoryBox, { width: layout.gridWidth });
    expectBoxNear(first, { height: 234, width: layout.cardWidth });
    expectBoxNear(firstInNextRow, {
      x: first.x,
      y: first.y + first.height + 24,
    });
    if (layout.columns > 1) {
      const second = await measuredBox(cards.nth(1));
      expectBoxNear(second, {
        width: layout.cardWidth,
        x: first.x + first.width + 24,
        y: first.y,
      });
    }

    const heading = await computedMaterial(page.locator(".page-heading h1"));
    const lead = await computedMaterial(page.locator(".page-heading p"));
    const marker = await measuredBox(
      cards.first().locator(".topic-directory-mark"),
    );
    expect(heading.fontSize).toBe("32px");
    expect(lead.fontSize).toBe("16px");
    expectBoxNear(marker, { height: 64, width: 64 });
    expect((await computedMaterial(cards.first())).borderRadius).toBe(
      layout.width <= 768 ? "24px" : "30px",
    );
    await expect(cards.first().locator("h2")).toBeVisible();
    await expect(cards.first().locator(".topic-directory-count")).toHaveText(
      /\d+ 篇内容/,
    );
    await expectMinimumHitTarget(cards.first());
    await expectNoHorizontalOverflow(page);
  }
});

test("topic cards expose raised, lifted, focused, and pressed states", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize(DESKTOP_VIEWPORT);
  await installStoredTheme(page, "light");
  await page.goto("/topics/");

  const card = page.locator(".topic-directory-card").first();
  expect((await computedMaterial(card)).boxShadow).toBe(themes.light.raised);

  await card.hover();
  await settleLayout(page);
  expect((await computedMaterial(card)).boxShadow).toBe(themes.light.floating);

  await card.focus();
  await expect(card).toBeFocused();
  const focusedShadow = (await computedMaterial(card)).boxShadow;
  expect(focusedShadow).toContain("rgb(35, 103, 186)");
  expect(focusedShadow).toContain("8px 8px 20px");
  expect(
    durationInMilliseconds((await computedMaterial(card)).transitionDuration),
  ).toBeLessThanOrEqual(0.01);

  const box = await measuredBox(card);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await settleLayout(page);
  expect((await computedMaterial(card)).boxShadow).toBe(themes.light.pressed);
  await page.mouse.move(0, 0);
  await page.mouse.up();
});

test("topic cards and featured copy expand at two hundred percent text", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize(DESKTOP_VIEWPORT);

  await page.goto("/topics/");
  await page.locator("html").evaluate((element) => {
    element.style.fontSize = "200%";
  });
  await settleLayout(page);
  const topicCard = page.locator(".topic-directory-card").first();
  const topicDimensions = await topicCard.evaluate((element) => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
  }));
  expect(topicDimensions.clientHeight).toBeGreaterThan(234);
  expect(topicDimensions.scrollHeight).toBeLessThanOrEqual(
    topicDimensions.clientHeight,
  );
  await expectNoHorizontalOverflow(page);

  await page.goto("/");
  await page.locator("html").evaluate((element) => {
    element.style.fontSize = "200%";
  });
  await settleLayout(page);
  const feature = await measuredBox(page.locator(".feature-post"));
  const copy = page.locator(".feature-post-copy");
  const title = page.locator(".feature-post h2");
  const copyDimensions = await copy.evaluate((element) => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
  }));
  const titleBox = await measuredBox(title);
  expect(copyDimensions.scrollHeight).toBeLessThanOrEqual(
    copyDimensions.clientHeight,
  );
  expect(titleBox.y + titleBox.height).toBeLessThanOrEqual(
    feature.y + feature.height + 1,
  );
  await expectNoHorizontalOverflow(page);
});

test("header compacts only above 100px without shrinking accessible targets", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1440, height: 800 });
  await installStoredTheme(page, "light");
  await page.goto("/");

  const frame = page.locator(".site-header-frame");
  const header = page.locator(".site-header");
  const frameHeight = (await measuredBox(frame)).height;

  await scrollToAndSettle(page, 100);
  await expect(header).not.toHaveAttribute("data-compact", "true");

  await scrollToAndSettle(page, 101);
  await expect(header).toHaveAttribute("data-compact", "true");
  const layoutWidth = await layoutViewportWidth(page);
  expectBoxNear(await measuredBox(header), {
    height: 48,
    width: 720,
    x: (layoutWidth - 720) / 2,
    y: 8,
  });
  expect((await measuredBox(frame)).height).toBe(frameHeight);
  expect((await computedMaterial(header)).boxShadow).toBe(
    themes.light.compactRaised,
  );
  await expectMinimumHitTarget(page.locator(".theme-control"));

  await scrollToAndSettle(page, 100);
  await expect(header).toHaveAttribute("data-compact", "false");
  expectBoxNear(await measuredBox(header), {
    height: 68,
    width: 1200,
    x: (layoutWidth - 1200) / 2,
    y: 16,
  });
});

test("mobile menu is a two-column floating panel with 44px targets", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize(MOBILE_VIEWPORT);
  await installStoredTheme(page, "light");
  await page.goto("/");

  const themeControl = page.locator(".theme-control");
  const trigger = page.locator("[data-mobile-navigation-trigger]");
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await expect(trigger).toHaveAttribute("aria-label", "打开导航菜单");
  await expectMinimumHitTarget(themeControl);
  await expectMinimumHitTarget(trigger);
  await trigger.click();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  await expect(trigger).toHaveAttribute("aria-label", "关闭导航菜单");

  const menu = page.locator("#mobile-navigation");
  await expect(menu).toBeVisible();
  expectBoxNear(await measuredBox(menu), {
    width: (await layoutViewportWidth(page)) - 32,
    x: 16,
  });
  const menuMaterial = await computedMaterial(menu);
  expect(menuMaterial.borderRadius).toBe("24px");
  expect(menuMaterial.boxShadow).toBe(themes.light.floating);

  const links = menu.locator(".mobile-navigation-link");
  expectBoxNear(await measuredBox(links.nth(1)), {
    y: (await measuredBox(links.first())).y,
  });
  expect((await measuredBox(links.nth(1))).x).toBeGreaterThan(
    (await measuredBox(links.first())).x,
  );
  for (let index = 0; index < (await links.count()); index += 1) {
    await expectMinimumHitTarget(links.nth(index));
  }
  await expectMinimumHitTarget(
    menu.getByRole("button", { name: "关闭导航菜单" }),
  );
});

const representativeRoutes = [
  {
    label: "home",
    maxWidth: 1200,
    path: "/",
    radius: { desktop: "30px", mobile: "24px" },
    shadow: "raised",
    shell: ".home-page",
    surface: ".identity-module",
  },
  {
    label: "discovery",
    maxWidth: 1200,
    path: "/writing/",
    radius: { desktop: "24px", mobile: "20px" },
    shadow: "compactRaised",
    shell: ".page-shell",
    surface: ".post-row",
  },
  {
    label: "search",
    maxWidth: 900,
    path: "/search/",
    radius: { desktop: "30px", mobile: "24px" },
    shadow: "inset",
    shell: ".search-page",
    surface: ".search-workbench",
  },
  {
    label: "reading",
    maxWidth: 1200,
    path: "/writing/typescript-observable-rag-pipeline/",
    radius: { desktop: "16px", mobile: "16px" },
    shadow: null,
    shell: ".article-page",
    surface: ".code-frame",
  },
] as const;

for (const route of representativeRoutes) {
  for (const theme of Object.keys(themes) as Theme[]) {
    test(`${route.label} keeps its ${theme} material contract on desktop and mobile`, async ({
      page,
    }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await installStoredTheme(page, theme);

      for (const [mode, viewport] of [
        ["desktop", DESKTOP_VIEWPORT],
        ["mobile", MOBILE_VIEWPORT],
      ] as const) {
        await page.setViewportSize(viewport);
        await page.goto(route.path);
        await expect(page.locator("html")).toHaveAttribute("data-theme", theme);

        const gutter = viewport.width <= 768 ? 16 : 24;
        const layoutWidth = await layoutViewportWidth(page);
        const expectedWidth = Math.min(
          route.maxWidth,
          layoutWidth - gutter * 2,
        );
        expectBoxNear(await measuredBox(page.locator(route.shell)), {
          width: expectedWidth,
          x: (layoutWidth - expectedWidth) / 2,
        });

        const material = await computedMaterial(
          page.locator(route.surface).first(),
        );
        expect(material.borderRadius).toBe(route.radius[mode]);
        if (route.shadow) {
          expect(material.boxShadow).toBe(themes[theme][route.shadow]);
        }
        expect(
          (await computedMaterial(page.locator("body"))).backgroundColor,
        ).toBe(themes[theme].background);
        await expectNoHorizontalOverflow(page);
      }
    });
  }
}

const denseOverflowRoutes = [
  ...representativeRoutes.map(({ path }) => path),
  "/notes/temperature-is-not-confidence/",
  "/topics/",
  "/topics/retrieval-augmented-generation/",
  "/archive/",
  "/about/",
] as const;

for (const width of [320, 390] as const) {
  test(`dense routes remain within the viewport at ${width}px`, async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width, height: 844 });

    for (const path of denseOverflowRoutes) {
      await page.goto(path);
      await expectNoHorizontalOverflow(page);
    }
  });
}

test("homepage modules expand around long CMS copy without overlap", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize(DESKTOP_VIEWPORT);
  await page.goto("/");

  await page.locator(".identity-statement").evaluate((element) => {
    element.textContent =
      "持续记录复杂系统中的边界与选择 mixed-script-identifier-without-shortening ".repeat(
        10,
      );
  });
  await page.locator(".topics-module .topic-list").evaluate((list) => {
    const template = list.querySelector<HTMLAnchorElement>(".topic-link");
    if (!template) throw new Error("Expected a topic-link template");
    list.replaceChildren(
      ...Array.from({ length: 6 }, (_, index) => {
        const link = template.cloneNode(true) as HTMLAnchorElement;
        link.textContent = `持续关注的超长中英文主题 mixed-script-topic-${index}-without-shortening · 99`;
        return link;
      }),
    );
  });
  await settleLayout(page);

  const identity = await measuredBox(page.locator(".identity-module"));
  const feature = await measuredBox(page.locator(".feature-post"));
  const information = await measuredBox(page.locator(".home-info-grid"));
  const topics = await measuredBox(page.locator(".topics-module"));
  const discovery = await measuredBox(page.locator(".discovery-module"));
  const footer = await measuredBox(page.locator(".site-footer"));

  expect(identity.height).toBeGreaterThan(356);
  expectBoxNear(feature, { height: identity.height, y: identity.y });
  expect(information.y).toBeGreaterThan(identity.y + identity.height);
  expect(topics.height).toBeGreaterThan(236);
  expectBoxNear(discovery, { height: topics.height, y: topics.y });
  expect(footer.y).toBeGreaterThanOrEqual(topics.y + topics.height);

  for (const selector of [
    ".identity-module",
    ".feature-post",
    ".topics-module",
  ]) {
    const dimensions = await page.locator(selector).evaluate((element) => ({
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
    }));
    expect(dimensions.scrollHeight).toBeLessThanOrEqual(
      dimensions.clientHeight,
    );
  }
  await expectNoHorizontalOverflow(page);
});

test("search preserves loading, result, empty, reset, and URL-restored states", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize(DESKTOP_VIEWPORT);
  await installStoredTheme(page, "light");

  let releaseIndex = () => {};
  const indexGate = new Promise<void>((resolve) => {
    releaseIndex = resolve;
  });
  let markRequestSeen = () => {};
  const requestSeen = new Promise<void>((resolve) => {
    markRequestSeen = resolve;
  });
  await page.route("**/pagefind/pagefind.js", async (route) => {
    markRequestSeen();
    await indexGate;
    await route.continue();
  });

  await page.goto("/search/");
  await expect(page.locator("[data-search-default]")).toBeVisible();
  expect(
    await page
      .getByLabel("关键词")
      .evaluate((element) => getComputedStyle(element).appearance),
  ).toBe("none");
  await expectMinimumHitTarget(page.getByRole("button", { name: "清除搜索" }));
  await expectMinimumHitTarget(
    page.getByRole("button", { name: "搜索", exact: true }),
  );
  for (const select of await page.locator(".search-filters select").all()) {
    await expectMinimumHitTarget(select);
  }
  await page.getByLabel("关键词").fill("向量搜索");
  await requestSeen;
  await expect(page.locator("[data-search-output]")).toHaveAttribute(
    "aria-busy",
    "true",
  );
  await expect(page.locator("[data-search-status]")).toContainText("正在载入");
  await page.getByRole("button", { name: "清除搜索" }).click();
  await expect(page.locator("[data-search-default]")).toBeVisible();
  releaseIndex();
  await page.waitForTimeout(100);
  await expect(page.locator("[data-search-default]")).toBeVisible();
  await expect(page.locator("[data-search-output]")).toBeHidden();

  await page.getByLabel("关键词").fill("向量搜索");
  await expect(page.locator("[data-search-status]")).toContainText("找到");
  const result = page.locator(".search-result").first();
  const resultMaterial = await computedMaterial(result);
  expect(resultMaterial.borderRadius).toBe("24px");
  expect(resultMaterial.boxShadow).toBe(themes.light.compactRaised);

  await page.getByLabel("关键词").fill("qzxvbnm987654321");
  await expect(page.locator("[data-search-status]")).toHaveText("没有匹配结果");
  await expect(page.locator(".search-empty")).toBeVisible();

  await page.getByRole("button", { name: "清除搜索" }).click();
  await expect(page.locator("[data-search-default]")).toBeVisible();
  await expect(page.locator("[data-search-output]")).toBeHidden();
  await expect(page.getByLabel("关键词")).toBeFocused();
  await expect(page).toHaveURL(/\/search\/$/);

  await page.goto("/search/?kind=note");
  await expect(
    page.getByRole("combobox", { name: "类型", exact: true }),
  ).toHaveValue("note");
  await expect(page.locator("[data-search-status]")).toContainText(
    "找到 3 条结果",
  );
});

test("search failure restores the useful default state", async ({ page }) => {
  await page.route("**/pagefind/pagefind.js", (route) => route.abort());
  await page.goto("/search/");
  await page.getByLabel("关键词").fill("向量搜索");

  await expect(page.locator("[data-search-status]")).toHaveText(
    "搜索索引暂时不可用，以下仍可浏览最近发布内容。",
  );
  await expect(page.locator("[data-search-default]")).toBeVisible();
  await expect(page.locator("[data-search-output]")).toBeHidden();
});

test("reduced motion makes visual transitions effectively instant", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");

  for (const selector of [
    ".site-header",
    ".feature-post",
    ".post-row",
    ".theme-control",
  ]) {
    const material = await computedMaterial(page.locator(selector).first());
    expect(
      durationInMilliseconds(material.animationDuration),
    ).toBeLessThanOrEqual(0.01);
    expect(
      durationInMilliseconds(material.transitionDuration),
    ).toBeLessThanOrEqual(0.01);
    await expect(page.locator(selector).first()).toBeVisible();
  }
});

test("forced colors restores explicit boundaries across representative surfaces", async ({
  page,
}) => {
  await page.emulateMedia({ forcedColors: "active", reducedMotion: "reduce" });

  for (const [path, selectors] of [
    ["/", [".site-header", ".feature-post", ".post-row"]],
    ["/topics/", [".topic-directory-card"]],
    ["/search/", [".search-workbench"]],
    [
      "/writing/typescript-observable-rag-pipeline/",
      [".code-frame", ".table-wrapper"],
    ],
  ] as const) {
    await page.goto(path);
    for (const selector of selectors) {
      const material = await computedMaterial(page.locator(selector).first());
      expect(material.borderStyle).toBe("solid");
      expect(material.boxShadow).toBe("none");
    }
  }

  await page.goto("/topics/");
  const topicCard = page.locator(".topic-directory-card").first();
  await topicCard.hover();
  expect((await computedMaterial(topicCard)).boxShadow).toBe("none");

  await topicCard.focus();
  await expect(topicCard).toBeFocused();
  expect((await computedMaterial(topicCard)).boxShadow).toBe("none");

  const topicCardBox = await measuredBox(topicCard);
  await page.mouse.move(
    topicCardBox.x + topicCardBox.width / 2,
    topicCardBox.y + topicCardBox.height / 2,
  );
  await page.mouse.down();
  expect((await computedMaterial(topicCard)).boxShadow).toBe("none");
  await page.mouse.up();
});
