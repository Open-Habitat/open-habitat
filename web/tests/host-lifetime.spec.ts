import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import { hostOrigin, workerHostPort } from "../test-ports.mjs";

test.use({ baseURL: hostOrigin, ignoreHTTPSErrors: true });

function children(pid: number): number[] {
  return readdirSync("/proc").flatMap((entry) => {
    if (!/^\d+$/.test(entry)) return [];
    try {
      const stat = readFileSync(`/proc/${entry}/stat`, "utf8");
      const fields = stat
        .slice(stat.lastIndexOf(")") + 1)
        .trim()
        .split(/\s+/);
      const cmd = readFileSync(`/proc/${entry}/cmdline`, "utf8");
      return Number(fields[1]) === pid && cmd.includes("/synthetic/pi/")
        ? [Number(entry)]
        : [];
    } catch {
      return [];
    }
  });
}

function alive(pid: number): boolean {
  try {
    const stat = readFileSync(`/proc/${pid}/stat`, "utf8");
    return !["Z", "X"].includes(
      stat.slice(stat.lastIndexOf(")") + 2, -1).split(" ")[0],
    );
  } catch {
    return false;
  }
}

for (const target of ["launcher", "host"] as const) {
  test(`@host-lifetime SIGKILL of ${target} removes host and synthetic Pi`, async ({
    page,
  }, info) => {
    const binary = fileURLToPath(
      new URL("../../.cache/browser-host", import.meta.url),
    );
    const dist = fileURLToPath(new URL("../dist", import.meta.url));
    // Keep the launching process alive without depending on Playwright teardown.
    // The actual host starts its own Pi through the production controller below.
    const launcher = spawn(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        `
      import { spawn } from 'node:child_process';
      const child = spawn(${JSON.stringify(binary)}, [${JSON.stringify(dist)}], {
        env: {...process.env, BROWSER_HOST_OWNER_PID: String(process.pid)},
        stdio: ['ignore', 'inherit', 'inherit']
      });
      console.log('HOST_PID ' + child.pid);
      setInterval(() => {}, 1000);
    `,
      ],
      {
        env: {
          ...process.env,
          BROWSER_HOST_PORT: String(workerHostPort(info.parallelIndex)),
          BROWSER_HOST_MARKER: fileURLToPath(
            new URL(
              `../test-results/browser-host-marker-${createHash("sha256").update(info.testId).digest("hex").slice(0, 16)}`,
              import.meta.url,
            ),
          ),
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    let output = "";
    let host = 0;
    let pi: number[] = [];
    launcher.stdout.on("data", (data) => {
      output += data.toString();
    });
    launcher.stderr.on("data", (data) => {
      output += data.toString();
    });
    try {
      await expect
        .poll(() => output, { timeout: 30000 })
        .toContain("BROWSER_HOST_READY");
      host = Number(/HOST_PID (\d+)/.exec(output)?.[1]);
      expect(host).toBeGreaterThan(1);
      await page.goto("/workspaces");
      await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
      await page.getByRole("link", { name: "Alice", exact: true }).click();
      await page
        .getByRole("navigation")
        .getByRole("link", { name: "ordinary-dir" })
        .click();
      await page
        .getByRole("button", { name: "Aloita uusi agenttikeskustelu" })
        .click();
      await page
        .getByRole("textbox", { name: "Viesti agentille" })
        .fill("hidas lifetime test");
      await page.getByRole("button", { name: "Lähetä", exact: true }).click();
      await expect
        .poll(() => {
          pi = children(host);
          return pi.length;
        })
        .toBeGreaterThan(0);
      if (target === "launcher") launcher.kill("SIGKILL");
      else process.kill(host, "SIGKILL");
      await expect
        .poll(() => [host, ...pi].filter(alive), { timeout: 5000 })
        .toEqual([]);
    } finally {
      launcher.kill("SIGKILL");
      for (const pid of [host, ...pi]) {
        if (pid > 1 && alive(pid)) process.kill(pid, "SIGKILL");
      }
    }
  });
}
