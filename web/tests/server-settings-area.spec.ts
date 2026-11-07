import AxeBuilder from "@axe-core/playwright";
import { labOrigin } from "../test-ports.mjs";
import { createHostTest, expect, type Page } from "./worker-host";

const test = createHostTest(true);

test.use({
  baseURL: labOrigin,
  ignoreHTTPSErrors: true,
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
  reducedMotion: "reduce",
});
const ids = [
  "palvelin",
  "palvelinintegraatiot",
  "aiavain",
  "saneluavain",
  "kayttoonotto",
  "kayttajat",
  "keskustelut",
  "levy",
];
const link = (page: Page, id: string) =>
  page.getByRole("link").and(page.getByTestId(`settings-${id}`));
async function start(page: Page, person = 0) {
  await page.goto("/workspaces");
  await page.getByTestId("github-sign-in").click();
  await page.getByRole("link").nth(person).click();
  await expect(page.getByTestId("account-menu-trigger")).toBeAttached();
  await page.goto("/settings/experimental");
}
async function audit(page: Page) {
  expect(
    (
      await new AxeBuilder({ page })
        .include('[data-testid="settings-navigation"]')
        .analyze()
    ).violations,
  ).toEqual([]);
}
async function capture(page: Page, name: string) {
  if (process.env.OH_VISUAL_CAPTURE !== "1") return;
  const { snapshot } = await import("../lab/session.mjs");
  await snapshot(
    page,
    `../issues/graduate-server-settings-area/evidence/${name}`,
    {
      labOrigin,
    },
  );
}

test("server area enters from the menu, keeps every section visible, returns and preserves browser history", async ({
  page,
}) => {
  await start(page);
  await page.getByTestId("settings-close").click();
  await page.getByTestId("account-menu-trigger").click();
  await page.getByTestId("menu-administration").click();
  await expect(page).toHaveURL(/\/settings\/server$/);
  await expect(page.getByTestId("server-section-links")).toBeVisible();
  await expect(link(page, "tili")).toHaveCount(0);
  for (const id of ids)
    await expect(link(page, id)).toBeInViewport({ ratio: 1 });
  await audit(page);
  await capture(page, "desktop-light");
  await link(page, "palvelinintegraatiot").click();
  await expect(page).toHaveURL(/\/settings\/server-integrations$/);
  await page.getByTestId("settings-own-back").click();
  await expect(page).toHaveURL(/\/settings\/account$/);
  await expect(link(page, "palvelinintegraatiot")).toHaveCount(0);
  await capture(page, "personal-entry");
  await link(page, "palvelin").click();
  await expect(page.getByTestId("server-section-links")).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/settings\/account$/);
  await page.goForward();
  await expect(link(page, "palvelin")).toHaveAttribute("aria-current", "page");
  await page.goto("/settings/server#server-name");
  await expect(page.locator('[data-settings-row="server-name"]')).toBeFocused();
  await expect(page.getByTestId("server-section-links")).toBeVisible();
});

test("phone deep links show a scrollable section row, keyboard navigation and return to personal list", async ({
  page,
}) => {
  await start(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/settings/disk");
  await expect(link(page, "levy")).toBeInViewport({ ratio: 1 });
  const backBox = await page.getByTestId("settings-own-back").boundingBox();
  const closeBox = await page.getByTestId("settings-close").boundingBox();
  if (!backBox || !closeBox) throw new Error("Missing settings navigation");
  expect(backBox.x + backBox.width).toBeLessThan(closeBox.x);
  const row = page.getByTestId("server-section-links");
  expect(await row.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(
    true,
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await link(page, "palvelinintegraatiot").focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/settings\/server-integrations$/);
  await expect(link(page, "palvelinintegraatiot")).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(
    page.getByTestId("settings-section-palvelinintegraatiot"),
  ).toBeFocused();
  await audit(page);
  await capture(page, "phone-light");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await audit(page);
  await capture(page, "phone-dark");
  await page.getByTestId("settings-own-back").click();
  await expect(page).toHaveURL(/\/settings$/);
  await expect(link(page, "tili")).toBeVisible();
  await link(page, "palvelin").click();
  await page.getByTestId("settings-close").click();
  await expect(page).not.toHaveURL(/\/settings/);
});

test("server navigation remains unavailable to a non-administrator", async ({
  page,
}) => {
  await start(page, 1);
  await page.goto("/settings/server-integrations");
  await expect(page.getByTestId("administration-denied")).toBeVisible();
  await expect(page.getByTestId("server-section-links")).toHaveCount(0);
  await expect(link(page, "palvelin")).toHaveCount(0);
});
