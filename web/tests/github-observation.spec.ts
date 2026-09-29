import { expect, test } from "@playwright/test";

const host = "https://127.0.0.1:4174";
test.use({ baseURL: host, ignoreHTTPSErrors: true });
async function enter(page: import("@playwright/test").Page) {
  await page.request.get("/fixture/scenario?value=pi-onboarding");
  await page.request.get("/fixture/pi-state?value=missing");
  await page.goto("/workspaces");
  await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
  await page.getByRole("link", { name: "Alice" }).click();
  await expect(page.getByRole("checkbox").first()).toBeVisible();
}
async function count(page: import("@playwright/test").Page) {
  return Number(await (await page.request.get("/fixture/clone-count")).text());
}
test("@github-first existing checkout advances without duplicate POST", async ({
  page,
}) => {
  await page.request.get("/fixture/checkout?name=first&mode=existing");
  await enter(page);
  const before = await count(page);
  await page.getByRole("checkbox").first().check();
  await page.getByRole("button", { name: "Jatka" }).click();
  await expect(
    page.getByRole("heading", { name: "ChatGPT-kirjautuminen" }),
  ).toBeVisible();
  expect(await count(page)).toBe(before);
  await page.request.get("/fixture/checkout?name=first&mode=absent");
  await page.request.get("/fixture/scenario?value=ready");
});
test("@github-first conflict and partial do not invent confirmation", async ({
  page,
}, testInfo) => {
  await page.request.get("/fixture/checkout?name=second&mode=conflict");
  await page.request.get("/fixture/checkout?name=first&mode=absent");
  await enter(page);
  const before = await count(page);
  await page.getByRole("checkbox").first().check();
  await page.getByRole("checkbox").nth(1).check();
  await page.getByRole("button", { name: "Jatka" }).click();
  await expect(page.getByText("Vain osa repoista vahvistettu")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "ChatGPT-kirjautuminen" }),
  ).toHaveCount(0);
  expect(await count(page)).toBe(before + 1);
  await page.screenshot({
    path: testInfo.outputPath("github-error.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Tarkista haun tila" }).click();
  await expect(page.getByText("Vain osa repoista vahvistettu")).toBeVisible();
  expect(await count(page)).toBe(before + 1);
  await page.request.get("/fixture/checkout?name=second&mode=absent");
  await page.request.get("/fixture/checkout?name=first&mode=absent");
  await page.request.get("/fixture/scenario?value=ready");
});
test("@github-first lost response reconciles by read without another POST", async ({
  page,
}) => {
  await page.request.get("/fixture/checkout?name=first&mode=absent");
  await enter(page);
  const before = await count(page);
  await page.route("**/api/v1/onboarding/github/clone", async (route) => {
    await route.fetch(); // The synthetic native checkout completed; only its browser reply is lost.
    await route.abort();
  });
  await page.getByRole("checkbox").first().check();
  await page.getByRole("button", { name: "Jatka" }).click();
  await expect(
    page.getByRole("heading", { name: "ChatGPT-kirjautuminen" }),
  ).toBeVisible();
  expect(await count(page)).toBe(before + 1);
  await page.request.get("/fixture/checkout?name=first&mode=absent");
  await page.request.get("/fixture/scenario?value=ready");
});
