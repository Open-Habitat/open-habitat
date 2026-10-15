import { expect, test } from "./worker-host";
import { hostOrigin } from "../test-ports.mjs";

test.use({ baseURL: hostOrigin, ignoreHTTPSErrors: true });

test("@resilience failed reads recover in place without claiming an empty catalog", async ({
  page,
}) => {
  await page.request.get("/fixture/scenario?value=ready");
  await page.goto("/workspaces");
  await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
  await page.getByRole("link", { name: "Alice", exact: true }).click();
  await expect(
    page.getByRole("navigation", { name: "Työtilat ja keskustelut" }),
  ).toBeVisible();
  await page.route("**/api/v1/snapshot", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: '{"schema_version":1}',
    }),
  );
  await page.getByRole("button", { name: "Päivitä", exact: true }).click();
  await expect(
    page.getByText("Yhteys katkesi · tiedot voivat olla vanhoja"),
  ).toBeVisible();
  await expect(
    page.getByRole("navigation").getByRole("link", { name: "ordinary-dir" }),
  ).toBeVisible();
  await page.unroute("**/api/v1/snapshot");
  await page.getByRole("button", { name: /Yhdistä|Yritä uudelleen/ }).click();
  await expect(
    page.getByRole("navigation").getByRole("link", { name: "ordinary-dir" }),
  ).toBeVisible();
  await page.request.get("/fixture/scenario?value=malformed");
  await page.getByRole("button", { name: "Päivitä", exact: true }).click();
  await expect(
    page.getByRole("navigation").getByRole("link", { name: "ordinary-dir" }),
  ).toBeVisible();
  await expect(
    page.getByText("Yhteys katkesi · tiedot voivat olla vanhoja"),
  ).toBeVisible();
});

test("@resilience native discovery error retains previously verified content", async ({
  page,
}) => {
  await page.request.get("/fixture/scenario?value=ready");
  await page.goto("/workspaces");
  await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
  await page.getByRole("link", { name: "Alice", exact: true }).click();
  await expect(
    page.getByRole("navigation").getByRole("link", { name: "ordinary-dir" }),
  ).toBeVisible();
  await page.request.get("/fixture/scenario?value=error");
  await page.getByRole("button", { name: "Päivitä", exact: true }).click();
  await expect(
    page.getByText("Yhteys katkesi · tiedot voivat olla vanhoja"),
  ).toBeVisible();
  await expect(
    page.getByRole("navigation").getByRole("link", { name: "ordinary-dir" }),
  ).toBeVisible();
  await page.screenshot({ path: "test-results/evidence/stale-discovery.png" });
  await page.request.get("/fixture/scenario?value=ready");
  await page.getByRole("button", { name: /Yhdistä|Yritä uudelleen/ }).click();
  await expect(
    page.getByText("Yhteys katkesi · tiedot voivat olla vanhoja"),
  ).toHaveCount(0);
});

test("@resilience verified session retains workspaces during a host outage, disables writes and retries", async ({
  page,
}) => {
  await page.request.get("/fixture/scenario?value=ready");
  await page.goto("/workspaces");
  await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
  await page.getByRole("link", { name: "Alice", exact: true }).click();
  await expect(
    page.getByRole("navigation").getByRole("link", { name: "ordinary-dir" }),
  ).toBeVisible();
  await page.route("**/api/v1/snapshot", (route) =>
    route.fulfill({ status: 500, body: "unavailable" }),
  );
  await page.getByRole("button", { name: "Päivitä", exact: true }).click();
  await expect(
    page.getByText("Yhteys katkesi · tiedot voivat olla vanhoja"),
  ).toBeVisible();
  await expect(
    page.getByRole("navigation").getByRole("link", { name: "ordinary-dir" }),
  ).toBeVisible();
  await page.unroute("**/api/v1/snapshot");
  await page.getByRole("button", { name: /Yhdistä|Yritä uudelleen/ }).click();
  await expect(
    page.getByText("Yhteys katkesi · tiedot voivat olla vanhoja"),
  ).toHaveCount(0);
  // A stopped host drops the transport rather than returning a 5xx.
  await page.route("**/api/v1/snapshot", (route) => route.abort());
  await page.getByRole("button", { name: "Päivitä", exact: true }).click();
  await expect(
    page.getByText("Yhteys katkesi · tiedot voivat olla vanhoja"),
  ).toBeVisible();
  await expect(
    page.getByRole("navigation").getByRole("link", { name: "ordinary-dir" }),
  ).toBeVisible();
  await page.unroute("**/api/v1/snapshot");
  await page.route("**/api/v1/snapshot", (route) =>
    route.fulfill({ status: 503, body: "daemon stopped" }),
  );
  await page.getByRole("button", { name: /Yhdistä|Yritä uudelleen/ }).click();
  await expect(
    page.getByText("Yhteys katkesi · tiedot voivat olla vanhoja"),
  ).toBeVisible();
  await expect(
    page.getByRole("navigation").getByRole("link", { name: "ordinary-dir" }),
  ).toBeVisible();
  await page.unroute("**/api/v1/snapshot");
  await page.request.get("/fixture/scenario?value=delay");
  await page.getByRole("button", { name: /Yhdistä|Yritä uudelleen/ }).click();
  await expect(
    page.getByText("Yhteys katkesi · tiedot voivat olla vanhoja"),
  ).toHaveCount(0);
  await expect(
    page.getByRole("navigation").getByRole("link", { name: "ordinary-dir" }),
  ).toBeVisible();
});

test("@resilience expired session reaches login on explicit retry, not tab focus", async ({
  page,
}) => {
  await page.request.get("/fixture/scenario?value=ready");
  await page.goto("/workspaces");
  await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
  await page.getByRole("link", { name: "Alice", exact: true }).click();
  await expect(
    page.getByRole("navigation").getByRole("link", { name: "ordinary-dir" }),
  ).toBeVisible();
  await page.route("**/api/v1/snapshot", (route) =>
    route.fulfill({ status: 500, body: "unavailable" }),
  );
  await page.getByRole("button", { name: "Päivitä", exact: true }).click();
  await expect(
    page.getByText("Yhteys katkesi · tiedot voivat olla vanhoja"),
  ).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await page.request.get("/fixture/expire");
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(
    page.getByRole("button", { name: "Kirjaudu GitHubilla" }),
  ).toHaveCount(0);
  await page.unroute("**/api/v1/snapshot");
  await page.getByRole("button", { name: "Yhdistä" }).click();
  await expect(
    page.getByRole("button", { name: "Kirjaudu GitHubilla" }),
  ).toBeVisible();
  await expect(page.getByText("ordinary-dir")).toHaveCount(0);
});

test("@resilience populated native history remains readable during outage", async ({
  page,
}) => {
  await page.request.get("/fixture/scenario?value=ready");
  await page.goto("/workspaces");
  await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
  await page.getByRole("link", { name: "Alice", exact: true }).click();
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Synteettinen viesti 0" })
    .click();
  await expect(page.getByText("Synteettinen viesti 0").last()).toBeVisible();
  await page.route("**/api/v1/snapshot", (route) =>
    route.fulfill({ status: 500, body: "unavailable" }),
  );
  await page.getByRole("button", { name: "Päivitä", exact: true }).click();
  await expect(
    page.getByText("Yhteys katkesi · tiedot voivat olla vanhoja"),
  ).toBeVisible();
  await expect(page.getByText("Synteettinen viesti 0").last()).toBeVisible();
  await page.unroute("**/api/v1/snapshot");
  await page.getByRole("button", { name: /Yhdistä|Yritä uudelleen/ }).click();
  await expect(
    page.getByText("Yhteys katkesi · tiedot voivat olla vanhoja"),
  ).toHaveCount(0);
});

test("@resilience active conversation stays readable and blocks writes during snapshot outage", async ({
  page,
}) => {
  await page.request.get("/fixture/conversations-reset");
  await page.request.get("/fixture/scenario?value=ready");
  await page.goto("/workspaces");
  await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
  await page.getByRole("link", { name: "Alice", exact: true }).click();
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "ordinary-dir" })
    .click();
  await expect(
    page.getByRole("button", { name: "Aloita uusi Pi-keskustelu" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Aloita uusi Pi-keskustelu" }).click();
  const editor = page.getByRole("textbox", { name: "Viesti Pi:lle" });
  await expect(editor).toBeVisible();
  await editor.fill("Luonnos säilyy katkossa");
  await page.route("**/api/v1/snapshot", (route) =>
    route.fulfill({ status: 500, body: "host stopped" }),
  );
  await page.getByRole("button", { name: "Päivitä", exact: true }).click();
  await expect(
    page.getByText("Yhteys katkesi · tiedot voivat olla vanhoja"),
  ).toBeVisible();
  await expect(editor).toHaveValue("Luonnos säilyy katkossa");
  await expect(
    page.getByRole("button", { name: "Tarkista keskustelun tila" }),
  ).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Yhdistä" })).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: "Lähetä", exact: true }),
  ).toBeDisabled();
  const { fieldRect, send } = await page
    .locator(".ah-composer-entry")
    .evaluate((node) => {
      const field = node.querySelector("textarea")?.getBoundingClientRect();
      const button = node.querySelector("button")?.getBoundingClientRect();
      if (!field || !button) throw new Error("composer geometry missing");
      return {
        fieldRect: { top: field.top, height: field.height },
        send: { top: button.top, height: button.height },
      };
    });
  expect(
    Math.abs(
      fieldRect.top + fieldRect.height / 2 - (send.top + send.height / 2),
    ),
  ).toBeLessThan(5);
  await expect(page.getByRole("button", { name: "Keskeytä" })).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  const composer = page.locator(".ah-conversation-frame > .ah-composer");
  await expect(composer).toBeVisible();
  expect(
    await composer.evaluate((node) => node.getBoundingClientRect().bottom),
  ).toBeLessThanOrEqual(844);
  expect(
    await composer.evaluate((node) => node.scrollHeight > node.clientHeight),
  ).toBe(false);
  await page.screenshot({
    path: "test-results/evidence/stale-conversation.png",
  });
  await page.unroute("**/api/v1/snapshot");
  await page.getByRole("button", { name: /Yhdistä|Yritä uudelleen/ }).click();
  await expect(
    page.getByText("Yhteys katkesi · tiedot voivat olla vanhoja"),
  ).toHaveCount(0);
});

test("@resilience restored network retries a failed read without resending work", async ({
  page,
}) => {
  await page.request.get("/fixture/scenario?value=ready");
  await page.goto("/workspaces");
  await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
  await page.getByRole("link", { name: "Alice", exact: true }).click();
  await expect(page.getByRole("navigation")).toBeVisible();
  await page.route("**/api/v1/snapshot", (route) => route.abort());
  await page.getByRole("button", { name: "Päivitä", exact: true }).click();
  await expect(
    page.getByText("Yhteys katkesi · tiedot voivat olla vanhoja"),
  ).toBeVisible();
  await page.unroute("**/api/v1/snapshot");
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(
    page.getByRole("navigation").getByRole("link", { name: "ordinary-dir" }),
  ).toBeVisible();
});

test("@resilience an incomplete catalog does not claim a deep-linked conversation was deleted", async ({
  page,
}) => {
  await page.request.get("/fixture/scenario?value=ready");
  await page.goto("/workspaces");
  await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
  await page.getByRole("link", { name: "Alice", exact: true }).click();
  const agentLink = page
    .getByRole("navigation")
    .getByRole("link", { name: "Synteettinen viesti 0" });
  await expect(agentLink).toBeVisible();
  const href = await agentLink.getAttribute("href");
  if (!href || !/^\/agents\/pi:/.test(href))
    throw new Error("missing synthetic history link");
  await page.request.get("/fixture/scenario?value=partial");
  await page.goto(href);
  await expect(page.locator("main h1")).toHaveText(
    "Keskustelun tilaa ei voitu tarkistaa",
  );
  await expect(
    page.getByText("Keskustelua ei voi vielä todeta poistuneeksi.", {
      exact: false,
    }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("main")
      .getByRole("button", { name: /Yhdistä|Yritä uudelleen/ }),
  ).toBeVisible();
  await page.request.get("/fixture/scenario?value=ready");
  await page
    .getByRole("main")
    .getByRole("button", { name: /Yhdistä|Yritä uudelleen/ })
    .click();
  await expect(page.getByText("Synteettinen viesti 0").last()).toBeVisible();
});

test("@resilience missing and partial observations can be refreshed without a reload", async ({
  page,
}) => {
  await page.request.get("/fixture/scenario?value=ready");
  await page.goto("/workspaces");
  await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
  await page.getByRole("link", { name: "Alice", exact: true }).click();
  for (const value of ["missing", "partial", "empty"]) {
    await page.request.get(`/fixture/scenario?value=${value}`);
    await page.getByRole("button", { name: "Päivitä", exact: true }).click();
    await expect(
      page
        .getByRole("main")
        .getByRole("button", { name: /Yritä uudelleen|Päivitä tiedot/ }),
    ).toBeVisible();
    await page.request.get("/fixture/scenario?value=ready");
    const recovered = page
      .getByRole("navigation")
      .getByRole("link", { name: "ordinary-dir" });
    const retry = page
      .getByRole("main")
      .getByRole("button", { name: /Yritä uudelleen|Päivitä tiedot/ });
    if (await retry.isVisible()) {
      // A queued journal refresh can restore the catalog during the click;
      // disappearance is fine, but the final state must be recovered.
      await retry.click({ timeout: 2500 }).catch(() => {});
    }
    await expect(retry).toHaveCount(0);
    await expect(recovered).toBeVisible();
  }
});
