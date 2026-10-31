import AxeBuilder from "@axe-core/playwright";
import { hostOrigin } from "../test-ports.mjs";
import { expect, test } from "./worker-host";

const host = hostOrigin;
test.use({ baseURL: host, ignoreHTTPSErrors: true });
async function identity(page: import("@playwright/test").Page) {
  await expect(
    page.getByRole("heading").and(page.getByTestId("git-identity-title")),
  ).toBeVisible();
  const confirm = page
    .getByRole("button")
    .and(page.getByTestId("git-identity-confirm"));
  await expect(
    page
      .getByRole("button")
      .and(
        page
          .getByTestId("git-identity-confirm")
          .or(page.getByTestId("git-identity-continue")),
      ),
  ).toBeVisible();
  if (await confirm.isVisible()) {
    await expect(page.getByRole("combobox")).toHaveValue(
      "alice@example.invalid",
    );
    await confirm.click();
  } else {
    await page
      .getByRole("button")
      .and(page.getByTestId("git-identity-continue"))
      .click();
  }
}
async function login(page: import("@playwright/test").Page) {
  await page.goto("/workspaces");
  await page
    .getByRole("button")
    .and(page.getByTestId("github-sign-in"))
    .click();
  await page.getByRole("link").nth(0).click();
  await identity(page);
  await expect(
    page.getByRole("heading").and(page.getByTestId("repository-chooser-title")),
  ).toBeVisible();
}
test("@github-first empty repository survives reload as a workspace", async ({
  page,
}) => {
  await page.request.get("/fixture/scenario?value=pi-onboarding");
  await page.request.get("/fixture/pi-state?value=missing");
  await login(page);
  await page.getByRole("searchbox").fill("fixture/last");
  await page.getByRole("checkbox").check();
  await page.getByTestId("repository-proceed").click();
  await expect(page.getByTestId("pi-sign-in-title")).toBeVisible();
  await expect
    .poll(
      async () =>
        (
          await (
            await page.request.get(
              "/api/v1/onboarding/github/checkout?full_name=fixture%2Flast",
            )
          ).json()
        ).state,
    )
    .toBe("confirmed");
  await page.reload();
  await expect
    .poll(
      async () =>
        (
          await (
            await page.request.get("/api/v1/onboarding/github/clones")
          ).json()
        ).interrupted,
    )
    .toEqual([]);
  const snapshot = await (await page.request.get("/api/v1/snapshot")).json();
  expect(
    snapshot.workspaces.some(
      (workspace: { name: string }) => workspace.name === "last",
    ),
  ).toBe(true);
});

test("@github-first native synthetic checkout before Pi, complete catalog and existing checkout", async ({
  page,
}, testInfo) => {
  await page.request.get("/fixture/scenario?value=pi-onboarding");
  await page.request.get("/fixture/pi-state?value=missing");
  await login(page);
  expect((await page.request.get("/api/v1/snapshot")).status()).toBe(200);
  expect(
    (
      await page.request.get(
        "/api/v1/agents/pi:11111111-1111-4111-8111-111111111111/history?limit=1",
      )
    ).status(),
  ).toBe(200);
  await expect(page.getByTestId("repository-name-fixture/first")).toBeVisible();
  await expect(
    page
      .getByRole("list")
      .and(page.getByTestId("repository-list"))
      .getByRole("checkbox"),
  ).toHaveCount(53);
  // Large catalogs scroll inside the chooser, so the selected count and
  // Continue action remain reachable without a five-screen-long page.
  expect(
    await page
      .getByRole("list")
      .and(page.getByTestId("repository-list"))
      .evaluate((list) => list.scrollHeight > list.clientHeight),
  ).toBe(true);
  await expect(
    page.getByRole("button").and(page.getByTestId("repository-proceed")),
  ).toBeVisible();
  await expect(
    page
      .getByTestId("repository-updated")
      .and(page.locator('[data-known="true"]'))
      .first(),
  ).toHaveAttribute("data-known", "true");
  await expect(
    page
      .getByTestId("repository-updated")
      .and(page.locator('[data-known="true"]'))
      .first(),
  ).toBeVisible();
  await page.getByRole("searchbox").fill("fixture/last");
  await expect(page.getByRole("checkbox")).toHaveCount(1);
  await page.getByRole("searchbox").clear();
  await expect(
    page
      .getByTestId("repository-updated")
      .and(page.locator('[data-known="false"]'))
      .first(),
  ).toHaveAttribute("data-known", "false");
  await expect(
    page
      .getByTestId("repository-updated")
      .and(page.locator('[data-known="false"]'))
      .first(),
  ).toBeVisible();
  await page.getByRole("checkbox").first().check();
  await page.screenshot({
    path: testInfo.outputPath("github-happy.png"),
    fullPage: true,
  });
  await page
    .getByRole("button")
    .and(page.getByTestId("repository-proceed"))
    .click();
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
  await page.reload();
  await identity(page);
  await expect(
    page.getByRole("heading").and(page.getByTestId("repository-chooser-title")),
  ).toBeVisible();
  await page
    .getByRole("button")
    .and(page.getByTestId("repository-proceed"))
    .click();
  await expect(
    page.getByRole("heading").and(page.getByTestId("pi-sign-in-title")),
  ).toBeVisible();
  await page
    .getByRole("button")
    .and(page.getByTestId("pi-back-to-repositories"))
    .click();
  await expect(
    page
      .getByRole("list")
      .and(page.getByTestId("repository-list"))
      .getByRole("checkbox"),
  ).toHaveCount(53);
  await expect(page.getByTestId("repository-selection")).toHaveAttribute(
    "data-count",
    "0",
  );
  await expect(page.getByTestId("repository-selection")).toBeVisible();
  await expect(
    (
      await page.request.get(
        "/api/v1/onboarding/github/checkout?full_name=fixture%2Ffirst",
      )
    ).json(),
  ).resolves.toMatchObject({ state: "confirmed" });
  await page
    .getByRole("button")
    .and(page.getByTestId("repository-proceed"))
    .click();
  await expect(
    page.getByRole("heading").and(page.getByTestId("pi-sign-in-title")),
  ).toBeVisible();
  await page.request.get("/fixture/pi-state?value=usable");
  await page.reload();
  await expect(
    page.getByRole("heading").and(page.getByTestId("workspaces-title")),
  ).toBeVisible();
  await page.request.get("/fixture/pi-state?value=missing");
  await page.reload();
  await identity(page);
  await expect(
    page.getByRole("heading").and(page.getByTestId("repository-chooser-title")),
  ).toBeVisible();
  await page
    .getByRole("button")
    .and(page.getByTestId("repository-proceed"))
    .click();
  await expect(
    page.getByRole("heading").and(page.getByTestId("pi-sign-in-title")),
  ).toBeVisible();
  await page.request.get("/fixture/scenario?value=ready");
  await page.request.get("/fixture/pi-state?value=usable");
  await page.goto("/settings");
  await expect(
    page
      .getByRole("region")
      .and(page.getByTestId("git-identity"))
      .getByTestId("git-identity-name"),
  ).toHaveText("Alice Example");
  await expect(
    page
      .getByRole("region")
      .and(page.getByTestId("git-identity"))
      .getByTestId("git-identity-name"),
  ).toBeVisible();
  await page
    .getByRole("button")
    .and(page.getByTestId("git-identity-edit"))
    .click();
  await page
    .getByRole("textbox")
    .and(page.getByTestId("git-name-input"))
    .fill("Fixture Edited");
  await page
    .getByRole("textbox")
    .and(page.getByTestId("git-email-input"))
    .fill("edited@example.invalid");
  await page
    .getByRole("button")
    .and(page.getByTestId("git-identity-save"))
    .click();
  await expect(
    page
      .getByRole("region")
      .and(page.getByTestId("git-identity"))
      .getByTestId("git-identity-name"),
  ).toHaveText("Fixture Edited");
  await expect(
    page
      .getByRole("region")
      .and(page.getByTestId("git-identity"))
      .getByTestId("git-identity-name"),
  ).toBeVisible();
  const configured = await page.request.get("/api/v1/account/git-identity");
  expect(await configured.json()).toMatchObject({
    name: "Fixture Edited",
    email: "edited@example.invalid",
    source: "~/.gitconfig",
  });
});

test("@github-first narrow catalog keeps count and action reachable by keyboard after scrolling", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.request.get("/fixture/scenario?value=pi-onboarding");
  await page.request.get("/fixture/pi-state?value=missing");
  try {
    await login(page);
    const list = page
      .getByRole("list")
      .and(page.getByTestId("repository-list"));
    const action = page
      .getByRole("button")
      .and(page.getByTestId("repository-proceed"));
    await expect(page.getByTestId("repository-selection")).toBeInViewport();
    await expect(page.getByTestId("repository-selection")).toHaveAttribute(
      "data-count",
      "0",
    );
    await expect(page.getByTestId("repository-selection")).toBeVisible();
    await expect(action).toBeInViewport();
    await list.evaluate((node) => {
      node.scrollTop = node.scrollHeight;
    });
    await expect(action).toBeInViewport();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(390);
    await page
      .getByRole("list")
      .and(page.getByTestId("repository-list"))
      .getByRole("checkbox")
      .last()
      .focus();
    await page.keyboard.press("Space");
    await expect(page.getByTestId("repository-selection")).toBeInViewport();
    await expect(page.getByTestId("repository-selection")).toHaveAttribute(
      "data-count",
      "1",
    );
    await expect(page.getByTestId("repository-selection")).toBeVisible();
    await expect(
      page.getByRole("button").and(page.getByTestId("repository-proceed")),
    ).toBeInViewport();
    await page.getByRole("searchbox").fill("no-such-repo");
    await expect(page.getByTestId("repository-selection")).toHaveAttribute(
      "data-count",
      "1",
    );
    await expect(page.getByTestId("repository-selection")).toBeVisible();
    await page
      .getByRole("button")
      .and(page.getByTestId("repository-proceed"))
      .click();
    await expect(
      page.getByRole("heading").and(page.getByTestId("pi-sign-in-title")),
    ).toBeVisible();
  } finally {
    await page.request.get("/fixture/scenario?value=ready");
    await page.request.get("/fixture/pi-state?value=usable");
  }
});

test("@github-first empty selection goes on without repositories", async ({
  page,
}) => {
  await page.request.get("/fixture/scenario?value=pi-onboarding");
  await page.request.get("/fixture/pi-state?value=missing");
  await login(page);
  await page
    .getByRole("button")
    .and(page.getByTestId("repository-proceed"))
    .click();
  await expect(
    page.getByRole("heading").and(page.getByTestId("pi-sign-in-title")),
  ).toBeVisible();
  await page.request.get("/fixture/scenario?value=ready");
  await page.request.get("/fixture/pi-state?value=usable");
});

// Jari 23.10.2026 on the pilot: an unreadable catalog left a new person
// with no way forward. Continuing without repositories always works, and the
// catalog can still be read again later.
test("@github-first unavailable catalog continues without repos and can be read again", async ({
  page,
}) => {
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
    await page.goto("/workspaces");
    await page
      .getByRole("button")
      .and(page.getByTestId("github-sign-in"))
      .click();
    await page.getByRole("link").nth(0).click();
    await expect(page.getByTestId("repository-unavailable")).toBeVisible();
    await expect(page.getByRole("checkbox")).toHaveCount(0);
    const before = await (
      await page.request.get("/fixture/clone-count")
    ).text();
    await page
      .getByRole("button")
      .and(page.getByTestId("repository-proceed"))
      .click();
    await expect(
      page.getByRole("heading").and(page.getByTestId("pi-sign-in-title")),
    ).toBeVisible();
    await expect(page.getByTestId("onboarding-clones")).toHaveCount(0);
    expect(await (await page.request.get("/fixture/clone-count")).text()).toBe(
      before,
    );
    // Back in the chooser, the catalog is read again once it is available.
    await page.unrouteAll();
    await page
      .getByRole("button")
      .and(page.getByTestId("pi-back-to-repositories"))
      .click();
    await identity(page);
    await expect(
      page
        .getByRole("list")
        .and(page.getByTestId("repository-list"))
        .getByRole("checkbox"),
    ).toHaveCount(53);
  } finally {
    await page.request.get("/fixture/scenario?value=ready");
    await page.request.get("/fixture/pi-state?value=usable");
  }
});

test("@github-first @a11y typed profile name and email prefill native Git identity; filtered bulk selection", async ({
  page,
}) => {
  await page.request.get("/fixture/scenario?value=pi-onboarding");
  await page.request.get("/fixture/pi-state?value=missing");
  await page.request.get("/fixture/profile-missing-email");
  await page.request.get("/fixture/profile-missing-name");
  await page.goto("/workspaces");
  await page
    .getByRole("button")
    .and(page.getByTestId("github-sign-in"))
    .click();
  await page.getByRole("link").nth(0).click();
  await page.getByTestId("profile-name").fill("Typed Profile Person");
  await page
    .getByRole("textbox")
    .and(page.getByTestId("profile-email"))
    .fill("typed@example.invalid");
  await page
    .getByRole("button")
    .and(page.getByTestId("profile-submit"))
    .click();
  await expect(page.getByTestId("git-name-input")).toHaveValue(
    "Typed Profile Person",
  );
  await page.getByTestId("git-name-input").fill("Edited Git Person");
  await expect(page.getByRole("combobox")).toHaveValue("typed@example.invalid");
  await page
    .getByRole("button")
    .and(page.getByTestId("git-identity-confirm"))
    .click();
  await expect(
    page.getByRole("heading").and(page.getByTestId("repository-chooser-title")),
  ).toBeVisible();
  expect(
    await (await page.request.get("/api/v1/account/git-identity")).json(),
  ).toMatchObject({
    name: "Edited Git Person",
    email: "typed@example.invalid",
    source: "~/.gitconfig",
  });
  await page
    .getByRole("combobox")
    .and(page.getByTestId("repository-time-range"))
    .selectOption("7");
  await page
    .getByRole("combobox")
    .and(page.getByTestId("repository-time-range"))
    .selectOption("0");
  await page.getByRole("searchbox").fill("fixture/last");
  await page
    .getByRole("button")
    .and(page.getByTestId("repository-toggle-visible"))
    .focus();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("repository-selection")).toHaveAttribute(
    "data-count",
    "1",
  );
  await expect(page.getByTestId("repository-selection")).toBeVisible();
  await page.getByRole("searchbox").clear();
  await expect(
    page.getByRole("checkbox").and(page.getByTestId("repository-fixture/last")),
  ).toBeChecked();
  await expect(page.getByRole("checkbox").first()).not.toBeChecked();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page
    .getByRole("button")
    .and(page.getByTestId("repository-toggle-visible"))
    .click();
  await expect(page.getByTestId("repository-selection")).toHaveAttribute(
    "data-count",
    "53",
  );
  await expect(page.getByTestId("repository-selection")).toBeVisible();
  await page
    .getByRole("button")
    .and(page.getByTestId("repository-toggle-visible"))
    .click();
  await expect(page.getByTestId("repository-selection")).toHaveAttribute(
    "data-count",
    "0",
  );
  await expect(page.getByTestId("repository-selection")).toBeVisible();
});
