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
  await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
  await page.getByRole("link", { name: "Alice", exact: true }).click();
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
    .getByRole("button", { name: "Aloita uusi agenttikeskustelu" })
    .click();
  await page.getByRole("textbox", { name: "Viesti agentille" }).fill(text);
  await page.getByRole("button", { name: "Lähetä", exact: true }).click();
}

const dialog = (page: Page) => page.getByRole("dialog");
const limit = "Neljä keskustelua työskentelee jo";

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
    await expect(
      page.getByText(`Selvä. Kysyit: "Tervehdys ${i}".`, { exact: false }),
    ).toBeVisible({ timeout: 20000 });
    await expect(page.getByText(limit)).toHaveCount(0);
  }
  // Deletion goes through without archiving anything first.
  await page.goto(`/workspaces/${id}`);
  await page.getByRole("button", { name: "Poista työtila…" }).click();
  await expect(
    dialog(page).getByRole("heading", {
      name: "Siirretäänkö muistiinpanot roskakoriin?",
    }),
  ).toBeVisible();
  await dialog(page)
    .getByRole("button", { name: "Siirrä roskakoriin" })
    .click();
  await expect(page.locator(".ah-archive-notice")).toContainText(
    "Siirretty roskakoriin",
  );
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
    const id = await workspaceId(page, "muistiinpanot");
    for (let i = 1; i <= 4; i++) {
      await startConversation(page, id, `Pitkä työ ${i}`);
      await expect(
        page
          .locator(".ah-turn-reply > .ah-message")
          .filter({ hasText: "Katson ensin, mitä työtilassa on." })
          .last(),
      ).toBeVisible({ timeout: 20000 });
    }
    // A fifth conversation is refused with words the person can act on.
    await page.goto(`/workspaces/${id}`);
    await page
      .getByRole("button", { name: "Aloita uusi agenttikeskustelu" })
      .click();
    const conversation = page.getByRole("region", {
      name: "Keskustelu",
      exact: true,
    });
    await expect(conversation).toContainText(limit, { timeout: 20000 });

    // Deletion names each working conversation and links to it.
    await page.goto(`/workspaces/${id}`);
    await page.getByRole("button", { name: "Poista työtila…" }).click();
    await expect(
      dialog(page).getByRole("heading", {
        name: "Työtilaa muistiinpanot ei voi poistaa nyt",
      }),
    ).toBeVisible({ timeout: 20000 });
    await expect(
      dialog(page).getByText(
        "Agentti työskentelee tämän työtilan keskustelussa.",
      ),
    ).toHaveCount(4);
    await expect(
      dialog(page).getByRole("link", { name: /^Avaa / }),
    ).toHaveCount(4);
    await expect(
      dialog(page).getByRole("link", { name: /^Avaa .*Pitkä työ 1/ }),
    ).toBeVisible();

    // Once the turns end, the same check lets the workspace go.
    expect(
      (await page.request.get("/fixture/scenario?value=ready")).status(),
    ).toBe(204);
    await expect(async () => {
      await dialog(page)
        .getByRole("button", { name: "Tarkista uudelleen" })
        .click();
      await expect(
        dialog(page).getByRole("heading", {
          name: "Siirretäänkö muistiinpanot roskakoriin?",
        }),
      ).toBeVisible({ timeout: 2000 });
    }).toPass({ timeout: 30000 });
    await dialog(page)
      .getByRole("button", { name: "Siirrä roskakoriin" })
      .click();
    await expect(page.locator(".ah-archive-notice")).toContainText(
      "Siirretty roskakoriin",
    );
  } finally {
    await page.request.get("/fixture/scenario?value=ready");
  }
});
