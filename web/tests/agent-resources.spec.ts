import AxeBuilder from "@axe-core/playwright";
import { hostOrigin } from "../test-ports.mjs";
import { expect, type Page, test } from "./worker-host";

// Agentin käytössä (agent-resources-view, experimental) against the
// synthetic host: the real gateway and daemon handlers, the stand-in
// Microsoft entry with its OneDrive seeded through /fixture/agent-files, and
// the daemon's folder read of the synced folder as the person. Same-UID
// synthetic evidence: it proves routing, the browser/host contract and the
// folder read's containment of links, not Linux user isolation.
test.use({
  baseURL: hostOrigin,
  ignoreHTTPSErrors: true,
  deviceScaleFactor: 2,
});

const evidence = "../issues/agent-resources-view/evidence";
const capture = !!process.env.OH_VISUAL_CAPTURE;

async function signIn(page: Page, on: boolean) {
  await page.goto("/workspaces");
  await page
    .getByRole("button")
    .and(page.getByTestId("github-sign-in"))
    .click();
  await page.getByRole("link").nth(0).click();
  const csrf = async () =>
    (
      (await (await page.request.get("/auth/session")).json()) as {
        csrf?: string;
      }
    ).csrf;
  await expect.poll(csrf).toBeTruthy();
  expect((await page.request.get("/fixture/agent-files")).status()).toBe(204);
  const session = await (await page.request.get("/auth/session")).json();
  expect(
    (
      await page.request.put("/api/v1/account/preferences", {
        headers: {
          Origin: new URL(page.url()).origin,
          "X-Agent-Host-CSRF": session.csrf,
        },
        data: { experimental: { "agent-resources-view": on } },
      })
    ).ok(),
  ).toBe(true);
  await page.reload();
}

const onedrive = "files:~/cloud/onedrive/person@work.example.test";
const source = (page: Page, id: string) =>
  page.getByRole("button").and(page.getByTestId(`resource-source-${id}`));

async function shoot(page: Page, name: string) {
  if (!capture) return;
  await page.screenshot({ path: `${evidence}/${name}.png` });
  const fs = await import("node:fs/promises");
  await fs.writeFile(`${evidence}/${name}.html`, await page.content());
}

test("@agent-resources lists the agent's sources by kind and browses the synced folder as the person", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await signIn(page, true);
  const rail = page.getByRole("link").and(page.getByTestId("rail-resources"));
  await expect(rail).toHaveText("Agentin käytössä");
  await rail.click();
  await expect(page).toHaveURL(/\/resources$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Agentin käytössä" }),
  ).toBeVisible();
  await expect(page.getByTestId("resource-summary")).toContainText(
    "kaikki tehdään sinun tunnuksillasi",
  );

  // Round 1's B: kinds, each with every account's sources and what is still
  // to connect.
  const files = page.getByTestId("resource-kind-files");
  await expect(files.getByRole("heading", { name: "Tiedostot" })).toBeVisible();
  await expect(source(page, onedrive)).toContainText("OneDrive");
  await expect(source(page, onedrive)).toContainText("Täysi");
  await expect(
    page
      .getByTestId("resource-kind-mail")
      .getByTestId(/^resource-source-mail:microsoft:/),
  ).toContainText("Outlook-posti");
  await expect(
    page
      .getByTestId("resource-kind-files")
      .getByTestId("resource-offer-google"),
  ).toContainText("Yhdistä");
  await expect(
    page
      .getByTestId("resource-kind-machines")
      .getByTestId("resource-offer-machine"),
  ).toContainText("Lisää");

  // The first source opens on a computer; round 3's C plus the folder.
  const detail = page.getByTestId("resource-detail");
  await expect(detail).toHaveAttribute("data-source", onedrive);
  await expect(source(page, onedrive)).toHaveAttribute("aria-current", "true");
  await expect(detail.getByTestId("resource-in")).toContainText(
    "Koko OneDrive",
  );
  const entries = detail.getByTestId("resource-entry");
  await expect(entries).toHaveCount(2);
  await expect(entries.nth(0)).toHaveAttribute("data-kind", "folder");
  await expect(entries.nth(0)).toContainText("Raportit");
  await expect(entries.nth(1)).toContainText("Projektisuunnitelma.docx");
  await expect(entries.nth(1)).toContainText("84 KiB");
  // The link out of the folder is neither listed nor followed.
  await expect(detail.getByTestId("resource-files")).not.toContainText(
    "avaimet",
  );
  await expect(detail.getByTestId("resource-files")).toContainText(
    "1 kohde ei näy tässä",
  );
  const verbs = detail.getByTestId("resource-verbs");
  await expect(
    verbs.locator("li", { hasText: "Jakaa linkillä" }),
  ).toContainText("Ei voi estää");
  const a11y = await new AxeBuilder({ page })
    .include('[data-testid="agent-resources"]')
    .analyze();
  expect(a11y.violations).toEqual([]);
  await shoot(page, "desktop-files");

  // A folder opens in place and the route records it; the agent's own file
  // is there like any other.
  await entries.nth(0).click();
  await expect(page).toHaveURL(/folder=Raportit/);
  await expect(detail.getByTestId("resource-crumbs")).toContainText(
    "OneDrive›Raportit",
  );
  await expect(entries).toHaveCount(2);
  await expect(entries.nth(1)).toContainText("viikko-46.md");
  await page.reload();
  await expect(entries.nth(1)).toContainText("viikko-46.md");
  await detail
    .getByTestId("resource-crumbs")
    .getByRole("button", { name: "OneDrive" })
    .click();
  await expect(entries.nth(0)).toContainText("Raportit");

  // Mail is not opened here: its limits, and where the messages are.
  await page
    .getByTestId("resource-kind-mail")
    .getByRole("button")
    .filter({ hasText: "Outlook-posti" })
    .click();
  await expect(detail).toHaveAttribute("data-source", /^mail:microsoft:/);
  await expect(detail.getByTestId("resource-files")).toHaveCount(0);
  await expect(detail.getByTestId("resource-in")).toContainText(
    "Koko postilaatikko, kaikki kansiot",
  );
  await expect(
    detail.getByTestId("resource-verbs").locator('li[data-yes="true"]'),
  ).toHaveCount(4);
  await expect(detail.getByTestId("resource-elsewhere")).toContainText(
    "Viestit näet Outlookissa",
  );
  await shoot(page, "desktop-mail");

  // The source leads to its own account's settings row.
  await detail
    .getByRole("link")
    .and(detail.getByTestId("resource-settings"))
    .click();
  await expect(page).toHaveURL(/\/settings\/agent-data#microsoft$/);
});

test("@agent-resources on a phone the list comes first and a source opens on its own", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page, true);
  await page.goto("/resources");
  await expect(page.getByTestId("resource-list")).toBeVisible();
  await expect(page.getByTestId("resource-detail")).toHaveCount(0);
  await shoot(page, "phone-list");
  await source(page, onedrive).click();
  const detail = page.getByTestId("resource-detail");
  await expect(detail.getByTestId("resource-entry").first()).toContainText(
    "Raportit",
  );
  await expect(page.getByTestId("resource-list")).toHaveCount(0);
  await shoot(page, "phone-files");
  await detail
    .getByRole("button")
    .and(detail.getByTestId("resource-back"))
    .click();
  await expect(page.getByTestId("resource-list")).toBeVisible();
});

test("@agent-resources stays out of the way while the feature is off", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await signIn(page, false);
  await expect(page.getByTestId("rail-resources")).toHaveCount(0);
  await page.goto("/resources");
  await expect(page.getByTestId("agent-resources")).toHaveCount(0);
});
