import type { Request } from "@playwright/test";
import { hostOrigin } from "../test-ports.mjs";
import { expect, type Page, test } from "./worker-host";

test.use({ baseURL: hostOrigin, ignoreHTTPSErrors: true });

async function signIn(page: Page) {
  await page.goto("/workspaces");
  await page.getByTestId("github-sign-in").click();
  await page.locator('a[href*="code=42"]').click();
}

/** Track finite release/settings reads, not the long-lived event stream. */
function settingsReads(page: Page) {
  const pending = new Set<Request>();
  page.on("request", (request) => {
    const path = new URL(request.url()).pathname;
    if (
      request.method() === "GET" &&
      (path === "/" || path.startsWith("/api/v1/server"))
    )
      pending.add(request);
  });
  page.on("requestfinished", (request) => pending.delete(request));
  page.on("requestfailed", (request) => pending.delete(request));
  return async () => {
    await expect.poll(() => [...pending].map((r) => r.url())).toEqual([]);
  };
}

async function upgrade(page: Page, release: number) {
  await page.request.get("/fixture/upgrade");
  // The fixture acknowledges before replacing its listener. Check the running
  // gateway, not the acknowledgement, before asking the tab to read the bundle.
  await expect
    .poll(async () => {
      try {
        const response = await page.request.get("/api/v1/server");
        return (await response.json()).version;
      } catch (error) {
        if (/ECONNREFUSED|ECONNRESET|socket hang up/.test(String(error)))
          return undefined;
        throw error;
      }
    })
    .toBe(`0.0.0-lab.${release}`);
  await page.evaluate(() =>
    document.dispatchEvent(new Event("visibilitychange")),
  );
}

test("@version open settings follow the running release across upgrades", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/settings");
  const readsFinished = settingsReads(page);
  await page.getByTestId("settings-palvelin").click();
  const row = page.getByTestId("server-version");
  // The synthetic gateway's version and commit, not a deployed release.
  await expect(row.getByTestId("version-value")).toHaveText(
    "0.0.0-lab (0000000)",
  );
  await expect(
    row.locator('[data-testid="bundle-state"][data-state="current"]'),
  ).toBeVisible();
  // The server area returns to the personal settings with its own back.
  await page.getByTestId("settings-own-back").click();
  await expect(
    page.locator(".s-version-line").getByTestId("version-value"),
  ).toHaveText("0.0.0-lab (0000000)");
  // Settings stay mounted through two releases; each check re-reads the version.
  await page.getByTestId("settings-palvelin").click();
  // Switching sections remounts administration. Do not restart its gateway
  // while the initial view or an earlier bundle check is still loading.
  await expect(row.getByTestId("version-value")).toHaveText(
    "0.0.0-lab (0000000)",
  );
  for (const n of [1, 2]) {
    await readsFinished();
    await upgrade(page, n);
    await expect(row.getByTestId("version-value")).toHaveText(
      `0.0.0-lab.${n} (${String(n).repeat(7)})`,
    );
    await expect(
      row.locator('[data-testid="bundle-state"][data-state="newer"]'),
    ).toBeVisible();
  }
});

test("@version an open tab asks to reload after an upgrade, and the draft survives", async ({
  page,
}) => {
  await signIn(page);
  const readsFinished = settingsReads(page);
  await page
    .getByRole("navigation")
    .locator('a[data-testid^="workspace-"][data-workspace-name="ordinary-dir"]')
    .click();
  await page.getByTestId("conversation-start").click();
  const editor = page.getByTestId("message-input");
  await editor.fill("Puolivalmis luonnos");
  const bell = page.locator('[data-testid="status-bell"]:visible');
  await expect(bell).toHaveCount(0);

  // A release switch: the gateway restarts with another version and serves a
  // bundle whose index.html names different asset URLs.
  await readsFinished();
  // Returning to the tab is what a person does after leaving it open.
  await upgrade(page, 1);
  // The conversation's top bar has the bell; the new version is behind it.
  await expect(bell).toBeVisible();
  await bell.click();
  const item = page
    .getByTestId("status-panel")
    .locator('[data-testid="status-item"][data-key="version"]');
  await expect(item).toBeVisible();
  await expect(editor).toHaveValue("Puolivalmis luonnos");

  await item.getByTestId("version-reload").click();
  await expect(
    page.locator("script[type=module][src*='?release=1']"),
  ).toHaveCount(1);
  await expect(page.getByTestId("message-input")).toHaveValue(
    "Puolivalmis luonnos",
  );
  await page.goto("/settings");
  await page.getByTestId("settings-palvelin").click();
  const row = page.getByTestId("server-version");
  await expect(row.getByTestId("version-value")).toHaveText(
    "0.0.0-lab.1 (1111111)",
  );
  await expect(
    row.locator('[data-testid="bundle-state"][data-state="current"]'),
  ).toBeVisible();
  await expect(page.locator('[data-testid="status-bell"]:visible')).toHaveCount(
    0,
  );
});

test("@version a tab whose bundle cannot read the upgraded host offers reload, not reconnect", async ({
  page,
}) => {
  await signIn(page);
  const readsFinished = settingsReads(page);
  await page
    .getByRole("navigation")
    .locator('a[data-testid^="workspace-"][data-workspace-name="ordinary-dir"]')
    .click();
  await page.getByTestId("conversation-start").click();
  const editor = page.getByTestId("message-input");
  await editor.fill("Luonnos versionvaihdon yli");
  await page.evaluate(() =>
    sessionStorage.setItem("oh:debug-reconnect", "true"),
  );
  const failures: unknown[] = [];
  page.on("console", (message) => {
    if (!message.text().startsWith("[reconnect] ")) return;
    const entry = JSON.parse(message.text().slice("[reconnect] ".length));
    if (entry.event === "snapshot-failed") failures.push(entry.outcome);
  });

  // pilot.15 → pilot.16: the new host's snapshot carried fields the old
  // bundle's schema did not allow, so its every snapshot read, and with it
  // every reconnect, failed validation. Only the document the new bundle
  // loads can read the new contract; the fixture assets are one build, so
  // the newer fields are added for the old document alone.
  let oldDocument = false;
  await page.route("**/api/v1/snapshot", async (route) => {
    if (!oldDocument) return route.continue();
    let response: Awaited<ReturnType<typeof route.fetch>>;
    try {
      response = await route.fetch();
    } catch {
      return route.abort(); // the gateway is between listeners
    }
    if (!response.ok()) return route.fulfill({ response });
    const snapshot: unknown = await response.json();
    if (typeof snapshot !== "object" || snapshot === null) {
      throw new Error(`snapshot is not an object: ${JSON.stringify(snapshot)}`);
    }
    await route.fulfill({
      response,
      json: { ...snapshot, newer_release_fact: true },
    });
  });
  // A release restarts the daemon too, and the new one answers the old
  // incarnation's cursor with 409 cursor_instance_mismatch. The fixture's
  // own restart would also discard the unsent conversation, so the old
  // document's stream gets that answer here instead.
  await page.route("**/api/v1/events*", (route) =>
    oldDocument
      ? route.fulfill({
          status: 409,
          json: { error: "cursor_instance_mismatch" },
        })
      : route.continue(),
  );
  await readsFinished();
  oldDocument = true;
  await upgrade(page, 1);

  // The journal re-reads on its recovery backoff until the new index is up.
  const banner = page.getByTestId("connection-version-changed");
  await expect(banner).toBeVisible({ timeout: 30_000 });
  // The cause: the host answered, and the old bundle rejected its snapshot.
  expect(failures).toContain("invalid");
  // The retry that could only repeat the same rejected read is not offered.
  await expect(page.getByTestId("connection-retry")).toHaveCount(0);
  await expect(editor).toHaveValue("Luonnos versionvaihdon yli");

  page.once("framenavigated", () => {
    oldDocument = false;
  });
  await banner.getByTestId("connection-reload").click();
  await expect(
    page.locator("script[type=module][src*='?release=1']"),
  ).toHaveCount(1);
  await expect(page.getByTestId("message-input")).toHaveValue(
    "Luonnos versionvaihdon yli",
  );
  await expect(page.locator(".ah-connection")).toHaveCount(0);
});
