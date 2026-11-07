import type { Page } from "@playwright/test";
import { hostOrigin } from "../test-ports.mjs";
import { expect, test } from "./worker-host";

// The administrator's limit on conversations working at once
// (live-conversation-limit-admin) through the real gateway, the synthetic
// broker that keeps root's file, the real daemon controller that reads it,
// and fake Pi children whose turns hold at their first tool.

test.use({
  baseURL: hostOrigin,
  ignoreHTTPSErrors: true,
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
});
test.beforeEach(async ({ page }) => {
  expect(
    (await page.request.get("/fixture/conversations-reset")).status(),
  ).toBe(204);
});
test.afterEach(async ({ page }) => {
  await page.request.get("/fixture/scenario?value=ready");
});

async function signIn(page: Page, code: "42" | "43") {
  await page.goto("/workspaces");
  await page.getByTestId("github-sign-in").click();
  await page
    .getByRole("link")
    .and(page.locator(`a[href*="code=${code}"]`))
    .click();
  await expect(page.getByTestId("account-menu-trigger")).toBeAttached();
}

async function serverArea(page: Page) {
  await page.goto("/settings/experimental");
  const choice = page.getByTestId(
    "experimental-server-settings-own-area-choice",
  );
  await choice.getByTestId("segment-on").click();
  await expect(choice.getByTestId("segment-on")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
}

/** Types a limit into a stepper and waits for the host's confirmation. */
async function setLimit(page: Page, testId: string, value: number) {
  const written = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/v1/server/conversations") &&
      r.request().method() === "PUT",
  );
  await page.getByTestId(`${testId}-input`).fill(String(value));
  await page.getByTestId(`${testId}-input`).press("Enter");
  expect((await written).status()).toBe(200);
}

async function workspaceId(page: Page, name: string) {
  const snapshot = await (await page.request.get("/api/v1/snapshot")).json();
  const workspace = snapshot.workspaces.find(
    (w: { name: string }) => w.name === name,
  );
  expect(workspace, name).toBeDefined();
  return workspace.workspace_id as string;
}

async function busyConversation(page: Page, id: string, text: string) {
  await page.goto(`/workspaces/${id}`);
  await page.getByTestId("conversation-start").click();
  await expect(page.getByTestId("command-palette")).toBeVisible();
  await page.getByTestId("message-input").fill(text);
  await page.getByTestId("send").click();
  await expect(
    page.locator(".ah-turn-reply > .ah-message").last(),
  ).toContainText("Katson ensin, mitä työtilassa on.", { timeout: 20000 });
}

async function refused(page: Page, id: string) {
  await page.goto(`/workspaces/${id}`);
  await page.getByTestId("conversation-start").click();
  const card = page.locator(
    '[data-testid="creation-problem"][data-reason="capacity"]',
  );
  await expect(card).toBeVisible({ timeout: 20000 });
  // No click/scrollIntoView before this assertion: the refusal and its
  // actions must already be on screen when the host refuses creation.
  await expect(card).toBeInViewport({ ratio: 1 });
  await expect(card.getByTestId("retry")).toBeInViewport({ ratio: 1 });
  const bounds = await card.boundingBox();
  const composer = await page.getByTestId("message-input").boundingBox();
  if (!bounds || !composer)
    throw new Error("Missing refusal or composer bounds");
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(composer.y);
  return card;
}

test("@live-limit the administrator's limit refuses at the limit and a stop makes room", async ({
  page,
}) => {
  test.setTimeout(120000);
  await signIn(page, "42");
  await serverArea(page);
  await page.goto("/settings/conversations");
  await expect(page.getByTestId("settings-keskustelut")).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(page.getByTestId("live-memory")).toBeVisible();
  // Nothing set: the daemon's own 32 for both people.
  await expect(page.getByTestId("live-worst")).toContainText("64 keskustelua");
  await setLimit(page, "live-default", 1);
  await setLimit(page, "live-person-bob-limit", 40);
  await expect(page.getByTestId("live-person-bob")).toHaveAttribute(
    "data-own",
    "",
  );
  await page.reload();
  await expect(page.getByTestId("live-default-input")).toHaveValue("1");
  await expect(page.getByTestId("live-person-bob-limit-input")).toHaveValue(
    "40",
  );
  await expect(page.getByTestId("live-person-alice")).not.toHaveAttribute(
    "data-own",
    "",
  );

  expect(
    (await page.request.get("/fixture/scenario?value=pi-visual-hold")).status(),
  ).toBe(204);
  const id = await workspaceId(page, "ordinary-dir");
  await busyConversation(page, id, "Pitkä työ");
  const card = await refused(page, id);
  await expect(card).toContainText(
    "Ylläpitäjän asettama raja on 1 yhtä aikaa työskentelevää keskustelua, ja 1 työskentelee jo.",
  );
  await expect(card.getByTestId("capacity-workspace")).toHaveAttribute(
    "data-workspace",
    "ordinary-dir",
  );
  await expect(card.getByText("Muokkaa")).toHaveCount(0);
  await expect(card.getByTestId("capacity-admin")).toHaveText(
    "Muuta rajaa (ylläpitäjä)",
  );
  await expect(card.getByTestId("capacity-admin")).toBeEnabled();

  // Trying again at the limit says it is still full.
  await card.getByTestId("retry").click();
  await expect(
    page.locator('[data-testid="creation-problem"][data-reason="capacity"]'),
  ).toContainText("Yritit uudelleen: yhä täynnä.", { timeout: 20000 });

  await page.getByTestId("capacity-who").click();
  const window = page.getByTestId("capacity-window");
  await expect(window).toContainText("Työskentelee nyt · 1/1");
  const holder = window.getByTestId("capacity-holder");
  await expect(holder).toHaveAttribute("data-state", "turn");
  await expect(holder).toContainText("Työskentelee");
  await window.getByTestId("capacity-stop").click();
  await expect(holder).toHaveAttribute("data-state", "stopped");
  await window.getByTestId("capacity-close").click();
  const room = page.locator(
    '[data-testid="creation-problem"][data-state="room"]',
  );
  await expect(room).toContainText("Tilaa on nyt", { timeout: 20000 });
  await room.getByTestId("retry").click();
  await expect(page).toHaveURL(/conversation=pi:/, { timeout: 20000 });

  // The administrator's own way from the card to the setting.
  await busyConversation(page, id, "Toinen pitkä työ");
  const again = await refused(page, id);
  await again.getByTestId("capacity-admin").click();
  await expect(page).toHaveURL(/\/settings\/conversations$/);
  await expect(page.getByTestId("live-limits")).toBeVisible();
});

test("@live-limit anyone else sees Change the limit greyed out, explained by the card", async ({
  page,
}) => {
  test.setTimeout(120000);
  await signIn(page, "42");
  await page.goto("/settings/conversations");
  await setLimit(page, "live-person-bob-limit", 1);
  await page.context().clearCookies();
  await signIn(page, "43");
  // The administrator's setting is not Bob's to see.
  expect(
    (await page.request.get("/api/v1/server/conversations")).status(),
  ).toBe(403);
  expect(
    (await page.request.get("/fixture/scenario?value=pi-visual-hold")).status(),
  ).toBe(204);
  const id = await workspaceId(page, "ordinary-dir");
  await busyConversation(page, id, "Pitkä työ");
  const card = await refused(page, id);
  await expect(card).toContainText(
    "Ylläpitäjä on antanut sinulle rajan 1 yhtä aikaa työskentelevää keskustelua",
  );
  const change = card.getByTestId("capacity-admin");
  await expect(change).toHaveText("Muuta rajaa");
  await expect(change).toBeDisabled();
  const described = await change.getAttribute("aria-describedby");
  expect(described).toBeTruthy();
  await expect(page.locator(`[id="${described}"]`)).toContainText(
    "Ylläpitäjä on antanut sinulle rajan 1",
  );
  await expect(card.getByTestId("retry")).toBeEnabled();
});
