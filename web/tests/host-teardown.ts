import { readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import type { FullConfig } from "@playwright/test";

// The binary's lifetime watchdog ends hosts/Pi even after worker SIGKILL.
// Forced host termination skips Go defers; reclaim any private temp trees left.
// Never follow arbitrary marker contents or remove another user's directory.
// Markers live in each project's output directory (tests/worker-host.ts), so
// this run never touches the hosts of the other suite running beside it.
export default function teardown(config: FullConfig) {
  for (const results of new Set(config.projects.map((p) => p.outputDir)))
    reclaim(results);
}

function reclaim(results: string) {
  let names: string[];
  try {
    names = readdirSync(results).filter((name) =>
      /^browser-host-marker-[0-9a-f]{16}$/.test(name),
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw error;
  }
  for (const name of names) {
    const marker = `${results}/${name}`;
    const path = readFileSync(marker, "utf8");
    if (/^\/tmp\/oh-browser-[0-9]+$/.test(path)) {
      try {
        const stat = statSync(path);
        if (stat.isDirectory() && stat.uid === process.getuid?.())
          rmSync(path, { recursive: true, force: true });
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
    }
    rmSync(marker, { force: true });
  }
}
