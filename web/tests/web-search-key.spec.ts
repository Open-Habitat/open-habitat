import AxeBuilder from "@axe-core/playwright";
import { hostOrigin } from "../test-ports.mjs";
import { expect, type Page, test } from "./worker-host";

// The web search key (web-search-key-product) through the real gateway and
// daemon routes against the browser host's synthetic Brave: the
// administrator's Brave row on Palvelinintegraatiot and the person's card or
// tile on Tiedot agenteille. A key starting "BSAbad" is refused by the fake
// Brave; /fixture/brave?action=refuse writes the search extension's refusal
// mark for the key in a home. Same-UID synthetic evidence: it proves the
// routes, the contract and the pages, not Brave itself or UID isolation.

test.use({
  baseURL: hostOrigin,
  ignoreHTTPSErrors: true,
  viewport: { width: 1280, height: 900 },
});

const siteKey = "BSAsite0000000000000000000Kq7Z";
const ownKey = "BSAown00000000000000000000Ab12";
const badKey = "BSAbad00000000000000000000Xx00";

async function signIn(page: Page) {
  await page.goto("/settings");
  await page
    .getByRole("button")
    .and(page.getByTestId("github-sign-in"))
    .click();
  await page.getByRole("link").nth(0).click();
  await expect(page).not.toHaveURL(/fixture\/provider/);
}

const asked = async (page: Page) =>
  (
    (await (await page.request.get("/fixture/brave?action=state")).json()) as {
      asked: number;
    }
  ).asked;

test("the administrator's Brave key is tried, stored and given; removing it recalls nothing", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/settings/server-integrations");
  const row = page.getByTestId("site-search-row-brave");
  await expect(row).toHaveAttribute("data-site", "none");
  await expect(row).toContainText("Ei tarjolla");
  // The row sits after the other services, as a new service would.
  await expect(
    page.locator("[data-testid=si-rows] > li").last(),
  ).toHaveAttribute("data-testid", "site-search-row-brave");
  await page.getByTestId("site-search-set-brave").click();
  const dialog = page.getByTestId("search-key-dialog");
  await expect(dialog).toContainText("Yhteinen Brave-avain");
  expect(
    (
      await new AxeBuilder({ page })
        .include("[data-testid=search-key-dialog]")
        .analyze()
    ).violations,
  ).toEqual([]);
  // A refused key is not stored and keeps the dialog open with the reason.
  await page.getByTestId("search-key-input").fill(badKey);
  await page.getByTestId("search-key-save").click();
  await expect(page.getByTestId("search-key-rejected")).toContainText(
    "Brave ei hyväksynyt",
  );
  await expect(row).toHaveAttribute("data-site", "none");
  await page.getByTestId("search-key-input").fill(siteKey);
  await page.getByTestId("search-key-save").click();
  await expect(dialog).toHaveCount(0);
  await expect(row).toHaveAttribute("data-site", "set");
  await expect(page.getByTestId("site-search-detail-brave")).toContainText(
    "…Kq7Z",
  );
  await expect(page.getByTestId("site-search-given")).toContainText(
    "sai avaimen",
  );
  await expect(row).toContainText("Tarjolla");
  expect(await asked(page)).toBe(2);

  // The administrator's own daemon took a copy: they joined.
  await page.goto("/settings/agent-data");
  const card = page.getByTestId("search-key");
  await expect(card).toHaveAttribute("data-source", "site");
  await expect(page.getByTestId("search-key-source")).toHaveText(
    "Ylläpitäjän avain …Kq7Z",
  );
  await expect(page.getByTestId("search-key-replace")).toHaveText(
    "Lisää oma avain",
  );

  await page.goto("/settings/server-integrations");
  await page.getByTestId("site-search-menu").getByRole("button").click();
  // The key and its day head the menu, as Tunnukset says who set them.
  await expect(page.getByText(/^Brave …Kq7Z, otettu käyttöön /)).toBeVisible();
  await page.getByRole("menuitem", { name: "Poista avain" }).click();
  await expect(page.getByTestId("site-search-removed")).toContainText(
    "Jo annetut kopiot jäivät ennalleen",
  );
  await expect(row).toHaveAttribute("data-site", "none");
  await page.goto("/settings/agent-data");
  await expect(page.getByTestId("search-key")).toHaveAttribute(
    "data-source",
    "site",
  );
});

test("the person's own Brave key: a tile to add, a card once saved, the extension's refusal and removal", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/settings/agent-data");
  const tile = page.getByTestId("search-tile-brave");
  await expect(tile).toBeVisible();
  await expect(page.getByTestId("search-key")).toHaveCount(0);
  // The settings search lands on the tile while there is no key.
  await expect(tile).toHaveAttribute("data-settings-row", "web-search");
  await page.getByTestId("search-add-brave").click();
  await expect(page.getByTestId("search-key-dialog")).toContainText(
    "Brave-avain",
  );
  await page.getByTestId("search-key-input").fill("not a key");
  await expect(page.getByTestId("search-key-save")).toBeDisabled();
  await page.getByTestId("search-key-input").fill(badKey);
  await page.getByTestId("search-key-save").click();
  await expect(page.getByTestId("search-key-rejected")).toBeVisible();
  await page.getByTestId("search-key-input").fill(ownKey);
  await page.getByTestId("search-key-save").click();
  await expect(page.getByTestId("search-key-dialog")).toHaveCount(0);
  const card = page.getByTestId("search-key");
  await expect(card).toHaveAttribute("data-source", "own");
  await expect(page.getByTestId("search-key-source")).toHaveText(
    "Oma avain …Ab12",
  );
  await expect(page.getByTestId("search-key-users")).not.toBeEmpty();
  await expect(tile).toHaveCount(0);
  // The key never comes back to the browser.
  const read = await page.request.get("/api/v1/web-search/key");
  expect(await read.text()).not.toContain(ownKey);

  // Brave later refuses the key at an agent's search.
  expect(
    (
      await page.request.get("/fixture/brave?action=refuse&user=alice")
    ).status(),
  ).toBe(204);
  await page.reload();
  await expect(page.getByTestId("search-key-refused")).toContainText(
    "Brave torjui avaimen",
  );
  await expect(page.getByTestId("search-key-service")).toContainText(
    "Ei vastaa",
  );
  expect(
    (
      await new AxeBuilder({ page })
        .include("[data-testid=search-key]")
        .analyze()
    ).violations,
  ).toEqual([]);

  await page.getByTestId("search-key-remove").click();
  await expect(page.getByTestId("search-key")).toHaveCount(0);
  await expect(tile).toBeVisible();
});
