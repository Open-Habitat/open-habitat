import { hostOrigin } from "../test-ports.mjs";
import { expect, type Page, test } from "./worker-host";

// A refresh reads the session beside the snapshot, not around it. These cases
// pin that shape and the fences that replace the serialized session reads:
// the snapshot renders only for the session's own web identity, and a 401 from
// either read opens login.
test.use({
  baseURL: hostOrigin,
  ignoreHTTPSErrors: true,
  viewport: { width: 1280, height: 720 },
});
const rail = (page: Page) =>
  page.getByRole("navigation", { name: "Työtilat ja keskustelut" });
async function login(page: Page, user: "Alice" | "Bob" = "Alice") {
  await page.goto("/workspaces");
  await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
  await page.getByRole("link", { name: user }).click();
  await expect(rail(page)).toContainText(user);
}
async function openWorkspace(page: Page) {
  await page.request.get("/fixture/scenario?value=ready");
  await login(page);
  await rail(page).getByRole("link", { name: "ordinary-dir" }).click();
  await expect(
    page.getByRole("button", { name: "Piilota sivupalkista" }),
  ).toBeEnabled();
}

test("@refresh-identity hide refreshes with the session read beside the snapshot", async ({
  page,
}) => {
  await openWorkspace(page);
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let sessionStarted!: () => void;
  const sessionSeen = new Promise<void>((resolve) => {
    sessionStarted = resolve;
  });
  await page.route("**/auth/session", async (route) => {
    sessionStarted();
    await held;
    await route.continue().catch(() => {});
  });
  const snapshotStarted = page.waitForRequest("**/api/v1/snapshot");
  try {
    await page.getByRole("button", { name: "Piilota sivupalkista" }).click();
    await sessionSeen;
    // The snapshot leaves while the session read is still unanswered.
    await snapshotStarted;
  } finally {
    release();
  }
  await expect(
    rail(page).getByRole("link", { name: "ordinary-dir" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /^Alice, Tilivalikko/ }),
  ).toBeVisible();
});

test("@refresh-identity a snapshot for another identity than the session never renders", async ({
  page,
  context,
  browser,
}) => {
  // Bob's cookie, from a separate browser context.
  const other = await browser.newContext({
    baseURL: hostOrigin,
    ignoreHTTPSErrors: true,
  });
  try {
    const bobPage = await other.newPage();
    await bobPage.request.get("/fixture/scenario?value=ready");
    await login(bobPage, "Bob");
    const bobCookies = await other.cookies();
    await login(page, "Alice");
    // Reload as Alice. Hold the snapshot until the session read has answered
    // for Alice, then switch this context's cookie to Bob and answer the held
    // snapshot as Bob: the pair disagrees on identity.
    let swapped = false;
    let sessionReads = 0;
    let snapshotReads = 0;
    page.on("request", (request) => {
      const path = new URL(request.url()).pathname;
      if (path === "/auth/session") sessionReads++;
      if (path === "/api/v1/snapshot") snapshotReads++;
    });
    const aliceSession = page.waitForResponse("**/auth/session");
    await page.route("**/api/v1/snapshot", async (route) => {
      if (swapped) return route.continue();
      swapped = true;
      await aliceSession;
      await context.addCookies(bobCookies);
      const response = await context.request.get("/api/v1/snapshot");
      await route.fulfill({ response }).catch(() => {});
    });
    await page.reload();
    await expect(rail(page)).toContainText("Bob");
    await expect(
      page.getByRole("button", { name: /^Bob, Tilivalikko/ }),
    ).toBeVisible();
    expect(swapped).toBe(true);
    // The mismatch was resolved by reading both again as Bob.
    expect(snapshotReads).toBeGreaterThanOrEqual(2);
    expect(sessionReads).toBeGreaterThanOrEqual(2);
    // Pairing Alice's session with Bob's snapshot would keep Alice's profile
    // and CSRF beside Bob's cookie: the account would name Alice and this
    // write would be refused.
    await rail(page).getByRole("link", { name: "ordinary-dir" }).click();
    await page.getByRole("button", { name: "Piilota sivupalkista" }).click();
    await expect(
      rail(page).getByRole("link", { name: "ordinary-dir" }),
    ).toHaveCount(0);
  } finally {
    await other.close();
  }
});

test("@refresh-identity a 401 session read beside a good snapshot opens login", async ({
  page,
}) => {
  await openWorkspace(page);
  await page.route("**/auth/session", (route) =>
    route.fulfill({ status: 401, body: "unauthorized" }),
  );
  await page.getByRole("button", { name: "Piilota sivupalkista" }).click();
  await expect(
    page.getByRole("button", { name: "Kirjaudu GitHubilla" }),
  ).toBeVisible();
  await expect(page.getByText("ordinary-dir")).toHaveCount(0);
});

test("@refresh-identity workspace navigation does not reread the model catalog", async ({
  page,
}) => {
  const catalog: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/v1/pi/models")
      catalog.push(request.method());
  });
  await openWorkspace(page);
  await expect(
    rail(page).getByRole("button", {
      name: "Uusi keskustelu työtilassa ordinary-dir",
    }),
  ).toBeEnabled();
  // Entry reads it for the sidebar's default and for the shared catalog.
  const atEntry = catalog.length;
  expect(atEntry).toBeGreaterThan(0);
  for (const name of ["git-project", "ordinary-dir"]) {
    await rail(page).getByRole("link", { name }).click();
    await expect(page).toHaveURL(/\/workspaces\/ws_/);
  }
  await page.waitForTimeout(300);
  expect(catalog.length).toBe(atEntry);
});

test("@refresh-identity a 401 session read wins over a failed snapshot read", async ({
  page,
}) => {
  await openWorkspace(page);
  await page.route("**/auth/session", (route) =>
    route.fulfill({ status: 401, body: "unauthorized" }),
  );
  await page.route("**/api/v1/snapshot", (route) => route.abort("failed"));
  await page.getByRole("button", { name: "Päivitä" }).click();
  await expect(
    page.getByRole("button", { name: "Kirjaudu GitHubilla" }),
  ).toBeVisible();
  await expect(page.getByText("ordinary-dir")).toHaveCount(0);
});

test("@refresh-identity reads that keep disagreeing on identity end unavailable", async ({
  page,
}) => {
  await openWorkspace(page);
  let sessionReads = 0;
  await page.route("**/auth/session", async (route) => {
    sessionReads++;
    const response = await route.fetch();
    const body = await response.json();
    await route.fulfill({
      response,
      json: { ...body, web_identity_id: "wid_example-other" },
    });
  });
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Yhteyttä ei saatu" }),
  ).toBeVisible();
  await expect(page.getByText("ordinary-dir")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /^Alice, Tilivalikko/ }),
  ).toHaveCount(0);
  await page.waitForTimeout(500);
  expect(sessionReads).toBe(3);
});
