import AxeBuilder from "@axe-core/playwright";
import { hostOrigin } from "../test-ports.mjs";
import { expect, type Page, test } from "./worker-host";

// Seuraava odottava, Jono (next-waiting-queue, next-waiting-no-return):
// behind its Kokeelliset ominaisuudet switch, the conversations waiting for
// the person are offered above the composer while the host confirms that
// this conversation's agent works, and walked forward as one round whose bar
// shows in every step and never leads back to where it started.
test.use({
  baseURL: hostOrigin,
  ignoreHTTPSErrors: true,
  viewport: { width: 1280, height: 900 },
  deviceScaleFactor: 2,
});

const evidence = "../issues/next-waiting-no-return/evidence";
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

async function switchOn(page: Page) {
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
}

async function capture2(page: Page, name: string) {
  if (!capture) return;
  for (const colorScheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
    await page.screenshot({ path: `${evidence}/${name}-${colorScheme}.png` });
  }
  await page.emulateMedia({ colorScheme: "light", reducedMotion: null });
}

test("@next-waiting-row the waiting ones are offered only while the agent here works and walked forward as one round, only when switched on", async ({
  page,
  context,
}) => {
  test.setTimeout(240000);
  await page.request.get("/fixture/scenario?value=ready");
  await page.goto("/workspaces");
  await page.getByTestId("github-sign-in").click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  const rail = page.getByRole("navigation");
  const yours = rail
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
  // The rail's order is the round's order. Read once the rail holds all
  // four, polled: a rail re-render under load can briefly hold none.
  let order: (string | null)[] = [];
  await expect
    .poll(async () => {
      order = (
        await yours.evaluateAll((links) =>
          links.map((a) => a.getAttribute("href") ?? ""),
        )
      ).map(conversationOf);
      return [...order].sort();
    })
    .toEqual([...replies].sort());

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
  await switchOn(page);
  await expect.poll(() => conversationNow(page)).toBe(here);
  await expect(page.getByTestId("message-input")).toBeEnabled();
  // Not while it is the person's turn here.
  await expect(line).toHaveCount(0);
  await send(page, "hidas toinen vuoro");
  await expect(stop).toBeVisible();
  await expect(line).toBeVisible();
  // The four others, never this conversation itself.
  await expect(line).toHaveAttribute("data-waiting", "4");
  await expect(line.locator(".ah-next-det")).not.toContainText("hidas");
  // Not a Mac: the key is named Alt.
  await expect(line.locator("kbd")).toHaveText(/^Alt\+/);
  // Gone when the agent's turn ends and the person has something to write
  // here (Jari 31.10.: it stayed for the rest of the visit), back when the
  // agent works again.
  await expect(stop).toHaveCount(0, { timeout: 30000 });
  await expect(line).toHaveCount(0);
  await send(page, "hidas kolmas vuoro");
  await expect(stop).toBeVisible();
  await expect(line).toHaveAttribute("data-waiting", "4");
  expect(
    (
      await new AxeBuilder({ page })
        .include('[data-testid="next-waiting"]')
        .analyze()
    ).violations,
  ).toEqual([]);
  await capture2(page, "lahto-desktop");

  // Alt+↓ starts the round, also from the composer, while the agent here
  // still works. The round is the four waiting ones, not this one.
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
  // Polled: while a step's history loads the conversation shows no
  // composer and so no bar, and under load a single read can fall there.
  const agents = () =>
    steps.evaluateAll((s) => s.map((b) => b.getAttribute("data-agent")));
  await expect.poll(agents).toEqual(order);
  await expect(steps.nth(0)).toHaveAttribute("aria-current", "step");
  // The reply here is now read and its agent does not work, yet the round
  // goes on; there is nothing before the first step.
  await expect(steps.nth(0)).toHaveAttribute("data-state", "handled");
  await expect(prev).toBeDisabled();
  // The start joins at the end only once its agent finished unseen and so
  // waits for the person, like any other.
  await expect.poll(agents, { timeout: 40000 }).toEqual([...order, here]);
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
  await expect(steps.nth(1)).toHaveAttribute("aria-current", "step");
  await expect(prev).toBeEnabled();
  // Alt+↑ steps back one, and from the first step nowhere.
  await page.keyboard.press("Alt+ArrowUp");
  await expect.poll(() => conversationNow(page)).toBe(order[0]);
  await expect(prev).toBeDisabled();
  // Esc ends the round. The agent here waits: no line either.
  await page.getByTestId("message-input").focus();
  await page.keyboard.press("Escape");
  await expect(queue).toHaveCount(0);
  await expect(line).toHaveCount(0);

  // The phone: a new round over the three still waiting (the start among
  // them), walked by tapping; after the last one Valmis ends it there.
  await page.setViewportSize({ width: 390, height: 844 });
  await send(page, "hidas neljäs vuoro");
  await expect(stop).toBeVisible();
  await expect(line).toHaveAttribute("data-waiting", "3");
  await page.getByRole("button").and(page.getByTestId("next-open")).click();
  await expect(queue).toBeVisible();
  let round: (string | null)[] = [];
  await expect
    .poll(async () => {
      round = await agents();
      return [...round].sort();
    })
    .toEqual([order[2], order[3], here].sort());
  await expect.poll(() => conversationNow(page)).toBe(round[0]);
  await expect(steps.first()).toBeHidden();
  await expect(prev).toBeVisible();
  await expect(next).toBeVisible();
  const box = await queue.boundingBox();
  expect(box?.width ?? 0).toBeLessThanOrEqual(390);
  await capture2(page, "kierros-phone");
  await next.click();
  await expect.poll(() => conversationNow(page)).toBe(round[1]);
  await prev.click();
  await expect.poll(() => conversationNow(page)).toBe(round[0]);
  await next.click();
  await expect.poll(() => conversationNow(page)).toBe(round[1]);
  await next.click();
  await expect.poll(() => conversationNow(page)).toBe(round[2]);
  await expect(next).toHaveAttribute("data-last", "true");
  await capture2(page, "kierros-viimeinen-phone");
  await next.click();
  await expect(queue).toHaveCount(0);
  await expect(page.getByTestId("next-note")).toBeVisible();
  // It ends where the person is, not back where the round started.
  expect(conversationNow(page)).toBe(round[2]);
  await capture2(page, "kierros-kayty-phone");
});

test("@next-waiting-row a round whose waiting ones are archived ends itself, and a Mac names the keys ⌥", async ({
  page,
  context,
}) => {
  test.setTimeout(180000);
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "platform", { get: () => "MacIntel" });
  });
  await page.request.get("/fixture/scenario?value=ready");
  await page.goto("/workspaces");
  await page.getByTestId("github-sign-in").click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  const rail = page.getByRole("navigation");
  const yours = rail
    .getByTestId("rail-yours")
    .getByRole("link")
    .and(page.getByTestId("agent-link"));
  const writer = await context.newPage();
  const replies: string[] = [];
  const hrefs: string[] = [];
  for (const [i, message] of ["ensimmäinen", "toinen"].entries()) {
    await writer.goto(`${hostOrigin}/workspaces`);
    hrefs.push(await startAndSend(writer, message));
    replies.push(conversationOf(hrefs[i]) ?? "");
    await expect(writer.getByTestId("message-input")).toBeEnabled();
    await expect(yours).toHaveCount(i + 1, { timeout: 25000 });
  }
  await page.bringToFront();
  const here = conversationOf(await startAndSend(page, "lähtö"));
  await expect(page.getByTestId("message-input")).toBeEnabled();
  await switchOn(page);
  await expect.poll(() => conversationNow(page)).toBe(here);
  await expect(page.getByTestId("message-input")).toBeEnabled();
  const line = page.getByTestId("next-waiting");
  await send(page, "hidas toinen vuoro");
  await expect(line).toHaveAttribute("data-waiting", "2");
  await expect(line.locator("kbd")).toHaveText(/^⌥/);

  const queue = page
    .getByRole("navigation")
    .and(page.getByTestId("next-queue"));
  await page.getByTestId("message-input").focus();
  await page.keyboard.press("Alt+ArrowDown");
  await expect(queue).toBeVisible();
  for (const kbd of await queue.locator("kbd").all())
    await expect(kbd).toHaveText(/^⌥/);
  // The bar has no way back to the start: the person goes there through
  // the rail like anywhere else, and the bar stays with its place.
  await rail.getByTestId(`agent-item-${here}`).getByRole("link").click();
  await expect.poll(() => conversationNow(page)).toBe(here);
  await expect(queue).toBeVisible();

  // Both waiting ones archived: the round has nothing left to walk and ends
  // into its summary instead of lingering until ✕. The round opened the
  // first, so it is read and finished and not in the rail any more
  // (rail-running-after-done); it is archived from its own header elsewhere.
  await expect(rail.getByTestId(`agent-item-${replies[0]}`)).toHaveCount(0);
  await writer.goto(new URL(hrefs[0], hostOrigin).href);
  await writer
    .locator(".ah-agent-header")
    .getByTestId("archive-conversation")
    .click();
  await expect(writer.getByTestId("archive-notice")).toBeVisible();
  await writer.close();
  await page.bringToFront();
  await page
    .getByTestId("workspace-navigation")
    .getByTestId("snapshot-refresh")
    .click();
  const row = rail.getByTestId(`agent-item-${replies[1]}`);
  await row.hover();
  await row
    .getByRole("button")
    .and(page.getByTestId("rail-archive-conversation"))
    .click();
  await expect(row).toHaveCount(0);
  await expect(queue).toHaveCount(0);
  await expect(page.getByTestId("next-note")).toBeVisible();
  expect(conversationNow(page)).toBe(here);
});
