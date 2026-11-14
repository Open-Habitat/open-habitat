import AxeBuilder from "@axe-core/playwright";
import type { Locator } from "@playwright/test";
import { hostOrigin } from "../test-ports.mjs";
import { expect, type Page, test } from "./worker-host";

// Asetukset › Tiedot agenteille (and Gitea under Koodipalvelut) against the synthetic host: the real gateway and
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

async function signIn(
  page: Page,
  who = "Alice",
  section: "tiedot" | "koodipalvelut" = "tiedot",
) {
  await page.goto("/settings");
  await page
    .getByRole("button")
    .and(page.getByTestId("github-sign-in"))
    .click();
  await page
    .getByRole("link")
    .nth(who === "Alice" ? 0 : 1)
    .click();
  await page.goto(
    section === "tiedot" ? "/settings/agent-data" : "/settings/code-hosts",
  );
  await expect(
    page
      .getByRole("heading")
      .and(page.getByTestId(`settings-section-${section}`)),
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
  // The reported failure exits after three letters, independent of typing speed.
  // Exercise actual keyboard events, not only a single fill/input event.
  for (const delay of [0, 100, 300]) {
    await address.fill("");
    await address.pressSequentially("ali", { delay });
    await expect(address).toHaveValue("ali");
    await address.pressSequentially("ce@example.test", { delay });
    await expect(address).toHaveValue("alice@example.test");
    await expect(dialog.getByTestId("integration-username")).toHaveValue(
      "alice@example.test",
    );
    await expect(dialog.getByTestId("integration-imap-host")).toHaveValue(
      "imap.example.test",
    );
  }
  await address.fill("alice@example.test");
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
    // The fixture's well-known address redirects to another site: discovery
    // refuses it rather than sending the password there.
    await expect(dialog.getByRole("alert")).toContainText(
      "toiseen verkkotunnukseen",
    );
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

test("a device code relays to the browser and Microsoft connects with no folder step", async ({
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
  await expect(dialog.getByTestId("integration-steps")).toHaveCount(0);
  // One lost poll does not strand the dialog.
  let polls = 0;
  await page.route("**/api/v1/integrations/login*", async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    if (polls++ === 0) return route.fulfill({ status: 503 });
    const response = await route.fetch();
    const view = await response.json();
    // A completed union grant retires the only code while native stores finish.
    if (view.state === "device_code") {
      view.state = "completing";
      view.login_phase = "files_discovery";
      delete view.user_code;
      delete view.verification_uri;
      delete view.expires_at;
    }
    return route.fulfill({ response, json: view });
  });
  await expect(dialog.getByTestId("integration-login-wait")).toBeVisible();
  await expect(dialog.getByTestId("integration-device-code")).toHaveCount(0);
  await expect(dialog.getByTestId("integration-provider-link")).toHaveCount(0);
  const audit = await new AxeBuilder({ page })
    .include('[data-testid="integration-dialog"]')
    .analyze();
  expect(audit.violations).toEqual([]);
  await fixture(page, "action=approve");
  // No folder step: Microsoft's files are searched, not synced.
  await expect(dialog.getByTestId("integration-connected")).toBeVisible();
  await page.unroute("**/api/v1/integrations/login*");
  await expect(dialog.getByTestId("integration-folder-choice")).toHaveCount(0);
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
  await expect(card.getByTestId("integration-service-onedrive")).toContainText(
    "Microsoftin haulla",
  );
  await expect(card).not.toContainText("~/cloud/onedrive");
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

  // A grant the organisation narrowed is shown as granted, not refused: the
  // card says what is missing and lists the grant in Microsoft's own names.
  await expect(page.getByTestId("integration-limits")).toContainText(
    "Se ei estä tätä",
  );
  await fixture(page, "action=narrow&provider=microsoft");
  await card
    .getByRole("button")
    .and(card.getByTestId("integration-recheck"))
    .click();
  await expect(card.getByTestId("integration-account-narrowed")).toContainText(
    "Organisaatiosi on rajannut",
  );
  await expect(
    card.getByTestId("integration-service-onedrive"),
  ).toHaveAttribute("data-access", "none");
  await expect(card.getByTestId("integration-service-mail")).toContainText(
    "Ei voi lähettää",
  );
  await expect(card.getByTestId("integration-reauth")).toHaveCount(0);
  await card
    .getByTestId("integration-grant")
    .getByText("Myönnetyt oikeudet (4)")
    .click();
  await expect(
    card
      .getByTestId("integration-not-granted")
      .filter({ hasText: "Mail.Send" }),
  ).toBeVisible();
  expect(
    (
      await new AxeBuilder({ page })
        .include('[data-testid="integration-account-microsoft"]')
        .analyze()
    ).violations,
    "narrowed card",
  ).toEqual([]);
  // The provider's long names wrap on a phone rather than widen the page.
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    ),
  ).toBeLessThanOrEqual(0);
  await fixture(page, "action=reset");
});

test("an account level is chosen when connecting and changed later by signing in again", async ({
  page,
}) => {
  await signIn(page);
  await fixture(page, "action=reset");
  // The server has Microsoft's full and read applications, not the drafts one.
  expect(
    (
      await page.request.get("/fixture/integration-apps?set=microsoft_read")
    ).status(),
  ).toBe(204);
  await page.reload();
  await tile(page, "microsoft")
    .getByRole("button")
    .and(tile(page, "microsoft").getByTestId("integration-connect-open"))
    .click();
  const dialog = page.getByRole("dialog");
  const level = (id: string) =>
    dialog.getByTestId(`integration-level-${id}`).getByRole("radio");
  await expect(level("full")).toBeChecked();
  await expect(level("drafts")).toBeDisabled();
  await dialog.getByTestId("integration-level-read").click();
  await expect(level("read")).toBeChecked();
  expect(
    (await new AxeBuilder({ page }).include('[role="dialog"]').analyze())
      .violations,
    "level cards",
  ).toEqual([]);
  await dialog
    .getByRole("button")
    .and(dialog.getByTestId("integration-continue"))
    .click();
  await expect(dialog.getByTestId("integration-device-code")).toBeVisible();
  await fixture(page, "action=approve");
  await expect(dialog.getByTestId("integration-connected")).toBeVisible();
  await expect(dialog.getByTestId("integration-folder-choice")).toHaveCount(0);
  await dialog
    .getByRole("button")
    .and(dialog.getByTestId("integration-done"))
    .click();
  const card = page
    .getByRole("article")
    .and(page.getByTestId("integration-account-microsoft"));
  await expect(card.getByTestId("integration-account-level")).toHaveAttribute(
    "data-level",
    "read",
  );
  await expect(card.getByTestId("integration-service-mail")).toHaveAttribute(
    "data-access",
    "read",
  );

  // Vaihda taso… offers the same cards; the current level cannot be chosen
  // again, and no folder step follows.
  await card
    .getByRole("button")
    .and(card.getByTestId("integration-change-level"))
    .click();
  const go = dialog
    .getByRole("button")
    .and(dialog.getByTestId("integration-continue"));
  await expect(level("read")).toBeChecked();
  await expect(go).toBeDisabled();
  await dialog.getByTestId("integration-level-full").click();
  await expect(dialog.getByTestId("integration-level-change")).toBeVisible();
  await go.click();
  await expect(dialog.getByTestId("integration-device-code")).toBeVisible();
  await fixture(page, "action=approve");
  await expect(dialog.getByTestId("integration-connected")).toBeVisible();
  await dialog
    .getByRole("button")
    .and(dialog.getByTestId("integration-done"))
    .click();
  await expect(card.getByTestId("integration-account-level")).toHaveAttribute(
    "data-level",
    "full",
  );
  // On a phone the pill wraps under the name rather than widen the page.
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    ),
  ).toBeLessThanOrEqual(0);
});

test("the no-send level connects with mail drafted but never sent, and everything else changeable", async ({
  page,
}) => {
  await signIn(page);
  await fixture(page, "action=reset");
  const apps = async (q: string) =>
    expect(
      (await page.request.get(`/fixture/integration-apps?${q}`)).status(),
    ).toBe(204);
  await apps("set=microsoft_nosend");
  await page.reload();
  await tile(page, "microsoft")
    .getByRole("button")
    .and(tile(page, "microsoft").getByTestId("integration-connect-open"))
    .click();
  const dialog = page.getByRole("dialog");
  const level = (id: string) =>
    dialog.getByTestId(`integration-level-${id}`).getByRole("radio");
  await expect(dialog.getByTestId("integration-level-nosend")).toContainText(
    "Kaikki paitsi postin lähetys",
  );
  await dialog.getByTestId("integration-level-nosend").click();
  await expect(level("nosend")).toBeChecked();
  // The warning names what still leaves the account, and mail is not it.
  const warning = dialog.getByTestId("integration-level-warning");
  await expect(warning).toContainText("kalenteria");
  await expect(warning).not.toContainText("lähettää postia");
  await dialog
    .getByRole("button")
    .and(dialog.getByTestId("integration-continue"))
    .click();
  await expect(dialog.getByTestId("integration-device-code")).toBeVisible();
  await fixture(page, "action=approve");
  await expect(dialog.getByTestId("integration-connected")).toBeVisible();
  await expect(dialog.getByTestId("integration-folder-choice")).toHaveCount(0);
  await dialog
    .getByRole("button")
    .and(dialog.getByTestId("integration-done"))
    .click();
  const card = page
    .getByRole("article")
    .and(page.getByTestId("integration-account-microsoft"));
  await expect(card.getByTestId("integration-account-level")).toHaveAttribute(
    "data-level",
    "nosend",
  );
  await expect(card.getByTestId("integration-service-mail")).toHaveAttribute(
    "data-access",
    "drafts",
  );
  await apps("clear=microsoft_nosend");
  await fixture(page, "action=reset");
});

test("Google offers Täysi and Vain luku, says it has no drafts level, and a change revokes the old login first", async ({
  page,
}) => {
  await signIn(page);
  await fixture(page, "action=reset");
  await tile(page, "google")
    .getByRole("button")
    .and(tile(page, "google").getByTestId("integration-connect-open"))
    .click();
  const dialog = page.getByRole("dialog");
  const level = (id: string) =>
    dialog.getByTestId(`integration-level-${id}`).getByRole("radio");
  await expect(level("full")).toBeChecked();
  await expect(level("drafts")).toBeDisabled();
  await expect(dialog.getByTestId("integration-level-drafts")).toContainText(
    "Google ei tarjoa tätä tasoa",
  );
  await dialog.getByTestId("integration-level-read").click();
  await expect(level("read")).toBeChecked();
  expect(
    (await new AxeBuilder({ page }).include('[role="dialog"]').analyze())
      .violations,
    "Google level cards",
  ).toEqual([]);
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
  await dialog
    .getByRole("textbox")
    .and(dialog.getByTestId("integration-redirect-input"))
    .fill("http://127.0.0.1:46399/oauth2/callback?state=lab&code=4/synthetic");
  await dialog
    .getByRole("button")
    .and(dialog.getByTestId("integration-connect"))
    .click();
  await expect(dialog.getByTestId("integration-folder-choice")).toBeVisible();
  const choice = await (
    await page.request.get("/api/v1/integrations/login")
  ).json();
  // Hold the browser in the real relay's long initial-sync phase. The native
  // stand-in completes immediately; only the observation is delayed here.
  const syncing = {
    schema_version: 1,
    state: "completing",
    attempt_id: choice.attempt_id,
    provider: choice.provider,
    address: choice.address,
    relogin: false,
    progress: {
      phase: "transferring",
      elapsed_seconds: 82,
      bytes: 1048576,
      total_bytes: 8388608,
      files: 2,
      total_files: 10,
    },
  };
  await page.route("**/api/v1/integrations/login*", async (route) => {
    if (route.request().method() === "PUT") await route.fetch();
    else if (route.request().method() !== "GET") return route.continue();
    return route.fulfill({ json: syncing });
  });
  await dialog
    .getByRole("button")
    .and(dialog.getByTestId("integration-sync-start"))
    .click();
  await expect(dialog.getByTestId("integration-initial-sync")).toBeVisible();
  await expect(dialog.getByTestId("dialog-close")).toBeVisible();
  await expect(dialog.getByTestId("integration-sync-progress")).toBeVisible();
  expect(
    (await new AxeBuilder({ page }).include('[role="dialog"]').analyze())
      .violations,
  ).toEqual([]);
  const cancellations: string[] = [];
  page.on("request", (request) => {
    if (
      request.method() === "DELETE" &&
      request.url().endsWith("/api/v1/integrations/login")
    )
      cancellations.push(request.url());
  });
  // Closing is now safe: the initial pass belongs to the daemon, not the dialog.
  await dialog.getByTestId("integration-sync-background").click();
  await expect(dialog).toHaveCount(0);
  await page.unroute("**/api/v1/integrations/login*");
  expect(cancellations).toEqual([]);
  const card = page
    .getByRole("article")
    .and(page.getByTestId("integration-account-google"));
  await expect(card.getByTestId("integration-account-level")).toHaveAttribute(
    "data-level",
    "read",
  );
  await expect(card.getByTestId("integration-service-drive")).toHaveAttribute(
    "data-access",
    "read",
  );

  await card
    .getByRole("button")
    .and(card.getByTestId("integration-change-level"))
    .click();
  await dialog.getByTestId("integration-level-full").click();
  await expect(dialog.getByTestId("integration-level-change")).toBeVisible();
  await expect(dialog).toContainText(
    "peruu vanhan kirjautumisen Googlessa ennen kuin kirjaudut uudelleen",
  );
  await dialog
    .getByRole("button")
    .and(dialog.getByTestId("integration-continue"))
    .click();
  await expect(dialog.getByTestId("integration-provider-link")).toBeVisible();
  await dialog
    .getByRole("button")
    .and(dialog.getByTestId("cancel"))
    .first()
    .click();
  await expect(dialog).toBeHidden();
  await card
    .getByRole("button")
    .and(card.getByTestId("integration-remove-open"))
    .click();
  await page
    .getByRole("alertdialog")
    .getByRole("button")
    .and(page.getByTestId("integration-remove-confirm"))
    .click();
  await expect(page.getByTestId("integration-removal-result")).toBeVisible();
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
  await dialog.getByTestId("dialog-close").click();
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

test("@a11y Tiedot agenteille and its sign-in dialog have no axe violations at desktop and phone width", async ({
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
  await page.goto("/settings/agent-data");
  await expect(
    page.getByRole("heading").and(page.getByTestId("settings-section-tiedot")),
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

/** Where any part of an element's rectangle is not seen: outside the
 * viewport, cut by a clipping ancestor, or covered by something drawn over
 * it. isVisible() sees none of these. */
const unseen = (element: Locator) =>
  element.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const out: string[] = [];
    if (r.width === 0 || r.height === 0) out.push("empty");
    if (
      r.top < 0 ||
      r.left < 0 ||
      r.bottom > window.innerHeight ||
      r.right > window.innerWidth
    )
      out.push("viewport");
    // The root's and body's clip is the viewport, checked above.
    for (
      let a = el.parentElement;
      a && a !== document.body && a !== document.documentElement;
      a = a.parentElement
    ) {
      const style = getComputedStyle(a);
      if (!/hidden|auto|scroll|clip/.test(style.overflowX + style.overflowY))
        continue;
      const b = a.getBoundingClientRect();
      if (
        r.top < b.top - 0.5 ||
        r.left < b.left - 0.5 ||
        r.bottom > b.bottom + 0.5 ||
        r.right > b.right + 0.5
      )
        out.push(`clipped by ${a.className || a.tagName}`);
    }
    // Corners are sampled inside the border radius, where the element itself
    // paints; a point there that hits anything else is drawn over.
    const inset =
      Math.max(
        2,
        Number.parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0,
      ) + 1;
    for (const [x, y] of [
      [r.left + inset, r.top + inset],
      [r.right - inset, r.top + inset],
      [r.left + inset, r.bottom - inset],
      [r.right - inset, r.bottom - inset],
      [(r.left + r.right) / 2, (r.top + r.bottom) / 2],
    ]) {
      const hit = document.elementFromPoint(x, y);
      if (!hit || !el.contains(hit))
        out.push(
          `covered at ${Math.round(x)},${Math.round(y)} by ${hit ? `${hit.tagName}.${hit.className}` : "nothing"}`,
        );
    }
    return out;
  });

// Gitea (ADR 0031): the approved form against a synthetic HTTPS Gitea. The
// token goes once to the person's daemon, which writes it only into tea's
// file in that person's home; a refusal keeps the form and is seen whole
// at the top, even on a short phone screen with the help open.
test("a Gitea connection is made from the form, refusals stay in view, and it is disconnected", async ({
  page,
  browser,
}) => {
  const { url, token } = await (
    await page.request.get("/fixture/gitea?action=enable")
  ).json();
  await signIn(page, "Alice", "koodipalvelut");
  const giteaTile = tile(page, "gitea");
  await giteaTile
    .getByRole("button")
    .and(giteaTile.getByTestId("integration-connect-open"))
    .click();
  const dialog = page.getByRole("dialog").and(page.getByTestId("gitea-dialog"));
  await expect(dialog.getByTestId("gitea-agent-note")).toBeVisible();
  const address = dialog.getByTestId("gitea-address");
  const pat = dialog.getByTestId("gitea-token");
  // Address and token show their literal characters.
  expect(
    await address.evaluate((e) => getComputedStyle(e).fontVariantLigatures),
  ).toBe("none");

  await page.setViewportSize({ width: 390, height: 568 });
  await address.fill(url.replace(/^https:\/\//, ""));
  await pat.fill("not-the-token");
  await dialog.getByTestId("gitea-token-help").click();
  await dialog
    .getByTestId("gitea-agent-note")
    .evaluate((e) => e.scrollIntoView({ block: "end" }));
  await dialog
    .getByRole("button")
    .and(dialog.getByTestId("gitea-submit"))
    .click();
  const error = dialog
    .getByRole("alert")
    .and(dialog.getByTestId("gitea-error"));
  await expect(error).toHaveAttribute("data-field", "token");
  await expect(error).toBeFocused();
  // The whole message is seen without scrolling: nothing clips or covers it.
  expect(await unseen(error)).toEqual([]);
  // https:// was added on submit; both fields are kept for a correction.
  await expect(address).toHaveValue(url);
  await expect(pat).toHaveValue("not-the-token");
  await expect(pat).toHaveAttribute("aria-invalid", "true");

  await page.setViewportSize({ width: 1280, height: 900 });
  await pat.fill(token);
  await dialog
    .getByRole("button")
    .and(dialog.getByTestId("gitea-submit"))
    .click();
  await expect(dialog.getByTestId("gitea-connected")).toHaveAttribute(
    "data-git",
    "registered",
  );
  // The token has write:repository, so nothing warns about push.
  await expect(dialog.getByTestId("gitea-push")).toHaveCount(0);
  await dialog
    .getByRole("button")
    .and(dialog.getByTestId("gitea-done"))
    .click();
  const connection = page
    .getByRole("article")
    .and(page.getByTestId("gitea-connection"));
  await expect(connection).toHaveAttribute("data-git", "registered");
  await expect(connection).toHaveAttribute("data-push", "allowed");
  const list = await (await page.request.get("/api/v1/integrations")).json();
  expect(JSON.stringify(list)).not.toContain(token);
  expect(list.gitea.connections).toHaveLength(1);

  await connection
    .getByRole("button")
    .and(connection.getByTestId("gitea-check"))
    .click();
  await expect(connection.getByTestId("gitea-check-result")).toHaveAttribute(
    "data-api",
    "ok",
  );

  // The same token made read-only at Gitea: the next check names it before
  // any push meets a 403, and the page opened afresh checks by itself.
  await page.request.get("/fixture/gitea?action=read-only");
  await connection
    .getByRole("button")
    .and(connection.getByTestId("gitea-check"))
    .click();
  await expect(connection).toHaveAttribute("data-push", "read_only");
  await expect(
    connection.getByRole("status").and(connection.getByTestId("gitea-push")),
  ).toContainText("write:repository");
  await page.reload();
  await expect(
    page.getByRole("article").and(page.getByTestId("gitea-connection")),
  ).toHaveAttribute("data-push", "read_only");
  await page.request.get("/fixture/gitea?action=writable");

  // Bob's daemon reads Bob's tea file: Alice's connection is not his.
  const other = await browser.newContext({
    baseURL: hostOrigin,
    ignoreHTTPSErrors: true,
  });
  const bob = await other.newPage();
  await signIn(bob, "Bob", "koodipalvelut");
  await expect(bob.getByTestId("gitea-connection")).toHaveCount(0);
  await other.close();

  await connection
    .getByRole("button")
    .and(connection.getByTestId("gitea-disconnect-open"))
    .click();
  const confirm = page.getByRole("alertdialog");
  await confirm
    .getByRole("button")
    .and(confirm.getByTestId("gitea-disconnect-confirm"))
    .click();
  await expect(connection).toHaveCount(0);
  expect(
    (await (await page.request.get("/api/v1/integrations")).json()).gitea
      .connections,
  ).toEqual([]);
});

async function openGitea(page: Page) {
  const giteaTile = tile(page, "gitea");
  await giteaTile
    .getByRole("button")
    .and(giteaTile.getByTestId("integration-connect-open"))
    .click();
  return page.getByRole("dialog").and(page.getByTestId("gitea-dialog"));
}

// A connect whose reply is lost after the daemon wrote tea's file: the page
// says it does not know, reads tea's state and shows the connection that was
// made, and the token is never sent a second time.
test("an uncertain Gitea connect is observed from tea's state and never resent", async ({
  page,
}) => {
  const { url, token } = await (
    await page.request.get("/fixture/gitea?action=enable")
  ).json();
  await signIn(page, "Alice", "koodipalvelut");
  let posts = 0;
  await page.route("**/api/v1/integrations/gitea", async (route) => {
    // The page's own check of what it then shows carries no token.
    if (
      route.request().method() !== "POST" ||
      route.request().postDataJSON()?.action === "check"
    )
      return route.continue();
    posts++;
    // The write reaches the person's daemon; only its answer is lost.
    await route.fetch();
    await route.abort("connectionreset");
  });
  const dialog = await openGitea(page);
  await dialog.getByTestId("gitea-address").fill(url);
  await dialog.getByTestId("gitea-token").fill(token);
  await dialog
    .getByRole("button")
    .and(dialog.getByTestId("gitea-submit"))
    .click();
  await expect(dialog).toHaveAttribute("data-stage", "uncertain");
  await expect(dialog.getByRole("alert")).toBeVisible();
  await expect(dialog.getByTestId("gitea-token")).toHaveCount(0);
  await dialog
    .getByRole("button")
    .and(dialog.getByTestId("dialog-close"))
    .first()
    .click();
  const connection = page
    .getByRole("article")
    .and(page.getByTestId("gitea-connection"));
  await expect(connection).toHaveAttribute("data-git", "registered");
  expect(posts).toBe(1);
  // The page holds no copy of the token after the uncertain write.
  expect(
    await page.evaluate(
      (t) => document.documentElement.outerHTML.includes(t),
      token,
    ),
  ).toBe(false);
});

// The form by keyboard alone, in the dark theme with reduced motion: Enter in
// the address field connects (https:// added), each refusal takes focus and
// is seen whole, Escape closes and returns focus to the opener, and nothing
// in it animates.
test("@a11y the Gitea form works by keyboard in dark with reduced motion and passes axe", async ({
  page,
}) => {
  const { url } = await (
    await page.request.get("/fixture/gitea?action=enable")
  ).json();
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  await signIn(page, "Alice", "koodipalvelut");
  expect(
    await page.evaluate(() => document.documentElement.dataset.theme),
  ).toBe("dark");
  const opener = tile(page, "gitea").getByTestId("integration-connect-open");
  await opener.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog").and(page.getByTestId("gitea-dialog"));
  await expect(dialog).toBeVisible();
  const address = dialog.getByTestId("gitea-address");
  const pat = dialog.getByTestId("gitea-token");
  for (
    let i = 0;
    i < 6 && !(await address.evaluate((e) => e === document.activeElement));
    i++
  )
    await page.keyboard.press("Tab");
  await expect(address).toBeFocused();
  await page.keyboard.type(url.replace(/^https:\/\//, ""));
  await page.keyboard.press("Enter");
  const error = dialog
    .getByRole("alert")
    .and(dialog.getByTestId("gitea-error"));
  await expect(error).toHaveAttribute("data-field", "token");
  await expect(error).toBeFocused();
  await expect(address).toHaveValue(url);
  await pat.focus();
  await page.keyboard.type("not-the-token");
  await dialog.getByTestId("gitea-token-help").focus();
  await page.keyboard.press("Enter");
  await expect(dialog.getByTestId("gitea-token-instructions")).toBeVisible();
  await page.setViewportSize({ width: 390, height: 568 });
  await pat.focus();
  await page.keyboard.press("Enter");
  await expect(error).toHaveAttribute("data-field", "token");
  await expect(error).toBeFocused();
  await expect(pat).toHaveValue("not-the-token");
  expect(await unseen(error)).toEqual([]);
  // Literal characters wherever an address, token or code is drawn.
  for (const literal of [
    address,
    pat,
    dialog.getByTestId("gitea-token-instructions").locator("code").first(),
  ])
    expect(
      await literal.evaluate((e) => getComputedStyle(e).fontVariantLigatures),
    ).toBe("none");
  const moving = await dialog.evaluate(
    (d) =>
      document
        .getAnimations()
        .filter(
          (a) =>
            a.playState === "running" &&
            a.effect instanceof KeyframeEffect &&
            a.effect.target instanceof Node &&
            d.contains(a.effect.target),
        ).length,
  );
  expect(moving).toBe(0);
  expect(
    (
      await new AxeBuilder({ page })
        .include('[data-testid="gitea-dialog"]')
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(opener).toBeFocused();
});
