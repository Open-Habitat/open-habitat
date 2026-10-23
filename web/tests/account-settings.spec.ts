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
async function settings(page: Page) {
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
    .and(page.getByTestId("settings-yhteydet"))
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
  await settings(page);
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
      .and(page.getByTestId("settings-section-yhteydet")),
  ).toBeVisible();
  await expect(page.getByTestId("pi-credential-state")).toHaveAttribute(
    "data-state",
    "usable",
  );
  await expect(page.getByTestId("pi-credential-state")).toBeVisible();
  await page
    .getByRole("link")
    .and(page.getByTestId("settings-ulkoasu"))
    .click();
  await expect(page).toHaveURL(/\/settings\/appearance$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/settings\/connections$/);
  await expect(
    page
      .getByRole("heading")
      .and(page.getByTestId("settings-section-yhteydet")),
  ).toBeVisible();
  await page.goForward();
  await expect(
    page.getByRole("group").and(page.getByTestId("theme-choice")),
  ).toBeVisible();
  await page.getByTestId("segment-dark").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByTestId("segment-light").click();
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
  await page.getByRole("button").and(page.getByTestId("settings-back")).click();
  await expect(page).toHaveURL(new RegExp(`${returnPath}$`));
  await expect(
    page.getByRole("button").and(page.getByTestId("account-menu-trigger")),
  ).toBeFocused();
  await settings(page);
  await page.reload();
  await expect(page).toHaveURL(/\/settings\/connections$/);
  await expect(
    page
      .getByRole("heading")
      .and(page.getByTestId("settings-section-yhteydet")),
  ).toBeVisible();
  await expect(
    page.locator("#main").getByTestId("github-native-state"),
  ).toHaveAttribute("data-state", "connected");
  await expect(
    page.locator("#main").getByTestId("github-native-state"),
  ).toBeVisible();
  await page.getByRole("button").and(page.getByTestId("settings-back")).click();
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
  await settings(page);
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
    .and(page.getByTestId("settings-yhteydet"))
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
  await page.goto("/settings/connections");
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
    .and(page.getByTestId("settings-agentti"))
    .click();
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
    .and(page.getByTestId("settings-agentti"))
    .click();
  await expect(
    page.getByRole("radio").and(page.getByTestId("model-gpt-5.4")),
  ).toBeChecked();
  await expect(
    page.getByRole("radio").and(page.getByTestId("model-gpt-5.4")),
  ).toBeVisible();
});

test("@account-settings Pi credentials change while the page is open; uncertainty is not success", async ({
  page,
}) => {
  await login(page);
  await page.route("**/api/v1/onboarding/pi/status", (route) =>
    route.fulfill({ json: { schema_version: 1, pi: { state: "missing" } } }),
  );
  await settings(page);
  await expect(page.getByTestId("pi-credential-state")).toHaveAttribute(
    "data-state",
    "missing",
  );
  await expect(page.getByTestId("pi-credential-state")).toBeVisible();
  await page.getByRole("button").and(page.getByTestId("pi-sign-in")).click();
  await expect(
    page.getByRole("heading").and(page.getByTestId("pi-sign-in-title")),
  ).toBeVisible();
  await expect(
    page.getByRole("button").and(page.getByTestId("pi-attempt-start")),
  ).toBeVisible();
  await page.unrouteAll();
  await page.goto("/workspaces");
  await expect(
    page.getByRole("button").and(page.getByTestId("account-menu-trigger")),
  ).toBeVisible();
  await page.route("**/api/v1/onboarding/pi/status", (route) =>
    route.fulfill({ json: { schema_version: 1, pi: { state: "unknown" } } }),
  );
  // Client navigation, not a new first-load check: the gate remains intact.
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
    .and(page.getByTestId("settings-yhteydet"))
    .click();
  await expect(page.getByTestId("pi-credential-state")).toHaveAttribute(
    "data-state",
    /^(unknown|unavailable)$/,
  );
  await expect(page.getByTestId("pi-credential-state")).toBeVisible();
  await expect(
    page.getByRole("button").and(page.getByTestId("pi-sign-in")),
  ).toBeVisible();
  await page.getByRole("button").and(page.getByTestId("settings-back")).click();
  await page.unrouteAll();
  await page.route("**/api/v1/onboarding/pi/status", (route) =>
    route.fulfill({ status: 502, body: "bad gateway" }),
  );
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
    .and(page.getByTestId("settings-yhteydet"))
    .click();
  await expect(page.getByTestId("pi-credential-state")).toHaveAttribute(
    "data-state",
    /^(unknown|unavailable)$/,
  );
  await expect(page.getByTestId("pi-credential-state")).toBeVisible();
  await expect(page.getByTestId("pi-credential-state")).toBeVisible();
});

test("@account-settings direct settings subpage URL cannot bypass initial Pi gate", async ({
  page,
}) => {
  await page.goto("/settings/agents");
  await page
    .getByRole("button")
    .and(page.getByTestId("github-sign-in"))
    .click();
  await page.getByRole("link").nth(0).click();
  await expect(page).toHaveURL(/\/settings\/agents$/);
  await page.route("**/api/v1/onboarding/pi/status", (route) =>
    route.fulfill({ json: { schema_version: 1, pi: { state: "missing" } } }),
  );
  await page.goto("/settings/agents");
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
  const firstAgent = nav.locator(".ah-agent-item .ah-nav-link").first();
  await expect(firstAgent).toHaveAttribute("aria-describedby", /.+/);
  await expect(firstAgent).toHaveAccessibleDescription(/.+/);
  await expect(firstAgent).toBeVisible();
  await expect(firstAgent.locator(".ah-nav-mark")).toBeVisible();
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
  await expect(
    page.getByRole("group").and(page.getByTestId("theme-choice")),
  ).toBeVisible();
  await page.getByRole("button").and(page.getByTestId("segment-dark")).click();
  await expect(
    page.getByRole("button").and(page.getByTestId("segment-dark")),
  ).toHaveAttribute("aria-pressed", "true");
  await page
    .getByRole("button")
    .and(page.getByTestId("settings-list-back"))
    .click();
  await expect(page).toHaveURL(/\/settings$/);
  await page.goBack();
  await expect(
    page.getByRole("group").and(page.getByTestId("theme-choice")),
  ).toBeVisible();
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
    .and(page.getByTestId("settings-agentti"))
    .click();
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
    .and(page.getByTestId("settings-agentti"))
    .click();
  await expect(
    page.getByRole("radio").and(page.getByTestId("model-gpt-6-astra")),
  ).toBeDisabled();
  await expect(page.getByTestId("model-catalog-unavailable")).toBeVisible();
});

test.describe("credential settings", () => {
  // Request bodies must not enter trace artifacts, even with synthetic keys.
  test("@account-settings native key add, suffix, provider switch and confirmed removal", async ({
    page,
  }) => {
    await login(page);
    await settings(page);
    const openai = page.getByTestId("api-key-row-openai");
    await openai
      .getByRole("button")
      .and(page.getByTestId("api-key-add"))
      .click();
    const key = `sk-${"s".repeat(24)}abcd`;
    await openai.getByTestId("api-key-input").fill(key);
    await openai
      .getByRole("button")
      .and(page.getByTestId("api-key-save"))
      .click();
    await expect(openai.getByTestId("api-key-suffix")).toHaveText("sk-…abcd");
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
      .and(page.getByTestId("settings-agentti"))
      .click();
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
      .and(page.getByTestId("settings-yhteydet"))
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
    await expect(openai.getByTestId("api-key-state")).toHaveAttribute(
      "data-present",
      "false",
    );
    await expect(openai.getByTestId("api-key-state")).toBeVisible();
  });

  test("@account-settings Anthropic and DeepSeek keys are separate native credentials with their own models", async ({
    page,
  }) => {
    await login(page);
    await settings(page);
    const add = async (provider: string, key: string) => {
      const row = page.getByTestId(`api-key-row-${provider}`);
      await row
        .getByRole("button")
        .and(page.getByTestId("api-key-add"))
        .click();
      await row.getByTestId("api-key-input").fill(key);
      await row
        .getByRole("button")
        .and(page.getByTestId("api-key-save"))
        .click();
      await expect(row.getByTestId("api-key-suffix")).toHaveText(
        `sk-…${key.slice(-4)}`,
      );
      return row;
    };
    const anthropicKey = `sk-ant-api03-${"A".repeat(86)}_x-AA`;
    const anthropic = await add("anthropic", anthropicKey);
    // Each provider's row reports only its own key.
    await expect(
      page.getByTestId("api-key-row-openai").getByTestId("api-key-state"),
    ).toHaveAttribute("data-present", "false");
    // Pi's own write made Anthropic the default; the chooser offers its models.
    await page
      .getByRole("link")
      .and(page.getByTestId("settings-agentti"))
      .click();
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
      .and(page.getByTestId("settings-yhteydet"))
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
    await expect(anthropic.getByTestId("api-key-state")).toHaveAttribute(
      "data-present",
      "false",
    );
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
  await page
    .getByRole("link")
    .and(page.getByTestId("settings-kayttajat"))
    .click();
  await expect(page.getByRole("table")).toContainText("alice");
  await page.getByRole("link").and(page.getByTestId("settings-levy")).click();
  await expect(page.getByTestId("server-storage")).toBeVisible();
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
  for (const path of [
    "/administration",
    "/settings/server",
    "/settings/users",
    "/settings/disk",
  ]) {
    await page.goto(path);
    await expect(page.getByTestId("administration-denied")).toBeVisible();
    await expect(page.getByRole("table")).toHaveCount(0);
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
    .getByRole("link")
    .and(page.getByTestId("settings-agentti"))
    .click();
  await page
    .getByRole("button")
    .and(page.getByTestId("manage-credentials"))
    .click();
  await expect(
    page
      .getByRole("heading")
      .and(page.getByTestId("settings-section-yhteydet")),
  ).toBeFocused();
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
  await page
    .getByRole("link")
    .and(page.getByTestId("settings-agentti"))
    .click();
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
    .and(page.getByTestId("settings-agentti"))
    .click();
  await page
    .getByRole("button")
    .and(page.getByTestId("manage-credentials"))
    .click();
  await expect(claude).toBeVisible();
  await expect(
    page
      .getByRole("heading")
      .and(page.getByTestId("settings-section-yhteydet")),
  ).toBeFocused();
});

// This differs from a canonical deep link: the browser must normalize its
// OAuth return target before the gateway's exact UI allowlist sees it.
test("@account-settings unknown settings link still allows sign-in", async ({
  page,
}) => {
  await page.goto("/settings/account/");
  await page
    .getByRole("button")
    .and(page.getByTestId("github-sign-in"))
    .click();
  await page.getByRole("link").nth(0).click();
  await expect(page).toHaveURL(/\/workspaces$/);
  await expect(
    page.getByRole("button").and(page.getByTestId("account-menu-trigger")),
  ).toBeVisible();
});
