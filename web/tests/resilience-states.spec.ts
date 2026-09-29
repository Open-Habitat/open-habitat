import { hostOrigin } from "../test-ports.mjs";
import { expect, test } from "@playwright/test";

test.use({ baseURL: hostOrigin, ignoreHTTPSErrors: true });

test("@resilience failed reads recover in place without claiming an empty catalog", async ({
  page,
}) => {
  await page.request.get("/fixture/scenario?value=ready");
  await page.goto("/workspaces");
  await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
  await page.getByRole("link", { name: "Alice", exact: true }).click();
  await expect(
    page.getByRole("navigation", { name: "Työtilat ja keskustelut" }),
  ).toBeVisible();
  for (const value of ["error", "malformed", "oversize", "foreign"]) {
    await page.request.get(`/fixture/scenario?value=${value}`);
    await page.getByRole("button", { name: "Päivitä", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Yhteyttä ei saatu" }),
    ).toBeVisible();
    await expect(page.getByText("Työtiloja ei vielä ole")).toHaveCount(0);
    await expect(page.getByText("ordinary-dir")).toHaveCount(0);
    await page.request.get("/fixture/scenario?value=ready");
    await page.getByRole("button", { name: "Yritä uudelleen" }).click();
    await expect(
      page.getByRole("navigation").getByRole("link", { name: "ordinary-dir" }),
    ).toBeVisible();
  }
});

test("@resilience restored network retries a failed read without resending work", async ({
  page,
}) => {
  await page.request.get("/fixture/scenario?value=ready");
  await page.goto("/workspaces");
  await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
  await page.getByRole("link", { name: "Alice", exact: true }).click();
  await expect(page.getByRole("navigation")).toBeVisible();
  await page.route("**/api/v1/onboarding/pi/status", (route) => route.abort());
  await page.getByRole("button", { name: "Päivitä", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Yhteyttä ei saatu" }),
  ).toBeVisible();
  await page.unroute("**/api/v1/onboarding/pi/status");
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(
    page.getByRole("navigation").getByRole("link", { name: "ordinary-dir" }),
  ).toBeVisible();
});

test("@resilience missing and partial observations can be refreshed without a reload", async ({
  page,
}) => {
  await page.request.get("/fixture/scenario?value=ready");
  await page.goto("/workspaces");
  await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
  await page.getByRole("link", { name: "Alice", exact: true }).click();
  for (const value of ["missing", "partial", "empty"]) {
    await page.request.get(`/fixture/scenario?value=${value}`);
    await page.getByRole("button", { name: "Päivitä", exact: true }).click();
    await expect(
      page
        .getByRole("main")
        .getByRole("button", { name: /Yritä uudelleen|Päivitä tiedot/ }),
    ).toBeVisible();
    await page.request.get("/fixture/scenario?value=ready");
    await page
      .getByRole("main")
      .getByRole("button", { name: /Yritä uudelleen|Päivitä tiedot/ })
      .click();
    await expect(
      page.getByRole("navigation").getByRole("link", { name: "ordinary-dir" }),
    ).toBeVisible();
  }
});
