import AxeBuilder from "@axe-core/playwright";
import { hostOrigin } from "../test-ports.mjs";
import { confirmGitIdentity } from "./git-identity-helper";
import { expect, type Page, test } from "./worker-host";

// The Apple (iCloud) card against the synthetic host: the real gateway and
// daemon, the product's imap, caldav and carddav entries run against the
// fake himalaya and curl with Apple's own hosts. Same-UID synthetic
// evidence: it proves the browser/host contract, the composition of the
// card from the ordinary accounts and that the browser never carries the
// reused password, not a real Apple sign-in or Linux user isolation.

test.use({
  baseURL: hostOrigin,
  ignoreHTTPSErrors: true,
  viewport: { width: 1280, height: 900 },
});

const button = (scope: Page | ReturnType<Page["getByRole"]>, id: string) =>
  scope.getByRole("button").and(scope.getByTestId(id));

type Listed = {
  accounts: { provider: string; address: string; apple_id?: string }[];
};
const accounts = async (page: Page) =>
  ((await (await page.request.get("/api/v1/integrations")).json()) as Listed)
    .accounts;

async function signIn(page: Page) {
  await page.goto("/settings");
  await button(page, "github-sign-in").click();
  await page.getByRole("link").nth(0).click();
  await page.goto("/settings/integrations");
  await expect(page.getByTestId("integrations-loading")).toHaveCount(0);
}

test("Apple: chosen services connect with one password, another is added with the stored one, and all are removed", async ({
  page,
}) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await signIn(page);
  const tile = page.getByTestId("integration-tile-apple");
  await button(tile, "integration-connect-open").click();
  const guide = page.getByRole("dialog");
  await expect(guide.getByTestId("apple-step-choose")).toBeVisible();
  expect(
    (await new AxeBuilder({ page }).include('[role="dialog"]').analyze())
      .violations,
  ).toEqual([]);
  // Contacts only, for now.
  await guide.getByTestId("apple-want-mail").click();
  await guide.getByTestId("apple-want-calendar").click();
  await button(guide, "apple-next").click();
  await expect(guide.getByTestId("apple-how")).toBeVisible();
  await button(guide, "apple-skip").click();
  await guide.getByTestId("apple-id").fill("Person@iCloud.com");
  // Apple refuses the password: nothing is saved.
  await guide.getByTestId("apple-password").fill("wrong-password");
  await button(guide, "apple-connect").click();
  await expect(guide.getByTestId("apple-error")).toBeVisible();
  expect(await accounts(page)).toEqual([]);
  await guide.getByTestId("apple-password").fill("abcd-efgh-ijkl-mnop");
  await button(guide, "apple-connect").click();
  await expect(guide.getByTestId("apple-result-contacts")).toHaveAttribute(
    "data-ok",
    "true",
  );
  await button(guide, "apple-finish").click();

  const card = page
    .getByRole("article")
    .and(page.getByTestId("integration-apple-card"));
  await expect(card.getByTestId("integration-service-contacts")).toBeVisible();
  // The CardDAV account is the Apple card's, not a generic card.
  await expect(page.getByTestId("integration-account-carddav")).toHaveCount(0);
  await expect(page.getByTestId("integration-tile-apple")).toHaveCount(0);

  // Later: mail and calendar with the same password, which the browser
  // neither asks for nor sends.
  await button(card, "integration-apple-add").click();
  await expect(guide.getByTestId("apple-step-choose")).toBeVisible();
  await button(guide, "apple-next").click();
  await expect(guide.getByTestId("apple-password")).toHaveCount(0);
  await expect(guide.getByTestId("apple-reuse")).toBeVisible();
  const sent = page.waitForRequest(
    (r) => r.url().endsWith("/api/v1/integrations/accounts") && r.method() === "POST",
  );
  await button(guide, "apple-connect").click();
  expect((await sent).postDataJSON()).toEqual({
    action: "add",
    provider: "apple",
    address: "person@icloud.com",
    services: ["mail", "calendar"],
  });
  await expect(guide.getByTestId("apple-result-mail")).toHaveAttribute(
    "data-ok",
    "true",
  );
  await expect(guide.getByTestId("apple-result-calendar")).toHaveAttribute(
    "data-ok",
    "true",
  );
  await button(guide, "apple-finish").click();
  for (const s of ["mail", "calendar", "contacts"])
    await expect(card.getByTestId(`integration-service-${s}`)).toBeVisible();
  await expect(card.getByTestId("integration-apple-missing")).toHaveCount(0);
  expect(
    (await accounts(page)).map((a) => [a.provider, a.address, a.apple_id]).sort(),
  ).toEqual([
    ["caldav", "person@icloud.com", "person@icloud.com"],
    ["carddav", "person@icloud.com", "person@icloud.com"],
    ["imap", "person@icloud.com", "person@icloud.com"],
  ]);

  await button(card, "integration-remove-open").click();
  const confirm = page.getByRole("alertdialog");
  await button(confirm, "integration-remove-confirm").click();
  await expect(card).toHaveCount(0);
  await expect(page.getByTestId("integration-tile-apple")).toBeVisible();
  expect(await accounts(page)).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test("@github-first Apple is an onboarding step of its own, shown with the same tile and card", async ({
  page,
}) => {
  try {
    expect(
      (await page.request.get("/fixture/onboarding?integrations=apple"))
        .status(),
    ).toBe(204);
    await page.request.get("/fixture/scenario?value=pi-onboarding");
    await page.request.get("/fixture/pi-state?value=missing");
    await page.goto("/workspaces");
    await button(page, "github-sign-in").click();
    await page.getByRole("link").nth(0).click();
    await confirmGitIdentity(page);
    await button(page, "repository-proceed").click();
    const step = page.getByTestId("integration-onboarding");
    await expect(step).toHaveAttribute("data-provider", "apple");
    // Only Apple: no generic or other provider tiles in this step.
    await expect(page.getByTestId(/^integration-tile-/)).toHaveCount(1);
    await expect(
      button(page, "integration-onboarding-continue"),
    ).toHaveAttribute("data-connected", "false");
    await button(
      page.getByTestId("integration-tile-apple"),
      "integration-connect-open",
    ).click();
    const guide = page.getByRole("dialog");
    await button(guide, "apple-next").click();
    await button(guide, "apple-skip").click();
    await guide.getByTestId("apple-id").fill("person@example.test");
    // Mail is chosen and this Apple ID is no iCloud address.
    await expect(button(guide, "apple-connect")).toBeDisabled();
    await guide.getByTestId("apple-mail-address").fill("person@icloud.com");
    await guide.getByTestId("apple-password").fill("abcd-efgh-ijkl-mnop");
    await button(guide, "apple-connect").click();
    await expect(guide.getByTestId("apple-result")).toBeVisible();
    await button(guide, "apple-finish").click();
    await expect(page.getByTestId("integration-apple-card")).toBeVisible();
    const go = button(page, "integration-onboarding-continue");
    await expect(go).toHaveAttribute("data-connected", "true");
    await go.click();
    await expect(
      page.getByRole("navigation", { name: "Käyttöönoton vaiheet" })
        .getByTestId("onboarding-step-apple"),
    ).toHaveAttribute("data-state", "done");
  } finally {
    await page.request.get("/fixture/scenario?value=ready");
  }
});
