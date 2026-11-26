// End-to-end checks of the real game in a browser (§12: Playwright for the UI).
import { expect, test, type Page } from "@playwright/test";

const open = async (page: Page) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "The Needle & The Pin" })).toBeVisible();
};

/** Run a command through the game controller the UI uses (map clicks call the same thing). */
const cmd = (page: Page, c: object) => page.evaluate((c) => (globalThis as any).needleAndPin.command(c), c);

test("title screen offers both scenarios and the codex", async ({ page }) => {
  await open(page);
  await expect(page.getByRole("button", { name: /The Needle \(tutorial\)/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Britain, 1776/ })).toBeVisible();
  await page.getByRole("button", { name: "Codex of Ideas" }).click();
  await expect(page.getByRole("dialog")).toContainText("The Division of Labour");
});

test("tutorial: the four root crafts form a market", async ({ page }) => {
  await open(page);
  await page.getByRole("button", { name: /The Needle \(tutorial\)/ }).click();
  await expect(page.locator(".tutorial")).toContainText("Ghazali's four root crafts");
  const placed = await page.evaluate(() => {
    const g = (globalThis as any).needleAndPin;
    const s = g.state;
    const town = s.towns[0];
    const done: string[] = [];
    for (const type of ["weaver", "builder", "courthouse"]) {
      const tiles = [...s.tiles].sort((a: any, b: any) => Math.abs(a.q - town.q) + Math.abs(a.r - town.r) - (Math.abs(b.q - town.q) + Math.abs(b.r - town.r)));
      for (const t of tiles) if (g.command({ type: "build", building: type, q: t.q, r: t.r }) === null) { done.push(type); break; }
    }
    return done;
  });
  expect(placed).toEqual(["weaver", "builder", "courthouse"]);
  await page.locator(".end-turn").click();
  await expect(page.locator(".tutorial")).toContainText("A market has formed", { timeout: 10_000 });
  await expect(page.locator(".toast-discovery").first()).toBeVisible();
});

test("Britain: turns advance, events are answered, screens open", async ({ page }) => {
  await open(page);
  await page.getByRole("button", { name: /Britain, 1776/ }).click();
  await expect(page.locator(".topbar")).toContainText("1776");
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press("e");
    const choice = page.locator(".dialog.event .choice:not([disabled])").first();
    await page.waitForTimeout(400);
    if (await choice.count()) await choice.click();
  }
  await expect(page.locator(".topbar")).not.toContainText("1776");
  await expect(page.locator(".ghost-mini")).toContainText("of history");
  await page.keyboard.press("t");
  await expect(page.getByRole("dialog")).toContainText("Equality");
  await page.keyboard.press("Escape");
  await page.keyboard.press("b");
  await expect(page.getByRole("dialog")).toContainText("Defence");
  await page.keyboard.press("Escape");
  await page.locator(".meter-opulence").click();
  await expect(page.getByRole("dialog")).toContainText("Real wage of the lowest laborer");
});

test("policy cards: debasing the coin collapses Money Trust", async ({ page }) => {
  await open(page);
  await page.getByRole("button", { name: /Britain, 1776/ }).click();
  const before = await page.evaluate(() => (globalThis as any).needleAndPin.state.money.trust);
  await page.locator(".card.danger").click();
  await page.getByRole("dialog").getByRole("button", { name: "Debase the coin" }).click();
  const after = await page.evaluate(() => (globalThis as any).needleAndPin.state.money.trust);
  expect(after).toBeLessThan(before - 20);
});

test("Arabic switches the interface to right-to-left", async ({ page }) => {
  await open(page);
  await page.getByLabel("Language").selectOption("ar");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("heading", { name: "الإبرة والدبوس" })).toBeVisible();
});

test("saves survive a reload", async ({ page }) => {
  await open(page);
  await page.getByRole("button", { name: /Britain, 1776/ }).click();
  await cmd(page, { type: "budget", line: "education", value: 0.2 });
  await page.evaluate(() => (globalThis as any).needleAndPin.autosave());
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForFunction(() => (globalThis as any).needleAndPin.state !== null);
  const edu = await page.evaluate(() => (globalThis as any).needleAndPin.state.budget.education);
  expect(edu).toBeCloseTo(0.2, 5);
});
