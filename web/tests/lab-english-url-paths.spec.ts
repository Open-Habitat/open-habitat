import AxeBuilder from "@axe-core/playwright";
import { snapshot } from "../lab/session.mjs";
import { labOrigin } from "../test-ports.mjs";
import { createHostTest, expect } from "./worker-host";

const test = createHostTest(true);
test.use({
  baseURL: labOrigin,
  ignoreHTTPSErrors: true,
  reducedMotion: "reduce",
});

test("@a11y English settings links survive OAuth, reload and browser history", async ({
  page,
}, testInfo) => {
  // A canonical deep link must survive the gateway's exact OAuth allowlist.
  await page.goto("/settings/editor");
  await page.getByTestId("github-sign-in").click();
  await page.getByRole("link").nth(0).click();
  await expect(page).toHaveURL(/\/settings\/editor$/);
  await expect(page.getByTestId("settings-section-editori")).toBeVisible();
  await page.goto("/settings");
  const navigation = page.getByTestId("settings-navigation");
  await expect(navigation.getByTestId("settings-levy")).toBeVisible();
  // Independent English vocabulary catches both non-ASCII and ASCII Finnish slugs.
  const slugs = [
    "account",
    "devices",
    "keys",
    "ai",
    "recap",
    "speech",
    "code-hosts",
    "agent-data",
    "machines",
    "appearance",
    "editor",
    "storage",
    "experimental",
    "server",
    "server-integrations",
    "ai-key",
    "speech-key",
    "onboarding",
    "users",
    "disk",
  ];
  const links = await navigation.getByRole("link").all();
  expect(
    await Promise.all(links.map((link) => link.getAttribute("href"))),
  ).toEqual(slugs.map((slug) => `/settings/${slug}`));
  for (const [index, link] of links.entries()) {
    await link.click();
    await expect(page).toHaveURL(new RegExp(`/settings/${slugs[index]}$`));
    await expect(link).toHaveAttribute("aria-current", "page");
  }
  await page.goBack();
  await expect(page).toHaveURL(/\/settings\/users$/);
  await page.goForward();
  await expect(page).toHaveURL(/\/settings\/disk$/);
  await page.reload();
  await expect(page.getByTestId("settings-levy")).toHaveAttribute(
    "aria-current",
    "page",
  );
  for (const old of ["/settings/integraatiot", "/settings/connections"]) {
    await page.goto(old);
    await expect(page).toHaveURL(/\/settings$/);
  }
  await page.goto("/settings/integraatiot");
  await expect(page).toHaveURL(/\/settings$/);
  await page.goto("/settings/account");
  await expect(page.getByTestId("settings-section-tili")).toBeVisible();
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 });
    for (const colorScheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme });
      expect(
        (
          await new AxeBuilder({ page })
            .include(".ah-account-settings")
            .analyze()
        ).violations,
      ).toEqual([]);
      await snapshot(page, testInfo.outputPath(`${width}-${colorScheme}`), {
        labOrigin: new URL(page.url()).origin,
      });
    }
  }
});
