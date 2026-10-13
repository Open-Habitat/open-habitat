import { expect, test } from "./worker-host";
import { hostOrigin } from "../test-ports.mjs";

test.use({ baseURL: hostOrigin, ignoreHTTPSErrors: true });
test("@github-first slow reply and focus never start another checkout", async ({
  page,
}) => {
  await page.request.get("/fixture/scenario?value=pi-onboarding");
  await page.request.get("/fixture/pi-state?value=missing");
  await page.request.get("/fixture/checkout?name=first&mode=absent");
  try {
    await page.goto("/workspaces");
    await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
    await page.getByRole("link", { name: "Alice" }).click();
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
    await page.route(
      "**/api/v1/onboarding/github/clone/stream",
      async (route) => {
        const reply = await route.fetch();
        captured();
        await delayed;
        await route.fulfill({ response: reply }).catch(() => {});
      },
    );
    await page.getByRole("button", { name: /jatka/i }).click();
    await reached;
    try {
      await page.evaluate(() => window.dispatchEvent(new Event("focus")));
      await expect(page.getByText("Haettu 0/1 repoa")).toBeVisible();
      expect(
        Number(await (await page.request.get("/fixture/clone-count")).text()),
      ).toBe(before + 1);
    } finally {
      release();
    }
    await expect(
      page.getByRole("heading", { name: "Kirjaudu OpenAI-tiliisi" }),
    ).toBeVisible();
    expect(
      Number(await (await page.request.get("/fixture/clone-count")).text()),
    ).toBe(before + 1);
  } finally {
    await page.request.get("/fixture/checkout?name=first&mode=absent");
    await page.request.get("/fixture/scenario?value=ready");
  }
});
