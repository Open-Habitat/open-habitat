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

test("@rail-groups @a11y Käynnissä rows are one line with a state ball and the host's last-change time, old rows stay visible", async ({
  page,
}) => {
  await page.request.get("/fixture/conversations-reset");
  await page.request.get("/fixture/scenario?value=ready");
  // Wire seam: age chosen conversations' changed_at, as if they had been
  // quiet for two and a half hours, without waiting or touching the
  // host's files. The rail's clock moves once a minute, so not exactly two.
  // A finished conversation is not in Käynnissä (rail-running-after-done);
  // one whose worker waits at its own prompt is, as a your-turn row, so chosen
  // conversations get such a worker.
  const aged = new Set<string>();
  const parked = new Set<string>();
  await page.route("**/api/v1/snapshot", async (route) => {
    try {
      const response = await route.fetch();
      const body = await response.json();
      for (const a of body.agents) {
        if (parked.has(a.agent_id)) a.spinoffs_idle = 1;
        if (aged.has(a.agent_id) && a.changed_at)
          a.changed_at = new Date(
            Date.parse(a.changed_at) - 2.5 * 3600000,
          ).toISOString();
      }
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
  parked.add(first);
  await page.getByTestId("message-input").fill("Ensimmäinen viesti");
  await page
    .getByTestId("send")
    .and(page.locator('[data-mode="send"]'))
    .click();
  const row = running.getByTestId(`agent-item-${first}`);
  // The reply was read here, but the parked worker still needs the person;
  // the session file was just written, so the time is now.
  await expect(row).toHaveAttribute("data-ball", "you", { timeout: 25000 });
  await expect(row.locator("time")).toHaveText("nyt");
  // With workspace icons standard, the row's own icon names its workspace
  // instead of a group heading.
  await expect(row.getByTestId("workspace-icon-button")).toHaveAccessibleName(
    /ordinary-dir/,
  );
  await expect(running.getByTestId(/^rail-group-/)).toHaveCount(0);
  const box = await row.getByRole("link").boundingBox();
  expect(box?.height).toBeLessThanOrEqual(26);
  // The line keeps only the title and the time; the rest is said.
  await expect(row.locator(".ah-nav-detail")).toHaveCount(0);
  await expect(row).toHaveAttribute(
    "title",
    /ordinary-dir · Worker odottaa sinua/,
  );

  // Two hours quiet: the open conversation never folds away.
  aged.add(first);
  await nav.getByTestId("snapshot-refresh").click();
  await expect(row.locator("time")).toHaveText("2 t");
  await expect(row).toBeVisible();

  // Opening another conversation never hides the older row.
  const second = await start(page);
  parked.add(second);
  await nav.getByTestId("snapshot-refresh").click();
  await expect(running.getByTestId(`agent-item-${second}`)).toBeVisible();
  await expect(row).toBeVisible();
  await expect(running.getByTestId(/^rail-fold-/)).toHaveCount(0);
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
  await expect(row).toBeVisible();
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

test("@rail-groups A turn that ended in an error is a failed row until the person writes again", async ({
  page,
}) => {
  await page.request.get("/fixture/conversations-reset");
  await page.request.get("/fixture/scenario?value=ready");
  await page.goto("/workspaces");
  await page.getByTestId("github-sign-in").click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  const nav = page.getByTestId("workspace-navigation");
  const running = nav.getByTestId("rail-running");
  const id = await start(page);
  const send = async (text: string) => {
    await page.getByTestId("message-input").fill(text);
    await page
      .getByTestId("send")
      .and(page.locator('[data-mode="send"]'))
      .click();
  };
  await send("Tee virhevuoro");
  const row = nav.getByTestId(`agent-item-${id}`);
  await expect(row).toHaveAttribute("data-ball", "fail", { timeout: 25000 });
  await expect(running.getByTestId(`agent-item-${id}`)).toHaveCount(0);
  // Writing again starts a new turn; its answer is not failed, and the
  // finished conversation leaves Käynnissä.
  await send("Yritä uudestaan");
  await expect(row).not.toHaveAttribute("data-ball", "fail", {
    timeout: 25000,
  });
  await expect(running.getByTestId(`agent-item-${id}`)).toHaveCount(0, {
    timeout: 25000,
  });
});

test("@rail-groups A service the agent left running does not keep the person's turn in Käynnissä", async ({
  page,
}) => {
  await page.request.get("/fixture/conversations-reset");
  await page.request.get("/fixture/scenario?value=ready");
  // Wire seam: the daemon's waiting_on, as for a live waking file server
  // the agent started in an earlier turn (before_turn) or in this one.
  let waits: Record<string, unknown>[] = [];
  let id = "";
  await page.route("**/api/v1/snapshot", async (route) => {
    try {
      const response = await route.fetch();
      const body = await response.json();
      for (const a of body.agents)
        if (a.agent_id === id && waits.length && !a.run_active)
          a.waiting_on = waits;
      await route.fulfill({ response, json: body });
    } catch {
      await route.abort().catch(() => {});
    }
  });
  await page.goto("/workspaces");
  await page.getByTestId("github-sign-in").click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  const nav = page.getByTestId("workspace-navigation");
  id = await start(page);
  await page.getByTestId("message-input").fill("Käynnistä palvelin");
  await page
    .getByTestId("send")
    .and(page.locator('[data-mode="send"]'))
    .click();
  await expect(page.getByTestId("send")).toHaveAttribute("data-mode", "send", {
    timeout: 25000,
  });
  const service = {
    process_id: "proc_6b7c",
    name: "script-review",
    kind: "process",
    run_ids: [],
  };
  waits = [{ ...service, before_turn: true }];
  await nav.getByTestId("snapshot-refresh").click();
  const yours = nav.getByTestId("rail-yours").getByTestId(`agent-item-${id}`);
  await expect(yours).toBeVisible({ timeout: 25000 });
  await expect(yours).toHaveAttribute("data-ball", "you");
  await expect(yours.getByTestId("rail-background-service")).toBeVisible();
  await expect(yours).toHaveAttribute(
    "title",
    /Taustalla käynnissä: script-review/,
  );
  await expect(
    nav.getByTestId("rail-running").getByTestId(`agent-item-${id}`),
  ).toHaveCount(0);

  // A process started within the turn is what the turn ended to wait for.
  waits = [service];
  await nav.getByTestId("snapshot-refresh").click();
  const running = nav
    .getByTestId("rail-running")
    .getByTestId(`agent-item-${id}`);
  await expect(running).toBeVisible({ timeout: 25000 });
  await expect(running).toHaveAttribute("data-ball", "work");
  await expect(running.getByTestId("rail-background-service")).toHaveCount(0);
});
