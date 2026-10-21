import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { hostOrigin } from "../test-ports.mjs";
import { expect, test } from "./worker-host";

const host = hostOrigin;
test.use({ baseURL: host, ignoreHTTPSErrors: true });
test("@workspace-slice production bundle contains no fixture controls", async ({
  page,
}) => {
  const assets = fileURLToPath(new URL("../dist/assets/", import.meta.url));
  for (const file of readdirSync(assets).filter((f) => f.endsWith(".js"))) {
    const js = readFileSync(join(assets, file), "utf8");
    expect(js).not.toContain("Test OAuth provider");
    expect(js).not.toContain("design-unhappy");
    expect(js).not.toContain("/fixture/scenario");
  }
  await page.goto("/?fixture=design");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(
    page.getByRole("button").and(page.getByTestId("github-sign-in")),
  ).toBeVisible();
});
test("@workspace-slice production UI carries noindex signals without granting API access", async ({
  request,
}) => {
  for (const path of ["/", "/workspaces/ws_abcdefgh", "/robots.txt"]) {
    const response = await request.get(path);
    expect(response.status()).toBe(200);
    expect(response.headers()["x-robots-tag"]).toBe(
      "noindex, nofollow, noarchive",
    );
    if (path === "/robots.txt")
      expect(await response.text()).toBe("User-agent: *\nDisallow: /\n");
    else
      expect(await response.text()).toContain(
        '<meta name="robots" content="noindex, nofollow, noarchive">',
      );
  }
  const asset = readdirSync(join(process.cwd(), "dist/assets")).find((name) =>
    name.endsWith(".js"),
  );
  expect(asset).toBeDefined();
  const response = await request.get(`/assets/${asset}`);
  expect(response.status()).toBe(200);
  expect(response.headers()["x-robots-tag"]).toBe(
    "noindex, nofollow, noarchive",
  );
  const api = await request.get("/api/v1/snapshot");
  expect(api.status()).toBe(401);
  expect(api.headers()["x-robots-tag"]).toBeUndefined();
  const session = await request.get("/auth/session");
  expect(session.status()).toBe(401);
  expect(session.headers()["x-robots-tag"]).toBeUndefined();
});
test("@workspace-slice unknown mapping is denied before session", async ({
  page,
}) => {
  await page.request.get("/fixture/scenario?value=ready");
  await page.goto("/workspaces");
  await page
    .getByRole("button")
    .and(page.getByTestId("github-sign-in"))
    .click();
  await page.getByRole("link").and(page.locator('a[href*="code=99"]')).click();
  await expect(page).toHaveURL(/auth_error=identity_mapping_denied$/);
  await expect(page.locator(".ah-notice.ah-tone-danger")).toBeVisible();
  expect((await page.request.get("/api/v1/snapshot")).status()).toBe(401);
});
test("@workspace-slice missing GitHub email can be supplied without changing the person", async ({
  page,
}) => {
  await page.request.get("/fixture/scenario?value=ready");
  await page.request.get("/fixture/profile-missing-email");
  await page.goto("/workspaces");
  await page
    .getByRole("button")
    .and(page.getByTestId("github-sign-in"))
    .click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(
    page.getByRole("textbox").and(page.getByTestId("profile-name")),
  ).toHaveCount(0);
  await page
    .getByRole("textbox")
    .and(page.getByTestId("profile-email"))
    .fill("alice@example.invalid");
  await page
    .getByRole("button")
    .and(page.getByTestId("profile-submit"))
    .click();
  await expect(
    page.getByRole("button").and(page.getByTestId("account-menu-trigger")),
  ).toBeVisible();
  await page
    .getByRole("button")
    .and(page.getByTestId("account-menu-trigger"))
    .click();
  await expect(page.locator("body")).toContainText("alice@example.invalid");
  expect(
    (await (await page.request.get("/api/v1/snapshot")).json()).auth
      .provider_account_id,
  ).toBe("42");
});
test("@workspace-slice account presentation follows the signed-in person", async ({
  page,
}) => {
  await page.request.get("/fixture/scenario?value=ready");
  await page.goto("/workspaces");
  await page
    .getByRole("button")
    .and(page.getByTestId("github-sign-in"))
    .click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  await expect(
    page.getByRole("button").and(page.getByTestId("account-menu-trigger")),
  ).toBeVisible();
  await page
    .getByRole("button")
    .and(page.getByTestId("account-menu-trigger"))
    .click();
  await expect(page.locator("body")).toContainText("alice@example.invalid");
  await page
    .getByRole("menuitem")
    .and(page.getByTestId("menu-settings"))
    .click();
  await expect(
    page.locator(".ah-account-settings .ah-account-presentation"),
  ).toContainText("alice@example.invalid");
  await page.getByRole("button").and(page.getByTestId("logout-open")).click();
  await page
    .getByRole("dialog")
    .getByRole("button")
    .and(page.getByTestId("logout-confirm"))
    .click();
  await page
    .getByRole("button")
    .and(page.getByTestId("github-sign-in"))
    .click();
  await page.getByRole("link").and(page.locator('a[href*="code=43"]')).click();
  await expect(
    page.getByRole("button").and(page.getByTestId("account-menu-trigger")),
  ).toBeVisible();
  await expect(page.locator("body")).not.toContainText("alice@example.invalid");
  await page
    .getByRole("button")
    .and(page.getByTestId("account-menu-trigger"))
    .click();
  await expect(page.locator("body")).toContainText("bob@example.invalid");
});
test("@workspace-slice untrusted auth error stays generic and retryable", async ({
  page,
}) => {
  await page.goto("/workspaces?auth_error=%3Cscript%3Esteal%3C%2Fscript%3E");
  await expect(page.locator(".ah-notice.ah-tone-danger")).toBeVisible();
  await expect(page.locator("body")).not.toContainText(/steal|script/);
  await expect(
    page.getByRole("button").and(page.getByTestId("github-sign-in")),
  ).toBeEnabled();
});
test("@workspace-slice callback errors never claim a session and preserve safe deep links", async ({
  page,
}) => {
  await page.request.get("/fixture/scenario?value=native-error");
  await page.goto("/workspaces/ws_abcdefgh");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect((await page.request.get("/api/v1/snapshot")).status()).toBe(401);
  await page
    .getByRole("button")
    .and(page.getByTestId("github-sign-in"))
    .click();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  await expect(page).toHaveURL(
    /\/workspaces\?auth_error=native_adapter_error$/,
  );
  await expect(page.locator(".ah-notice.ah-tone-danger")).toBeVisible();
  await expect((await page.request.get("/auth/session")).status()).toBe(401);
  await page.request.get("/fixture/scenario?value=ready");
  await page.goto("/workspaces/ws_abcdefgh");
  await page
    .getByRole("button")
    .and(page.getByTestId("github-sign-in"))
    .click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  await expect(page).toHaveURL(/\/workspaces\/ws_abcdefgh$/);
  await expect(page.locator("main h1")).toHaveAttribute(
    "data-state",
    "missing",
  );
});

test("@workspace-slice browser retains workspaces past 512 in a partial snapshot", async ({
  page,
}) => {
  await page.request.get("/fixture/scenario?value=ready");
  await page.goto("/workspaces");
  await page
    .getByRole("button")
    .and(page.getByTestId("github-sign-in"))
    .click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  const response = await page.request.get("/api/v1/snapshot");
  expect(response.status()).toBe(200);
  const base = await response.json();
  const original = base.workspaces[0];
  expect(original).toBeDefined();
  // 513 is the first cardinality beyond the old 512-row truncation boundary.
  const workspaces = Array.from({ length: 513 }, (_, i) => ({
    ...original,
    workspace_id: `ws_${String(i).padStart(8, "0")}`,
    observation_token: `obs_${String(i).padStart(8, "0")}`,
    name: `project-${i}`,
    display_name: `project-${i}`,
  }));
  // The browser case proves the rendered-list boundary; the separate snapshot
  // reader test proves the byte boundary without mounting 2,500 DOM entries.
  const partial = {
    ...base,
    sources: base.sources.map((fact: { source: string }) =>
      fact.source === "filesystem" ? { ...fact, state: "unknown" } : fact,
    ),
    workspaces,
    agents: [],
  };
  await page.route("**/api/v1/snapshot", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(partial),
    });
  });
  await page.reload();
  // Wait for the large authenticated snapshot to finish validation/rendering;
  // "Ladataan" is an in-progress state, not evidence that the list is empty.
  await expect(page.getByTestId("workspaces-partial")).toBeVisible({
    timeout: 15_000,
  });
  await page
    .getByRole("textbox")
    .and(page.getByTestId("workspace-filter"))
    .fill("project-512");
  await expect(
    page
      .getByRole("navigation")
      .getByRole("link")
      .and(page.getByTestId("workspace-project-512")),
  ).toBeVisible();
});
