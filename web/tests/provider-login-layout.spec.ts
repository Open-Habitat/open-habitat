import AxeBuilder from "@axe-core/playwright";
import { hostOrigin } from "../test-ports.mjs";
import { confirmGitIdentity, passGoogle } from "./git-identity-helper";
import { createHostTest, expect } from "./worker-host";

// Preserve the real helper's code through both providers' layout/axe checks.
const test = createHostTest(false, { BROWSER_HOST_HOLD_PI_DEVICE: "1" });

test.use({ baseURL: hostOrigin, ignoreHTTPSErrors: true });

for (const width of [1440, 390]) {
  for (const colorScheme of ["light", "dark"] as const) {
    test(`provider instructions stay reachable at ${width}px ${colorScheme} @a11y`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 844 });
      // Audit settled provider colors, not the 120 ms selection transition.
      await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
      await page.route("**/api/v1/pi/claude-login", (route) =>
        route.fulfill({
          json: {
            schema_version: 1,
            state: "code",
            attempt_id: "20261020T120000.000000000",
            verification_uri:
              "https://claude.com/cai/oauth/authorize?synthetic=1",
          },
        }),
      );
      await page.request.get("/fixture/scenario?value=pi-onboarding");
      await page.request.get("/fixture/pi-state?value=missing");
      await page.goto("/workspaces");
      await page
        .getByRole("button")
        .and(page.getByTestId("github-sign-in"))
        .click();
      await page.getByRole("link").nth(0).click();
      await confirmGitIdentity(page);
      await page
        .getByRole("button")
        .and(page.getByTestId("repository-proceed"))
        .click();
      await passGoogle(page);
      await expect(
        page.getByRole("heading").and(page.getByTestId("pi-sign-in-title")),
      ).toBeVisible();
      await expect(page.getByTestId("claude-code-input")).toBeHidden();
      await page
        .getByRole("button")
        .and(page.getByTestId("pi-attempt-start"))
        .click();
      await expect(page.getByTestId("pi-device-code")).toHaveText("ABCD-1234");
      await expect(page.getByTestId("pi-device-code")).toBeVisible();
      const checkLayout = async () => {
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        const violations = (await new AxeBuilder({ page }).analyze())
          .violations;
        expect(violations).toEqual([]);
      };
      await checkLayout();
      await page
        .getByRole("button")
        .and(page.getByTestId("segment-claude-bridge"))
        .click();
      await expect(
        page.getByRole("heading").and(page.getByTestId("claude-sign-in-title")),
      ).toBeVisible();
      await expect(page.getByTestId("pi-device-code")).toBeHidden();
      const code = page.getByTestId("claude-code-input");
      await code.fill("synthetic-code");
      await code.focus();
      await expect(code).toBeFocused();
      const confirm = page
        .getByRole("button")
        .and(page.getByTestId("claude-code-confirm"));
      await expect(confirm).toBeEnabled();
      await confirm.scrollIntoViewIfNeeded();
      const box = await confirm.boundingBox();
      if (!box) throw Error("Confirmation button has no layout box");
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
      await checkLayout();
      await page
        .getByRole("button")
        .and(page.getByTestId("segment-openai-codex"))
        .click();
      await expect(code).toBeHidden();
      await expect(page.getByTestId("pi-device-code")).toHaveText("ABCD-1234");
      await expect(page.getByTestId("pi-device-code")).toBeVisible();
    });
  }
}
