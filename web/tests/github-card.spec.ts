import AxeBuilder from "@axe-core/playwright";
import { hostOrigin } from "../test-ports.mjs";
import { expect, type Page, test } from "./worker-host";

test.use({
  baseURL: hostOrigin,
  ignoreHTTPSErrors: true,
  viewport: { width: 1440, height: 900 },
});
async function login(page: Page) {
  await page.goto("/");
  await page.getByTestId("github-sign-in").click();
  await page.getByRole("link").nth(0).click();
  await expect(page.getByTestId("account-menu-trigger")).toBeVisible();
}
async function cardState(page: Page, state: string) {
  await page.unroute("**/api/v1/snapshot");
  await page.route("**/api/v1/snapshot", async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    if (body.auth)
      body.auth.native_github = {
        state,
        ...(state === "connected"
          ? { login: "alice", scopes: ["gist", "read:org", "repo"] }
          : {}),
      };
    await route.fulfill({ response, json: body });
  });
}

test("GitHub card keeps repair visible, and an unfinished workflow sign-in can retry or cancel", async ({
  page,
}) => {
  await login(page);
  for (const state of ["expired", "disconnected", "connected"]) {
    await cardState(page, state);
    await page.goto("/settings/code-hosts");
    await expect(page.getByTestId("github-native-state")).toHaveAttribute(
      "data-state",
      state,
    );
    await expect(page.getByTestId("github-reconnect")).toBeVisible();
    await expect(page.getByTestId("github-disconnect-inspect")).toHaveCount(
      state === "connected" ? 1 : 0,
    );
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await expect(page.getByTestId("github-reconnect")).toBeInViewport();
    }
  }
  // A navigation that did not leave the document leaves the attempt unfinished.
  await page.route("**/auth/github/start?**", (route) =>
    route.fulfill({ status: 204 }),
  );
  await page.getByTestId("github-workflow-allow").click();
  await expect(page.getByTestId("github-workflow")).toHaveAttribute(
    "data-wf",
    "pending",
  );
  await page.getByTestId("github-workflow-cancel").click();
  await expect(page.getByTestId("github-workflow")).toHaveAttribute(
    "data-wf",
    "off",
  );
  await page.getByTestId("github-workflow-allow").click();
  await expect(page.getByTestId("github-workflow")).toHaveAttribute(
    "data-wf",
    "pending",
  );
  await page.unroute("**/auth/github/start?**");
  await page.getByTestId("github-workflow-allow").click();
  await expect(page).toHaveURL(/\/fixture\/provider\?/);
});

test("stale GitHub sign-in is confirmed in the dialog; OAuth returns without disconnecting", async ({
  page,
}) => {
  await login(page);
  await cardState(page, "connected");
  // Advance the gateway clock, not the browser clock. Session remains live,
  // but its proven GitHub sign-in is older than five minutes.
  await page.request.post("/fixture/reset-clock");
  let posts = 0;
  let observations = 0;
  const path = "**/api/v1/account/github/disconnect";
  // The fixture host has no native gh disconnect handler. Keep the REAL
  // gateway's freshness/CSRF checks and synthesize only its downstream 404.
  // Daemon observation-token behavior is tested separately in Go.
  await page.route(path, async (route) => {
    const response = await route.fetch();
    if (response.status() !== 404) {
      await route.fulfill({ response });
      return;
    }
    if (route.request().method() === "GET") {
      observations++;
      await route.fulfill({
        status: 200,
        json: {
          schema_version: 1,
          state: "connected",
          scope: "user",
          observation_token: "synthetic-browser-observation",
        },
      });
    } else {
      expect(route.request().postDataJSON()).toEqual({
        scope: "user",
        confirmation: "disconnect",
        observation_token: "synthetic-browser-observation",
      });
      expect(route.request().headers()["x-agent-host-csrf"]).toBeTruthy();
      posts++;
      await cardState(page, "disconnected");
      await route.fulfill({
        status: 200,
        json: {
          schema_version: 1,
          state: "disconnected",
          revokes_oauth_token: false,
        },
      });
    }
  });
  await page.goto("/settings/code-hosts");
  await page.getByTestId("github-disconnect-inspect").click();
  await expect(page.getByTestId("github-disconnect-reauth")).toBeVisible();
  expect(observations).toBe(0);
  const start = page.waitForRequest(/\/auth\/github\/start\?/);
  await page.getByTestId("github-disconnect-reauth").click();
  const url = new URL((await start).url());
  expect(url.searchParams.get("return_to")).toBe("/settings/code-hosts");
  expect(url.searchParams.has("reconnect")).toBe(false);
  expect(url.searchParams.has("scope")).toBe(false);
  await page.getByRole("link").nth(0).click();
  await expect(page).toHaveURL(/\/settings\/code-hosts$/);
  await expect(page.getByTestId("github-disconnect-confirm")).toBeVisible();
  expect(observations).toBeGreaterThan(0);
  expect(posts).toBe(0);
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(
      page.getByTestId("github-disconnect-confirm"),
    ).toBeInViewport();
    const axe = await new AxeBuilder({ page })
      .include('[data-testid="github-disconnect-dialog"]')
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    expect(axe.violations).toEqual([]);
  }
  await page.getByTestId("github-disconnect-confirm").click();
  await expect(page.getByTestId("github-disconnect-dialog")).toHaveCount(0);
  expect(posts).toBe(1);
  await page.reload();
  await expect(page.getByTestId("github-disconnect-dialog")).toHaveCount(0);
});
