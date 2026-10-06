import { readFileSync, rmSync, statSync } from "node:fs";
import { resolve } from "node:path";

// Playwright may hard-kill its webServer process; clean only the exact
// private directory this run's standalone fixture recorded.
export default function teardown() {
  const marker = resolve("test-results/browser-host-path");
  try {
    const path = readFileSync(marker, "utf8");
    if (/^\/tmp\/oh-browser-[0-9]+$/.test(path)) {
      const stat = statSync(path);
      if (stat.isDirectory() && stat.uid === process.getuid?.())
        rmSync(path, { recursive: true, force: true });
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  rmSync(marker, { force: true });
}
