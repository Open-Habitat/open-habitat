import AxeBuilder from "@axe-core/playwright";
import { hostOrigin } from "../test-ports.mjs";
import { expect, test } from "./worker-host";

test.use({ baseURL: hostOrigin, ignoreHTTPSErrors: true });

type Native = {
  accounts: {
    provider: string;
    address: string;
    level?: string;
    grant?: { granted: string[] };
  }[];
};

test("experimental Trello adds separate native connections, each with its own grant", async ({
  page,
  context,
}) => {
  await context.route("https://auth.atlassian.com/**", (route) =>
    route.fulfill({ body: "Synthetic consent" }),
  );
  await page.goto("/settings");
  await page.getByTestId("github-sign-in").click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  await page.goto("/settings/agent-data");
  await expect(page.getByTestId("integrations-loading")).toHaveCount(0);
  await expect(page.getByTestId("integration-tile-trello")).toHaveCount(0);
  const session = await (await page.request.get("/auth/session")).json();
  expect(
    (
      await page.request.put("/api/v1/account/preferences", {
        headers: {
          Origin: new URL(page.url()).origin,
          "X-Agent-Host-CSRF": session.csrf,
        },
        data: { experimental: { "trello-connect": true } },
      })
    ).ok(),
  ).toBe(true);
  await page.reload();
  const trello = async () =>
    (
      (await (await page.request.get("/api/v1/integrations")).json()) as Native
    ).accounts.filter((a) => a.provider === "trello");
  const connect = async (level: "read" | "full") => {
    const dialog = page.getByRole("dialog");
    if (level === "full")
      await dialog.getByTestId("integration-level-full").click();
    else
      await expect(
        dialog.getByTestId("integration-level-read").getByRole("radio"),
      ).toBeChecked();
    await expect(dialog.getByTestId("trello-approval-request")).toBeVisible();
    await dialog.getByTestId("integration-continue").click();
    const link = dialog.getByTestId("integration-provider-link");
    const authorization = new URL((await link.getAttribute("href")) ?? "");
    const scope = authorization.searchParams.get("scope") ?? "";
    expect(scope.includes("write:")).toBe(level === "full");
    await link.click();
    await expect(dialog.getByTestId("trello-approval-request")).toBeVisible();
    await dialog
      .getByTestId("integration-redirect-input")
      .fill(
        "http://127.0.0.1:45678/callback?code=fixture-code&state=fixture-state",
      );
    await dialog.getByTestId("integration-connect").click();
    await expect(dialog.getByTestId("integration-connected")).toBeVisible();
    return dialog;
  };
  await page
    .getByTestId("integration-tile-trello")
    .getByTestId("integration-connect-open")
    .click();
  const first = await connect("read");
  await first.getByTestId("dialog-close").click();
  await expect(page.getByTestId("integration-account-trello")).toHaveCount(1);
  // A second connection is added beside the first rather than refused.
  await page.getByTestId("integration-add-trello").click();
  const second = await connect("full");
  const accessibility = await new AxeBuilder({ page })
    .include('[role="dialog"]')
    .analyze();
  expect(accessibility.violations).toEqual([]);
  await second.getByTestId("dialog-close").click();
  await expect(page.getByTestId("integration-account-trello")).toHaveCount(2);
  const accounts = await trello();
  expect(
    accounts.map((a) => [a.address, a.level]).sort((a, b) => (a < b ? -1 : 1)),
  ).toEqual([
    ["open_habitat_trello", "read"],
    ["open_habitat_trello_2", "full"],
  ]);
  expect(
    accounts.find((a) => a.address === "open_habitat_trello")?.grant?.granted,
  ).not.toContain("write:board:trello");
  // Removing one connection leaves the other's native sign-in.
  await page
    .getByRole("article", { name: /open_habitat_trello_2/ })
    .getByTestId("integration-remove-open")
    .click();
  await page.getByTestId("integration-remove-confirm").click();
  await expect(page.getByTestId("integration-account-trello")).toHaveCount(1);
  expect((await trello()).map((a) => [a.address, a.level])).toEqual([
    ["open_habitat_trello", "read"],
  ]);
  expect(
    JSON.stringify(
      await (await page.request.get("/api/v1/integrations")).json(),
    ),
  ).not.toContain("synthetic-never-real");
});
