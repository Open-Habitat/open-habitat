import type { Page } from "@playwright/test";
import { hostOrigin } from "../test-ports.mjs";
import { expect, test } from "./worker-host";

// Returning to a conversation opens it where the reader left it: the same
// native row at the same height, not the end. A conversation left at its end
// keeps opening at the end and following; a search hit wins over the place.
const long = "pi:11111111-1111-4111-8111-111111111111";
const other = "pi:33333333-3333-4333-8333-000000000002";
test.use({
  baseURL: hostOrigin,
  ignoreHTTPSErrors: true,
  viewport: { width: 1440, height: 900 },
});

async function signIn(page: Page) {
  expect(
    (await page.request.get("/fixture/history?mode=search")).status(),
  ).toBe(204);
  await page.goto("/");
  await page.getByTestId("github-sign-in").click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  if ((page.viewportSize()?.width ?? 1440) <= 800)
    await expect(page.getByTestId("navigation-open")).toBeVisible();
  else
    await expect(page.getByTestId("workspace-navigation")).toContainText(
      "Alice",
    );
}

const switcherKey = (page: Page) =>
  page.keyboard.press(process.platform === "darwin" ? "Meta+K" : "Control+K");
const stream = (page: Page) => page.locator(".ah-conversation-stream");
const gap = (page: Page) =>
  stream(page).evaluate(
    (el) => el.scrollHeight - el.scrollTop - el.clientHeight,
  );

/** ⌘K with an empty query offers the previous conversation; Enter opens it. */
async function back(page: Page, previous: string) {
  await switcherKey(page);
  await expect(page.getByTestId(`switcher-row-c-${previous}`)).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await page.keyboard.press("Enter");
}

/** The first native row in view, by its own content, and its height. */
const place = (page: Page) =>
  stream(page).evaluate((el) => {
    const top = el.getBoundingClientRect().top;
    for (const row of el.querySelectorAll<HTMLElement>(".ah-feed > li")) {
      const box = row.getBoundingClientRect();
      if (box.bottom > top)
        return {
          text: (row.textContent ?? "").replace(/\s+/g, " ").slice(0, 80),
          offset: Math.round(box.top - top),
        };
    }
    return undefined;
  });

async function expectPlace(
  page: Page,
  left: { text: string; offset: number } | undefined,
) {
  if (!left) throw new Error("no place was left");
  await expect
    .poll(async () => {
      const now = await place(page);
      return now?.text === left.text && Math.abs(now.offset - left.offset) < 3;
    })
    .toBe(true);
}

/** Reader input, so following stops as it does for a person. */
async function readBack(page: Page, distance: number) {
  await stream(page).hover();
  await page.mouse.wheel(0, -distance);
  await expect.poll(() => gap(page)).toBeGreaterThan(distance / 2);
  // Let the wheel's scroll settle before reading the place.
  let before = "";
  await expect
    .poll(
      async () => {
        const now = JSON.stringify(await place(page));
        const same = now === before;
        before = now;
        return same;
      },
      { intervals: [250] },
    )
    .toBe(true);
  return place(page);
}

for (const viewport of [
  { name: "desktop", width: 1440, height: 900 },
  { name: "phone", width: 390, height: 844 },
]) {
  test(`@conversation-return a history left mid-way reopens at the same rows (${viewport.name})`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await signIn(page);
    await page.goto(`/agents/${long}`);
    await expect(page.locator(".ah-feed")).toContainText(
      "Synteettinen vastaus 159.",
    );
    await expect.poll(() => gap(page)).toBeLessThan(2);
    const left = await readBack(page, 1500);
    // Another conversation in the same tab, then back without a reload.
    if (viewport.name === "desktop") {
      await switcherKey(page);
      await page.getByTestId("switcher-input").fill("Arkistoitava 2");
      await page.getByTestId(`switcher-row-c-${other}`).click();
      await expect(page).toHaveURL(new RegExp(`/agents/${other}$`));
      await back(page, long);
    } else {
      await page.evaluate((href) => {
        history.pushState({}, "", href);
        dispatchEvent(new PopStateEvent("popstate"));
      }, `/agents/${other}`);
      await expect(page).toHaveURL(new RegExp(`/agents/${other}$`));
      await page.goBack();
    }
    await expect(page).toHaveURL(new RegExp(`/agents/${long}$`));
    await expectPlace(page, left);
  });
}

test("@conversation-return a place in an older page is read back after a reload", async ({
  page,
}) => {
  await signIn(page);
  await page.goto(`/agents/${long}`);
  await expect(page.locator(".ah-feed")).toContainText(
    "Synteettinen vastaus 159.",
  );
  const rows = await page.locator(".ah-feed > li").count();
  await stream(page).hover();
  await page.mouse.wheel(0, -100000);
  await expect.poll(() => stream(page).evaluate((el) => el.scrollTop)).toBe(0);
  await page.getByTestId("older-history").click();
  await expect
    .poll(() => page.locator(".ah-feed > li").count())
    .toBeGreaterThan(rows);
  // Read into the older page, a little below its own top.
  await page.mouse.wheel(0, 600);
  const left = await readBack(page, 200);
  // A reload keeps this tab's places; the tail page no longer holds this
  // row, so the opening reads back to it.
  await page.reload();
  await expectPlace(page, left);
});

test("@conversation-return a controlled conversation keeps its place, and its end keeps following", async ({
  page,
}) => {
  await signIn(page);
  await page
    .getByRole("navigation")
    .getByTestId("workspace-ordinary-dir")
    .click();
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  const send = async (text: string) => {
    await page.getByTestId("message-input").fill(text);
    await page
      .getByTestId("send")
      .and(page.locator('[data-mode="send"]'))
      .click();
    await expect(page.getByTestId("message-input")).toBeEnabled({
      timeout: 20000,
    });
  };
  // A reply settles once the agent stops working and its text is shown.
  const replied = async (before: number) => {
    await expect
      .poll(() => page.locator(".ah-turn-reply").count(), { timeout: 20000 })
      .toBeGreaterThan(before);
    await expect(page.locator(".ah-turn-reply").last()).toContainText(
      "Selvä. Kysyit:",
      { timeout: 20000 },
    );
  };
  await send(
    `Paluun tarkistus\n\n${"Pitkä synteettinen kappale.\n\n".repeat(30)}`,
  );
  await expect(page.locator(".ah-turn-reply").last()).toContainText(
    "Selvä. Kysyit:",
    { timeout: 20000 },
  );
  const first = await page.locator(".ah-turn-reply").count();
  await send(
    `Toinen viesti\n\n${"Lisää synteettistä tekstiä.\n\n".repeat(30)}`,
  );
  await replied(first);
  const conversation = new URL(page.url()).searchParams.get("conversation");
  if (!conversation) throw new Error("missing conversation identity");
  const away = async () => {
    await switcherKey(page);
    await page.getByTestId("switcher-input").fill("Arkistoitava 2");
    await page.getByTestId(`switcher-row-c-${other}`).click();
    await expect(page).toHaveURL(new RegExp(`/agents/${other}$`));
    await back(page, conversation);
    await expect(page).toHaveURL(/conversation=pi/);
  };
  // Left mid-history: back at the same rows, with the way to the latest.
  const left = await readBack(page, 900);
  await away();
  await expectPlace(page, left);
  await expect(page.getByTestId("jump-latest")).toBeVisible();
  // Left at the end: back at the end, and a new reply is followed.
  await page.getByTestId("jump-latest").click();
  await expect.poll(() => gap(page)).toBeLessThan(2);
  await away();
  await expect.poll(() => gap(page)).toBeLessThan(2);
  const second = await page.locator(".ah-turn-reply").count();
  await send(`Kolmas viesti\n\n${"Vielä tekstiä.\n\n".repeat(30)}`);
  await replied(second);
  await expect.poll(() => gap(page)).toBeLessThan(2);
});

test("@conversation-return a search hit wins over the remembered place", async ({
  page,
}) => {
  await signIn(page);
  await page.goto(`/agents/${long}`);
  await expect(page.locator(".ah-feed")).toContainText(
    "Synteettinen vastaus 159.",
  );
  const left = await readBack(page, 900);
  await switcherKey(page);
  await page.getByTestId("switcher-input").fill("Arkistoitava 2");
  await page.getByTestId(`switcher-row-c-${other}`).click();
  await expect(page).toHaveURL(new RegExp(`/agents/${other}$`));
  // The hit lies two pages back, far from the place left.
  await switcherKey(page);
  await page.getByTestId("switcher-input").fill("kartta");
  await expect(page.getByTestId(`switcher-row-c-${long}`)).toBeVisible();
  await page.keyboard.press("Enter");
  const target = page.locator(".ah-search-target");
  await expect(target).toBeInViewport();
  await expect(page.getByTestId("jump-band")).toBeVisible();
  await expect(target).toBeInViewport();
  expect((await place(page))?.text).not.toBe(left?.text);
});
