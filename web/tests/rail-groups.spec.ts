import AxeBuilder from "@axe-core/playwright";
import { hostOrigin } from "../test-ports.mjs";
import { expect, type Page, test } from "./worker-host";

test.use({ baseURL: hostOrigin, ignoreHTTPSErrors: true });

async function start(page: Page) {
  const nav = page.getByTestId("workspace-navigation");
  await nav.getByTestId("workspace-ordinary-dir").click();
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  await expect(page).toHaveURL(/conversation=pi(?:%3A|:)/);
  return new URL(page.url()).searchParams.get("conversation") ?? "";
}

test("@rail-groups @a11y Käynnissä rows are one line with a state ball and the host's last-change time, quiet ones fold", async ({
  page,
}) => {
  await page.request.get("/fixture/conversations-reset");
  await page.request.get("/fixture/scenario?value=ready");
  // Wire seam: age chosen conversations' changed_at, as if they had been
  // quiet for two and a half hours, without waiting or touching the
  // host's files. The rail's clock moves once a minute, so not exactly two.
  const aged = new Set<string>();
  await page.route("**/api/v1/snapshot", async (route) => {
    try {
      const response = await route.fetch();
      const body = await response.json();
      for (const a of body.agents)
        if (aged.has(a.agent_id) && a.changed_at)
          a.changed_at = new Date(
            Date.parse(a.changed_at) - 2.5 * 3600000,
          ).toISOString();
      await route.fulfill({ response, json: body });
    } catch {
      await route.abort().catch(() => {});
    }
  });
  await page.goto("/workspaces");
  await page.getByTestId("github-sign-in").click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  const nav = page.getByTestId("workspace-navigation");
  const running = nav.getByTestId("rail-running");

  const first = await start(page);
  await page.getByTestId("message-input").fill("Ensimmäinen viesti");
  await page
    .getByTestId("send")
    .and(page.locator('[data-mode="send"]'))
    .click();
  const row = running.getByTestId(`agent-item-${first}`);
  // The reply was read here, so the turn is done; the session file was just
  // written, so the time is now.
  await expect(row).toHaveAttribute("data-ball", "done", { timeout: 25000 });
  await expect(row.locator("time")).toHaveText("nyt");
  const group = running.getByTestId("rail-group-ordinary-dir");
  await expect(group.getByRole("heading")).toContainText("ordinary-dir");
  const box = await row.getByRole("link").boundingBox();
  expect(box?.height).toBeLessThanOrEqual(26);
  // The line keeps only the title and the time; the rest is said.
  await expect(row.locator(".ah-nav-detail")).toHaveCount(0);
  await expect(row).toHaveAttribute("title", /ordinary-dir · Odottaa viestiä/);

  // Two hours quiet: the open conversation never folds away.
  aged.add(first);
  await nav.getByTestId("snapshot-refresh").click();
  await expect(row.locator("time")).toHaveText("2 t");
  await expect(row).toBeVisible();

  // Opened elsewhere, the quiet row folds to the end of its group.
  const second = await start(page);
  await expect(running.getByTestId(`agent-item-${second}`)).toBeVisible();
  await expect(row).toHaveCount(0);
  const fold = group.getByTestId("rail-fold-quiet-ordinary-dir");
  await expect(fold).toHaveText("1 hiljainen");
  await expect(fold).toHaveAttribute("aria-expanded", "false");
  await fold.click();
  await expect(fold).toHaveAttribute("aria-expanded", "true");
  await expect(row.locator("time")).toHaveText("2 t");
  expect(
    (
      await new AxeBuilder({ page })
        .include('[data-testid="workspace-navigation"]')
        .analyze()
    ).violations,
  ).toEqual([]);
  await nav.screenshot({
    path: "test-results/evidence/rail-groups-desktop-fold.png",
  });

  // The time follows the host: a fresh snapshot brings the row back.
  aged.delete(first);
  await nav.getByTestId("snapshot-refresh").click();
  await expect(fold).toHaveCount(0);
  await expect(row.locator("time")).toHaveText("nyt");

  // On the phone the one-line row is a thumb's height.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByTestId("navigation-open").click();
  await expect(row).toBeVisible();
  const phone = await row.getByRole("link").boundingBox();
  expect(phone?.height).toBeGreaterThanOrEqual(40);
  await expect(row.locator(".ah-ball")).toBeVisible();
  await nav.screenshot({
    path: "test-results/evidence/rail-groups-phone.png",
  });
});
