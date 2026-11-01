import AxeBuilder from "@axe-core/playwright";
import { hostOrigin } from "../test-ports.mjs";
import { expect, type Page, test } from "./worker-host";

test.use({ baseURL: hostOrigin, ignoreHTTPSErrors: true });

async function open(page: Page) {
  await page.goto("/workspaces");
  await page
    .getByRole("button")
    .and(page.getByTestId("github-sign-in"))
    .click();
  await page.getByRole("link").nth(0).click();
  await page.goto("/settings/recap");
  await expect(
    page
      .getByRole("heading")
      .and(page.getByTestId("settings-section-tilannekatsaus")),
  ).toBeVisible();
}
const stored = async (page: Page) =>
  (await (await page.request.get("/api/v1/pi/recap-settings")).json()).settings;
const saved = (page: Page) =>
  page.waitForResponse(
    (r) =>
      r.request().method() === "PUT" &&
      r.url().endsWith("/api/v1/pi/recap-settings") &&
      r.status() === 200,
  );

test("@recap-settings levels, delay and model reach Pi's settings and survive a reload", async ({
  page,
}) => {
  await open(page);
  const level = page.getByRole("group").and(page.getByTestId("recap-level"));
  const segment = (id: string) =>
    level.getByRole("button").and(page.getByTestId(`segment-${id}`));
  await expect(segment("standard")).toHaveAttribute("aria-pressed", "true");
  expect(await stored(page)).toMatchObject({ level: "standard", words: 40 });

  let write = saved(page);
  await segment("short").click();
  await write;
  expect(await stored(page)).toMatchObject({
    level: "short",
    words: 25,
    messages: 16,
    first_after_turns: 2,
  });
  // Numbers open only in Oma, and a changed number keeps it there.
  await expect(page.getByTestId("recap-words")).toHaveCount(0);
  write = saved(page);
  await segment("custom").click();
  await write;
  write = saved(page);
  await page
    .getByRole("button")
    .and(page.getByTestId("recap-words-more"))
    .click();
  await write;
  expect(await stored(page)).toMatchObject({ level: "custom", words: 30 });

  // The delay moves along its stops and commits when the key is released.
  const delay = page.getByRole("slider");
  write = saved(page);
  await delay.focus();
  await page.keyboard.press("ArrowRight");
  await write;
  expect((await stored(page)).delay_seconds).toBe(210);

  // Automatic is the default; a chosen model closes the chooser.
  const trigger = page
    .getByRole("button")
    .and(page.getByTestId("recap-model-trigger"));
  await expect(trigger).toHaveAttribute("data-auto", "true");
  await trigger.click();
  const menu = page
    .getByRole("dialog")
    .and(page.getByTestId("recap-model-menu"));
  await expect(
    menu.getByRole("radio").and(page.getByTestId("model-automatic")),
  ).toBeChecked();
  write = saved(page);
  await menu
    .getByRole("radio")
    .and(page.getByTestId("model-gpt-6-nova"))
    .click();
  await write;
  await expect(menu).toBeHidden();
  await expect(trigger).not.toHaveAttribute("data-auto");
  await expect(trigger).toHaveAttribute("data-model", "gpt-6-nova");
  expect((await stored(page)).model).toBe("openai-codex/gpt-6-nova");

  await page.reload();
  await expect(segment("custom")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("recap-words-input")).toHaveValue("30");
  await expect(delay).toHaveAttribute("aria-valuetext", /3 min 30 s/);
  await page.setViewportSize({ width: 1280, height: 1900 });
  await page.screenshot({ path: "test-results/evidence/recap-settings.png" });
  await page.setViewportSize({ width: 390, height: 1900 });
  await page.screenshot({
    path: "test-results/evidence/recap-settings-phone.png",
  });
  await page.setViewportSize({ width: 1280, height: 720 });
  await trigger.click();
  await page.screenshot({
    path: "test-results/evidence/recap-settings-model.png",
  });
  write = saved(page);
  await menu
    .getByRole("radio")
    .and(page.getByTestId("model-automatic"))
    .click();
  await write;
  await expect(trigger).toHaveAttribute("data-auto", "true");
  expect((await stored(page)).model).toBeNull();

  // The delay reaches past Pi's ten idle minutes, to an hour (Jari 30.10.).
  write = saved(page);
  await delay.focus();
  await page.keyboard.press("End");
  await write;
  expect((await stored(page)).delay_seconds).toBe(3600);
  await expect(delay).toHaveAttribute("aria-valuetext", "60 min");

  const automatic = page.getByTestId("recap-automatic");
  write = saved(page);
  await automatic.getByTestId("segment-off").click();
  await write;
  await page.reload();
  await expect(automatic.getByTestId("segment-off")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByTestId("recap-off-warning")).toBeVisible();
  expect(await stored(page)).toMatchObject({
    level: "off",
    words: 30,
    delay_seconds: 3600,
  });
  await expect(delay).toBeDisabled();
  const accessibility = await new AxeBuilder({ page })
    .include('[data-testid="recap-settings"]')
    .analyze();
  expect(accessibility.violations).toEqual([]);
  write = saved(page);
  await automatic.getByTestId("segment-on").click();
  await write;
  expect(await stored(page)).toMatchObject({ level: "custom", words: 30 });
});

/** The four levels share one row, or two rows of two: never three and Oma
 * alone (Jari 30.10.2026). */
async function expectLevelsTidy(page: Page) {
  const tops = await page
    .getByTestId("recap-level")
    .getByRole("button")
    .evaluateAll((buttons) =>
      buttons.map((b) => Math.round(b.getBoundingClientRect().top)),
    );
  expect(tops).toHaveLength(4);
  const oneRow = tops.every((top) => top === tops[0]);
  const twoByTwo =
    tops[0] === tops[1] && tops[2] === tops[3] && tops[2] > tops[0];
  expect(oneRow || twoByTwo, `level rows at ${tops}`).toBe(true);
}

test("@recap-settings the four levels fit on the page and on a phone", async ({
  page,
}) => {
  await open(page);
  for (const width of [1280, 1024, 900, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await expectLevelsTidy(page);
  }
});

test("@recap-settings no row is cut by its card in a desktop window's narrow column", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await open(page);
  // Oma's steppers and a chosen model are the widest form of the page.
  const level = page.getByTestId("recap-level");
  let write = saved(page);
  await level
    .getByRole("button")
    .and(page.getByTestId("segment-custom"))
    .click();
  await write;
  const trigger = page
    .getByRole("button")
    .and(page.getByTestId("recap-model-trigger"));
  await trigger.click();
  write = saved(page);
  await page
    .getByRole("dialog")
    .and(page.getByTestId("recap-model-menu"))
    .getByRole("radio")
    .and(page.getByTestId("model-gpt-6-nova"))
    .click();
  await write;
  try {
    // Beside the sidebar and Settings' list the column is about a third of
    // the window at 1280 and as narrow as a phone's just above 760.
    for (const width of [1280, 1100, 1024, 900, 800]) {
      await page.setViewportSize({ width, height: 900 });
      const cut = await page
        .getByTestId("recap-settings")
        .locator(".s-card")
        .evaluateAll((cards) =>
          cards.flatMap((card) => {
            const box = card.getBoundingClientRect();
            return [...card.querySelectorAll("*")]
              .filter((e) => {
                const r = e.getBoundingClientRect();
                return (
                  r.width > 0 &&
                  (r.left < box.left - 1 || r.right > box.right + 1)
                );
              })
              .map(
                (e) =>
                  e
                    .closest("[data-settings-row]")
                    ?.getAttribute("data-settings-row") ?? e.tagName,
              );
          }),
        );
      expect(cut, `cut at ${width}`).toEqual([]);
      if (width === 1280 || width === 900) {
        await page.getByTestId("recap-delay").scrollIntoViewIfNeeded();
        await page.screenshot({
          path: `test-results/evidence/recap-settings-column-${width}.png`,
        });
      }
    }
  } finally {
    await page.setViewportSize({ width: 1280, height: 900 });
    write = saved(page);
    await level
      .getByRole("button")
      .and(page.getByTestId("segment-standard"))
      .click();
    await write;
    await trigger.click();
    write = saved(page);
    await page
      .getByRole("dialog")
      .and(page.getByTestId("recap-model-menu"))
      .getByRole("radio")
      .and(page.getByTestId("model-automatic"))
      .click();
    await write;
  }
});

test("@recap-settings the recap card opens its settings over the conversation and X returns to it", async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 1280, height: 800 });
  expect(
    (await page.request.get("/fixture/conversations-reset")).status(),
  ).toBe(204);
  expect(
    (await page.request.get("/fixture/scenario?value=pi-recap")).status(),
  ).toBe(204);
  try {
    // Tavallinen recaps after the first turn, whatever a case before left.
    await open(page);
    const standard = page
      .getByTestId("recap-level")
      .getByRole("button")
      .and(page.getByTestId("segment-standard"));
    if ((await standard.getAttribute("aria-pressed")) !== "true") {
      const write = saved(page);
      await standard.click();
      await write;
    }
    // The browser holds a card back until the person pauses (recapHold.ts).
    await page.clock.install();
    await page.goto("/workspaces");
    await page
      .getByRole("navigation")
      .getByTestId("workspace-ordinary-dir")
      .click();
    await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
    await expect(page).toHaveURL(/conversation=pi:/);
    const editor = page.getByTestId("message-input");
    await editor.fill("katsaus ja asetukset");
    await page
      .getByTestId("send")
      .and(page.locator('[data-mode="send"]'))
      .click();
    const id = new URL(page.url()).searchParams.get("conversation");
    await expect
      .poll(
        async () => {
          const native = await (
            await page.request.get(`/api/v1/agents/${id}/recap`)
          ).json();
          return native.recap?.through === native.latest_message;
        },
        { timeout: 30000 },
      )
      .toBe(true);
    await page.clock.fastForward(61_000);
    await expect(page.getByTestId("recap-card")).toHaveAttribute(
      "data-trigger",
      "automatic",
      { timeout: 10000 },
    );
    const url = page.url();
    await editor.fill("Luonnos, jota ei lähetetä");
    // A remount of the conversation would lose this mark.
    await page
      .locator(".ah-conversation-frame")
      .evaluate((frame) => frame.setAttribute("data-before-settings", ""));

    await page.getByTestId("recap-settings-link").click();
    await expect(page).toHaveURL(/\/settings\/recap$/);
    await expect(
      page
        .getByRole("heading")
        .and(page.getByTestId("settings-section-tilannekatsaus")),
    ).toBeVisible();
    // Opened over the conversation, beside Settings' own navigation.
    await expect(page.locator("[data-under-settings]")).toBeAttached();
    await expectLevelsTidy(page);
    await page.getByTestId("recap-level").scrollIntoViewIfNeeded();
    await page.screenshot({
      path: "test-results/evidence/recap-settings-over-conversation.png",
    });

    await page
      .getByRole("button")
      .and(page.getByTestId("settings-close"))
      .click();
    await expect(page).toHaveURL(url);
    await expect(
      page.locator(".ah-conversation-frame[data-before-settings]"),
    ).toBeVisible();
    await expect(editor).toHaveValue("Luonnos, jota ei lähetetä");
  } finally {
    await page.request.get("/fixture/scenario?value=ready");
  }
});
