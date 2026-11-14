import { hostOrigin } from "../test-ports.mjs";
import { expect, test } from "./worker-host";

test.use({ baseURL: hostOrigin, ignoreHTTPSErrors: true });

test("a missing lazy editor chunk without a release offers reload, not an update, and preserves the draft", async ({
  page,
}) => {
  await page.goto("/workspaces");
  await page.getByTestId("github-sign-in").click();
  await page.locator('a[href*="code=42"]').click();
  await page
    .getByRole("navigation")
    .getByTestId("workspace-git-project")
    .click();
  await page.getByTestId("conversation-start").click();
  await expect(page).toHaveURL(/conversation=pi(?:%3A|:)/);
  await page
    .getByTestId("message-input")
    .fill("Unsent draft across a missing chunk");

  let missingRequests = 0;
  await page.route("**/assets/BrowserDocument-*.js", (route) => {
    missingRequests++;
    return route.fulfill({ status: 404, body: "" });
  });
  await page.getByTestId("toggle-editor").click();
  // The served index is unchanged, so no release removed the chunk: the
  // notice must not claim the server was updated.
  const banner = page.getByTestId("connection-part-failed");
  await expect(banner).toBeVisible();
  await expect(page.locator("[data-chunk-load-failed]")).toHaveAttribute(
    "data-chunk-load-failed",
    "current",
  );
  await expect(page.getByTestId("connection-version-changed")).toHaveCount(0);
  expect(missingRequests).toBeGreaterThan(0);
  await expect(page.getByTestId("connection-retry")).toHaveCount(0);
  // Neither React Router's raw failure nor the asset URL belongs on screen.
  await expect(page.locator("body")).not.toContainText(
    "Unexpected Application Error",
  );
  await expect(page.locator("body")).not.toContainText("BrowserDocument-");

  await page.unroute("**/assets/BrowserDocument-*.js");
  await banner.getByTestId("connection-reload").click();
  await expect(page.getByTestId("message-input")).toHaveValue(
    "Unsent draft across a missing chunk",
  );
  await expect(banner).toHaveCount(0);
  const toggle = page.getByTestId("toggle-editor");
  if ((await toggle.getAttribute("aria-pressed")) !== "true")
    await toggle.click();
  await expect(page.getByTestId("browser-editor")).toBeVisible();
});
