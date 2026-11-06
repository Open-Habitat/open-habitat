import { readFileSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { hostOrigin } from "../test-ports.mjs";
import { openHeaderPanel } from "./conversation-view";
import { expect, type Page, test } from "./worker-host";

// Agent file offers against the real gateway and daemon handlers: the
// fixture freezes synthetic files through the real plan and export and
// publishes the conversation's notice; the card, the preview dialog, the
// downloads and the file panel read them through the gateway's routes.
// Same-UID synthetic evidence; it says nothing about separate Unix users.
test.use({
  baseURL: hostOrigin,
  ignoreHTTPSErrors: true,
  viewport: { width: 1366, height: 860 },
  // Screenshots for review are taken at device scale factor 2.
  deviceScaleFactor: 2,
});

const evidence = "../issues/agent-file-offer/evidence";
const shelfEvidence = "../issues/folder-offer-file-rows/evidence";
const capture = !!process.env.OH_VISUAL_CAPTURE;

async function conversation(page: Page): Promise<string> {
  await page.request.get("/fixture/scenario?value=ready");
  await page.goto("/workspaces");
  await page.getByTestId("github-sign-in").click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  await page
    .getByRole("navigation")
    .getByTestId("workspace-ordinary-dir")
    .click();
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  await expect(page).toHaveURL(/conversation=pi:/);
  return new URL(page.url()).searchParams.get("conversation") ?? "";
}

async function offer(page: Page, target: string, set: string) {
  const res = await page.request.get(
    `/fixture/files?target=${encodeURIComponent(target)}&set=${set}`,
  );
  expect(res.status()).toBe(200);
  return (await res.json()).offer_ids as string[];
}

const card = (page: Page, id: string) =>
  page.locator(`[data-testid="file-offer"][data-offer-id="${id}"]`);

test("each kind's card previews in the dialog and downloads under its own name", async ({
  page,
}) => {
  const id = await conversation(page);
  const [png, svg, md, csv, py, zip, parquet] = await offer(page, id, "types");
  for (const offerId of [png, svg, md, csv, py, zip, parquet])
    await expect(card(page, offerId)).toHaveAttribute("data-state", "ready");

  // The image shows in its card, loaded through the inline route.
  const image = card(page, png).getByTestId("file-offer-image").locator("img");
  await expect
    .poll(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth))
    .toBe(480);

  // Lataa downloads the frozen bytes under the file's own name.
  const download = page.waitForEvent("download");
  await card(page, csv).getByTestId("file-offer-download").click();
  const csvFile = await download;
  expect(csvFile.suggestedFilename()).toBe("ilmoittautuneet.csv");
  expect(readFileSync((await csvFile.path()) ?? "", "utf8")).toBe(
    "nimi,kaupunki,etappi\nA,Turku,1\nB,Nauvo,2\n",
  );

  // Text kinds open in the dialog from their bytes, shown unchanged.
  let reads = 0;
  page.on("request", (request) => {
    if (request.url().includes(`/${csv}/download/`)) reads++;
  });
  await card(page, csv).getByTestId("file-offer-preview").click();
  const dialog = page.getByTestId("attachment-preview");
  await expect(
    dialog.getByTestId("attachment-preview-table").getByRole("cell", {
      name: "Nauvo",
    }),
  ).toBeVisible();
  const axe = await new AxeBuilder({ page })
    .include('[data-testid="attachment-preview"]')
    .analyze();
  expect(axe.violations).toEqual([]);
  // The conversation behind the dialog goes on: the dialog keeps the bytes
  // it read. Reading again on every render emptied and refilled it, so its
  // height kept changing.
  const [later] = await offer(page, id, "single");
  await expect(card(page, later)).toHaveAttribute("data-state", "ready");
  await expect(dialog.getByTestId("attachment-preview-table")).toBeVisible();
  expect(reads).toBe(1);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(card(page, csv).getByTestId("file-offer-preview")).toBeFocused();

  await card(page, md).getByTestId("file-offer-preview").click();
  await expect(dialog.getByTestId("attachment-document")).toBeVisible();
  await page.keyboard.press("Escape");

  // A zip is listed from its facts, never extracted.
  await card(page, zip).getByTestId("file-offer-preview").click();
  await expect(
    dialog
      .getByTestId("attachment-preview-archive")
      .getByText("reitti/etappi-2.gpx"),
  ).toBeVisible();
  await page.keyboard.press("Escape");

  // A kind the browser cannot show offers only the download.
  await expect(
    card(page, parquet).getByTestId("file-offer-download"),
  ).toBeVisible();
  await expect(
    card(page, parquet).getByTestId("file-offer-preview"),
  ).toHaveCount(0);

  const axeCards = await new AxeBuilder({ page })
    .include('[data-testid="file-offer"]')
    .analyze();
  expect(axeCards.violations).toEqual([]);
  if (capture) {
    await card(page, png).scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${evidence}/tunniste-desktop-light.png` });
  }
});

test("an offered file opened directly runs nothing on the app's origin", async ({
  page,
  context,
}) => {
  const id = await conversation(page);
  const [, svg, , , , , parquet] = await offer(page, id, "types");
  await expect(card(page, svg)).toHaveAttribute("data-state", "ready");
  const direct = await context.newPage();
  // The SVG carries a script that would retitle the page; the sandbox CSP
  // keeps it from running even as a top-level document.
  const response = await direct.goto(
    `/api/v1/file-offers/${svg}/inline/logo.svg`,
  );
  expect(response?.headers()["content-security-policy"]).toMatch(/^sandbox;/);
  expect(await direct.title()).not.toBe("svg-script-ran");
  // Everything that is not an image, audio or video is a download.
  const res = await page.request.get(
    `/api/v1/file-offers/${parquet}/inline/osallistujat.parquet`,
  );
  expect(res.headers()["content-type"]).toBe("application/octet-stream");
  expect(res.headers()["content-disposition"]).toMatch(/^attachment;/);
  // Another person's offer, or one that does not exist, is not there.
  const missing = await page.request.get(
    "/api/v1/file-offers/fzzzzzzzzzzzzzzzzzzzzzzzzzz/download/kaavio.png",
  );
  expect(missing.status()).toBe(404);
  await direct.close();
});

test("a package card downloads one zip and opens the conversation's file panel", async ({
  page,
}) => {
  const id = await conversation(page);
  const [single] = await offer(page, id, "single");
  const [folder] = await offer(page, id, "folder");
  const packageCard = card(page, folder);
  await expect(packageCard).toHaveAttribute("data-kind", "package");
  await expect(packageCard.getByTestId("file-offer-thumb")).toHaveCount(4);

  const download = page.waitForEvent("download");
  await packageCard.getByTestId("file-offer-zip").click();
  const zip = await download;
  expect(zip.suggestedFilename()).toBe("paketti.zip");
  // A stored zip names its entries in plain bytes; the hidden file is not one.
  const bytes = readFileSync((await zip.path()) ?? "");
  expect(bytes.subarray(0, 4).toString("latin1")).toBe("PK\x03\x04");
  for (const name of ["etappi-1/a.png", "etappi-2/c.png", "logot/logo.svg"])
    expect(bytes.includes(Buffer.from(name))).toBe(true);
  expect(bytes.includes(Buffer.from(".salainen"))).toBe(false);

  // The header counts the conversation's files and opens the panel.
  const toggle = page.getByTestId("toggle-file-shelf");
  await expect(toggle).toContainText("6");
  await packageCard.getByTestId("file-offer-show-files").click();
  const shelf = page.getByTestId("file-shelf");
  await expect(shelf).toBeVisible();
  await expect(shelf.getByTestId("file-shelf-offer")).toHaveCount(2);
  await expect(shelf.getByTestId("file-shelf-row")).toHaveCount(6);
  // No file is chosen for the person: the panel is the list.
  await expect(shelf.getByTestId("file-shelf-detail")).toHaveCount(0);
  await expect(toggle).toHaveAttribute("aria-pressed", "true");

  // A row's own buttons take the size's place under the pointer.
  const singleRow = shelf
    .locator(`[data-testid="file-shelf-offer"][data-offer-id="${single}"]`)
    .locator("li");
  const actions = singleRow.locator(".ah-file-shelf-actions");
  await page.mouse.move(0, 0);
  await expect(actions).toHaveCSS("opacity", "0");
  await singleRow.hover();
  await expect(actions).toHaveCSS("opacity", "1");
  await expect(
    singleRow.getByRole("button", { name: "Näytä isona: kaavio.png" }),
  ).toBeVisible();
  await expect(
    singleRow.getByRole("link", { name: "Lataa: kaavio.png" }),
  ).toBeVisible();

  // One search covers every offer of the conversation; the row's download
  // keeps the file's own name.
  await shelf.getByTestId("file-shelf-search").fill("ä");
  await expect(shelf.getByTestId("file-shelf-row")).toHaveCount(1);
  await shelf.getByTestId("file-shelf-row").hover();
  const named = page.waitForEvent("download");
  await shelf.getByTestId("file-shelf-download").click();
  expect((await named).suggestedFilename()).toBe("LUE MINUT ä.txt");
  await shelf.getByTestId("file-shelf-search").fill("");

  // Pressing a row opens its preview; closing it leaves no selection behind.
  await singleRow.getByTestId("file-shelf-row").click();
  const dialog = page.getByTestId("attachment-preview");
  await expect(dialog.locator("img")).toBeVisible();
  if (capture)
    await page.screenshot({
      path: `${shelfEvidence}/leijuva-desktop-light-esikatselu.png`,
    });
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(singleRow.getByTestId("file-shelf-row")).toBeFocused();
  await page.mouse.move(0, 0);
  await expect(singleRow).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await expect(singleRow.getByTestId("file-shelf-row")).toHaveCSS(
    "background-color",
    "rgba(0, 0, 0, 0)",
  );

  // From the keyboard, Tab goes from the row to its own buttons, which
  // show while the focus is on the row.
  const folderRow = shelf
    .locator(`[data-testid="file-shelf-offer"][data-offer-id="${folder}"]`)
    .locator("li")
    .first();
  await folderRow.getByTestId("file-shelf-row").focus();
  await page.keyboard.press("Tab");
  await expect(folderRow.getByTestId("file-shelf-preview")).toBeFocused();
  await expect(folderRow.locator(".ah-file-shelf-actions")).toHaveCSS(
    "opacity",
    "1",
  );
  await page.keyboard.press("Enter");
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  // The dialog hands focus back after it unmounts; Tab starts from there.
  await expect(folderRow.getByTestId("file-shelf-preview")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(folderRow.getByTestId("file-shelf-download")).toBeFocused();

  const axe = await new AxeBuilder({ page })
    .include('[data-testid="file-shelf"]')
    .analyze();
  expect(axe.violations).toEqual([]);
  if (capture) {
    // At rest: no keyboard focus left on a row's buttons.
    await page.evaluate(() => (document.activeElement as HTMLElement).blur());
    await singleRow.hover();
    await page.screenshot({
      path: `${shelfEvidence}/leijuva-desktop-light-osoitin.png`,
    });
    await page.mouse.move(0, 0);
    await page.screenshot({
      path: `${shelfEvidence}/leijuva-desktop-light.png`,
    });
    await page.emulateMedia({ colorScheme: "dark" });
    // Let the theme transition settle before the capture.
    await page.waitForTimeout(500);
    await singleRow.hover();
    await page.screenshot({
      path: `${shelfEvidence}/leijuva-desktop-dark.png`,
    });
    await page.emulateMedia({ colorScheme: "light" });
  }

  // Escape closes the panel and returns focus to where it was opened.
  await shelf.getByTestId("file-shelf-search").focus();
  await page.keyboard.press("Escape");
  await expect(shelf).toHaveCount(0);
  await expect(packageCard.getByTestId("file-offer-show-files")).toBeFocused();

  // A two-digit count stays inside the toggle's surface.
  await offer(page, id, "folder");
  await expect(toggle).toContainText("11");
  const button = await toggle.boundingBox();
  const count = await toggle.locator("span").boundingBox();
  expect(count && button).toBeTruthy();
  if (count && button) {
    expect(count.x).toBeGreaterThanOrEqual(button.x);
    expect(count.x + count.width).toBeLessThanOrEqual(button.x + button.width);
  }
});

test("a removed offer stays as an inert card", async ({ page }) => {
  const id = await conversation(page);
  const [removed] = await offer(page, id, "removed");
  await expect(card(page, removed)).toHaveAttribute("data-state", "removed");
  await expect(card(page, removed).getByRole("link")).toHaveCount(0);
  await expect(card(page, removed).getByRole("button")).toHaveCount(0);
  await expect(page.getByTestId("toggle-file-shelf")).toHaveCount(0);

  // An offer removed while the page is open turns inert when the file panel
  // reads the conversation's offers again.
  const [later] = await offer(page, id, "single");
  await expect(card(page, later)).toHaveAttribute("data-state", "ready");
  const res = await page.request.get(`/fixture/files-remove?id=${later}`);
  expect(res.status()).toBe(204);
  await page.getByTestId("toggle-file-shelf").click();
  await expect(card(page, later)).toHaveAttribute("data-state", "removed");
  await expect(card(page, later).getByRole("link")).toHaveCount(0);
});

test.describe("phone", () => {
  test("the card fits and the file panel covers the conversation", async ({
    page,
  }) => {
    // The conversation starts from the desktop navigation, then the
    // window narrows to a phone's.
    const id = await conversation(page);
    await page.setViewportSize({ width: 390, height: 844 });
    const [folder] = await offer(page, id, "folder");
    const [png] = await offer(page, id, "single");
    await expect(card(page, png)).toHaveAttribute("data-state", "ready");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
    if (capture)
      await page.screenshot({ path: `${evidence}/kortti-phone-light.png` });
    await openHeaderPanel(page, "toggle-file-shelf");
    const shelf = page.getByTestId("file-shelf");
    await expect(shelf).toBeVisible();
    const box = await shelf.boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(388);
    await expect(page.getByTestId("message-input")).not.toBeVisible();
    // Without hover the row's own buttons are always there, and the size
    // sits under the name.
    const row = shelf
      .locator(`[data-testid="file-shelf-offer"][data-offer-id="${folder}"]`)
      .locator("li")
      .first();
    await expect(row.locator(".ah-file-shelf-actions")).toHaveCSS(
      "opacity",
      "1",
    );
    const name = await row.locator(".ah-file-shelf-name").boundingBox();
    const size = await row.locator(".ah-file-shelf-size").boundingBox();
    expect(name && size && size.y > name.y).toBe(true);
    const rowOverflow = await shelf.evaluate(
      (el) => el.scrollWidth - el.clientWidth,
    );
    expect(rowOverflow).toBeLessThanOrEqual(0);
    if (capture) {
      await page.screenshot({
        path: `${shelfEvidence}/leijuva-phone-light.png`,
      });
      await page.emulateMedia({ colorScheme: "dark" });
      await page.waitForTimeout(500);
      await page.screenshot({
        path: `${shelfEvidence}/leijuva-phone-dark.png`,
      });
      await page.emulateMedia({ colorScheme: "light" });
    }
    await row.getByTestId("file-shelf-row").click();
    await expect(page.getByTestId("attachment-preview")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("attachment-preview")).toHaveCount(0);
    await page.getByTestId("close-file-shelf").click();
    await expect(shelf).toHaveCount(0);

    // On its side a phone is wider than the phone layout and keeps the
    // navigation; the split beside it is too narrow to share, so the panel
    // still covers the conversation.
    await page.setViewportSize({ width: 844, height: 390 });
    await page.getByTestId("toggle-file-shelf").click();
    await expect(shelf).toBeVisible();
    await expect(page.getByTestId("message-input")).not.toBeVisible();
    await expect(page.getByTestId("resize-view")).not.toBeVisible();
    await page.getByTestId("close-file-shelf").click();
    await expect(page.getByTestId("message-input")).toBeVisible();

    // Opened from an older offer's card, the panel scrolls to that offer.
    await offer(page, id, "folder");
    await expect(page.getByTestId("toggle-file-shelf")).toContainText("11");
    await card(page, folder).getByTestId("file-offer-show-files").click();
    await expect(
      shelf.locator(
        `[data-testid="file-shelf-offer"][data-offer-id="${folder}"] h3`,
      ),
    ).toBeInViewport();
  });
});
