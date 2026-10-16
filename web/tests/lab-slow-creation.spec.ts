import { expect, test } from "./lab-host";

for (const surface of ["home", "workspace", "sidebar"] as const) {
  test(`@placeholder slow native startup keeps ${surface} + in its new conversation`, async ({
    page,
  }) => {
    await page.goto("/workspaces");
    await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
    await page.getByRole("link", { name: "Alice", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Työtilat", exact: true }),
    ).toBeVisible();
    if (surface === "workspace") {
      await page
        .getByRole("navigation")
        .getByRole("link", { name: "aurinkokello", exact: true })
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
        ? page.getByRole("button", {
            name: "Aloita uusi Pi-keskustelu",
            exact: true,
          })
        : page
            .locator(surface === "home" ? "main" : "nav")
            .getByRole("button", {
              name: "Uusi keskustelu työtilassa aurinkokello",
              exact: true,
            });
    await expect(button).toBeEnabled();
    const response = page.waitForResponse(
      (r) =>
        r.url().endsWith("/api/v1/conversations") &&
        r.request().method() === "POST",
    );
    await button.click();
    await expect(page).toHaveURL(/conversation=new$/);
    await expect(
      page.locator(".ah-conversation-frame").getByRole("status"),
    ).toHaveText("Luodaan keskustelua…");
    await expect(
      page.getByRole("textbox", { name: "Viesti Pi:lle" }),
    ).toBeDisabled();
    // This reply crosses a real five-second Unix HTTP response deadline.
    // Delaying Playwright's route.continue would not exercise that boundary.
    const created = await response;
    expect(created.status()).toBe(200);
    const session = await created.json();
    await page.request.get("/fixture/scenario?value=ready");
    await expect(page).toHaveURL(
      new RegExp(`conversation=${session.agent_id}$`),
    );
    await expect(
      page.getByRole("textbox", { name: "Viesti Pi:lle" }),
    ).toBeEnabled();
    // The creation invalidation and an explicit fresh read must not send the
    // person back to the workspace once a successful reply selected the child.
    await page.reload();
    await expect(page).toHaveURL(
      new RegExp(`conversation=${session.agent_id}$`),
    );
    await expect(
      page.getByRole("textbox", { name: "Viesti Pi:lle" }),
    ).toBeEnabled();
    expect(posts).toBe(1);
  });
}
