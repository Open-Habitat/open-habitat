import { resolve } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { snapshot } from "../lab/session.mjs";
import { hostOrigin } from "../test-ports.mjs";
import { createHostTest, expect, type Page } from "./worker-host";

const capture = process.env.OH_VISUAL_CAPTURE === "1";
const firstWorkspace = capture ? "aurinkokello" : "ordinary-dir";
const secondWorkspace = capture ? "kotisivu" : "git-project";
const test = createHostTest(false, capture ? { BROWSER_HOST_LAB: "1" } : {});

test.use({
  baseURL: hostOrigin,
  ignoreHTTPSErrors: true,
  viewport: { width: 1280, height: 900 },
  deviceScaleFactor: 2,
});

async function login(page: Page) {
  await page.request.get("/fixture/conversations-reset");
  await page.request.get("/fixture/scenario?value=ready");
  await page.goto("/workspaces");
  await page.getByTestId("github-sign-in").click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
}
async function headers(page: Page) {
  const s = await (await page.request.get("/auth/session")).json();
  return { Origin: new URL(page.url()).origin, "X-Agent-Host-CSRF": s.csrf };
}

// Wire seam: seven old terminal histories plus archived and worktree histories.
// Their timestamps are fixed, not tied to the browser clock or Pi liveness.
test("@rail-recent recent count, exclusions, grouping, phone and icon layouts", async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.route("**/api/v1/snapshot", async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    const workspace = body.workspaces.find(
      (w: { name: string }) => w.name === firstWorkspace,
    );
    const other = body.workspaces.find(
      (w: { name: string }) => w.name === secondWorkspace,
    );
    if (workspace && other) {
      const base = {
        workspace_id: workspace.workspace_id,
        observation_token: "fixture-recent-token",
        presence: "present",
        activity: "idle",
        capabilities: {
          history: { state: "supported", reason_code: "available" },
        },
        queue: { revision: "fixture-revision", steering: [], follow_up: [] },
        history: "readable",
        process: "confirmed_exited",
        control: "read_only",
        live_tail: [],
        run_active: false,
        archive: "active",
      };
      body.agents = Array.from({ length: 9 }, (_, n) => ({
        ...base,
        agent_id: `pi:00000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
        title: {
          display: `Recent conversation ${n}`,
          source: "native_session",
          generation_state: "not_requested",
          replaceable: true,
        },
        workspace_id: n % 2 ? other.workspace_id : workspace.workspace_id,
        changed_at: new Date(Date.UTC(2026, 0, n + 1)).toISOString(),
        ...(n === 7 ? { archive: "archived" } : {}),
        ...(n === 8 ? { worktree_id: "ws_example123" } : {}),
      }));
    }
    await route.fulfill({ response, json: body });
  });
  await login(page);
  const nav = page.getByTestId("workspace-navigation");
  const recent = nav.getByTestId("rail-recent");
  const rows = recent.getByTestId(/^agent-item-/);
  await expect(rows).toHaveCount(5);
  await page.goto("/agents/pi:00000000-0000-4000-8000-000000000000");
  await expect(rows).toHaveCount(6);
  await expect(recent.locator("[data-kept]")).toHaveCount(1);
  await page.goto("/workspaces");
  await expect(rows).toHaveCount(5);
  await nav.getByTestId("close-navigation").click();
  await expect(recent).toHaveCount(0);
  await nav.getByTestId("navigation-open").click();
  await expect(rows).toHaveCount(5);
  for (const n of [7, 8])
    await expect(
      recent.getByTestId(
        `agent-item-pi:00000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
      ),
    ).toHaveCount(0);
  await expect(recent.getByTestId(/^rail-group-/).first()).toHaveAttribute(
    "data-testid",
    `rail-group-${firstWorkspace}`,
  );
  for (const icons of [false, true]) {
    expect(
      (
        await page.request.put("/api/v1/account/preferences", {
          headers: await headers(page),
          data: { experimental: { "workspace-icons": icons } },
        })
      ).ok(),
    ).toBe(true);
    await page.reload();
    await expect(rows).toHaveCount(5);
    await expect(recent.getByTestId("workspace-icon-button")).toHaveCount(
      icons ? 5 : 0,
    );
    await expect(recent.getByTestId(/^rail-group-/)).toHaveCount(icons ? 0 : 2);
    for (const phone of [false, true]) {
      await page.setViewportSize(
        phone ? { width: 390, height: 844 } : { width: 1280, height: 900 },
      );
      if (phone) await page.getByTestId("navigation-open").click();
      for (const theme of ["light", "dark"] as const) {
        await page.emulateMedia({ colorScheme: theme });
        await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
        await expect(recent).toBeVisible();
        // Review images must show the settled theme, not a colour transition.
        if (capture) await page.waitForTimeout(300);
        if (process.env.OH_VISUAL_CAPTURE === "1")
          await snapshot(
            page,
            resolve(
              `../issues/rail-recent-five/evidence/${phone ? "phone" : "desktop"}-${theme}-icons-${icons ? "on" : "off"}`,
            ),
            { labOrigin: new URL(page.url()).origin },
          );
      }
      expect(
        (
          await new AxeBuilder({ page })
            .include('[data-testid="workspace-navigation"]')
            .analyze()
        ).violations,
      ).toEqual([]);
      if (phone) await page.keyboard.press("Escape");
    }
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/settings/appearance");
  const input = page.getByTestId("recent-count-input");
  await expect(input).toHaveValue("5");
  await input.fill("2");
  await input.press("Enter");
  await expect
    .poll(
      async () =>
        (await (await page.request.get("/api/v1/account/preferences")).json())
          .recent_count,
    )
    .toBe(2);
  await page.reload();
  await expect(input).toHaveValue("2");
  await expect(rows).toHaveCount(2);
  const otherPage = await page.context().newPage();
  try {
    await otherPage.goto("/settings/appearance");
    await expect(otherPage.getByTestId("recent-count-input")).toHaveValue("2");
  } finally {
    await otherPage.close();
  }
  // Search reaches the actual row, not a second setting.
  await page.getByTestId("settings-search").fill("recent");
  await page.getByTestId("settings-search").press("Enter");
  await expect(
    page.locator('[data-settings-row="recent-count"]'),
  ).toBeFocused();
});

test("@rail-recent a finished native conversation remains after idle stop and daemon restart, then leaves on archive", async ({
  page,
}) => {
  test.setTimeout(120000);
  await login(page);
  const nav = page.getByTestId("workspace-navigation");
  await nav.getByTestId(`workspace-${firstWorkspace}`).click();
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  await expect(page).toHaveURL(/conversation=pi(?:%3A|:)/);
  const id = new URL(page.url()).searchParams.get("conversation") ?? "";
  await page.getByTestId("message-input").fill("Ensimmäinen viesti");
  await page
    .getByTestId("send")
    .and(page.locator('[data-mode="send"]'))
    .click();
  const row = nav.getByTestId("rail-recent").getByTestId(`agent-item-${id}`);
  await expect(row).toBeVisible({ timeout: 25000 });
  await page.request.get("/fixture/taskfleet?status=empty");
  await page.goto("/workspaces");
  await expect
    .poll(async () => {
      await page.request.get("/fixture/idle-stop");
      return (
        await (
          await page.request.get(`/api/v1/conversations/${id.slice(3)}/status`)
        ).json()
      ).state;
    })
    .toBe("stopped");
  await page.reload();
  await expect(row).toBeVisible();
  expect((await page.request.get("/fixture/daemon-restart")).status()).toBe(
    204,
  );
  await page.reload();
  await expect(row).toBeVisible();
  await row.getByTestId("rail-archive-conversation").click();
  await expect(row).toHaveCount(0);
});
