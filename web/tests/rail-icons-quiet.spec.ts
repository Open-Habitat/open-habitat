import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { hostOrigin } from "../test-ports.mjs";
import { expect, type Page, test } from "./worker-host";

// Hiljaiset with workspace icons (experimental): each row already names its
// workspace with its icon, so quiet conversations stand under the rule as
// ordinary rows; without icons they stay folded per workspace.
test.use({
  baseURL: hostOrigin,
  ignoreHTTPSErrors: true,
  viewport: { width: 1280, height: 800 },
  // Jari reviews the screenshots; 1x evidence was blurry.
  deviceScaleFactor: 2,
});

// Review material for Jari, never a passing visual comparison:
// OH_RAIL_ICONS_CAPTURE=before|after names the shots.
const capture = process.env.OH_RAIL_ICONS_CAPTURE;
async function shot(page: Page, name: string) {
  if (!capture) return;
  const dir = resolve("../issues/rail-icons-no-grouping/evidence");
  mkdirSync(dir, { recursive: true });
  for (const scheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.waitForTimeout(300);
    await page
      .getByTestId("workspace-navigation")
      .screenshot({ path: resolve(dir, `${capture}-${name}-${scheme}.png`) });
  }
  await page.emulateMedia({ colorScheme: "light" });
}

async function session(page: Page) {
  const s = await (await page.request.get("/auth/session")).json();
  return {
    Origin: new URL(page.url()).origin,
    "X-Agent-Host-CSRF": s.csrf as string,
  };
}

test("@rail-groups @workspace-icons quiet conversations fold per workspace without icons and stand as rows under Hiljaiset with them", async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.request.get("/fixture/conversations-reset");
  await page.request.get("/fixture/scenario?value=ready");
  // Wire seam as in rail-groups: chosen conversations look quiet for hours
  // and keep a worker waiting at its own prompt, so they stay in Käynnissä
  // as done rows.
  const aged = new Map<string, number>();
  const parked = new Set<string>();
  await page.route("**/api/v1/snapshot", async (route) => {
    try {
      const response = await route.fetch();
      const body = await response.json();
      for (const a of body.agents) {
        if (parked.has(a.agent_id)) a.spinoffs_idle = 1;
        const hours = aged.get(a.agent_id);
        if (hours && a.changed_at)
          a.changed_at = new Date(
            Date.parse(a.changed_at) - hours * 3600000,
          ).toISOString();
      }
      await route.fulfill({ response, json: body });
    } catch {
      await route.abort().catch(() => {});
    }
  });
  await page.goto("/workspaces");
  await page
    .getByRole("button")
    .and(page.getByTestId("github-sign-in"))
    .click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  const nav = page.getByTestId("workspace-navigation");
  const running = nav.getByTestId("rail-running");
  const start = async (workspace: string) => {
    await nav
      .getByRole("link")
      .and(page.getByTestId(`workspace-${workspace}`))
      .click();
    await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
    // A new one, not the conversation the workspace page may reopen.
    const opened = () =>
      new URL(page.url()).searchParams.get("conversation") ?? "";
    await expect
      .poll(() => {
        const id = opened();
        return id.startsWith("pi:") && !parked.has(id);
      })
      .toBe(true);
    const id = opened();
    parked.add(id);
    // The host's last-change time comes with the first turn.
    await page.getByTestId("message-input").fill("Ensimmäinen viesti");
    await page
      .getByTestId("send")
      .and(page.locator('[data-mode="send"]'))
      .click();
    await expect(running.getByTestId(`agent-item-${id}`)).toHaveAttribute(
      "data-ball",
      "done",
      { timeout: 25000 },
    );
    return id;
  };

  // Quiet in a workspace that still has a live row, quiet in one where
  // everything is quiet, and the open conversation that never folds.
  const ordinaryQuiet = await start("ordinary-dir");
  const projectQuiet = await start("git-project");
  aged.set(ordinaryQuiet, 3);
  aged.set(projectQuiet, 26);
  const open = await start("ordinary-dir");
  await nav.getByTestId("snapshot-refresh").click();
  await expect(running.getByTestId(`agent-item-${open}`)).toBeVisible();

  // Icons off: the folds stay as they are.
  const quietFold = running.getByTestId("rail-fold-quiet-ordinary-dir");
  const dormantFold = running.getByTestId("rail-fold-dormant-git-project");
  await expect(quietFold).toHaveText("1 hiljainen");
  await expect(dormantFold).toContainText("git-project");
  await expect(running.getByTestId("rail-quiet-rule")).toBeVisible();
  await expect(running.getByTestId(`agent-item-${ordinaryQuiet}`)).toHaveCount(
    0,
  );
  await expect(running.getByTestId(`agent-item-${projectQuiet}`)).toHaveCount(
    0,
  );
  await shot(page, "icons-off");

  expect(
    (
      await page.request.put("/api/v1/account/preferences", {
        headers: await session(page),
        data: { experimental: { "workspace-icons": true } },
      })
    ).ok(),
  ).toBeTruthy();
  await page.reload();
  await expect(
    running
      .getByTestId(`agent-item-${open}`)
      .getByTestId("workspace-icon-button"),
  ).toBeVisible();
  await shot(page, "icons-on");

  // Icons on: no folds; under the rule, ordinary rows with their icons, the
  // most recently changed first.
  await expect(running.getByTestId(/^rail-fold-/)).toHaveCount(0);
  await expect(running.getByTestId("rail-quiet-rule")).toHaveText(
    "Hiljaiset · yli tunnin",
  );
  const quiet = running.getByTestId("rail-quiet");
  await expect(quiet.getByTestId(/^agent-item-/)).toHaveCount(2);
  await expect(quiet.getByTestId(/^agent-item-/).nth(0)).toHaveAttribute(
    "data-testid",
    `agent-item-${ordinaryQuiet}`,
  );
  await expect(quiet.getByTestId(/^agent-item-/).nth(1)).toHaveAttribute(
    "data-testid",
    `agent-item-${projectQuiet}`,
  );
  await expect(quiet.getByTestId("workspace-icon-button")).toHaveCount(2);
  await expect(
    quiet.getByTestId(`agent-item-${projectQuiet}`).locator("time"),
  ).toHaveText("1 pv");
  await expect(running.getByTestId("rail-group-git-project")).toHaveCount(0);
  await expect(
    running
      .getByTestId("rail-group-ordinary-dir")
      .getByTestId(`agent-item-${ordinaryQuiet}`),
  ).toHaveCount(0);
  expect(
    (
      await new AxeBuilder({ page })
        .include('[data-testid="workspace-navigation"]')
        .analyze()
    ).violations,
  ).toEqual([]);
});
