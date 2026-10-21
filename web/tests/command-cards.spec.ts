import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { hostOrigin } from "../test-ports.mjs";
import { expect, test } from "./worker-host";

test.use({ baseURL: hostOrigin, ignoreHTTPSErrors: true });

async function newConversation(page: Page) {
  await page.request.get("/fixture/scenario?value=ready");
  await page.goto("/workspaces");
  await page.getByTestId("github-sign-in").click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  const snapshot = await (await page.request.get("/api/v1/snapshot")).json();
  const workspace = snapshot.workspaces.find(
    (w: { name: string }) => w.name === "ordinary-dir",
  );
  await page.goto(`/workspaces/${workspace.workspace_id}`);
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  await expect(page).toHaveURL(/conversation=pi:/);
  return page.getByTestId("message-input");
}

test("@command-cards: !make serve runs through Pi, shows its run chip, and Esc stops it", async ({
  page,
}) => {
  test.setTimeout(90000);
  const field = await newConversation(page);
  await field.fill("Aloita");
  await field.press("Enter");
  await expect(
    page.getByTestId("send").and(page.locator('[data-mode="send"]')),
  ).toBeVisible({
    timeout: 20000,
  });
  await expect(
    page
      .getByTestId("composer-stop")
      .and(page.locator('[data-stop-target="agent"]')),
  ).toHaveCount(0, {
    timeout: 20000,
  });
  await field.fill("!make serve");
  await expect(page.getByTestId("command-mode")).toBeVisible();
  await expect(page.getByTestId("command-context")).toBeVisible();
  await expect(
    page.getByTestId("send").and(page.locator('[data-mode="shell"]')),
  ).toBeVisible();
  await field.press("Enter");
  // The field clears, as in Pi's TUI; the command's block streams its output.
  await expect(field).toHaveValue("");
  const run = page.locator(".ah-conversation-stream > .ah-cmd-run");
  await expect(run).toContainText("make serve");
  await expect(run).toContainText("Serving HTTP", { timeout: 15000 });
  await expect(run).toHaveAttribute("data-state", "running");
  const stop = page
    .getByTestId("composer-stop")
    .and(page.locator('[data-stop-target="command"]'));
  await expect(stop).toBeVisible();
  await expect(page.locator(".ah-crow-run")).toContainText("make serve");
  // A second command while one runs is refused, not queued.
  await field.fill("!ls");
  await field.press("Enter");
  await expect(page.getByTestId("composer-notice")).toBeVisible();
  await expect(field).toHaveValue("!ls");
  let releaseAbort!: () => void;
  const abortGate = new Promise<void>((resolve) => {
    releaseAbort = resolve;
  });
  await page.route("**/abort_bash", async (route) => {
    await abortGate;
    await route.continue();
  });
  await field.press("Escape");
  await expect(
    page
      .getByTestId("composer-notice")
      .and(page.locator('[data-stopping="pending"]')),
  ).toBeVisible();
  await expect(stop).toBeDisabled();
  await field.press("Escape");
  await expect(run).toHaveAttribute("data-stopping", "true");
  releaseAbort();
  await expect(stop).toHaveCount(0, { timeout: 15000 });
  // Pi's own history entry takes over from the live block.
  const saved = page
    .getByTestId("conversation-timeline")
    .getByTestId("command-run");
  await expect(saved).toHaveAttribute("data-state", "cancelled", {
    timeout: 15000,
  });
  await expect(saved).toContainText("make serve");
  await expect(saved.locator("details")).toHaveAttribute("open", "");
  const summary = saved.locator("summary");
  await summary.focus();
  await page.keyboard.press("Enter");
  await expect(saved.locator("details")).not.toHaveAttribute("open", "");
  await page.keyboard.press("Enter");
  await expect(saved.locator(".ah-cmd-body pre").first()).toBeVisible();
  expect(
    (
      await new AxeBuilder({ page })
        .include(".ah-cmd-run")
        .include(".ah-composer")
        .analyze()
    ).violations,
  ).toEqual([]);
});

test("@command-cards: `!!` keeps the output from Pi and finishes with its exit code", async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  const field = await newConversation(page);
  await field.fill("!!git status");
  await expect(page.getByTestId("command-context")).toBeVisible();
  // A new conversation's command waits for the Pi it starts.
  await field.press("Enter");
  const saved = page
    .getByTestId("conversation-timeline")
    .getByTestId("command-run");
  await expect(saved).toHaveAttribute("data-excluded", "true", {
    timeout: 25000,
  });
  await expect(saved).toHaveAttribute("data-excluded", "true");
  await expect(saved).toHaveAttribute("data-exit-code", "0");
  await expect(saved.locator("details")).toHaveAttribute("open", "");
  await expect(saved.locator(".ah-cmd-body pre").first()).toBeVisible();
  await expect(page.getByTestId("command-context")).toHaveCount(0);
  expect(
    await saved.evaluate((el) => {
      const rect = el.getBoundingClientRect();
      return rect.left >= 0 && rect.right <= window.innerWidth;
    }),
  ).toBe(true);
  await page.reload();
  await expect(saved).toHaveAttribute("data-exit-code", "0");
  await expect(saved.locator(".ah-cmd-body pre").first()).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
