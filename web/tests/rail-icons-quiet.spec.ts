import { resolve } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { snapshot } from "../lab/session.mjs";
import { hostOrigin } from "../test-ports.mjs";
import { createHostTest, expect, type Locator, type Page } from "./worker-host";

const capture = process.env.OH_VISUAL_CAPTURE === "1";
const firstWorkspace = capture ? "aurinkokello" : "ordinary-dir";
const secondWorkspace = capture ? "kotisivu" : "git-project";
const test = createHostTest(false, capture ? { BROWSER_HOST_LAB: "1" } : {});
const evidence = (name: string) =>
  resolve(`../issues/rail-quiet-all-flat/evidence/${name}`);

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
async function preferences(page: Page) {
  return (await page.request.get("/api/v1/account/preferences")).json();
}
// Contrast is judged on the settled theme, not mid-transition.
const settled = (page: Page) =>
  page.evaluate(() =>
    Promise.all(document.getAnimations().map((a) => a.finished)).then(() => {}),
  );
const quietId = (n: number) =>
  `pi:00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
// Newest first is n = 8 down to 0; by name the order differs.
const titles = [
  "Verbien taivutus",
  "Palvelimen levytila",
  "Laskujen arkistointi",
  "B1-sanasto",
  "Lokakuun budjetti",
  "Perfektin apuverbit",
  "Workerin muistiraja",
  "Sanaston kertaus",
  "Palomuurin osoitteet",
];
const titlesOf = (rows: Locator) =>
  rows.evaluateAll((els) =>
    els.map((e) =>
      e.querySelector("[data-agent-title]")?.getAttribute("data-agent-title"),
    ),
  );

// Wire seam: nine old terminal histories in two workspaces (odd n in the
// second), one archived and one a finished worktree conversation. Ages are
// hours before now, so the rows read as a working day.
async function quietWorld(page: Page) {
  const ids: { first?: string; second?: string } = {};
  // On the context, so a second tab of the same person sees the same world.
  await page.context().route("**/api/v1/snapshot", async (route) => {
    // A tab closed mid-request has nothing left to answer.
    const response = await route.fetch().catch(() => undefined);
    const body = await response?.json().catch(() => undefined);
    if (!response || !body) return;
    const workspace = body.workspaces.find(
      (w: { name: string }) => w.name === firstWorkspace,
    );
    const other = body.workspaces.find(
      (w: { name: string }) => w.name === secondWorkspace,
    );
    if (workspace && other) {
      ids.first = workspace.workspace_id;
      ids.second = other.workspace_id;
      const base = {
        observation_token: "fixture-quiet-token",
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
      const now = Date.now();
      body.agents = [
        ...body.agents,
        ...titles.map((title, n) => ({
          ...base,
          agent_id: quietId(n),
          title: {
            display: title,
            source: "native_session",
            generation_state: "not_requested",
            replaceable: true,
          },
          workspace_id: n % 2 ? other.workspace_id : workspace.workspace_id,
          changed_at: new Date(now - (9 - n) * 3 * 3600000).toISOString(),
          ...(n === 7 ? { archive: "archived" } : {}),
          ...(n === 8 ? { worktree_id: "ws_example123" } : {}),
        })),
      ];
    }
    await route.fulfill({ response, json: body });
  });
  return ids;
}

test("@rail-quiet every other conversation as one flat list, in every layout", async ({
  page,
}) => {
  test.setTimeout(180000);
  await quietWorld(page);
  await login(page);
  const nav = page.getByTestId("workspace-navigation");
  const quiet = nav.getByTestId("rail-quiet");
  const rows = quiet.getByTestId(/^agent-item-/);
  // Archived stays out; the finished worktree conversation is in.
  await expect(quiet.getByTestId(`agent-item-${quietId(7)}`)).toHaveCount(0);
  await expect(quiet.getByTestId(`agent-item-${quietId(8)}`)).toHaveCount(1);
  const ours = (await titlesOf(rows)).filter((t) => titles.includes(t ?? ""));
  expect(ours).toEqual([8, 6, 5, 4, 3, 2, 1, 0].map((n) => titles[n]));
  // No section of the old rail and no workspace headings in Hiljaiset.
  await expect(nav.getByTestId("rail-recent")).toHaveCount(0);
  await expect(quiet.getByTestId(/^rail-group-/)).toHaveCount(0);
  await expect(quiet.getByTestId("rail-quiet-count")).toHaveText(
    String(await rows.count()),
  );
  await page.goto(`/agents/${quietId(0)}`);
  const open = quiet.getByTestId(`agent-item-${quietId(0)}`);
  {
    const icons = true;
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.reload();
    await expect(open).toBeVisible();
    await expect(quiet.getByTestId("workspace-icon-button")).toHaveCount(
      await rows.count(),
    );
    await expect(open.getByTestId("rail-row-workspace")).toHaveCount(0);
    for (const phone of [false, true]) {
      await page.setViewportSize(
        phone ? { width: 390, height: 844 } : { width: 1280, height: 900 },
      );
      if (phone) await page.getByTestId("navigation-open").click();
      for (const theme of ["light", "dark"] as const) {
        await page.emulateMedia({ colorScheme: theme });
        await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
        await expect(open).toBeVisible();
        // Review images must show the settled theme, not a colour transition.
        if (capture) {
          await page.waitForTimeout(300);
          await snapshot(
            page,
            evidence(
              `${phone ? "phone" : "desktop"}-${theme}-icons-${icons ? "on" : "off"}`,
            ),
            { labOrigin: new URL(page.url()).origin },
          );
        }
      }
      await settled(page);
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
  // The narrow rail beside the editor has no Hiljaiset.
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/workspaces");
  await expect(quiet).toBeVisible();
  await nav.getByTestId("close-navigation").click();
  await expect(quiet).toHaveCount(0);
});

test("@rail-quiet the icon grid orders and narrows, follows the account and keeps the open row ringed", async ({
  page,
}) => {
  test.setTimeout(120000);
  const ids = await quietWorld(page);
  await login(page);
  await page.goto(`/agents/${quietId(0)}`);
  const nav = page.getByTestId("workspace-navigation");
  const quiet = nav.getByTestId("rail-quiet");
  const rows = quiet.getByTestId(/^agent-item-/);
  const open = quiet.getByTestId(`agent-item-${quietId(0)}`);
  await expect(open).toBeVisible();
  // The open row is ringed all round, never an edge stripe.
  const ring = await open
    .locator(".ah-now-row")
    .evaluate((el) => getComputedStyle(el).boxShadow);
  expect(ring).toMatch(/0px 0px 0px 1\.5px/);
  expect(ring).not.toMatch(/inset/);
  expect(
    await open
      .locator(".ah-now-row")
      .evaluate((el) => getComputedStyle(el).borderLeftWidth),
  ).toBe("0px");

  const menu = quiet.getByTestId("rail-quiet-menu");
  const dialog = page.getByTestId("rail-quiet-dialog");
  const sort = dialog.getByTestId("rail-quiet-sort");
  await menu.click();
  await expect(dialog).toBeVisible();
  // No explanatory foot text: only Valmis.
  await expect(dialog.locator(".ah-quiet-foot")).toHaveText("Valmis");
  await expect(sort.getByTestId(/^segment-/)).toHaveCount(3);
  await expect(sort.getByTestId("segment-newest")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  if (capture)
    await snapshot(page, evidence("desktop-light-menu"), {
      labOrigin: new URL(page.url()).origin,
    });

  await sort.getByTestId("segment-name").click();
  await expect(sort.getByTestId("segment-name")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect((await preferences(page)).quiet_sort).toBe("name");
  const named = (await titlesOf(rows)).filter((t) => titles.includes(t ?? ""));
  expect(named).toEqual(
    [...named].sort((a, b) => (a ?? "").localeCompare(b ?? "", "fi")),
  );

  await sort.getByTestId("segment-workspace").click();
  await expect(sort.getByTestId("segment-workspace")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  // Grouped without headings: a hairline between workspaces.
  await expect(quiet.locator(".ah-quiet-gap").first()).toBeAttached();
  await expect(quiet.getByTestId(/^rail-group-/)).toHaveCount(0);

  // One workspace: by workspace is not offered and the list is newest first,
  // the stored order is kept for the return to every workspace.
  await dialog.getByTestId(`rail-quiet-tile-${ids.second}`).click();
  await expect(
    dialog.getByTestId(`rail-quiet-tile-${ids.second}`),
  ).toHaveAttribute("aria-pressed", "true");
  expect(await preferences(page)).toMatchObject({
    quiet_sort: "workspace",
    quiet_workspace: ids.second,
  });
  await expect(sort.getByTestId(/^segment-/)).toHaveCount(2);
  await expect(sort.getByTestId("segment-workspace")).toHaveCount(0);
  await expect(sort.getByTestId("segment-newest")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  // The open conversation is in the other workspace: it stays in sight,
  // last and marked.
  await expect(rows.last()).toHaveAttribute(
    "data-testid",
    `agent-item-${quietId(0)}`,
  );
  await expect(open).toHaveAttribute("data-kept", "true");
  await expect(quiet.getByTestId("rail-quiet-count")).toContainText("/");
  for (const n of [1, 3, 5])
    await expect(quiet.getByTestId(`agent-item-${quietId(n)}`)).toBeVisible();
  await expect(quiet.getByTestId(`agent-item-${quietId(2)}`)).toHaveCount(0);
  if (capture)
    await snapshot(page, evidence("desktop-light-narrowed"), {
      labOrigin: new URL(page.url()).origin,
    });

  // The choice follows the person to another device (another tab reads the
  // same account).
  const otherPage = await page.context().newPage();
  try {
    await otherPage.goto("/workspaces");
    const elsewhere = otherPage
      .getByTestId("workspace-navigation")
      .getByTestId("rail-quiet");
    await expect(elsewhere.getByTestId(`agent-item-${quietId(2)}`)).toHaveCount(
      0,
    );
    await expect(
      elsewhere.getByTestId(`agent-item-${quietId(1)}`),
    ).toBeVisible();
  } finally {
    await otherPage.close();
  }

  await dialog.getByTestId("rail-quiet-tile-all").click();
  await expect(sort.getByTestId("segment-workspace")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect((await preferences(page)).quiet_workspace).toBeNull();
  await dialog.getByTestId("rail-quiet-done").click();
  await expect(dialog).toHaveCount(0);
  // Esc closes it too.
  await menu.click();
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  // The count setting is gone with Viimeisimmät, from the page and search.
  await page.goto("/settings/appearance");
  await expect(page.locator('[data-settings-row="recent-count"]')).toHaveCount(
    0,
  );
});

test("@rail-quiet folding is per device and keeps the open row and the workspace pills", async ({
  page,
}) => {
  test.setTimeout(120000);
  const ids = await quietWorld(page);
  await login(page);
  await page.goto(`/agents/${quietId(0)}`);
  const nav = page.getByTestId("workspace-navigation");
  const quiet = nav.getByTestId("rail-quiet");
  const rows = quiet.getByTestId(/^agent-item-/);
  {
    const icons = true;
    await page.reload();
    await expect(rows.first()).toBeVisible();
    const fold = quiet.getByTestId("rail-quiet-fold");
    await expect(fold).toHaveAttribute("aria-expanded", "true");
    await fold.click();
    await expect(fold).toHaveAttribute("aria-expanded", "false");
    // Folded: only the open conversation's row, then the pills.
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toHaveAttribute(
      "data-testid",
      `agent-item-${quietId(0)}`,
    );
    await expect(quiet.getByTestId("rail-quiet-menu")).toHaveCount(0);
    await expect(
      quiet.getByTestId(`rail-quiet-pill-${ids.second}`),
    ).toBeVisible();
    await expect(
      quiet
        .getByTestId(`rail-quiet-pill-${ids.first}`)
        .getByTestId("workspace-icon"),
    ).toHaveCount(1);
    await page.reload();
    await expect(fold).toHaveAttribute("aria-expanded", "false");
    // Per device: the browser keeps it, the account does not.
    expect(
      await page.evaluate(() => localStorage.getItem("nah:rail-quiet-folded")),
    ).toBe("1");
    expect(Object.keys(await preferences(page))).not.toContain("folded");
    for (const phone of [false, true]) {
      await page.setViewportSize(
        phone ? { width: 390, height: 844 } : { width: 1280, height: 900 },
      );
      if (phone) await page.getByTestId("navigation-open").click();
      for (const theme of ["light", "dark"] as const) {
        await page.emulateMedia({ colorScheme: theme });
        await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
        await expect(rows.first()).toBeVisible();
        if (capture) {
          await page.waitForTimeout(300);
          await snapshot(
            page,
            evidence(
              `${phone ? "phone" : "desktop"}-${theme}-icons-${icons ? "on" : "off"}-folded`,
            ),
            { labOrigin: new URL(page.url()).origin },
          );
        }
      }
      await settled(page);
      expect(
        (
          await new AxeBuilder({ page })
            .include('[data-testid="workspace-navigation"]')
            .analyze()
        ).violations,
      ).toEqual([]);
      if (phone) await page.keyboard.press("Escape");
    }
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.emulateMedia({ colorScheme: "light" });
    // A pill opens the section narrowed to its workspace.
    await quiet.getByTestId(`rail-quiet-pill-${ids.second}`).click();
    await expect(fold).toHaveAttribute("aria-expanded", "true");
    await expect
      .poll(async () => (await preferences(page)).quiet_workspace)
      .toBe(ids.second);
    await expect(quiet.getByTestId(`agent-item-${quietId(2)}`)).toHaveCount(0);
    await expect(quiet.getByTestId(`agent-item-${quietId(1)}`)).toBeVisible();
    expect(
      (
        await page.request.put("/api/v1/account/preferences", {
          headers: await headers(page),
          data: { quiet_workspace: null },
        })
      ).ok(),
    ).toBe(true);
  }
});

test("@rail-quiet a finished native conversation remains after idle stop and daemon restart, then leaves on archive", async ({
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
  // Stay to read the native reply before leaving, otherwise it correctly
  // becomes unread. Read, it waits in Sinun vuorosi until Ei nyt.
  await expect(page.getByTestId("conversation-timeline")).toContainText(
    'Selvä. Kysyit: "Ensimmäinen viesti".',
    { timeout: 25000 },
  );
  await expect(page.getByTestId("send")).toHaveAttribute("data-mode", "send");
  const read = nav.getByTestId("rail-yours").getByTestId(`agent-item-${id}`);
  await expect(read.getByTestId("rail-mark")).toHaveAttribute(
    "data-state",
    "read",
    {
      timeout: 25000,
    },
  );
  await read.hover();
  await read.getByTestId("rail-not-now-conversation").click();
  const row = nav.getByTestId("rail-quiet").getByTestId(`agent-item-${id}`);
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
