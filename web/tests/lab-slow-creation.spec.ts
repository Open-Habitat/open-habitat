import { expect, test } from "./lab-host";

for (const surface of ["home", "workspace", "sidebar"] as const) {
  test(`@placeholder slow native startup keeps ${surface} + in its new conversation`, async ({
    page,
  }) => {
    await page.goto("/workspaces");
    await page
      .getByRole("button")
      .and(page.getByTestId("github-sign-in"))
      .click();
    await page
      .getByRole("link")
      .and(page.locator('a[href*="code=42"]'))
      .click();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    if (surface === "workspace") {
      await page
        .getByRole("navigation")
        .getByRole("link")
        .and(page.getByTestId("workspace-aurinkokello"))
        .click();
    }
    await page.request.get("/fixture/scenario?value=pi-slow-start");
    let posts = 0;
    page.on("request", (request) => {
      if (
        request.url().endsWith("/api/v1/conversations") &&
        request.method() === "POST"
      )
        posts++;
    });
    const button =
      surface === "workspace"
        ? page.getByRole("button").and(page.getByTestId("conversation-start"))
        : page
            .locator(surface === "home" ? "main" : "nav")
            .getByRole("button")
            .and(page.getByTestId("workspace-start-aurinkokello"));
    await expect(button).toBeEnabled();
    // Capture the reply on its way to the page. Chromium can drop a page
    // response's body before Playwright asks for it, even when it is read
    // as soon as it arrives and no document navigation follows.
    let capture: (reply: { status: number; body: string }) => void = () => {};
    const response = new Promise<{ status: number; body: string }>(
      (resolve) => {
        capture = resolve;
      },
    );
    await page.route("**/api/v1/conversations", async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      const upstream = await route.fetch();
      capture({ status: upstream.status(), body: await upstream.text() });
      await route.fulfill({ response: upstream });
    });
    const began = Date.now();
    await button.click();
    const created = await response;
    expect(created.status).toBe(200);
    const session = JSON.parse(created.body);
    await expect(page).toHaveURL(/conversation=(new|pi:)/);
    // The field is usable at once (Jari 16.10.2026).
    await expect(
      page.getByRole("textbox").and(page.getByTestId("message-input")),
    ).toBeEnabled();
    // Pi's own start takes six seconds here, beyond the real five-second Unix
    // HTTP response deadline. The creation reply no longer waits for it: the
    // daemon replies once the child exists and holds messages until Pi runs.
    expect(Date.now() - began).toBeLessThan(4000);
    expect(session.state).toBe("starting");
    await page.request.get("/fixture/scenario?value=ready");
    await expect(page).toHaveURL(
      new RegExp(`conversation=${session.agent_id}$`),
    );
    await expect(
      page.getByRole("textbox").and(page.getByTestId("message-input")),
    ).toBeEnabled();
    // The creation invalidation and an explicit fresh read must not send the
    // person back to the workspace once a successful reply selected the child.
    await page.reload();
    await expect(page).toHaveURL(
      new RegExp(`conversation=${session.agent_id}$`),
    );
    await expect(
      page.getByRole("textbox").and(page.getByTestId("message-input")),
    ).toBeEnabled();
    expect(posts).toBe(1);
  });
}
