import { expect, test } from "./lab-host";

for (const surface of ["settings-sidebar", "home", "workspace"] as const) {
  test(`@sidebar-default saved default reaches ${surface} without reload`, async ({
    page,
  }) => {
    await page.goto("/workspaces");
    await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
    await page.getByRole("link", { name: "Alice", exact: true }).click();
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
    await nav.getByRole("link", { name: "aurinkokello", exact: true }).click();
    const workspaceURL = page.url();
    await page.getByRole("button", { name: /Tilivalikko/ }).click();
    await page
      .getByRole("menuitem", { name: "Asetukset", exact: true })
      .click();
    await page.getByRole("button", { name: "Agentit", exact: true }).click();
    const saved = page.waitForResponse(
      (r) =>
        r.url().endsWith("/api/v1/pi/models") &&
        r.request().method() === "POST",
    );
    await page.getByRole("radio", { name: /GPT-6.1 Sol/ }).click();
    expect((await saved).status()).toBe(200);
    await expect(
      page.getByRole("radio", { name: /GPT-6.1 Sol/ }),
    ).toBeChecked();
    const sidebarPlus = nav.getByRole("button", {
      name: "Uusi keskustelu työtilassa aurinkokello",
      exact: true,
    });
    // No Back, navigation, reload or focus event to repair a stale observation.
    await expect(sidebarPlus).toBeEnabled();
    let plus = sidebarPlus;
    if (surface === "home") {
      await nav.getByRole("link", { name: "Etusivu", exact: true }).click();
      plus = page.locator("main").getByRole("button", {
        name: "Uusi keskustelu työtilassa aurinkokello",
        exact: true,
      });
    } else if (surface === "workspace") {
      await page.getByRole("button", { name: "Takaisin", exact: true }).click();
      await expect(page).toHaveURL(workspaceURL);
      plus = page.getByRole("button", {
        name: "Aloita uusi Pi-keskustelu",
        exact: true,
      });
      const actions = page.getByRole("group", {
        name: "Työtilan toiminnot",
        exact: true,
      });
      await expect(actions.getByRole("button")).toHaveCount(7);
      await expect(
        actions.getByRole("button", { name: "Kopioi polku", exact: true }),
      ).toBeVisible();
    }
    await expect(
      nav
        .locator(".ah-workspace-row")
        .getByRole("button", { name: /toiminnot/ }),
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
      page.getByRole("textbox", { name: "Viesti Pi:lle" }),
    ).toBeEnabled();
    expect(creates).toHaveLength(1);
    if (surface === "workspace") {
      // Conversation-header return and direct-load routes use the same page.
      await page.locator(".ah-header-workspace").click();
      await expect(page).toHaveURL(workspaceURL);
      await expect(
        page.getByRole("group", { name: "Työtilan toiminnot", exact: true }),
      ).toBeVisible();
      await page.reload();
      await expect(
        page
          .getByRole("group", { name: "Työtilan toiminnot", exact: true })
          .getByRole("button"),
      ).toHaveCount(7);
      await expect(
        page.getByRole("button", {
          name: "Aloita uusi Pi-keskustelu",
          exact: true,
        }),
      ).toBeEnabled();
    }
    expect(
      (await (await page.request.get("/api/v1/pi/models")).json())
        .default_model,
    ).toBe("gpt-6.1-sol");
  });
}
