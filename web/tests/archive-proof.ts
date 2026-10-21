import { expect, type Page, type Request, type Route } from "@playwright/test";

const isArchive = (request: Request) =>
  request.method() === "POST" &&
  new URL(request.url()).pathname === "/api/v1/workspaces" &&
  request.postDataJSON()?.action === "conversation_archive";

// The UI may lose its native census between an enabled observation and onPress.
// Rediscover from a fresh view; never repeat a write with an unobserved reply.
export async function archiveFromConfirmedView(
  page: Page,
  button: () => ReturnType<Page["getByRole"]>,
) {
  const view = page.url();
  const uncertain = async (action: ReturnType<Page["getByRole"]>) => {
    if (!(await action.count())) return false;
    return (
      (await action.getAttribute("data-archive-state")) === "unknown" ||
      (await action.getAttribute("data-process-state")) === "unknown"
    );
  };
  for (let attempt = 0; attempt < 3; attempt++) {
    // Archiving leaves the conversation optimistically, even on a later
    // refusal. Reloading that workspace cannot rediscover its header action.
    if (attempt) {
      if (page.url() === view) await page.reload();
      else await page.goto(view);
    }
    const action = button();
    try {
      await expect(action).toBeEnabled(); // affirmative, current UI eligibility
    } catch (error) {
      // An unknown native census is not a denial and is not permission to write.
      // Rediscover once from a new view; a persistent unknown still fails.
      if (attempt === 2 || !(await uncertain(action))) throw error;
      continue;
    }
    let sent = false;
    let refusal: string | undefined;
    // Capture the refusal before delivering it to the app: response.json() on
    // the page response can wait forever when the page navigates during reply.
    // An unreadable or unfamiliar refusal is never permission to retry.
    let forwarding: Promise<void> | undefined;
    const forward = (route: Route) => {
      // Worktree listing is also a POST to this endpoint. It is not the
      // receipt of this archive and must not make us return before it settles.
      if (!isArchive(route.request())) return route.continue();
      forwarding = (async () => {
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
      })();
      return forwarding;
    };
    await page.route("**/api/v1/workspaces", forward);
    try {
      const response = page
        .waitForResponse((reply) => isArchive(reply.request()), {
          timeout: 5000,
        })
        .then(
          (reply) => ({ reply }),
          (error: unknown) => ({ error }),
        );
      await action.click();
      const result = await response;
      if ("error" in result) {
        // Only a withdrawn native census, not a busy or writer-denied button.
        if (sent || (await action.isEnabled()) || !(await uncertain(action)))
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
      await expect(page.getByTestId("archive-error")).toBeVisible();
      if (attempt === 2)
        throw new Error("archive census stayed uncertain after rediscovery");
    } finally {
      // The browser can receive the reply before fulfill() itself resolves.
      // Unrouting an in-flight handler can fall it through and handle it twice.
      await forwarding;
      await page.unroute("**/api/v1/workspaces", forward);
    }
  }
}
