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
  await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
  await page.getByRole("link", { name: who, exact: true }).click();
  await page.goto("/settings#integraatiot");
  await expect(
    page.getByRole("heading", { name: "Integraatiot", level: 2 }),
  ).toBeVisible();
  await expect(page.getByText("Luetaan integraatioita")).toHaveCount(0);
}

const fixture = (page: Page, query: string) =>
  page.request.get(`/fixture/integrations?${query}`);

async function tile(page: Page, name: string) {
  return page.locator(".ig-tile").filter({ hasText: name });
}

test("an IMAP account connects with an app password, is the person's own, and is removed", async ({
  page,
  browser,
}) => {
  await signIn(page);
  await (await tile(page, "Sähköposti (IMAP)"))
    .getByRole("button", { name: "Yhdistä…" })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("note")).toContainText(
    "Agentit voivat lukea ja käyttää kaikkea",
  );
  await dialog.getByRole("button", { name: "Jatka" }).click();
  await dialog.getByLabel("Sähköpostiosoite").fill("Person@Example.test");
  await expect(dialog.getByLabel("IMAP-palvelin")).toHaveValue(
    "imap.example.test",
  );
  await dialog.getByLabel("Sovellussalasana").fill("wrong-password");
  await dialog.getByRole("button", { name: "Yhdistä" }).click();
  await expect(dialog.getByRole("alert")).toContainText(
    "Palvelin ei hyväksynyt tunnusta tai salasanaa. Mitään ei tallennettu.",
  );
  // The password field is emptied after every attempt.
  await expect(dialog.getByLabel("Sovellussalasana")).toHaveValue("");
  await dialog.getByLabel("Sovellussalasana").fill("synthetic-app-password");
  await dialog.getByRole("button", { name: "Yhdistä" }).click();
  await expect(dialog.getByRole("status")).toContainText(
    "Yhdistetty: person@example.test.",
  );
  await dialog.getByRole("button", { name: "Valmis" }).click();
  const card = page.getByRole("article", { name: /person@example\.test/ });
  await expect(card).toContainText("Toimii");
  await expect(card).toContainText(/Tarkistettu klo \d+\.\d\d/);
  const list = await (await page.request.get("/api/v1/integrations")).json();
  expect(list.skill).toBe("current");
  expect(JSON.stringify(list)).not.toContain("synthetic-app-password");
  await expect(
    page.getByRole("button", { name: "Lisää toinen sähköpostitili" }),
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

  await card.getByRole("button", { name: "Poista…" }).click();
  const confirm = page.getByRole("alertdialog");
  await expect(confirm).toContainText(
    "Sovellussalasana pysyy voimassa postipalvelussasi",
  );
  await expect(confirm.getByRole("checkbox")).toHaveCount(0);
  await confirm.getByRole("button", { name: "Poista" }).click();
  await expect(page.getByText("Poistettu.", { exact: true })).toBeVisible();
  await expect(card).toHaveCount(0);
  expect(
    (await (await page.request.get("/api/v1/integrations")).json()).skill,
  ).toBe("none");
});

test("a device code relays to the browser, folders fit the quota, and sync starts", async ({
  page,
}) => {
  await signIn(page);
  await fixture(page, "action=reset");
  await (await tile(page, "Microsoft 365"))
    .getByRole("button", { name: "Yhdistä…" })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Jatka: Microsoft" }).click();
  await expect(dialog.getByText("K7QM2PXDW")).toBeVisible();
  const open = dialog.getByRole("link", {
    name: /Avaa login\.microsoft\.com\/device/,
  });
  await expect(open).toHaveAttribute(
    "href",
    "https://login.microsoft.com/device",
  );
  await expect(open).toHaveAttribute("rel", "noopener noreferrer");
  await expect(
    dialog.getByRole("list", { name: "Vaiheet" }).getByRole("listitem"),
  ).toHaveCount(2);
  // One lost poll does not strand the dialog.
  let polls = 0;
  await page.route("**/api/v1/integrations/login", (route) =>
    route.request().method() === "GET" && polls++ === 0
      ? route.fulfill({ status: 503 })
      : route.continue(),
  );
  await expect.poll(() => polls).toBeGreaterThan(0);
  await fixture(page, "action=approve");
  await expect(
    dialog.getByText(/Mitkä kansiot synkronoidaan kansioon/),
  ).toBeVisible();
  await page.unroute("**/api/v1/integrations/login");
  await expect(
    dialog.getByText("~/cloud/onedrive/person@work.example.test"),
  ).toBeVisible();
  await dialog.getByRole("button", { name: /Aloita synkronointi/ }).click();
  await expect(
    dialog.getByText("Yhdistetty: person@work.example.test."),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Valmis" }).click();
  const card = page.getByRole("article", {
    name: /person@work\.example\.test/,
  });
  await expect(card).toContainText("OneDrive ja SharePoint");
  await expect(card).toContainText("Synkronoi jatkuvasti");
  await expect(card).toContainText("~/cloud/onedrive/person@work.example.test");
  await expect(
    page.getByRole("button", { name: "Lisää toinen Microsoft 365-tili" }),
  ).toBeVisible();

  // An expired login is shown as the tool reports it and offers a sign-in.
  await fixture(page, "action=expire&provider=microsoft");
  await card.getByRole("button", { name: "Tarkista" }).click();
  await expect(card).toContainText("Kirjautuminen vanhentunut");
  await card.getByRole("button", { name: "Kirjaudu uudelleen" }).click();
  await expect(
    dialog.getByRole("heading", { name: "Kirjaudu uudelleen: Microsoft 365" }),
  ).toBeVisible();
  // A renewal goes straight to the code and skips the folder step.
  await expect(dialog.getByText("K7QM2PXDW")).toBeVisible();
  await expect(dialog.getByRole("list", { name: "Vaiheet" })).toHaveCount(0);
  await fixture(page, "action=approve");
  await expect(dialog.getByText(/Kirjauduttu uudelleen/)).toBeVisible();
  await dialog.getByRole("button", { name: "Valmis" }).click();
  await expect(card).toContainText("Synkronoi jatkuvasti");
});

test("a pasted redirect must be the loopback address; a choice over quota is refused", async ({
  page,
}) => {
  await signIn(page);
  await (await tile(page, "Google"))
    .getByRole("button", { name: "Yhdistä…" })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Jatka: Google" }).click();
  const popup = page.waitForEvent("popup");
  await dialog.getByRole("link", { name: "Avaa Google" }).click();
  await (await popup).close();
  const field = dialog.getByRole("textbox", { name: "Paluuosoite" });
  await field.fill(
    "https://accounts.example.test/signin/oauth/consent?authuser=0",
  );
  await dialog.getByRole("button", { name: "Yhdistä" }).click();
  await expect(dialog.getByRole("alert")).toContainText(
    "Tämä ei ole se osoite",
  );
  await field.fill(
    "http://127.0.0.1:46399/oauth2/callback?state=lab&code=4/synthetic",
  );
  await dialog.getByRole("button", { name: "Yhdistä" }).click();
  await expect(dialog.getByText(/Mitkä kansiot synkronoidaan/)).toBeVisible();
  const photos = dialog.getByText("Kuvat", { exact: true });
  await photos.click();
  await expect(dialog.getByRole("checkbox", { name: "Kuvat" })).toBeChecked();
  await expect(dialog.getByText("Ei mahdu.")).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: /Aloita synkronointi/ }),
  ).toBeDisabled();
  await photos.click();
  await dialog.getByRole("button", { name: /Aloita synkronointi/ }).click();
  await expect(
    dialog.getByText("Yhdistetty: person.home@example.test."),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Valmis" }).click();
  const card = page.getByRole("article", {
    name: /person\.home@example\.test/,
  });
  await expect(card).toContainText("Google Drive");

  // Removal keeps the folder unless asked; asked, it goes to the Trash.
  await card.getByRole("button", { name: "Poista…" }).click();
  const confirm = page.getByRole("alertdialog");
  await confirm.getByText(/roskakoriin/).click();
  await expect(confirm.getByRole("checkbox")).toBeChecked();
  await confirm.getByRole("button", { name: "Poista" }).click();
  await expect(page.getByText(/siirrettiin roskakoriin/)).toBeVisible();
});

test("tenant refusals are said plainly, and leaving the dialog cancels the sign-in", async ({
  page,
}) => {
  await signIn(page);
  const dialog = page.getByRole("dialog");
  const start = async () => {
    await (await tile(page, "Microsoft 365"))
      .getByRole("button", { name: "Yhdistä…" })
      .click();
    await dialog.getByRole("button", { name: "Jatka: Microsoft" }).click();
  };
  await fixture(page, "action=outcome&value=consent");
  await start();
  await expect(dialog.getByRole("alert")).toContainText(
    "Organisaatiosi vaatii ylläpitäjän luvan.",
  );
  await expect(dialog.getByText(/adminconsent\?client_id=/)).toBeVisible();
  await dialog
    .getByRole("button", { name: "Sulje", exact: true })
    .first()
    .click();
  await fixture(page, "action=outcome&value=blocked");
  await start();
  await expect(dialog.getByRole("alert")).toContainText(
    "estää kirjautumisen laitekoodilla",
  );
  await dialog
    .getByRole("button", { name: "Sulje", exact: true })
    .first()
    .click();

  await fixture(page, "action=outcome&value=");
  await start();
  await expect(dialog.getByText("K7QM2PXDW")).toBeVisible();
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
  await (await tile(page, "Google"))
    .getByRole("button", { name: "Yhdistä…" })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(
    (await new AxeBuilder({ page }).analyze()).violations,
    "step 2",
  ).toEqual([]);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Jatka: Google" })
    .click();
  await expect(page.getByRole("link", { name: "Avaa Google" })).toBeVisible();
  expect(
    (await new AxeBuilder({ page }).analyze()).violations,
    "step 3",
  ).toEqual([]);
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/settings#integraatiot");
  await expect(
    page.getByRole("heading", { name: "Integraatiot", level: 2 }),
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
