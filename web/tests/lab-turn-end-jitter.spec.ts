import { writeFileSync } from "node:fs";
import { labOrigin } from "../test-ports.mjs";
import { expect, test } from "./lab-host";

// The end of a streamed reply: the live tail ends, Pi's saved reply replaces
// the streamed one, and the run's status ends the turn. Pi saves the reply
// before its run settles, and the history read and the status read reach the
// browser in either order. The reply stays the same element in the same
// place, and the turn's working row and the composer's Stop change in the
// same frame, whichever arrives first.

type Rect = number[] | null;
type Frame = {
  t: number;
  reply: Rect;
  role: string | null;
  connected: boolean;
  composer: Rect;
  mode: string | null;
  strip: boolean;
};
type Measurement = {
  frames: Frame[];
  shifts: { t: number; value: number; sources: string[] }[];
  removed: { t: number; what: string }[];
  mounts: Record<string, number>;
  stop: () => void;
};
declare global {
  interface Window {
    turnEndMeasurement: Measurement;
  }
}

test.use({ baseURL: labOrigin, ignoreHTTPSErrors: true });
test.describe.configure({ mode: "parallel" });
for (const width of [1440, 390]) {
  for (const order of ["natural", "history-late"]) {
    test(`reply end stays put ${width} ${order}`, async ({ page }, info) => {
      test.setTimeout(90000);
      // Navigation uses the desktop rail; both turns run at the target width.
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.request.get("/fixture/conversations-reset");
      await page.request.get("/fixture/scenario?value=pi-deltas");
      await page.goto("/workspaces");
      await page.getByTestId("github-sign-in").click();
      await page
        .getByRole("link")
        .and(page.locator('a[href*="code=42"]'))
        .click();
      await page
        .getByRole("navigation")
        .getByTestId("workspace-aurinkokello")
        .click();
      await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
      await page.setViewportSize({ width, height: 900 });
      const input = page.getByTestId("message-input");
      const send = page
        .getByTestId("send")
        .and(page.locator('[data-mode="send"]'));
      const finals = page.locator(
        '[data-testid="stage-reply"][data-reply-role="final"]',
      );
      // A first turn, so the measured one ends in an established view with
      // earlier history above it.
      await input.fill("ensimmäinen vuoro");
      await send.click();
      await expect(page).toHaveURL(/conversation=pi:/);
      await expect(finals).toHaveCount(1, { timeout: 20000 });
      await expect(send).toBeVisible({ timeout: 10000 });
      // "hidas" makes the synthetic Pi pause 2 s between phases, so the
      // final reply is reliably caught while it streams.
      await input.fill("hidas toinen vuoro");
      await send.click();
      // The final reply streams after an interim reply in the same turn.
      const turns = page.getByTestId("agent-turn");
      await expect(turns).toHaveCount(2, { timeout: 30000 });
      const streaming = turns
        .nth(1)
        .locator('[data-testid="stage-reply"][data-reply-role="streaming"]');
      await expect(
        turns
          .nth(1)
          .locator('[data-testid="stage-reply"][data-reply-role="interim"]'),
      ).toHaveCount(1, { timeout: 30000 });
      await expect(streaming).toHaveCount(1, { timeout: 30000 });
      if (order === "history-late")
        // The saved reply arrives well after the status that ends the run.
        await page.route("**/api/v1/agents/*/history*", async (route) => {
          await new Promise((resolve) => setTimeout(resolve, 900));
          await route.continue().catch(() => {});
        });
      await streaming.evaluate((reply) => {
        const start = performance.now();
        const m: Measurement = {
          frames: [],
          shifts: [],
          removed: [],
          mounts: {},
          stop: () => {},
        };
        window.turnEndMeasurement = m;
        const describe = (n: Node | null | undefined) => {
          if (!(n instanceof Element)) return n?.nodeName ?? "detached";
          const id = n.getAttribute("data-testid");
          return id ? `#${id}` : `${n.nodeName}.${n.getAttribute("class")}`;
        };
        const recordShifts = (entries: PerformanceEntry[]) => {
          for (const entry of entries) {
            const e = entry as PerformanceEntry & {
              value: number;
              sources: { node?: Node }[];
            };
            m.shifts.push({
              t: e.startTime - start,
              value: e.value,
              sources: e.sources.map((s) => describe(s.node)),
            });
          }
        };
        const shifts = new PerformanceObserver((list) =>
          recordShifts(list.getEntries()),
        );
        shifts.observe({ type: "layout-shift" });
        // Any new element of these kinds after this point is a remount (or
        // a duplicate) of the reply or of the composer bar.
        const tracked = {
          reply: '[data-testid="stage-reply"]',
          message: ".ah-turn-reply > .ah-message",
          turn: '[data-testid="agent-turn"]',
          composer: ".ah-cbox",
          stack: ".ah-composer-stack",
          input: '[data-testid="message-input"]',
          send: '[data-testid="send"]',
          header: ".ah-agent-header",
          stream: '[data-testid="conversation-stream"]',
        };
        const seen = new WeakSet<Element>();
        const countMounts = (count: boolean) => {
          for (const [name, selector] of Object.entries(tracked)) {
            m.mounts[name] ??= 0;
            for (const node of document.querySelectorAll(selector))
              if (!seen.has(node)) {
                seen.add(node);
                if (count) m.mounts[name]++;
              }
          }
        };
        countMounts(false);
        const mutations = new MutationObserver((records) => {
          const t = performance.now() - start;
          for (const r of records)
            for (const n of r.removedNodes)
              if (
                n instanceof Element &&
                (n.getAttribute("data-testid") ||
                  n.querySelector("[data-testid]"))
              )
                m.removed.push({ t, what: describe(n) });
          countMounts(true);
        });
        mutations.observe(document.body, { childList: true, subtree: true });
        const rect = (e: Element | null | undefined): Rect => {
          if (!e) return null;
          const r = e.getBoundingClientRect();
          return [r.x, r.y, r.width, r.height].map(
            (v) => Math.round(v * 10) / 10,
          );
        };
        let raf = 0;
        let previous = "";
        const frame = () => {
          const state = {
            reply: rect(reply),
            role: reply.getAttribute("data-reply-role"),
            connected: reply.isConnected,
            composer: rect(document.querySelector(".ah-cbox")),
            mode:
              document
                .querySelector('[data-testid="send"]')
                ?.getAttribute("data-mode") ?? null,
            strip: !!reply
              .closest('[data-testid="agent-turn"]')
              ?.querySelector(".ah-turn-strip"),
          };
          const json = JSON.stringify(state);
          if (json !== previous)
            m.frames.push({
              t: Math.round(performance.now() - start),
              ...state,
            });
          previous = json;
          raf = requestAnimationFrame(frame);
        };
        frame();
        m.stop = () => {
          cancelAnimationFrame(raf);
          frame();
          cancelAnimationFrame(raf);
          recordShifts(shifts.takeRecords());
          shifts.disconnect();
          mutations.disconnect();
        };
      });
      await expect(finals).toHaveCount(2, { timeout: 30000 });
      await expect(send).toBeVisible({ timeout: 10000 });
      // Trailing history, snapshot and rail reads settle inside the window.
      await page.waitForTimeout(2000);
      const measurement = await page.evaluate(() => {
        const m = window.turnEndMeasurement;
        m.stop();
        return {
          frames: m.frames,
          shifts: m.shifts,
          removed: m.removed,
          mounts: m.mounts,
        };
      });
      writeFileSync(
        info.outputPath("measurement.json"),
        JSON.stringify(measurement, null, 2),
      );
      const { frames, mounts } = measurement;
      const shift = measurement.shifts.reduce((sum, s) => sum + s.value, 0);
      console.log(JSON.stringify({ width, order, shift, mounts }));
      // The streamed reply is the finished reply: same element, never
      // detached, and no other reply or composer element mounted.
      expect(frames.every((f) => f.connected)).toBe(true);
      expect(frames.at(-1)?.role).toBe("final");
      expect(mounts).toEqual({
        reply: 0,
        message: 0,
        turn: 0,
        composer: 0,
        stack: 0,
        input: 0,
        send: 0,
        header: 0,
        stream: 0,
      });
      // The turn ends once: the reply's final state, the working row and
      // Stop/Send switch in the same frame and never flip back.
      const ended = (f: Frame) => f.role === "final";
      expect(
        frames.every(
          (f) => ended(f) === (f.mode === "send") && ended(f) === !f.strip,
        ),
      ).toBe(true);
      const firstEnd = frames.findIndex(ended);
      expect(firstEnd).toBeGreaterThan(0);
      expect(frames.slice(firstEnd).every(ended)).toBe(true);
      // The finished reply does not move or resize when it is handed over.
      const before = frames[firstEnd - 1].reply as number[];
      const after = frames.slice(firstEnd).map((f) => f.reply as number[]);
      for (const r of after) {
        expect(Math.abs(r[1] - before[1])).toBeLessThan(1);
        expect(Math.abs(r[3] - before[3])).toBeLessThan(1);
      }
      const fieldYs = frames.map((f) => f.composer?.[1] ?? -1);
      expect(Math.max(...fieldYs) - Math.min(...fieldYs)).toBeLessThan(1);
      // Every shift counts, including those during the recent-input window.
      expect(shift).toBeLessThan(0.05);
    });
  }
}
