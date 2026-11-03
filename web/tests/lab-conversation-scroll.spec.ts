import type { Page } from "@playwright/test";
import { labOrigin } from "../test-ports.mjs";
import { expect, test } from "./lab-host";

test.use({ baseURL: labOrigin, ignoreHTTPSErrors: true });

type Frame = {
  t: number;
  intro: boolean;
  work: boolean;
  gliding: boolean;
  gap: number;
  rows: { text: string; top: number }[];
  last: number;
  /** From the end of the stream's content to the stream's bottom, which the
   * chip strip and the composer sit on: its padding plus any hold. */
  tail: number;
};

// Record what each frame paints. A task can run between a commit and the next
// frame, so reading layout from one sees states the app's ResizeObserver
// corrects before paint. A ResizeObserver created in each frame is delivered
// after the app's own, after layout and before paint. Rows are named by their
// text so a row re-rendered as native history is still recognised.
async function recordFrames(page: Page) {
  await page.evaluate(() => {
    const frames: Frame[] = [];
    let on = true;
    const probe = document.createElement("div");
    probe.style.cssText = "position:fixed;width:1px;height:1px";
    document.body.append(probe);
    const sample = () => {
      const stream = document.querySelector<HTMLElement>(
        ".ah-conversation-stream",
      );
      // An item that renders nothing is not painted (display: none).
      const rows = [
        ...(stream?.querySelectorAll<HTMLElement>(".ah-feed > li") ?? []),
      ].filter((row) => row.getClientRects().length);
      if (stream && rows.length) {
        const bottom = stream.getBoundingClientRect().bottom;
        frames.push({
          t: performance.now(),
          intro: !!stream.querySelector("[data-reading-intro]"),
          work: rows.some((row) => row.dataset.kind === "assistant"),
          // A hold that expired lets go in a short glide, not a jump.
          gliding:
            stream.hasAttribute("data-hold-release") &&
            getComputedStyle(stream, "::after").height !== "0px",
          gap: stream.scrollHeight - stream.scrollTop - stream.clientHeight,
          // The same synthetic reply recurs; its occurrence tells them apart.
          rows: rows.map((row, i) => {
            const text = (row.textContent ?? "").slice(0, 40);
            const seen = rows
              .slice(0, i)
              .filter((r) => (r.textContent ?? "").slice(0, 40) === text);
            return {
              text: `${text}#${seen.length}`,
              top: row.getBoundingClientRect().top - bottom,
            };
          }),
          last: (rows.at(-1)?.getBoundingClientRect().top ?? 0) - bottom,
          tail:
            bottom -
            (stream.lastElementChild?.getBoundingClientRect().bottom ?? 0),
        });
      }
    };
    const frame = () => {
      if (!on) return;
      const observer = new ResizeObserver(() => {
        observer.disconnect();
        sample();
      });
      observer.observe(probe);
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
    Object.assign(window, {
      scrollFrames: frames,
      stopScrollFrames: () => {
        on = false;
      },
    });
  });
}

/** Frames where a row that stayed on screen moved down: the view jumped up.
 * The bounces seen were 12–42 px; a few pixels is a row relaying itself out. */
function jumps(frames: Frame[]) {
  const found: string[] = [];
  for (let i = 1; i < frames.length; i++) {
    if (frames[i].gliding) continue;
    const before = new Map(frames[i - 1].rows.map((r) => [r.text, r.top]));
    for (const row of frames[i].rows) {
      const top = before.get(row.text);
      if (!row.text.startsWith("#") && top !== undefined && row.top > top + 8) {
        found.push(
          `${Math.round(frames[i].t)}ms ${row.text}: ${Math.round(top)}→${Math.round(row.top)}`,
        );
        break;
      }
    }
  }
  return found;
}

async function stopFrames(page: Page) {
  return page.evaluate(() => {
    const w = window as typeof window & {
      scrollFrames: Frame[];
      stopScrollFrames: () => void;
    };
    w.stopScrollFrames();
    return w.scrollFrames;
  });
}

async function openConversation(page: Page, work = "hidden") {
  await page.addInitScript(
    (choice) => window.localStorage.setItem("nah:agent-work", choice),
    work,
  );
  await page.request.get("/fixture/conversations-reset");
  await page.request.get("/fixture/scenario?value=pi-deltas");
  await page.goto("/workspaces");
  await page.getByTestId("github-sign-in").click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  await page
    .getByRole("navigation")
    .getByTestId("workspace-aurinkokello")
    .click();
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  await page.getByTestId("message-input").waitFor();
}

async function send(page: Page, text: string) {
  await page.getByTestId("message-input").fill(text);
  await page
    .getByTestId("send")
    .and(page.locator('[data-mode="send"]'))
    .click();
}

const idle = (page: Page) =>
  expect(
    page.getByTestId("send").and(page.locator('[data-mode="send"]')),
  ).toBeVisible({ timeout: 30000 });

const gap = (page: Page) =>
  page
    .locator(".ah-conversation-stream")
    .evaluate((n) => n.scrollHeight - n.scrollTop - n.clientHeight);

/** A conversation taller than the view, read at its end. */
async function tallAtEnd(page: Page) {
  await openConversation(page);
  await send(page, "ensimmäinen viesti");
  await idle(page);
  await expect(page.locator(".ah-feed")).toContainText(
    'Kysyit: "ensimmäinen viesti"',
    { timeout: 20000 },
  );
  // The saved reply replaces the live one after the turn; wait until the
  // thread has stopped changing. A hold keeps the height while it lasts.
  const stream = page.locator(".ah-conversation-stream");
  let previous = -1;
  await expect
    .poll(
      async () => {
        const [height, held] = await stream.evaluate((n) => [
          n.scrollHeight,
          getComputedStyle(n, "::after").height !== "0px",
        ]);
        const settled = height === previous && !held;
        previous = height;
        return settled;
      },
      { intervals: [700] },
    )
    .toBe(true);
  await page.addStyleTag({
    content: ".ah-feed > li:first-child { min-height: 3000px; }",
  });
  await stream.evaluate((node) => {
    node.scrollTop = node.scrollHeight;
  });
  await expect.poll(() => gap(page)).toBeLessThan(2);
}

const slowHistory = (page: Page) =>
  // Native-history reads take more than a second on a loaded host.
  page.route("**/api/v1/agents/*/history*", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1200));
    await route.continue().catch(() => {});
  });

// The first turn of a new conversation used to keep the start page mounted
// until native history was read, and a view with the start page in it does not
// follow: the work grew out of sight below.
test("@lab the first turn is followed before its history is read", async ({
  page,
}) => {
  test.setTimeout(90000);
  await openConversation(page, "visible");
  await slowHistory(page);
  await recordFrames(page);
  await send(page, "pitkä ajo");
  await expect
    .poll(
      () =>
        page
          .locator(".ah-conversation-stream")
          .evaluate((n) => n.scrollHeight > n.clientHeight * 2),
      { timeout: 45000 },
    )
    .toBe(true);
  await idle(page);
  const frames = await stopFrames(page);
  expect(frames.filter((f) => f.intro && f.work)).toEqual([]);
  const turn = frames.filter((f) => f.work);
  // Enough frames that the checks below are not vacuous. An idle host gives
  // about 135 over the turn; the clean gate, which runs both browser suites at
  // once, gave 12-24, which is load, not a lost follow.
  expect(turn.length).toBeGreaterThan(5);
  expect(turn.filter((f) => f.gap > 2).map((f) => f.gap)).toEqual([]);
});

// Jari 2026-10-28: during live agent work the conversation sometimes jumped
// up and straight back down although nobody scrolled. A row of the live tail
// is briefly gone while it is rebuilt, at each turn's start and end. Following
// the latest turn, a row on screen only ever moves up.
test("@lab a followed conversation does not bounce while turns run", async ({
  page,
}) => {
  test.setTimeout(120000);
  // A hold that expires glides away; reduced motion drops it in one frame by
  // design, and that step is not the bounce measured here.
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await openConversation(page);
  await slowHistory(page);
  for (const text of ["ensimmäinen viesti", "toinen viesti"]) {
    await send(page, text);
    await idle(page);
  }
  await page.waitForTimeout(2500);
  await recordFrames(page);
  for (const text of ["pitkä ajo", "kolmas viesti"]) {
    await send(page, text);
    await idle(page);
    await page.waitForTimeout(2500);
  }
  const frames = await stopFrames(page);
  expect(frames.length).toBeGreaterThan(30);
  expect(frames.filter((f) => f.gap > 2).map((f) => f.gap)).toEqual([]);
  expect(jumps(frames)).toEqual([]);
});

// Jari 2026-10-28: while the agent worked, an empty gap of about 50 px stayed
// between the live row and the chip above the composer. Holding the height of
// a shrinking tail bridges a rebuilt row (15–60 ms); held longer it is that
// gap. During and after live turns the last row is back at the design spacing
// above the composer area within a moment of every change.
test("@lab the live row stays at its spacing above the composer", async ({
  page,
}) => {
  test.setTimeout(120000);
  await openConversation(page);
  await slowHistory(page);
  for (const text of ["ensimmäinen viesti", "toinen viesti"]) {
    await send(page, text);
    await idle(page);
  }
  await page.waitForTimeout(1000);
  const design = await page
    .locator(".ah-conversation-stream")
    .evaluate((n) => Number.parseFloat(getComputedStyle(n).paddingBottom));
  await recordFrames(page);
  for (const text of ["pitkä ajo", "kolmas viesti"]) {
    await send(page, text);
    await idle(page);
    // The slow history read settles the turn after it ends.
    await page.waitForTimeout(2500);
  }
  const frames = await stopFrames(page);
  expect(frames.filter((f) => f.work).length).toBeGreaterThan(30);
  // Stretches of frames with more than the design spacing under the last row.
  const wide: string[] = [];
  let since: Frame | undefined;
  for (const frame of [...frames, undefined]) {
    if (frame && frame.tail > design + 1) since ??= frame;
    else if (since) {
      const end = frame?.t ?? frames.at(-1)?.t ?? since.t;
      if (end - since.t > 700)
        wide.push(
          `${Math.round(end - since.t)}ms +${Math.round(since.tail - design)}px`,
        );
      since = undefined;
    }
  }
  expect(wide).toEqual([]);
  expect(frames.at(-1)?.tail).toBeCloseTo(design, 0);
});

// Jari 2026-10-28: the conversation bounced when a line break grew the
// message field. Following the latest turn, its last line stays on the
// field's edge in every frame.
test("@lab growing the message field keeps the followed end on its edge", async ({
  page,
}) => {
  test.setTimeout(60000);
  await tallAtEnd(page);
  const input = page.getByTestId("message-input");
  const before = await input.evaluate((n) => n.getBoundingClientRect().height);
  await recordFrames(page);
  await input.click();
  for (let i = 0; i < 4; i++) {
    await input.pressSequentially("rivi");
    await input.press("Shift+Enter");
    await page.waitForTimeout(100);
  }
  await page.waitForTimeout(300);
  const frames = await stopFrames(page);
  expect(
    await input.evaluate((n) => n.getBoundingClientRect().height),
  ).toBeGreaterThan(before + 20);
  const edges = new Set(frames.map((f) => Math.round(f.last)));
  expect(edges.size, [...edges].join(" ")).toBe(1);
});

// Jari 2026-10-28: scrolling a little way up from the end crept back and then
// jumped to the end a moment later. A reader's own scroll near the end stays
// where they left it, with a wheel (trackpad) and with a finger.
const shortScrollUp =
  (source: "mouse" | "touch") =>
  async ({ page }: { page: Page }) => {
    test.setTimeout(60000);
    await tallAtEnd(page);
    const stream = page.locator(".ah-conversation-stream");
    if (source === "touch") {
      // Opened through the desktop navigation, read in the phone layout.
      await page.setViewportSize({ width: 390, height: 844 });
      await stream.evaluate((node) => {
        node.scrollTop = node.scrollHeight;
      });
      await expect.poll(() => gap(page)).toBeLessThan(2);
    }
    const box = await stream.boundingBox();
    if (!box) throw new Error("no conversation stream");
    const cdp = await page.context().newCDPSession(page);
    // Real input through the browser's scrolling, unlike a scrollTop write.
    const x = Math.round(box.x + box.width / 2);
    const y = Math.round(box.y + box.height / 2);
    if (source === "mouse")
      await cdp.send("Input.synthesizeScrollGesture", {
        x,
        y,
        yDistance: 30,
        gestureSourceType: "mouse",
        speed: 300,
        preventFling: true,
      });
    else {
      const touch = (
        type: "touchStart" | "touchMove" | "touchEnd",
        dy: number,
      ) =>
        cdp.send("Input.dispatchTouchEvent", {
          type,
          touchPoints: type === "touchEnd" ? [] : [{ x, y: y + dy }],
        });
      await touch("touchStart", 0);
      for (let dy = 4; dy <= 40; dy += 4) await touch("touchMove", dy);
      await touch("touchEnd", 40);
    }
    // The view settles where the gesture left it.
    await page.waitForTimeout(200);
    const left = await gap(page);
    expect(left).toBeGreaterThan(10);
    expect(left).toBeLessThan(60);
    const top = () => stream.evaluate((n) => n.scrollTop);
    const before = await top();
    // Longer than the reader-intent window.
    await page.waitForTimeout(1200);
    expect(Math.abs((await top()) - before)).toBeLessThan(2);
  };

test(
  "@lab a short wheel scroll up from the end stays put",
  shortScrollUp("mouse"),
);

test.describe("phone", () => {
  test.use({ hasTouch: true });
  test(
    "@lab a short touch scroll up from the end stays put",
    shortScrollUp("touch"),
  );
});
