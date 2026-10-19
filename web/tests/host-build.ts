import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export default function buildHost() {
  const repo = fileURLToPath(new URL("../../", import.meta.url));
  const web = fileURLToPath(new URL("../", import.meta.url));
  if (process.env.OH_WEB_PREBUILT !== "1")
    execFileSync("npm", ["run", "build"], { cwd: web, stdio: "inherit" });
  // Build the lifetime guard into every host (including standalone/remote runs).
  execFileSync(
    "go",
    ["build", "-o", ".cache/browser-host", "./test/browser-host"],
    {
      cwd: repo,
      stdio: "inherit",
      env: {
        ...process.env,
        PATH: `${repo}/.tools/go/bin:${process.env.PATH}`,
      },
    },
  );
}
