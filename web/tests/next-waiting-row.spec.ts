import AxeBuilder from "@axe-core/playwright";
import { hostOrigin } from "../test-ports.mjs";
import { expect, type Page, test } from "./worker-host";

// Seuraava odottava, Työssä (next-waiting-row-experimental): behind its
// Kokeelliset ominaisuudet switch, the next conversation waiting for the
// person is a line above the composer once the host confirms the agent works.
test.use({
  baseURL: hostOrigin,
  ignoreHTTPSErrors: true,
  viewport: { width: 1280, height: 900 },
  deviceScaleFactor: 2,
});

const evidence = "../issues/next-waiting-row-experimental/evidence";
const capture = !!process.env.OH_VISUAL_CAPTURE;

const conversationOf = (href: string) =>
  new URL(href, hostOrigin).searchParams.get("conversation");

async function startAndSend(page: Page, message: string) {
  await page
    .getByRole("navigation")
    .getByTestId("workspace-ordinary-dir")
    .click();
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  await expect(page).toHaveURL(/conversation=pi(?:%3A|:)/);
  await expect(
    page
      .locator(".ah-agent-header")
      .getByTestId(/^(archive-conversation|dialog-close)$/),
  ).toBeVisible();
  const url = new URL(page.url());
  await send(page, message);
  return url.pathname + url.search;
}

async function send(page: Page, message: string) {
  await page.getByTestId("message-input").fill(message);
  await expect(page.getByTestId("message-input")).toHaveValue(message);
  await page
    .getByTestId("send")
    .and(page.locator('[data-mode="send"]'))
    .click();
}

test("@next-waiting-row the next waiting conversation shows above the composer on the host's working confirmation, only when switched on", async ({
  page,
  context,
}) => {
  test.setTimeout(120000);
  await page.request.get("/fixture/scenario?value=ready");
  await page.goto("/workspaces");
  await page.getByTestId("github-sign-in").click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  const yours = page
    .getByRole("navigation")
    .getByTestId("rail-yours")
    .getByRole("link")
    .and(page.getByTestId("agent-link"));
  // Two replies the person has not read, written from another tab.
  const writer = await context.newPage();
  for (const [i, message] of [
    "ensimmäinen vastaus",
    "toinen vastaus",
  ].entries()) {
    await writer.goto(`${hostOrigin}/workspaces`);
    await startAndSend(writer, message);
    await expect(writer.getByTestId("message-input")).toBeEnabled();
    await expect(yours).toHaveCount(i + 1, { timeout: 25000 });
  }
  await writer.close();
  await page.bringToFront();

  const row = page.getByTestId("next-waiting");
  const stop = page
    .getByTestId("composer-stop")
    .and(page.locator('[data-stop-target="agent"]'));
  // Off (the default): the agent works and nothing of the feature shows.
  const here = await startAndSend(page, "hidas ensimmäinen vuoro");
  await expect(stop).toBeVisible();
  await expect(row).toHaveCount(0);
  await expect(stop).toHaveCount(0, { timeout: 30000 });
  await expect(row).toHaveCount(0);

  // On: switched in Kokeelliset ominaisuudet, confirmed by the daemon. The
  // unread replies are this tab's memory, so the settings open in the app,
  // not by a page load.
  await page
    .getByRole("button")
    .and(page.getByTestId("account-menu-trigger"))
    .click();
  await page
    .getByRole("menuitem")
    .and(page.getByTestId("menu-settings"))
    .click();
  await page
    .getByRole("navigation")
    .and(page.getByTestId("settings-navigation"))
    .getByRole("link")
    .and(page.getByTestId("settings-kokeelliset"))
    .click();
  const card = page
    .getByRole("region")
    .and(page.getByTestId("experimental-next-waiting-row"));
  await expect(card).toBeVisible();
  await expect(card.getByText(/^Tulossa/)).toHaveCount(0);
  const on = card
    .getByRole("group")
    .and(page.getByTestId("experimental-next-waiting-row-choice"))
    .getByRole("button")
    .and(page.getByTestId("segment-on"));
  await on.click();
  await expect(on).toHaveAttribute("aria-pressed", "true");
  await page.getByTestId("settings-close").click();
  await expect
    .poll(() => new URL(page.url()).searchParams.get("conversation"))
    .toBe(conversationOf(here));
  await expect(page.getByTestId("message-input")).toBeEnabled();
  // Not before the person has replied and the host confirms the run.
  await expect(row).toHaveCount(0);
  const first = await yours.first().getAttribute("href");
  expect(first).toBeTruthy();
  await send(page, "hidas toinen vuoro");
  await expect(stop).toBeVisible();
  await expect(row).toBeVisible();
  await expect(row).toHaveAttribute(
    "data-offer",
    conversationOf(first ?? "") ?? "",
  );
  const open = row.getByRole("button").and(page.getByTestId("next-open"));
  await expect(open).toContainText("Sillä aikaa");
  await expect(open).toContainText("uusi vastaus");
  await expect(open).toContainText("+1");
  expect(
    (
      await new AxeBuilder({ page })
        .include('[data-testid="next-waiting"]')
        .analyze()
    ).violations,
  ).toEqual([]);
  if (capture)
    await page.screenshot({ path: `${evidence}/tyossa-desktop-light.png` });
  // It stays when the agent finishes.
  await expect(stop).toHaveCount(0, { timeout: 30000 });
  await expect(row).toBeVisible();

  // Alt+↓ opens the offer, also from the composer; Alt+↑ steps back.
  await page.getByTestId("message-input").focus();
  await page.keyboard.press("Alt+ArrowDown");
  await expect
    .poll(() => new URL(page.url()).searchParams.get("conversation"))
    .toBe(conversationOf(first ?? ""));
  // The opened conversation has replaced this one: its agent does not work,
  // so it offers nothing.
  await expect(row).toHaveCount(0);
  await expect(page.getByTestId("message-input")).toBeEnabled();
  await page.keyboard.press("Alt+ArrowUp");
  await expect
    .poll(() => new URL(page.url()).searchParams.get("conversation"))
    .toBe(conversationOf(here));
  // Back in it once its history has loaded, so its draft is restored first.
  await expect(
    page.getByText('Selvä. Kysyit: "hidas toinen vuoro".'),
  ).toBeVisible();

  // The phone keeps the name, the count and Avaa.
  await page.setViewportSize({ width: 390, height: 844 });
  await send(page, "hidas kolmas vuoro");
  await expect(stop).toBeVisible();
  await expect(row).toBeVisible();
  await expect(open).toBeVisible();
  await expect(open.getByText("Sillä aikaa")).toBeHidden();
  if (capture)
    await page.screenshot({ path: `${evidence}/tyossa-phone-light.png` });
  await open.click();
  await expect
    .poll(() => new URL(page.url()).searchParams.get("conversation"))
    .not.toBe(conversationOf(here));
});
