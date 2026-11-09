import AxeBuilder from "@axe-core/playwright";
import { hostOrigin } from "../test-ports.mjs";
import { expect, test } from "./worker-host";

test.use({ baseURL: hostOrigin, ignoreHTTPSErrors: true });

test("experimental Atlassian uses the native RPC relay and shows the grant, not just the request", async ({
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
  await expect(page.getByTestId("integration-tile-atlassian")).toHaveCount(0);
  const session = await (await page.request.get("/auth/session")).json();
  expect(
    (
      await page.request.put("/api/v1/account/preferences", {
        headers: {
          Origin: new URL(page.url()).origin,
          "X-Agent-Host-CSRF": session.csrf,
        },
        data: { experimental: { "atlassian-connect": true } },
      })
    ).ok(),
  ).toBe(true);
  await page.reload();
  await page
    .getByTestId("integration-tile-atlassian")
    .getByTestId("integration-connect-open")
    .click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByTestId("integration-level-read").getByRole("radio"),
  ).toBeChecked();
  await dialog.getByTestId("integration-continue").click();
  await expect(dialog.getByTestId("atlassian-approval-request")).toBeVisible();
  const link = dialog.getByTestId("integration-provider-link");
  const authorization = new URL((await link.getAttribute("href")) ?? "");
  expect(authorization.searchParams.get("scope")).not.toContain("write:");
  await link.click();
  await expect(dialog.getByTestId("atlassian-approval-request")).toBeVisible();
  await dialog
    .getByTestId("integration-redirect-input")
    .fill(
      "http://127.0.0.1:45678/callback?code=fixture-code&state=fixture-state",
    );
  await dialog.getByTestId("integration-connect").click();
  await expect(dialog.getByTestId("integration-connected")).toBeVisible();
  const native = await (await page.request.get("/api/v1/integrations")).json();
  const account = native.accounts.find(
    (a: { provider: string }) => a.provider === "atlassian",
  );
  expect(account.level).toBe("read");
  expect(account.grant.granted).toContain("read:jira:agent-interface");
  expect(JSON.stringify(native)).not.toContain("synthetic-never-real");
  const accessibility = await new AxeBuilder({ page })
    .include('[role="dialog"]')
    .analyze();
  expect(accessibility.violations).toEqual([]);
});
