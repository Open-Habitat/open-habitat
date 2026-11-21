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
  mode = "turn-changes",
): Promise<void> {
  expect(
    (await page.request.get(`/fixture/history?mode=${mode}`)).status(),
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
  if (mode !== "turn-changes") return;
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

// A turn's diff is a reply's code block (Jari 17.11.2026): the same box and
// control rail, so a line wider than the conversation wraps on request
// instead of being cut off; and a turn that changed one file opens straight
// to that file's diff. The host serves a session whose only turn edits one
// file with a very long line.
const oneEvidence = process.env.OH_VISUAL_CAPTURE_DIR;

async function openOne(page: Page) {
  expect(
    (await page.request.get("/fixture/history?mode=turn-changes-one")).status(),
  ).toBe(204);
  await page.goto("/workspaces");
  await page
    .getByRole("button")
    .and(page.getByTestId("github-sign-in"))
    .click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  const session = await (await page.request.get("/auth/session")).json();
  expect(
    (
      await page.request.put("/api/v1/account/preferences", {
        headers: {
          Origin: new URL(page.url()).origin,
          "X-Agent-Host-CSRF": session.csrf,
        },
        data: { experimental: { "turn-changes": true } },
      })
    ).ok(),
  ).toBe(true);
  await page.goto(`/agents/${agent}`);
  const changes = card(page);
  await expect(changes).toHaveCount(1);
  return changes;
}

for (const [width, height, device] of [
  [1440, 900, "desktop"],
  [390, 844, "phone"],
] as const)
  test(`@turn-changes on a ${device} one changed file opens to its diff, which wraps on request`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    const changes = await openOne(page);
    await changes.scrollIntoViewIfNeeded();
    await changes.getByTestId("turn-changes-toggle").click();
    // The only file is open at once; its row still folds it away.
    const row = changes.getByTestId("turn-changes-file");
    await expect(row).toHaveAttribute("aria-expanded", "true");
    const diff = changes.getByTestId("turn-changes-diff");
    await expect(diff.locator(".ah-diff-add")).toHaveCount(1);
    await expect(diff.locator(".ah-diff-remove")).toHaveCount(1);

    // The copy control is on the code block's rail, inside the card.
    const block = diff.locator(".ah-bash-window");
    const copy = block.getByTestId("output-copy");
    await expect(copy).toBeVisible();
    const [blockBox, copyBox, cardBox] = await Promise.all([
      block.boundingBox(),
      copy.boundingBox(),
      changes.boundingBox(),
    ]);
    expect(copyBox && blockBox && cardBox).toBeTruthy();
    if (!copyBox || !blockBox || !cardBox) return;
    expect(copyBox.x + copyBox.width).toBeLessThanOrEqual(
      blockBox.x + blockBox.width + 0.5,
    );
    expect(blockBox.x + blockBox.width).toBeLessThanOrEqual(
      cardBox.x + cardBox.width + 0.5,
    );

    // The long line overflows, so the wrap toggle is offered; wrapped, the
    // whole line is in view and the rows keep their diff colouring.
    const viewport = block.locator(".ah-output-viewport");
    const fits = () =>
      viewport.evaluate((pre) => pre.scrollWidth <= pre.clientWidth + 1);
    expect(await fits()).toBe(false);
    if (oneEvidence)
      await page.screenshot({ path: `${oneEvidence}/${device}-nowrap.png` });
    const wrap = block.getByTestId("output-wrap");
    await expect(wrap).toHaveAttribute("aria-pressed", "false");
    await wrap.click();
    // The toggle stays on the rail so wrap can be undone.
    await expect(wrap).toBeVisible();
    await expect(wrap).toHaveAttribute("aria-pressed", "true");
    await expect.poll(fits).toBe(true);
    const added = viewport.locator(".ah-diff-add");
    const line = await added.evaluate((el) => ({
      height: el.getBoundingClientRect().height,
      lineHeight: parseFloat(getComputedStyle(el).lineHeight),
      background: getComputedStyle(el).backgroundColor,
    }));
    expect(line.height).toBeGreaterThan(line.lineHeight * 1.5);
    expect(line.background).not.toBe("rgba(0, 0, 0, 0)");
    if (oneEvidence) {
      await page.screenshot({ path: `${oneEvidence}/${device}-wrap.png` });
      await page.emulateMedia({ colorScheme: "dark" });
      await page.screenshot({ path: `${oneEvidence}/${device}-wrap-dark.png` });
      await page.emulateMedia({ colorScheme: "light" });
    }
    expect(
      (await new AxeBuilder({ page }).include(".ah-turn-changes").analyze())
        .violations,
    ).toEqual([]);

    await row.click();
    await expect(diff).toHaveCount(0);
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

// Jari 17.11.2026: the card showed only under the newest reply. Every turn
// that changed files shows its card, on the first page, on the older pages
// read on scroll-up and after a warm return; a turn that changed nothing
// shows none. The fixture's turn n writes src/t<n>.ts with n+1 lines when n
// is even and only lists files when n is odd.
test("@turn-changes every editing turn shows its card, older pages and a warm return too", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await open(
    page,
    { experimental: { "turn-changes": true } },
    false,
    "turn-changes-many",
  );
  const total = 140;
  const reply = (n: number) =>
    turns(page).filter({
      has: page
        .locator('[data-testid="stage-reply"][data-reply-role="final"]')
        .getByText(`Vastaus ${n}.`, { exact: true }),
    });
  await expect(reply(total - 1)).toHaveCount(1);
  const stream = page.locator(".ah-conversation-stream");
  // Scroll up as a reader, reading the older pages, until the first turn.
  const older = page.getByRole("button").and(page.getByTestId("older-history"));
  await stream.hover();
  await expect(async () => {
    await page.mouse.wheel(0, -4000);
    if (await older.isVisible()) await older.click();
    await expect(reply(0)).toHaveCount(1, { timeout: 500 });
  }).toPass({ timeout: 60_000 });
  const check = async (n: number) => {
    const turn = reply(n);
    await turn.scrollIntoViewIfNeeded();
    if (n % 2) {
      // The reads of a turn that changed nothing end with no card.
      await expect(turn.getByTestId("turn-changes")).toHaveCount(0);
      return;
    }
    await expect(turn.getByTestId("turn-changes")).toBeVisible();
    await expect(turn.locator(".ah-tc-meta .ah-tc-add")).toHaveText(
      `+${n + 1}`,
    );
  };
  for (let n = 0; n < total; n++) await check(n);
  // A warm return: away to the workspace in the app and back.
  await page
    .locator(".ah-agent-header")
    .getByRole("link", { name: "ordinary-dir" })
    .click();
  await expect(page).not.toHaveURL(/\/agents\//);
  await page.goBack();
  await expect(page).toHaveURL(/\/agents\//);
  await expect(reply(total - 1)).toHaveCount(1);
  for (const n of [total - 1, total - 2, total - 4, total - 10, total - 30])
    await check(n);
});

// The same in a conversation that goes on live: turns that were not on
// screen when it was opened are read after later turns have changed the
// native file, and every turn's card stays after the next turns.
test("@turn-changes every live turn that changed files keeps its card", async ({
  page,
}) => {
  test.setTimeout(120_000);
  expect((await page.request.get("/fixture/reset-clock")).status()).toBe(204);
  expect(
    (await page.request.get("/fixture/conversations-reset")).status(),
  ).toBe(204);
  await page.request.get("/fixture/scenario?value=ready");
  await page.goto("/workspaces");
  await page
    .getByRole("button")
    .and(page.getByTestId("github-sign-in"))
    .click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  const session = await (await page.request.get("/auth/session")).json();
  expect(
    (
      await page.request.put("/api/v1/account/preferences", {
        headers: {
          Origin: new URL(page.url()).origin,
          "X-Agent-Host-CSRF": session.csrf,
        },
        data: { experimental: { "turn-changes": true } },
      })
    ).ok(),
  ).toBe(true);
  await page.reload();
  await page
    .getByRole("navigation")
    .getByTestId("workspace-ordinary-dir")
    .click();
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  await expect(page).toHaveURL(/conversation=pi(?:%3A|:)/);
  // Long replies ("pitkä") keep the earlier turns off screen.
  const prompts = [
    "kirjoita tiedosto alku pitkä",
    "kerro mitä teit pitkä",
    "kirjoita tiedosto keski pitkä",
    "kirjoita tiedosto loppu",
    "kirjoita tiedosto vielä",
  ];
  const turn = (prompt: string) =>
    turns(page).filter({
      has: page
        .locator('[data-testid="stage-reply"][data-reply-role="final"]')
        .getByText(`Kysyit: "${prompt}"`),
    });
  const check = async (prompt: string) => {
    const name = /kirjoita tiedosto (\S+)/.exec(prompt)?.[1];
    await turn(prompt).scrollIntoViewIfNeeded();
    const changes = turn(prompt).getByTestId("turn-changes");
    if (!name) {
      await expect(changes).toHaveCount(0);
      return;
    }
    await expect(changes).toBeVisible();
    await expect(changes.locator(".ah-tc-meta")).toContainText(`${name}.ts`);
  };
  const send = async (prompt: string) => {
    const input = page.getByTestId("message-input");
    await expect(input).toBeEnabled();
    await input.fill(prompt);
    await page
      .getByTestId("send")
      .and(page.locator('[data-mode="send"]'))
      .click();
    await expect(turn(prompt)).toHaveCount(1, { timeout: 30_000 });
    await expect(
      page.getByTestId("send").and(page.locator('[data-mode="send"]')),
    ).toBeVisible();
  };
  for (const [i, prompt] of prompts.slice(0, 3).entries()) {
    await send(prompt);
    for (const earlier of prompts.slice(0, i + 1)) await check(earlier);
  }
  // Opened again cold, at the newest turn: the earlier ones are read only
  // when scrolled to, after newer turns have been saved.
  await page.reload();
  await expect(turn(prompts[2])).toHaveCount(1);
  await send(prompts[3]);
  await send(prompts[4]);
  for (const prompt of prompts.toReversed()) await check(prompt);
});
