import AxeBuilder from "@axe-core/playwright";
import { hostOrigin } from "../test-ports.mjs";
import { expect, type Page, test } from "./worker-host";

// Päätteen Pi:n katselu (terminal-watch-experimental, Katso): a terminal
// history whose Pi runs in the person's own tmux offers a read-only mirror
// of its pane in the terminal panel, through the real gateway, daemon and
// tmux. Off by default; then nothing of it is shown or asked.
test.use({ baseURL: hostOrigin, ignoreHTTPSErrors: true });

const history = "/agents/pi:11111111-1111-4111-8111-111111111111";
const screen = (page: Page) => page.locator(".ah-terminal-surface .xterm-rows");
const watch = (page: Page) =>
  page.getByRole("button").and(page.getByTestId("terminal-watch"));

async function signIn(page: Page) {
  await page.request.get("/fixture/scenario?value=ready");
  await page.goto("/workspaces");
  await page
    .getByRole("button")
    .and(page.getByTestId("github-sign-in"))
    .click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  await expect(
    page.getByRole("button").and(page.getByTestId("account-menu-trigger")),
  ).toBeAttached();
}

async function setFeature(page: Page, value: "on" | "off") {
  await page.goto("/settings/experimental");
  const segment = page
    .getByRole("region")
    .and(page.getByTestId("experimental-terminal-watch"))
    .getByRole("group")
    .and(page.getByTestId("experimental-terminal-watch-choice"))
    .getByRole("button")
    .and(page.getByTestId(`segment-${value}`));
  await segment.click();
  await expect(segment).toHaveAttribute("aria-pressed", "true");
}

test("@terminal-watch a terminal Pi's tmux pane is watched read-only, and only with the switch on", async ({
  page,
}) => {
  test.setTimeout(60000);
  expect(
    (await page.request.get("/fixture/terminal-pi?mode=start")).status(),
  ).toBe(204);
  try {
    await signIn(page);
    const asked: string[] = [];
    page.on("request", (r) => {
      if (r.url().includes("/api/v1/workspaces/terminals/writer"))
        asked.push(r.url());
    });
    await page.goto(history);
    await expect(
      page.locator(".ah-read-only-footer").getByTestId("read-only-indicator"),
    ).toBeVisible();
    // Long enough for the eligibility probe to have repeated once.
    await page.waitForTimeout(5500);
    await expect(watch(page)).toHaveCount(0);
    expect(asked).toEqual([]);

    await setFeature(page, "on");
    await page.goto(history);
    await expect(watch(page)).toBeVisible({ timeout: 10000 });
    const a11y = await new AxeBuilder({ page })
      .include(".ah-read-only-footer")
      .analyze();
    expect(a11y.violations).toEqual([]);
    await watch(page).click();
    await expect(
      page
        .getByRole("region")
        .and(page.getByTestId("terminal-panel"))
        .locator("[data-readonly]")
        .getByRole("tab", { selected: true }),
    ).toBeVisible();
    await expect(screen(page)).toContainText("terminal-pi-marker");
    // Nothing typed reaches the person's pane: its tty would echo it.
    await page.locator(".ah-terminal-surface").click();
    await page.keyboard.type("typed-into-mirror");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(1200);
    await expect(screen(page)).not.toContainText("typed-into-mirror");

    // Turning the switch off in Settings, over the still-mounted view, ends
    // the mirror there and then.
    await page
      .getByRole("button")
      .and(page.getByTestId("account-menu-trigger"))
      .click();
    await page
      .getByRole("menuitem")
      .and(page.getByTestId("menu-settings"))
      .click();
    await page
      .getByRole("link")
      .and(page.getByTestId("settings-kokeelliset"))
      .click();
    const off = page
      .getByRole("region")
      .and(page.getByTestId("experimental-terminal-watch"))
      .getByRole("group")
      .and(page.getByTestId("experimental-terminal-watch-choice"))
      .getByRole("button")
      .and(page.getByTestId("segment-off"));
    await off.click();
    await expect(off).toHaveAttribute("aria-pressed", "true");
    await page
      .getByRole("button")
      .and(page.getByTestId("settings-close"))
      .click();
    await expect(page).toHaveURL(new RegExp(history.replace(":", "(:|%3A)")));
    await expect(page.getByTestId("terminal-panel")).toHaveCount(0);
    await expect(watch(page)).toHaveCount(0);
    await setFeature(page, "on");
    await page.goto(history);
    await watch(page).click();
    await expect(screen(page)).toContainText("terminal-pi-marker");

    // Pi ending in the terminal ends the mirror and the offer.
    expect(
      (await page.request.get("/fixture/terminal-pi?mode=stop")).status(),
    ).toBe(204);
    await expect(page.getByTestId("terminal-panel")).toHaveCount(0, {
      timeout: 10000,
    });
    await expect(watch(page)).toHaveCount(0, { timeout: 10000 });
  } finally {
    await page.request.get("/fixture/terminal-pi?mode=stop");
    await setFeature(page, "off").catch(() => {});
  }
});
