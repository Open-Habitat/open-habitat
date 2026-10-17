import { confirmGitIdentity } from "./git-identity-helper";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "./worker-host";
import { hostOrigin } from "../test-ports.mjs";

test.use({ baseURL: hostOrigin, ignoreHTTPSErrors: true });

async function aligned(page: Page, notice: string) {
  const cardBox = await page
    .getByRole("list", { name: "Käyttöönoton vaiheet" })
    .locator("..")
    .boundingBox();
  const noticeBox = await page
    .getByText(notice)
    .locator("xpath=ancestor::aside")
    .boundingBox();
  if (!cardBox || !noticeBox) throw new Error("card or notice missing");
  expect(Math.abs(cardBox.x - noticeBox.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(cardBox.width - noticeBox.width)).toBeLessThanOrEqual(1);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - innerWidth,
    ),
  ).toBeLessThanOrEqual(1);
}

async function login(page: Page, catalogReady = true) {
  await page.goto("/workspaces");
  await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
  await page.getByRole("link", { name: "Alice" }).click();
  if (!catalogReady) return;
  await confirmGitIdentity(page);
  await expect(
    page.getByRole("heading", { name: "Valitse GitHub-repot haettaviksi" }),
  ).toBeVisible();
}

test("@a11y login error stays aligned with the login card on desktop and phone", async ({
  page,
}) => {
  await page.request.get("/fixture/scenario?value=ready");
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/workspaces?auth_error=denied");
    await expect(
      page.getByText("Kirjautumisessa tapahtui virhe"),
    ).toBeVisible();
    await aligned(page, "Kirjautumisessa tapahtui virhe");
    // Shell/login states have full-page scans elsewhere; this case owns the error notice.
    expect(
      (await new AxeBuilder({ page }).include("aside.ah-notice").analyze())
        .violations,
    ).toEqual([]);
  }
});

test("@a11y failed session check offers reload under the repository card", async ({
  page,
}) => {
  await page.request.get("/fixture/scenario?value=pi-onboarding");
  await page.request.get("/fixture/pi-state?value=missing");
  try {
    await login(page);
    await page.route("**/auth/session", (route) =>
      route.fulfill({ status: 503, body: "unavailable" }),
    );
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(
      page.getByText("Istuntoa ei voitu vahvistaa. Lataa sivu uudelleen."),
    ).toBeVisible();
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 844 });
      await aligned(page, "Haun tila vaatii tarkistusta");
    }
    // The chooser's ordinary state is scanned in shell-accessibility; audit
    // the failed-session notice and its reload control, not the whole catalog.
    expect(
      (await new AxeBuilder({ page }).include("aside.ah-notice").analyze())
        .violations,
    ).toEqual([]);
    await page.unrouteAll();
    const reload = page.getByRole("button", { name: "Lataa sivu uudelleen" });
    await reload.focus();
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab");
    await expect(reload).toBeFocused();
    await page.keyboard.press("Enter");
    await confirmGitIdentity(page);
    await expect(
      page.getByRole("list", { name: "GitHub-repot" }),
    ).toBeVisible();
  } finally {
    await page.request.get("/fixture/scenario?value=ready");
    await page.request.get("/fixture/pi-state?value=usable");
  }
});

test("catalog notice retries a read, not a clone", async ({ page }) => {
  await page.request.get("/fixture/scenario?value=pi-onboarding");
  await page.request.get("/fixture/pi-state?value=missing");
  try {
    await page.route("**/api/v1/onboarding/github/repos", (route) =>
      route.fulfill({
        status: 503,
        contentType: "application/json",
        body: '{"error":"native_source_unavailable"}',
      }),
    );
    await login(page, false);
    const before = await (
      await page.request.get("/fixture/clone-count")
    ).text();
    await expect(page.getByText("Haun tila vaatii tarkistusta")).toBeVisible();
    await page.unrouteAll();
    await page
      .getByRole("button", { name: "Tarkista repot uudelleen" })
      .click();
    await confirmGitIdentity(page);
    await expect(
      page.getByRole("list", { name: "GitHub-repot" }),
    ).toBeVisible();
    expect(await (await page.request.get("/fixture/clone-count")).text()).toBe(
      before,
    );
  } finally {
    await page.request.get("/fixture/scenario?value=ready");
    await page.request.get("/fixture/pi-state?value=usable");
  }
});
