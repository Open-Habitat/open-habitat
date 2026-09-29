import { hostOrigin } from "../test-ports.mjs";
import { expect, test } from "@playwright/test";

const host = hostOrigin;
test.use({ baseURL: host, ignoreHTTPSErrors: true });
async function login(page: import("@playwright/test").Page) {
  await page.goto("/workspaces");
  await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
  await page.getByRole("link", { name: "Alice" }).click();
  await expect(
    page.getByRole("heading", { name: "Valitse GitHub-repot haettaviksi" }),
  ).toBeVisible();
}
test("@github-first native synthetic checkout before Pi, complete catalog and existing checkout", async ({
  page,
}, testInfo) => {
  await page.request.get("/fixture/scenario?value=pi-onboarding");
  await page.request.get("/fixture/pi-state?value=missing");
  await login(page);
  expect((await page.request.get("/api/v1/snapshot")).status()).toBe(428);
  expect(
    (
      await page.request.get(
        "/api/v1/agents/pi:11111111-1111-4111-8111-111111111111/history?limit=1",
      )
    ).status(),
  ).toBe(428);
  await expect(page.getByText("fixture/first")).toBeVisible();
  await expect(page.getByRole("checkbox")).toHaveCount(52);
  // Large catalogs scroll inside the chooser, so the selected count and
  // Continue action remain reachable without a five-screen-long page.
  expect(
    await page
      .getByRole("list", { name: "GitHub-repot" })
      .evaluate((list) => list.scrollHeight > list.clientHeight),
  ).toBe(true);
  await expect(page.getByRole("button", { name: /jatka/i })).toBeVisible();
  await expect(page.getByText("Viimeksi päivitetty: 28.9.2026")).toBeVisible();
  await page.getByRole("searchbox").fill("fixture/last");
  await expect(page.getByRole("checkbox")).toHaveCount(1);
  await page.getByRole("searchbox").clear();
  await expect(
    page.getByText("Viimeksi päivitetty: Ei tiedossa").first(),
  ).toBeVisible();
  await page.getByRole("checkbox").first().check();
  await page.screenshot({
    path: testInfo.outputPath("github-happy.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: /jatka/i }).click();
  await expect(
    page.getByRole("heading", { name: "ChatGPT-kirjautuminen" }),
  ).toBeVisible();
  const observation = await page.request.get(
    "/api/v1/onboarding/github/checkout?full_name=fixture%2Ffirst",
  );
  expect((await observation.json()).state).toBe("confirmed");
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "ChatGPT-kirjautuminen" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Takaisin valitsemaan GitHub-repoja" })
    .click();
  await expect(page.getByRole("checkbox")).toHaveCount(52);
  await expect(page.getByText("Valittu 0 repoa.")).toBeVisible();
  await expect(
    (
      await page.request.get(
        "/api/v1/onboarding/github/checkout?full_name=fixture%2Ffirst",
      )
    ).json(),
  ).resolves.toMatchObject({ state: "confirmed" });
  await page.getByRole("button", { name: /jatka/i }).click();
  await expect(
    page.getByRole("heading", { name: "ChatGPT-kirjautuminen" }),
  ).toBeVisible();
  await page.request.get("/fixture/pi-state?value=usable");
  await page.reload();
  await expect(page.getByRole("heading", { name: "Työtilat" })).toBeVisible();
  await page.request.get("/fixture/pi-state?value=missing");
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "ChatGPT-kirjautuminen" }),
  ).toBeVisible();
  await page.request.get("/fixture/scenario?value=ready");
});

test("@github-first narrow catalog keeps count and action reachable by keyboard after scrolling", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.request.get("/fixture/scenario?value=pi-onboarding");
  await page.request.get("/fixture/pi-state?value=missing");
  try {
    await login(page);
    const list = page.getByRole("list", { name: "GitHub-repot" });
    const action = page.getByRole("button", { name: "Jatka ilman repoja" });
    await expect(page.getByText("Valittu 0 repoa.")).toBeInViewport();
    await expect(action).toBeInViewport();
    await list.evaluate((node) => {
      node.scrollTop = node.scrollHeight;
    });
    await expect(action).toBeInViewport();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(390);
    await page.getByRole("checkbox").last().focus();
    await page.keyboard.press("Space");
    await expect(page.getByText("Valittu 1 repo.")).toBeInViewport();
    await expect(
      page.getByRole("button", { name: "Hae valitut ja jatka" }),
    ).toBeInViewport();
    await page.getByRole("searchbox").fill("no-such-repo");
    await expect(page.getByText("Valittu 1 repo.")).toBeVisible();
    await page.getByRole("button", { name: "Hae valitut ja jatka" }).click();
    await expect(
      page.getByRole("heading", { name: "ChatGPT-kirjautuminen" }),
    ).toBeVisible();
  } finally {
    await page.request.get("/fixture/scenario?value=ready");
    await page.request.get("/fixture/pi-state?value=usable");
  }
});

test("@github-first empty selection goes directly to Pi", async ({ page }) => {
  await page.request.get("/fixture/scenario?value=pi-onboarding");
  await page.request.get("/fixture/pi-state?value=missing");
  await login(page);
  await page.getByRole("button", { name: /jatka/i }).click();
  await expect(
    page.getByRole("heading", { name: "ChatGPT-kirjautuminen" }),
  ).toBeVisible();
  await page.request.get("/fixture/scenario?value=ready");
  await page.request.get("/fixture/pi-state?value=usable");
});

test("@github-first incomplete catalog never permits selection or checkout", async ({
  page,
}) => {
  await page.request.get("/fixture/scenario?value=pi-onboarding");
  await page.request.get("/fixture/pi-state?value=missing");
  try {
    await page.route(
      "**/api/v1/onboarding/github/repos?page=2&limit=50",
      (route) =>
        route.fulfill({
          status: 503,
          contentType: "application/json",
          body: '{"error":"native_source_unavailable"}',
        }),
    );
    await page.goto("/workspaces");
    await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
    await page.getByRole("link", { name: "Alice" }).click();
    await expect(page.getByText("Repoja ei voitu hakea")).toBeVisible();
    await expect(page.getByRole("checkbox")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /jatka/i })).toHaveCount(0);
    await page.unrouteAll();
    await page.getByRole("button", { name: "Tarkista uudelleen" }).click();
    await expect(page.getByRole("checkbox")).toHaveCount(52);
  } finally {
    await page.request.get("/fixture/scenario?value=ready");
    await page.request.get("/fixture/pi-state?value=usable");
  }
});
