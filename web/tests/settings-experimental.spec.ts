import AxeBuilder from "@axe-core/playwright";
import { hostOrigin } from "../test-ports.mjs";
import { expect, type Page, test } from "./worker-host";

test.use({
  baseURL: hostOrigin,
  ignoreHTTPSErrors: true,
  viewport: { width: 1280, height: 900 },
});
const features = [
  "rewind-conversation",
  "remote-browser",
  "multiplayer",
  "adaptive-rail",
];
const retired = [
  "agent-instructions",
  "attention-sound",
  "terminal-copy-on-select",
  "terminal-open-urls",
  "storage-breakdown",
  "rail-background-door",
  "scheduled-wake",
  "explain-mode",
  "explain-follow",
  "turn-changes",
  "conversation-context-view",
  "shares-page",
  "agent-resources-view",
  "atlassian-connect",
  "trello-connect",
  "named-workers",
];
async function signIn(page: Page) {
  await page.goto("/workspaces");
  await page
    .getByRole("button")
    .and(page.getByTestId("github-sign-in"))
    .click();
  await page.getByRole("link").nth(0).click();
  await expect(page.getByTestId("account-menu-trigger")).toBeAttached();
}
const card = (page: Page, id: string) =>
  page.getByRole("region").and(page.getByTestId(`experimental-${id}`));
const segment = (page: Page, id: string, value: "on" | "off") =>
  card(page, id)
    .getByTestId(`experimental-${id}-choice`)
    .getByTestId(`segment-${value}`);

test("@settings-experimental only remaining experiments have switches; saved retired choices stay readable", async ({
  page,
  context,
}) => {
  await signIn(page);
  const session = await (await page.request.get("/auth/session")).json();
  for (const id of retired) {
    const response = await page.request.put("/api/v1/account/preferences", {
      headers: {
        Origin: new URL(page.url()).origin,
        "X-Agent-Host-CSRF": session.csrf,
      },
      data: { experimental: { [id]: true } },
    });
    expect(response.ok()).toBe(true);
  }
  await page.goto("/settings/experimental");
  for (const id of features) {
    await expect(card(page, id)).toBeVisible();
    await expect(segment(page, id, "off")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  }
  for (const id of retired) await expect(card(page, id)).toHaveCount(0);
  await expect(
    page.getByTestId("experimental-features").getByRole("region"),
  ).toHaveCount(features.length);
  const a11y = await new AxeBuilder({ page })
    .include('[data-testid="experimental-features"]')
    .exclude(".ex-pic")
    .analyze();
  expect(a11y.violations).toEqual([]);
  const write = page.waitForRequest(
    (r) =>
      r.url().endsWith("/api/v1/account/preferences") && r.method() === "PUT",
  );
  await segment(page, "remote-browser", "on").click();
  expect((await write).postDataJSON()).toEqual({
    experimental: { "remote-browser": true },
  });
  await expect(segment(page, "remote-browser", "on")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(segment(page, "rewind-conversation", "off")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  const other = await context.newPage();
  try {
    await other.goto("/settings/experimental");
    await expect(segment(other, "remote-browser", "on")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  } finally {
    await other.close();
  }
  await segment(page, "remote-browser", "off").click();
  await expect(segment(page, "remote-browser", "off")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("@settings-experimental follows an own-user agent change without focus or reload", async ({
  page,
}) => {
  await signIn(page);
  await page.clock.install();
  await page.goto("/settings/experimental");
  await expect(segment(page, "remote-browser", "off")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  for (const enabled of [true, false]) {
    const response = await page.request.put("/fixture/agent-experimental", {
      data: { id: "remote-browser", enabled },
    });
    expect(response.status()).toBe(200);
    const observed = page.waitForResponse(
      (r) =>
        r.url().endsWith("/api/v1/account/preferences") &&
        r.request().method() === "GET",
    );
    await page.clock.runFor(5000);
    await observed;
    await expect(
      segment(page, "remote-browser", enabled ? "on" : "off"),
    ).toHaveAttribute("aria-pressed", "true");
  }
});

test("@settings-experimental a failed save keeps the feature off and offers to read the saved choice", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/settings/experimental");
  await expect(segment(page, "rewind-conversation", "off")).toBeEnabled();
  await page.route("**/api/v1/account/preferences", async (route) => {
    if (route.request().method() === "PUT")
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          schema_version: 1,
          error: { code: "preferences_unavailable" },
        }),
      });
    else await route.fallback();
  });
  await segment(page, "rewind-conversation", "on").click();
  const alert = page
    .getByRole("alert")
    .and(page.getByTestId("experimental-rewind-conversation-error"));
  await expect(alert).toBeVisible();
  await expect(segment(page, "rewind-conversation", "off")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.unroute("**/api/v1/account/preferences");
  await page
    .getByTestId("experimental-rewind-conversation-error-reload")
    .click();
  await expect(alert).toBeHidden();
});

test("@settings-experimental settings search finds a feature and lands on its card", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/settings");
  await page.getByTestId("settings-search").fill("rewind");
  await page.getByTestId("settings-result-row-rewind-conversation").click();
  await expect(page).toHaveURL(/\/settings\/experimental#rewind-conversation$/);
  await expect(card(page, "rewind-conversation")).toBeInViewport();
});
