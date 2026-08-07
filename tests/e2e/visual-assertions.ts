import { expect, type Locator, type Page } from "@playwright/test";

export interface MeasuredBox {
  height: number;
  width: number;
  x: number;
  y: number;
}

export interface ExpectedBox {
  height?: number;
  width?: number;
  x?: number;
  y?: number;
}

export async function measuredBox(locator: Locator): Promise<MeasuredBox> {
  await expect(locator).toBeVisible();
  const box = await locator.boundingBox();
  expect(box, `Expected ${locator} to have a bounding box`).not.toBeNull();
  if (!box) throw new Error(`Expected ${locator} to have a bounding box`);
  return box;
}

export function expectBoxNear(
  actual: MeasuredBox,
  expected: ExpectedBox,
  tolerance = 2,
): void {
  for (const property of ["x", "y", "width", "height"] as const) {
    const expectedValue = expected[property];
    if (expectedValue === undefined) continue;
    expect(
      Math.abs(actual[property] - expectedValue),
      `${property}: expected ${expectedValue}px +/- ${tolerance}px, received ${actual[property]}px`,
    ).toBeLessThanOrEqual(tolerance);
  }
}

export async function computedMaterial(locator: Locator) {
  return locator.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      animationDuration: style.animationDuration,
      backgroundColor: style.backgroundColor,
      borderRadius: style.borderRadius,
      borderStyle: style.borderStyle,
      boxShadow: style.boxShadow,
      color: style.color,
      columnGap: style.columnGap,
      display: style.display,
      fontFamily: style.fontFamily,
      fontSize: style.fontSize,
      gridTemplateColumns: style.gridTemplateColumns,
      letterSpacing: style.letterSpacing,
      lineHeight: style.lineHeight,
      paddingBottom: style.paddingBottom,
      paddingLeft: style.paddingLeft,
      paddingRight: style.paddingRight,
      paddingTop: style.paddingTop,
      rowGap: style.rowGap,
      transitionDuration: style.transitionDuration,
    };
  });
}

export async function expectMinimumHitTarget(
  locator: Locator,
  minimum = 44,
): Promise<void> {
  const box = await measuredBox(locator);
  expect(
    box.width,
    `Expected ${locator} to be at least ${minimum}px wide`,
  ).toBeGreaterThanOrEqual(minimum);
  expect(
    box.height,
    `Expected ${locator} to be at least ${minimum}px high`,
  ).toBeGreaterThanOrEqual(minimum);
}

export async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const measurements = await page.evaluate(() => {
    const clientWidth = document.documentElement.clientWidth;
    const offenders = Array.from(
      document.body.querySelectorAll<HTMLElement>("*"),
    )
      .filter((element) => element.getClientRects().length > 0)
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          className: element.className,
          left: rect.left,
          name: element.tagName.toLowerCase(),
          right: rect.right,
        };
      })
      .filter(({ left, right }) => left < -1 || right > clientWidth + 1)
      .slice(0, 8);

    return {
      clientWidth,
      offenders,
      scrollWidth: document.documentElement.scrollWidth,
    };
  });

  expect(
    measurements.scrollWidth,
    `Horizontal overflow at ${page.url()}: ${JSON.stringify(measurements.offenders)}`,
  ).toBeLessThanOrEqual(measurements.clientWidth);
}
