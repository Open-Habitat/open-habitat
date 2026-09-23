import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
const host = "https://127.0.0.1:4174";
test.use({
  baseURL: host,
  ignoreHTTPSErrors: true,
  viewport: { width: 1280, height: 720 },
});
async function scenario(page: Page, value: string) {
  expect(
    (await page.request.get(`/fixture/scenario?value=${value}`)).status(),
  ).toBe(204);
}
async function login(page: Page, user: "Alice" | "Bob" = "Alice") {
  await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
  await expect(
    page.getByRole("heading", { name: "Test OAuth provider" }),
  ).toBeVisible();
  await page.getByRole("link", { name: user }).click();
  await expect(
    page.getByRole("navigation", { name: "Workspacet ja agentit" }),
  ).toContainText(user === "Alice" ? "GitHub user 42" : "GitHub user 43");
}
async function shot(page: Page, name: string) {
  await page.screenshot({
    path: `test-results/evidence/workspace-${name}.png`,
    fullPage: true,
  });
}
test("@workspace-slice login, routed details, filtering, refresh, focus and logout", async ({
  page,
}) => {
  const providerRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/fixture/provider"))
      providerRequests.push(request.url());
  });
  await scenario(page, "ready");
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Kirjaudu jatkaaksesi" }),
  ).toBeVisible();
  expect(providerRequests).toHaveLength(0);
  await shot(page, "login");
  await login(page);
  expect(providerRequests).toHaveLength(1);
  await page.goto("/");
  await expect(page).toHaveURL(/\/workspaces\/ws_/);
  await expect(page.locator("main h1")).toContainText("git-project");
  await expect(page.locator("main")).toContainText("Annotaatio");
  await shot(page, "ready");
  await page.getByRole("link", { name: "ordinary-dir" }).click();
  await expect(page.locator("main h1")).toHaveText("ordinary-dir");
  await page.getByRole("link", { name: "without-metadata" }).click();
  await expect(page.locator("main")).toContainText(
    "Ei vahvistettua Git-työhakemistoa",
  );
  await page
    .getByRole("textbox", { name: "Suodata workspaceja ja agentteja" })
    .fill("not-found");
  await expect(
    page.getByText("Hakua vastaavia kohteita ei ole."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Tyhjennä haku" }).click();
  await page.getByRole("button", { name: "Päivitä" }).click();
  await expect(page.getByRole("link", { name: "ordinary-dir" })).toBeVisible();
  await page.getByRole("link", { name: "Kaikki workspacet" }).click();
  await expect(page.locator("main h1")).toHaveText("Workspacet");
  await page.keyboard.press("Tab");
  await page.getByRole("link", { name: "Siirry sisältöön" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("main")).toBeFocused();
  const [logoutResponse] = await Promise.all([
    page.waitForResponse((response) => response.url().endsWith("/auth/logout")),
    page.getByRole("button", { name: "Kirjaudu ulos" }).click(),
  ]);
  expect(logoutResponse.status()).toBe(204);
  await expect(
    page.getByRole("heading", { name: "Kirjaudu jatkaaksesi" }),
  ).toBeVisible();
  await expect(page.getByText("git-project")).toHaveCount(0);
  await expect((await page.request.get("/api/v1/snapshot")).status()).toBe(401);
});
test("@workspace-slice confirmed empty, missing, failure, partial and deep link truth", async ({
  page,
}) => {
  await scenario(page, "ready");
  await page.goto("/workspaces");
  await login(page);
  await page.goto("/");
  await expect(page).toHaveURL(/\/workspaces\/ws_/);
  const deep = new URL(page.url()).pathname;
  await scenario(page, "empty");
  await page.goto("/workspaces");
  await expect(
    page.getByText("Workspaceja ei ole", { exact: true }).first(),
  ).toBeVisible();
  await shot(page, "empty");
  await page.goto(deep);
  await expect(page.locator("main h1")).toHaveText("Kohdetta ei enää löydy");
  await scenario(page, "missing");
  await page.goto(deep);
  await expect(page.locator("main h1")).toHaveText(
    "Kohteen tilaa ei voida vahvistaa",
  );
  await shot(page, "missing");
  await scenario(page, "error");
  await page.goto(deep);
  await expect(page.locator("main h1")).toHaveText("Yhteyttä ei saatu");
  await shot(page, "error");
  await scenario(page, "partial");
  await page.goto("/workspaces");
  await expect(
    page.getByText("Lähteen tilaa ei voitu vahvistaa"),
  ).toBeVisible();
  await shot(page, "partial");
  await scenario(page, "foreign");
  await page.goto("/workspaces");
  await expect(page.locator("main h1")).toHaveText("Yhteyttä ei saatu");
  await expect(page.getByText("GitHub user 99")).toHaveCount(0);
  await scenario(page, "malformed");
  await page.goto("/workspaces");
  await expect(page.locator("main h1")).toHaveText("Yhteyttä ei saatu");
  await scenario(page, "oversize");
  await page.getByRole("button", { name: "Päivitä" }).click();
  await expect(page.locator("main h1")).toHaveText("Yhteyttä ei saatu");
});
test("@workspace-slice identity isolation, forged headers, expiry and loading", async ({
  browser,
}) => {
  const a = await browser.newContext({
    baseURL: host,
    ignoreHTTPSErrors: true,
  });
  const b = await browser.newContext({
    baseURL: host,
    ignoreHTTPSErrors: true,
  });
  try {
    const pa = await a.newPage(),
      pb = await b.newPage();
    await scenario(pa, "ready");
    await pa.goto("/workspaces");
    await login(pa);
    await pb.goto("/workspaces");
    await login(pb, "Bob");
    const before = await pa.request.get("/api/v1/snapshot", {
      headers: {
        "X-Agent-Host-Identity": "wid_attacker0000",
        "X-Agent-Host-Socket": "/tmp/attacker",
        "X-Agent-Host-UID": "1002",
      },
    });
    expect(before.status()).toBe(200);
    const data = await before.json();
    expect(data.auth.provider_account_id).toBe("42");
    expect(
      await (await pb.request.get("/api/v1/snapshot")).json(),
    ).toMatchObject({ auth: { provider_account_id: "43" } });
    await scenario(pa, "delay");
    await pa.goto("/workspaces");
    await expect(pa.locator("main h1")).toHaveText("Ladataan");
    await expect(pa.getByRole("link", { name: "ordinary-dir" })).toBeVisible();
    await pa.request.get("/fixture/expire");
    await pa.reload();
    await expect(
      pa.getByRole("heading", { name: "Kirjaudu jatkaaksesi" }),
    ).toBeVisible();
    await expect(pa.getByText("ordinary-dir")).toHaveCount(0);
  } finally {
    await a.close();
    await b.close();
  }
});
test("@workspace-slice @a11y built host: zoom, accessible states, no serious axe", async ({
  page,
}) => {
  await scenario(page, "ready");
  await page.goto("/workspaces");
  for (const value of [
    "login",
    "ready",
    "empty",
    "missing",
    "error",
    "partial",
  ]) {
    if (value === "ready") await login(page);
    else if (value !== "login") {
      await scenario(page, value);
      await page.goto("/workspaces");
    }
    await expect(page.locator("main")).toBeVisible();
    const violations = (
      await new AxeBuilder({ page }).analyze()
    ).violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );
    expect(violations, value).toEqual([]);
  }
  await scenario(page, "ready");
  await page.goto("/workspaces");
  await page.evaluate(() => {
    document.documentElement.style.zoom = "2";
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
