import { hostOrigin } from "../test-ports.mjs";
import { expect, type Page, test } from "./worker-host";

test.use({ baseURL: hostOrigin, ignoreHTTPSErrors: true });

async function open(page: Page) {
  await page.goto("/workspaces");
  await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
  await page.getByRole("link", { name: "Alice", exact: true }).click();
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "ordinary-dir", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Aloita uusi Pi-keskustelu" }),
  ).toBeEnabled();
}

for (const restart of [false, true]) {
  test(`@reconnect explicit retry reconnects the stream and snapshot${restart ? " after Unix daemon HTTP server restart" : " at an unchanged cursor"}`, async ({
    page,
  }) => {
    await open(page);
    // Freeze backoff, not networking: only the person's click can reopen SSE.
    await page.clock.install();
    await page.clock.pauseAt(new Date());
    await page.route("**/api/v1/events*", (route) =>
      route.fulfill({ status: 503 }),
    );
    await page.route("**/api/v1/snapshot", (route) =>
      route.fulfill({ status: 503 }),
    );
    expect(
      (
        await page.request.get(
          `/fixture/daemon-restart${restart ? "" : "?transport_only=1"}`,
        )
      ).status(),
    ).toBe(204);
    await page.getByRole("button", { name: "Päivitä", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Yhdistä", exact: true }),
    ).toBeVisible();
    await page.unroute("**/api/v1/events*");
    await page.unroute("**/api/v1/snapshot");
    const stream = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === "/api/v1/events" && response.ok(),
    );
    const snapshot = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === "/api/v1/snapshot" &&
        response.ok(),
    );
    await page.getByRole("button", { name: "Yhdistä", exact: true }).click();
    await snapshot;
    await stream;
    await expect(
      page.getByText("Yhteys katkesi · tiedot voivat olla vanhoja", {
        exact: true,
      }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Aloita uusi Pi-keskustelu" }),
    ).toBeEnabled();
  });
}

for (const created of [false, true]) {
  test(`@reconnect uncertain creation recheck ${created ? "discovers the created conversation" : "allows retry when no conversation was created"}`, async ({
    page,
  }) => {
    await open(page);
    let writes = 0;
    await page.route("**/api/v1/conversations", async (route) => {
      if (route.request().method() !== "POST")
        return route.fulfill({ status: 503 });
      writes++;
      if (created) await route.fetch(); // The host commits, but its reply is lost.
      await route.fulfill({ status: 503, body: "{}" });
    });
    const start = page.getByRole("button", {
      name: "Aloita uusi Pi-keskustelu",
    });
    await start.click();
    await expect(
      page.getByText("Keskustelun luonnin tulos epävarma", { exact: true }),
    ).toBeVisible();
    await expect(start).toBeDisabled();
    // The page has one + and one menu, even while the create guard is held.
    const header = page.locator(".ah-workspace-page-head");
    await expect(header.getByRole("button")).toHaveCount(2);
    const menu = header.getByRole("button", { name: /toiminnot/ });
    await expect(menu).toHaveText("…");
    await menu.click();
    await expect(
      page.getByRole("menuitem", { name: "Kopioi polku" }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    // A failed recheck must retain the guard, not mistake failure for absence.
    await page.reload();
    await expect(start).toBeDisabled();
    const failedList = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === "/api/v1/conversations" &&
        response.status() === 503,
    );
    await page.getByRole("button", { name: "Tarkista luonnin tulos" }).click();
    await failedList;
    await expect(start).toBeDisabled();
    await page.unroute("**/api/v1/conversations");
    const list = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === "/api/v1/conversations" &&
        response.ok(),
    );
    await page.getByRole("button", { name: "Tarkista luonnin tulos" }).click();
    await list;
    await expect(start).toBeEnabled();
    await expect(
      page.getByRole("button", { name: "Tarkista luonnin tulos" }),
    ).toHaveCount(0);
    expect(writes).toBe(1);
    if (created) {
      await expect(
        page.locator("main").getByRole("link", { name: /Uusi keskustelu/ }),
      ).toBeVisible();
    } else {
      await start.click();
      await expect(page).toHaveURL(/conversation=pi/);
    }
  });
}

for (const landing of ["home", "workspace"]) {
  test(`@reconnect ${landing} first read releases legacy guards in home rows and sidebar without clearing sends`, async ({
    page,
  }) => {
    await open(page);
    const snapshot = await (await page.request.get("/api/v1/snapshot")).json();
    const identity = snapshot.identity.web_identity_id;
    const workspaces = snapshot.workspaces
      .filter(
        (workspace: { mutation_state?: string }) =>
          workspace.mutation_state === "allowed",
      )
      .slice(0, 2);
    expect(workspaces).toHaveLength(2);
    const keys: string[] = workspaces.map(
      (workspace: { workspace_id: string }) =>
        `nah:${identity}:uncertain:${workspace.workspace_id}`,
    );
    const sendKey = `nah:${identity}:uncertain:pi:11111111-1111-4111-8111-111111111111`;
    await page.evaluate(
      ({ keys, sendKey }) => {
        for (const key of keys) sessionStorage.setItem(key, "create");
        sessionStorage.setItem(sendKey, "synthetic-send-command");
      },
      { keys, sendKey },
    );
    let writes = 0;
    let failList = true;
    await page.route("**/api/v1/conversations", (route) => {
      if (route.request().method() === "POST") writes++;
      if (route.request().method() === "GET" && failList)
        return route.fulfill({ status: 503 });
      return route.continue();
    });
    const path =
      landing === "home"
        ? "/workspaces"
        : `/workspaces/${workspaces[0].workspace_id}`;
    await page.goto(path);
    const pluses = () =>
      page.getByRole("button", { name: /Uusi keskustelu työtilassa/ });
    for (const workspace of workspaces) {
      const buttons = pluses().filter({ hasText: "+" });
      const named = buttons.and(
        page.getByRole("button", {
          name: `Uusi keskustelu työtilassa ${workspace.display_name ?? workspace.name}`,
          exact: true,
        }),
      );
      await expect(named.first()).toBeDisabled();
    }
    expect(
      await page.evaluate(
        (keys) => keys.map((key) => sessionStorage.getItem(key)),
        keys,
      ),
    ).toEqual(["create", "create"]);
    failList = false;
    // No toolbar refresh or workspace visit: the first successful page read
    // must reconcile both persisted markers, including a sidebar-only row.
    await page.reload();
    await expect
      .poll(() =>
        page.evaluate(
          (keys) => keys.map((key) => sessionStorage.getItem(key)),
          keys,
        ),
      )
      .toEqual([null, null]);
    for (const workspace of workspaces) {
      const buttons = page.getByRole("button", {
        name: `Uusi keskustelu työtilassa ${workspace.display_name ?? workspace.name}`,
        exact: true,
      });
      const count = await buttons.count();
      expect(count).toBe(landing === "home" ? 2 : 1);
      for (let i = 0; i < count; i++)
        await expect(buttons.nth(i)).toBeEnabled();
    }
    await page.goto(`/workspaces/${workspaces[0].workspace_id}`);
    await expect(
      page.getByRole("button", { name: "Aloita uusi Pi-keskustelu" }),
    ).toBeEnabled();
    expect(
      await page.evaluate((key) => sessionStorage.getItem(key), sendKey),
    ).toBe("synthetic-send-command");
    expect(writes).toBe(0);
  });
}
