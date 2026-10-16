import { hostOrigin } from "../test-ports.mjs";
import { expect, test, type Page } from "./worker-host";

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
      if (route.request().method() !== "POST") return route.continue();
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
    await page.reload();
    await expect(start).toBeDisabled(); // Reload alone never repeats a write.
    // A failed recheck must retain the guard, not mistake failure for absence.
    await page.route("**/api/v1/conversations", async (route) => {
      if (route.request().method() === "GET")
        return route.fulfill({ status: 503 });
      return route.fallback();
    });
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
