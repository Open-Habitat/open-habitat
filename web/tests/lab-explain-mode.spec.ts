import { resolve } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { snapshot } from "../lab/session.mjs";
import { labOrigin } from "../test-ports.mjs";
import { expect, test } from "./lab-host";

// Selitystila (explain-mode): the screen dims and the part
// under the pointer explains itself, through the real gateway and daemon
// with the synthetic Pi. Cards are found by their part's id, never by
// wording.
test.use({
  baseURL: labOrigin,
  deviceScaleFactor: 2,
  ignoreHTTPSErrors: true,
  reducedMotion: "reduce",
});

async function signIn(page: Page) {
  expect(
    (await page.request.get("/fixture/conversations-reset")).status(),
  ).toBe(204);
  await page.goto("/workspaces");
  await page.getByTestId("github-sign-in").click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  const session = await (await page.request.get("/auth/session")).json();
  expect(
    (
      await page.request.put("/api/v1/account/preferences", {
        headers: {
          Origin: new URL(page.url()).origin,
          "X-Agent-Host-CSRF": session.csrf,
        },
        data: { experimental: { "explain-mode": false } },
      })
    ).ok(),
  ).toBe(true);
  await page.reload();
}

async function newConversation(page: Page) {
  const snapshot = await (await page.request.get("/api/v1/snapshot")).json();
  const ws = snapshot.workspaces.find(
    (w: { name: string }) => w.name === "aurinkokello",
  ).workspace_id;
  await page.goto(`/workspaces/${ws}`);
  await page.getByTestId("conversation-start").first().click();
  await expect(page.getByTestId("start-here")).toBeVisible();
}

async function answered(page: Page) {
  await newConversation(page);
  await page
    .getByTestId("message-input")
    .fill("näytä kortit taustaprosessi virhekortti tiedosto kaavio");
  await page
    .getByTestId("send")
    .and(page.locator('[data-mode="send"]'))
    .click();
  await expect(page.getByTestId("history-stage-toggle").last()).toBeVisible({
    timeout: 20000,
  });
}

test("@lab explain mode suppresses hover and focus help and restores it on exit", async ({
  page,
}) => {
  await signIn(page);
  await newConversation(page);
  await page.clock.install();
  const editor = page.getByTestId("toggle-editor");
  const tips = page.getByRole("tooltip");
  await editor.hover();
  await expect(tips).toBeVisible();
  // Keyboard activation leaves the pointer on an already open tooltip.
  await page.getByTestId("explain-toggle").focus();
  await page.keyboard.press("Enter");
  await expect(bar(page)).toBeVisible();
  await expect(tips).toHaveCount(0);
  await editor.hover();
  await editor.focus();
  await page.clock.fastForward(1000);
  await expect(editor).toHaveAccessibleName(/.+/);
  await expect(
    page.locator('[role="tooltip"]:visible, .ah-header-tip:visible'),
  ).toHaveCount(0);
  await expect(page.locator('[title]:not([title=""])')).toHaveCount(0);
  // The rail uses the same tooltip mechanism, with right-opening placement.
  const railButton = page.getByTestId("workspace-create");
  await railButton.hover();
  await railButton.focus();
  await page.clock.fastForward(1000);
  await expect(tips).toHaveCount(0);
  if (process.env.OH_VISUAL_CAPTURE === "1")
    await snapshot(
      page,
      resolve("../issues/explain-hover-labels/explain-hover"),
      { labOrigin: new URL(page.url()).origin },
    );
  await page.getByTestId("explain-stop").click();
  await expect(bar(page)).toHaveCount(0);
  await editor.hover();
  await expect(tips).toBeVisible();
  await expect(page.locator('[title]:not([title=""])').first()).toBeAttached();
});

const card = (page: Page) => page.getByTestId("explain-card");
const bar = (page: Page) => page.getByTestId("explain-bar");

for (const width of [1440, 390]) {
  for (const locale of ["fi-FI", "en-US"]) {
    test.describe(`workspace header ${width} ${locale}`, () => {
      test.use({
        viewport: { width, height: 900 },
        hasTouch: width === 390,
        isMobile: width === 390,
        locale,
      });
      test("@lab workspace name and folder have distinct explain cards", async ({
        page,
      }) => {
        await signIn(page);
        const state = await (await page.request.get("/api/v1/snapshot")).json();
        const ws = state.workspaces.find(
          (w: { name: string }) => w.name === "aurinkokello",
        ).workspace_id;
        await page.goto(`/workspaces/${ws}`);
        await page.getByTestId("workspace-path").waitFor();
        if (width === 390) {
          await page.getByTestId("navigation-open").tap();
          await page.getByTestId("account-menu-trigger").tap();
          await page.getByTestId("menu-explain").tap();
          await page.locator('[data-testid="close-navigation"]:visible').tap();
          await page.locator('[data-testid="close-navigation"]:visible').tap();
          await expect(
            page.locator('[data-testid="close-navigation"]:visible'),
          ).toHaveCount(0);
          await expect(card(page)).toHaveCount(0);
        } else {
          await page.getByTestId("account-menu-trigger").click();
          await page.getByTestId("menu-explain").click();
        }
        for (const [target, id] of [
          ["workspace-title", "T01"],
          ["workspace-path", "T46"],
          ["copy-path", "T02"],
          ["open-github", "T03"],
          ["rename-workspace", "T04"],
          ["workspace-archive", "T05"],
          ["delete-workspace", "T06"],
          ["new-worktree", "T07"],
          ["conversation-start", "T08"],
        ]) {
          if (width === 390) {
            const el = page.getByTestId(target).first();
            const box = await el.boundingBox();
            if (!box) throw new Error(`${target} has no box`);
            await page.touchscreen.tap(
              box.x + Math.min(24, box.width / 2),
              box.y + box.height / 2,
            );
          } else await pointAt(page, target);
          await expect(card(page)).toHaveAttribute("data-card", id);
          if (
            process.env.OH_VISUAL_CAPTURE === "1" &&
            (id === "T01" || id === "T46")
          )
            await snapshot(
              page,
              resolve(
                `../issues/explain-dir-shows-name-card/${locale}-${width}-${id}`,
              ),
              {
                labOrigin: new URL(page.url()).origin,
              },
            );
          if (width === 390) await page.getByTestId("explain-close").tap();
        }
      });
    });
  }
}

for (const width of [1440, 390]) {
  for (const locale of ["fi-FI", "en-US"]) {
    test.describe(`not now ${width} ${locale}`, () => {
      test.use({
        viewport: { width, height: 900 },
        hasTouch: width === 390,
        isMobile: width === 390,
        locale,
      });
      test("@lab @rail-read-explain Not now explains ongoing work and does not dismiss in Explain mode", async ({
        page,
      }) => {
        await signIn(page);
        await newConversation(page);
        if (width === 390) await page.getByTestId("navigation-open").tap();
        await page.getByTestId("account-menu-trigger").click();
        await page.getByTestId("menu-explain").click();
        const action = page.getByTestId("rail-not-now-conversation").first();
        if (width === 390) {
          await page.getByTestId("explain-close").tap();
          await action.tap();
        } else {
          // Leave the initial state card via another explained control;
          // it can overlap this first rail row at desktop dimensions.
          await page.getByTestId("composer-model-picker").hover();
          await expect(card(page)).toHaveAttribute("data-card", "A05");
          await action.hover();
        }
        await expect(card(page)).toHaveAttribute("data-card", "S33");
        await expect(card(page)).toContainText(
          locale === "fi-FI"
            ? "Taustatyö jatkuu Käynnissä-listalla"
            : "Background work stays in Running",
        );
        if (process.env.OH_VISUAL_CAPTURE === "1")
          await snapshot(
            page,
            resolve(
              `../issues/rail-open-moves-turn-to-running/explain-${locale}-${width}`,
            ),
            { labOrigin: new URL(page.url()).origin },
          );
        await action.click();
        await expect(
          page.getByTestId("rail-yours").getByTestId("agent-link"),
        ).toHaveCount(1);
      });
    });
  }
}

async function pointAt(page: Page, testId: string) {
  const box = await page.getByTestId(testId).last().boundingBox();
  if (!box) throw new Error(`${testId} has no box`);
  await page.mouse.move(
    box.x + Math.min(24, box.width / 2),
    box.y + box.height / 2,
  );
}

test("@lab explain mode opens at the state card, explains what the pointer is on and lets presses work", async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page);
  await answered(page);

  // Selitä opens the mode at the state card; the bar names the state.
  await page.getByTestId("explain-toggle").click();
  await expect(bar(page)).toBeVisible();
  const state = page.getByTestId("explain-state-card");
  await expect(state).toHaveAttribute("data-situation", "yourTurn");
  await expect(page.getByTestId("explain-state")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  // A row of Voit nyt does what it names, and the mode stays.
  await expect(page.getByTestId("explain-can-K04")).toBeVisible();

  // Pointing at a part explains it and puts the state card away.
  await pointAt(page, "history-stage-toggle");
  await expect(card(page)).toHaveAttribute("data-card", "K04");
  await expect(state).toHaveCount(0);
  await expect(page.getByTestId("explain-state")).toHaveAttribute(
    "aria-pressed",
    "false",
  );

  // Over empty space the card stays, quieter.
  const stream = await page.locator(".ah-conversation-stream").boundingBox();
  if (!stream) throw new Error("no conversation");
  await page.mouse.move(stream.x + 8, stream.y + 40);
  await expect(card(page)).toHaveAttribute("data-card", "K04");
  await expect(card(page)).toHaveClass(/ah-explain-linger/);

  // A press does what it always does, and the mode stays on.
  const work = page.getByTestId("history-stage-toggle").last();
  await work.click();
  await expect(work).toHaveAttribute("aria-expanded", "true");
  await expect(bar(page)).toBeVisible();
  await pointAt(page, "tool-row");
  await expect(card(page)).toHaveAttribute("data-card", /^K(0[5-9]|10)$/);

  // A lasting press waits: archiving does nothing in the mode.
  const url = page.url();
  await page.getByTestId("archive-conversation").click();
  await expect(card(page)).toHaveAttribute("data-card", "Y11");
  await expect(page.locator(".ah-explain-toast")).toBeVisible();
  expect(page.url()).toBe(url);
  await expect(page.getByTestId("archive-conversation")).toBeVisible();

  // The bar's state brings the state card back.
  await page.getByTestId("explain-state").click();
  await expect(state).toBeVisible();
  await expect(card(page)).toHaveCount(0);

  // A row's hidden buttons show under the pointer as always and explain.
  const row = page.locator(".ah-rail [data-testid='agent-link']").first();
  const rowBox = await row.boundingBox();
  if (!rowBox) throw new Error("no rail row");
  await page.mouse.move(rowBox.x + 30, rowBox.y + rowBox.height / 2);
  await expect(card(page)).toHaveAttribute("data-card", "S09");
  const archive = page.getByTestId("rail-archive-conversation").first();
  await expect(archive).toBeVisible();
  const archiveBox = await archive.boundingBox();
  if (!archiveBox) throw new Error("no rail archive");
  await page.mouse.move(
    archiveBox.x + archiveBox.width / 2,
    archiveBox.y + archiveBox.height / 2,
  );
  await expect(card(page)).toHaveAttribute("data-card", "S13");

  // Esc ends the mode; Selitä again ends it too.
  await page.keyboard.press("Escape");
  await expect(bar(page)).toHaveCount(0);
  await expect(page.locator(".ah-explain-layer")).toHaveCount(0);
  await page.getByTestId("explain-toggle").click();
  await expect(bar(page)).toBeVisible();
  await page.getByTestId("explain-toggle").click();
  await expect(bar(page)).toHaveCount(0);
});

test("@lab explain mode starts from the account menu anywhere and from the start page's strip", async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page);
  await page.goto("/workspaces");
  await page.getByTestId("account-menu-trigger").click();
  await page.getByTestId("menu-explain").click();
  await expect(bar(page)).toBeVisible();
  // Outside a conversation there is no state to name.
  await expect(page.getByTestId("explain-state")).toHaveCount(0);
  await pointAt(page, "home-link");
  await expect(card(page)).toHaveAttribute("data-card", "S03");
  await page.getByTestId("explain-stop").click();
  await expect(bar(page)).toHaveCount(0);

  await newConversation(page);
  await page.getByTestId("explain-strip-go").click();
  await expect(page.getByTestId("explain-state-card")).toHaveAttribute(
    "data-situation",
    "notStarted",
  );
  await page.getByTestId("explain-strip-go").click();
  await expect(bar(page)).toHaveCount(0);
  // Closed, the strip stays closed in this browser.
  await page.getByTestId("explain-strip-close").click();
  await expect(page.getByTestId("explain-strip")).toHaveCount(0);
  await page.reload();
  await expect(page.getByTestId("start-here")).toBeVisible();
  await expect(page.getByTestId("explain-strip")).toHaveCount(0);
});

/** Moves the mouse in a straight line, sampling the card at every step:
 * it must stay the given card the whole way. */
async function travel(
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
  cardId: string,
) {
  const steps = 24;
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(
      from.x + ((to.x - from.x) * i) / steps,
      from.y + ((to.y - from.y) * i) / steps,
    );
    await page.evaluate(
      () => new Promise((done) => requestAnimationFrame(() => done(null))),
    );
    expect(
      await card(page).getAttribute("data-card"),
      `step ${i} of ${steps}`,
    ).toBe(cardId);
  }
}

const centre = async (page: Page, testId: string) => {
  const box = await page.getByTestId(testId).last().boundingBox();
  if (!box) throw new Error(`${testId} has no box`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
};

/** GitHub stands in for itself: the new tab is answered locally. */
async function fakeGitHub(page: Page) {
  await page
    .context()
    .route("https://github.com/**", (route) =>
      route.fulfill({ status: 200, contentType: "text/html", body: "ok" }),
    );
}

test("@lab @explain-feedback the card holds on the way to its footer and a written report opens a prefilled GitHub issue", async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await fakeGitHub(page);
  await signIn(page);
  await answered(page);
  await page.getByTestId("explain-toggle").click();
  await expect(bar(page)).toBeVisible();

  // The attach button's card sits above it, over the message field: the
  // straight path from the button to the card's footer crosses the field,
  // and the card holds all the way.
  const attach = await centre(page, "attach-file");
  await page.mouse.move(attach.x, attach.y);
  await expect(card(page)).toHaveAttribute("data-card", "V02");
  const report = page.getByTestId("explain-report");
  const reportBox = await report.boundingBox();
  const attachBox = await page.getByTestId("attach-file").last().boundingBox();
  if (!reportBox || !attachBox) throw new Error("no report or attach box");
  expect(reportBox.y + reportBox.height).toBeLessThan(attachBox.y);
  const target = {
    x: reportBox.x + reportBox.width / 2,
    y: reportBox.y + reportBox.height / 2,
  };
  await travel(page, attach, target, "V02");
  await expect(report).toBeVisible();

  // The context ring's card is below it; the same holds downwards.
  await page.mouse.move(8, 450);
  const ring = await centre(page, "context-ring");
  await page.mouse.move(ring.x, ring.y);
  await expect(card(page)).toHaveAttribute("data-card", "Y05");
  const ringReport = await report.boundingBox();
  if (!ringReport) throw new Error("no report box");
  await travel(
    page,
    ring,
    {
      x: ringReport.x + ringReport.width / 2,
      y: ringReport.y + ringReport.height / 2,
    },
    "Y05",
  );

  // Arriving from elsewhere the card lets the pointer through, as before:
  // a part beside the ring takes the card at once.
  await pointAt(page, "message-input");
  await expect(card(page)).toHaveAttribute("data-card", "V01");

  // Writing is required: an empty send asks for text and opens nothing.
  await page.mouse.move(ring.x, ring.y);
  await expect(card(page)).toHaveAttribute("data-card", "Y05");
  const ringReport2 = await report.boundingBox();
  if (!ringReport2) throw new Error("no report box");
  await travel(
    page,
    ring,
    {
      x: ringReport2.x + ringReport2.width / 2,
      y: ringReport2.y + ringReport2.height / 2,
    },
    "Y05",
  );
  let releaseVersion!: () => void;
  const versionReady = new Promise<void>((resolve) => {
    releaseVersion = resolve;
  });
  await page.route("**/api/v1/server", async (route) => {
    await versionReady;
    await route.fulfill({
      json: {
        schema_version: 1,
        name: "Synthetic lab",
        administrator: false,
        version: "0.0.0-feedback-fixture",
      },
    });
  });
  const writes: string[] = [];
  page.on("request", (request) => {
    if (
      request.url().includes("/api/") &&
      !["GET", "HEAD"].includes(request.method())
    )
      writes.push(request.url());
  });
  await report.click();
  const text = page.getByTestId("explain-feedback-text");
  await expect(text).toBeFocused();
  let opened = 0;
  page.context().on("page", () => {
    opened++;
  });
  await page.getByTestId("explain-feedback-send").click();
  await expect(page.getByTestId("explain-feedback-need")).toBeVisible();
  expect(opened).toBe(0);

  // Typed text survives a press elsewhere, and parts passed do not take
  // the card.
  await text.fill("Ei kerro, mitä tapahtuu kun konteksti täyttyy.");
  await pointAt(page, "message-input");
  await page.mouse.down();
  await page.mouse.up();
  await expect(page.getByTestId("explain-feedback-nudge")).toBeVisible();
  await expect(card(page)).toHaveAttribute("data-card", "Y05");
  await expect(text).toHaveValue(/konteksti/);

  // What is sent is shown before sending and holds nothing else.
  await page.getByTestId("explain-feedback-what").click();
  const preview = page.getByTestId("explain-feedback-preview");
  await expect(preview).toContainText("Y05");
  await expect(preview).toContainText("konteksti täyttyy");
  await expect(preview).not.toContainText("aurinkokello");
  // Metadata arriving after the preview opened updates the visible payload,
  // rather than silently adding a different version only when sending.
  releaseVersion();
  await expect(preview).toContainText("0.0.0-feedback-fixture");

  // Open in GitHub opens the prefilled issue form in a new tab.
  const [tab] = await Promise.all([
    page.context().waitForEvent("page"),
    page.getByTestId("explain-feedback-send").click(),
  ]);
  const url = new URL(tab.url());
  expect(url.origin + url.pathname).toBe(
    "https://github.com/Open-Habitat/open-habitat/issues/new",
  );
  expect([...url.searchParams.keys()].sort()).toEqual([
    "card",
    "fix",
    "language",
    "template",
    "title",
    "version",
  ]);
  expect(url.searchParams.get("fix")).toBe(
    "Ei kerro, mitä tapahtuu kun konteksti täyttyy.",
  );
  expect(url.searchParams.get("card")).toMatch(/^Y05 · /);
  expect(url.searchParams.get("language")).toBe("fi");
  expect(url.searchParams.get("version")).toBe("0.0.0-feedback-fixture");
  expect(writes).toEqual([]);
  expect(await tab.evaluate(() => window.opener)).toBeNull();
  // No referrer tells GitHub this server's address.
  expect(await tab.evaluate(() => document.referrer)).toBe("");
  await tab.close();
  await expect(page.getByTestId("explain-feedback-done")).toBeVisible();
  await expect(bar(page)).toBeVisible();
});

test("@lab @explain-feedback the keyboard reaches the report with F and Esc cancels before it stops", async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await fakeGitHub(page);
  await signIn(page);
  await answered(page);
  await page.getByTestId("explain-toggle").focus();
  await page.keyboard.press("Enter");
  await expect(bar(page)).toBeVisible();
  // A part focused from the keyboard explains itself.
  await page.getByTestId("context-ring").focus();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  await expect(card(page)).toHaveAttribute("data-card", "Y05");
  await page.keyboard.press("f");
  await page.keyboard.type("First correction");
  const text = page.getByTestId("explain-feedback-text");
  await expect(text).toBeFocused();
  await expect(text).toHaveValue("First correction");
  await expect(card(page)).toHaveAttribute("data-pinned", "true");
  await expect(card(page)).toHaveAttribute("aria-live", "polite");
  // The first Esc cancels the report and keeps the mode.
  await page.keyboard.press("Escape");
  await expect(text).toHaveCount(0);
  await expect(bar(page)).toBeVisible();
  await page.keyboard.press("KeyF");
  await page.keyboard.type("Puuttuu, miten konteksti tiivistetään.");
  await page.keyboard.press("Tab");
  await expect(page.getByTestId("explain-feedback-send")).toBeFocused();
  const [tab] = await Promise.all([
    page.context().waitForEvent("page"),
    page.keyboard.press("Enter"),
  ]);
  expect(new URL(tab.url()).searchParams.get("fix")).toBe(
    "Puuttuu, miten konteksti tiivistetään.",
  );
  await tab.close();
  await expect(page.getByTestId("explain-feedback-done")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await expect(bar(page)).toHaveCount(0);
});

for (const width of [1440, 390]) {
  for (const locale of ["fi-FI", "en-US"]) {
    test.describe(`feedback layout ${width} ${locale}`, () => {
      test.use({ locale });
      test("@lab @explain-feedback a long preview stays reachable in a short viewport", async ({
        page,
      }) => {
        await page.setViewportSize({ width, height: 700 });
        await signIn(page);
        await newConversation(page);
        await page.getByTestId("explain-toggle").click();
        await pointAt(page, "attach-file");
        await page.keyboard.press("KeyF");
        const text = page.getByTestId("explain-feedback-text");
        await expect(text).toBeFocused();
        await text.fill("A correction & details? ".repeat(26).slice(0, 600));
        await page.getByTestId("explain-feedback-what").click();
        await expect(
          page.getByTestId("explain-feedback-preview"),
        ).toBeVisible();
        // Opening the preview and then shrinking the viewport must not put
        // the cancel/send actions beyond any scrollable area.
        await page.setViewportSize({ width, height: 500 });
        await expect
          .poll(async () => {
            const box = await card(page).boundingBox();
            return !!box && box.y >= 0 && box.y + box.height <= 500;
          })
          .toBe(true);
        for (const theme of ["light", "dark", "contrast"]) {
          await page.evaluate(
            (value) =>
              document.documentElement.setAttribute("data-theme", value),
            theme,
          );
          const audit = await new AxeBuilder({ page })
            .include('[data-testid="explain-card"]')
            .analyze();
          expect(audit.violations).toEqual([]);
          if (process.env.OH_EXPLAIN_FEEDBACK_CAPTURE) {
            await snapshot(
              page,
              resolve(
                process.env.OH_EXPLAIN_FEEDBACK_CAPTURE,
                `${width}-${locale}-${theme}`,
              ),
              {
                labOrigin: new URL(page.url()).origin,
              },
            );
          }
        }
        await page.getByTestId("explain-feedback-cancel").click();
        await expect(text).toHaveCount(0);
        await expect(bar(page)).toBeVisible();
      });
    });
  }
}

test.describe("phone", () => {
  test.use({ hasTouch: true, isMobile: true });

  test("@lab on a phone the first tap explains, a second does it, and ⋯ opens the mode", async ({
    page,
  }) => {
    test.setTimeout(90000);
    await page.setViewportSize({ width: 390, height: 844 });
    await signIn(page);
    await answered(page);

    await page.getByTestId("conversation-menu").tap();
    await page.getByTestId("menu-explain").tap();
    await expect(page.getByTestId("explain-state-card")).toBeVisible();

    const work = page.getByTestId("history-stage-toggle").last();
    await work.scrollIntoViewIfNeeded();
    await work.tap();
    await expect(card(page)).toHaveAttribute("data-card", "K04");
    await expect(card(page)).toHaveAttribute("data-touch", "true");
    await expect(work).toHaveAttribute("aria-expanded", "false");
    await work.tap();
    await expect(work).toHaveAttribute("aria-expanded", "true");
    await expect(bar(page)).toBeVisible();

    const mine = page
      .locator('.ah-feed > li[data-kind="user"] [data-testid="message"]')
      .first();
    await mine.scrollIntoViewIfNeeded();
    await mine.tap();
    await expect(card(page)).toHaveAttribute("data-card", "K01");
    // The card's report works with taps, and the F hint is not shown.
    await page
      .context()
      .route("https://github.com/**", (route) =>
        route.fulfill({ status: 200, contentType: "text/html", body: "ok" }),
      );
    const report = page.getByTestId("explain-report");
    await expect(report.locator("kbd")).toHaveCount(0);
    await report.tap();
    await page.getByTestId("explain-feedback-send").tap();
    await expect(page.getByTestId("explain-feedback-need")).toBeVisible();
    await page.getByTestId("explain-feedback-text").fill("Puhelimella toisin.");
    const [tab] = await Promise.all([
      page.context().waitForEvent("page"),
      page.getByTestId("explain-feedback-send").tap(),
    ]);
    expect(new URL(tab.url()).searchParams.get("card")).toMatch(/^K01 · /);
    await tab.close();
    await expect(page.getByTestId("explain-feedback-done")).toBeVisible();
    await page.getByTestId("explain-close").tap();
    await expect(card(page)).toHaveCount(0);
    await page.getByTestId("explain-state").tap();
    await expect(page.getByTestId("explain-state-card")).toBeVisible();
    await page.getByTestId("explain-toggle").tap();
    await expect(bar(page)).toHaveCount(0);
  });
});
