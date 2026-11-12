import { expect, test, type Page } from "@playwright/test";
import { emptyProductInput } from "../../shared/domain/product";
import { contrastFailures, settled, signUp, textBoxes } from "./helpers";

// Soft light (D101, GT Ideas #40): a soft glow where the finger is, big photos leaning towards it, a spring back and
// a bouncing tab icon; with a mouse, the glow follows the pointer. Reduce Motion keeps only the press and the glow.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const call = (
  page: Page,
  method: string,
  path: string,
  body?: unknown,
): Promise<any> =>
  page.evaluate(
    async ({ method, path, body }) =>
      (
        await fetch(path, {
          method,
          headers:
            body === undefined
              ? undefined
              : { "content-type": "application/json" },
          body: body === undefined ? undefined : JSON.stringify(body),
        })
      ).status,
    { method, path, body },
  );
const look = (page: Page, look: string, top = "strip") =>
  call(page, "PUT", "/api/appearance", {
    look,
    top,
    preset: "aurora",
    markFirst: true,
  });

const person = () =>
  `sl${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

async function board(page: Page) {
  await signUp(page, person());
  for (const [name, score] of [
    ["Purple Punch", 9.6],
    ["Lemon Haze", 8.7],
    ["Wedding Cake", 8.2],
    ["Cherry Pie", 7.4],
  ] as const) {
    await call(page, "POST", "/api/products", {
      ...emptyProductInput(),
      name,
      ratings: { look: score },
    });
  }
}

const row = (page: Page, n: number) => page.locator(".rows > a.row").nth(n);

test.afterEach(async ({ page }) => {
  if (page.url().startsWith("http")) await look(page, "aurora").catch(() => {});
});

test("a press glows where the finger is, then fades when you let go", async ({
  page,
}) => {
  await board(page);
  await page.goto("/");
  const r = row(page, 1);
  await expect(r).toBeVisible();
  await settled(page);
  const box = (await r.boundingBox())!;
  await page.mouse.move(box.x + 60, box.y + 20);
  await page.mouse.down();
  await expect(r).toHaveClass(/is-pressed/);
  const glow = r.locator("> .touch-light.on");
  await expect(glow).toHaveCount(1);
  await expect(glow).toHaveAttribute("aria-hidden", "true");
  // Centred where the finger went down (the row is pressed in a little, so near enough).
  const at = await r.evaluate((el) => [
    parseFloat(el.style.getPropertyValue("--tx")),
    parseFloat(el.style.getPropertyValue("--ty")),
  ]);
  expect(Math.abs(at[0]! - 60)).toBeLessThanOrEqual(3);
  expect(Math.abs(at[1]! - 20)).toBeLessThanOrEqual(3);
  // A finger that moves away is scrolling: the press lets go and nothing opens.
  await page.mouse.move(box.x + 60, box.y - 160, { steps: 4 });
  await page.mouse.up();
  await expect(r).not.toHaveClass(/is-pressed/);
  await expect(page).toHaveURL(/\/$/);
  await expect(r.locator(".touch-light")).toHaveCount(0);
});

for (const which of ["aurora", "daysky"]) {
  test(`the words on a row stay readable under the glow (${which})`, async ({
    page,
  }) => {
    await board(page);
    expect(await look(page, which)).toBe(200);
    await page.goto("/");
    const r = row(page, 1);
    await expect(r).toBeVisible();
    await settled(page);
    const box = (await r.boundingBox())!;
    // The glow's brightest middle sits right on the name.
    const name = (await r.locator(".name").boundingBox())!;
    await page.mouse.move(name.x + 20, name.y + name.height / 2);
    await page.mouse.down();
    await expect(r.locator("> .touch-light.on")).toHaveCount(1);
    await expect
      .poll(() =>
        r
          .locator("> .touch-light")
          .evaluate((el) => getComputedStyle(el).opacity),
      )
      .toBe("1");
    const boxes = (
      await textBoxes(
        page,
        ".row .name, .row .meta, .row .score b, .row .score .cap, .row .rk",
      )
    ).filter((b) => b.y >= box.y - 4 && b.y + b.h <= box.y + box.height + 4);
    expect(boxes.length).toBeGreaterThanOrEqual(3);
    expect(await contrastFailures(page, boxes, 3)).toEqual([]);
    await page.mouse.up();
  });
}

test("a big photo leans towards the finger", async ({ page }) => {
  await board(page);
  expect(await look(page, "aurora", "hero")).toBe(200);
  await page.goto("/");
  const card = page.locator(".sc-card").first();
  await expect(card).toBeVisible();
  await settled(page);
  const box = (await card.boundingBox())!;
  await page.mouse.move(box.x + box.width - 6, box.y + box.height / 2);
  await page.mouse.down();
  await expect(card).toHaveClass(/is-pressed/);
  // Pressed on its right edge: it turns about the line down its middle, right side in (rotateY 4 degrees).
  const lean = await card.evaluate((el) => [
    parseFloat(el.style.getPropertyValue("--rx")),
    parseFloat(el.style.getPropertyValue("--ry")),
  ]);
  expect(lean[1]).toBeGreaterThan(3.5);
  expect(lean[1]).toBeLessThanOrEqual(4);
  expect(Math.abs(lean[0]!)).toBeLessThan(0.5);
  await expect
    .poll(() => card.evaluate((el) => getComputedStyle(el).transform))
    .toMatch(/^matrix3d\(/);
  await page.mouse.up();
  await expect
    .poll(() => card.evaluate((el) => getComputedStyle(el).transform))
    .not.toMatch(/^matrix3d\(/);
});

test.describe("with Reduce Motion", () => {
  test.use({ reducedMotion: "reduce" });
  test("nothing leans or bounces, and the glow still shows", async ({
    page,
  }) => {
    await board(page);
    expect(await look(page, "aurora", "hero")).toBe(200);
    await page.goto("/");
    const card = page.locator(".sc-card").first();
    await expect(card).toBeVisible();
    await settled(page);
    const box = (await card.boundingBox())!;
    await page.mouse.move(box.x + box.width - 6, box.y + 20);
    await page.mouse.down();
    await expect(card).toHaveClass(/is-pressed/);
    await expect(card.locator("> .touch-light.on")).toHaveCount(1);
    expect(
      await card.evaluate((el) => getComputedStyle(el).transform),
    ).not.toMatch(/^matrix3d\(/);
    await page.mouse.up();
    // A tab's icon doesn't bounce.
    await page.getByRole("link", { name: "Strainz" }).click();
    await expect(page).toHaveURL(/\/strainz$/);
    const svg = page.locator(".tab", { hasText: "Strainz" }).locator("svg");
    expect(await svg.evaluate((el) => el.getAnimations().length)).toBe(0);
  });
});

test("a tab bounces when tapped", async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { pops: string[] };
    w.pops = [];
    new MutationObserver((list) => {
      for (const m of list) {
        const el = m.target as HTMLElement;
        if (el.classList?.contains("tab-pop"))
          w.pops.push(el.textContent ?? "");
      }
    }).observe(document, {
      attributes: true,
      attributeFilter: ["class"],
      subtree: true,
    });
  });
  await board(page);
  await page.goto("/");
  await expect(page.locator(".tabs")).toBeVisible();
  await page.getByRole("link", { name: "Strainz" }).click();
  await expect(page).toHaveURL(/\/strainz$/);
  await expect
    .poll(() =>
      page.evaluate(() =>
        (window as unknown as { pops: string[] }).pops.some((t) =>
          t.includes("Strainz"),
        ),
      ),
    )
    .toBe(true);
  // And it settles: the class goes once the bounce is over.
  await expect(page.locator(".tab.tab-pop")).toHaveCount(0);
});

test.describe("with a mouse (a computer)", () => {
  test.use({ hasTouch: false });
  test("it lights what it moves over; a pointer that only jumps there leaves nothing", async ({
    page,
  }) => {
    await board(page);
    await page.goto("/");
    const r = row(page, 1);
    await expect(r).toBeVisible();
    await settled(page);
    const box = (await r.boundingBox())!;
    // One jump onto the row (how the tests click): no glow.
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await expect(r).not.toHaveClass(/is-hover/);
    expect(await r.locator(".touch-light").count()).toBe(0);
    // A real mouse moving across it: the glow follows.
    await page.mouse.move(box.x + 30, box.y + box.height / 2, { steps: 8 });
    await expect(r).toHaveClass(/is-hover/);
    await expect(r.locator("> .touch-light.on")).toHaveCount(1);
    await expect
      .poll(() =>
        r.evaluate((el) =>
          Math.round(parseFloat(el.style.getPropertyValue("--tx"))),
        ),
      )
      .toBeLessThanOrEqual(32);
    // Moving off it: gone.
    await page.mouse.move(box.x + box.width / 2, box.y - 200, { steps: 8 });
    await expect(r).not.toHaveClass(/is-hover/);
    await expect(r.locator(".touch-light")).toHaveCount(0);
  });
});
