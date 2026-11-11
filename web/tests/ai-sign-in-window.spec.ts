import type { Page, Route } from "@playwright/test";
import { hostOrigin } from "../test-ports.mjs";
import { expect, test } from "./worker-host";

test.use({ baseURL: hostOrigin, ignoreHTTPSErrors: true });

// proto-ai-sign-in-expired, R1: Claude refuses the stored sign-in. The
// failed turn is a short row, the warning sits above the field, the message
// waits in the field, and once the person signs in in the window over the
// conversation every waiting message goes, the edited one as edited and the
// one in another Claude conversation although it is not open.

async function signIn(page: Page) {
  await page.request.get("/fixture/conversations-reset");
  await page.request.get("/fixture/scenario?value=ready");
  await page.goto("/workspaces");
  await page.getByTestId("github-sign-in").click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
}
async function newConversation(page: Page) {
  await page
    .getByTestId("workspace-navigation")
    .getByTestId("workspace-ordinary-dir")
    .click();
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  await expect(page).toHaveURL(/conversation=pi(?:%3A|:)/);
  return page.url();
}
const send = (page: Page) =>
  page.getByTestId("send").and(page.locator('[data-mode="send"]')).click();

/** Claude's own sign-in, as the daemon's claude-login route answers it; the
 * code's confirmation is the sign-in, which ends the fixture's refusal. */
async function claudeLogin(page: Page) {
  let state = "completed";
  const attempt = "20261106T120000.000000001";
  await page.route("**/api/v1/pi/claude-login", async (route: Route) => {
    const method = route.request().method();
    if (method === "POST") state = "code";
    if (method === "PUT") {
      await page.request.get("/fixture/ai-refused?value=off");
      state = "completed";
    }
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        schema_version: 1,
        state,
        attempt_id: attempt,
        ...(state === "code"
          ? {
              verification_uri:
                "https://claude.com/cai/oauth/authorize?code=true&state=synthetic",
            }
          : {}),
      }),
    });
  });
}

test("@ai-sign-in an expired Claude sign-in is repaired in the window and the waiting messages go", async ({
  page,
}) => {
  await signIn(page);
  await page.request.get("/fixture/ai-refused?value=claude");

  // The other Claude conversation fails first; a send while refused waits.
  const other = await newConversation(page);
  await page.getByTestId("message-input").fill("Korjaa kesäajan testit.");
  await send(page);
  await expect(page.getByTestId("ai-sign-in-warning")).toHaveAttribute(
    "data-state",
    "claude-bridge",
  );
  await expect(page.getByTestId("message-input")).toHaveValue(
    "Korjaa kesäajan testit.",
  );
  await page.getByTestId("message-input").fill("Aja myös kaikki testit.");
  await send(page);
  await expect(page.getByTestId("message-input")).toHaveValue(
    "Aja myös kaikki testit.",
  );
  await expect(page.getByTestId("composer-waiting")).toContainText(
    "Odottaa kentässä",
  );

  // The conversation where the person signs in.
  const here = await newConversation(page);
  await page.getByTestId("message-input").fill("Kirjaa tunnit.");
  await send(page);
  const turn = page.getByTestId("agent-turn").last();
  await expect(turn.getByTestId("turn-short")).toHaveText(
    "Claude-kirjautuminen on vanhentunut. Viestiäsi ei käsitelty.",
  );
  await expect(page.locator("main")).not.toContainText("OAuth session");
  const warning = page.getByTestId("ai-sign-in-warning");
  await expect(warning).toContainText("Claude-kirjautuminen on vanhentunut");
  await expect(page.getByTestId("message-input")).toHaveValue("Kirjaa tunnit.");
  await expect(page.getByTestId("composer-waiting")).toContainText(
    "lähtee itse heti, kun olet kirjautunut",
  );
  await page.getByTestId("message-input").fill("Kirjaa tunnit. Kiitos!");
  await expect(page.getByTestId("composer-waiting")).toContainText("Muokattu");

  await claudeLogin(page);

  await warning.getByTestId("ai-sign-in-fix").click();
  const window = page.getByTestId("sign-in-window");
  await expect(window).toHaveAttribute("data-state", "claude-bridge");
  const waiting = window.getByTestId("window-waiting").locator("li");
  await expect(waiting).toHaveCount(2);
  await expect(window.getByTestId("window-waiting")).toContainText("muokattu");
  await window.getByTestId("claude-code-input").fill("synthetic-code#state");
  // Until a status read after the resend is answered, the status held
  // still reports the refusal; under load history can show the resent
  // message first. Held so, that message must not come back into the field.
  let historyShowsResend!: () => void;
  const resendInHistory = new Promise<void>((resolve) => {
    historyShowsResend = resolve;
  });
  page.on("response", async (response) => {
    if (!/\/api\/v1\/agents\/[^/]+\/history\b/.test(response.url())) return;
    const body = await response.text().catch(() => "");
    if (body.includes('"Kirjaa tunnit. Kiitos!"')) historyShowsResend();
  });
  await page.route("**/api/v1/conversations/*/status*", async (route) => {
    const response = await route.fetch();
    await resendInHistory;
    await route.fulfill({ response });
  });
  await window.getByTestId("claude-code-confirm").click();
  await expect(window).toHaveCount(0);

  // The edited message went here, as it was.
  await expect(page.getByTestId("ai-sign-in-ok")).toContainText(
    "Claude-tilaus kirjautunut. Viestisi lähti.",
  );
  await expect(page.getByTestId("ai-sign-in-warning")).toHaveCount(0);
  await expect(page.getByTestId("message-input")).toHaveValue("");
  await expect(page.locator("main")).toContainText(
    'Kysyit: "Kirjaa tunnit. Kiitos!"',
  );
  expect(page.url()).toBe(here);

  // And the other conversation's, although it was not open.
  await page.goto(other);
  await expect(page.locator("main")).toContainText(
    'Kysyit: "Aja myös kaikki testit."',
  );
  await expect(page.getByTestId("message-input")).toHaveValue("");
  await expect(page.getByTestId("ai-sign-in-warning")).toHaveCount(0);
});

test("@ai-sign-in Settings does not call a refused Claude sign-in signed in", async ({
  page,
}) => {
  await signIn(page);
  await page.request.get("/fixture/ai-refused?value=claude");
  await newConversation(page);
  await page.getByTestId("message-input").fill("Kirjaa tunnit.");
  await send(page);
  await expect(page.getByTestId("ai-sign-in-warning")).toBeVisible();
  await page.route("**/api/v1/pi/claude-login", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ schema_version: 1, state: "completed" }),
    }),
  );
  await page.goto("/settings/ai");
  const row = page.getByTestId("claude-sign-in");
  await expect(row.getByTestId("claude-refused")).toHaveText("Hylätty");
  await expect(row.getByTestId("claude-login-state")).toContainText("hylkäsi");
  // The bell says it too, with the same repair. Settings carries it while
  // the app rail gives Settings its room.
  await page.locator('[data-testid="status-bell"]:visible').click();
  await page.getByTestId("status-ai-fix").click();
  await expect(page.getByTestId("sign-in-window")).toHaveAttribute(
    "data-state",
    "claude-bridge",
  );
});
