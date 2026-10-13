import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { test as base } from "@playwright/test";
import { workerHostPort } from "../test-ports.mjs";
export { expect } from "@playwright/test";
export type { Page, Locator } from "@playwright/test";

// Auto worker fixture also covers specs that only use a page, not a host URL.
// Starting a separate process gives every slot private scenario, clock, sessions,
// fake Pi state, Unix sockets and invented homes. No cross-worker reset exists.
export const test = base.extend<object, { hostProcess: undefined }>({
  hostProcess: [
    async ({ browserName }, use, workerInfo) => {
      if (browserName !== "chromium")
        throw new Error("Synthetic host requires Chromium");
      const port = workerHostPort(workerInfo.parallelIndex);
      if (port > 65535)
        throw new Error(`Worker host port ${port} is out of range`);
      const child = spawn(
        resolve("../.cache/browser-host"),
        [resolve("dist")],
        {
          env: { ...process.env, BROWSER_HOST_PORT: String(port) },
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
        child.kill("SIGTERM");
        if (child.exitCode === null && child.signalCode === null)
          await new Promise<void>((done) => {
            const timer = setTimeout(() => {
              child.kill("SIGKILL");
              done();
            }, 5000);
            child.once("exit", () => {
              clearTimeout(timer);
              done();
            });
          });
      }
    },
    { scope: "worker", auto: true },
  ],
});
