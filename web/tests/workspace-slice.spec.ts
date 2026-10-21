import AxeBuilder from "@axe-core/playwright";
import { hostOrigin } from "../test-ports.mjs";
import { expect, type Page, test } from "./worker-host";

const host = hostOrigin;
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
  await page
    .getByRole("button")
    .and(page.getByTestId("github-sign-in"))
    .click();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page
    .getByRole("link")
    .and(
      page.locator(
        `a[href*="code=${user === "Alice" ? "42" : user === "Bob" ? "43" : "99"}"]`,
      ),
    )
    .click();
  await expect(page.getByRole("navigation")).toContainText(user);
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
    page.getByRole("heading").and(page.getByTestId("login-heading")),
  ).toBeVisible();
  expect(providerRequests).toHaveLength(0);
  await page.evaluate(() => document.fonts.ready);
  const loginLayout = await page.evaluate(() => {
    const cardNode = document.querySelector(".ah-login-card");
    const title = document.querySelector(".ah-login-card h1");
    if (!cardNode || !title) throw new Error("login layout missing");
    // The shared frame owns the surface; LoginCard is its content.
    const card = cardNode.parentElement?.getBoundingClientRect();
    if (!card) throw new Error("onboarding frame missing");
    return {
      width: card.width,
      midpoint: card.left + card.width / 2,
      verticalMidpoint: card.top + card.height / 2,
      size: parseFloat(getComputedStyle(title).fontSize),
      face: getComputedStyle(title).fontFamily,
      loaded: document.fonts.check('600 20px "Instrument Sans"'),
    };
  });
  expect(loginLayout.width).toBeGreaterThanOrEqual(430);
  expect(loginLayout.width).toBeLessThanOrEqual(450);
  expect(Math.abs(loginLayout.midpoint - 640)).toBeLessThan(12);
  expect(Math.abs(loginLayout.verticalMidpoint - 360)).toBeLessThan(40);
  expect(loginLayout.size).toBeGreaterThanOrEqual(19);
  expect(loginLayout.size).toBeLessThanOrEqual(22);
  expect(loginLayout.face).toContain("Instrument Sans");
  expect(loginLayout.loaded).toBe(true);
  const fontResources = await page.evaluate(() =>
    performance
      .getEntriesByType("resource")
      .filter((entry) => entry.name.endsWith(".woff2"))
      .map((entry) => entry.name),
  );
  expect(fontResources.some((url) => url.includes("instrument-sans"))).toBe(
    true,
  );
  expect(
    fontResources.every(
      (url) => new URL(url).origin === new URL(page.url()).origin,
    ),
  ).toBe(true);
  await shot(page, "login");
  await login(page);
  expect(providerRequests).toHaveLength(1);
  await page.goto("/");
  await expect(page).toHaveURL(/\/workspaces$/);
  await page
    .getByRole("navigation")
    .getByRole("link")
    .and(page.getByTestId("workspace-git-project"))
    .click();
  await expect(page.locator("main h1")).toContainText("git-project");
  expect(
    await page
      .locator("main h1")
      .evaluate((el) => parseFloat(getComputedStyle(el).fontSize)),
  ).toBeLessThanOrEqual(32);
  expect(
    await page
      .locator(".ah-shell-body")
      .evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(" ")[0]),
  ).toBe("296px");
  await expect(page.locator(".ah-workspace-page-title code")).toContainText(
    "/src/git-project",
  );
  await expect(
    page.getByRole("link").and(page.getByTestId("workspace-git-project")),
  ).toHaveAttribute("aria-current", "page");
  const selectedRow = page.locator(".ah-workspace-row[data-selected]");
  await expect(selectedRow).toContainText("git-project");
  expect(
    await selectedRow.evaluate((el) => el.getBoundingClientRect().height),
  ).toBeLessThanOrEqual(36);
  await expect(
    page
      .locator("main")
      .getByRole("button")
      .and(page.getByTestId("workspace-create")),
  ).toHaveCount(0);
  await shot(page, "ready");
  await page
    .getByRole("button")
    .and(page.getByTestId("close-navigation"))
    .click();
  await expect(
    page.getByRole("button").and(page.getByTestId("account-menu-trigger")),
  ).toBeVisible();
  await page
    .getByRole("button")
    .and(page.getByTestId("navigation-open"))
    .click();
  await page
    .getByRole("link")
    .and(page.getByTestId("workspace-ordinary-dir"))
    .click();
  await expect(page.locator("main h1")).toHaveText("ordinary-dir");
  await page
    .getByRole("link")
    .and(page.getByTestId("workspace-without-metadata"))
    .click();
  await expect(page.locator(".ah-workspace-page-title code")).toContainText(
    "/src/without-metadata",
  );
  await page
    .getByRole("textbox")
    .and(page.getByTestId("workspace-filter"))
    .fill("not-found");
  await expect(page.getByTestId("filter-empty")).toBeVisible();
  await page.getByRole("button").and(page.getByTestId("clear-filter")).click();
  await page
    .getByRole("button")
    .and(page.getByTestId("snapshot-refresh"))
    .click();
  await expect(
    page.getByRole("link").and(page.getByTestId("workspace-ordinary-dir")),
  ).toBeVisible();
  await page.getByRole("link").and(page.getByTestId("home-link")).click();
  await expect(page.getByTestId("workspace-create").first()).toBeVisible();
  // The create control also exists on workspace pages. Wait for home navigation
  // to commit its entry focus before exercising the skip link's own focus.
  await expect(page.getByTestId("workspaces-title")).toBeFocused();
  await page.keyboard.press("Tab");
  await page.getByRole("link").and(page.getByTestId("skip-content")).focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("main")).toBeFocused();
  const [logoutResponse] = await Promise.all([
    page.waitForResponse((response) => response.url().endsWith("/auth/logout")),
    (async () => {
      await page
        .getByRole("button")
        .and(page.getByTestId("account-menu-trigger"))
        .click();
      await page
        .getByRole("menuitem")
        .and(page.getByTestId("menu-logout"))
        .click();
      await page
        .getByRole("dialog")
        .getByRole("button")
        .and(page.getByTestId("logout-confirm"))
        .click();
    })(),
  ]);
  expect(logoutResponse.status()).toBe(204);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.locator("body")).not.toContainText("git-project");
  await expect((await page.request.get("/api/v1/snapshot")).status()).toBe(401);
});
test("@workspace-slice confirmed empty, missing, failure, partial and deep link truth", async ({
  page,
}) => {
  await scenario(page, "ready");
  await page.goto("/workspaces");
  await login(page);
  await page.goto("/");
  await expect(page).toHaveURL(/\/workspaces$/);
  await page
    .getByRole("navigation")
    .getByRole("link")
    .and(page.getByTestId("workspace-git-project"))
    .click();
  const deep = new URL(page.url()).pathname;
  await scenario(page, "empty");
  await page.goto("/workspaces");
  await expect(page.getByTestId("workspaces-empty")).toBeVisible();
  await shot(page, "empty");
  await page.goto(deep);
  await expect(page.locator("main h1")).toHaveAttribute(
    "data-state",
    "missing",
  );
  await scenario(page, "missing");
  await page.goto(deep);
  await expect(page.locator("main h1")).toHaveAttribute(
    "data-state",
    "unknown",
  );
  await shot(page, "missing");
  await scenario(page, "error");
  await page.goto(deep);
  await expect(page.getByTestId("workspaces-unavailable-title")).toBeVisible();
  await shot(page, "error");
  await scenario(page, "partial");
  await page.goto("/workspaces");
  await expect(page.getByTestId("workspaces-partial")).toBeVisible();
  await expect(
    page
      .getByRole("navigation")
      .getByRole("link")
      .and(page.getByTestId("workspace-uncertain")),
  ).toBeVisible();
  await expect(page.getByTestId("workspace-summary")).toBeVisible();
  await shot(page, "partial");
  await page
    .getByRole("navigation")
    .getByRole("link")
    .and(page.getByTestId("workspace-uncertain"))
    .click();
  await expect(page.locator("main .ah-notice.ah-tone-warning")).toBeVisible();
  await scenario(page, "malformed");
  await page.goto("/workspaces");
  await expect(page.getByTestId("workspaces-unavailable-title")).toBeVisible();
  await scenario(page, "oversize");
  await page.getByRole("button").and(page.getByTestId("retry")).click();
  await expect(page.getByTestId("workspaces-unavailable-title")).toBeVisible();
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
    await expect(pa.getByRole("status")).toBeVisible();
    await expect(
      pa
        .getByRole("navigation")
        .getByRole("link")
        .and(pa.getByTestId("workspace-ordinary-dir")),
    ).toBeVisible();
    await pa.request.get("/fixture/expire");
    await pa.reload();
    await expect(pa.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(pa.locator("body")).not.toContainText("ordinary-dir");
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
    // Judge each state's own view at rest: after the loading landing (a
    // failed landing is the error view itself) and after the fade that
    // follows it. Endless indicators never come to rest.
    await expect(page.locator(".ah-landing:not([data-failed])")).toHaveCount(0);
    let quiet = 0;
    await expect
      .poll(
        async () => {
          const moving = await page.evaluate(
            () =>
              document
                .getAnimations()
                .filter(
                  (a) =>
                    a.playState !== "finished" &&
                    a.effect?.getComputedTiming().iterations !== Infinity,
                ).length,
          );
          quiet = moving ? 0 : quiet + 1;
          return quiet;
        },
        { intervals: [150] },
      )
      .toBeGreaterThanOrEqual(2);
    const violations = (
      await new AxeBuilder({ page }).analyze()
    ).violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );
    expect(violations, value).toEqual([]);
  }
  await scenario(page, "ready");
  await page.goto("/workspaces");
  // Measure the ready view, not the loading landing it replaces.
  await expect(page.locator(".ah-landing")).toHaveCount(0);
  await page.evaluate(() => {
    document.documentElement.style.zoom = "2";
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  // Theme tokens switch immediately but primitive colors transition for 120ms.
  // Audit settled colors, not an arbitrary frame midway through that transition.
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const theme of ["light", "dark"]) {
    await page
      .locator("html")
      .evaluate((el, value) => el.setAttribute("data-theme", value), theme);
    expect(
      await page
        .locator("main h1")
        .evaluate((el) => getComputedStyle(el).fontFamily),
    ).toContain("Instrument Sans");
    const violations = (
      await new AxeBuilder({ page }).analyze()
    ).violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );
    expect(violations, theme).toEqual([]);
  }
  expect(
    await page
      .locator(".ah-button")
      .first()
      .evaluate((el) => getComputedStyle(el).transitionDuration),
  ).toBe("0s");
});
