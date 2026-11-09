import type { Page } from "@playwright/test";
import { expect, test } from "./lab-host";

// The per-person limit and workspace deletion through the real gateway,
// conversation controller and fake Pi children: only a conversation that is
// doing something holds a place or blocks deletion. Idle Pi children give
// their place up and are stopped by deletion (pi_activity_linux.go).

test.beforeEach(async ({ page }) => {
  expect(
    (await page.request.get("/fixture/conversations-reset")).status(),
  ).toBe(204);
});

async function signIn(page: Page) {
  await page.goto("/workspaces");
  await page
    .getByRole("button")
    .and(page.getByTestId("github-sign-in"))
    .click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  await expect(page.getByRole("navigation").first()).toBeVisible();
}

async function workspaceId(page: Page, name: string) {
  const snapshot = await (await page.request.get("/api/v1/snapshot")).json();
  const workspace = snapshot.workspaces.find(
    (w: { name: string }) => w.name === name,
  );
  expect(workspace, name).toBeDefined();
  return workspace.workspace_id as string;
}

async function startConversation(page: Page, id: string, text: string) {
  await page.goto(`/workspaces/${id}`);
  await page
    .getByRole("button")
    .and(page.getByTestId("conversation-start"))
    .click();
  // Wait past the replaceable local draft before entering native work.
  await expect(page.getByTestId("command-palette")).toBeVisible();
  await page
    .getByRole("textbox")
    .and(page.getByTestId("message-input"))
    .fill(text);
  await page.getByRole("button").and(page.getByTestId("send")).click();
}

const dialog = (page: Page) => page.getByRole("dialog");

// The installation's limit, as the administrator sets it in the server area;
// null gives the daemon its own default again. The lab's person is its
// administrator.
async function setLiveLimit(page: Page, limit: number | null) {
  const session = await (await page.request.get("/auth/session")).json();
  const written = await page.request.put("/api/v1/server/conversations", {
    headers: {
      Origin: new URL(page.url()).origin,
      "X-Agent-Host-CSRF": session.csrf,
    },
    data: { limit },
  });
  expect(written.status()).toBe(200);
}

test("@idle-pi-slots idle conversations neither fill the limit nor block deletion", async ({
  page,
}) => {
  test.setTimeout(120000);
  await signIn(page);
  const id = await workspaceId(page, "muistiinpanot");
  // Five answered conversations: each finished one leaves an idle Pi, and
  // the fifth start takes the place of the longest unused.
  for (let i = 1; i <= 5; i++) {
    await startConversation(page, id, `Tervehdys ${i}`);
    await expect(page.locator("main")).toContainText(
      `Selvä. Kysyit: "Tervehdys ${i}".`,
      { timeout: 20000 },
    );
    await expect(page.getByTestId("creation-problem")).toHaveCount(0);
  }
  // Deletion goes through without archiving anything first.
  await page.goto(`/workspaces/${id}`);
  await page
    .getByRole("button")
    .and(page.getByTestId("delete-workspace"))
    .click();
  await expect(dialog(page).getByRole("heading")).toBeVisible();
  await dialog(page)
    .getByRole("button")
    .and(page.getByTestId("trash-workspace"))
    .click();
  await expect(page.getByTestId("archive-notice")).toBeVisible();
});

test("@idle-pi-slots running turns hold the limit and block deletion by name", async ({
  page,
}) => {
  test.setTimeout(120000);
  // Every fake Pi turn stops at its first tool until the scenario changes.
  expect(
    (await page.request.get("/fixture/scenario?value=pi-visual-hold")).status(),
  ).toBe(204);
  try {
    await signIn(page);
    await setLiveLimit(page, 4);
    const id = await workspaceId(page, "muistiinpanot");
    for (let i = 1; i <= 4; i++) {
      await startConversation(page, id, `Pitkä työ ${i}`);
      await expect(
        page.locator(".ah-turn-reply > .ah-message").last(),
      ).toContainText("Katson ensin, mitä työtilassa on.", { timeout: 20000 });
    }
    // A fifth conversation is refused with the limit's card.
    await page.goto(`/workspaces/${id}`);
    await page
      .getByRole("button")
      .and(page.getByTestId("conversation-start"))
      .click();
    await expect(
      page.locator('[data-testid="creation-problem"][data-reason="capacity"]'),
    ).toBeVisible({ timeout: 20000 });

    // Deletion names each working conversation and links to it.
    await page.goto(`/workspaces/${id}`);
    await page
      .getByRole("button")
      .and(page.getByTestId("delete-workspace"))
      .click();
    await expect(dialog(page).getByRole("heading")).toBeVisible({
      timeout: 20000,
    });
    await expect(dialog(page).getByTestId("workspace-blocker")).toHaveCount(4);
    await expect(
      dialog(page)
        .getByRole("link")
        .and(page.getByTestId("blocker-conversation")),
    ).toHaveCount(4);
    await expect(
      dialog(page)
        .getByRole("link")
        .and(page.getByTestId("blocker-conversation"))
        .first(),
    ).toBeVisible();

    await expect(dialog(page)).toContainText("Pitkä työ 1");

    // Once the turns end, the same check lets the workspace go.
    expect(
      (await page.request.get("/fixture/scenario?value=ready")).status(),
    ).toBe(204);
    await expect(async () => {
      await dialog(page)
        .getByRole("button")
        .and(page.getByTestId("recheck"))
        .click();
      await expect(
        dialog(page)
          .getByRole("button")
          .and(page.getByTestId("trash-workspace")),
      ).toBeVisible({
        timeout: 2000,
      });
    }).toPass({ timeout: 30000 });
    await dialog(page)
      .getByRole("button")
      .and(page.getByTestId("trash-workspace"))
      .click();
    await expect(page.getByTestId("archive-notice")).toBeVisible();
  } finally {
    await page.request.get("/fixture/scenario?value=ready");
    await setLiveLimit(page, null);
  }
});
