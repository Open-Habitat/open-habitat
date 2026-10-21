import AxeBuilder from "@axe-core/playwright";
import { hostOrigin } from "../test-ports.mjs";
import { expect, type Page, test } from "./worker-host";

// Asetukset › Integraatiot against the synthetic host: the real gateway and
// daemon handlers, the product's IMAP entry run against the fake himalaya,
// and stand-in Google (pasted redirect) and Microsoft (device code) entries
// steered through /fixture/integrations. Same-UID synthetic evidence: it
// proves routing, the browser/host contract and the relays, not Linux user
// isolation or a real provider.

test.use({
  baseURL: hostOrigin,
  ignoreHTTPSErrors: true,
  viewport: { width: 1280, height: 900 },
});

async function signIn(page: Page, who = "Alice") {
  await page.goto("/settings");
  await page
    .getByRole("button")
    .and(page.getByTestId("github-sign-in"))
    .click();
  await page
    .getByRole("link")
    .nth(who === "Alice" ? 0 : 1)
    .click();
  await page.goto("/settings/integraatiot");
  await expect(
    page
      .getByRole("heading")
      .and(page.getByTestId("settings-section-integraatiot")),
  ).toBeVisible();
  await expect(page.getByTestId("integrations-loading")).toHaveCount(0);
}

const fixture = (page: Page, query: string) =>
  page.request.get(`/fixture/integrations?${query}`);

function tile(page: Page, name: string) {
  return page.getByTestId(`integration-tile-${name}`);
}

test("an IMAP account connects with an app password, is the person's own, and is removed", async ({
  page,
  browser,
}) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await signIn(page);
  await tile(page, "imap")
    .getByRole("button")
    .and(tile(page, "imap").getByTestId("integration-connect-open"))
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("note")).toBeVisible();
  await dialog
    .getByRole("button")
    .and(dialog.getByTestId("integration-continue"))
    .click();
  const address = dialog.getByTestId("integration-address");
  const loginRequests: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/v1/integrations/login")
      loginRequests.push(request.method());
  });
  // The live Brave report exits after 'jar', independent of typing speed.
  // Exercise actual keyboard events, not only a single fill/input event.
  for (const delay of [0, 100, 300]) {
    await address.fill("");
    await address.pressSequentially("jar", { delay });
    await expect(address).toHaveValue("jar");
    await address.pressSequentially("person@example.test", { delay });
    await expect(address).toHaveValue("maintainer@example.org");
    await expect(dialog.getByTestId("integration-username")).toHaveValue(
      "maintainer@example.org",
    );
    await expect(dialog.getByTestId("integration-imap-host")).toHaveValue(
      "imap.iki.fi",
    );
  }
  await address.fill("maintainer@example.org");
  await address.blur();
  await address.focus();
  expect(loginRequests).toEqual([]);
  expect(pageErrors).toEqual([]);
  await address.fill("Person@Example.test");
  await expect(dialog.getByTestId("integration-imap-host")).toHaveValue(
    "imap.example.test",
  );
  await dialog.getByTestId("integration-smtp-host").fill("smtp.example.test");
  await expect(dialog.getByTestId("integration-smtp-port")).toHaveValue("465");
  await dialog.getByTestId("integration-password").fill("wrong-password");
  await dialog
    .getByRole("button")
    .and(dialog.getByTestId("integration-connect"))
    .click();
  await expect(dialog.getByRole("alert")).toBeVisible();
  // The password field is emptied after every attempt.
  await expect(dialog.getByTestId("integration-password")).toHaveValue("");
  await dialog
    .getByTestId("integration-password")
    .fill("synthetic-app-password");
  await dialog
    .getByRole("button")
    .and(dialog.getByTestId("integration-connect"))
    .click();
  await expect(dialog.getByTestId("integration-connected")).toBeVisible();
  await dialog
    .getByRole("button")
    .and(dialog.getByTestId("integration-done"))
    .click();
  const card = page
    .getByRole("article")
    .and(page.getByTestId("integration-account-imap"));
  await expect(
    card.getByTestId("integration-service-state").first(),
  ).toHaveAttribute("data-state", "ok");
  await expect(
    card.getByTestId("integration-service-state").first(),
  ).toBeVisible();
  await expect(
    card.getByTestId("integration-checked-at").first(),
  ).toBeVisible();
  const list = await (await page.request.get("/api/v1/integrations")).json();
  expect(list.skill).toBe("current");
  expect(JSON.stringify(list)).not.toContain("synthetic-app-password");
  await expect(
    page.getByRole("button").and(page.getByTestId("integration-add-imap")),
  ).toBeVisible();

  // Bob's daemon reads Bob's home: Alice's account is not his.
  const other = await browser.newContext({
    baseURL: hostOrigin,
    ignoreHTTPSErrors: true,
  });
  const bob = await other.newPage();
  await signIn(bob, "Bob");
  await expect(bob.getByRole("article")).toHaveCount(0);
  await other.close();

  await card
    .getByRole("button")
    .and(card.getByTestId("integration-remove-open"))
    .click();
  const confirm = page.getByRole("alertdialog");
  await expect(confirm).toBeVisible();
  await expect(confirm.getByRole("checkbox")).toHaveCount(0);
  await confirm
    .getByRole("button")
    .and(confirm.getByTestId("integration-remove-confirm"))
    .click();
  await expect(page.getByTestId("integration-removal-result")).toBeVisible();
  await expect(card).toHaveCount(0);
  expect(
    (await (await page.request.get("/api/v1/integrations")).json()).skill,
  ).toBe("none");
});

test("DAV endpoints connect independently and renew the right provider without retaining passwords", async ({
  page,
}) => {
  await signIn(page);
  const dialog = page.getByRole("dialog");
  for (const name of ["caldav", "carddav"]) {
    await tile(page, name)
      .getByRole("button")
      .and(tile(page, name).getByTestId("integration-connect-open"))
      .click();
    await dialog
      .getByRole("button")
      .and(dialog.getByTestId("integration-continue"))
      .click();
    await dialog.getByTestId("integration-address").fill("person@example.test");
    await expect(dialog.getByTestId("integration-imap-host")).toHaveCount(0);
    // Audit this form, not the previous dialog's transient React Aria
    // live-announcer entry whose button has already unmounted.
    expect(
      (await new AxeBuilder({ page }).include('[role="dialog"]').analyze())
        .violations,
    ).toEqual([]);
    await dialog
      .getByTestId("integration-dav-url")
      .fill("http://dav.example.test/");
    await dialog
      .getByTestId("integration-password")
      .fill("synthetic-dav-password");
    await expect(
      dialog.getByRole("button").and(dialog.getByTestId("integration-connect")),
    ).toBeDisabled();
    await dialog
      .getByTestId("integration-dav-url")
      .fill("https://dav.example.test/.well-known/caldav");
    await dialog
      .getByRole("button")
      .and(dialog.getByTestId("integration-connect"))
      .click();
    await expect(dialog.getByRole("alert")).toBeVisible();
    await dialog
      .getByTestId("integration-dav-url")
      .fill(" https://DAV.Example.test/dav/ ");
    await dialog
      .getByTestId("integration-password")
      .fill("synthetic-dav-password");
    await dialog
      .getByRole("button")
      .and(dialog.getByTestId("integration-connect"))
      .click();
    await expect(dialog.getByTestId("integration-connected")).toBeVisible();
    await dialog
      .getByRole("button")
      .and(dialog.getByTestId("integration-done"))
      .click();
  }
  const calendar = page
    .getByRole("article")
    .and(page.getByTestId("integration-account-caldav"));
  const contacts = page
    .getByRole("article")
    .and(page.getByTestId("integration-account-carddav"));
  await page.route("**/api/v1/integrations", async (route) => {
    const response = await route.fetch();
    const list = await response.json();
    for (const account of list.accounts) {
      if (account.provider === "caldav")
        account.services[0].state = "credentials_rejected";
    }
    await route.fulfill({ response, json: list });
  });
  await calendar
    .getByRole("button")
    .and(calendar.getByTestId("integration-recheck"))
    .click();
  await expect(
    calendar.getByTestId("integration-service-state"),
  ).toHaveAttribute("data-state", "credentials_rejected");
  await expect(calendar.getByTestId("integration-service-state")).toBeVisible();
  await page.unroute("**/api/v1/integrations");
  await calendar
    .getByRole("button")
    .and(calendar.getByTestId("integration-reauth"))
    .click();
  await dialog.getByTestId("integration-password").fill("wrong-password");
  await dialog
    .getByRole("button")
    .and(dialog.getByTestId("integration-password-save"))
    .click();
  await expect(dialog.getByRole("alert")).toBeVisible();
  await expect(dialog.getByTestId("integration-password")).toHaveValue("");
  await dialog.getByTestId("integration-password").fill("renewed-dav-password");
  await dialog
    .getByRole("button")
    .and(dialog.getByTestId("integration-password-save"))
    .click();
  await expect(dialog.getByTestId("integration-connected")).toBeVisible();
  await dialog
    .getByRole("button")
    .and(dialog.getByTestId("integration-done"))
    .click();
  await calendar
    .getByRole("button")
    .and(calendar.getByTestId("integration-remove-open"))
    .click();
  await page
    .getByRole("alertdialog")
    .getByRole("button")
    .and(page.getByTestId("integration-remove-confirm"))
    .click();
  await expect(calendar).toHaveCount(0);
  await expect(
    contacts.getByTestId("integration-service-state"),
  ).toHaveAttribute("data-state", "ok");
  await expect(contacts.getByTestId("integration-service-state")).toBeVisible();
  const list = await (await page.request.get("/api/v1/integrations")).json();
  expect(JSON.stringify(list)).not.toContain("dav-password");
});

test("a device code relays to the browser, folders fit the quota, and sync starts", async ({
  page,
}) => {
  await signIn(page);
  await fixture(page, "action=reset");
  await tile(page, "microsoft")
    .getByRole("button")
    .and(tile(page, "microsoft").getByTestId("integration-connect-open"))
    .click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("button")
    .and(dialog.getByTestId("integration-continue"))
    .click();
  await expect(dialog.getByTestId("integration-device-code")).toHaveText(
    "K7QM2PXDW",
  );
  await expect(dialog.getByTestId("integration-device-code")).toBeVisible();
  const open = dialog
    .getByRole("link")
    .and(dialog.getByTestId("integration-provider-link"));
  await expect(open).toHaveAttribute(
    "href",
    "https://login.microsoft.com/device",
  );
  await expect(open).toHaveAttribute("rel", "noopener noreferrer");
  await expect(
    dialog
      .getByRole("list")
      .and(dialog.getByTestId("integration-steps"))
      .getByRole("listitem"),
  ).toHaveCount(2);
  // One lost poll does not strand the dialog.
  let polls = 0;
  await page.route("**/api/v1/integrations/login", async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    if (polls++ === 0) return route.fulfill({ status: 503 });
    const response = await route.fetch();
    const view = await response.json();
    // Microsoft's second native tool replaces the code within the same
    // attempt. Prove the browser does not keep displaying the first code.
    if (view.state === "device_code") view.user_code = "SECOND1234";
    return route.fulfill({ response, json: view });
  });
  await expect.poll(() => polls).toBeGreaterThan(0);
  await expect(dialog.getByTestId("integration-device-code")).toHaveText(
    "SECOND1234",
  );
  await expect(dialog.getByTestId("integration-device-code")).toBeVisible();
  await expect(dialog.getByTestId("integration-device-code")).not.toHaveText(
    "K7QM2PXDW",
  );
  await fixture(page, "action=approve");
  await expect(dialog.getByTestId("integration-folder-choice")).toBeVisible();
  await page.unroute("**/api/v1/integrations/login");
  await expect(dialog.getByTestId("integration-folder-choice")).toBeVisible();
  await dialog
    .getByRole("button")
    .and(dialog.getByTestId("integration-sync-start"))
    .click();
  await expect(dialog.getByTestId("integration-connected")).toBeVisible();
  await dialog
    .getByRole("button")
    .and(dialog.getByTestId("integration-done"))
    .click();
  const card = page
    .getByRole("article")
    .and(page.getByTestId("integration-account-microsoft"));
  await expect(card.getByTestId("integration-service-onedrive")).toBeVisible();
  await expect(
    card
      .getByTestId("integration-service-onedrive")
      .getByTestId("integration-service-state"),
  ).toHaveAttribute("data-state", "ok");
  await expect(
    card
      .getByTestId("integration-service-onedrive")
      .getByTestId("integration-service-state"),
  ).toBeVisible();
  await expect(card).toContainText("~/cloud/onedrive/person@work.example.test");
  await expect(
    page.getByRole("button").and(page.getByTestId("integration-add-microsoft")),
  ).toBeVisible();

  // An expired login is shown as the tool reports it and offers a sign-in.
  await fixture(page, "action=expire&provider=microsoft");
  await card
    .getByRole("button")
    .and(card.getByTestId("integration-recheck"))
    .click();
  await expect(
    card.getByTestId("integration-service-state").first(),
  ).toHaveAttribute("data-state", "login_expired");
  await expect(
    card.getByTestId("integration-service-state").first(),
  ).toBeVisible();
  await card
    .getByRole("button")
    .and(card.getByTestId("integration-reauth"))
    .click();
  await expect(
    dialog.getByRole("heading").and(dialog.getByTestId("integration-title")),
  ).toBeVisible();
  // A renewal goes straight to the code and skips the folder step.
  await expect(dialog.getByTestId("integration-device-code")).toHaveText(
    "K7QM2PXDW",
  );
  await expect(dialog.getByTestId("integration-device-code")).toBeVisible();
  await expect(
    dialog.getByRole("list").and(dialog.getByTestId("integration-steps")),
  ).toHaveCount(0);
  await fixture(page, "action=approve");
  await expect(dialog.getByTestId("integration-connected")).toBeVisible();
  await dialog
    .getByRole("button")
    .and(dialog.getByTestId("integration-done"))
    .click();
  await expect(
    card.getByTestId("integration-service-state").first(),
  ).toHaveAttribute("data-state", "ok");
  await expect(
    card.getByTestId("integration-service-state").first(),
  ).toBeVisible();
});

test("a pasted redirect must be the loopback address; a choice over quota is refused", async ({
  page,
}) => {
  await signIn(page);
  await tile(page, "google")
    .getByRole("button")
    .and(tile(page, "google").getByTestId("integration-connect-open"))
    .click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("button")
    .and(dialog.getByTestId("integration-continue"))
    .click();
  const popup = page.waitForEvent("popup");
  await dialog
    .getByRole("link")
    .and(dialog.getByTestId("integration-provider-link"))
    .click();
  await (await popup).close();
  const field = dialog
    .getByRole("textbox")
    .and(dialog.getByTestId("integration-redirect-input"));
  await field.fill(
    "https://accounts.example.test/signin/oauth/consent?authuser=0",
  );
  await dialog
    .getByRole("button")
    .and(dialog.getByTestId("integration-connect"))
    .click();
  await expect(dialog.getByRole("alert")).toBeVisible();
  await field.fill(
    "http://127.0.0.1:46399/oauth2/callback?state=lab&code=4/synthetic",
  );
  await dialog
    .getByRole("button")
    .and(dialog.getByTestId("integration-connect"))
    .click();
  await expect(dialog.getByTestId("integration-folder-choice")).toBeVisible();
  const photos = dialog.getByTestId("integration-folder-photos");
  await photos.click();
  await expect(
    dialog.getByTestId("integration-folder-photos").getByRole("checkbox"),
  ).toBeChecked();
  await expect(dialog.getByTestId("integration-capacity")).toHaveAttribute(
    "data-over",
    "true",
  );
  await expect(dialog.getByTestId("integration-capacity")).toBeVisible();
  await expect(
    dialog
      .getByRole("button")
      .and(dialog.getByTestId("integration-sync-start")),
  ).toBeDisabled();
  await photos.click();
  await dialog
    .getByRole("button")
    .and(dialog.getByTestId("integration-sync-start"))
    .click();
  await expect(dialog.getByTestId("integration-connected")).toBeVisible();
  await dialog
    .getByRole("button")
    .and(dialog.getByTestId("integration-done"))
    .click();
  const card = page
    .getByRole("article")
    .and(page.getByTestId("integration-account-google"));
  await expect(card).toBeVisible();

  // Removal keeps the folder unless asked; asked, it goes to the Trash.
  await card
    .getByRole("button")
    .and(card.getByTestId("integration-remove-open"))
    .click();
  const confirm = page.getByRole("alertdialog");
  await confirm.getByTestId("integration-remove-files").click();
  await expect(confirm.getByRole("checkbox")).toBeChecked();
  await confirm
    .getByRole("button")
    .and(confirm.getByTestId("integration-remove-confirm"))
    .click();
  await expect(page.getByTestId("integration-removal-result")).toBeVisible();
});

test("tenant refusals are said plainly, and leaving the dialog cancels the sign-in", async ({
  page,
}) => {
  await signIn(page);
  const dialog = page.getByRole("dialog");
  const start = async () => {
    await tile(page, "microsoft")
      .getByRole("button")
      .and(
        await tile(page, "microsoft").getByTestId("integration-connect-open"),
      )
      .click();
    await dialog
      .getByRole("button")
      .and(dialog.getByTestId("integration-continue"))
      .click();
  };
  await fixture(page, "action=outcome&value=consent");
  await start();
  await expect(dialog.getByRole("alert")).toBeVisible();
  await expect(dialog.getByTestId("integration-consent-link")).toBeVisible();
  await dialog
    .getByRole("button")
    .and(dialog.getByTestId("dialog-close"))
    .first()
    .click();
  await fixture(page, "action=outcome&value=blocked");
  await start();
  await expect(dialog.getByRole("alert")).toBeVisible();
  await dialog
    .getByRole("button")
    .and(dialog.getByTestId("dialog-close"))
    .first()
    .click();

  await fixture(page, "action=outcome&value=");
  await start();
  await expect(dialog.getByTestId("integration-device-code")).toHaveText(
    "K7QM2PXDW",
  );
  await expect(dialog.getByTestId("integration-device-code")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect
    .poll(
      async () =>
        (await (await page.request.get("/api/v1/integrations/login")).json())
          .failure,
    )
    .toBe("cancelled");
  await fixture(page, "action=approve");
  await expect(page.getByRole("article")).toHaveCount(0);
});

test("@a11y Integraatiot and its sign-in dialog have no axe violations at desktop and phone width", async ({
  page,
}) => {
  await signIn(page);
  expect(
    (await new AxeBuilder({ page }).analyze()).violations,
    "step 1",
  ).toEqual([]);
  await tile(page, "google")
    .getByRole("button")
    .and(tile(page, "google").getByTestId("integration-connect-open"))
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(
    (await new AxeBuilder({ page }).analyze()).violations,
    "step 2",
  ).toEqual([]);
  await page
    .getByRole("dialog")
    .getByRole("button")
    .and(page.getByTestId("integration-continue"))
    .click();
  await expect(
    page.getByRole("link").and(page.getByTestId("integration-provider-link")),
  ).toBeVisible();
  expect(
    (await new AxeBuilder({ page }).analyze()).violations,
    "step 3",
  ).toEqual([]);
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/settings/integraatiot");
  await expect(
    page
      .getByRole("heading")
      .and(page.getByTestId("settings-section-integraatiot")),
  ).toBeVisible();
  expect(
    (await new AxeBuilder({ page }).analyze()).violations,
    "step 4",
  ).toEqual([]);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
