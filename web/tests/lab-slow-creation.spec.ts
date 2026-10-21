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
    const response = page.waitForResponse(
      (r) =>
        r.url().endsWith("/api/v1/conversations") &&
        r.request().method() === "POST",
    );
    const began = Date.now();
    await button.click();
    await expect(page).toHaveURL(/conversation=(new|pi:)/);
    // The field is usable at once (Jari 16.10.2026).
    await expect(
      page.getByRole("textbox").and(page.getByTestId("message-input")),
    ).toBeEnabled();
    // Pi's own start takes six seconds here, beyond the real five-second Unix
    // HTTP response deadline. The creation reply no longer waits for it: the
    // daemon replies once the child exists and holds messages until Pi runs.
    const created = await response;
    expect(created.status()).toBe(200);
    expect(Date.now() - began).toBeLessThan(4000);
    const session = await created.json();
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
