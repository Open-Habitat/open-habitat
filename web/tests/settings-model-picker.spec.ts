import { hostOrigin } from "../test-ports.mjs";
import { expect, type Page, test } from "./worker-host";

test.use({ baseURL: hostOrigin, ignoreHTTPSErrors: true });
async function settings(page: Page) {
  await page.goto("/workspaces");
  await page
    .getByRole("button")
    .and(page.getByTestId("github-sign-in"))
    .click();
  await page.getByRole("link").nth(0).click();
  await page.goto("/settings");
  await page
    .getByRole("link")
    .and(page.getByTestId("settings-tekoaly"))
    .click();
  await expect(
    page.getByRole("radio").and(page.getByTestId("model-gpt-6.1-sol")),
  ).toBeVisible();
}

test("provider browsing never chooses or saves, even with an older first catalog row", async ({
  page,
}) => {
  let writes = 0;
  let initial = "gpt-6.1-sol";
  await page.route("**/api/v1/pi/claude-login", (route) =>
    route.fulfill({ json: { schema_version: 1, state: "completed" } }),
  );
  await page.route("**/api/v1/pi/models", async (route) => {
    if (route.request().method() === "POST") {
      writes++;
      await route.fulfill({ status: 503, body: "unexpected write" });
      return;
    }
    const response = await route.fetch();
    const body = await response.json();
    body.default_provider = "openai-codex";
    body.default_model = initial;
    body.models.unshift(
      body.models.splice(
        body.models.findIndex((m: { id: string }) => m.id === "gpt-5.4"),
        1,
      )[0],
    );
    body.models.push({
      provider: "claude-bridge",
      id: "claude-fable-5-1",
      name: "Claude Fable",
      thinking_levels: ["off"],
    });
    await route.fulfill({ response, json: body });
  });
  await settings(page);
  const sol = page
    .getByRole("radio")
    .and(page.getByTestId("model-gpt-6.1-sol"));
  await expect(sol).toBeChecked();
  const older = page.locator("details.md-more");
  await expect(older).not.toHaveAttribute("open");
  for (let i = 0; i < 2; i++) {
    await page
      .getByRole("button")
      .and(page.getByTestId("segment-claude-bridge"))
      .click();
    await expect(
      page.getByRole("radio").and(page.getByTestId("model-claude-fable-5-1")),
    ).not.toBeChecked();
    await page
      .getByRole("button")
      .and(page.getByTestId("segment-openai-codex"))
      .click();
    await expect(sol).toBeChecked();
    await expect(older).not.toHaveAttribute("open");
  }
  expect(writes).toBe(0);
  await page.getByTestId("older-models-toggle").click();
  await expect(older).toHaveAttribute("open");
  initial = "gpt-5.4";
  await page.reload();
  await page
    .getByRole("link")
    .and(page.getByTestId("settings-tekoaly"))
    .click();
  await expect(
    page.getByRole("radio").and(page.getByTestId("model-gpt-5.4")),
  ).toBeChecked();
  await expect(older).toHaveAttribute("open");
});

test("a model choice shows at once with its thinking levels, Pi confirms in the background, and a refusal reverts it", async ({
  page,
}) => {
  await settings(page);
  const sol = page
    .getByRole("radio")
    .and(page.getByTestId("model-gpt-6.1-sol"));
  const nova = page
    .getByRole("radio")
    .and(page.getByTestId("model-gpt-6-nova"));
  const high = page.getByRole("button").and(page.getByTestId("segment-high"));
  const releases: (() => void)[] = [];
  let fail = false;
  let writes = 0;
  await page.route("**/api/v1/pi/models", async (route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }
    writes++;
    await new Promise<void>((resolve) => releases.push(resolve));
    if (fail) await route.fulfill({ status: 503, body: "unavailable" });
    else {
      const response = await route.fetch();
      await route.fulfill({ response });
    }
  });
  const release = async (n: number) => {
    await expect.poll(() => releases.length).toBe(n);
    releases[n - 1]();
  };
  await sol.click();
  // The choice and its thinking levels are usable before Pi answers
  // (Jari 17.10.2026: levels are known with the catalog).
  await expect(sol).toBeChecked();
  await expect(nova).toBeEnabled();
  await expect(high).toBeEnabled();
  await high.click();
  await expect(high).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("alert")).toHaveCount(0);
  // Only one write is outstanding; the newer choice waits and supersedes.
  expect(writes).toBe(1);
  // The rest of settings stays responsive while the host is outstanding.
  await page
    .getByRole("button")
    .and(page.getByTestId("segment-visible"))
    .click();
  await expect(page.getByTestId("model-save-state")).toHaveAttribute(
    "data-pending",
    "true",
  );
  await expect(page.getByTestId("model-save-state")).toBeVisible();
  await release(1);
  await release(2);
  await expect(page.getByTestId("model-save-state")).toHaveAttribute(
    "data-pending",
    "false",
  );
  await expect(sol).toBeChecked();
  await expect(high).toHaveAttribute("aria-pressed", "true");
  expect(writes).toBe(2);
  fail = true;
  await nova.click();
  await expect(nova).toBeChecked();
  await release(3);
  // An unconfirmed reply rereads Pi's default: Pi kept Sol, so it reverts.
  await expect(page.getByTestId("model-save-refused")).toBeVisible();
  await expect(sol).toBeChecked();
  await expect(high).toHaveAttribute("aria-pressed", "true");
  expect(writes).toBe(3);
  const saved = await (await page.request.get("/api/v1/pi/models")).json();
  expect(saved.default_model).toBe("gpt-6.1-sol");
  expect(saved.default_thinking).toBe("high");
  await page.reload();
  await page
    .getByRole("link")
    .and(page.getByTestId("settings-tekoaly"))
    .click();
  await expect(sol).toBeChecked();
  await expect(high).toHaveAttribute("aria-pressed", "true");
});

test("unsigned Claude is unavailable despite catalog entries; connections link", async ({
  page,
}) => {
  await page.route("**/api/v1/pi/claude-login", (route) =>
    route.fulfill({ json: { schema_version: 1, state: "missing" } }),
  );
  await page.route("**/api/v1/pi/models", async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    body.models.push({
      provider: "claude-bridge",
      id: "claude-fable-5-1",
      name: "Claude Fable",
      thinking_levels: ["off"],
    });
    await route.fulfill({ response, json: body });
  });
  await settings(page);
  await expect(
    page.getByRole("button").and(page.getByTestId("segment-claude-bridge")),
  ).toBeDisabled();
  await expect(page.getByTestId("claude-provider-unavailable")).toBeVisible();
  // The link lands on the Claude row itself, which takes focus.
  await page
    .getByTestId("claude-provider-unavailable")
    .getByRole("link")
    .and(page.getByTestId("settings-claude"))
    .click();
  await expect(page).toHaveURL(/\/settings\/ai#claude$/);
  await expect(
    page.getByRole("region").and(page.getByTestId("claude-sign-in")),
  ).toBeFocused();
});
