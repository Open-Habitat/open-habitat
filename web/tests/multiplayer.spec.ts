import type { Browser, Page } from "@playwright/test";
import { hostOrigin } from "../test-ports.mjs";
import { expect, test } from "./worker-host";

// Other people in a conversation (ADR 0038), through the real gateway, the
// owner's real daemon with its guest socket and route table, and the fake
// Pi's stand-in for the companion's bridge (fakepi_bridge.go). Alice owns the
// conversation; Bob, the other synthetic person on the server, participates.
// Host-backed synthetic evidence: both people run under the test's own UID.

test.use({
  baseURL: hostOrigin,
  ignoreHTTPSErrors: true,
  viewport: { width: 1280, height: 900 },
});
test.beforeEach(async ({ page }) => {
  expect(
    (await page.request.get("/fixture/conversations-reset")).status(),
  ).toBe(204);
});

async function signIn(page: Page, code: "42" | "43") {
  await page.goto("/workspaces");
  await page.getByTestId("github-sign-in").click();
  await page
    .getByRole("link")
    .and(page.locator(`a[href*="code=${code}"]`))
    .click();
  await expect(page.getByTestId("account-menu-trigger")).toBeAttached();
  const session = await (await page.request.get("/auth/session")).json();
  const response = await page.request.put("/api/v1/account/preferences", {
    headers: {
      Origin: new URL(page.url()).origin,
      "X-Agent-Host-CSRF": session.csrf,
    },
    data: { experimental: { multiplayer: true } },
  });
  expect(response.ok()).toBe(true);
}

async function bobPage(browser: Browser) {
  const context = await browser.newContext({
    baseURL: hostOrigin,
    ignoreHTTPSErrors: true,
    viewport: { width: 1280, height: 900 },
    locale: "fi-FI",
  });
  const page = await context.newPage();
  await signIn(page, "43");
  return page;
}

/** Alice opens a conversation and the agent answers her once. */
async function aliceConversation(page: Page) {
  await signIn(page, "42");
  const snapshot = await (await page.request.get("/api/v1/snapshot")).json();
  const workspace = snapshot.workspaces.find(
    (w: { name: string }) => w.name === "ordinary-dir",
  );
  await page.goto(`/workspaces/${workspace.workspace_id}`);
  await page.getByTestId("conversation-start").click();
  await page.getByTestId("message-input").fill("Mitä täällä on?");
  await page.getByTestId("send").click();
  await expect(page).toHaveURL(/conversation=pi:|\/agents\/pi:/, {
    timeout: 20000,
  });
  await expect(page.locator(".ah-turn-reply").last()).toBeVisible({
    timeout: 20000,
  });
  await expect(page.getByTestId("people-band")).toBeVisible();
}

/** Alice invites Bob; Bob finds it under Jaettu kanssasi and joins. */
async function inviteAndJoin(alice: Page, bob: Page) {
  await alice.getByTestId("people-invite").click();
  const dialog = alice.getByTestId("invite-dialog");
  const row = dialog
    .getByTestId("invite-person")
    .filter({ hasText: "Bob Example" });
  await expect(row).toBeVisible();
  await row.getByTestId("invite-person-add").click();
  await expect(row).toContainText("Kutsuttu");
  await dialog.getByTestId("invite-dialog-close").click();
  await expect(
    alice.locator('.ah-mp-band [data-presence="invited"]'),
  ).toHaveCount(1);

  await bob.goto("/workspaces");
  const item = bob.getByTestId("shared-with-you-item");
  await expect(item).toHaveAttribute("data-state", "invited");
  await expect(item).toContainText("Alice Example");
  await item.click();
  const invite = bob.getByTestId("shared-invite");
  await expect(invite).toContainText("Alice Example kutsui sinut");
  // Nothing of the conversation before joining.
  await expect(bob.getByTestId("shared-feed")).toHaveCount(0);
  await bob.getByTestId("shared-join").click();
  await expect(bob.getByTestId("shared-conversation")).toBeVisible();
  await expect(bob.getByTestId("shared-feed")).toContainText("Mitä täällä on?");
  // Alice's message carries her name, not "Sinä", in Bob's view.
  await expect(bob.getByTestId("shared-feed")).toContainText("Alice Example");
  await expect(bob.locator(".ah-crow-attach")).toHaveCount(0);
  await expect(bob.getByTestId("shared-strip")).toHaveAttribute(
    "data-mode",
    "text_only",
  );
  // Habitat's line, written into Alice's Pi once it is idle.
  await expect(
    alice.locator('[data-testid="habitat-line"][data-event="joined"]'),
  ).toContainText("Bob Example liittyi", { timeout: 20000 });
}

test("@multiplayer a participant's request waits for the owner, who approves each call with its full arguments", async ({
  page: alice,
  browser,
}) => {
  test.setTimeout(120000);
  const bob = await bobPage(browser);
  await aliceConversation(alice);
  await inviteAndJoin(alice, bob);

  // Bob writes; the agent answers him with text only.
  await bob.getByTestId("message-input").fill("Listaatko tiedostot?");
  await bob.getByTestId("send").click();
  const bobMessage = bob.getByTestId("participant-message").last();
  await expect(bobMessage).toContainText("Listaatko tiedostot?", {
    timeout: 20000,
  });
  await expect(bobMessage).toContainText("Bob Example (Sinä)");
  await expect(bob.getByTestId("shared-feed")).toContainText(
    "Vastaan vain tekstillä",
    { timeout: 20000 },
  );
  await expect(bob.getByTestId("shared-strip-waiting")).toContainText(
    "odottaa omistajan päätöstä",
  );

  // Alice sees his message attributed and the card where the agent stopped.
  await expect(alice.getByTestId("participant-message").last()).toContainText(
    "Bob Example",
    { timeout: 20000 },
  );
  const card = alice.getByTestId("waiting-card");
  await expect(card).toContainText("Pyytäjä: Bob Example", { timeout: 20000 });
  await card.getByTestId("waiting-approve-each").click();

  // One call at a time, with the whole multi-line command.
  const approval = alice.getByTestId("approval-card");
  await expect(approval).toBeVisible({ timeout: 20000 });
  await expect(approval.getByTestId("approval-arguments")).toContainText(
    "ls -la\nwc -l README.md",
  );
  await expect(bob.getByTestId("shared-strip-asked")).toBeVisible({
    timeout: 20000,
  });
  // Participants never get the approval's buttons.
  await expect(bob.getByTestId("approval-card")).toHaveCount(0);
  await approval.getByTestId("approval-allow").click();
  await expect(alice.getByTestId("approval-card")).toHaveCount(0, {
    timeout: 20000,
  });
  await expect(
    alice.locator('[data-testid="habitat-line"][data-kind="continue"]'),
  ).toBeVisible({ timeout: 20000 });
  await expect(alice.getByTestId("waiting-card")).toHaveCount(0);
  // Bob reads the same outcome: the line, the tool row and the answer.
  await expect(bob.getByTestId("shared-feed")).toContainText(
    "Jatkoin pyyntöä.",
    { timeout: 20000 },
  );
  await expect(bob.getByTestId("shared-strip-waiting")).toHaveCount(0);
  await bob.context().close();
});

test("@multiplayer full rights name what is lent, are taken back at once, and removal ends the participant's view", async ({
  page: alice,
  browser,
}) => {
  test.setTimeout(120000);
  const bob = await bobPage(browser);
  await aliceConversation(alice);
  await inviteAndJoin(alice, bob);

  await alice.getByTestId("people-band-open").click();
  const panel = alice.getByTestId("people-panel");
  const member = panel
    .getByTestId("people-member")
    .filter({ hasText: "Bob Example" });
  await member.getByTestId("people-full-rights").click();
  const confirm = alice.getByTestId("full-rights-confirm");
  await expect(confirm).toContainText(
    "Annetaanko henkilölle Bob Example täydet oikeudet?",
  );
  for (const lent of ["tiedostojasi", "GitHub-tiliäsi", "omia koneitasi"])
    await expect(confirm).toContainText(lent);
  await confirm.getByTestId("full-rights-confirm-give").click();
  await expect(confirm).toHaveCount(0);
  await expect(
    alice.locator(
      '[data-testid="habitat-line"][data-event="full_rights_given"]',
    ),
  ).toBeVisible({ timeout: 20000 });
  await expect(alice.getByTestId("people-band")).toContainText(
    "Täydet oikeudet",
  );
  await expect(bob.getByTestId("shared-strip")).toHaveAttribute(
    "data-mode",
    "tools",
    { timeout: 20000 },
  );

  // With full rights, Bob's message has the agent start two background
  // processes as Alice's user (the fake Pi's process tool and registry).
  await bob.getByTestId("message-input").fill("Käynnistä esikatselu");
  await bob.getByTestId("send").click();
  await expect(bob.getByTestId("shared-feed")).toContainText(
    "Käynnistin esikatselun",
    { timeout: 20000 },
  );

  // Taking the rights back is one press. The card lists the processes his
  // turn started, each identified by its command and his message; nothing
  // is stopped by itself.
  await alice.getByTestId("people-band-open").click();
  await panel
    .getByTestId("people-member")
    .filter({ hasText: "Bob Example" })
    .getByTestId("people-take-back")
    .click();
  const takeBack = alice.getByTestId("take-back-card");
  await expect(takeBack).toHaveAttribute("data-state", "open");
  const rows = takeBack.getByTestId("take-back-process");
  await expect(rows).toHaveCount(2, { timeout: 20000 });
  const preview = rows.filter({ hasText: "npm run preview" });
  const watcher = rows.filter({ hasText: "npm test -- --watch" });
  // His own words are quoted as the turn's origin.
  await expect(preview.locator("q")).toHaveText("Käynnistä esikatselu");
  await expect(preview.getByTestId("take-back-output")).toHaveAttribute(
    "data-printing",
    "true",
  );
  await expect(bob.getByTestId("shared-strip")).toHaveAttribute(
    "data-mode",
    "text_only",
    { timeout: 20000 },
  );
  // Participants never see the offer.
  await expect(bob.getByTestId("take-back-card")).toHaveCount(0);

  // Stop one: the row stays struck through, and everybody reads the line.
  await preview.getByTestId("take-back-process-stop").click();
  await expect(preview).toHaveAttribute("data-state", "stopped", {
    timeout: 20000,
  });
  await expect(watcher).toHaveAttribute("data-state", "live");
  const stopLine = '[data-testid="habitat-line"][data-kind="process_stopped"]';
  await expect(alice.locator(stopLine)).toContainText("npm run preview", {
    timeout: 20000,
  });
  await expect(bob.locator(stopLine)).toContainText("npm run preview", {
    timeout: 20000,
  });

  // Leaving the rest running folds the card; the band keeps reminding and
  // brings the card back.
  const reminder = alice.getByTestId("take-back-reminder");
  await expect(reminder).toBeVisible();
  await takeBack.getByTestId("take-back-leave").click();
  await expect(takeBack).toHaveAttribute("data-state", "left");
  await expect(takeBack).toContainText("npm test -- --watch");
  await expect(reminder).toBeVisible();
  await reminder.click();
  await expect(takeBack).toHaveAttribute("data-state", "open");
  await watcher.getByTestId("take-back-process-stop").click();
  await expect(takeBack).toHaveAttribute("data-state", "resolved", {
    timeout: 20000,
  });
  await expect(reminder).toHaveCount(0);
  await takeBack.getByTestId("take-back-close").click();
  await expect(alice.getByTestId("take-back-card")).toHaveCount(0);

  // Removal: Bob's open view ends and the share leaves his rail.
  await alice.getByTestId("people-band-open").click();
  await panel
    .getByTestId("people-member")
    .filter({ hasText: "Bob Example" })
    .getByTestId("people-remove")
    .click();
  await expect(alice.getByTestId("take-back-card")).toContainText(
    "Poistit henkilön Bob Example keskustelusta",
  );
  await expect(bob.getByTestId("shared-unavailable")).toBeVisible({
    timeout: 30000,
  });
  await bob.goto("/workspaces");
  await expect(bob.getByTestId("account-menu-trigger")).toBeAttached();
  await expect(bob.getByTestId("shared-with-you")).toHaveCount(0);
  await bob.context().close();
});
