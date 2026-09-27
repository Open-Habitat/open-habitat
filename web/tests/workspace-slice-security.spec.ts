import { expect, test } from "@playwright/test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
const host = "https://127.0.0.1:4174";
test.use({ baseURL: host, ignoreHTTPSErrors: true });
test("@workspace-slice production bundle contains no fixture controls", async ({
  page,
}) => {
  const assets = join(process.cwd(), "dist/assets");
  for (const file of readdirSync(assets).filter((f) => f.endsWith(".js"))) {
    const js = readFileSync(join(assets, file), "utf8");
    expect(js).not.toContain("Test OAuth provider");
    expect(js).not.toContain("design-unhappy");
    expect(js).not.toContain("/fixture/scenario");
  }
  await page.goto("/?fixture=design");
  await expect(
    page.getByRole("heading", { name: "Kirjaudu jatkaaksesi" }),
  ).toBeVisible();
  await expect(
    page.getByText("Rakenna saavutettava komponenttikirjasto"),
  ).toHaveCount(0);
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
  await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
  await page.getByRole("link", { name: "Unknown" }).click();
  await expect(page).toHaveURL(/auth_error=identity_mapping_denied$/);
  await expect(page.getByText("Kirjautuminen ei valmistunut")).toBeVisible();
  expect((await page.request.get("/api/v1/snapshot")).status()).toBe(401);
});
test("@workspace-slice callback errors never claim a session and preserve safe deep links", async ({
  page,
}) => {
  await page.request.get("/fixture/scenario?value=native-error");
  await page.goto("/workspaces/ws_abcdefgh");
  await expect(
    page.getByRole("heading", { name: "Kirjaudu jatkaaksesi" }),
  ).toBeVisible();
  await expect((await page.request.get("/api/v1/snapshot")).status()).toBe(401);
  await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
  await expect(
    page.getByRole("heading", { name: "Test OAuth provider" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Alice" }).click();
  await expect(page).toHaveURL(
    /\/workspaces\?auth_error=native_adapter_error$/,
  );
  await expect(page.getByText("Kirjautuminen ei valmistunut")).toBeVisible();
  await expect((await page.request.get("/auth/session")).status()).toBe(401);
  await page.request.get("/fixture/scenario?value=ready");
  await page.goto("/workspaces/ws_abcdefgh");
  await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
  await page.getByRole("link", { name: "Alice" }).click();
  await expect(page).toHaveURL(/\/workspaces\/ws_abcdefgh$/);
  await expect(page.locator("main h1")).toHaveText("Kohdetta ei enää löydy");
});
