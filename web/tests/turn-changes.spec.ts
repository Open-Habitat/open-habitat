import AxeBuilder from "@axe-core/playwright";
import { hostOrigin } from "../test-ports.mjs";
import { expect, type Page, test } from "./worker-host";

// Muutokset (turn-changes, experimental) against the synthetic host: the
// daemon serves a seeded native session (test/browser-host's turn-changes
// history) and its block reads, and the browser computes the turn's changes
// from the tool calls. Same-UID synthetic evidence: it proves the history
// and block-read path and the card's behaviour, not Linux user isolation.
const agent = "pi:11111111-1111-4111-8111-111111111111";
test.use({
  baseURL: hostOrigin,
  ignoreHTTPSErrors: true,
  viewport: { width: 1440, height: 900 },
  reducedMotion: "reduce",
  // Jari reviews the screenshots; 1x evidence was blurry.
  deviceScaleFactor: 2,
});

const evidence = "../issues/turn-changes-summary/evidence";
const capture = !!process.env.OH_VISUAL_CAPTURE;

async function open(
  page: Page,
  preferences: Record<string, unknown>,
  signedIn = false,
): Promise<void> {
  expect(
    (await page.request.get("/fixture/history?mode=turn-changes")).status(),
  ).toBe(204);
  await page.goto("/workspaces");
  if (!signedIn) {
    await page
      .getByRole("button")
      .and(page.getByTestId("github-sign-in"))
      .click();
    await page
      .getByRole("link")
      .and(page.locator('a[href*="code=42"]'))
      .click();
  }
  const session = await (await page.request.get("/auth/session")).json();
  for (const data of Object.entries(preferences).map(([k, v]) => ({
    [k]: v,
  })))
    expect(
      (
        await page.request.put("/api/v1/account/preferences", {
          headers: {
            Origin: new URL(page.url()).origin,
            "X-Agent-Host-CSRF": session.csrf,
          },
          data,
        })
      ).ok(),
    ).toBe(true);
  await page.goto(`/agents/${agent}`);
  // Both turns' final replies are on screen.
  await expect(
    page.locator('[data-testid="stage-reply"][data-reply-role="final"]'),
  ).toHaveCount(2);
}

const turns = (page: Page) =>
  page.locator('.ah-feed > li[data-kind="assistant"]');
const card = (page: Page) =>
  page.getByRole("region").and(page.getByTestId("turn-changes"));

async function shot(page: Page, name: string) {
  if (!capture) return;
  await page.screenshot({ path: `${evidence}/${name}.png` });
}

test("@turn-changes off by default: no turn shows a Muutokset line", async ({
  page,
}) => {
  await open(page, {});
  await expect(turns(page)).toHaveCount(2);
  await expect(page.getByTestId("turn-changes")).toHaveCount(0);
});

test("@turn-changes a finished turn's changes open in place, file by file and on the timeline", async ({
  page,
}) => {
  await open(page, { experimental: { "turn-changes": true } });
  // Only the second turn changed files; the first only listed them.
  await expect(card(page)).toHaveCount(1);
  const turn = turns(page).nth(1);
  const changes = turn.getByTestId("turn-changes");
  await expect(changes).toBeVisible();
  // The line follows the turn's final reply.
  const reply = turn.locator(
    '[data-testid="stage-reply"][data-reply-role="final"]',
  );
  expect(
    await changes.evaluate(
      (el, r) =>
        !!r &&
        !!(r.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING),
      await reply.elementHandle(),
    ),
  ).toBe(true);
  const toggle = changes
    .getByRole("button")
    .and(page.getByTestId("turn-changes-toggle"));
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  // +4 −2 in haku.ts (two edits, one by its absolute path), +6 in the
  // written korkeus.ts; the git rm has no counts and the failed edit none.
  await expect(changes.locator(".ah-tc-meta .ah-tc-add")).toHaveText("+10");
  await expect(changes.locator(".ah-tc-meta .ah-tc-del")).toHaveText("−2");
  await expect(changes.getByTestId("turn-changes-file")).toHaveCount(0);

  // In place: the list opens inside the turn, under the reply.
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  const rows = changes.getByTestId("turn-changes-file");
  await expect(rows).toHaveCount(3);
  expect(
    await changes
      .locator(".ah-tc-list > li")
      .evaluateAll((items) => items.map((li) => li.getAttribute("data-path"))),
  ).toEqual(["src/haku.ts", "src/korkeus.ts", "src/vanha.ts"]);
  // In place: the list is below the reply, not elsewhere on the page.
  const [listBox, replyBox] = await Promise.all([
    changes.locator(".ah-tc-list").boundingBox(),
    reply.boundingBox(),
  ]);
  expect(listBox?.y ?? 0).toBeGreaterThan(
    (replyBox?.y ?? 0) + (replyBox?.height ?? 0),
  );
  expect(
    (await new AxeBuilder({ page }).include(".ah-turn-changes").analyze())
      .violations,
  ).toEqual([]);

  // A file opens its whole change; the editor opens at its first changed line.
  await rows.nth(0).click();
  const diff = changes.getByTestId("turn-changes-diff");
  await expect(diff).toHaveCount(1);
  await expect(diff.locator(".ah-diff-add")).toHaveCount(4);
  await expect(diff.locator(".ah-diff-remove")).toHaveCount(2);
  await diff
    .getByRole("button")
    .and(page.getByTestId("turn-changes-open-editor"))
    .click();
  await expect(
    page.getByTestId("browser-editor").locator(".ah-browser-filename"),
  ).toHaveText("src/haku.ts");
});

test("@turn-changes the timeline replaces the list and a mark opens that change", async ({
  page,
}) => {
  await open(page, { experimental: { "turn-changes": true } });
  const changes = turns(page).nth(1).getByTestId("turn-changes");
  const timeline = changes
    .getByRole("button")
    .and(page.getByTestId("turn-changes-timeline-toggle"));
  // From the collapsed line straight to the timeline.
  await timeline.click();
  await expect(timeline).toHaveAttribute("aria-pressed", "true");
  await expect(changes.getByTestId("turn-changes-file")).toHaveCount(0);
  await expect(changes.getByTestId("turn-changes-timeline-row")).toHaveCount(3);
  const marks = changes.getByTestId("turn-changes-mark");
  expect(
    await marks.evaluateAll((all) =>
      all.map((m) => m.getAttribute("data-tool")),
    ),
  ).toEqual(["edit", "edit", "write", "bash"]);
  expect(
    (await new AxeBuilder({ page }).include(".ah-turn-changes").analyze())
      .violations,
  ).toEqual([]);
  // The second edit of haku.ts, as its own tool card showed it.
  await marks.nth(1).click();
  const detail = changes.getByTestId("turn-changes-detail");
  await expect(detail).toBeVisible();
  await expect(detail.locator(".ah-diff-add")).toHaveCount(3);
  await expect(detail.locator(".ah-diff-remove")).toHaveCount(1);
  await timeline.click();
  await expect(changes.getByTestId("turn-changes-file")).toHaveCount(3);
});

test("@turn-changes on a phone the card fits the width and the timeline keeps its icon", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page, { experimental: { "turn-changes": true } });
  const changes = turns(page).nth(1).getByTestId("turn-changes");
  await changes.scrollIntoViewIfNeeded();
  const timeline = changes.getByTestId("turn-changes-timeline-toggle");
  await expect(timeline).toBeVisible();
  const box = await changes.boundingBox();
  expect(box?.width ?? 0).toBeLessThanOrEqual(390);
  await changes.getByTestId("turn-changes-toggle").click();
  await changes.getByTestId("turn-changes-file").nth(0).click();
  await expect(changes.getByTestId("turn-changes-diff")).toBeVisible();
  // The phone opens files in its own editor, as file links do.
  const editor = await changes
    .getByTestId("turn-changes-open-editor")
    .boundingBox();
  expect((editor?.x ?? 0) + (editor?.width ?? 0)).toBeLessThanOrEqual(390);
  await timeline.click();
  await expect(changes.getByTestId("turn-changes-timeline-row")).toHaveCount(3);
});

// Review screenshots for Jari: light and dark, Finnish and English, desktop
// and phone. Runs only with OH_VISUAL_CAPTURE.
test("@turn-changes evidence screenshots", async ({ page }) => {
  test.skip(!capture, "screenshots only with OH_VISUAL_CAPTURE");
  test.setTimeout(180000);
  let signedIn = false;
  for (const language of ["fi", "en"] as const)
    for (const scheme of ["light", "dark"] as const)
      for (const [width, height, device] of [
        [1440, 900, "desktop"],
        [390, 844, "phone"],
      ] as const) {
        await page.setViewportSize({ width, height });
        await page.emulateMedia({
          colorScheme: scheme,
          reducedMotion: "reduce",
        });
        await open(
          page,
          { experimental: { "turn-changes": true }, language },
          signedIn,
        );
        signedIn = true;
        const changes = turns(page).nth(1).getByTestId("turn-changes");
        await changes.scrollIntoViewIfNeeded();
        const name = `${device}-${scheme}-${language}`;
        await shot(page, `${name}-1-collapsed`);
        await changes.getByTestId("turn-changes-toggle").click();
        await changes.getByTestId("turn-changes-file").nth(0).click();
        await changes.getByTestId("turn-changes-diff").scrollIntoViewIfNeeded();
        await shot(page, `${name}-2-file`);
        await changes.getByTestId("turn-changes-timeline-toggle").click();
        await changes.getByTestId("turn-changes-mark").nth(1).click();
        await changes
          .getByTestId("turn-changes-detail")
          .scrollIntoViewIfNeeded();
        await shot(page, `${name}-3-timeline`);
      }
});
