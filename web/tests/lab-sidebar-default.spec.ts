import { expect, test } from "./lab-host";

for (const surface of ["settings-sidebar", "home", "workspace"] as const) {
  test(`@sidebar-default saved default reaches ${surface} without reload`, async ({
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
    // Seed a known-refused native default. Saving a healthy one must update
    // admission too, not merely the settings radio (or the provider's catalog).
    const { csrf } = await (await page.request.get("/auth/session")).json();
    expect(
      (
        await page.request.post("/api/v1/pi/models", {
          headers: {
            "X-Agent-Host-CSRF": csrf,
            Origin: new URL(page.url()).origin,
          },
          data: { model: "gpt-5.5", thinking: "off" },
        })
      ).status(),
    ).toBe(200);
    const nav = page.getByRole("navigation");
    await nav
      .getByRole("link")
      .and(page.getByTestId("workspace-aurinkokello"))
      .click();
    const workspaceURL = page.url();
    await page
      .getByRole("button")
      .and(page.getByTestId("account-menu-trigger"))
      .click();
    await page
      .getByRole("menuitem")
      .and(page.getByTestId("menu-settings"))
      .click();
    await page
      .getByRole("link")
      .and(page.getByTestId("settings-tekoaly"))
      .click();
    await page
      .getByRole("button")
      .and(page.getByTestId("default-model-trigger"))
      .click();
    const saved = page.waitForResponse(
      (r) =>
        r.url().endsWith("/api/v1/pi/models") &&
        r.request().method() === "POST",
    );
    await page
      .getByRole("radio")
      .and(page.getByTestId("model-gpt-6.1-sol"))
      .click();
    expect((await saved).status()).toBe(200);
    await expect(
      page.getByRole("radio").and(page.getByTestId("model-gpt-6.1-sol")),
    ).toBeChecked();
    const sidebarPlus = nav
      .getByRole("button")
      .and(page.getByTestId("workspace-start-aurinkokello"));
    // No Back, navigation, reload or focus event to repair a stale observation.
    await expect(sidebarPlus).toBeEnabled();
    let plus = sidebarPlus;
    if (surface === "home") {
      await nav.getByRole("link").and(page.getByTestId("home-link")).click();
      plus = page
        .locator("main")
        .getByRole("button")
        .and(page.getByTestId("workspace-start-aurinkokello"));
    } else if (surface === "workspace") {
      await page
        .getByRole("button")
        .and(page.getByTestId("settings-close"))
        .click();
      await expect(page).toHaveURL(workspaceURL);
      plus = page
        .getByRole("button")
        .and(page.getByTestId("conversation-start"));
      const actions = page
        .getByRole("group")
        .and(page.getByTestId("workspace-actions"));
      await expect(actions.getByRole("button")).toHaveCount(7);
      await expect(
        actions.getByRole("button").and(page.getByTestId("copy-path")),
      ).toBeVisible();
    }
    await expect(
      nav
        .locator(".ah-workspace-row")
        .getByRole("button")
        .and(page.getByTestId("workspace-menu")),
    ).toHaveCount(0);
    const creates: unknown[] = [];
    page.on("request", (request) => {
      if (
        request.method() === "POST" &&
        new URL(request.url()).pathname === "/api/v1/conversations"
      )
        creates.push(request.postDataJSON());
    });
    await plus.click();
    await expect(
      page.getByRole("textbox").and(page.getByTestId("message-input")),
    ).toBeEnabled();
    expect(creates).toHaveLength(1);
    if (surface === "workspace") {
      // Conversation-header return and direct-load routes use the same page.
      await page.locator(".ah-header-workspace").click();
      await expect(page).toHaveURL(workspaceURL);
      await expect(
        page.getByRole("group").and(page.getByTestId("workspace-actions")),
      ).toBeVisible();
      await page.reload();
      await expect(
        page
          .getByRole("group")
          .and(page.getByTestId("workspace-actions"))
          .getByRole("button"),
      ).toHaveCount(7);
      await expect(
        page.getByRole("button").and(page.getByTestId("conversation-start")),
      ).toBeEnabled();
    }
    expect(
      (await (await page.request.get("/api/v1/pi/models")).json())
        .default_model,
    ).toBe("gpt-6.1-sol");
  });
}
