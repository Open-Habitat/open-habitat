import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "./worker-host";

test("@a11y quiet working turn keeps one button across ticks, every click toggles without a jump", async ({
  page,
}) => {
  await page.goto("/?fixture=design-quiet-turn");
  const button = page.getByRole("button", { name: "Näytä työ" });
  await expect(button).toBeVisible();
  await button.scrollIntoViewIfNeeded();
  const identity = await button.evaluate((node) => {
    (window as typeof window & { quietButton?: Element }).quietButton = node;
    return node.getBoundingClientRect().top;
  });
  await expect(page.locator(".ah-turn-clock")).toHaveText("0:02", {
    timeout: 5000,
  });
  expect(
    await button.evaluate(
      (node) =>
        node ===
        (window as typeof window & { quietButton?: Element }).quietButton,
    ),
  ).toBe(true);
  await button.click();
  const opened = page.getByRole("button", { name: "Piilota työ" });
  await expect(opened).toHaveAttribute("aria-expanded", "true");
  expect(
    Math.abs(
      (await opened.evaluate((node) => node.getBoundingClientRect().top)) -
        identity,
    ),
  ).toBeLessThanOrEqual(1);
  expect(
    await opened.evaluate(
      (node) =>
        node ===
        (window as typeof window & { quietButton?: Element }).quietButton,
    ),
  ).toBe(true);
  await expect(page.getByText("Synteettinen vaihe kaksi")).toBeVisible();
  await expect(page.locator(".ah-turn-clock")).toHaveText("0:04", {
    timeout: 5000,
  });
  expect(
    await opened.evaluate(
      (node) =>
        node ===
        (window as typeof window & { quietButton?: Element }).quietButton,
    ),
  ).toBe(true);
  await opened.click();
  await expect(button).toHaveAttribute("aria-expanded", "false");
  await button.click();
  await expect(opened).toHaveAttribute("aria-expanded", "true");
  expect(
    (await new AxeBuilder({ page }).include(".ah-agent-turn").analyze())
      .violations,
  ).toEqual([]);
});

test("@a11y reduced motion removes reveal animation", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?fixture=design-quiet-turn");
  await page.getByRole("button", { name: "Näytä työ" }).click();
  await expect(page.locator(".ah-work-revealing > *").first()).toHaveCSS(
    "animation-name",
    "none",
  );
});
