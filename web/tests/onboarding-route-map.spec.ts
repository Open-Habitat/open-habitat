import AxeBuilder from "@axe-core/playwright";
import { hostOrigin } from "../test-ports.mjs";
import { confirmGitIdentity } from "./git-identity-helper";
import { expect, type Page, test } from "./worker-host";

// Onboarding's Kartta route against the synthetic host: the real gateway
// and daemon, whose stand-in Google and Microsoft entries are available as on
// a server whose operator configured them, and the site's integration steps
// set as root's admin CLI sets them. Same-UID synthetic evidence: it proves
// the route, the step order and the relays, not Linux user isolation or a
// real provider.

test.use({ baseURL: hostOrigin, ignoreHTTPSErrors: true });

async function start(page: Page, integrations = "google") {
  expect(
    (
      await page.request.get(
        `/fixture/onboarding?integrations=${encodeURIComponent(integrations)}`,
      )
    ).status(),
  ).toBe(204);
  await page.request.get("/fixture/scenario?value=pi-onboarding");
  await page.request.get("/fixture/pi-state?value=missing");
  await page.goto("/workspaces");
  await page
    .getByRole("button")
    .and(page.getByTestId("github-sign-in"))
    .click();
  await page.getByRole("link").nth(0).click();
}
const route = (page: Page) =>
  page.getByRole("navigation", { name: "Käyttöönoton vaiheet" });
const step = (page: Page, id: string) =>
  route(page).getByTestId(`onboarding-step-${id}`);
async function expectRoute(page: Page, states: Record<string, string>) {
  // The steps only; a step's own detail, such as the clones under Repot,
  // is a nested list.
  await expect(
    route(page).locator('[data-testid^="onboarding-step-"]'),
  ).toHaveCount(Object.keys(states).length);
  for (const [id, state] of Object.entries(states))
    await expect(step(page, id)).toHaveAttribute("data-state", state);
  const current = Object.entries(states).find(([, s]) => s === "current");
  if (current)
    await expect(step(page, current[0])).toHaveAttribute(
      "aria-current",
      "step",
    );
}
const heading = (page: Page, id: string) =>
  page.getByRole("heading").and(page.getByTestId(id));
const button = (page: Page, id: string) =>
  page.getByRole("button").and(page.getByTestId(id));

/** Google's sign-in through the Settings dialog, as the step offers it. */
async function connectGoogle(page: Page) {
  await page
    .getByTestId("integration-tile-google")
    .getByRole("button")
    .and(page.getByTestId("integration-connect-open"))
    .click();
  const dialog = page.getByRole("dialog");
  // The dialog carries the agent warning the compact step leaves out.
  await expect(dialog.getByRole("note")).toBeVisible();
  await dialog
    .getByRole("button")
    .and(dialog.getByTestId("integration-continue"))
    .click();
  const popup = page.waitForEvent("popup");
  await dialog
    .getByRole("link")
    .and(dialog.getByTestId("integration-provider-link"))
    .click();
  await (await popup).close();
  await dialog
    .getByRole("textbox")
    .and(dialog.getByTestId("integration-redirect-input"))
    .fill("http://127.0.0.1:46399/oauth2/callback?state=lab&code=4/synthetic");
  await dialog
    .getByRole("button")
    .and(dialog.getByTestId("integration-connect"))
    .click();
  await expect(dialog.getByTestId("integration-folder-choice")).toBeVisible();
  await dialog
    .getByRole("button")
    .and(dialog.getByTestId("integration-sync-start"))
    .click();
  await expect(dialog.getByTestId("integration-connected")).toBeVisible();
  await dialog
    .getByRole("button")
    .and(dialog.getByTestId("integration-done"))
    .click();
  await expect(
    page
      .getByRole("article")
      .and(page.getByTestId("integration-account-google")),
  ).toBeVisible();
}

test("@github-first the route shows every step, Google included, and marks progress and a skipped Google", async ({
  page,
}) => {
  try {
    await start(page);
    await expect(heading(page, "git-identity-title")).toBeVisible();
    await expectRoute(page, {
      github: "current",
      repositories: "next",
      google: "next",
      ai: "next",
    });
    await confirmGitIdentity(page);
    await expect(heading(page, "repository-chooser-title")).toBeVisible();
    await expectRoute(page, {
      github: "done",
      repositories: "current",
      google: "next",
      ai: "next",
    });
    await page
      .getByRole("checkbox")
      .and(page.getByTestId("repository-fixture/first"))
      .check();
    await button(page, "repository-proceed").click();
    await expect(heading(page, "integration-onboarding-title")).toBeFocused();
    await expectRoute(page, {
      github: "done",
      repositories: "done",
      google: "current",
      ai: "next",
    });
    await expect(step(page, "repositories")).toContainText("1 repo haussa");
    // The same view as Asetukset › Integraatiot, limited to Google.
    await expect(page.getByTestId("integration-tile-google")).toBeVisible();
    await expect(page.getByTestId("integration-tile-microsoft")).toHaveCount(0);
    await expect(page.getByTestId("integration-tile-imap")).toHaveCount(0);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    const go = button(page, "integration-onboarding-continue");
    await expect(go).toHaveAttribute("data-connected", "false");
    await go.click();
    await expect(heading(page, "pi-sign-in-title")).toBeVisible();
    await expectRoute(page, {
      github: "done",
      repositories: "done",
      google: "skipped",
      ai: "current",
    });
    await expect(step(page, "google")).toContainText("Ohitettu");
    // The clone queued at Continue runs while the person is in the AI step,
    // shown on the route's Repot row rather than in the step card.
    await expect(
      step(page, "repositories").getByTestId("onboarding-clones"),
    ).toBeVisible();
    await expect(
      page.getByTestId("onboarding-card").getByTestId("onboarding-clones"),
    ).toHaveCount(0);
  } finally {
    await page.request.get("/fixture/scenario?value=ready");
  }
});

test("@github-first continuing without repositories stays in the frame and Google leads back to the chooser", async ({
  page,
}) => {
  try {
    await start(page);
    await confirmGitIdentity(page);
    const proceed = button(page, "repository-proceed");
    await expect(proceed).toHaveText("Jatka ilman repoja");
    await proceed.click();
    await expect(heading(page, "integration-onboarding-title")).toBeVisible();
    await expectRoute(page, {
      github: "done",
      repositories: "skipped",
      google: "current",
      ai: "next",
    });
    await expect(step(page, "repositories")).toContainText("Ei repoja");
    await button(page, "integration-onboarding-back").click();
    await expect(heading(page, "repository-chooser-title")).toBeVisible();
    await expectRoute(page, {
      github: "done",
      repositories: "current",
      google: "next",
      ai: "next",
    });
    await proceed.click();
    await button(page, "integration-onboarding-continue").click();
    await expect(heading(page, "pi-sign-in-title")).toBeVisible();
    await expect(page.getByTestId("onboarding-clones")).toHaveCount(0);
    expect(await (await page.request.get("/fixture/clone-count")).text()).toBe(
      "0",
    );
  } finally {
    await page.request.get("/fixture/scenario?value=ready");
  }
});

test("@github-first Google connects in its step through the Settings dialog and the route says so", async ({
  page,
}) => {
  try {
    await start(page);
    await confirmGitIdentity(page);
    await button(page, "repository-proceed").click();
    await connectGoogle(page);
    const go = button(page, "integration-onboarding-continue");
    await expect(go).toHaveAttribute("data-connected", "true");
    await go.click();
    await expect(heading(page, "pi-sign-in-title")).toBeVisible();
    await expectRoute(page, {
      github: "done",
      repositories: "skipped",
      google: "done",
      ai: "current",
    });
    await expect(step(page, "google")).toContainText("Yhdistetty");
  } finally {
    await page.request.get("/fixture/scenario?value=ready");
  }
});

test("@github-first a server without Google has no Google step", async ({
  page,
}) => {
  // The catalog as a server whose operator has not configured Google.
  await page.route("**/api/v1/integrations", async (r) => {
    const reply = await r.fetch();
    const list = await reply.json();
    for (const p of list.providers) if (p.id === "google") p.available = false;
    await r.fulfill({ response: reply, json: list });
  });
  try {
    await start(page);
    await confirmGitIdentity(page);
    await expect(heading(page, "repository-chooser-title")).toBeVisible();
    await expectRoute(page, {
      github: "done",
      repositories: "current",
      ai: "next",
    });
    await button(page, "repository-proceed").click();
    await expect(heading(page, "pi-sign-in-title")).toBeVisible();
    await expect(heading(page, "integration-onboarding-title")).toHaveCount(0);
    await expectRoute(page, {
      github: "done",
      repositories: "skipped",
      ai: "current",
    });
  } finally {
    await page.request.get("/fixture/scenario?value=ready");
  }
});

test("@github-first a required step has no skip action and an optional one after it can be passed", async ({
  page,
}) => {
  try {
    // The site's order is the catalog's: Google before Microsoft.
    await start(page, "microsoft,google:required");
    await expectRoute(page, {
      github: "current",
      repositories: "next",
      google: "next",
      microsoft: "next",
      ai: "next",
    });
    await expect(step(page, "google")).toHaveAttribute("data-required", "true");
    await confirmGitIdentity(page);
    await button(page, "repository-proceed").click();
    const integration = page.getByTestId("integration-onboarding");
    await expect(heading(page, "integration-onboarding-title")).toBeFocused();
    await expect(integration).toHaveAttribute("data-provider", "google");
    // Required: no way on without an account, only back or abort.
    await expect(button(page, "integration-onboarding-continue")).toHaveCount(
      0,
    );
    await expect(button(page, "integration-onboarding-back")).toBeVisible();
    await connectGoogle(page);
    await button(page, "integration-onboarding-continue").click();
    await expect(integration).toHaveAttribute("data-provider", "microsoft");
    await expect(heading(page, "integration-onboarding-title")).toBeFocused();
    await expectRoute(page, {
      github: "done",
      repositories: "skipped",
      google: "done",
      microsoft: "current",
      ai: "next",
    });
    await expect(page.getByTestId("integration-tile-microsoft")).toBeVisible();
    await expect(page.getByTestId("integration-tile-google")).toHaveCount(0);
    // React Aria's announcer still points at the closed sign-in dialog.
    expect(
      (
        await new AxeBuilder({ page })
          .exclude("[data-live-announcer]")
          .analyze()
      ).violations,
    ).toEqual([]);
    const go = button(page, "integration-onboarding-continue");
    await expect(go).toHaveAttribute("data-connected", "false");
    await go.click();
    await expect(heading(page, "pi-sign-in-title")).toBeVisible();
    await expectRoute(page, {
      github: "done",
      repositories: "skipped",
      google: "done",
      microsoft: "skipped",
      ai: "current",
    });
  } finally {
    await page.request.get("/fixture/scenario?value=ready");
  }
});
