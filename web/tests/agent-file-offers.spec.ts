import { readFileSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { hostOrigin } from "../test-ports.mjs";
import { expect, type Page, test } from "./worker-host";

// Agent file offers against the real gateway and daemon handlers: the
// fixture freezes synthetic files through the real plan and export and
// publishes the conversation's notice; the one offer card, the panel beside
// the conversation, the own tab, the downloads and the conversation's list
// read them through the gateway's routes. Same-UID synthetic evidence; it
// says nothing about separate Unix users.
test.use({
  baseURL: hostOrigin,
  ignoreHTTPSErrors: true,
  viewport: { width: 1440, height: 900 },
  // Screenshots for review are taken at device scale factor 2.
  deviceScaleFactor: 2,
});

const evidence = "../issues/offer-cards-and-assets-list/evidence";
const capture = !!process.env.OH_VISUAL_CAPTURE;

/** Screenshots for review in both themes; the theme settles before each. */
async function shoot(page: Page, name: string) {
  if (!capture) return;
  const width = page.viewportSize()?.width ?? 0;
  for (const theme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: theme });
    await page.waitForTimeout(400);
    await page.screenshot({
      path: `${evidence}/${name}-${width}-${theme}.png`,
    });
  }
  await page.emulateMedia({ colorScheme: "light" });
}

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

test("each kind's card opens beside, closes on a second press and downloads under its own name", async ({
  page,
}) => {
  const id = await conversation(page);
  const [png, svg, md, csv, py, zip, parquet] = await offer(page, id, "types");
  for (const offerId of [png, svg, md, csv, py, zip, parquet])
    await expect(card(page, offerId)).toHaveAttribute("data-state", "ready");

  // The card loads only a bounded thumbnail.
  const image = card(page, png).getByTestId("file-offer-image").locator("img");
  await expect
    .poll(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth))
    .toBe(320);

  // The card's own icons sit in its corner under the pointer; its download
  // keeps the frozen bytes under the file's own name.
  const icons = card(page, csv).locator(".ah-offer-acts");
  await page.mouse.move(0, 0);
  await expect(icons).toHaveCSS("visibility", "hidden");
  await card(page, csv).hover();
  await expect(icons).toHaveCSS("visibility", "visible");
  const download = page.waitForEvent("download");
  await card(page, csv).getByTestId("offer-download").click();
  const csvFile = await download;
  expect(csvFile.suggestedFilename()).toBe("ilmoittautuneet.csv");
  expect(readFileSync((await csvFile.path()) ?? "", "utf8")).toBe(
    "nimi,kaupunki,etappi\nA,Turku,1\nB,Nauvo,2\n",
  );

  // The whole card opens the table beside the conversation, read once.
  let reads = 0;
  page.on("request", (request) => {
    if (request.url().includes(`/${csv}/download/`)) reads++;
  });
  const open = card(page, csv).getByTestId("offer-open");
  await open.click();
  const panel = page.getByTestId("offer-panel");
  await expect(panel).toHaveAttribute("data-offer-id", csv);
  await expect(
    panel.getByTestId("attachment-preview-table").getByRole("cell", {
      name: "Nauvo",
    }),
  ).toBeVisible();
  await expect(card(page, csv)).toHaveAttribute("data-open", "true");
  await expect(open).toHaveAttribute("aria-expanded", "true");
  await expect(panel.getByRole("heading")).toBeFocused();
  // The panel's top bar carries the card's icons.
  await expect(panel.getByTestId("offer-download")).toBeVisible();
  await expect(panel.getByTestId("offer-open-tab")).toBeVisible();
  const axe = await new AxeBuilder({ page })
    .include('[data-testid="offer-panel"]')
    .analyze();
  expect(axe.violations).toEqual([]);
  // The conversation goes on beside it; the panel keeps the bytes it read.
  const [later] = await offer(page, id, "single");
  await expect(card(page, later)).toHaveAttribute("data-state", "ready");
  await expect(panel.getByTestId("attachment-preview-table")).toBeVisible();
  expect(reads).toBe(1);
  await shoot(page, "kortti-taulukko");
  // Pressing the same card again closes the panel.
  await open.click();
  await expect(panel).toHaveCount(0);
  await expect(card(page, csv)).not.toHaveAttribute("data-open", "true");

  // Another kind takes the same place; Escape closes and returns focus.
  await card(page, md).getByTestId("offer-open").click();
  await expect(panel.getByTestId("attachment-document")).toBeVisible();
  await card(page, zip).getByTestId("offer-open").click();
  await expect(
    panel
      .getByTestId("attachment-preview-archive")
      .getByText("reitti/etappi-2.gpx"),
  ).toBeVisible();
  await expect(card(page, md)).not.toHaveAttribute("data-open", "true");
  await page.keyboard.press("Escape");
  await expect(panel).toHaveCount(0);
  await expect(card(page, zip).getByTestId("offer-open")).toBeFocused();

  // A kind the browser cannot show opens to its facts and its download.
  await card(page, parquet).getByTestId("offer-open").click();
  await expect(panel.getByTestId("attachment-size")).toBeVisible();
  await expect(panel.getByTestId("offer-download")).toHaveAttribute(
    "download",
    "osallistujat.parquet",
  );
  await panel.getByTestId("close-view").click();

  // File offers carry no globe until the host can publish them.
  await expect(card(page, csv).getByTestId("view-public")).toHaveCount(0);
  const axeCards = await new AxeBuilder({ page })
    .include('[data-testid="file-offer"]')
    .analyze();
  expect(axeCards.violations).toEqual([]);
  await card(page, png).scrollIntoViewIfNeeded();
  await page.mouse.move(0, 0);
  await shoot(page, "kortit");
});

test("five large offered images transfer thumbnails only until opened", async ({
  page,
}) => {
  const target = await conversation(page);
  const bodies: Promise<number>[] = [];
  const fullReads: string[] = [];
  page.on("response", (response) => {
    if (response.url().includes("/thumbnail/"))
      bodies.push(response.body().then((body) => body.length));
  });
  page.on("request", (request) => {
    if (/\/file-offers\/.*\/inline\//.test(request.url()))
      fullReads.push(request.url());
  });
  const [id] = await offer(page, target, "large-images");
  const thumbs = card(page, id).getByTestId("file-offer-thumb");
  await expect(thumbs).toHaveCount(5);
  for (const thumb of await thumbs.all()) {
    await thumb.scrollIntoViewIfNeeded();
    await expect
      .poll(() =>
        thumb
          .locator("img")
          .evaluate((img: HTMLImageElement) => img.naturalWidth),
      )
      .toBe(320);
  }
  const bytes = await Promise.all(bodies);
  expect(bytes).toHaveLength(5);
  expect(bytes.reduce((a, b) => a + b, 0)).toBeLessThan(200_000);
  expect(fullReads).toEqual([]);
  // The folder opens to its files with the same small pictures; only an
  // image opened in the panel is read whole.
  await card(page, id).getByTestId("offer-open").click();
  const panel = page.getByTestId("offer-panel");
  await panel.getByTestId("offer-folder-row").first().click();
  await expect.poll(() => fullReads.length).toBe(1);
  await expect
    .poll(() =>
      panel
        .locator("img.ah-attachment-preview-image")
        .evaluate((img: HTMLImageElement) => img.naturalWidth),
    )
    .toBe(480);
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

test("a folder opens its files beside and in a tab of its own, and the conversation's list holds every offer", async ({
  page,
  context,
}) => {
  const id = await conversation(page);
  const [single] = await offer(page, id, "single");
  const [folder] = await offer(page, id, "folder");
  const folderCard = card(page, folder);
  await expect(folderCard).toHaveAttribute("data-kind", "package");
  await expect(folderCard.getByTestId("file-offer-thumb")).toHaveCount(4);

  // The folder's download is one zip of the frozen files.
  await folderCard.hover();
  const download = page.waitForEvent("download");
  await folderCard.getByTestId("offer-download").click();
  const zip = await download;
  expect(zip.suggestedFilename()).toBe("paketti.zip");
  // A stored zip names its entries in plain bytes; the hidden file is not one.
  const bytes = readFileSync((await zip.path()) ?? "");
  expect(bytes.subarray(0, 4).toString("latin1")).toBe("PK\x03\x04");
  for (const name of ["etappi-1/a.png", "etappi-2/c.png", "logot/logo.svg"])
    expect(bytes.includes(Buffer.from(name))).toBe(true);
  expect(bytes.includes(Buffer.from(".salainen"))).toBe(false);

  // The card opens the folder's files; a file opens in the same panel and
  // the way back returns to the list.
  await folderCard.getByTestId("offer-open").click();
  const panel = page.getByTestId("offer-panel");
  const rows = panel.getByTestId("offer-folder-row");
  await expect(rows).toHaveCount(5);
  await shoot(page, "kortti-kansio");
  await panel
    .locator('[data-testid="offer-folder-row"][data-path="etappi-1/a.png"]')
    .click();
  await expect(panel.getByRole("heading")).toHaveText("a.png");
  await expect(panel.locator("img.ah-attachment-preview-image")).toBeVisible();
  // Its own tab is the app's page for that file, with no opener.
  const opened = context.waitForEvent("page");
  await panel.getByTestId("offer-open-tab").click();
  const tab = await opened;
  await expect(tab).toHaveURL(
    /\/offer\?id=f[a-z2-7]{26}&path=etappi-1%2Fa\.png$/,
  );
  await expect(tab.getByTestId("offer-open-page")).toBeVisible();
  await expect(tab.locator("img.ah-attachment-preview-image")).toBeVisible();
  await expect(tab).toHaveTitle("a.png");
  expect(await tab.evaluate(() => window.opener)).toBeNull();
  // Up from the file, the tab lists the folder like the panel.
  await tab.getByTestId("offer-panel-back").click();
  await expect(tab.getByTestId("offer-folder-row")).toHaveCount(5);
  await tab.close();
  await panel.getByTestId("offer-panel-back").click();
  await expect(rows).toHaveCount(5);
  await panel.getByTestId("close-view").click();

  // The chip beside the workers counts the conversation's offers and opens
  // their list; the top bar has no file button of its own any more.
  await expect(page.getByTestId("toggle-file-shelf")).toHaveCount(0);
  const chip = page.getByTestId("assets-chip");
  await expect(chip).toHaveAttribute("data-files", "2");
  await chip.click();
  const list = page.getByTestId("assets-list");
  await expect(list.getByTestId("asset-entry")).toHaveCount(2);
  // A row opens its item beside, the list stays open, the same row closes.
  const singleRow = list.locator(
    `[data-testid="asset-entry"][data-id="${single}"]`,
  );
  await singleRow.getByTestId("asset-open").click();
  await expect(panel).toHaveAttribute("data-offer-id", single);
  await expect(list).toBeVisible();
  await expect(singleRow.getByTestId("asset-open")).toHaveAttribute(
    "aria-current",
    "true",
  );
  await expect(card(page, single)).toHaveAttribute("data-open", "true");
  // The row's icons cover its time under the pointer.
  await singleRow.hover();
  await expect(singleRow.locator(".ah-asset-acts")).toHaveCSS(
    "visibility",
    "visible",
  );
  await expect(singleRow.getByTestId("offer-download")).toHaveAttribute(
    "download",
    "kaavio.png",
  );
  await shoot(page, "lista");
  await singleRow.getByTestId("asset-open").click();
  await expect(panel).toHaveCount(0);
  // Näytä keskustelussa brings the card into view and closes the list.
  await singleRow.hover();
  await singleRow.getByTestId("asset-locate").click();
  await expect(list).toHaveCount(0);
  await expect(card(page, single)).toBeInViewport();
  const axe = await new AxeBuilder({ page })
    .include('[data-testid="background-work"]')
    .analyze();
  expect(axe.violations).toEqual([]);

  // From the keyboard, Tab goes from the card to its own icons, which show
  // while the focus is in the card.
  await folderCard.getByTestId("offer-open").focus();
  await page.keyboard.press("Tab");
  await expect(folderCard.getByTestId("offer-open-tab")).toBeFocused();
  await expect(folderCard.locator(".ah-offer-acts")).toHaveCSS(
    "visibility",
    "visible",
  );
  // Escape closes the list and returns focus to its chip.
  await chip.click();
  await list.getByTestId("asset-open").first().focus();
  await page.keyboard.press("Escape");
  await expect(list).toHaveCount(0);
  await expect(chip).toBeFocused();
});

test("a removed offer stays as an inert card", async ({ page }) => {
  const id = await conversation(page);
  const [removed] = await offer(page, id, "removed");
  await expect(card(page, removed)).toHaveAttribute("data-state", "removed");
  await expect(card(page, removed).getByRole("link")).toHaveCount(0);
  await expect(card(page, removed).getByRole("button")).toHaveCount(0);

  // An offer removed while the page is open turns inert when the
  // conversation's list reads its offers again.
  const [later] = await offer(page, id, "single");
  await expect(card(page, later)).toHaveAttribute("data-state", "ready");
  const res = await page.request.get(`/fixture/files-remove?id=${later}`);
  expect(res.status()).toBe(204);
  await page.getByTestId("assets-chip").click();
  await expect(card(page, later)).toHaveAttribute("data-state", "removed");
  await expect(card(page, later).getByRole("link")).toHaveCount(0);
});

test.describe("phone", () => {
  test("the card fits, and what it opens covers the conversation", async ({
    page,
  }) => {
    // The conversation starts from the desktop navigation, then the
    // window narrows to a phone's.
    const id = await conversation(page);
    await page.setViewportSize({ width: 390, height: 844 });
    const [folder] = await offer(page, id, "folder");
    const [png] = await offer(page, id, "single");
    await expect(card(page, png)).toHaveAttribute("data-state", "ready");
    await expect(card(page, folder)).toHaveAttribute("data-state", "ready");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
    await page.mouse.move(0, 0);
    await shoot(page, "kortit");
    await card(page, png).getByTestId("offer-open").click();
    const panel = page.getByTestId("offer-panel");
    await expect(panel).toBeVisible();
    const box = await panel.boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(388);
    await expect(page.getByTestId("message-input")).not.toBeVisible();
    await shoot(page, "kortti-kuva");
    await panel.getByTestId("close-view").click();
    await expect(page.getByTestId("message-input")).toBeVisible();

    // The list opens above the field; opening a row covers the
    // conversation, so the list closes behind it.
    await page.getByTestId("assets-chip").click();
    const list = page.getByTestId("assets-list");
    await expect(list.getByTestId("asset-entry")).toHaveCount(2);
    const listOverflow = await list.evaluate(
      (el) => el.scrollWidth - el.clientWidth,
    );
    expect(listOverflow).toBeLessThanOrEqual(0);
    await shoot(page, "lista");
    await list
      .locator(`[data-testid="asset-entry"][data-id="${folder}"]`)
      .getByTestId("asset-open")
      .click();
    await expect(panel.getByTestId("offer-folder-row")).toHaveCount(5);
    await expect(list).toHaveCount(0);
    await panel.getByTestId("close-view").click();
  });
});

test("an offered Markdown file shows its frontmatter as metadata above the body", async ({
  page,
}) => {
  // A real Pi skill file: frontmatter with a long quoted description, then
  // a comment and the body.
  const skill = readFileSync("tests/fixtures/skill-personal-data.md", "utf8");
  const id = await conversation(page);
  const [, , md] = await offer(page, id, "types");
  await page.route(`**/${md}/download/**`, (route) =>
    route.fulfill({ contentType: "text/markdown", body: skill }),
  );
  await expect(card(page, md)).toHaveAttribute("data-state", "ready");
  await card(page, md).getByTestId("offer-open").click();
  const document = page
    .getByTestId("offer-panel")
    .getByTestId("attachment-document");
  const meta = document.getByTestId("markdown-frontmatter");
  await expect(meta.locator("dt")).toHaveText(["name", "description"]);
  await expect(meta.locator("dd").first()).toHaveText("personal-data");
  await expect(meta.locator("dd").nth(1)).toContainText(
    "Not for repository or source files.",
  );
  // The block is metadata, not a rule and running text, and the body
  // renders as before with its own heading first.
  const markdown = document.locator(".ah-markdown");
  await expect(markdown.locator(":scope > hr")).toHaveCount(0);
  await expect(markdown.locator(":scope > :nth-child(2)")).toHaveText(
    "Personal data",
  );
  const axe = await new AxeBuilder({ page })
    .include('[data-testid="attachment-document"]')
    .analyze();
  expect(axe.violations).toEqual([]);
  if (capture)
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      for (const theme of ["light", "dark"] as const) {
        await page.emulateMedia({ colorScheme: theme });
        await page.waitForTimeout(400);
        await page.screenshot({
          path: `../issues/markdown-preview-frontmatter/frontmatter-${width}-${theme}.png`,
        });
      }
    }
});
