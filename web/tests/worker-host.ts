import { spawn } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test as base } from "@playwright/test";
import { labWorkerHostPort, workerHostPort } from "../test-ports.mjs";

export type { Locator, Page } from "@playwright/test";
export { expect } from "@playwright/test";

// Auto fixture covers specs that only use a page, not a host URL. One host
// per case avoids fixture leakage between consecutive cases on the same slot.
// Every live slot has a private scenario, clock, session, fake Pi and home.
export function createHostTest(
  lab = false,
  extraEnv: Record<string, string> = {},
) {
  return base.extend<{ hostProcess: undefined }>({
    // A route handler still between route.fetch() and its body when the
    // case ends (a poll that fired after the last assertion) would read a
    // response the closing context has disposed and fail a passing case.
    // Unrouting before the context closes lets late requests through; a
    // handler's error during the case itself still fails it.
    page: async ({ page }, use) => {
      const rate = Number(process.env.OH_CPU_THROTTLE ?? 1);
      if (!Number.isFinite(rate) || rate < 1)
        throw new Error("Invalid OH_CPU_THROTTLE");
      if (rate > 1) {
        const cdp = await page.context().newCDPSession(page);
        await cdp.send("Emulation.setCPUThrottlingRate", { rate });
      }
      await use(page);
      await page.unrouteAll({ behavior: "ignoreErrors" });
    },
    browser: [
      async ({ browser }, use) => {
        const original = browser.newContext.bind(browser);
        browser.newContext = async (...args) => {
          const context = await original(...args);
          const newPage = context.newPage.bind(context);
          context.newPage = async () => {
            const page = await newPage();
            const rate = Number(process.env.OH_CPU_THROTTLE ?? 1);
            if (!Number.isFinite(rate) || rate < 1)
              throw new Error("Invalid OH_CPU_THROTTLE");
            if (rate > 1) {
              const cdp = await context.newCDPSession(page);
              await cdp.send("Emulation.setCPUThrottlingRate", { rate });
            }
            return page;
          };
          return context;
        };
        try {
          await use(browser);
        } finally {
          browser.newContext = original;
        }
      },
      { scope: "worker" },
    ],
    hostProcess: [
      async ({ browserName }, use, testInfo) => {
        if (browserName !== "chromium")
          throw new Error("Synthetic host requires Chromium");
        const port = (lab ? labWorkerHostPort : workerHostPort)(
          testInfo.parallelIndex,
        );
        if (port > 65535)
          throw new Error(`Worker host port ${port} is out of range`);
        // In this config's own output directory: the ordinary and lab suites
        // run at the same time, and each teardown reclaims only its markers.
        const marker = join(
          testInfo.project.outputDir,
          `browser-host-marker-${createHash("sha256").update(`${testInfo.testId}:${testInfo.retry}`).digest("hex").slice(0, 16)}`,
        );
        const replySeed =
          process.env.OH_REPLY_SEED ?? randomBytes(8).toString("hex");
        const child = spawn(
          fileURLToPath(new URL("../../.cache/browser-host", import.meta.url)),
          [fileURLToPath(new URL("../dist", import.meta.url))],
          {
            env: {
              ...process.env,
              BROWSER_HOST_OWNER_PID: String(process.pid),
              BROWSER_HOST_LAB: lab ? "1" : "0",
              BROWSER_HOST_PORT: String(port),
              BROWSER_HOST_MARKER: marker,
              ...extraEnv,
              OH_REPLY_SEED: replySeed,
            },
            stdio: ["ignore", "pipe", "pipe"],
          },
        );
        let errors = "";
        child.stderr?.on("data", (chunk: Buffer) => {
          errors = (errors + chunk.toString()).slice(-2000);
        });
        try {
          await new Promise<void>((done, fail) => {
            const timer = setTimeout(
              () => fail(new Error(`Host readiness timeout: ${errors}`)),
              30000,
            );
            const ready = (chunk: Buffer) => {
              if (chunk.toString().includes("BROWSER_HOST_READY")) {
                clearTimeout(timer);
                done();
              }
            };
            child.stdout?.on("data", ready);
            child.once("error", (e) => {
              clearTimeout(timer);
              fail(e);
            });
            child.once("exit", (code) => {
              clearTimeout(timer);
              fail(new Error(`Host exited ${code}: ${errors}`));
            });
          });
          await use(undefined);
        } finally {
          if (testInfo.status !== testInfo.expectedStatus) {
            console.error(
              `Replay jitter: OH_REPLY_SEED=${replySeed} OH_REPLY_DELAY_MS=${process.env.OH_REPLY_DELAY_MS ?? 0}`,
            );
          }
          child.kill("SIGTERM");
          if (child.exitCode === null && child.signalCode === null)
            await new Promise<void>((done) => {
              const timer = setTimeout(() => child.kill("SIGKILL"), 5000);
              child.once("exit", () => {
                clearTimeout(timer);
                done();
              });
            });
        }
      },
      { auto: true, timeout: 60_000 },
    ],
  });
}

export const test = createHostTest();
