import { hostOrigin } from "../test-ports.mjs";
import { expect, test } from "./worker-host";

test.use({ baseURL: hostOrigin, ignoreHTTPSErrors: true });

// upgrade-announced-to-agents (Jari 23.11.): root's host upgrade announces
// when it begins stopping Habitat. Every person's page shows a non-modal
// banner with the local time and the minutes left, keeps drafts and sending,
// turns into "starting" (never "complete") when the deadline passes, and
// says so when the operator cancels or the owner stops renewing.
test("@upgrade-notice the announced upgrade shows as a banner that keeps the person's draft", async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.request.get("/fixture/conversations-reset");
  await page.request.get("/fixture/scenario?value=ready");
  await page.goto("/workspaces");
  await page.getByTestId("github-sign-in").click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  const nav = page.getByTestId("workspace-navigation");
  await nav.getByTestId("workspace-ordinary-dir").click();
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  await expect(page).toHaveURL(/conversation=pi(?:%3A|:)/);
  await page.getByTestId("message-input").fill("luonnos kesken");

  const banner = page.getByTestId("upgrade-banner");
  await expect(banner).toHaveCount(0);
  expect(
    (
      await page.request.get(
        "/fixture/upgrade-notice?status=countdown&seconds=120",
      )
    ).status(),
  ).toBe(204);
  await expect(banner).toHaveAttribute("data-state", "countdown", {
    timeout: 15000,
  });
  await expect(banner).toContainText(/Habitat päivitetään klo \d{1,2}\.\d{2}/);
  await expect(banner).toContainText("noin 2 minuutin kuluttua");
  await expect(page.getByTestId("message-input")).toHaveValue("luonnos kesken");
  await expect(page.getByTestId("send")).toBeEnabled();

  await page.request.get("/fixture/upgrade-notice?status=withdrawn");
  await expect(banner).toHaveAttribute("data-state", "withdrawn", {
    timeout: 15000,
  });
  await expect(banner).toContainText("Päivitys peruttiin");

  // A fresh schedule whose deadline passes reads as starting.
  await page.request.get("/fixture/upgrade-notice?status=countdown&seconds=2");
  await expect(banner).toHaveAttribute("data-state", /countdown|starting/, {
    timeout: 15000,
  });
  await expect(banner).toHaveAttribute("data-state", "starting", {
    timeout: 15000,
  });
  await expect(banner).toContainText("Päivitys alkaa");

  await page.request.get("/fixture/upgrade-notice?status=unknown");
  await expect(banner).toHaveAttribute("data-state", "unknown", {
    timeout: 15000,
  });

  await page.request.get("/fixture/upgrade-notice?status=clear");
  await expect(banner).toHaveCount(0, { timeout: 15000 });
  await expect(page.getByTestId("message-input")).toHaveValue("luonnos kesken");
});
