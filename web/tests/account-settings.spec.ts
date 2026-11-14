import AxeBuilder from "@axe-core/playwright";
import { hostOrigin } from "../test-ports.mjs";
import { expect, type Page, test } from "./worker-host";

const host = hostOrigin;
test.use({
  trace: "off",
  screenshot: "off",
  video: "off",
  baseURL: host,
  ignoreHTTPSErrors: true,
  viewport: { width: 1280, height: 720 },
});
/** The default model's chooser opens from its Tekoäly row. */
async function openDefaultModel(page: Page) {
  await page
    .getByRole("button")
    .and(page.getByTestId("default-model-trigger"))
    .click();
}
async function login(page: Page, name: "Alice" | "Bob" = "Alice") {
  await page.goto("/");
  await page
    .getByRole("button")
    .and(page.getByTestId("github-sign-in"))
    .click();
  await page
    .getByRole("link")
    .nth(name === "Alice" ? 0 : 1)
    .click();
  await expect(
    page.getByRole("button").and(page.getByTestId("account-menu-trigger")),
  ).toBeVisible();
}
async function state(page: Page, native: string) {
  await page.route("**/api/v1/snapshot", async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    if (!body.auth) {
      await route.fulfill({ response });
      return;
    }
    body.auth.native_github.state = native;
    await route.fulfill({ response, json: body });
  });
}
async function settings(
  page: Page,
  section: "tekoaly" | "koodipalvelut" = "tekoaly",
) {
  await page
    .getByRole("button")
    .and(page.getByTestId("account-menu-trigger"))
    .focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("menuitem").and(page.getByTestId("menu-settings")),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button").and(page.getByTestId("account-menu-trigger")),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await page
    .getByRole("menuitem")
    .and(page.getByTestId("menu-settings"))
    .focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/settings$/);
  await expect(
    page.getByRole("heading").and(page.getByTestId("settings-title")),
  ).toBeFocused();
  await expect(
    page.getByRole("link").and(page.getByTestId("settings-tili")),
  ).toHaveAttribute("aria-current", "page");
  await page
    .getByRole("navigation")
    .and(page.getByTestId("settings-navigation"))
    .getByRole("link")
    .and(page.getByTestId(`settings-${section}`))
    .click();
}
test("@account-settings verified native state, route return and explicit disconnect", async ({
  page,
}) => {
  await state(page, "connected");
  await login(page);
  await expect(page.getByRole("navigation")).toContainText("Alice");
  await expect(page.getByRole("navigation")).not.toContainText(
    "GitHub user 42",
  );
  await page
    .getByRole("button")
    .and(page.getByTestId("account-menu-trigger"))
    .click();
  await expect(
    page.getByRole("menuitem").and(page.getByTestId("menu-settings")),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/evidence/account-menu.png",
    fullPage: true,
  });
  await page.keyboard.press("Escape");
  await page.locator(".ah-workspace-link").first().click();
  await expect(page.locator("main h1")).toHaveText("git-project");
  await expect(page.locator("main h1")).toBeVisible();
  const returnPath = new URL(page.url()).pathname;
  await settings(page, "koodipalvelut");
  await expect(
    page.locator("#main").getByTestId("github-native-state"),
  ).toHaveAttribute("data-state", "connected");
  await expect(
    page.locator("#main").getByTestId("github-native-state"),
  ).toBeVisible();
  await expect(page.getByTestId("github-native-state")).toHaveAttribute(
    "data-state",
    "connected",
  );
  await expect(page.getByTestId("github-native-state")).toBeVisible();
  await expect(
    page.getByRole("button").and(page.getByTestId("github-disconnect-inspect")),
  ).toBeVisible();
  await expect(
    page.getByRole("button").and(page.getByTestId("github-disconnect-confirm")),
  ).toHaveCount(0);
  await expect(
    page
      .getByRole("heading")
      .and(page.getByTestId("settings-section-koodipalvelut")),
  ).toBeVisible();
  await page
    .getByRole("link")
    .and(page.getByTestId("settings-tekoaly"))
    .click();
  // The synthetic native Pi home holds no OpenAI credential.
  await expect(page.getByTestId("openai-credential-state")).toHaveAttribute(
    "data-state",
    "missing",
  );
  await expect(page.getByTestId("openai-credential-state")).toBeVisible();
  await page
    .getByRole("link")
    .and(page.getByTestId("settings-ulkoasu"))
    .click();
  await expect(page).toHaveURL(/\/settings\/appearance$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/settings\/ai$/);
  await expect(
    page.getByRole("heading").and(page.getByTestId("settings-section-tekoaly")),
  ).toBeVisible();
  await page.goForward();
  const theme = page.getByRole("button").and(page.getByTestId("theme-choice"));
  await expect(theme).toBeVisible();
  await theme.click();
  await page.getByTestId("choice-dark").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await theme.click();
  await page.getByTestId("choice-light").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.getByRole("link").and(page.getByTestId("settings-tili")).click();
  await expect(page).toHaveURL(/\/settings\/account$/);
  await expect(
    page.getByRole("button").and(page.getByTestId("logout-open")),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/evidence/account-connected.png",
    fullPage: true,
  });
  await page
    .getByRole("button")
    .and(page.getByTestId("settings-close"))
    .click();
  await expect(page).toHaveURL(new RegExp(`${returnPath}$`));
  await expect(
    page.getByRole("button").and(page.getByTestId("account-menu-trigger")),
  ).toBeFocused();
  await settings(page, "koodipalvelut");
  await page.reload();
  await expect(page).toHaveURL(/\/settings\/code-hosts$/);
  await expect(
    page
      .getByRole("heading")
      .and(page.getByTestId("settings-section-koodipalvelut")),
  ).toBeVisible();
  await expect(
    page.locator("#main").getByTestId("github-native-state"),
  ).toHaveAttribute("data-state", "connected");
  await expect(
    page.locator("#main").getByTestId("github-native-state"),
  ).toBeVisible();
  await page
    .getByRole("button")
    .and(page.getByTestId("settings-close"))
    .click();
  await expect(page).toHaveURL(/\/workspaces$/);
  await expect(
    page.getByRole("button").and(page.getByTestId("account-menu-trigger")),
  ).toBeFocused();
});
test("@account-settings partial, unknown and logout/user switch", async ({
  page,
}) => {
  await state(page, "partial");
  await login(page);
  await settings(page, "koodipalvelut");
  await expect(page.getByTestId("github-native-state")).toHaveAttribute(
    "data-state",
    "partial",
  );
  await expect(page.getByTestId("github-native-state")).toBeVisible();
  await page.screenshot({
    path: "test-results/evidence/account-partial.png",
    fullPage: true,
  });
  await page.unroute("**/api/v1/snapshot");
  await state(page, "unknown");
  await page.reload();
  await page
    .getByRole("navigation")
    .and(page.getByTestId("settings-navigation"))
    .getByRole("link")
    .and(page.getByTestId("settings-koodipalvelut"))
    .click();
  await expect(page.getByTestId("github-native-state")).toHaveAttribute(
    "data-state",
    "unknown",
  );
  await expect(page.getByTestId("github-native-state")).toBeVisible();
  await page.screenshot({
    path: "test-results/evidence/account-unknown.png",
    fullPage: true,
  });
  // Settings gives its panes the rail's space at this desktop width.
  await page.getByTestId("settings-close").click();
  await page
    .getByRole("button")
    .and(page.getByTestId("account-menu-trigger"))
    .click();
  await page.getByRole("menuitem").and(page.getByTestId("menu-logout")).click();
  await expect(
    page.getByRole("dialog").and(page.getByTestId("logout-dialog")),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page
    .getByRole("dialog")
    .getByRole("button")
    .and(page.getByTestId("logout-confirm"))
    .click();
  await expect(
    page.getByRole("button").and(page.getByTestId("github-sign-in")),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/workspaces$/);
  await page
    .getByRole("button")
    .and(page.getByTestId("github-sign-in"))
    .click();
  await page.getByRole("link").nth(1).click();
  await expect(
    page.getByRole("button").and(page.getByTestId("account-menu-trigger")),
  ).toBeVisible();
  await expect(page.getByRole("navigation")).not.toContainText(
    "GitHub user 42",
  );
  await page.goto("/settings/code-hosts");
  await expect(page.getByTestId("github-native-state")).toHaveAttribute(
    "data-state",
    "unknown",
  );
  await expect(page.getByTestId("github-native-state")).toBeVisible();
});
test("@account-settings Pi default model is read from native models and saved", async ({
  page,
}) => {
  await login(page);
  await settings(page);
  await page
    .getByRole("link")
    .and(page.getByTestId("settings-tekoaly"))
    .click();
  await openDefaultModel(page);
  const older = page.getByTestId("older-models-toggle");
  await expect(
    page.getByRole("radio").and(page.getByTestId("model-gpt-5.4")),
  ).not.toBeVisible();
  await older.click();
  await page.getByRole("radio").and(page.getByTestId("model-gpt-5.4")).click();
  await expect(
    page.getByRole("radio").and(page.getByTestId("model-gpt-5.4")),
  ).toBeChecked();
  await page.reload();
  await page
    .getByRole("link")
    .and(page.getByTestId("settings-tekoaly"))
    .click();
  await openDefaultModel(page);
  await expect(
    page.getByRole("radio").and(page.getByTestId("model-gpt-5.4")),
  ).toBeChecked();
  await expect(
    page.getByRole("radio").and(page.getByTestId("model-gpt-5.4")),
  ).toBeVisible();
});

test("@account-settings OpenAI sign-in state is read again on each visit; uncertainty is not success", async ({
  page,
}) => {
  await login(page);
  await settings(page);
  await expect(page.getByTestId("openai-credential-state")).toHaveAttribute(
    "data-state",
    "missing",
  );
  await expect(page.getByTestId("openai-credential-state")).toBeVisible();
  await page.getByRole("button").and(page.getByTestId("pi-sign-in")).click();
  await expect(
    page.getByRole("heading").and(page.getByTestId("pi-sign-in-title")),
  ).toBeVisible();
  await expect(
    page.getByRole("button").and(page.getByTestId("pi-attempt-start")),
  ).toBeVisible();
  await page.goto("/workspaces");
  await expect(
    page.getByRole("button").and(page.getByTestId("account-menu-trigger")),
  ).toBeVisible();
  for (const failure of [
    // Outside the contract: a claimed sign-in is not believed.
    { json: { schema_version: 1, subscription: { present: true } } },
    { status: 502, body: "bad gateway" },
  ]) {
    await page.route("**/api/v1/pi/credentials", (route) =>
      route.fulfill(failure),
    );
    // Client navigation, not a new first-load check.
    await page
      .getByRole("button")
      .and(page.getByTestId("account-menu-trigger"))
      .click();
    await page
      .getByRole("menuitem")
      .and(page.getByTestId("menu-settings"))
      .click();
    await page
      .getByRole("navigation")
      .and(page.getByTestId("settings-navigation"))
      .getByRole("link")
      .and(page.getByTestId("settings-tekoaly"))
      .click();
    await expect(page.getByTestId("openai-credential-state")).toHaveAttribute(
      "data-state",
      "unknown",
    );
    await expect(
      page.getByRole("button").and(page.getByTestId("pi-sign-in")),
    ).toBeVisible();
    await page
      .getByRole("button")
      .and(page.getByTestId("settings-close"))
      .click();
    await page.unrouteAll();
  }
});

test("@account-settings Pi sign-in from settings returns to the row that opened it", async ({
  page,
}) => {
  await login(page);
  await settings(page);
  await expect(page).toHaveURL(/\/settings\/ai$/);
  const state = page.getByTestId("openai-credential-state");
  await expect(state).toHaveAttribute("data-state", "missing");
  const row = page.getByRole("button").and(page.getByTestId("pi-sign-in"));
  const title = page
    .getByRole("heading")
    .and(page.getByTestId("pi-sign-in-title"));
  // Going back without signing in.
  await row.click();
  await expect(title).toBeVisible();
  await page
    .getByRole("button")
    .and(page.getByTestId("pi-sign-in-return"))
    .click();
  await expect(page).toHaveURL(/\/settings\/ai$/);
  await expect(row).toBeFocused();
  // A completed sign-in: settings stays open and its row reads the result.
  // The synthetic device login writes no credential; native Pi now holding
  // the subscription is the credentials read's part.
  await row.click();
  await expect(title).toBeVisible();
  await page.route("**/api/v1/pi/credentials", async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    body.subscription.present = true;
    await route.fulfill({ response, json: body });
  });
  await page.request.get("/fixture/pi-state?value=usable");
  await page
    .getByRole("button")
    .and(page.getByTestId("pi-attempt-start"))
    .click();
  await expect(title).toHaveCount(0, { timeout: 12000 });
  await expect(page).toHaveURL(/\/settings\/ai$/);
  await expect(state).toHaveAttribute("data-state", "signed_in");
  await expect(row).toBeFocused();
});

test("@account-settings Claude sign-in from settings returns to Claude's row", async ({
  page,
}) => {
  await login(page);
  const attempt = "20261025T120000.000000001";
  let phase: "missing" | "code" | "completed" = "missing";
  await page.route("**/api/v1/pi/claude-login", async (route) => {
    const method = route.request().method();
    if (method === "POST") phase = "code";
    if (method === "PUT") phase = "completed";
    await route.fulfill({
      json: {
        schema_version: 1,
        state: phase,
        ...(phase !== "missing" ? { attempt_id: attempt } : {}),
        ...(phase === "code"
          ? {
              verification_uri:
                "https://claude.com/cai/oauth/authorize?code=true&state=synthetic",
            }
          : {}),
      },
    });
  });
  await settings(page);
  await expect(page).toHaveURL(/\/settings\/ai$/);
  // The OpenAI row opens the forced sign-in; the person chooses Claude there.
  await page.getByRole("button").and(page.getByTestId("pi-sign-in")).click();
  await expect(
    page.getByRole("heading").and(page.getByTestId("pi-sign-in-title")),
  ).toBeVisible();
  await page
    .getByRole("button")
    .and(page.getByTestId("ai-option-claude-choose"))
    .click();
  await page
    .getByRole("button")
    .and(page.getByTestId("claude-sign-in-start"))
    .click();
  await page.getByTestId("claude-code-input").fill("synthetic-code#state");
  await page
    .getByRole("button")
    .and(page.getByTestId("claude-code-confirm"))
    .click();
  await expect(page).toHaveURL(/\/settings\/ai$/);
  await expect(
    page.getByRole("region").and(page.getByTestId("claude-sign-in")),
  ).toBeFocused();
  await expect(page.getByTestId("claude-login-state")).toHaveAttribute(
    "data-state",
    "completed",
  );
});

test("@account-settings direct settings subpage URL cannot bypass initial Pi gate", async ({
  page,
}) => {
  await page.goto("/settings/ai");
  await page
    .getByRole("button")
    .and(page.getByTestId("github-sign-in"))
    .click();
  await page.getByRole("link").nth(0).click();
  await expect(page).toHaveURL(/\/settings\/ai$/);
  await page.route("**/api/v1/onboarding/pi/status", (route) =>
    route.fulfill({ json: { schema_version: 1, pi: { state: "missing" } } }),
  );
  await page.goto("/settings/ai");
  await expect(
    page.getByRole("heading").and(page.getByTestId("pi-sign-in-title")),
  ).toBeVisible();
  await expect(
    page.getByRole("heading").and(page.getByTestId("settings-title")),
  ).toHaveCount(0);
  await page.unrouteAll();
  await page.route("**/api/v1/onboarding/pi/status", (route) =>
    route.fulfill({ json: { schema_version: 1, pi: { state: "unknown" } } }),
  );
  await page.reload();
  await expect(
    page.getByRole("heading").and(page.getByTestId("pi-sign-in-title")),
  ).toBeVisible();
  await expect(
    page.getByRole("heading").and(page.getByTestId("settings-title")),
  ).toHaveCount(0);
});

test("@account-settings unavailable snapshot does not display previous identity", async ({
  page,
}) => {
  await login(page);
  await settings(page);
  await page.route("**/api/v1/snapshot", (route) =>
    route.fulfill({ status: 503, body: "unavailable" }),
  );
  await page.reload();
  await expect(
    page
      .getByRole("heading")
      .and(page.getByTestId("workspaces-unavailable-title")),
  ).toBeVisible();
  await expect(
    page.getByRole("navigation").and(page.getByTestId("workspace-navigation")),
  ).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText("alice@example.invalid");
  await page.screenshot({
    path: "test-results/evidence/account-unavailable.png",
    fullPage: true,
  });
});

test("@account-settings @a11y compact phone drawer and settings separate list/detail screens", async ({
  page,
}) => {
  await login(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole("button")
    .and(page.getByTestId("navigation-open"))
    .click();
  const nav = page
    .getByRole("navigation")
    .and(page.getByTestId("workspace-navigation"));
  const firstWorkspace = nav.locator(".ah-workspace-row a").first();
  await expect(firstWorkspace).toHaveAttribute("aria-describedby", /.+/);
  await expect(firstWorkspace).toHaveAccessibleDescription(/.+/);
  await expect(firstWorkspace).toBeVisible();
  await page
    .getByRole("button")
    .and(page.getByTestId("account-menu-trigger"))
    .click();
  await page
    .getByRole("menuitem")
    .and(page.getByTestId("menu-settings"))
    .click();
  await expect(
    page.getByRole("heading").and(page.getByTestId("settings-section-tili")),
  ).not.toBeVisible();
  await page
    .getByRole("link")
    .and(page.getByTestId("settings-ulkoasu"))
    .click();
  const theme = page.getByRole("button").and(page.getByTestId("theme-choice"));
  await expect(theme).toBeVisible();
  await theme.click();
  await page.getByTestId("choice-dark").click();
  await expect(theme).toHaveAttribute("data-value", "dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    ),
  ).toBeLessThanOrEqual(1);
  await page
    .getByRole("button")
    .and(page.getByTestId("settings-list-back"))
    .click();
  await expect(page).toHaveURL(/\/settings$/);
  await page.goBack();
  await expect(theme).toBeVisible();
  await page.goForward();
  await expect(
    page.getByRole("heading").and(page.getByTestId("settings-title")),
  ).toBeFocused();
  expect(
    (await new AxeBuilder({ page }).include(".ah-account-settings").analyze())
      .violations,
  ).toEqual([]);
  await expect(
    page.getByRole("link").and(page.getByTestId("settings-ulkoasu")),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    ),
  ).toBeLessThanOrEqual(1);
});

test("@account-settings refused defaults and observation-only fallback cannot write a choice", async ({
  page,
}) => {
  await login(page);
  const { csrf } = await (await page.request.get("/auth/session")).json();
  expect(
    (
      await page.request.post("/api/v1/pi/models", {
        headers: {
          "X-Agent-Host-CSRF": csrf,
          Origin: new URL(page.url()).origin,
        },
        data: { model: "gpt-5.5", thinking: "high" },
      })
    ).status(),
  ).toBe(200);
  await settings(page);
  await page
    .getByRole("link")
    .and(page.getByTestId("settings-tekoaly"))
    .click();
  await openDefaultModel(page);
  await expect(
    page.getByRole("radio").and(page.getByTestId("model-gpt-5.5")),
  ).toBeChecked();
  await expect(
    page.getByRole("button").and(page.getByTestId("segment-high")),
  ).toBeDisabled();
  await page.goto("/workspaces");
  const href = await page
    .getByRole("navigation")
    .getByRole("link")
    .and(page.getByTestId("workspace-ordinary-dir"))
    .getAttribute("href");
  await page.goto(href ?? "/workspaces");
  await expect(
    page.getByRole("button").and(page.getByTestId("conversation-start")),
  ).toBeEnabled();
  await page
    .getByRole("button")
    .and(page.getByTestId("model-picker-open"))
    .click();
  await expect(
    page.getByRole("button").and(page.getByTestId("segment-high")),
  ).toBeDisabled();
  await page
    .getByRole("radio")
    .and(page.getByTestId("model-gpt-6-astra"))
    .check();
  await page
    .getByRole("button")
    .and(page.getByTestId("conversation-model-start"))
    .click();
  await expect(
    page.getByRole("textbox").and(page.getByTestId("message-input")),
  ).toBeEnabled();
  // The optimistic composer exists before the create reply names the route.
  await expect(page).toHaveURL(/conversation=pi:/);
  await page.reload();
  await expect(
    page.getByRole("textbox").and(page.getByTestId("message-input")),
  ).toBeEnabled();
  expect(
    (await (await page.request.get("/api/v1/pi/models")).json()).default_model,
  ).toBe("gpt-5.5");
  // A native catalog failure can show evidence, not offer a guaranteed-to-fail write.
  await page.route("**/api/v1/pi/models", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        schema_version: 1,
        default_provider: "openai-codex",
        default_model: "gpt-6-astra",
        catalog_status: "unavailable",
        models: [
          {
            id: "gpt-6-astra",
            name: "Observed Astra",
            outcome: "answered",
            observed_at: "2026-01-01T00:00:00Z",
          },
        ],
      }),
    }),
  );
  await page.goto("/settings");
  await page
    .getByRole("link")
    .and(page.getByTestId("settings-tekoaly"))
    .click();
  await openDefaultModel(page);
  await expect(
    page.getByRole("radio").and(page.getByTestId("model-gpt-6-astra")),
  ).toBeDisabled();
  await expect(page.getByTestId("model-catalog-unavailable")).toBeVisible();
});

/** Tekoäly's "Lisää API-avain" dialog: provider first, then the key. */
async function addKey(page: Page, provider: string, key: string) {
  await page
    .getByRole("button")
    .and(page.getByTestId("api-key-add-open"))
    .click();
  const dialog = page
    .getByRole("dialog")
    .and(page.getByTestId("api-key-dialog"));
  await dialog
    .getByRole("button")
    .and(page.getByTestId(`api-key-provider-${provider}`))
    .click();
  await dialog.getByTestId("api-key-input").fill(key);
  await dialog
    .getByRole("button")
    .and(page.getByTestId("api-key-save"))
    .click();
  const row = page.getByTestId(`api-key-row-${provider}`);
  await expect(row.getByTestId("api-key-suffix")).toHaveText(
    `${provider === "anthropic" ? "sk-ant-" : "sk-"}…${key.slice(-4)}`,
  );
  return row;
}
test.describe("credential settings", () => {
  // Request bodies must not enter trace artifacts, even with synthetic keys.
  test("@account-settings native key add, suffix, provider switch and confirmed removal", async ({
    page,
  }) => {
    await login(page);
    await settings(page);
    const key = `sk-${"s".repeat(24)}abcd`;
    const openai = await addKey(page, "openai", key);
    await expect(openai.getByTestId("api-key-suffix")).toBeVisible();
    expect(
      await page
        .locator("body")
        .evaluate((body, secret) => body.innerHTML.includes(secret), key),
    ).toBe(false);
    expect(await page.locator('input[type="password"]').count()).toBe(0);
    const credentials = await (
      await page.request.get("/api/v1/pi/credentials")
    ).json();
    expect(JSON.stringify(credentials).includes(key)).toBe(false);
    await page
      .getByRole("link")
      .and(page.getByTestId("settings-tekoaly"))
      .click();
    await openDefaultModel(page);
    await expect(
      page.getByRole("button").and(page.getByTestId("segment-openai")),
    ).toHaveAttribute("aria-pressed", "true");
    await page
      .getByRole("button")
      .and(page.getByTestId("segment-openai-codex"))
      .click();
    await page
      .getByRole("radio")
      .and(page.getByTestId("model-gpt-6.1-sol"))
      .click();
    await expect
      .poll(
        async () =>
          (await (await page.request.get("/api/v1/pi/models")).json())
            .default_provider,
      )
      .toBe("openai-codex");
    await page
      .getByRole("navigation")
      .and(page.getByTestId("settings-navigation"))
      .getByRole("link")
      .and(page.getByTestId("settings-tekoaly"))
      .click();
    await openai
      .getByRole("button")
      .and(page.getByTestId("api-key-remove-open"))
      .click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page
      .getByRole("dialog")
      .getByRole("button")
      .and(page.getByTestId("cancel"))
      .click();
    await expect(openai.getByTestId("api-key-suffix")).toHaveText("sk-…abcd");
    await expect(openai.getByTestId("api-key-suffix")).toBeVisible();
    await openai
      .getByRole("button")
      .and(page.getByTestId("api-key-remove-open"))
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button")
      .and(page.getByTestId("api-key-remove-confirm"))
      .click();
    await expect(openai).toHaveCount(0);
    await expect(page.getByTestId("api-key-missing")).toBeVisible();
  });

  test("@account-settings Anthropic and DeepSeek keys are separate native credentials with their own models", async ({
    page,
  }) => {
    await login(page);
    await settings(page);
    const add = (provider: string, key: string) => addKey(page, provider, key);
    const anthropicKey = `sk-ant-api03-${"A".repeat(86)}_x-AA`;
    const anthropic = await add("anthropic", anthropicKey);
    // Each provider's row reports only its own key. A Claude-only Pi is usable
    // as a whole, yet its OpenAI sign-in row still says OpenAI is missing.
    await expect(page.getByTestId("api-key-row-openai")).toHaveCount(0);
    await expect(page.getByTestId("openai-credential-state")).toHaveAttribute(
      "data-state",
      "missing",
    );
    // Pi's own write made Anthropic the default; the chooser offers its models.
    await page
      .getByRole("link")
      .and(page.getByTestId("settings-tekoaly"))
      .click();
    await openDefaultModel(page);
    await expect(
      page.getByRole("button").and(page.getByTestId("segment-anthropic")),
    ).toHaveAttribute("aria-pressed", "true");
    await page
      .getByRole("radio")
      .and(page.getByTestId("model-claude-opus-5-5"))
      .click();
    await expect
      .poll(async () => {
        const models = await (
          await page.request.get("/api/v1/pi/models")
        ).json();
        return `${models.default_provider}/${models.default_model}`;
      })
      .toBe("anthropic/claude-opus-5-5");
    await expect(
      page.getByRole("button").and(page.getByTestId("segment-deepseek")),
    ).toHaveCount(0);
    await page
      .getByRole("navigation")
      .and(page.getByTestId("settings-navigation"))
      .getByRole("link")
      .and(page.getByTestId("settings-tekoaly"))
      .click();
    const deepseekKey = `sk-${"0f".repeat(16)}beef`;
    const deepseek = await add("deepseek", deepseekKey);
    const credentials = JSON.stringify(
      await (await page.request.get("/api/v1/pi/credentials")).json(),
    );
    expect(credentials.includes(anthropicKey)).toBe(false);
    expect(credentials.includes(deepseekKey)).toBe(false);
    await anthropic
      .getByRole("button")
      .and(page.getByTestId("api-key-remove-open"))
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button")
      .and(page.getByTestId("api-key-remove-confirm"))
      .click();
    await expect(anthropic).toHaveCount(0);
    await expect(deepseek.getByTestId("api-key-state")).toHaveAttribute(
      "data-present",
      "true",
    );
  });
});

test("@account-settings administration is host-authorized, not only hidden", async ({
  page,
}) => {
  await login(page);
  await settings(page);
  // Administration is its own area, entered from the personal list.
  await page
    .getByRole("link")
    .and(page.getByTestId("settings-palvelin"))
    .click();
  await page
    .getByRole("link")
    .and(page.getByTestId("settings-kayttajat"))
    .click();
  await expect(page.getByTestId("access-row-42")).toBeVisible();
  await page.getByRole("link").and(page.getByTestId("settings-levy")).click();
  await expect(page.getByTestId("server-storage")).toBeVisible();
  await expect(page.getByTestId(/^administration-user-/).first()).toBeVisible();
  let releaseServer = () => {};
  const serverReady = new Promise<void>((resolve) => {
    releaseServer = resolve;
  });
  await page.route("**/api/v1/server", async (route) => {
    await serverReady;
    await route.continue();
  });
  await page.goto("/settings/server");
  await expect(page.getByTestId("administration-checking")).toBeVisible();
  await expect(page.getByTestId("administration-denied")).toHaveCount(0);
  releaseServer();
  await expect(page.getByTestId("server-name-input")).toBeVisible();
  await page.unroute("**/api/v1/server");
  await page.getByTestId("settings-close").click();
  await page
    .getByRole("button")
    .and(page.getByTestId("account-menu-trigger"))
    .click();
  await page.getByRole("menuitem").and(page.getByTestId("menu-logout")).click();
  await Promise.all([
    page.waitForResponse((r) => r.url().endsWith("/auth/logout")),
    page
      .getByRole("dialog")
      .getByRole("button")
      .and(page.getByTestId("logout-confirm"))
      .click(),
  ]);
  await expect(
    page.getByRole("button").and(page.getByTestId("github-sign-in")),
  ).toBeVisible();
  await login(page, "Bob");
  await settings(page);
  await expect(
    page.getByRole("link").and(page.getByTestId("settings-kayttajat")),
  ).toHaveCount(0);
  expect(
    (await page.request.get("/api/v1/server/administration")).status(),
  ).toBe(403);
  expect((await page.request.get("/api/v1/server/storage")).status()).toBe(403);
  expect((await page.request.get("/api/v1/server/access")).status()).toBe(403);
  for (const path of [
    "/administration",
    "/settings/server",
    "/settings/users",
    "/settings/disk",
  ]) {
    await page.goto(path);
    await expect(page.getByTestId("administration-denied")).toBeVisible();
    await expect(page.getByTestId("server-storage-section")).toHaveCount(0);
    await expect(page.getByTestId("server-access")).toHaveCount(0);
    await expect(page.getByTestId("server-name-input")).toHaveCount(0);
    await expect(
      page.getByRole("link").and(page.getByTestId("settings-kayttajat")),
    ).toHaveCount(0);
  }
  await page.goto("/settings/not-a-section");
  await expect(page).toHaveURL(/\/settings$/);
});

test("@account-settings Claude native code sign-in and provider-qualified picker", async ({
  page,
}) => {
  await login(page);
  const attempt = "20261016T120000.000000001";
  let signedIn = false;
  let started = false;
  let submissions = 0;
  await page.route("**/api/v1/pi/claude-login", async (route) => {
    const request = route.request();
    if (request.method() === "POST") started = true;
    if (request.method() === "PUT") {
      expect(request.headers()["x-agent-host-csrf"]).toBeTruthy();
      expect(request.postDataJSON()).toEqual({
        attempt_id: attempt,
        code: "synthetic-code#state",
      });
      submissions++;
      signedIn = true;
    }
    await route.fulfill({
      json: {
        schema_version: 1,
        state: signedIn ? "completed" : started ? "code" : "missing",
        ...(started ? { attempt_id: attempt } : {}),
        ...(started && !signedIn
          ? {
              verification_uri:
                "https://claude.com/cai/oauth/authorize?code=true&state=synthetic",
            }
          : {}),
      },
    });
  });
  await page.route("**/api/v1/pi/models", async (route) => {
    const original = await route.fetch();
    const json = await original.json();
    json.models.push({
      provider: "claude-bridge",
      id: "claude-fable-5-1",
      name: "Claude Fable 5.1",
      thinking_levels: ["low", "high"],
    });
    await route.fulfill({ response: original, json });
  });
  await settings(page);
  await expect(
    page.getByRole("region").and(page.getByTestId("claude-sign-in")),
  ).toBeVisible();
  await page
    .getByRole("button")
    .and(page.getByTestId("claude-sign-in-start"))
    .click();
  await expect(
    page.getByRole("link").and(page.getByTestId("claude-sign-in-link")),
  ).toHaveAttribute("href", /^https:\/\/claude\.com\//);
  if (process.env.OH_CLAUDE_CAPTURE_DIR) {
    const { mkdir } = await import("node:fs/promises");
    const { join } = await import("node:path");
    await mkdir(process.env.OH_CLAUDE_CAPTURE_DIR, { recursive: true });
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const colorScheme of ["light", "dark"] as const) {
        await page.emulateMedia({ colorScheme });
        await page
          .getByRole("region")
          .and(page.getByTestId("claude-sign-in"))
          .screenshot({
            path: join(
              process.env.OH_CLAUDE_CAPTURE_DIR,
              `${width}-${colorScheme}.png`,
            ),
            animations: "disabled",
          });
      }
    }
  }
  await page.getByTestId("claude-code-input").fill("synthetic-code#state");
  await page
    .getByRole("button")
    .and(page.getByTestId("claude-code-confirm"))
    .click();
  await expect(page.getByTestId("claude-login-state")).toHaveAttribute(
    "data-state",
    "completed",
  );
  await expect(page.getByTestId("claude-login-state")).toBeVisible();
  await expect(page.getByTestId("claude-code-input")).toHaveCount(0);
  expect(submissions).toBe(1);
  const writes: unknown[] = [];
  await page.route("**/api/v1/pi/models", async (route) => {
    if (route.request().method() === "POST")
      writes.push(route.request().postDataJSON());
    await route.fulfill({
      json: {
        schema_version: 1,
        default_provider: "claude-bridge",
        default_model: "claude-fable-5-1",
        models: [
          {
            provider: "claude-bridge",
            id: "claude-fable-5-1",
            name: "Claude Fable 5.1",
            thinking_levels: ["low", "high"],
          },
        ],
      },
    });
  });
  // The catalog above is mocked from here on: read the page again.
  await page.reload();
  await openDefaultModel(page);
  await page
    .getByRole("button")
    .and(page.getByTestId("segment-claude-bridge"))
    .click();
  await expect(
    page.getByRole("radio").and(page.getByTestId("model-claude-fable-5-1")),
  ).toBeChecked();
  expect(writes).toEqual([]);
  await page.getByRole("button").and(page.getByTestId("segment-high")).click();
  await expect
    .poll(() => writes)
    .toEqual([
      {
        provider: "claude-bridge",
        model: "claude-fable-5-1",
        thinking: "high",
      },
    ]);
});

test("@account-settings Claude sign-in remains findable without a native runtime on mobile", async ({
  page,
}) => {
  await login(page, "Bob");
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole("button")
    .and(page.getByTestId("navigation-open"))
    .click();
  await settings(page);
  const claude = page
    .getByRole("region")
    .and(page.getByTestId("claude-sign-in"));
  await expect(claude).toBeVisible();
  await expect(claude.getByRole("status")).toBeVisible();
  await expect(
    claude.getByRole("button").and(claude.getByTestId("claude-sign-in-start")),
  ).toBeDisabled();
  await expect(claude.getByRole("alert")).toHaveCount(0);
  await page
    .getByRole("button")
    .and(page.getByTestId("settings-list-back"))
    .click();
  await page
    .getByRole("link")
    .and(page.getByTestId("settings-tekoaly"))
    .click();
  // Subscriptions and the default model share Tekoäly: no detour.
  await expect(claude).toBeVisible();
  await expect(
    page.getByRole("heading").and(page.getByTestId("settings-section-tekoaly")),
  ).toBeFocused();
});

// This differs from a canonical deep link: the browser must normalize its
// OAuth return target before the gateway's exact UI allowlist sees it.
test("@account-settings unknown settings link still allows sign-in", async ({
  page,
}) => {
  await page.goto("/settings/account/");
  const started = page.waitForRequest(/\/auth\/github\/start\?/);
  await page
    .getByRole("button")
    .and(page.getByTestId("github-sign-in"))
    .click();
  // An ordinary sign-in keeps gh's working login: only settings reconnects.
  expect(new URL((await started).url()).searchParams.has("reconnect")).toBe(
    false,
  );
  await page.getByRole("link").nth(0).click();
  await expect(page).toHaveURL(/\/workspaces$/);
  await expect(
    page.getByRole("button").and(page.getByTestId("account-menu-trigger")),
  ).toBeVisible();
});
test.describe("expired GitHub connection", () => {
  test.use({ deviceScaleFactor: 2 });
  test("@account-settings an expired gh login says so and one sign-in reconnects", async ({
    page,
  }) => {
    await state(page, "expired");
    await login(page);
    await page.goto("/settings/code-hosts");
    const row = page.locator("#main").getByTestId("github-native-state");
    await expect(row).toHaveAttribute("data-state", "expired");
    await expect(row).toContainText("Vanhentunut");
    await expect(page.locator("#main")).toContainText(
      "GitHub ei enää hyväksy palvelimelle tallennettua valtuutusta",
    );
    // Removing a login GitHub already rejects is not offered; reconnecting is.
    await expect(page.getByTestId("github-disconnect-inspect")).toHaveCount(0);
    const reconnect = page
      .getByRole("button")
      .and(page.getByTestId("github-reconnect"));
    await expect(reconnect).toBeVisible();
    for (const theme of ["light", "dark"] as const) {
      // Reduced motion: the theme switch must not be captured mid-transition.
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      const results = await new AxeBuilder({ page })
        .include("[data-testid=github-native-state]")
        .withTags(["wcag2a", "wcag2aa"])
        .analyze();
      expect(results.violations).toEqual([]);
      await page.screenshot({
        path: `test-results/evidence/github-expired-${theme}.png`,
        fullPage: true,
      });
    }
    await page.emulateMedia({ colorScheme: "light" });
    // The sign-in replaces the rejected token; afterwards the daemon
    // observes a working login again.
    await page.unroute("**/api/v1/snapshot");
    await state(page, "connected");
    // The button asks for an explicit reconnect, which the gateway accepts
    // only from this signed-in, same-origin page.
    const started = page.waitForRequest(/\/auth\/github\/start\?/);
    await reconnect.click();
    const start = new URL((await started).url());
    expect(start.searchParams.get("reconnect")).toBe("1");
    expect(start.searchParams.get("return_to")).toBe("/settings/code-hosts");
    await expect(page).toHaveURL(/\/fixture\/provider\?/);
    await page.getByRole("link").nth(0).click();
    await expect(page).toHaveURL(/\/settings\/code-hosts$/);
    await expect(row).toHaveAttribute("data-state", "connected");
    // A working login can still be replaced on request, as a quieter action.
    await expect(page.getByTestId("github-reconnect")).toBeVisible();
  });
});
