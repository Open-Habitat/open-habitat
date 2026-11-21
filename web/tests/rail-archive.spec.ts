import { resolve } from "node:path";
import { snapshot } from "../lab/session.mjs";
import { hostOrigin } from "../test-ports.mjs";
import { openedConversation } from "./conversation-view";
import { createHostTest, expect } from "./worker-host";

const capture = Boolean(process.env.OH_RAIL_TITLE_EVIDENCE);
const test = createHostTest(false, capture ? { BROWSER_HOST_LAB: "1" } : {});

test.use({
  baseURL: hostOrigin,
  ignoreHTTPSErrors: true,
  deviceScaleFactor: 2,
});

test("rail titles have no field outline at rest, selected, hovered or focused", async ({
  page,
}) => {
  await page.request.get("/fixture/scenario?value=ready");
  await page.goto("/workspaces");
  await page.getByTestId("github-sign-in").click();
  await page.locator('a[href*="code=42"]').click();
  await page
    .getByRole("navigation")
    .getByTestId(capture ? "workspace-aurinkokello" : "workspace-ordinary-dir")
    .click();
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  await openedConversation(page);
  const id = new URL(page.url()).searchParams.get("conversation") ?? "";
  const row = page.getByRole("navigation").getByTestId(`agent-item-${id}`);
  const link = row.getByTestId("agent-link");
  await page.getByTestId("message-input").fill("A synthetic rail title");
  await page
    .getByTestId("send")
    .and(page.locator('[data-mode="send"]'))
    .click();
  await expect(row.locator("time")).toHaveCount(1);
  for (const theme of ["light", "dark", "contrast"]) {
    await page.getByTestId("account-menu-trigger").click();
    await page.getByTestId(`segment-${theme}`).click();
    await page.keyboard.press("Escape");
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    await expect(link).toHaveAttribute("aria-current", "page");
    await page.mouse.move(0, 0);
    await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
    if (process.env.OH_RAIL_TITLE_EVIDENCE) {
      await page.evaluate(() =>
        Promise.all(document.getAnimations().map((a) => a.finished)),
      );
      await snapshot(
        page,
        resolve(process.env.OH_RAIL_TITLE_EVIDENCE, `${theme}-selected`),
        { labOrigin: new URL(page.url()).origin },
      );
    }
    for (const selected of [true, false]) {
      if (!selected) {
        await page
          .getByRole("navigation")
          .getByTestId(
            capture ? "workspace-aurinkokello" : "workspace-ordinary-dir",
          )
          .click();
        await expect(link).not.toHaveAttribute("aria-current", "page");
      }
      await page.mouse.move(0, 0);
      await page.evaluate(() =>
        (document.activeElement as HTMLElement)?.blur(),
      );
      for (const state of ["rest", "hover", "focus"]) {
        if (state === "hover") await row.hover();
        if (state === "focus") {
          await page.keyboard.press("Tab");
          await link.focus();
          await expect(row.locator(".ah-now-row")).toHaveCSS(
            "outline-style",
            "solid",
          );
        }
        // The title link and its label in one read per poll: asserting
        // each property separately was some 200 round trips, which ran the
        // case out of its time on a loaded host.
        await expect
          .poll(() =>
            row.evaluate((item) =>
              [
                item.querySelector('[data-testid="agent-link"]'),
                item.querySelector(".ah-nav-label"),
              ].map((node) => {
                if (!node) return null;
                const style = getComputedStyle(node);
                return {
                  border: [
                    style.borderTopWidth,
                    style.borderRightWidth,
                    style.borderBottomWidth,
                    style.borderLeftWidth,
                  ],
                  shadow: style.boxShadow,
                  outline: style.outlineStyle,
                };
              }),
            ),
          )
          .toEqual(
            Array(2).fill({
              border: ["0px", "0px", "0px", "0px"],
              shadow: "none",
              outline: "none",
            }),
          );
      }
    }
    await link.click();
    await row.getByTestId("rail-rename-conversation").click();
    await expect(row.locator(".ah-name-field")).toBeVisible();
    await expect(row.locator(".ah-name-field")).toHaveCSS(
      "border-top-width",
      "1px",
    );
    await expect(row.locator("time")).toHaveCount(0);
    if (process.env.OH_RAIL_TITLE_EVIDENCE) {
      await snapshot(
        page,
        resolve(process.env.OH_RAIL_TITLE_EVIDENCE, `${theme}-renaming`),
        { labOrigin: new URL(page.url()).origin },
      );
    }
    await page.keyboard.press("Escape");
  }
});

test("a rail conversation archives from its row on hover or by keyboard, without opening it, and comes back from the notice", async ({
  page,
}) => {
  test.setTimeout(60000);
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
  await openedConversation(page);
  await page.request.get("/fixture/scenario?value=pi-visual-hold");
  await page.getByTestId("message-input").fill("something to archive");
  await page
    .getByTestId("send")
    .and(page.locator('[data-mode="send"]'))
    .click();
  // Enabled also holds while input is still tab-kept. Leave only after Pi
  // owns it; the held turn cannot finish until we release the fixture below.
  await expect
    .poll(async () => {
      const response = await page.request.get(
        `/api/v1/conversations/${encodeURIComponent(id.replace(/^pi:/, ""))}/status`,
      );
      const status = await response.json();
      return status.run_active && status.native_history === "present";
    })
    .toBe(true);
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
  await expect(
    page.getByTestId("notice-area").getByTestId("archive-notice"),
  ).toBeVisible();
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
  await expect(
    page.getByTestId("notice-area").getByTestId("archive-notice"),
  ).toBeVisible();
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

  // Settings overlays the current view. A refusal arriving while it is
  // open must remain available when the person returns to the view.
  await notice.getByTestId("notice-close").click();
  await page
    .getByRole("navigation")
    .getByTestId("workspace-ordinary-dir")
    .click();
  await expect(notice).toHaveCount(0);
  await page.unroute("**/api/v1/workspaces");
  let release!: () => void;
  const delayed = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/v1/workspaces", async (route) => {
    if (route.request().postDataJSON()?.action !== "conversation_archive")
      return route.continue();
    await delayed;
    await route.fulfill({
      status: 409,
      contentType: "application/json",
      body: JSON.stringify({ error: { code: "control_uncertain" } }),
    });
  });
  await archive.click();
  await page.getByTestId("account-menu-trigger").click();
  await page.getByTestId("menu-settings").click();
  await expect(page).toHaveURL(/\/settings$/);
  release();
  await expect(notice.getByTestId("archive-error")).toBeVisible();
  await page.getByTestId("settings-close").click();
  await notice.getByTestId("notice-close").click();
  await expect(notice).toHaveCount(0);
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
