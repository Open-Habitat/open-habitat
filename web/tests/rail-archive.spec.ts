import { hostOrigin } from "../test-ports.mjs";
import { expect, test } from "./worker-host";

test.use({ baseURL: hostOrigin, ignoreHTTPSErrors: true });

test("a rail conversation archives from its row on hover or by keyboard, without opening it, and comes back from the notice", async ({
  page,
}) => {
  await page.request.get("/fixture/scenario?value=ready");
  await page.goto("/workspaces");
  await page.getByTestId("github-sign-in").click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  await page
    .getByRole("navigation")
    .getByTestId("workspace-ordinary-dir")
    .click();
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  await expect(page).toHaveURL(/conversation=pi(?:%3A|:)/);
  const id = new URL(page.url()).searchParams.get("conversation") ?? "";
  await page.request.get("/fixture/scenario?value=pi-visual-hold");
  await page.getByTestId("message-input").fill("something to archive");
  await page
    .getByTestId("send")
    .and(page.locator('[data-mode="send"]'))
    .click();
  await expect(page.getByTestId("message-input")).toBeEnabled();
  // Away from the conversation: archiving from the rail leaves this page be.
  await page
    .getByRole("navigation")
    .getByTestId("workspace-ordinary-dir")
    .click();
  await expect(page).not.toHaveURL(/conversation=/);
  await page.request.get("/fixture/scenario?value=ready");
  const here = page.url();
  const row = page.getByRole("navigation").getByTestId(`agent-item-${id}`);
  const archive = row
    .getByRole("button")
    .and(page.getByTestId("rail-archive-conversation"));
  // Opacity is the slot's; the button inside it keeps its own.
  const slot = row.locator(".ah-nav-archive");
  await expect(row).toBeVisible();
  await page.mouse.move(0, 0);
  await expect(slot).toHaveCSS("opacity", "0");
  // The turn ends and the reply waits unread in Sinun vuorosi; the row
  // moves there and takes its title meanwhile, which remounts it.
  await expect(
    page
      .getByTestId("rail-yours")
      .getByTestId(`agent-item-${id}`)
      .getByRole("link", { name: "something to archive" }),
  ).toBeVisible({ timeout: 25000 });
  await expect(archive).toBeEnabled();
  await row.hover();
  await expect(slot).toHaveCSS("opacity", "1");
  // The row's age gives way to the button rather than sitting under it.
  await expect(row.locator("time")).toBeHidden();
  // The button's help opens beside the row, toward the page, so it covers
  // no other row of the rail (Jari 7.11.2026); the row's own native title
  // does not open over its buttons.
  await archive.hover();
  const tip = page.getByRole("tooltip");
  await expect(tip).toHaveText("Arkistoi");
  const tipBox = await tip.boundingBox();
  const rowBox = await row.boundingBox();
  if (!tipBox || !rowBox) throw new Error("Missing tooltip geometry");
  expect(tipBox.x).toBeGreaterThanOrEqual(rowBox.x + rowBox.width - 1);
  // Beside the rail it is drawn on top, not clipped by the rail's box.
  expect(
    await page.evaluate(
      ([x, y]) =>
        !!document.elementFromPoint(x, y)?.closest('[role="tooltip"]'),
      [tipBox.x + tipBox.width - 4, tipBox.y + tipBox.height / 2],
    ),
  ).toBe(true);
  await expect(slot).toHaveAttribute("title", "");
  await page.mouse.move(0, 0);
  await expect(slot).toHaveCSS("opacity", "0");
  // Keyboard: the row's actions follow its link: lower, rename, archive.
  await row.getByTestId("agent-link").focus();
  await page.keyboard.press("Tab");
  await expect(row.getByTestId("rail-not-now-conversation")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(row.getByTestId("rail-rename-conversation")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(archive).toBeFocused();
  await expect(slot).toHaveCSS("opacity", "1");
  await page.keyboard.press("Enter");
  await expect(row).toHaveCount(0);
  expect(page.url()).toBe(here);
  const notice = page.getByTestId("archive-notice");
  await expect(notice).toBeVisible();
  await expect(notice.getByTestId("restore-notice")).toBeEnabled();
  await notice.getByTestId("restore-notice").click();
  await expect(row).toBeVisible();
  expect(page.url()).toBe(here);

  // A definite refusal is one persistent notice, not a duplicate banner plus
  // an undo offer for an archive that never happened. Keep a conversation
  // open to exercise the former duplicate banner path too.
  await row.getByTestId("agent-link").click();
  await page.route("**/api/v1/workspaces", async (route) => {
    if (route.request().postDataJSON()?.action !== "conversation_archive")
      return route.continue();
    await route.fulfill({
      status: 409,
      contentType: "application/json",
      body: JSON.stringify({ error: { code: "control_uncertain" } }),
    });
  });
  await page.clock.install();
  await archive.click();
  await expect(page.getByTestId("archive-error")).toHaveCount(1);
  await expect(notice.getByTestId("archive-error")).toBeVisible();
  await expect(notice.getByTestId("restore-notice")).toHaveCount(0);
  await expect(row).toBeVisible();
  await page.mouse.move(0, 0);
  await page.clock.runFor(60_000);
  await expect(notice.getByTestId("archive-error")).toBeVisible();
  await notice.getByTestId("notice-close").click();
  await expect(notice).toHaveCount(0);
  await expect(page.getByTestId("archive-error")).toHaveCount(0);

  await page.unroute("**/api/v1/workspaces");
  let answer!: () => void;
  const heldReply = new Promise<void>((resolve) => {
    answer = resolve;
  });
  await page.route("**/api/v1/workspaces", async (route) => {
    if (route.request().postDataJSON()?.action !== "conversation_archive")
      return route.continue();
    await heldReply;
    await route.fulfill({
      status: 409,
      contentType: "application/json",
      body: JSON.stringify({ error: { code: "control_uncertain" } }),
    });
  });
  await archive.click();
  await notice.getByTestId("notice-close").click();
  await expect(notice).toHaveCount(0);
  answer();
  await expect(notice.getByTestId("archive-error")).toBeVisible();
  await expect(page.getByTestId("archive-error")).toHaveCount(1);
});

test.describe("on a touch screen", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  test("the drawer's row shows its archive without hover", async ({ page }) => {
    await page.request.get("/fixture/scenario?value=ready");
    await page.goto("/workspaces");
    await page.getByTestId("github-sign-in").click();
    await page
      .getByRole("link")
      .and(page.locator('a[href*="code=42"]'))
      .click();
    await page.getByTestId("navigation-open").click();
    await page
      .getByRole("navigation")
      .getByTestId("workspace-ordinary-dir")
      .click();
    await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
    await expect(page).toHaveURL(/conversation=pi(?:%3A|:)/);
    const id = new URL(page.url()).searchParams.get("conversation") ?? "";
    // A settled failed turn is still listed and can be archived.
    await page.getByTestId("message-input").fill("Tee virhevuoro");
    await page
      .getByTestId("send")
      .and(page.locator('[data-mode="send"]'))
      .click();
    await expect(page.getByTestId("message-input")).toBeEnabled();
    await page.getByTestId("navigation-open").click();
    const row = page.getByRole("navigation").getByTestId(`agent-item-${id}`);
    await expect(row).toBeVisible();
    await expect(row.locator(".ah-nav-archive")).toHaveCSS("opacity", "1");
    const archive = row
      .getByRole("button")
      .and(page.getByTestId("rail-archive-conversation"));
    await expect(archive).toBeEnabled({ timeout: 25000 });
    // The age stays beside it; the title gives way.
    await expect(row.locator("time")).toBeVisible();
    const link = await row.getByTestId("agent-link").boundingBox();
    const button = await archive.boundingBox();
    expect(link && button && button.x >= link.x + link.width - 1).toBe(true);
    // Archiving the open conversation leaves it, as from its own page.
    await archive.tap();
    await expect(page).not.toHaveURL(/conversation=/);
    await expect(page.getByTestId("archive-notice")).toBeVisible();
  });
});
