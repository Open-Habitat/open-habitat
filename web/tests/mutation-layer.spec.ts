import { hostOrigin } from "../test-ports.mjs";
import { expect, type Page, test } from "./worker-host";

// ADR 0023 in the browser: optimistic workspace commands show at once at the
// live route's latency, confirm from the reply without a snapshot read, say
// when confirmation is slow, revert a refusal with its reason, and keep an
// uncertain command until a later read decides it.
test.use({
  baseURL: hostOrigin,
  ignoreHTTPSErrors: true,
  viewport: { width: 1280, height: 800 },
});
const listed = (page: Page, name = "ordinary-dir") =>
  page.locator(".ah-workspace").getByRole("link", { name, exact: true });
const archivedGroup = (page: Page) =>
  page.getByRole("region", { name: "Arkistoidut työtilat" });
const isWrite = (url: string, method: string) =>
  new URL(url).pathname === "/api/v1/workspaces" && method === "POST";

async function openWorkspace(page: Page, latency = 0) {
  await page.request.get("/fixture/scenario?value=ready");
  await page.goto("/workspaces");
  await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
  await page.getByRole("link", { name: "Alice" }).click();
  await listed(page).click();
  await expect(
    page.getByRole("button", { name: "Arkistoi työtila" }),
  ).toBeEnabled();
  if (latency) {
    // The live route costs ~0.2 s per round trip through the tunnel.
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Network.emulateNetworkConditions", {
      offline: false,
      latency,
      downloadThroughput: -1,
      uploadThroughput: -1,
    });
  }
}
/** Holds every workspace write until released; counts them. */
async function holdWrites(page: Page) {
  const gates: (() => void)[] = [];
  const state = {
    writes: 0,
    release: () => {
      for (const gate of gates.splice(0)) gate();
    },
  };
  await page.route("**/api/v1/workspaces", async (route) => {
    if (route.request().method() === "POST") {
      state.writes++;
      await new Promise<void>((resolve) => gates.push(resolve));
    }
    await route.continue().catch(() => {});
  });
  return state;
}

test("@mutation-layer archive, undo and rename show before the host answers, at 200 ms", async ({
  page,
}) => {
  await openWorkspace(page, 200);
  const held = await holdWrites(page);
  const snapshots: string[] = [];
  page.on("request", (r) => {
    if (new URL(r.url()).pathname === "/api/v1/snapshot")
      snapshots.push(r.url());
  });
  await page.getByRole("button", { name: "Arkistoi työtila" }).click();
  await expect(listed(page)).toHaveCount(0);
  await expect(
    archivedGroup(page).getByRole("link", { name: "ordinary-dir" }),
  ).toBeVisible();
  // Undo while the archive is still unconfirmed: shown at once, queued
  // behind it rather than sent alongside or refused.
  await page
    .getByRole("status")
    .filter({ hasText: "Kumoa" })
    .getByRole("button", { name: "Kumoa" })
    .click();
  await expect(listed(page)).toBeVisible();
  expect(held.writes).toBe(1);
  held.release();
  await expect.poll(() => held.writes).toBe(2);
  held.release();
  await page.unroute("**/api/v1/workspaces");
  // The replies confirmed both commands; no snapshot was the confirmation.
  await expect(listed(page)).toBeVisible();
  expect(snapshots).toEqual([]);

  // Rename: the dialog closes and the new name shows before the reply.
  const renameHeld = await holdWrites(page);
  await page.getByRole("button", { name: "Muuta näyttönimeä…" }).click();
  await page.getByRole("textbox", { name: "Näyttönimi" }).fill("Tavallinen");
  await page.getByRole("button", { name: "Tallenna" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator("main h1")).toHaveText("Tavallinen");
  await expect(listed(page, "Tavallinen")).toBeVisible();
  const renamed = page.waitForResponse(
    (r) =>
      isWrite(r.url(), r.request().method()) &&
      !!r.request().postData()?.includes('"settings"'),
  );
  renameHeld.release();
  const reply = await (await renamed).json();
  expect(reply.workspace.display_name).toBe("Tavallinen");
  // The first rename gives the workspace a durable ID; the page follows it.
  await expect(page).toHaveURL(
    new RegExp(`/workspaces/${reply.workspace_id}$`),
  );
  await expect(page.locator("main h1")).toHaveText("Tavallinen");
  expect(snapshots).toEqual([]);
  await page.unroute("**/api/v1/workspaces");
  await page.reload();
  await expect(listed(page, "Tavallinen")).toBeVisible();
});

test("@mutation-layer a refused rename reverts in place with its reason", async ({
  page,
}) => {
  await openWorkspace(page);
  await page.route("**/api/v1/workspaces", (route) =>
    route.request().method() === "POST"
      ? route.fulfill({
          status: 409,
          contentType: "application/json",
          body: JSON.stringify({
            schema_version: 1,
            error: { code: "workspace_changed" },
          }),
        })
      : route.continue(),
  );
  await page.getByRole("button", { name: "Muuta näyttönimeä…" }).click();
  await page.getByRole("textbox", { name: "Näyttönimi" }).fill("Ei tule");
  await page.getByRole("button", { name: "Tallenna" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Nimeä ei vaihdettu: Tila muuttui toisaalla.",
  );
  await expect(page.locator("main h1")).toHaveText("ordinary-dir");
  await expect(listed(page)).toBeVisible();
});

test("@mutation-layer a slow confirmation says so and then settles", async ({
  page,
}) => {
  await openWorkspace(page);
  const held = await holdWrites(page);
  await page.getByRole("button", { name: "Arkistoi työtila" }).click();
  await expect(listed(page)).toHaveCount(0);
  const note = page
    .getByRole("status")
    .filter({ hasText: "Vahvistus palvelimelta viipyy" });
  await expect(note).toHaveCount(0);
  await expect(note).toBeVisible({ timeout: 4000 });
  held.release();
  await expect(note).toHaveCount(0);
  await expect(listed(page)).toHaveCount(0);
  await page.unroute("**/api/v1/workspaces");
  await page.reload();
  await expect(listed(page)).toHaveCount(0);
});

test("@mutation-layer a lost reply stays pending until the next read decides", async ({
  page,
}) => {
  await openWorkspace(page);
  // The host archives the workspace, but its reply never reaches the browser.
  await page.route("**/api/v1/workspaces", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    await route.fetch();
    await route.abort("failed");
  });
  await page.getByRole("button", { name: "Arkistoi työtila" }).click();
  await expect(listed(page)).toHaveCount(0);
  // Uncertain is not refused: no rollback, no "done"; the next read is the
  // receipt and shows the archive happened.
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(
    archivedGroup(page).getByRole("link", { name: "ordinary-dir" }),
  ).toBeVisible();
  await expect(
    page.getByRole("status").filter({ hasText: "Tarkistetaan" }),
  ).toHaveCount(0);
  await page.unroute("**/api/v1/workspaces");

  // Now a reply lost before the host wrote anything: the receipt reverts it.
  await page.goto("/workspaces");
  await archivedGroup(page)
    .getByRole("button", { name: "Arkistoidut", exact: true })
    .click();
  await page.route("**/api/v1/workspaces", (route) =>
    route.request().method() === "POST"
      ? route.abort("failed")
      : route.continue(),
  );
  await archivedGroup(page)
    .getByRole("button", { name: "Palauta ordinary-dir" })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "Palautus ei tallentunut",
  );
  await expect(listed(page)).toHaveCount(0);
});

test("@mutation-layer a capacity refusal of + is a refusal, not an uncertain creation", async ({
  page,
}) => {
  await openWorkspace(page);
  await page.route("**/api/v1/conversations", (route) =>
    route.request().method() === "POST"
      ? route.fulfill({
          status: 429,
          contentType: "application/json",
          body: JSON.stringify({
            schema_version: 1,
            error: {
              code: "capacity_exceeded",
              message: "Request could not be completed",
              retryable: false,
              correlation_id: "req_00000000",
            },
          }),
        })
      : route.continue(),
  );
  await page
    .getByRole("button", { name: "Aloita uusi agenttikeskustelu" })
    .click();
  const conversation = page.getByRole("region", {
    name: "Keskustelu",
    exact: true,
  });
  await expect(
    conversation.getByText("Keskustelua ei luotu", { exact: true }),
  ).toBeVisible();
  await expect(conversation).toContainText("Neljä keskustelua työskentelee jo");
  await expect(conversation.getByText(/epävarma/)).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Tarkista luonnin tulos" }),
  ).toHaveCount(0);
  // + stays usable: nothing marks the creation uncertain.
  await expect(
    page.getByRole("navigation").getByRole("button", {
      name: "Uusi keskustelu työtilassa ordinary-dir",
      exact: true,
    }),
  ).toBeEnabled();
  await page.unroute("**/api/v1/conversations");
  await conversation.getByRole("button", { name: "Yritä uudelleen" }).click();
  await expect(page).toHaveURL(/conversation=pi:/);
});
