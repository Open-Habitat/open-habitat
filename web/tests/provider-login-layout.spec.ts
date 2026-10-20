import { hostOrigin } from "../test-ports.mjs";
import AxeBuilder from "@axe-core/playwright";
import { confirmGitIdentity } from "./git-identity-helper";
import { expect, test } from "./worker-host";

test.use({ baseURL: hostOrigin, ignoreHTTPSErrors: true });

for (const width of [1440, 390]) {
  for (const colorScheme of ["light", "dark"] as const) {
    test(`provider instructions stay reachable at ${width}px ${colorScheme} @a11y`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 844 });
      await page.emulateMedia({ colorScheme });
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
      await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
      await page.getByRole("link", { name: "Alice", exact: true }).click();
      await confirmGitIdentity(page);
      await page.getByRole("button", { name: /jatka/i }).click();
      await expect(
        page.getByRole("heading", { name: "Kirjaudu OpenAI-tiliisi" }),
      ).toBeVisible();
      await expect(page.getByLabel(/Clauden palauttama koodi/)).toBeHidden();
      await page
        .getByRole("button", { name: "Aloita kirjautuminen", exact: true })
        .click();
      await expect(page.getByText("ABCD-1234")).toBeVisible();
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
        .getByRole("button", { name: "Claude-tilaus", exact: true })
        .click();
      await expect(
        page.getByRole("heading", { name: "Kirjaudu Claude-tiliisi" }),
      ).toBeVisible();
      await expect(page.getByText("ABCD-1234")).toBeHidden();
      const code = page.getByLabel(/Clauden palauttama koodi/);
      await code.fill("synthetic-code");
      await code.focus();
      await expect(code).toBeFocused();
      const confirm = page.getByRole("button", {
        name: "Vahvista Claude-koodi",
      });
      await expect(confirm).toBeEnabled();
      await confirm.scrollIntoViewIfNeeded();
      const box = await confirm.boundingBox();
      if (!box) throw Error("Confirmation button has no layout box");
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
      await checkLayout();
      await page
        .getByRole("button", { name: "ChatGPT / OpenAI", exact: true })
        .click();
      await expect(code).toBeHidden();
      await expect(page.getByText("ABCD-1234")).toBeVisible();
    });
  }
}
