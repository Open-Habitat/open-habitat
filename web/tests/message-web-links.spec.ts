import { hostOrigin } from "../test-ports.mjs";
import { expect, test } from "./worker-host";

test.use({ baseURL: hostOrigin, ignoreHTTPSErrors: true });

test("message web addresses open a new tab, not the workspace editor", async ({
  page,
  context,
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
    .fill(
      "`portal.azure.com` [Entra](entra.microsoft.com) https://shell.azure.com docs/asennus.md notes.txt",
    );
  await page.getByTestId("send").click();
  // No request leaves the synthetic browser context.
  await context.route("https://portal.azure.com/**", (route) =>
    route.fulfill({ body: "synthetic destination" }),
  );
  const reply = page.getByTestId("agent-turn");
  const web = reply.locator('a[href="https://portal.azure.com"]');
  await expect(web).toBeVisible();
  const popupPromise = page.waitForEvent("popup");
  await web.click();
  const popup = await popupPromise;
  await expect(popup).toHaveURL("https://portal.azure.com/");
  await expect(page.getByTestId("editor-document")).toHaveCount(0);
  await expect(
    reply.locator('a[href="https://entra.microsoft.com"]'),
  ).toHaveAttribute("target", "_blank");
  await expect(
    reply.locator('a[href="https://shell.azure.com"]'),
  ).toHaveAttribute("target", "_blank");
  await expect(
    reply.locator("a.ah-file-link").filter({ hasText: "docs/asennus.md" }),
  ).toBeVisible();
  await expect(
    reply.locator("a.ah-file-link").filter({ hasText: "notes.txt" }),
  ).toBeVisible();
  await popup.close();
});
