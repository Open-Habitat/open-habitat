import { hostOrigin } from "../test-ports.mjs";
import { expect, type Page, test } from "./worker-host";

test.use({ baseURL: hostOrigin, ignoreHTTPSErrors: true });

async function open(page: Page) {
  await page.goto("/workspaces");
  await page
    .getByRole("button")
    .and(page.getByTestId("github-sign-in"))
    .click();
  await page.getByRole("link").nth(0).click();
  await page.goto("/settings/recap");
  await expect(
    page
      .getByRole("heading")
      .and(page.getByTestId("settings-section-tilannekatsaus")),
  ).toBeVisible();
}
const stored = async (page: Page) =>
  (await (await page.request.get("/api/v1/pi/recap-settings")).json()).settings;
const saved = (page: Page) =>
  page.waitForResponse(
    (r) =>
      r.request().method() === "PUT" &&
      r.url().endsWith("/api/v1/pi/recap-settings") &&
      r.status() === 200,
  );

test("@recap-settings levels, delay and model reach Pi's settings and survive a reload", async ({
  page,
}) => {
  await open(page);
  const level = page.getByRole("group").and(page.getByTestId("recap-level"));
  const segment = (id: string) =>
    level.getByRole("button").and(page.getByTestId(`segment-${id}`));
  await expect(segment("standard")).toHaveAttribute("aria-pressed", "true");
  expect(await stored(page)).toMatchObject({ level: "standard", words: 40 });

  let write = saved(page);
  await segment("short").click();
  await write;
  expect(await stored(page)).toMatchObject({
    level: "short",
    words: 25,
    messages: 16,
    first_after_turns: 2,
  });
  // Numbers open only in Oma, and a changed number keeps it there.
  await expect(page.getByTestId("recap-words")).toHaveCount(0);
  write = saved(page);
  await segment("custom").click();
  await write;
  write = saved(page);
  await page
    .getByRole("button")
    .and(page.getByTestId("recap-words-more"))
    .click();
  await write;
  expect(await stored(page)).toMatchObject({ level: "custom", words: 30 });

  // The delay moves along its stops and commits when the key is released.
  const delay = page.getByRole("slider");
  write = saved(page);
  await delay.focus();
  await page.keyboard.press("ArrowRight");
  await write;
  expect((await stored(page)).delay_seconds).toBe(210);

  // Automatic is the default; a chosen model closes the chooser.
  const trigger = page
    .getByRole("button")
    .and(page.getByTestId("recap-model-trigger"));
  await expect(trigger).toHaveAttribute("data-auto", "true");
  await trigger.click();
  const menu = page
    .getByRole("dialog")
    .and(page.getByTestId("recap-model-menu"));
  await expect(
    menu.getByRole("radio").and(page.getByTestId("model-automatic")),
  ).toBeChecked();
  write = saved(page);
  await menu
    .getByRole("radio")
    .and(page.getByTestId("model-gpt-6-nova"))
    .click();
  await write;
  await expect(menu).toBeHidden();
  await expect(trigger).not.toHaveAttribute("data-auto");
  await expect(trigger).toHaveAttribute("data-model", "gpt-6-nova");
  expect((await stored(page)).model).toBe("openai-codex/gpt-6-nova");

  await page.reload();
  await expect(segment("custom")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("recap-words-input")).toHaveValue("30");
  await expect(delay).toHaveAttribute("aria-valuetext", /3 min 30 s/);
  await page.setViewportSize({ width: 1280, height: 1900 });
  await page.screenshot({ path: "test-results/evidence/recap-settings.png" });
  await page.setViewportSize({ width: 390, height: 1900 });
  await page.screenshot({
    path: "test-results/evidence/recap-settings-phone.png",
  });
  await page.setViewportSize({ width: 1280, height: 720 });
  await trigger.click();
  await page.screenshot({
    path: "test-results/evidence/recap-settings-model.png",
  });
  write = saved(page);
  await menu
    .getByRole("radio")
    .and(page.getByTestId("model-automatic"))
    .click();
  await write;
  await expect(trigger).toHaveAttribute("data-auto", "true");
  expect((await stored(page)).model).toBeNull();
});
