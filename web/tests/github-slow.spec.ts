import { hostOrigin } from "../test-ports.mjs";
import { confirmGitIdentity, passGoogle } from "./git-identity-helper";
import { expect, test } from "./worker-host";

test.use({ baseURL: hostOrigin, ignoreHTTPSErrors: true });
test("@github-first a slow start reply neither holds Continue nor starts another clone", async ({
  page,
}) => {
  await page.request.get("/fixture/scenario?value=pi-onboarding");
  await page.request.get("/fixture/pi-state?value=missing");
  await page.request.get("/fixture/checkout?name=first&mode=absent");
  try {
    await page.goto("/workspaces");
    await page
      .getByRole("button")
      .and(page.getByTestId("github-sign-in"))
      .click();
    await page.getByRole("link").nth(0).click();
    await confirmGitIdentity(page);
    await page.getByRole("checkbox").first().check();
    const before = Number(
      await (await page.request.get("/fixture/clone-count")).text(),
    );
    let release!: () => void;
    const delayed = new Promise<void>((resolve) => {
      release = resolve;
    });
    let captured!: () => void;
    const reached = new Promise<void>((resolve) => {
      captured = resolve;
    });
    await page.route("**/api/v1/onboarding/github/clones", async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      const reply = await route.fetch();
      captured();
      await delayed;
      await route.fulfill({ response: reply }).catch(() => {});
    });
    await page
      .getByRole("button")
      .and(page.getByTestId("repository-proceed"))
      .click();
    await passGoogle(page);
    await reached;
    try {
      // Continue moved on before the daemon answered.
      await expect(
        page.getByRole("heading").and(page.getByTestId("pi-sign-in-title")),
      ).toBeVisible();
      await page.evaluate(() => window.dispatchEvent(new Event("focus")));
      await expect(page.getByTestId("onboarding-clone")).toHaveAttribute(
        "data-state",
        "waiting",
      );
      expect(
        Number(await (await page.request.get("/fixture/clone-count")).text()),
      ).toBe(before + 1);
    } finally {
      release();
    }
    await expect(page.getByTestId("onboarding-clone")).toHaveAttribute(
      "data-state",
      "confirmed",
    );
    expect(
      Number(await (await page.request.get("/fixture/clone-count")).text()),
    ).toBe(before + 1);
  } finally {
    await page.request.get("/fixture/checkout?name=first&mode=absent");
    await page.request.get("/fixture/scenario?value=ready");
  }
});
