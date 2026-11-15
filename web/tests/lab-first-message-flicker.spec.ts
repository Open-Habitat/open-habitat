import { writeFileSync } from "node:fs";
import { snapshot } from "../lab/session.mjs";
import { labOrigin } from "../test-ports.mjs";
import { expect, test } from "./lab-host";

type Shift = PerformanceEntry & {
  value: number;
  hadRecentInput: boolean;
  sources: {
    node?: Element;
    previousRect: DOMRectReadOnly;
    currentRect: DOMRectReadOnly;
  }[];
};
type Frame = {
  t: number;
  route: string;
  composer: number[] | null;
  users: (number[] | null)[];
  empty: boolean;
  loading: boolean;
};
type Measurement = {
  frames: Frame[];
  shifts: {
    t: number;
    value: number;
    recentInput: boolean;
    sources: string[];
  }[];
  mounts: number;
  stop: () => void;
};
declare global {
  interface Window {
    firstMessageMeasurement: Measurement;
  }
}

test.use({ baseURL: labOrigin, ignoreHTTPSErrors: true });
for (const width of [1440, 390]) {
  for (const phase of ["creating", "opened"]) {
    test(`first message layout ${width} ${phase}`, async ({ page }, info) => {
      // Navigation uses the desktop rail; the entire send runs at the target width.
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.request.get("/fixture/conversations-reset");
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
      let release!: () => void;
      const held = new Promise<void>((resolve) => {
        release = resolve;
      });
      await page.route("**/api/v1/conversations", async (route) => {
        if (route.request().method() === "POST") await held;
        await route.continue();
      });
      try {
        await page
          .getByTestId(/^(new-conversation|conversation-start)$/)
          .click();
        await page.setViewportSize({ width, height: 900 });
        if (phase === "opened") {
          release();
          await expect(page).toHaveURL(/conversation=pi:/);
        }
        const input = page.getByTestId("message-input");
        await input.fill("Synthetic first message");
        await expect(
          page.getByTestId("send").and(page.locator('[data-mode="send"]')),
        ).toBeEnabled();
        await page.evaluate(() => {
          const start = performance.now();
          const m: Measurement = {
            frames: [],
            shifts: [],
            mounts: 0,
            stop: () => {},
          };
          window.firstMessageMeasurement = m;
          const recordShifts = (entries: PerformanceEntry[]) => {
            for (const entry of entries) {
              const e = entry as Shift;
              m.shifts.push({
                t: e.startTime - start,
                value: e.value,
                recentInput: e.hadRecentInput,
                sources: e.sources.map(
                  (s) =>
                    s.node?.getAttribute?.("class") ??
                    s.node?.nodeName ??
                    "detached",
                ),
              });
            }
          };
          const shifts = new PerformanceObserver((list) =>
            recordShifts(list.getEntries()),
          );
          shifts.observe({ type: "layout-shift" });
          const seen = new WeakSet<Element>();
          const countMounts = () => {
            for (const node of document.querySelectorAll(
              '[data-testid="user-content"]',
            )) {
              if (!seen.has(node)) {
                seen.add(node);
                m.mounts++;
              }
            }
          };
          // Mutation observation also catches replacements between animation frames.
          const mutations = new MutationObserver(countMounts);
          mutations.observe(
            document.querySelector(".ah-conversation-frame") as Element,
            { childList: true, subtree: true },
          );
          let raf = 0;
          let previous = "";
          const rect = (e: Element | null) => {
            if (!e) return null;
            const r = e.getBoundingClientRect();
            return [r.x, r.y, r.width, r.height];
          };
          const frame = () => {
            countMounts();
            const state = {
              route: location.search,
              composer: rect(document.querySelector(".ah-cbox")),
              users: [
                ...document.querySelectorAll('[data-testid="user-content"]'),
              ].map(rect),
              empty: !!document.querySelector(
                '[data-testid="conversation-empty"]',
              ),
              loading: !!document.querySelector(
                '[data-testid="conversation-loading"]',
              ),
            };
            const json = JSON.stringify(state);
            if (json !== previous)
              m.frames.push({ t: performance.now() - start, ...state });
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
        const frame = await page
          .locator(".ah-conversation-frame")
          .elementHandle();
        const stream = await page
          .getByTestId("conversation-stream")
          .elementHandle();
        const field = await input.elementHandle();
        await input.press("Enter");
        if (phase === "creating") {
          await expect(page.getByTestId("waiting-message")).toBeVisible();
          release();
        }
        // Include the native-history takeover and first readable reply, not
        // merely the earlier working indicator.
        await expect(page.getByTestId("stage-reply").last()).toBeVisible({
          timeout: 20000,
        });
        const measurement = await page.evaluate(() => {
          const m = window.firstMessageMeasurement;
          m.stop();
          return { frames: m.frames, shifts: m.shifts, mounts: m.mounts };
        });
        writeFileSync(
          info.outputPath("measurement.json"),
          JSON.stringify(measurement, null, 2),
        );
        await info.attach("measurement", {
          body: JSON.stringify(measurement),
          contentType: "application/json",
        });
        await snapshot(page, info.outputPath("first-reply"), { labOrigin });
        expect(await frame?.evaluate((e) => e.isConnected)).toBe(true);
        expect(await stream?.evaluate((e) => e.isConnected)).toBe(true);
        expect(await field?.evaluate((e) => e.isConnected)).toBe(true);
        expect(measurement.mounts).toBe(1);
        const first = measurement.frames.findIndex((f) => f.users.length > 0);
        expect(first).toBeGreaterThanOrEqual(0);
        const sent = measurement.frames.slice(first);
        expect(
          sent.every((f) => f.users.length === 1 && !f.empty && !f.loading),
        ).toBe(true);
        const ys = sent.map((f) => f.users[0]?.[1] ?? -1);
        expect(Math.max(...ys) - Math.min(...ys)).toBeLessThan(1);
        const fieldYs = measurement.frames.map((f) => f.composer?.[1] ?? -1);
        expect(Math.max(...fieldYs) - Math.min(...fieldYs)).toBeLessThan(1);
        // Stricter than web-vital CLS: count shifts even during the 500ms
        // recent-input exemption, where the original flicker often hid.
        const shift = measurement.shifts.reduce((sum, s) => sum + s.value, 0);
        expect(shift).toBeLessThan(0.05);
        console.log(
          JSON.stringify({ width, phase, mounts: measurement.mounts, shift }),
        );
      } finally {
        release();
      }
    });
  }
}
