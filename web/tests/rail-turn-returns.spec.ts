import type { BrowserContext, Page } from "@playwright/test";
import { hostOrigin } from "../test-ports.mjs";
import { expect, test } from "./worker-host";

test.use({ baseURL: hostOrigin, ignoreHTTPSErrors: true });

async function signIn(page: Page) {
  await page.goto(`${hostOrigin}/workspaces`);
  await page.getByTestId("github-sign-in").click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  await expect(page.getByTestId("workspace-navigation")).toBeVisible();
}

const yours = (page: Page, href: string) =>
  page
    .getByRole("navigation")
    .getByTestId("rail-yours")
    .locator(`a[href="${href}"]`)
    .and(page.getByTestId("agent-link"));

// Seen, a reply waits read in Sinun vuorosi until the person answers or
// says Ei nyt from its rail row (raise-to-your-turn, default since 8.11.).
async function notNow(page: Page, agent: string) {
  const row = page
    .getByRole("navigation")
    .getByTestId("rail-yours")
    .getByTestId(`agent-item-${agent}`);
  await row.hover();
  await row.getByTestId("rail-not-now-conversation").click();
}

const ball = (page: Page, agent: string) =>
  page
    .getByRole("navigation")
    .getByTestId(`agent-item-${agent}`)
    .getByTestId("rail-mark");

async function reply(page: Page, message: string) {
  await page.getByTestId("message-input").fill(message);
  await page
    .getByTestId("send")
    .and(page.locator('[data-mode="send"]'))
    .click();
  await expect(page.getByTestId("message-input")).toBeEnabled();
}

// Jari 2.11.: a conversation once quiet stayed in Hiljaiset when its agent
// finished again. Each finished turn asks for the person as news until seen,
// in a tab that saw the turn end, after a reload, and in a tab opened later;
// seen in one tab of the browser, it is seen (read) in the others, and Ei nyt
// returns it to Hiljaiset everywhere.
test("every finished turn returns a quiet conversation to Sinun vuorosi until seen", async ({
  page,
  context,
  browser,
}) => {
  test.setTimeout(120000);
  await page.request.get("/fixture/scenario?value=ready");
  await signIn(page);
  await page
    .getByRole("navigation")
    .getByTestId("workspace-ordinary-dir")
    .click();
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  await expect(page).toHaveURL(/conversation=pi(?:%3A|:)/);
  const href = new URL(page.url()).pathname + new URL(page.url()).search;
  const agent = new URL(page.url()).searchParams.get("conversation");
  // The person's own turn ends in sight: it is not news, only read. Wait
  // for the answer first; leaving before it is there makes it news.
  await reply(page, "first");
  await expect(page.locator("main")).toContainText('Selvä. Kysyit: "first".');
  await expect(ball(page, agent ?? "")).toHaveAttribute("data-state", "read");
  await notNow(page, agent ?? "");
  await page.goto("/workspaces");
  await expect(
    page.getByRole("navigation").locator(`a[href="${href}"]`),
  ).toBeVisible();
  await expect(yours(page, href)).toHaveCount(0);
  // The agent's next turns finish on another machine, out of this sight.
  const elsewhere: BrowserContext = await browser.newContext({
    ignoreHTTPSErrors: true,
  });
  const writer = await elsewhere.newPage();
  await signIn(writer);
  for (const message of ["second", "third"]) {
    await writer.goto(`${hostOrigin}${href}`);
    await reply(writer, message);
    await writer.goto(`${hostOrigin}/workspaces`);
    await expect(yours(page, href)).toHaveCount(1, { timeout: 25000 });
    await expect(ball(page, agent ?? "")).not.toHaveAttribute(
      "data-state",
      "read",
    );
    // A reload has missed the turn's event and still knows.
    await page.reload();
    await expect(yours(page, href)).toHaveCount(1);
    await expect(ball(page, agent ?? "")).not.toHaveAttribute(
      "data-state",
      "read",
    );
    const later = await context.newPage();
    await later.goto(`${hostOrigin}/workspaces`);
    await expect(yours(later, href)).toHaveCount(1);
    await expect(ball(later, agent ?? "")).not.toHaveAttribute(
      "data-state",
      "read",
    );
    await yours(page, href).click();
    await expect(page.getByTestId("message-input")).toBeVisible();
    await expect(ball(page, agent ?? "")).toHaveAttribute("data-state", "read");
    await expect(ball(later, agent ?? "")).toHaveAttribute(
      "data-state",
      "read",
    );
    await notNow(page, agent ?? "");
    await expect(yours(page, href)).toHaveCount(0);
    await expect(yours(later, href)).toHaveCount(0, { timeout: 15000 });
    await later.close();
    await page.goto("/workspaces");
    await expect(yours(page, href)).toHaveCount(0);
  }
  await elsewhere.close();
});
