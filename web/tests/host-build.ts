import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

// The synthetic host reads credentials and recap settings through the pinned
// Pi SDK (test/browser-host/main.go). Without it those reads fail at run time
// and unrelated specs report "unknown" credentials or unsaved settings.
const piSdk =
  "internal/daemon/pi-device-test/node_modules/@earendil-works/pi-coding-agent/dist/index.js";

export default function buildHost() {
  const repo = fileURLToPath(new URL("../../", import.meta.url));
  const web = fileURLToPath(new URL("../", import.meta.url));
  if (!existsSync(repo + piSdk))
    throw new Error(
      `Pi SDK fixture missing (${piSdk}); run: npm ci --prefix internal/daemon/pi-device-test --ignore-scripts`,
    );
  if (process.env.OH_WEB_PREBUILT !== "1")
    execFileSync("npm", ["run", "build"], { cwd: web, stdio: "inherit" });
  // Build the lifetime guard into every host (including standalone/remote runs).
  // The gate builds it once and runs both suites at once; a second build
  // would replace the binary under the other suite's running hosts.
  if (process.env.OH_BROWSER_HOST_PREBUILT === "1") return;
  execFileSync(
    "go",
    ["build", "-o", ".cache/browser-host", "./test/browser-host"],
    {
      cwd: repo,
      stdio: "inherit",
    },
  );
}
