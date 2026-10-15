import { expect, type Page } from "@playwright/test";

// The UI may lose its native census between an enabled observation and onPress.
// Rediscover from a fresh view; never repeat a write with an unobserved reply.
export async function archiveFromConfirmedView(
  page: Page,
  button: () => ReturnType<Page["getByRole"]>,
) {
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt) await page.reload();
    const action = button();
    try {
      await expect(action).toBeEnabled(); // affirmative, current UI eligibility
    } catch (error) {
      // An unknown native census is not a denial and is not permission to write.
      // Rediscover once from a new view; a persistent unknown still fails.
      if (
        attempt === 2 ||
        !(await action.getAttribute("title"))?.includes("Arkiston tila")
      )
        throw error;
      continue;
    }
    let sent = false;
    let refusal: string | undefined;
    // Capture the refusal before delivering it to the app: response.json() on
    // the page response can wait forever when the page navigates during reply.
    // An unreadable or unfamiliar refusal is never permission to retry.
    await page.route("**/api/v1/workspaces", async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      sent = true;
      const upstream = await route.fetch();
      if (upstream.status() === 409) {
        try {
          refusal = (await upstream.json()).error?.code;
        } catch {
          refusal = undefined;
        }
      }
      await route.fulfill({ response: upstream });
    });
    try {
      const response = page
        .waitForResponse(
          (reply) =>
            reply.request().method() === "POST" &&
            new URL(reply.url()).pathname === "/api/v1/workspaces",
          { timeout: 5000 },
        )
        .then(
          (reply) => ({ reply }),
          (error: unknown) => ({ error }),
        );
      await action.click();
      const result = await response;
      if ("error" in result) {
        // Only a withdrawn native census, not a busy or writer-denied button.
        if (
          sent ||
          (await action.isEnabled()) ||
          !(await action.getAttribute("title"))?.includes("Arkiston tila")
        )
          throw result.error;
        if (attempt === 2) throw result.error;
        continue;
      }
      const reply = result.reply;
      if (reply.status() === 200) {
        await expect(page).toHaveURL(/\/workspaces\/[^?]+$/);
        return;
      }
      expect(reply.status()).toBe(409);
      expect(refusal).toBe("control_uncertain");
      await expect(
        page.getByText("Arkistointia ei tehty:", { exact: false }),
      ).toBeVisible();
      if (attempt === 2)
        throw new Error("archive census stayed uncertain after rediscovery");
    } finally {
      await page.unroute("**/api/v1/workspaces");
    }
  }
}
