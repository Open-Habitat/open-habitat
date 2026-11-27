import AxeBuilder from "@axe-core/playwright";
import type { Locator, Request } from "@playwright/test";
import { hostOrigin } from "../test-ports.mjs";
import { expect, type Page, test } from "./worker-host";

// Microsoft 365 for several organisations (prototype round 4): the
// administrator's Organisations dialog on the Microsoft row and the person's
// organisation step, cards and refusals, against the synthetic host's real
// gateway, broker relay and daemon catalog. The Microsoft stand-in serves the
// organisations root's file names (test/browser-host/integrations.go
// orgFixture) and names a connection in a chosen organisation address~tenant
// as the native entry does. Same-UID synthetic evidence: it proves the
// browser/host contract and the flows, not a real Entra tenant.

test.use({
  baseURL: hostOrigin,
  ignoreHTTPSErrors: true,
  viewport: { width: 1280, height: 900 },
});

// The synthetic host's own tenant (its root-set microsoft section) and two
// client organisations; every one of them synthetic.
const own = "e04c61f9-3b8d-4a27-9f5e-7d1a2c48b903";
const one = "9a4e7b21-5c3d-4f60-8e1a-7b2c9d0e4f35";
const two = "c3b8d5e0-1a2f-4b7c-a6d9-0e5f8a3b2c47";
// The fixture's client ids: a fixed prefix and the section's place among
// integrationapps.Providers.
const client = (index: number) =>
  `7c2e5b1a-0d94-4f3b-8a61-3e9f2c7d${String(index).padStart(4, "0")}`;
const sharedFull = client(5);
const sharedRead = client(8);

async function signIn(page: Page, to: string) {
  await page.goto("/settings");
  await page
    .getByRole("button")
    .and(page.getByTestId("github-sign-in"))
    .click();
  await page.getByRole("link").nth(0).click();
  await expect(page).not.toHaveURL(/fixture\/provider/);
  await page.goto(to);
}
const apps = async (page: Page, query: string) =>
  expect(
    (await page.request.get(`/fixture/integration-apps?${query}`)).status(),
  ).toBe(204);
const integrations = (page: Page, query: string) =>
  page.request.get(`/fixture/integrations?${query}`);
/** The shared applications at the full and read levels, the allowed list
 * with the own organisation and two clients, the first a guest's. */
async function severalOrganisations(page: Page) {
  for (const q of [
    "set=microsoft_shared",
    "set=microsoft_shared_read",
    `tenant=${own}:Esimerkki Konsultit Oy`,
    `tenant=${one}:Asiakas Yksi Oy`,
    `tenant=${two}:Asiakas Kaksi Oy`,
  ])
    await apps(page, q);
}

/** No two visible controls in scope are closer than --ah-control-gap (so
 * none touch or overlap), and a removal stands at least --ah-s4 from the
 * control before it. The distance is between bounding boxes. */
async function spacing(scope: Locator, what: string) {
  const bad = await scope.evaluate((root) => {
    const px = (v: string) => {
      const e = document.createElement("div");
      e.style.width = `var(${v})`;
      document.body.append(e);
      const w = e.getBoundingClientRect().width;
      e.remove();
      return w;
    };
    const min = px("--ah-control-gap");
    const far = px("--ah-s4");
    const els = [
      ...root.querySelectorAll<HTMLElement>(
        'button, a[href], input, select, textarea, [role="button"], summary',
      ),
    ].filter((e) => {
      const b = e.getBoundingClientRect();
      return (
        b.width >= 3 &&
        b.height >= 3 &&
        e.checkVisibility({ visibilityProperty: true, opacityProperty: true })
      );
    });
    const name = (e: HTMLElement) =>
      (e.dataset.testid || e.getAttribute("aria-label") || e.tagName).slice(
        0,
        48,
      );
    const gap = (a: Element, b: Element) => {
      const p = a.getBoundingClientRect();
      const q = b.getBoundingClientRect();
      const gx = Math.max(q.left - p.right, p.left - q.right);
      const gy = Math.max(q.top - p.bottom, p.top - q.bottom);
      return gx < 0 && gy < 0
        ? Math.max(gx, gy)
        : gx < 0
          ? gy
          : gy < 0
            ? gx
            : Math.max(gx, gy);
    };
    const out: string[] = [];
    for (let i = 0; i < els.length; i++)
      for (let j = i + 1; j < els.length; j++) {
        const a = els[i];
        const b = els[j];
        if (a.contains(b) || b.contains(a)) continue;
        const g = gap(a, b);
        if (g < min - 0.5)
          out.push(`${name(a)} | ${name(b)}: ${g.toFixed(1)}px`);
      }
    for (const d of root.querySelectorAll<HTMLElement>(
      ".mo-destructive, .si-destructive",
    )) {
      const i = els.indexOf(d);
      if (i < 1) continue;
      const g = gap(els[i - 1], d);
      if (g < far - 0.5)
        out.push(`removal ${name(d)} after ${name(els[i - 1])}: ${g}px`);
    }
    return out;
  });
  expect(bad, `${what}: controls too close`).toEqual([]);
}

async function axe(page: Page, selector: string) {
  const audit = await new AxeBuilder({ page }).include(selector).analyze();
  expect(audit.violations).toEqual([]);
}

/** The JSON body of the next request to path with the given method. */
function nextBody(page: Page, path: string, method: string) {
  return page
    .waitForRequest(
      (r: Request) =>
        new URL(r.url()).pathname === path && r.method() === method,
    )
    .then((r) => r.postDataJSON() as Record<string, unknown>);
}

test("@m365-orgs @a11y an administrator adds an organisation, sends its approval and removes it; the row counts follow", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await signIn(page, "/settings");
  await apps(page, "set=microsoft_read");
  await apps(page, "set=microsoft_shared");
  await apps(page, "set=microsoft_shared_read");
  await page.goto("/settings/server-integrations");
  const row = page.getByTestId("si-row-microsoft");
  const orgs = row.getByTestId("si-orgs-microsoft");
  const levels = row.getByTestId("si-setup-microsoft");
  // Two of four levels set: the row's state and its Levels button both say
  // so, and only the two count buttons follow the name.
  await expect(orgs).toHaveAttribute("data-count", "1");
  await expect(levels).toHaveAttribute("data-count", "2/4");
  await expect(levels).toHaveClass(/ah-button-secondary/);
  await expect(row.getByTestId("si-levels-note")).toHaveCount(0);
  await expect(row.getByTestId("si-levels-microsoft")).toHaveCount(0);
  await expect(row.locator(".ah-people-end").getByRole("button")).toHaveCount(
    2,
  );
  await spacing(row, "row");
  await spacing(page.getByTestId("si-rows"), "rows");

  await orgs.click();
  const dialog = page.getByTestId("mo-dialog");
  await expect(dialog).toHaveAttribute("data-step", "list");
  // The own organisation, served by its single-tenant sections, cannot be
  // taken off a list it is not on.
  await expect(dialog.getByTestId(`mo-org-${own}`)).toBeVisible();
  await expect(dialog.getByTestId(`mo-remove-open-${own}`)).toHaveCount(0);
  await axe(page, '[data-testid="mo-dialog"]');
  await spacing(dialog, "list");

  // Adding: the fields say what is wrong in place, nothing is sent.
  await dialog.getByTestId("mo-add-open").click();
  await expect(dialog).toHaveAttribute("data-step", "add");
  await expect(dialog.getByTestId("mo-step-head")).toBeFocused();
  let writes = 0;
  page.on("request", (r) => {
    if (r.url().includes("/api/v1/server/integrations/tenants/")) writes++;
  });
  await dialog.getByTestId("mo-add-save").click();
  await expect(dialog.getByTestId("mo-add-label")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await expect(dialog.getByTestId("mo-add-tenant")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  expect(writes).toBe(0);
  await axe(page, '[data-testid="mo-dialog"]');
  await spacing(dialog, "add");
  await dialog.getByTestId("mo-add-label").fill("Asiakas Yksi Oy");
  // Pasted as Entra shows it; the list keeps it lowercase.
  await dialog.getByTestId("mo-add-tenant").fill(one.toUpperCase());
  const sent = nextBody(
    page,
    "/api/v1/server/integrations/tenants/set",
    "POST",
  );
  await dialog.getByTestId("mo-add-save").click();
  expect(await sent).toEqual({ tenant_id: one, label: "Asiakas Yksi Oy" });

  // Saved, the step goes on to the approval: the message carries each
  // level's admin-consent link at the client's own authority, narrowest
  // first, for the shared applications.
  await expect(dialog).toHaveAttribute("data-step", "consent");
  await expect(dialog.getByTestId("mo-step-head")).toBeFocused();
  const message = dialog.getByTestId("mo-message");
  await expect(message).toContainText(
    `https://login.microsoftonline.com/${one}/v2.0/adminconsent?client_id=${sharedRead}&`,
  );
  await expect(message).toContainText(
    `https://login.microsoftonline.com/${one}/v2.0/adminconsent?client_id=${sharedFull}&`,
  );
  const text = (await message.textContent()) ?? "";
  expect(text.indexOf(sharedRead)).toBeLessThan(text.indexOf(sharedFull));
  await expect(dialog.getByTestId("mo-link-read")).toBeVisible();
  await expect(dialog.getByTestId("mo-link-full")).toBeVisible();
  await expect(dialog.getByTestId("mo-link-nosend")).toHaveCount(0);
  await axe(page, '[data-testid="mo-dialog"]');
  await spacing(dialog, "consent");
  // Back on the list, focus is on the row the step was about.
  await dialog.getByTestId("mo-consent-done").click();
  await expect(dialog).toHaveAttribute("data-step", "list");
  await expect(dialog.getByTestId(`mo-consent-open-${one}`)).toBeFocused();
  expect(
    (
      await (await page.request.get("/api/v1/server/integrations")).json()
    ).tenants.map((t: { tenant_id: string }) => t.tenant_id),
  ).toEqual([one]);

  // The same organisation twice is caught before sending.
  await dialog.getByTestId("mo-add-open").click();
  await dialog.getByTestId("mo-add-label").fill("Toinen nimi");
  await dialog.getByTestId("mo-add-tenant").fill(one);
  const before = writes;
  await dialog.getByTestId("mo-add-save").click();
  await expect(dialog.getByTestId("mo-add-tenant")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  expect(writes).toBe(before);
  await dialog.getByTestId("mo-back").click();
  await expect(dialog.getByTestId("mo-add-open")).toBeFocused();

  // Removal asks first; cancelling returns to the row.
  await dialog.getByTestId(`mo-remove-open-${one}`).click();
  await expect(dialog).toHaveAttribute("data-step", "remove");
  await axe(page, '[data-testid="mo-dialog"]');
  await spacing(dialog, "remove");
  await dialog.getByTestId("mo-remove-cancel").click();
  await expect(dialog.getByTestId(`mo-consent-open-${one}`)).toBeFocused();
  await dialog.getByTestId(`mo-remove-open-${one}`).click();
  const removed = nextBody(
    page,
    "/api/v1/server/integrations/tenants/remove",
    "POST",
  );
  await dialog.getByTestId("mo-remove-confirm").click();
  expect(await removed).toEqual({ tenant_id: one });
  await expect(dialog).toHaveAttribute("data-step", "list");
  await expect(dialog.getByTestId(`mo-org-${one}`)).toHaveCount(0);
  await expect(dialog.getByTestId("mo-add-open")).toBeFocused();
  await dialog.getByTestId("mo-close").click();
  await expect(dialog).toHaveCount(0);
  await expect(orgs).toHaveAttribute("data-count", "1");

  // With every level set, Levels is quiet and counts four.
  await apps(page, "set=microsoft_nosend");
  await apps(page, "set=microsoft_drafts");
  await page.reload();
  await expect(levels).toHaveAttribute("data-count", "4/4");
  await expect(levels).toHaveClass(/ah-button-quiet/);
  // Its dialog's set levels and their removals keep the controls' gap.
  await levels.click();
  await spacing(page.getByTestId("ml-dialog"), "levels dialog");
});

test("@m365-orgs @a11y the Organisations dialog and the row fit a phone", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page, "/settings");
  await severalOrganisations(page);
  await page.goto("/settings/server-integrations");
  const row = page.getByTestId("si-row-microsoft");
  await expect(row.getByTestId("si-orgs-microsoft")).toHaveAttribute(
    "data-count",
    "3",
  );
  await spacing(row, "phone row");
  await row.getByTestId("si-orgs-microsoft").click();
  const dialog = page.getByTestId("mo-dialog");
  const item = dialog.getByTestId(`mo-org-${one}`);
  // The actions go under the name, so the name keeps the width.
  const name = await item.locator(".mo-orgmain").boundingBox();
  const acts = await item.locator(".mo-rowacts").boundingBox();
  expect(acts?.y ?? 0).toBeGreaterThanOrEqual(
    (name?.y ?? 0) + (name?.height ?? 0) - 1,
  );
  // The dialog is centred and within the screen, as Levels is.
  const box = await dialog.boundingBox();
  expect(box?.x ?? -1).toBeGreaterThanOrEqual(0);
  expect((box?.x ?? 0) + (box?.width ?? 999)).toBeLessThanOrEqual(390);
  await spacing(dialog, "phone list");
  await axe(page, '[data-testid="mo-dialog"]');
  await dialog.getByTestId(`mo-consent-open-${one}`).click();
  await spacing(dialog, "phone consent");
  await dialog.getByTestId("mo-consent-done").click();
  await dialog.getByTestId(`mo-remove-open-${one}`).click();
  await spacing(dialog, "phone remove");
});

test("@m365-orgs a person connects one address in two organisations, a guest's files alone, and reads each refusal", async ({
  page,
}) => {
  await signIn(page, "/settings");
  await integrations(page, "action=reset");
  await severalOrganisations(page);
  await integrations(page, `action=guest&tenant=${one}`);
  await page.goto("/settings/agent-data");
  await expect(page.getByTestId("integrations-loading")).toHaveCount(0);

  // Nothing connected yet: the tile asks which organisation first.
  const tile = page.getByTestId("integration-tile-microsoft");
  await tile.getByTestId("integration-connect-open").click();
  const dialog = page.getByTestId("integration-dialog");
  await expect(dialog).toHaveAttribute("data-stage", "organisation");
  await expect(dialog.getByRole("radio")).toHaveCount(3);
  await expect(
    dialog.getByTestId(`integration-organisation-${own}`).getByRole("radio"),
  ).toBeChecked();
  await axe(page, '[data-testid="integration-dialog"]');
  await spacing(dialog, "organisation step");
  await dialog.getByTestId("integration-organisation-continue").click();
  await expect(dialog).toHaveAttribute("data-stage", "intro");
  await expect(dialog.getByTestId("integration-orgline")).toBeVisible();
  const start = nextBody(page, "/api/v1/integrations/login", "POST");
  await dialog.getByTestId("integration-continue").click();
  expect(await start).toMatchObject({
    action: "start",
    provider: "microsoft",
    tenant_id: own,
  });
  await expect(dialog.getByTestId("integration-device-code")).toBeVisible();
  await integrations(page, "action=approve");
  await expect(dialog.getByTestId("integration-connected")).toBeVisible();
  await expect(dialog.getByTestId("integration-guest-files")).toHaveCount(0);
  await dialog.getByTestId("integration-done").click();

  // One card for the own organisation, named, and an offer for each other.
  const cards = page.getByTestId("integration-account-microsoft");
  await expect(cards).toHaveCount(1);
  await expect(cards.first()).toHaveAttribute("data-tenant", own);
  await expect(
    cards.first().getByTestId("integration-account-organisation"),
  ).toBeVisible();
  const offerOne = page.getByTestId(`integration-org-${one}`);
  await expect(offerOne).toBeVisible();
  await expect(page.getByTestId(`integration-org-${two}`)).toBeVisible();
  await spacing(page.locator('[data-settings-row="microsoft"]'), "cards");

  // The same address as a guest in a client: straight to the levels it
  // has, the guest's way of signing in named.
  await offerOne.getByTestId("integration-org-connect").click();
  await expect(dialog).toHaveAttribute("data-stage", "intro");
  await expect(dialog.getByTestId("integration-orgline")).toBeVisible();
  await expect(
    dialog.getByTestId("integration-level-nosend").getByRole("radio"),
  ).toBeDisabled();
  await dialog.getByTestId("integration-level-read").click();
  const guest = nextBody(page, "/api/v1/integrations/login", "POST");
  await dialog.getByTestId("integration-continue").click();
  expect(await guest).toMatchObject({ tenant_id: one, level: "read" });
  await expect(dialog.getByTestId("integration-device-code")).toBeVisible();
  await integrations(page, "action=approve");
  await expect(dialog.getByTestId("integration-guest-files")).toBeVisible();
  await dialog.getByTestId("integration-done").click();
  await expect(cards).toHaveCount(2);
  const ownCard = cards.and(page.locator(`[data-tenant="${own}"]`));
  const guestCard = cards.and(page.locator(`[data-tenant="${one}"]`));
  await expect(guestCard.getByTestId("integration-files-only")).toBeVisible();
  await expect(ownCard.getByTestId("integration-files-only")).toHaveCount(0);
  await expect(guestCard.getByTestId("integration-service-mail")).toHaveCount(
    0,
  );
  await expect(page.getByTestId(`integration-org-${one}`)).toHaveCount(0);

  // The mailbox was asked about at sign-in: the organisation giving the
  // person one afterwards changes nothing until the next sign-in.
  await integrations(page, `action=mailbox&tenant=${one}`);
  // Renewing one of the two connections of that address names its
  // organisation, so the daemon does not ask which one.
  await integrations(page, "action=expire&provider=microsoft");
  await guestCard.getByTestId("integration-recheck").click();
  await expect(guestCard.getByTestId("integration-reauth")).toBeVisible();
  await expect(guestCard.getByTestId("integration-files-only")).toBeVisible();
  const renew = nextBody(page, "/api/v1/integrations/login", "POST");
  await guestCard.getByTestId("integration-reauth").click();
  expect(await renew).toMatchObject({
    action: "start",
    address: "person@work.example.test",
    tenant_id: one,
  });
  await expect(dialog.getByTestId("integration-device-code")).toBeVisible();
  // The renewal finds the mailbox: the card gains mail, calendar and
  // contacts, and the guest's files-only lines go.
  await integrations(page, "action=approve");
  await expect(dialog.getByTestId("integration-connected")).toBeVisible();
  await expect(dialog.getByTestId("integration-guest-files")).toHaveCount(0);
  await dialog.getByTestId("integration-done").click();
  await expect(dialog).toHaveCount(0);
  await expect(guestCard.getByTestId("integration-files-only")).toHaveCount(0);
  await expect(guestCard.getByTestId("integration-service-mail")).toBeVisible();
  await integrations(page, "action=reset");
  await integrations(page, `action=guest&tenant=${one}`);

  // Refusals in the second client name it; each offers a fresh start.
  const offerTwo = page.getByTestId(`integration-org-${two}`);
  for (const outcome of ["consent", "not_in_organisation", "blocked"]) {
    await integrations(page, `action=outcome&value=${outcome}`);
    await offerTwo.getByTestId("integration-org-connect").click();
    await dialog.getByTestId("integration-continue").click();
    await expect(dialog.getByTestId("integration-org-refusal")).toBeVisible();
    await expect(dialog.getByTestId("integration-orgline")).toBeVisible();
    if (outcome === "consent")
      await expect(dialog.getByTestId("integration-org-ask")).toBeVisible();
    await axe(page, '[data-testid="integration-dialog"]');
    await spacing(dialog, `refusal ${outcome}`);
    await dialog.getByTestId("dialog-close").first().click();
    await expect(dialog).toHaveCount(0);
  }
  await integrations(page, "action=outcome&value=");
  // An organisation taken off the list after the page was read is refused
  // before anything reaches Microsoft.
  await apps(page, `untenant=${two}`);
  await offerTwo.getByTestId("integration-org-connect").click();
  await dialog.getByTestId("integration-continue").click();
  await expect(dialog.getByTestId("integration-login-failed")).toBeVisible();
  await dialog.getByTestId("dialog-close").first().click();

  // Removing the guest connection names its organisation and leaves the
  // own one with the same address.
  await guestCard.getByTestId("integration-remove-open").click();
  const remove = nextBody(page, "/api/v1/integrations/accounts", "DELETE");
  await page.getByTestId("integration-remove-confirm").click();
  expect(await remove).toMatchObject({
    action: "remove",
    address: "person@work.example.test",
    tenant_id: one,
  });
  await expect(cards).toHaveCount(1);
  await expect(cards.first()).toHaveAttribute("data-tenant", own);
});

test("@m365-orgs with one organisation, connecting looks as it did: no organisation step, no organisation named", async ({
  page,
}) => {
  await signIn(page, "/settings");
  await integrations(page, "action=reset");
  await page.goto("/settings/agent-data");
  await expect(page.getByTestId("integrations-loading")).toHaveCount(0);
  await page
    .getByTestId("integration-tile-microsoft")
    .getByTestId("integration-connect-open")
    .click();
  const dialog = page.getByTestId("integration-dialog");
  await expect(dialog).toHaveAttribute("data-stage", "intro");
  await expect(dialog.getByTestId("integration-orgline")).toHaveCount(0);
  const start = nextBody(page, "/api/v1/integrations/login", "POST");
  await dialog.getByTestId("integration-continue").click();
  expect(await start).not.toHaveProperty("tenant_id");
  await integrations(page, "action=approve");
  await dialog.getByTestId("integration-done").click();
  const card = page.getByTestId("integration-account-microsoft");
  await expect(card).toHaveCount(1);
  await expect(
    card.getByTestId("integration-account-organisation"),
  ).toHaveCount(0);
  await expect(page.locator('[data-testid^="integration-org-"]')).toHaveCount(
    0,
  );

  // The administrator's row has its two buttons and nothing else changed.
  await page.goto("/settings/server-integrations");
  const row = page.getByTestId("si-row-microsoft");
  await expect(row.getByTestId("si-orgs-microsoft")).toHaveAttribute(
    "data-count",
    "1",
  );
  await expect(row.getByTestId("si-setup-microsoft")).toHaveAttribute(
    "data-count",
    "1/4",
  );
});
