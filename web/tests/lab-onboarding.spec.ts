import { labOrigin } from "../test-ports.mjs";
import { confirmGitIdentity } from "./git-identity-helper";
import { expect, test } from "./lab-host";

test.use({ baseURL: labOrigin, ignoreHTTPSErrors: true });

test("@lab shell opens conversations from home and keeps narrow navigation reachable", async ({
  page,
}) => {
  await page.request.get("/fixture/scenario?value=ready");
  await page.goto("/workspaces");
  await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
  await page.getByRole("link", { name: "Alice" }).click();
  await expect(
    page.getByRole("heading", { name: "Työtilat", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".ah-connection")).toHaveCount(0);
  await expect(page.locator("main .ah-workspace-card")).toHaveCount(0);
  // The return view keeps all observed rows instead of dropping everything
  // beyond an arbitrary three-item cutoff.
  expect(await page.locator(".ah-home-card").count()).toBeGreaterThan(3);
  await expect(
    page.locator(".ah-home-card-head a[href^='/agents/']").first(),
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
  await page.locator(".ah-home-card-head a[href^='/agents/']").first().click();
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
  // Grouping follows observed state, so the target is not necessarily first.
  const titledLink = page.locator(".ah-home-card-head a", { hasText: title });
  await expect(titledLink).toBeVisible();
  await titledLink.click();
  const heading = page.getByRole("heading", { level: 1, name: title });
  await expect(heading).toBeVisible();
  const clipped = await heading.evaluate(
    (el) => el.getBoundingClientRect().height,
  );
  expect(clipped).toBeLessThan(100);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    390,
  );
  const details = page.getByRole("button", { name: "Tiedot", exact: true });
  await details.click();
  await expect(details).toHaveAttribute("aria-expanded", "true");
  await expect(heading).toHaveAttribute("title", title);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    390,
  );
  await page.unrouteAll({ behavior: "wait" });
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
    await confirmGitIdentity(page);
    await expect(
      page.getByRole("heading", { name: "Valitse GitHub-repot haettaviksi" }),
    ).toBeVisible();
    await page.getByRole("checkbox").first().check();
    await page.getByRole("button", { name: /jatka/i }).click();
    await expect(
      page.getByRole("heading", { name: "Kirjaudu OpenAI-tiliisi" }),
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
    await expect(page.getByRole("heading", { name: "Työtilat" })).toBeVisible();
  } finally {
    await page.request.get("/fixture/scenario?value=ready");
  }
});

test("@lab cloned GitHub checkout hides publication; local Git checkout keeps it on desktop and phone", async ({
  page,
}) => {
  await page.request.get("/fixture/scenario?value=ready");
  await page.goto("/workspaces");
  await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
  await page.getByRole("link", { name: "Alice" }).click();
  await page
    .locator("main")
    .getByRole("button", { name: "Uusi työtila" })
    .click();
  await page.getByRole("textbox", { name: "Repositorio" }).fill("fixture/last");
  await page.getByRole("button", { name: "Luo työtila" }).click();
  await expect(
    page.getByRole("link", { name: "last", exact: true }).first(),
  ).toBeVisible();
  const workspaces = (await (await page.request.get("/api/v1/snapshot")).json())
    .workspaces;
  const cloned = workspaces.find((w: { name: string }) => w.name === "last");
  const local = workspaces.find(
    (w: { name: string }) => w.name === "tilastoharjoitus",
  );
  expect(cloned.git_remote).toBe("github");
  expect(local.git_remote).toBe("none");
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto(`/workspaces/${cloned.workspace_id}`);
    await expect(
      page.getByRole("heading", { name: "last", level: 1 }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Julkaise GitHubiin" }),
    ).toHaveCount(0);
    await expect(
      page.getByText("Tässä työtilassa ei ole vielä keskusteluja."),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Arkisto" })).toHaveCount(0);
    await page.goto(`/workspaces/${local.workspace_id}`);
    await expect(
      page.getByRole("heading", { name: "Julkaise GitHubiin" }),
    ).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Omistaja" })).toBeVisible();
    await expect(
      page.getByText("Tässä työtilassa ei ole vielä keskusteluja."),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Arkisto" })).toHaveCount(0);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(width);
  }
});
