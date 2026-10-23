import { labOrigin } from "../test-ports.mjs";
import { confirmGitIdentity, passGoogle } from "./git-identity-helper";
import { expect, test } from "./lab-host";

test.use({ baseURL: labOrigin, ignoreHTTPSErrors: true });

test("@lab shell opens conversations from home and keeps narrow navigation reachable", async ({
  page,
}) => {
  await page.request.get("/fixture/scenario?value=ready");
  await page.goto("/workspaces");
  await page
    .getByRole("button")
    .and(page.getByTestId("github-sign-in"))
    .click();
  await page.getByRole("link").nth(0).click();
  await expect(
    page.getByRole("heading").and(page.getByTestId("workspaces-title")),
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
    page.getByRole("button").and(page.getByTestId("navigation-open")),
  ).toBeVisible();
  await expect(
    page
      .getByRole("navigation")
      .and(page.getByTestId("workspace-navigation"))
      .getByRole("link")
      .and(page.getByTestId("home-link")),
  ).toHaveCount(0);
  await page
    .getByRole("button")
    .and(page.getByTestId("navigation-open"))
    .click();
  await expect(
    page
      .getByRole("navigation")
      .and(page.getByTestId("workspace-navigation"))
      .getByRole("link")
      .and(page.getByTestId("home-link")),
  ).toBeVisible();
  await page.locator(".ah-rail .ah-workspace-link").first().click();
  await expect(
    page.getByRole("button").and(page.getByTestId("navigation-open")),
  ).toBeVisible();
  await page
    .getByRole("button")
    .and(page.getByTestId("navigation-open"))
    .click();
  await page
    .getByRole("navigation")
    .and(page.getByTestId("workspace-navigation"))
    .getByRole("link")
    .and(page.getByTestId("home-link"))
    .click();
  await page.locator(".ah-home-card-head a[href^='/agents/']").first().click();
  await expect(page).toHaveURL(/\/agents\/pi:/);
});

test("@lab long native title keeps the original accessible at 390px", async ({
  page,
}) => {
  const title =
    "Pitkä keskustelun otsikko, jossa selvitetään aamun tapahtumia ja suunnitellaan seuraavia vaiheita, jotta koko sisältö löytyy tarvittaessa lukijalle";
  await page.request.get("/fixture/scenario?value=ready");
  let targetId = "";
  await page.route("**/api/v1/snapshot", async (route) => {
    const response = await route.fetch();
    const snapshot = await response.json();
    targetId = snapshot.agents[0].agent_id;
    snapshot.agents[0].title.display = title;
    await route.fulfill({ response, json: snapshot });
  });
  await page.goto("/workspaces");
  await page
    .getByRole("button")
    .and(page.getByTestId("github-sign-in"))
    .click();
  await page.getByRole("link").nth(0).click();
  await page.setViewportSize({ width: 390, height: 844 });
  // Grouping follows observed state, so the target is not necessarily first.
  await expect.poll(() => targetId).not.toBe("");
  const titledLink = page
    .getByRole("link")
    .and(page.getByTestId(`home-conversation-${targetId}`));
  await expect(titledLink).toBeVisible();
  await titledLink.click();
  const heading = page
    .getByRole("heading")
    .and(page.getByTestId("workspace-title"));
  await expect(heading).toBeVisible();
  await expect(heading).toHaveText(title);
  await expect(heading).toBeVisible();
  const clipped = await heading.evaluate(
    (el) => el.getBoundingClientRect().height,
  );
  expect(clipped).toBeLessThan(100);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    390,
  );
  const details = page
    .getByRole("button")
    .and(page.getByTestId("workspace-details"));
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
    await page
      .getByRole("button")
      .and(page.getByTestId("github-sign-in"))
      .click();
    await page.getByRole("link").nth(0).click();
    await confirmGitIdentity(page);
    await expect(
      page
        .getByRole("heading")
        .and(page.getByTestId("repository-chooser-title")),
    ).toBeVisible();
    await page.getByRole("checkbox").first().check();
    await page
      .getByRole("button")
      .and(page.getByTestId("repository-proceed"))
      .click();
    await passGoogle(page);
    await expect(
      page.getByRole("heading").and(page.getByTestId("pi-sign-in-title")),
    ).toBeVisible();
    await expect
      .poll(
        async () =>
          (
            await (
              await page.request.get(
                "/api/v1/onboarding/github/checkout?full_name=fixture%2Ffirst",
              )
            ).json()
          ).state,
      )
      .toBe("confirmed");
    await page.request.get("/fixture/pi-state?value=usable");
    await page.reload();
    await expect(
      page.getByRole("heading").and(page.getByTestId("workspaces-title")),
    ).toBeVisible();
  } finally {
    await page.request.get("/fixture/scenario?value=ready");
  }
});

test("@lab cloned GitHub checkout hides publication; local Git checkout keeps it on desktop and phone", async ({
  page,
}) => {
  await page.request.get("/fixture/scenario?value=ready");
  await page.goto("/workspaces");
  await page
    .getByRole("button")
    .and(page.getByTestId("github-sign-in"))
    .click();
  await page.getByRole("link").nth(0).click();
  await page
    .locator("main")
    .getByRole("button")
    .and(page.getByTestId("workspace-create"))
    .click();
  await page
    .getByRole("searchbox")
    .and(page.getByTestId("repository-search"))
    .fill("fixture/last");
  await page
    .locator("main")
    .getByRole("link")
    .and(page.getByTestId("repository-option-fixture/last"))
    .first()
    .click();
  await page
    .getByRole("button")
    .and(page.getByTestId("repository-clone"))
    .click();
  await page
    .getByRole("article")
    .and(page.getByTestId("clone-job"))
    .getByRole("button")
    .and(page.getByTestId("cloned-workspace-open"))
    .click();
  await expect(
    page.getByRole("link").and(page.getByTestId("workspace-last")).first(),
  ).toBeVisible();
  // The new workspace gets its first conversation (Jari 16.10.2026).
  await expect(page).toHaveURL(/conversation=pi:/, { timeout: 20000 });
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
      page.getByRole("heading").and(page.getByTestId("workspace-title")),
    ).toBeVisible();
    await page.locator(".ah-workspace-git").getByRole("button").click();
    await expect(
      page.getByRole("heading").and(page.getByTestId("publish-title")),
    ).toHaveCount(0);
    await expect(
      page.getByRole("textbox").and(page.getByTestId("publish-owner")),
    ).toHaveCount(0);
    await page
      .getByRole("dialog")
      .getByRole("button")
      .and(page.getByTestId("dialog-close"))
      .click();
    await expect(
      page.getByRole("heading").and(page.getByTestId("archive-title")),
    ).toHaveCount(0);
    await page.goto(`/workspaces/${local.workspace_id}`);
    await page.locator(".ah-workspace-git").getByRole("button").click();
    await expect(
      page.getByRole("heading").and(page.getByTestId("publish-title")),
    ).toBeVisible();
    await expect(
      page.getByRole("textbox").and(page.getByTestId("publish-owner")),
    ).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(width);
    await page
      .getByRole("dialog")
      .getByRole("button")
      .and(page.getByTestId("dialog-close"))
      .click();
    await expect(
      page.getByTestId("workspace-conversations-empty"),
    ).toBeVisible();
    await expect(
      page.getByRole("heading").and(page.getByTestId("archive-title")),
    ).toHaveCount(0);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(width);
  }
});
