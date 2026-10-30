import AxeBuilder from "@axe-core/playwright";
import { hostOrigin } from "../test-ports.mjs";
import { expect, type Page, test } from "./worker-host";

// Seuraava odottava, Jono (next-waiting-queue): behind its Kokeelliset
// ominaisuudet switch, the conversations waiting for the person are offered
// above the composer once the host confirms the agent works, and walked as
// one round whose bar shows in every step.
test.use({
  baseURL: hostOrigin,
  ignoreHTTPSErrors: true,
  viewport: { width: 1280, height: 900 },
  deviceScaleFactor: 2,
});

const evidence = "../issues/next-waiting-queue/evidence";
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

const conversationNow = (page: Page) =>
  new URL(page.url()).searchParams.get("conversation");

async function capture2(page: Page, name: string) {
  if (!capture) return;
  for (const colorScheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
    await page.screenshot({ path: `${evidence}/${name}-${colorScheme}.png` });
  }
  await page.emulateMedia({ colorScheme: "light", reducedMotion: null });
}

test("@next-waiting-row the waiting conversations are walked as one round whose bar leads on and back, only when switched on", async ({
  page,
  context,
}) => {
  test.setTimeout(240000);
  await page.request.get("/fixture/scenario?value=ready");
  await page.goto("/workspaces");
  await page.getByTestId("github-sign-in").click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  const yours = page
    .getByRole("navigation")
    .getByTestId("rail-yours")
    .getByRole("link")
    .and(page.getByTestId("agent-link"));
  // Four replies the person has not read, written from another tab.
  const writer = await context.newPage();
  const replies: string[] = [];
  for (const [i, message] of [
    "ensimmäinen vastaus",
    "toinen vastaus",
    "kolmas vastaus",
    "neljäs vastaus",
  ].entries()) {
    await writer.goto(`${hostOrigin}/workspaces`);
    replies.push(conversationOf(await startAndSend(writer, message)) ?? "");
    await expect(writer.getByTestId("message-input")).toBeEnabled();
    await expect(yours).toHaveCount(i + 1, { timeout: 25000 });
  }
  await writer.close();
  await page.bringToFront();
  // The rail's order is the round's order.
  const order = (
    await yours.evaluateAll((links) =>
      links.map((a) => a.getAttribute("href") ?? ""),
    )
  ).map(conversationOf);
  expect([...order].sort()).toEqual([...replies].sort());

  const line = page.getByTestId("next-waiting");
  const queue = page
    .getByRole("navigation")
    .and(page.getByTestId("next-queue"));
  const stop = page
    .getByTestId("composer-stop")
    .and(page.locator('[data-stop-target="agent"]'));
  // Off (the default): the agent works and nothing of the feature shows.
  const here = conversationOf(
    await startAndSend(page, "hidas ensimmäinen vuoro"),
  );
  await expect(stop).toBeVisible();
  await expect(line).toHaveCount(0);
  await expect(stop).toHaveCount(0, { timeout: 30000 });
  await expect(line).toHaveCount(0);

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
  const on = card
    .getByRole("group")
    .and(page.getByTestId("experimental-next-waiting-row-choice"))
    .getByRole("button")
    .and(page.getByTestId("segment-on"));
  await on.click();
  await expect(on).toHaveAttribute("aria-pressed", "true");
  await page.getByTestId("settings-close").click();
  await expect.poll(() => conversationNow(page)).toBe(here);
  await expect(page.getByTestId("message-input")).toBeEnabled();
  // Not before the person has replied and the host confirms the run.
  await expect(line).toHaveCount(0);
  await send(page, "hidas toinen vuoro");
  await expect(stop).toBeVisible();
  await expect(line).toBeVisible();
  await expect(line).toHaveAttribute("data-waiting", "4");
  expect(
    (
      await new AxeBuilder({ page })
        .include('[data-testid="next-waiting"]')
        .analyze()
    ).violations,
  ).toEqual([]);
  await capture2(page, "lahto-desktop");
  // It stays when the agent finishes.
  await expect(stop).toHaveCount(0, { timeout: 30000 });
  await expect(line).toBeVisible();

  // Alt+↓ starts the round, also from the composer.
  const steps = queue.getByTestId("next-queue-step");
  const prev = queue
    .getByRole("button")
    .and(page.getByTestId("next-queue-prev"));
  const next = queue
    .getByRole("button")
    .and(page.getByTestId("next-queue-next"));
  await page.getByTestId("message-input").focus();
  await page.keyboard.press("Alt+ArrowDown");
  await expect.poll(() => conversationNow(page)).toBe(order[0]);
  await expect(queue).toBeVisible();
  await expect(steps).toHaveCount(5);
  expect(
    await steps.evaluateAll((s) => s.map((b) => b.getAttribute("data-agent"))),
  ).toEqual([here, ...order]);
  await expect(steps.nth(1)).toHaveAttribute("aria-current", "step");
  // The reply here is now read and its agent does not work, yet the round
  // goes on (a read reply stalled the old walk).
  await expect(steps.nth(1)).toHaveAttribute("data-state", "handled");
  await expect(prev).toBeEnabled();
  expect(
    (
      await new AxeBuilder({ page })
        .include('[data-testid="next-waiting"]')
        .analyze()
    ).violations,
  ).toEqual([]);
  await capture2(page, "kierros-desktop");
  await page.getByTestId("message-input").focus();
  await page.keyboard.press("Alt+ArrowDown");
  await expect.poll(() => conversationNow(page)).toBe(order[1]);
  await expect(steps.nth(2)).toHaveAttribute("aria-current", "step");
  // Alt+↑ steps back one, shown by the bar's way back.
  await page.keyboard.press("Alt+ArrowUp");
  await expect.poll(() => conversationNow(page)).toBe(order[0]);
  await prev.click();
  await expect.poll(() => conversationNow(page)).toBe(here);
  await expect(steps.nth(0)).toHaveAttribute("aria-current", "step");
  await expect(prev).toBeDisabled();
  // Back in it once its history has loaded, so its draft is restored first.
  await expect(
    page.getByText('Selvä. Kysyit: "hidas toinen vuoro".'),
  ).toBeVisible();
  // Esc ends the round.
  await page.getByTestId("message-input").focus();
  await page.keyboard.press("Escape");
  await expect(queue).toHaveCount(0);

  // The phone: a new round over the two still waiting, walked by tapping,
  // and past the last one back to the origin.
  await page.setViewportSize({ width: 390, height: 844 });
  await send(page, "hidas kolmas vuoro");
  await expect(stop).toBeVisible();
  await expect(line).toHaveAttribute("data-waiting", "2");
  await page.getByRole("button").and(page.getByTestId("next-open")).click();
  await expect.poll(() => conversationNow(page)).toBe(order[2]);
  await expect(queue).toBeVisible();
  await expect(steps.first()).toBeHidden();
  await expect(prev).toBeVisible();
  await expect(next).toBeVisible();
  const box = await queue.boundingBox();
  expect(box?.width ?? 0).toBeLessThanOrEqual(390);
  await capture2(page, "kierros-phone");
  await next.click();
  await expect.poll(() => conversationNow(page)).toBe(order[3]);
  await expect(next).toHaveAttribute("data-last", "true");
  await prev.click();
  await expect.poll(() => conversationNow(page)).toBe(order[2]);
  await next.click();
  await expect.poll(() => conversationNow(page)).toBe(order[3]);
  await next.click();
  await expect.poll(() => conversationNow(page)).toBe(here);
  await expect(queue).toHaveCount(0);
  await expect(page.getByTestId("next-note")).toBeVisible();
  await capture2(page, "kierros-kayty-phone");
});
