import type { Page } from "@playwright/test";
import { hostOrigin } from "../test-ports.mjs";
import { expect, test } from "./worker-host";

// The ⌘K / Ctrl+K switcher (prototype round 3, 1 Keskustelut) against the
// real gateway and daemon: the person's daemon builds its search index over
// an invented home's Pi histories and answers through the gateway.
const long = "pi:11111111-1111-4111-8111-111111111111";
const other = "pi:33333333-3333-4333-8333-000000000002";
test.use({
  baseURL: hostOrigin,
  ignoreHTTPSErrors: true,
  viewport: { width: 1440, height: 900 },
});

async function signIn(page: Page) {
  expect(
    (await page.request.get("/fixture/history?mode=search")).status(),
  ).toBe(204);
  await page.goto("/");
  await page.getByTestId("github-sign-in").click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  await expect(page.getByTestId("workspace-navigation")).toContainText("Alice");
}

const switcherKey = (page: Page) =>
  page.keyboard.press(process.platform === "darwin" ? "Meta+K" : "Control+K");

test("@switcher-search Ctrl+K searches messages, expands, jumps to the hit and swaps two", async ({
  page,
}) => {
  await signIn(page);
  await page.goto(`/agents/${long}`);
  await expect(page.locator(".ah-feed")).toContainText(
    "Synteettinen vastaus 159.",
  );

  // A name: the other conversation is found from the snapshot and opened.
  await switcherKey(page);
  const input = page.getByTestId("switcher-input");
  await expect(input).toBeFocused();
  await input.fill("Arkistoitava 2");
  // A one-letter word is not matched, so all three "Arkistoitava" are found.
  await page.getByTestId(`switcher-row-c-${other}`).click();
  await expect(page).toHaveURL(new RegExp(`/agents/${other}$`));
  await expect(page.getByTestId("switcher")).toHaveCount(0);

  // An empty query chooses the previous conversation: ⌘K Enter swaps two.
  await switcherKey(page);
  const previous = page.getByTestId(`switcher-row-c-${long}`);
  await expect(previous).toHaveAttribute("aria-selected", "true");
  await expect(previous).toContainText("edellinen");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(new RegExp(`/agents/${long}$`));

  // Messages: one row per conversation with its best sentence, more hits
  // as a count that → opens and ← folds. Thinking is not searched.
  await switcherKey(page);
  await input.fill("kartta");
  const row = page.getByTestId(`switcher-row-c-${long}`);
  await expect(row).toContainText("Lisäsin välimuistin karttatiilille.");
  await expect(row.locator("mark").first()).toHaveText("karttatiilille");
  await expect(page.getByTestId(`switcher-more-c-${long}`)).toContainText(
    "+2 osumaa",
  );
  await expect(page.getByTestId(`switcher-row-c-${other}`)).toHaveCount(0);
  await page.keyboard.press("ArrowRight");
  await expect(
    page.getByTestId(`switcher-row-h-${long}-search150-user`),
  ).toBeVisible();
  await expect(
    page.getByTestId(`switcher-row-h-${long}-search003-user`),
  ).toBeVisible();
  await page.keyboard.press("ArrowLeft");
  await expect(
    page.getByTestId(`switcher-row-h-${long}-search150-user`),
  ).toHaveCount(0);
  await expect(row).toHaveAttribute("aria-selected", "true");

  // Enter opens the conversation at the shown sentence: two pages back,
  // in the middle of the view, outlined, the words marked and a band.
  await page.keyboard.press("Enter");
  const band = page.getByTestId("jump-band");
  await expect(band).toContainText("Hakuosuma ”kartta” · Agentti");
  const target = page.locator(".ah-search-target");
  await expect(target).toContainText("Lisäsin välimuistin karttatiilille.");
  await expect(target).toBeInViewport();
  expect(
    await page.evaluate(() => {
      const registry = (
        CSS as unknown as { highlights?: Map<string, { size: number }> }
      ).highlights;
      return registry?.get("ah-search-hit")?.size ?? -1;
    }),
  ).toBeGreaterThan(0);
  await page.getByTestId("jump-close").click();
  await expect(band).toHaveCount(0);
  await expect(page.locator(".ah-search-target")).toHaveCount(0);

  // After a jump ⌘K opens empty, with the search to continue.
  await switcherKey(page);
  await expect(input).toHaveValue("");
  await expect(page.getByTestId("switcher-row-continue")).toContainText(
    "kartta",
  );
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("switcher")).toHaveCount(0);

  // / opens it outside text fields; nothing found says so.
  await page.evaluate(() =>
    (document.activeElement as HTMLElement | null)?.blur(),
  );
  await page.keyboard.press("/");
  await input.fill("laskutus");
  await expect(page.getByTestId("switcher-empty")).toContainText("laskutus");
});

test("@switcher-search the rail's door opens a full-screen sheet on a phone", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page);
  await page.goto(`/agents/${long}`);
  await page.getByTestId("navigation-open").click();
  await page.getByTestId("search-door").click();
  const sheet = page.getByTestId("switcher");
  await expect(sheet).toBeVisible();
  const box = await sheet.boundingBox();
  expect(box?.width).toBe(390);
  await page.getByTestId("switcher-input").fill("tilikartta");
  await page.getByTestId(`switcher-row-c-${long}`).click();
  await expect(page.locator(".ah-search-target")).toContainText(
    "Päivitä vielä tilikartta.",
  );
});

test("@switcher-search a hit in a browser conversation opens it at the message", async ({
  page,
}) => {
  await signIn(page);
  await page
    .getByRole("navigation")
    .getByTestId("workspace-ordinary-dir")
    .click();
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  await page.getByTestId("message-input").fill("Tarkista sanaston tilikartat");
  await page
    .getByTestId("send")
    .and(page.locator('[data-mode="send"]'))
    .click();
  await expect(page.getByTestId("agent-turn").first()).toContainText(
    "Selvä. Kysyit:",
    {
      timeout: 30000,
    },
  );
  const conversation = new URL(page.url()).searchParams.get("conversation");
  expect(conversation).toMatch(/^pi:/);
  await page.goto(`/agents/${long}`);
  await expect(page.locator(".ah-feed")).toContainText(
    "Synteettinen vastaus 159.",
  );
  await switcherKey(page);
  await page.getByTestId("switcher-input").fill("sanaston");
  const row = page.getByTestId(`switcher-row-c-${conversation}`);
  // The index may still be reading; the list asks again until it has it.
  await expect(row).toContainText("sanaston", { timeout: 15000 });
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(new RegExp(`conversation=${conversation}`));
  await expect(page.getByTestId("jump-band")).toContainText(
    "Hakuosuma ”sanaston”",
  );
  await expect(page.locator(".ah-search-target")).toContainText("sanaston");
  await expect(page.getByTestId("message-input")).toBeFocused();
});
