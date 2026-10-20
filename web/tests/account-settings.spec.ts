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
  await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
  await page.getByRole("link", { name }).click();
  await expect(page.getByRole("button", { name: /Tilivalikko/ })).toBeVisible();
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
  await page.getByRole("button", { name: /Tilivalikko/ }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("menuitem", { name: "Asetukset" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: /Tilivalikko/ })).toBeFocused();
  await page.keyboard.press("Enter");
  await page.getByRole("menuitem", { name: "Asetukset" }).focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.getByRole("heading", { name: "Asetukset" })).toBeFocused();
  await expect(
    page.getByRole("link", { name: "Tili", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await page
    .getByRole("navigation", { name: "Asetusten osiot" })
    .getByRole("link", { name: "Yhteydet", exact: true })
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
  await page.getByRole("button", { name: /Tilivalikko/ }).click();
  await expect(page.getByRole("menuitem", { name: "Asetukset" })).toBeVisible();
  await page.screenshot({
    path: "test-results/evidence/account-menu.png",
    fullPage: true,
  });
  await page.keyboard.press("Escape");
  await page.locator(".ah-workspace-link").first().click();
  await expect(page.locator("main h1")).toHaveText("git-project");
  const returnPath = new URL(page.url()).pathname;
  await settings(page);
  await expect(
    page.locator("#main").getByText("Yhdistetty", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(
      /Selaimesta uloskirjautuminen ei poista palvelimen valtuutusta/,
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Tarkista katkaisu" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Katkaise paikallinen GitHub-yhteys" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Yhteydet", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Pi-tunnukset käytettävissä")).toBeVisible();
  await page.getByRole("link", { name: "Ulkoasu", exact: true }).click();
  await expect(page).toHaveURL(/\/settings\/ulkoasu$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/settings\/yhteydet$/);
  await expect(
    page.getByRole("heading", { name: "Yhteydet", exact: true }),
  ).toBeVisible();
  await page.goForward();
  await expect(page.getByRole("group", { name: "Teema" })).toBeVisible();
  await page.getByText("Tumma", { exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByText("Vaalea", { exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.getByRole("link", { name: "Tili", exact: true }).click();
  await expect(page).toHaveURL(/\/settings\/tili$/);
  await expect(
    page.getByRole("button", { name: "Kirjaudu ulos…" }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/evidence/account-connected.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Takaisin" }).click();
  await expect(page).toHaveURL(new RegExp(`${returnPath}$`));
  await expect(page.getByRole("button", { name: /Tilivalikko/ })).toBeFocused();
  await settings(page);
  await page.reload();
  await expect(page).toHaveURL(/\/settings\/yhteydet$/);
  await expect(
    page.getByRole("heading", { name: "Yhteydet", exact: true }),
  ).toBeVisible();
  await expect(
    page.locator("#main").getByText("Yhdistetty", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Takaisin" }).click();
  await expect(page).toHaveURL(/\/workspaces$/);
  await expect(page.getByRole("button", { name: /Tilivalikko/ })).toBeFocused();
});
test("@account-settings partial, unknown and logout/user switch", async ({
  page,
}) => {
  await state(page, "partial");
  await login(page);
  await settings(page);
  await expect(page.getByText("Osittainen yhteys")).toBeVisible();
  await page.screenshot({
    path: "test-results/evidence/account-partial.png",
    fullPage: true,
  });
  await page.unroute("**/api/v1/snapshot");
  await state(page, "unknown");
  await page.reload();
  await page
    .getByRole("navigation", { name: "Asetusten osiot" })
    .getByRole("link", { name: "Yhteydet", exact: true })
    .click();
  await expect(
    page.getByText("Tilaa ei tiedetä", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/evidence/account-unknown.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: /Tilivalikko/ }).click();
  await page.getByRole("menuitem", { name: "Kirjaudu ulos…" }).click();
  await expect(
    page.getByRole("dialog", { name: "Kirjaudutaanko ulos tästä selaimesta?" }),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).toContainText("Palvelimen tunnukset");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Kirjaudu ulos" })
    .click();
  await expect(
    page.getByRole("button", { name: "Kirjaudu GitHubilla" }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/workspaces$/);
  await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
  await page.getByRole("link", { name: "Bob" }).click();
  await expect(page.getByRole("button", { name: /Tilivalikko/ })).toBeVisible();
  await expect(page.getByRole("navigation")).not.toContainText(
    "GitHub user 42",
  );
  await page.goto("/settings/yhteydet");
  await expect(
    page.getByText("Tilaa ei tiedetä", { exact: true }),
  ).toBeVisible();
});
test("@account-settings Pi default model is read from native models and saved", async ({
  page,
}) => {
  await login(page);
  await settings(page);
  await page.getByRole("link", { name: "Agentit", exact: true }).click();
  const older = page.getByText("Vanhemmat mallit (3)");
  await expect(page.getByRole("radio", { name: /GPT 5.4/ })).not.toBeVisible();
  await older.click();
  await page.getByRole("radio", { name: /GPT 5.4/ }).click();
  await expect(page.getByRole("radio", { name: /GPT 5.4/ })).toBeChecked();
  await page.reload();
  await page.getByRole("link", { name: "Agentit", exact: true }).click();
  await expect(page.getByRole("radio", { name: /GPT 5.4/ })).toBeChecked();
  await expect(page.getByRole("radio", { name: /GPT 5.4/ })).toBeVisible();
});

test("@account-settings Pi credentials change while the page is open; uncertainty is not success", async ({
  page,
}) => {
  await login(page);
  await page.route("**/api/v1/onboarding/pi/status", (route) =>
    route.fulfill({ json: { schema_version: 1, pi: { state: "missing" } } }),
  );
  await settings(page);
  await expect(page.getByText("Pi-kirjautuminen puuttuu")).toBeVisible();
  await page.getByRole("button", { name: "Kirjaudu Pi:hin" }).click();
  await expect(
    page.getByRole("heading", { name: "Kirjaudu OpenAI-tiliisi" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Aloita kirjautuminen" }),
  ).toBeVisible();
  await page.unrouteAll();
  await page.goto("/workspaces");
  await expect(page.getByRole("button", { name: /Tilivalikko/ })).toBeVisible();
  await page.route("**/api/v1/onboarding/pi/status", (route) =>
    route.fulfill({ json: { schema_version: 1, pi: { state: "unknown" } } }),
  );
  // Client navigation, not a new first-load check: the gate remains intact.
  await page.getByRole("button", { name: /Tilivalikko/ }).click();
  await page.getByRole("menuitem", { name: "Asetukset" }).click();
  await page
    .getByRole("navigation", { name: "Asetusten osiot" })
    .getByRole("link", { name: "Yhteydet", exact: true })
    .click();
  await expect(page.getByText("Pi-tilaa ei voitu vahvistaa")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Kirjaudu Pi:hin uudelleen" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Takaisin" }).click();
  await page.unrouteAll();
  await page.route("**/api/v1/onboarding/pi/status", (route) =>
    route.fulfill({ status: 502, body: "bad gateway" }),
  );
  await page.getByRole("button", { name: /Tilivalikko/ }).click();
  await page.getByRole("menuitem", { name: "Asetukset" }).click();
  await page
    .getByRole("navigation", { name: "Asetusten osiot" })
    .getByRole("link", { name: "Yhteydet", exact: true })
    .click();
  await expect(page.getByText("Pi-tilaa ei voitu vahvistaa")).toBeVisible();
  await expect(page.getByText(/Tämä ei vahvista käyttöoikeutta/)).toBeVisible();
});

test("@account-settings direct settings subpage URL cannot bypass initial Pi gate", async ({
  page,
}) => {
  await page.goto("/settings/agentit");
  await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
  await page.getByRole("link", { name: "Alice", exact: true }).click();
  await expect(page).toHaveURL(/\/settings\/agentit$/);
  await page.route("**/api/v1/onboarding/pi/status", (route) =>
    route.fulfill({ json: { schema_version: 1, pi: { state: "missing" } } }),
  );
  await page.goto("/settings/agentit");
  await expect(
    page.getByRole("heading", { name: "Kirjaudu OpenAI-tiliisi" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Asetukset" })).toHaveCount(0);
  await page.unrouteAll();
  await page.route("**/api/v1/onboarding/pi/status", (route) =>
    route.fulfill({ json: { schema_version: 1, pi: { state: "unknown" } } }),
  );
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Kirjaudu OpenAI-tiliisi" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Asetukset" })).toHaveCount(0);
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
    page.getByRole("heading", { name: "Työtiloja ei saatu näkyviin" }),
  ).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Työtilat ja keskustelut" }),
  ).toHaveCount(0);
  await expect(page.getByText("Oma tili")).toHaveCount(0);
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
  await page.getByRole("button", { name: "Avaa navigaatio" }).click();
  const nav = page.getByRole("navigation", { name: "Työtilat ja keskustelut" });
  const firstAgent = nav.locator(".ah-agent-item .ah-nav-link").first();
  await expect(firstAgent).toHaveAttribute("aria-describedby", /.+/);
  await expect(firstAgent).toHaveAccessibleDescription(
    /Tila ei tiedossa · Vain luku/,
  );
  await expect(firstAgent).toContainText("Vain luku");
  await expect(firstAgent.locator(".ah-nav-mark")).toBeVisible();
  await page.getByRole("button", { name: /Tilivalikko/ }).click();
  await page.getByRole("menuitem", { name: "Asetukset" }).click();
  await expect(
    page.getByRole("heading", { name: "Tili", exact: true }),
  ).not.toBeVisible();
  await page.getByRole("link", { name: "Ulkoasu", exact: true }).click();
  await expect(page.getByRole("group", { name: "Teema" })).toBeVisible();
  await page.getByRole("button", { name: "Tumma", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Tumma", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "← Asetukset", exact: true }).click();
  await expect(page).toHaveURL(/\/settings$/);
  await page.goBack();
  await expect(page.getByRole("group", { name: "Teema" })).toBeVisible();
  await page.goForward();
  await expect(
    page.getByRole("heading", { name: "Asetukset", exact: true }),
  ).toBeFocused();
  expect(
    (await new AxeBuilder({ page }).include(".ah-account-settings").analyze())
      .violations,
  ).toEqual([]);
  await expect(
    page.getByRole("link", { name: "Ulkoasu", exact: true }),
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
  await page.getByRole("link", { name: "Agentit", exact: true }).click();
  await expect(page.getByRole("radio", { name: /GPT 5.5/ })).toBeChecked();
  await expect(
    page.getByRole("button", { name: "high", exact: true }),
  ).toBeDisabled();
  await page.goto("/workspaces");
  const href = await page
    .getByRole("navigation")
    .getByRole("link", { name: "ordinary-dir", exact: true })
    .getAttribute("href");
  await page.goto(href ?? "/workspaces");
  await expect(
    page.getByRole("button", { name: "Aloita uusi agenttikeskustelu" }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "Valitse toinen malli", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "high", exact: true }),
  ).toBeDisabled();
  await page.getByRole("radio", { name: /GPT-6 Astra/ }).check();
  await page
    .getByRole("button", { name: "Aloita keskustelu valitulla mallilla" })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Viesti agentille" }),
  ).toBeEnabled();
  await page.reload();
  await expect(
    page.getByRole("textbox", { name: "Viesti agentille" }),
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
  await page.getByRole("link", { name: "Agentit", exact: true }).click();
  await expect(
    page.getByRole("radio", { name: /Observed Astra/ }),
  ).toBeDisabled();
  await expect(page.getByText(/vain keskusteluista tutut/)).toBeVisible();
});

test.describe("credential settings", () => {
  // Request bodies must not enter trace artifacts, even with synthetic keys.
  test("@account-settings native key add, suffix, provider switch and confirmed removal", async ({
    page,
  }) => {
    await login(page);
    await settings(page);
    await page
      .getByRole("button", { name: "Lisää avain", exact: true })
      .click();
    const key = `sk-${"s".repeat(24)}abcd`;
    await page.getByLabel("API-avain", { exact: true }).fill(key);
    await page
      .getByRole("button", { name: "Tallenna avain", exact: true })
      .click();
    await expect(page.getByText("sk-…abcd", { exact: true })).toBeVisible();
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
    await page.getByRole("link", { name: "Agentit", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "API-avain", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await page
      .getByRole("button", { name: "ChatGPT-tilaus", exact: true })
      .click();
    await page.getByRole("radio", { name: /GPT-6.1 Sol/ }).click();
    await expect
      .poll(
        async () =>
          (await (await page.request.get("/api/v1/pi/models")).json())
            .default_provider,
      )
      .toBe("openai-codex");
    await page
      .getByRole("navigation", { name: "Asetusten osiot" })
      .getByRole("link", { name: "Yhteydet", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Poista avain…", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toContainText(
      "Avainta ei peruta OpenAI:ssa",
    );
    await page.getByRole("button", { name: "Peruuta", exact: true }).click();
    await expect(page.getByText("sk-…abcd", { exact: true })).toBeVisible();
    await page
      .getByRole("button", { name: "Poista avain…", exact: true })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Poista avain", exact: true })
      .click();
    await expect(page.getByText("Ei avainta", { exact: true })).toBeVisible();
  });
});

test("@account-settings administration is host-authorized, not only hidden", async ({
  page,
}) => {
  await login(page);
  await settings(page);
  await page.getByRole("link", { name: "Käyttäjät", exact: true }).click();
  await expect(page.getByRole("table")).toContainText("alice");
  await page.getByRole("link", { name: "Levytila", exact: true }).click();
  await expect(page.getByText(/vapaana/)).toBeVisible();
  let releaseServer = () => {};
  const serverReady = new Promise<void>((resolve) => {
    releaseServer = resolve;
  });
  await page.route("**/api/v1/server", async (route) => {
    await serverReady;
    await route.continue();
  });
  await page.goto("/settings/palvelin");
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "Tarkistetaan ylläpito-oikeutta" }),
  ).toBeVisible();
  await expect(
    page.getByText("Ylläpito on vain ylläpitäjille.", { exact: true }),
  ).toHaveCount(0);
  releaseServer();
  await expect(
    page.getByLabel("Palvelimen nimi", { exact: true }),
  ).toBeVisible();
  await page.unroute("**/api/v1/server");
  await page.getByRole("button", { name: /Tilivalikko/ }).click();
  await page.getByRole("menuitem", { name: "Kirjaudu ulos…" }).click();
  await Promise.all([
    page.waitForResponse((r) => r.url().endsWith("/auth/logout")),
    page
      .getByRole("dialog")
      .getByRole("button", { name: "Kirjaudu ulos", exact: true })
      .click(),
  ]);
  await expect(
    page.getByRole("button", { name: "Kirjaudu GitHubilla" }),
  ).toBeVisible();
  await login(page, "Bob");
  await settings(page);
  await expect(
    page.getByRole("link", { name: "Käyttäjät", exact: true }),
  ).toHaveCount(0);
  expect(
    (await page.request.get("/api/v1/server/administration")).status(),
  ).toBe(403);
  expect((await page.request.get("/api/v1/server/storage")).status()).toBe(403);
  for (const path of [
    "/administration",
    "/settings/palvelin",
    "/settings/kayttajat",
    "/settings/levytila",
  ]) {
    await page.goto(path);
    await expect(
      page
        .getByRole("alert")
        .filter({ hasText: "Ylläpito on vain ylläpitäjille" }),
    ).toBeVisible();
    await expect(page.getByRole("table")).toHaveCount(0);
    await expect(
      page.getByLabel("Palvelimen nimi", { exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "Käyttäjät", exact: true }),
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
    page.getByRole("region", { name: "Claude (Pi)", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Agentit", exact: true }).click();
  await page.getByRole("button", { name: "Hallitse kirjautumisia" }).click();
  await expect(
    page.getByRole("heading", { name: "Yhteydet", exact: true }),
  ).toBeFocused();
  await page
    .getByRole("button", { name: "Kirjaudu Claudeen", exact: true })
    .click();
  await expect(
    page.getByRole("link", { name: "Avaa Claude-kirjautuminen" }),
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
          .getByRole("region", { name: "Claude (Pi)", exact: true })
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
  await page
    .getByLabel("Clauden palauttama koodi")
    .fill("synthetic-code#state");
  await page.getByRole("button", { name: "Vahvista Claude-koodi" }).click();
  await expect(page.getByText(/Claude-tilaus on kirjautunut/)).toBeVisible();
  await expect(page.getByLabel("Clauden palauttama koodi")).toHaveCount(0);
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
  await page.getByRole("link", { name: "Agentit", exact: true }).click();
  await page
    .getByRole("button", { name: "Claude-tilaus", exact: true })
    .click();
  await expect(
    page.getByRole("radio", { name: /Claude Fable 5.1/ }),
  ).toBeChecked();
  expect(writes).toEqual([]);
  await page.getByRole("button", { name: "high", exact: true }).click();
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
  await page.getByRole("button", { name: "Avaa navigaatio" }).click();
  await settings(page);
  const claude = page.getByRole("region", { name: "Claude (Pi)", exact: true });
  await expect(claude).toBeVisible();
  await expect(claude.getByRole("status")).toContainText(
    "Claude-kirjautuminen ei ole käytettävissä",
  );
  await expect(
    claude.getByRole("button", { name: "Kirjaudu Claudeen", exact: true }),
  ).toBeDisabled();
  await expect(claude.getByRole("alert")).toHaveCount(0);
  await page.getByRole("button", { name: "← Asetukset", exact: true }).click();
  await page.getByRole("link", { name: "Agentit", exact: true }).click();
  await page.getByRole("button", { name: "Hallitse kirjautumisia" }).click();
  await expect(claude).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Yhteydet", exact: true }),
  ).toBeFocused();
});

// This differs from a canonical deep link: the browser must normalize its
// OAuth return target before the gateway's exact UI allowlist sees it.
test("@account-settings unknown settings link still allows sign-in", async ({
  page,
}) => {
  await page.goto("/settings/tili/");
  await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
  await page.getByRole("link", { name: "Alice", exact: true }).click();
  await expect(page).toHaveURL(/\/workspaces$/);
  await expect(page.getByRole("button", { name: /Tilivalikko/ })).toBeVisible();
});
