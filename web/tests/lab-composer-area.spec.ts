import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { labOrigin } from "../test-ports.mjs";
import { expect, test } from "./lab-host";

test.use({ baseURL: labOrigin, ignoreHTTPSErrors: true });

// The composer area, direction Rivillä (round 2026-10-19-koko-alakerta): the
// keyboard flows the round checked in its prototype, here against the real
// controller, the daemon's bash relay and file list, and the fake Pi.

const mod = process.platform === "darwin" ? "Meta" : "Control";

async function newConversation(
  page: Page,
  viewport?: { width: number; height: number },
) {
  if (viewport) await page.setViewportSize(viewport);
  await page.request.get("/fixture/conversations-reset");
  await page.request.get("/fixture/scenario?value=ready");
  await page.goto("/workspaces");
  await page.getByTestId("github-sign-in").click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  if (viewport && viewport.width < 600)
    await page.getByTestId("navigation-open").click();
  await page
    .getByRole("navigation")
    .getByTestId("workspace-start-aurinkokello")
    .click();
  // These journeys exercise the native composer's sources and controls, not
  // the local draft field shown while creation/status is still in flight.
  await expect(page.getByTestId("command-palette")).toBeVisible();
  return page.getByTestId("message-input");
}

/** Keep Pi working until the test releases it, not until a wall-clock delay ends. */
async function startWork(page: Page) {
  expect(
    (await page.request.get("/fixture/scenario?value=pi-visual-hold")).status(),
  ).toBe(204);
  const field = page.getByTestId("message-input");
  await field.fill("työ");
  await field.press("Enter");
  await expect(
    page
      .getByTestId("composer-stop")
      .and(page.locator('[data-stop-target="agent"]')),
  ).toBeVisible({
    timeout: 20000,
  });
  await expect(field).toHaveAttribute("data-working", "true");
  await expect
    .poll(async () =>
      (await page.request.get("/fixture/pi-visual-ready")).status(),
    )
    .toBe(204);
}

test("@lab composer: typing across a turn end keeps focus, selection and text", async ({
  page,
}) => {
  const field = await newConversation(page);
  await startWork(page);
  // A slow/lost completion-status read must block sending, not local typing.
  // Let the native turn finish, but lose the idle status reply at that boundary.
  let lostCompletion = false;
  await page.route("**/status*", async (route) => {
    const response = await route.fetch();
    const status = await response.json();
    if (status.state === "idle") {
      lostCompletion = true;
      await route.fulfill({ status: 503, body: "" });
    } else await route.fulfill({ response });
  });
  await field.fill("Seuraava viesti: loppu");
  await field.press("Home");
  await page.keyboard.type("Alku. ");
  await expect(field).toBeFocused();
  // Finish only after the draft and selection are in place. Other journeys
  // keep the native turn held while they inspect or restore the queue.
  expect(
    (await page.request.get("/fixture/scenario?value=ready")).status(),
  ).toBe(204);
  // Use the keyboard, not locator.fill/press after completion: those would
  // silently refocus a field that the application had blurred or replaced.
  await expect.poll(() => lostCompletion, { timeout: 30000 }).toBe(true);
  await expect(
    page
      .getByTestId("conversation-problem")
      .or(page.getByTestId("conversation-stale"))
      .first(),
  ).toBeVisible();
  if (process.env.OH_FOCUS_CAPTURE) {
    const { snapshot } = await import("../lab/session.mjs");
    await snapshot(page, process.env.OH_FOCUS_CAPTURE, {
      labOrigin: new URL(page.url()).origin,
    });
  }
  await expect(field).toBeFocused();
  await page.keyboard.type("Jatko. ");
  await expect(field).toHaveValue("Alku. Jatko. Seuraava viesti: loppu");
  await expect(
    page.getByTestId("send").and(page.locator('[data-mode="steer"]')),
  ).toHaveAttribute("aria-disabled", "true");
  let writes = 0;
  page.on("request", (request) => {
    if (request.method() === "POST") writes++;
  });
  await page.keyboard.press("Enter");
  await expect(field).toHaveValue("Alku. Jatko. Seuraava viesti: loppu");
  // Recover through the production retry, without clicking or refocusing.
  await page.unroute("**/status*");
  await expect(field).toHaveAttribute("data-working", "false", {
    timeout: 15000,
  });
  await expect(field).toBeFocused();
  expect(writes).toBe(0);
  await page.keyboard.type("jatkuu ");
  await expect(field).toHaveValue("Alku. Jatko. jatkuu Seuraava viesti: loppu");
});

test("@lab composer: Enter steers, Alt+Enter queues, the chip swaps, and the queue comes back into the field", async ({
  page,
}) => {
  test.setTimeout(90000);
  const field = await newConversation(page);
  await startWork(page);
  // Enter steers while Pi works; Alt+Enter goes once the other way.
  await field.fill("Älä muuta testien odotusarvoja.");
  await field.press("Enter");
  const queue = page.getByTestId("composer-queue");
  await expect(queue.locator(".ah-cq-steer")).toHaveCount(1);
  await expect(queue).toContainText("Älä muuta testien odotusarvoja.");
  await expect(field).toHaveValue("");
  await field.fill("Aja lopuksi koko testisarja.");
  // Enter dispatches asynchronously. Do not submit the next message while
  // that command still disables sending, even if its queue event arrived.
  await expect(page.getByTestId("send")).not.toHaveAttribute(
    "aria-disabled",
    "true",
  );
  await field.press("Alt+Enter");
  await expect(queue.locator(".ah-cq-follow_up")).toHaveCount(1);
  await expect(queue).toContainText("Aja lopuksi koko testisarja.");
  // Alt+Enter did not change the chosen mode.
  await expect(
    page.getByTestId("composer-mode").and(page.locator('[data-mode="steer"]')),
  ).toBeVisible();
  // The card shows a message before its command's reply; the field's
  // controls come back once the reply has.
  await expect(page.getByTestId("attach-file")).toBeEnabled();
  // The chip is reached by keyboard and swaps the mode; the next Enter goes that way.
  await field.focus();
  // Sanele sits right of the work controls, beside Send.
  for (const testId of ["attach-file", "command-palette", "file-picker"]) {
    await page.keyboard.press("Tab");
    await expect(page.getByTestId(testId)).toBeFocused();
  }
  await page.keyboard.press("Tab");
  await expect(page.getByTestId("composer-mode")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(
    page
      .getByTestId("composer-mode")
      .and(page.locator('[data-mode="follow_up"]')),
  ).toBeVisible();
  await field.fill("Kirjoita yhteenveto.");
  await field.press("Enter");
  await expect(queue.getByRole("listitem")).toHaveCount(3);
  await expect(queue.getByRole("listitem").nth(2)).toHaveClass(
    /ah-cq-follow_up/,
  );
  // Palauta kenttään takes them back in Pi's order; nothing is left queued.
  await field.fill("");
  await queue.getByTestId("composer-restore-queue").click();
  await expect(field).toHaveValue(
    "Älä muuta testien odotusarvoja.\n\nAja lopuksi koko testisarja.\n\nKirjoita yhteenveto.",
  );
  await expect(queue).toHaveCount(0);
});

test("@lab composer: Esc in the field stops Pi and puts the queue back into the field", async ({
  page,
}) => {
  const field = await newConversation(page);
  await startWork(page);
  await field.fill("Tarkista myös README.");
  await field.press("Alt+Enter");
  await expect(page.getByTestId("composer-queue")).toContainText(
    "Tarkista myös README.",
  );
  // The card shows it before the command's reply; Stop waits for that.
  await expect(page.getByTestId("attach-file")).toBeEnabled();
  await field.focus();
  await field.press("Escape");
  await expect(field).toHaveValue("Tarkista myös README.");
  await expect(page.getByTestId("composer-queue")).toHaveCount(0);
  // The turn ends; a successful stop leaves no message behind.
  await expect(
    page.getByTestId("send").and(page.locator('[data-mode="send"]')),
  ).toBeVisible();
  await expect(page.getByTestId("composer-notice")).toHaveCount(0);
  await expect(page.getByTestId("send-receipt")).toHaveCount(0);
});

test("@lab composer: `/` and `@` complete at the caret from Pi's list and the workspace", async ({
  page,
}) => {
  test.setTimeout(90000);
  const field = await newConversation(page);
  await field.focus();
  await page.keyboard.type("/rev");
  const list = page.getByRole("listbox");
  await expect(list.getByTestId("composer-command-review")).toBeVisible({
    timeout: 15000,
  });
  await page.keyboard.press("Enter");
  await expect(field).toHaveValue("/review ");
  // Pi's terminal dialogs are not offered, even when searched by name.
  await page.keyboard.type("/llama");
  const llama = list.getByTestId("composer-command-llama");
  await expect(list).toBeVisible();
  await expect(llama).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(list).toHaveCount(0);
  await expect(field).toHaveValue("/review /llama");
  // A mid-line `/` is a mention: nothing is highlighted, so Enter would send.
  await field.fill("");
  await page.keyboard.type("katso /re");
  await expect(list).toBeVisible();
  await expect(field).not.toHaveAttribute("aria-activedescendant", /./);
  await page.keyboard.press("Escape");
  // `@` lists the workspace's own files and Tab inserts the top match.
  await field.fill("");
  await page.keyboard.type("lue @status");
  await expect(
    list
      .getByTestId("composer-file-choice")
      .and(page.locator('[data-path*="status"]'))
      .first(),
  ).toBeVisible({
    timeout: 10000,
  });
  await page.keyboard.press("Tab");
  await expect(field).toHaveValue(/^lue @\S*status\S* $/);
  // The Komennot button opens the same list with a search; Enter puts the
  // command at the start of the message.
  await field.fill("korjaa testit");
  await page.getByTestId("command-palette").click();
  const search = page.getByTestId("command-search");
  await expect(search).toBeFocused();
  await search.fill("fix");
  await search.press("Enter");
  await expect(field).toHaveValue("/fix-tests korjaa testit");
  await expect(field).toBeFocused();
});

test("@lab composer: Ctrl/⌘+P opens the palette, marks two files with Tab and inserts both", async ({
  page,
}) => {
  test.setTimeout(90000);
  const field = await newConversation(page);
  await field.fill("Katso ");
  await field.press(`${mod}+p`);
  const palette = page.getByTestId("composer-palette");
  await expect(palette).toBeVisible();
  await expect(palette.getByTestId("palette-tab-all")).toHaveAttribute(
    "aria-selected",
    "true",
  );
  // Ctrl/⌘+P again moves to the explicit changed-only filter.
  await page.keyboard.press(`${mod}+p`);
  await expect(palette.getByTestId("palette-tab-changed")).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await palette.getByTestId("palette-tab-all").click();
  const search = palette.getByTestId("file-search");
  // Terms do not have to occur in path order; both must match the same file.
  await search.fill("rows scripts");
  await expect(palette.getByRole("option")).toHaveCount(1);
  await expect(palette.getByRole("option")).toContainText(
    "scripts/status_rows.py",
  );
  await expect(
    palette.getByRole("option").getByTestId("file-git-mark"),
  ).toHaveAttribute("data-git-mark", "modified");
  await search.fill("scripts missing");
  await expect(palette.getByRole("option")).toHaveCount(0);
  await search.fill("");
  const options = palette.getByRole("option");
  await expect(options.nth(1)).toBeVisible({ timeout: 10000 });
  expect(
    (await new AxeBuilder({ page }).include(".ah-palette").analyze())
      .violations,
  ).toEqual([]);
  const paths = await palette
    .locator(".ah-choice-path")
    .evaluateAll((nodes) => nodes.slice(0, 2).map((node) => node.textContent));
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await expect(palette.getByTestId("palette-hints")).toHaveAttribute(
    "data-mark-count",
    "2",
  );
  await page.keyboard.press("Enter");
  await expect(palette).toHaveCount(0);
  await expect(field).toHaveValue(`Katso @${paths[0]} @${paths[1]} `);
  // Esc returns to the field at the same caret without changing the text.
  const before = await field.inputValue();
  await field.press(`${mod}+p`);
  await expect(palette).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(palette).toHaveCount(0);
  await expect(field).toBeFocused();
  await expect(field).toHaveValue(before);
});

test("@lab composer on a phone: the bottom row fits while Pi works and the list spans the width", async ({
  page,
}) => {
  test.setTimeout(90000);
  const viewport = { width: 390, height: 844 };
  await newConversation(page, viewport);
  await startWork(page);
  const row = page.locator(".ah-crow");
  const fits = await row.evaluate((node) => ({
    overflow: node.scrollWidth - node.clientWidth,
    right: node.getBoundingClientRect().right,
    labels: [...node.querySelectorAll(".ah-crow-lbl")].map(
      (label) => getComputedStyle(label).display,
    ),
  }));
  expect(fits.overflow).toBeLessThanOrEqual(1);
  expect(fits.right).toBeLessThanOrEqual(viewport.width);
  // Attachment, command, file and dictation buttons drop their labels while Pi works.
  expect(fits.labels).toEqual(["none", "none", "none", "none"]);
  for (const testId of ["composer-stop", "send"])
    expect(
      (await page.getByTestId(testId).boundingBox())?.height ?? 0,
    ).toBeGreaterThanOrEqual(36);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(viewport.width);
});

for (const width of [1440, 390]) {
  for (const theme of ["light", "dark"] as const) {
    test(`@lab attachment picker ${width} ${theme}: direct selection and draft retention @a11y`, async ({
      page,
    }, testInfo) => {
      const draft = await newConversation(page, { width, height: 900 });
      await page.evaluate(
        (value) => (document.documentElement.dataset.theme = value),
        theme,
      );
      await draft.fill("Katso myös kuvakaappaus.");
      const opener = page.getByTestId("attach-file");
      // Audit the remaining control, not the removed one-option dialog.
      expect(
        (
          await new AxeBuilder({ page })
            .include('[data-testid="attach-file"]')
            .analyze()
        ).violations,
      ).toEqual([]);
      const { snapshot } = await import("../lab/session.mjs");
      await snapshot(
        page,
        testInfo.outputPath(`attachment-${width}-${theme}`),
        {
          labOrigin: new URL(page.url()).origin,
        },
      );
      await opener.focus();
      const cancelled = page.waitForEvent("filechooser");
      await page.keyboard.press("Enter");
      await (await cancelled).setFiles([]);
      await expect(draft).toHaveValue("Katso myös kuvakaappaus.");
      const chooser = page.waitForEvent("filechooser");
      await opener.click();
      await (await chooser).setFiles({
        name: "notes.txt",
        mimeType: "text/plain",
        buffer: Buffer.from("synthetic"),
      });
      // The file is a chip; the field keeps what the person wrote.
      await expect(
        page
          .locator(".ah-composer")
          .getByTestId("attachment-chip")
          .and(page.locator('[data-attachment-kind="file"]')),
      ).toHaveCount(1);
      await expect(draft).toHaveValue("Katso myös kuvakaappaus.");
      await expect(page.getByTestId("attachment-panel")).toHaveCount(0);
    });
  }
}
