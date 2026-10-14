import { readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";

// A worker killed before its fixture cleanup can leave its private host tree.
// Never follow arbitrary marker contents or remove another user's directory.
export function teardown(lab = false) {
  const results = fileURLToPath(
    new URL(lab ? "../test-results-lab/" : "../test-results/", import.meta.url),
  );
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

export default teardown;
