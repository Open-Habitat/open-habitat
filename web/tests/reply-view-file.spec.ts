import AxeBuilder from "@axe-core/playwright";
import { workerHostPort } from "../test-ports.mjs";
import { createHostTest, expect, type Locator, type Page } from "./worker-host";

// Replying to a view or file offer card (reply-view-file, behind the
// experimental reply-to-message switch) through the real gateway and daemon.
// The fixture freezes synthetic offers through the real export and writes
// their notices into the native session through the conversation's bridge,
// as an agent's offer is written. The synthetic Pi answers with the exact
// text it received, so its answer shows the block the daemon prepended; the
// person's message then carries the offer's title back as its quote. Views
// need the app's own name beside the per-view hosts, as agent-views does.
const test = createHostTest(false, { BROWSER_HOST_VIEWS: "1" });
const port = workerHostPort(Number(process.env.TEST_PARALLEL_INDEX ?? 0));
test.use({
  baseURL: `https://app.oh.localhost:${port}`,
  launchOptions: {
    args: [`--host-resolver-rules=MAP *.oh.localhost:443 127.0.0.1:${port}`],
  },
  ignoreHTTPSErrors: true,
  locale: "fi-FI",
  timezoneId: "Europe/Helsinki",
  reducedMotion: "reduce",
});

async function prefer(page: Page, on: boolean) {
  const s = await (await page.request.get("/auth/session")).json();
  const put = await page.request.put("/api/v1/account/preferences", {
    headers: {
      Origin: new URL(page.url()).origin,
      "X-Agent-Host-CSRF": s.csrf,
    },
    data: { experimental: { "reply-to-message": on } },
  });
  expect(put.status()).toBe(200);
}

async function send(page: Page, text: string) {
  await page.getByTestId("message-input").fill(text);
  await page
    .getByTestId("send")
    .and(page.locator('[data-mode="send"]'))
    .click();
}

const answer = (page: Page, asked: string | RegExp) =>
  page.getByTestId("stage-reply").filter({
    hasText: typeof asked === "string" ? `Kysyit: "${asked}` : asked,
  });

/** The person's own message with an offer's quote. */
const mine = (page: Page, text: string) =>
  page
    .getByTestId("message")
    .filter({ has: page.getByTestId("sent-quote") })
    .filter({ hasText: text });

async function offers(page: Page, width: number) {
  await page.setViewportSize({ width, height: 760 });
  await page.request.get("/fixture/conversations-reset");
  await page.request.get("/fixture/scenario?value=ready");
  await page.goto("/workspaces");
  await page.getByTestId("github-sign-in").click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  await expect(page.getByTestId("workspace-navigation")).toBeAttached();
  await prefer(page, true);
  await page.reload();
  if (width < 800) await page.getByTestId("navigation-open").click();
  await page
    .getByTestId("workspace-navigation")
    .getByTestId("workspace-ordinary-dir")
    .click();
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  await send(page, "Tee raportti");
  await expect(answer(page, "Tee raportti")).toBeVisible({ timeout: 20000 });
  const id = new URL(page.url()).searchParams.get("conversation") ?? "";
  const target = encodeURIComponent(id);
  const view = await page.request.get(
    `/fixture/view?target=${target}&native=1`,
  );
  expect(view.status()).toBe(200);
  const single = await page.request.get(
    `/fixture/files?target=${target}&set=single&native=1`,
  );
  expect(single.status()).toBe(200);
  const folder = await page.request.get(
    `/fixture/files?target=${target}&set=folder&native=1`,
  );
  expect(folder.status()).toBe(200);
  return {
    view: page.locator(
      `[data-testid="view-offer"][data-view-id="${(await view.json()).view_id}"]`,
    ),
    file: page.locator(
      `[data-testid="file-offer"][data-offer-id="${(await single.json()).offer_ids[0]}"]`,
    ),
    folder: page.locator(
      `[data-testid="file-offer"][data-offer-id="${(await folder.json()).offer_ids[0]}"]`,
    ),
  };
}

/** The corner control is always shown in the card's top-right corner and
 * the title keeps clear of it. */
async function expectCorner(card: Locator) {
  const reply = card.getByTestId("offer-reply");
  await expect(reply).toBeVisible();
  await expect(reply).toHaveAttribute("aria-pressed", "false");
  const c = await card.boundingBox();
  const r = await reply.boundingBox();
  const t = await card.getByTestId("offer-title").boundingBox();
  if (!c || !r || !t) throw new Error("no layout");
  expect(c.x + c.width - (r.x + r.width)).toBeLessThan(12);
  expect(r.y - c.y).toBeLessThan(12);
  expect(t.x + t.width).toBeLessThanOrEqual(r.x + 1);
}

const quote = (page: Page) =>
  page.locator('.ah-cbox [data-testid="composer-quote"]');

for (const width of [1440, 390]) {
  test(`a reply to a view card, a file card and one file of several reaches Pi with the offer's facts ${width}`, async ({
    page,
  }) => {
    test.setTimeout(120000);
    const card = await offers(page, width);
    await expect(card.view).toBeVisible({ timeout: 20000 });
    await expect(card.file).toHaveAttribute("data-state", "ready");
    await expect(card.folder).toHaveAttribute("data-state", "ready");
    // The cards come from native history, so each has its control.
    await expect(card.folder.getByTestId("offer-reply")).toBeVisible({
      timeout: 20000,
    });
    for (const c of [card.view, card.file, card.folder]) await expectCorner(c);

    // The view: the field's quote is the title only; ✕ keeps the draft.
    await page.getByTestId("message-input").fill("luonnos");
    await card.view.getByTestId("offer-reply").click();
    await expect(card.view.getByTestId("offer-reply")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(quote(page)).toHaveAttribute("data-offer", "view");
    await expect(quote(page)).toContainText("Vastaat näkymään");
    await expect(quote(page).getByTestId("quote-jump")).toHaveText(
      "Synteettinen näkymä",
    );
    await expect(page.getByTestId("message-input")).toBeFocused();
    // Two lines at most; the clamp ends a cut title in "…".
    await expect(quote(page).locator(".ah-reply-body")).toHaveCSS(
      "-webkit-line-clamp",
      "2",
    );
    expect(
      (
        await new AxeBuilder({ page })
          .include('[data-testid="composer-quote"]')
          .analyze()
      ).violations,
    ).toEqual([]);
    await quote(page).getByTestId("quote-remove").click();
    await expect(quote(page)).toHaveCount(0);
    await expect(page.getByTestId("message-input")).toHaveValue("luonnos");
    await card.view.getByTestId("offer-reply").click();
    await send(page, "Vastaan näkymään");
    await expect(quote(page)).toHaveCount(0);
    await expect(
      answer(
        page,
        /View you offered: "Synteettinen näkymä" \(view_id v[a-z2-7]{26}\)\\nSource: site · opens index\.html · \d+ files · [\d.]+ (?:bytes|KB)\\n.*Vastaan näkymään/,
      ),
    ).toBeVisible({ timeout: 20000 });
    const viewReply = mine(page, "Vastaan näkymään");
    await expect(viewReply.getByTestId("user-content")).toHaveText(
      "Vastaan näkymään",
    );
    await expect(viewReply.getByTestId("sent-quote")).toHaveAttribute(
      "data-offer",
      "view",
    );
    await expect(viewReply.getByTestId("sent-quote")).toHaveText(
      /Agentin näkymä\s*Synteettinen näkymä/,
    );

    // One file.
    await card.file.getByTestId("offer-reply").click();
    await expect(quote(page)).toContainText("Vastaat tiedostoon");
    await expect(quote(page).getByTestId("quote-jump")).toHaveText(
      "kaavio.png",
    );
    await send(page, "Kaavio on väärin päin");
    await expect(
      answer(
        page,
        /File you offered: "kaavio\.png" \(offer_id f[a-z2-7]{26}\)\\nSource: kaavio\.png · image · [\d.]+ (?:bytes|KB)\\n.*Kaavio on väärin päin/,
      ),
    ).toBeVisible({ timeout: 20000 });
    await expect(
      mine(page, "Kaavio on väärin päin").getByTestId("sent-quote"),
    ).toHaveText(/Agentin tiedosto\s*kaavio\.png/);

    // One file of several, from its row in the file list beside (on a
    // phone over) the conversation.
    await card.folder.getByTestId("offer-open").click();
    const panel = page.getByTestId("offer-panel");
    await expect(panel).toBeVisible();
    const row = panel
      .locator(".ah-offer-folder-row")
      .filter({ has: page.locator('[data-path="etappi-2/c.png"]') });
    await row.hover();
    const rowReply = row.getByTestId("offer-row-reply");
    await expect(rowReply).toBeVisible();
    await expect(panel.getByTestId("offer-row-reply")).toHaveCount(5);
    await rowReply.click();
    if (width < 800) {
      // The panel covered the conversation; the reply goes back to the field.
      await expect(panel).toHaveCount(0);
    } else {
      await expect(rowReply).toHaveAttribute("aria-pressed", "true");
      // The whole offer's control is not the one pressed.
      await expect(card.folder.getByTestId("offer-reply")).toHaveAttribute(
        "aria-pressed",
        "false",
      );
    }
    await expect(page.getByTestId("message-input")).toBeFocused();
    await expect(quote(page)).toContainText("Vastaat tiedostoon");
    await expect(quote(page).getByTestId("quote-jump")).toHaveText(
      "etappi-2/c.png",
    );
    await send(page, "Tämä kuva on sumea");
    await expect(
      answer(
        page,
        /File "etappi-2\/c\.png" in the files you offered as "Kumppanipaketti" \(offer_id f[a-z2-7]{26}\)\\nSource: paketti\/etappi-2\/c\.png · image · [\d.]+ (?:bytes|KB)\\n.*Tämä kuva on sumea/,
      ),
    ).toBeVisible({ timeout: 20000 });
    const fileReply = mine(page, "Tämä kuva on sumea").getByTestId(
      "sent-quote",
    );
    await expect(fileReply).toHaveText(/Agentin tiedosto\s*etappi-2\/c\.png/);

    // The sent quote leads back to the card it answered.
    await fileReply.click();
    const located = page.locator(".ah-search-target");
    await expect(located).toHaveCount(1);
    await expect(located).toContainText("Kumppanipaketti");
    await expect(located).toBeInViewport();
  });
}

test("with the switch off the cards have no reply control", async ({
  page,
}) => {
  test.setTimeout(90000);
  const card = await offers(page, 1440);
  await expect(card.view.getByTestId("offer-reply")).toBeVisible({
    timeout: 20000,
  });
  await prefer(page, false);
  await page.reload();
  await expect(card.view).toBeVisible({ timeout: 20000 });
  await expect(card.file).toHaveAttribute("data-state", "ready");
  await expect(page.getByTestId("offer-reply")).toHaveCount(0);
  await expect(card.view).not.toHaveAttribute("data-reply", /.*/);
});
