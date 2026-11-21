import AxeBuilder from "@axe-core/playwright";
import { hostOrigin } from "../test-ports.mjs";
import { openQuietOnDevice } from "./quiet-open";
import { expect, type Page, test } from "./worker-host";

test.use({
  baseURL: hostOrigin,
  ignoreHTTPSErrors: true,
  viewport: { width: 1280, height: 900 },
});

const firstWorkspace = "ordinary-dir";
const secondWorkspace = "git-project";
const yoursId = (n: number) =>
  `pi:00000000-0000-4000-8000-1000000000${String(n).padStart(2, "0")}`;
const runningId = (n: number) =>
  `pi:00000000-0000-4000-8000-2000000000${String(n).padStart(2, "0")}`;

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
async function put(page: Page, data: object) {
  const reply = await page.request.put("/api/v1/account/preferences", {
    headers: await headers(page),
    data,
  });
  expect(reply.ok()).toBe(true);
}

// Wire seam: four conversations waiting for the person (opened, never
// written to) and four whose worker waits at its prompt (Käynnissä), half
// in each workspace: even n in the first, odd n in the second.
async function sectionWorld(page: Page) {
  const ids: { first?: string; second?: string; third?: string } = {};
  await page.context().route("**/api/v1/snapshot", async (route) => {
    const response = await route.fetch().catch(() => undefined);
    const body = await response?.json().catch(() => undefined);
    if (!response || !body) return;
    const find = (name: string) =>
      body.workspaces.find((w: { name: string }) => w.name === name);
    const first = find(firstWorkspace);
    const second = find(secondWorkspace);
    const third = body.workspaces.find(
      (w: { name: string; presence: string; visibility: string }) =>
        w.name !== firstWorkspace &&
        w.name !== secondWorkspace &&
        w.presence === "present" &&
        w.visibility === "visible",
    );
    if (first && second) {
      ids.first = first.workspace_id;
      ids.second = second.workspace_id;
      ids.third = third?.workspace_id;
      const base = {
        observation_token: "fixture-section-token",
        presence: "present",
        activity: "idle",
        capabilities: {
          history: { state: "supported", reason_code: "available" },
        },
        queue: { revision: "fixture-revision", steering: [], follow_up: [] },
        process: "confirmed_exited",
        control: "read_only",
        live_tail: [],
        run_active: false,
        archive: "active",
      };
      const now = Date.now();
      const agent = (id: string, n: number, title: string) => ({
        ...base,
        agent_id: id,
        title: {
          display: title,
          source: "native_session",
          generation_state: "not_requested",
          replaceable: true,
        },
        workspace_id: n % 2 ? second.workspace_id : first.workspace_id,
        changed_at: new Date(now - (n + 1) * 600000).toISOString(),
      });
      body.agents = [
        ...body.agents,
        ...[0, 1, 2, 3].map((n) => ({
          ...agent(yoursId(n), n, `Odottaa ${n}`),
          history: "missing",
        })),
        ...[0, 1, 2, 3].map((n) => ({
          ...agent(runningId(n), n, `Worker ${n}`),
          history: "readable",
          spinoffs_idle: 1,
        })),
      ];
    }
    await route.fulfill({ response, json: body });
  });
  return ids;
}

test("@rail-section-filter Sinun vuorosi and Käynnissä narrow each on their own, follow the account, and ⌥↑/⌥↓ walks only what is shown", async ({
  page,
}) => {
  test.setTimeout(180000);
  // Hiljaiset is open on this device: a narrowing elsewhere must leave its
  // rows alone, which a list folded by itself in the crowd cannot show (it
  // opens by itself once a narrowing makes room).
  await openQuietOnDevice(page.context());
  const ids = await sectionWorld(page);
  await login(page);
  const nav = page.getByTestId("workspace-navigation");
  const yours = nav.getByTestId("rail-yours");
  const running = nav.getByTestId("rail-running");
  const quiet = nav.getByTestId("rail-quiet");
  for (let n = 0; n < 4; n++) {
    await expect(yours.getByTestId(`agent-item-${yoursId(n)}`)).toBeVisible();
    await expect(
      running.getByTestId(`agent-item-${runningId(n)}`),
    ).toBeVisible();
  }
  const quietBefore = await quiet.getByTestId(/^agent-item-/).count();
  expect(quietBefore).toBeGreaterThan(0);
  const yoursTotal = await yours.getByTestId(/^agent-item-/).count();

  // Sinun vuorosi narrows to the second workspace; nothing else moves.
  await yours.getByTestId("rail-yours-menu").click();
  const dialog = page.getByTestId("rail-yours-dialog");
  await expect(dialog.getByTestId("rail-yours-tile-all")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await dialog.getByTestId(`rail-yours-tile-${ids.second}`).click();
  await expect(
    dialog.getByTestId(`rail-yours-tile-${ids.second}`),
  ).toHaveAttribute("aria-pressed", "true");
  expect((await preferences(page)).yours_workspace).toBe(ids.second);
  expect((await preferences(page)).running_workspace).toBeNull();
  expect((await preferences(page)).quiet_workspace).toBeNull();
  await dialog.getByTestId("rail-yours-done").click();
  await expect(dialog).toHaveCount(0);
  for (const n of [1, 3])
    await expect(yours.getByTestId(`agent-item-${yoursId(n)}`)).toBeVisible();
  for (const n of [0, 2])
    await expect(yours.getByTestId(`agent-item-${yoursId(n)}`)).toHaveCount(0);
  await expect(yours.getByTestId("rail-yours-count")).toContainText(
    `/${yoursTotal}`,
  );
  for (let n = 0; n < 4; n++)
    await expect(
      running.getByTestId(`agent-item-${runningId(n)}`),
    ).toBeVisible();
  await expect(quiet.getByTestId(/^agent-item-/)).toHaveCount(quietBefore);

  // Käynnissä narrows to the first workspace, its own choice.
  await running.getByTestId("rail-running-menu").click();
  await page
    .getByTestId("rail-running-dialog")
    .getByTestId(`rail-running-tile-${ids.first}`)
    .click();
  await expect
    .poll(async () => (await preferences(page)).running_workspace)
    .toBe(ids.first);
  await page.keyboard.press("Escape");
  for (const n of [0, 2])
    await expect(
      running.getByTestId(`agent-item-${runningId(n)}`),
    ).toBeVisible();
  for (const n of [1, 3])
    await expect(running.getByTestId(`agent-item-${runningId(n)}`)).toHaveCount(
      0,
    );
  expect((await preferences(page)).yours_workspace).toBe(ids.second);

  // The choice follows the person to a reload.
  await page.reload();
  await expect(yours.getByTestId("rail-yours-menu")).toHaveAttribute(
    "data-narrowed",
    "true",
  );
  await expect(running.getByTestId("rail-running-menu")).toHaveAttribute(
    "data-narrowed",
    "true",
  );
  await expect(yours.getByTestId(`agent-item-${yoursId(0)}`)).toHaveCount(0);
  await expect(running.getByTestId(`agent-item-${runningId(1)}`)).toHaveCount(
    0,
  );

  await expect(yours.getByTestId(`agent-item-${yoursId(1)}`)).toBeVisible();
  await expect(running.getByTestId(`agent-item-${runningId(0)}`)).toBeVisible();
  // ⌥↓ walks the rows in the order shown, hidden ones skipped; ⌥↑ walks back.
  const links = nav.getByTestId("agent-link");
  const hrefs = await links.evaluateAll((els) =>
    els.map((el) => el.getAttribute("href") ?? ""),
  );
  const place = (href: string) => {
    const url = new URL(href, hostOrigin);
    return decodeURIComponent(url.pathname + url.search);
  };
  for (const hidden of [yoursId(0), yoursId(2), runningId(1), runningId(3)])
    expect(hrefs.some((href) => place(href).includes(hidden))).toBe(false);
  await page.goto(hrefs[0]);
  // The rail must know the open row and the account's narrowing before a
  // key can step from it.
  await expect(yours.getByTestId("rail-yours-menu")).toHaveAttribute(
    "data-narrowed",
    "true",
  );
  await expect(
    nav.locator(`a[aria-current="page"][href="${hrefs[0]}"]`),
  ).toBeVisible();
  const at = () => place(page.url());
  const steps = Math.min(hrefs.length - 1, 6);
  for (let i = 1; i <= steps; i++) {
    await page.keyboard.press("Alt+ArrowDown");
    await expect.poll(at).toBe(place(hrefs[i]));
  }
  await page.keyboard.press("Alt+ArrowUp");
  await expect.poll(at).toBe(place(hrefs[steps - 1]));
  // Shift cycles only the shown waiting rows.
  const waiting = (
    await yours
      .getByTestId("agent-link")
      .evaluateAll((els) => els.map((el) => el.getAttribute("href") ?? ""))
  ).map(place);
  for (let i = 0; i < waiting.length + 1; i++) {
    const before = await at();
    await page.keyboard.press("Alt+Shift+ArrowDown");
    await expect.poll(at).not.toBe(before);
    expect(waiting).toContain(await at());
  }

  // The open conversation stays in sight when the narrowing would hide it.
  await page.goto(`/agents/${yoursId(0)}`);
  const kept = yours.getByTestId(`agent-item-${yoursId(0)}`);
  await expect(kept).toBeVisible();
  await expect(kept).toContainText("avoinna, rajauksen ulkopuolelta");

  await put(page, { yours_workspace: null });
  await put(page, { running_workspace: null });
});

test("@rail-section-filter an empty narrowing says so and gives every workspace back, on desktop and in the phone drawer, light and dark, Finnish and English", async ({
  page,
}) => {
  test.setTimeout(180000);
  const ids = await sectionWorld(page);
  await login(page);
  const nav = page.getByTestId("workspace-navigation");
  const running = nav.getByTestId("rail-running");
  await expect(running.getByTestId(`agent-item-${runningId(0)}`)).toBeVisible();
  expect(ids.third, "the ready scenario lists a third workspace").toBeTruthy();
  // A listed workspace with nothing running right now stays chosen.
  await put(page, { running_workspace: ids.third });
  await page.reload();
  await expect(running.getByTestId(/^agent-item-/)).toHaveCount(0);
  await expect(running).toContainText("Ei mitään työtilasta");
  await expect(running).not.toContainText("Mikään ei ole käynnissä.");
  await expect(running.getByTestId("rail-running-count")).toContainText("0/");
  await expect(running.getByTestId("rail-running-menu")).toHaveAttribute(
    "data-narrowed",
    "true",
  );
  for (const phone of [false, true]) {
    await page.setViewportSize(
      phone ? { width: 390, height: 844 } : { width: 1280, height: 900 },
    );
    if (phone) await page.getByTestId("navigation-open").click();
    await expect(running.getByTestId("rail-running-show-all")).toBeVisible();
    await expect(nav.getByTestId("rail-yours-menu")).toBeVisible();
    for (const theme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: theme });
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      await page.evaluate(() =>
        Promise.all(document.getAnimations().map((a) => a.finished)),
      );
      expect(
        (
          await new AxeBuilder({ page })
            .include('[data-testid="workspace-navigation"]')
            .analyze()
        ).violations,
      ).toEqual([]);
    }
    if (phone) {
      // The drawer's filter opens and chooses as on the desktop.
      await nav.getByTestId("rail-yours-menu").click();
      await page
        .getByTestId("rail-yours-dialog")
        .getByTestId(`rail-yours-tile-${ids.first}`)
        .click();
      await expect
        .poll(async () => (await preferences(page)).yours_workspace)
        .toBe(ids.first);
      await page
        .getByTestId("rail-yours-dialog")
        .getByTestId("rail-yours-tile-all")
        .click();
      await expect
        .poll(async () => (await preferences(page)).yours_workspace)
        .toBeNull();
      await page.getByTestId("rail-yours-done").click();
    }
  }
  await put(page, { language: "en-US" });
  await page.reload();
  // Still the phone: the drawer opens again after the reload.
  await page.getByTestId("navigation-open").click();
  await expect(running).toContainText("Nothing from");
  await expect(nav.getByTestId("rail-yours-menu")).toHaveAttribute(
    "aria-label",
    "Filter Your turn by workspace",
  );
  await running.getByTestId("rail-running-show-all").click();
  await expect
    .poll(async () => (await preferences(page)).running_workspace)
    .toBeNull();
  for (let n = 0; n < 4; n++)
    await expect(
      running.getByTestId(`agent-item-${runningId(n)}`),
    ).toBeVisible();
  await put(page, { language: "system" });
});
