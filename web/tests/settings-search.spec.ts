import AxeBuilder from "@axe-core/playwright";
import { settingsSections } from "../src/app/settingsIndex";
import { hostOrigin } from "../test-ports.mjs";
import { expect, type Page, test } from "./worker-host";

// Search in Settings (proto-settings-search, Sivupalkissa): results replace
// the section list, the selected one opens beside them, and every row the
// index names is a row the page draws.
test.use({
  baseURL: hostOrigin,
  ignoreHTTPSErrors: true,
  viewport: { width: 1600, height: 800 },
});

/** Signs in the first identity, who administers the synthetic server. */
async function signIn(page: Page) {
  await page.goto("/workspaces");
  await page
    .getByRole("button")
    .and(page.getByTestId("github-sign-in"))
    .click();
  await page.getByRole("link").nth(0).click();
  await expect(
    page.getByRole("button").and(page.getByTestId("account-menu-trigger")),
  ).toBeAttached();
}

const field = (page: Page) =>
  page.getByRole("combobox").and(page.getByTestId("settings-search"));
const results = (page: Page) =>
  page.getByRole("listbox").and(page.getByTestId("settings-search-results"));
const option = (page: Page, key: string) =>
  results(page)
    .getByRole("option")
    .and(page.getByTestId(`settings-result-${key}`));
const row = (page: Page, id: string) =>
  page.locator(`.s-main [data-settings-row="${id}"]`);

test("@settings-search every index row is on its section's page and every page row is in the index", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/settings");
  for (const section of settingsSections) {
    if (section.id === "keskustelut") {
      // Listed only in the server area; its route still opens.
      await page.goto("/settings/conversations");
      await expect(row(page, "live-limit-people")).toBeAttached();
      continue;
    }
    const link = page
      .getByRole("navigation")
      .and(page.getByTestId("settings-navigation"))
      .getByRole("link")
      .and(page.getByTestId(`settings-${section.id}`));
    const href = (await link.getAttribute("href")) ?? "";
    await link.click();
    await expect(page).toHaveURL(href);
    if (section.id === "tilannekatsaus") {
      // Oma opens the folded number rows.
      await page.getByTestId("recap-level").click();
      await page.getByTestId("choice-custom").click();
    }
    const ids: string[] = section.rows.map((r) => r.id);
    for (const r of section.rows)
      if (!("when" in r)) await expect(row(page, r.id)).toBeAttached();
    const drawn = await page
      .locator(".s-main [data-settings-row]")
      .evaluateAll((rows) =>
        rows.map((r) => (r as HTMLElement).dataset.settingsRow ?? ""),
      );
    expect(drawn.filter((id) => !ids.includes(id))).toEqual([]);
  }
});

test("@settings-search / finds a setting, arrows preview results beside the list, Enter lands and Esc steps back", async ({
  page,
}, testInfo) => {
  await signIn(page);
  await page.goto("/settings");
  await expect(
    page.getByRole("heading").and(page.getByTestId("settings-title")),
  ).toBeFocused();
  const entries = await page.evaluate(() => history.length);
  await page.keyboard.press("/");
  await expect(field(page)).toBeFocused();

  await page.keyboard.type("avain");
  await expect(results(page)).toBeVisible();
  // The section list gives way to the results.
  await expect(
    page.getByRole("link").and(page.getByTestId("settings-tili")),
  ).toHaveCount(0);
  const options = results(page).getByRole("option");
  await expect(options.first()).toHaveAttribute("aria-selected", "true");
  // Even an administrator searches only their own settings here.
  await expect(option(page, "row-api-keys")).toBeVisible();
  await expect(option(page, "row-site-key")).toHaveCount(0);

  // The selected result is open beside the list; focus stays in the field.
  await page.keyboard.press("Control+a");
  await page.keyboard.type("tumma");
  await expect(option(page, "row-theme")).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page).toHaveURL("/settings/appearance#theme");
  await expect(row(page, "theme")).toHaveAttribute("data-hit", "");
  await expect(field(page)).toBeFocused();
  await page.screenshot({
    path: testInfo.outputPath("evidence/settings-search-desktop-light.png"),
  });
  await page.emulateMedia({ colorScheme: "dark" });
  await page.waitForTimeout(600);
  await page.screenshot({
    path: testInfo.outputPath("evidence/settings-search-desktop-dark.png"),
  });
  await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze()
    .then((r) => expect(r.violations).toEqual([]));

  // One input event, so the list changes once: once the previous search's
  // result is gone the list is the final one, and its second result is the
  // one the arrows reach (typing letter by letter let a loaded run read the
  // second result of a partial query).
  await field(page).fill("malli");
  await expect(option(page, "row-theme")).toHaveCount(0);
  const second = options.nth(1);
  await expect(second).toBeVisible();
  const secondKey = (await second.getAttribute("data-testid"))?.replace(
    "settings-result-",
    "",
  );
  await page.keyboard.press("ArrowDown");
  await expect(second).toHaveAttribute("aria-selected", "true");
  await expect(field(page)).toHaveAttribute(
    "aria-activedescendant",
    `settings-search-results-${secondKey}`,
  );
  await expect(field(page)).toBeFocused();
  // ArrowUp from the first wraps to the last, ArrowDown from it to the first.
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("ArrowUp");
  await expect(options.last()).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await expect(second).toHaveAttribute("aria-selected", "true");

  // Enter takes focus to the row; previews never stacked history entries.
  const secondRow = secondKey?.replace(/^row-/, "") ?? "";
  await expect(page).toHaveURL(new RegExp(`#${secondRow}$`));
  await page.keyboard.press("Enter");
  await expect(row(page, secondRow)).toBeFocused();
  expect(await page.evaluate(() => history.length)).toBe(entries);

  // Esc first empties the search, which brings the section list back, and
  // only then closes Settings.
  await page.keyboard.press("Escape");
  await expect(results(page)).toHaveCount(0);
  await expect(field(page)).toHaveValue("");
  await expect(
    page
      .getByRole("navigation")
      .and(page.getByTestId("settings-navigation"))
      .getByRole("link")
      .and(page.locator("[aria-current='page']")),
  ).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(page.locator(".ah-account-settings")).toHaveCount(0);
});

test("@settings-search Esc in the field clears then closes; a folded row lands on the row that holds it; no match says so", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/settings/recap");
  await field(page).fill("lomake");
  await expect(page.getByTestId("settings-search-none")).toBeVisible();
  await expect(field(page)).toHaveAttribute("aria-expanded", "false");

  // Oma's numbers are folded away at the standard level.
  await field(page).fill("vastauksen yläraja");
  await expect(option(page, "row-recap-response")).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page).toHaveURL("/settings/recap#recap-response");
  await field(page).press("Enter");
  await expect(row(page, "recap-level")).toBeFocused();

  await field(page).focus();
  await field(page).press("Escape");
  await expect(field(page)).toHaveValue("");
  await expect(field(page)).toBeFocused();
  await field(page).press("Escape");
  await expect(page.locator(".ah-account-settings")).toHaveCount(0);
});

for (const width of [390, 1040])
  test(`@settings-search at ${width}px results replace the list, a result opens its row and the back row returns to the results`, async ({
    page,
  }, testInfo) => {
    await signIn(page);
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/settings");
    await field(page).fill("gmail");
    // No preview: folded Settings shows the list or a section, not both.
    await expect(page).toHaveURL("/settings");
    await page.screenshot({
      path: testInfo.outputPath("evidence/settings-search-phone.png"),
    });
    await option(page, "row-google").click();
    await expect(page).toHaveURL("/settings/agent-data#google");
    await expect(row(page, "google")).toBeFocused();
    await expect(field(page)).toBeHidden();
    await page
      .getByRole("button")
      .and(page.getByTestId("settings-list-back"))
      .click();
    await expect(page).toHaveURL("/settings");
    await expect(field(page)).toHaveValue("gmail");
    await expect(option(page, "row-google")).toBeVisible();
  });
