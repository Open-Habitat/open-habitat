import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { labOrigin } from "../test-ports.mjs";
import { expect, test } from "./lab-host";

// A conversation started from a start-page goal is named after the goal,
// and the person can name any conversation by hand from its header and from
// the rail (Jari 30.10.2026). The name is Pi's own session name, so it
// survives a reload, and no automatic title replaces it.
test.use({ baseURL: labOrigin, ignoreHTTPSErrors: true });

async function signIn(page: Page) {
  await page.request.get("/fixture/conversations-reset");
  await page.request.get("/fixture/scenario?value=ready");
  await page.goto("/workspaces");
  await page.getByTestId("github-sign-in").click();
  await page.locator('a[href*="code=42"]').click();
}

async function startFromGoal(page: Page, phone = false) {
  if (phone) await page.getByTestId("navigation-open").click();
  await page
    .getByRole("navigation")
    .getByTestId("workspace-aurinkokello")
    .click();
  const goal = page.getByTestId("landing").getByTestId("starting-goal").first();
  // The goal's authored title is repository content, shown unchanged.
  const goalTitle = (await goal.locator("strong").textContent()) ?? "";
  expect(goalTitle).not.toBe("");
  await goal.click();
  await expect(page).toHaveURL(/\?conversation=pi:/);
  const agent = new URL(page.url()).searchParams.get("conversation") ?? "";
  return { goalTitle, agent };
}

async function sendAndSettle(page: Page, text: string) {
  await page.getByTestId("message-input").fill(text);
  await page
    .getByTestId("send")
    .and(page.locator('[data-mode="send"]'))
    .click();
  await expect(page.getByText(/Selvä\. Kysyit/).first()).toBeVisible({
    timeout: 20000,
  });
}

test("@lab @a11y a goal names its conversation and the person renames it in the header and the rail", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page);
  const { goalTitle, agent } = await startFromGoal(page);
  const title = page.getByTestId("workspace-title");
  // Named before the first message, while Pi has no session file yet.
  await expect(title).toHaveText(goalTitle);
  await sendAndSettle(page, "Kartta ei lataudu");
  await page.reload();
  // Now Pi's own session file carries it, and the automatic title yielded.
  await expect(title).toHaveText(goalTitle);

  // The header's title is its own rename control.
  await page.getByTestId("conversation-rename").click();
  const field = page.getByTestId("conversation-name-field");
  await expect(field).toBeFocused();
  await expect(field).toHaveValue(goalTitle);
  const audit = await new AxeBuilder({ page })
    .include(".ah-agent-header")
    .analyze();
  expect(audit.violations).toEqual([]);
  await field.fill("Oma nimi");
  await field.press("Enter");
  await expect(field).toHaveCount(0);
  await expect(title).toHaveText("Oma nimi");
  const row = page.getByTestId(`agent-item-${agent}`);
  await expect(row.locator("a")).toContainText("Oma nimi");

  // Escape keeps the name.
  await page.getByTestId("conversation-rename").click();
  await field.fill("Ei tätä");
  await field.press("Escape");
  await expect(field).toHaveCount(0);
  await expect(title).toHaveText("Oma nimi");

  // From the rail, in place of the row's title.
  await row.hover();
  await row.getByTestId("rail-rename-conversation").click();
  const railField = row.getByTestId("conversation-name-field");
  await expect(railField).toBeFocused();
  await railField.fill("Rivistä annettu");
  await railField.press("Enter");
  await expect(row.locator("a")).toContainText("Rivistä annettu");
  await expect(title).toHaveText("Rivistä annettu");
  // Renaming from the rail does not leave the conversation.
  expect(new URL(page.url()).searchParams.get("conversation")).toBe(agent);

  await page.reload();
  await expect(title).toHaveText("Rivistä annettu");
  await expect(row.locator("a")).toContainText("Rivistä annettu");
});

test("@lab a phone renames from the header menu", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page);
  const { goalTitle } = await startFromGoal(page, true);
  const title = page.getByTestId("workspace-title");
  await expect(title).toHaveText(goalTitle);
  await page.getByTestId("conversation-menu").click();
  await page.getByRole("menuitem").and(page.getByTestId("menu-rename")).click();
  const field = page.getByTestId("conversation-name-field");
  await expect(field).toBeFocused();
  await field.fill("Puhelimella");
  await field.press("Enter");
  await expect(title).toHaveText("Puhelimella");
  // The header stays within the phone's width while it shows the name.
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
