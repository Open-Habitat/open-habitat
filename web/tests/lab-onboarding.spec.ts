import { expect, test } from "@playwright/test";

test("@lab shell opens conversations from home and keeps narrow navigation reachable", async ({
  page,
}) => {
  await page.request.get("/fixture/scenario?value=ready");
  await page.goto("/workspaces");
  await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
  await page.getByRole("link", { name: "Alice" }).click();
  await expect(
    page.getByRole("heading", { name: "Jatka siitä, mihin jäit", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".ah-connection")).toHaveCount(0);
  await expect(page.locator("main .ah-workspace-card")).toHaveCount(0);
  await expect(page.locator(".ah-continue-list li")).toHaveCount(3);
  await expect(
    page.locator(".ah-continue-list a[href^='/agents/']").first(),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Avaa navigaatio" }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("navigation", { name: "Työtilat ja keskustelut" })
      .getByRole("link", { name: "Etusivu" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Avaa navigaatio" }).click();
  await expect(
    page
      .getByRole("navigation", { name: "Työtilat ja keskustelut" })
      .getByRole("link", { name: "Etusivu", exact: true }),
  ).toBeVisible();
  await page.locator(".ah-rail .ah-workspace-link").first().click();
  await expect(
    page.getByRole("button", { name: "Avaa navigaatio" }),
  ).toBeVisible();
  await page.locator(".ah-back-link").click();
  await page.locator(".ah-continue-list a[href^='/agents/']").first().click();
  await expect(page).toHaveURL(/\/agents\/pi:/);
});

test("@lab long native title keeps the original accessible at 390px", async ({
  page,
}) => {
  const title =
    "Pitkä keskustelun otsikko, jossa selvitetään aamun tapahtumia ja suunnitellaan seuraavia vaiheita, jotta koko sisältö löytyy tarvittaessa lukijalle";
  await page.request.get("/fixture/scenario?value=ready");
  await page.route("**/api/v1/snapshot", async (route) => {
    const response = await route.fetch();
    const snapshot = await response.json();
    snapshot.agents[0].title.display = title;
    await route.fulfill({ response, json: snapshot });
  });
  await page.goto("/workspaces");
  await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
  await page.getByRole("link", { name: "Alice" }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator(".ah-continue-list a").first().click();
  const heading = page.getByRole("heading", { level: 1, name: title });
  await expect(heading).toBeVisible();
  const clipped = await heading.evaluate(
    (el) => el.getBoundingClientRect().height,
  );
  expect(clipped).toBeLessThan(100);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    390,
  );
  await page.getByRole("button", { name: "Tiedot" }).click();
  await expect(page.getByRole("button", { name: "Tiedot" })).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  await expect(page.locator(".ah-header-full-title")).toHaveText(title);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    390,
  );
});

test("@lab GitHub chooser, synthetic clone and Pi onboarding", async ({
  page,
}) => {
  await page.request.get("/fixture/scenario?value=pi-onboarding");
  await page.request.get("/fixture/pi-state?value=missing");
  try {
    await page.goto("/workspaces");
    await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
    await page.getByRole("link", { name: "Alice" }).click();
    await expect(
      page.getByRole("heading", { name: "Valitse GitHub-repot haettaviksi" }),
    ).toBeVisible();
    await page.getByRole("checkbox").first().check();
    await page.getByRole("button", { name: /jatka/i }).click();
    await expect(
      page.getByRole("heading", { name: "ChatGPT-kirjautuminen" }),
    ).toBeVisible();
    expect(
      (
        await (
          await page.request.get(
            "/api/v1/onboarding/github/checkout?full_name=fixture%2Ffirst",
          )
        ).json()
      ).state,
    ).toBe("confirmed");
    await page.request.get("/fixture/pi-state?value=usable");
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Jatka siitä, mihin jäit" }),
    ).toBeVisible();
  } finally {
    await page.request.get("/fixture/scenario?value=ready");
  }
});
