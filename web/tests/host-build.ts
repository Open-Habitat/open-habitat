import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

export default function buildHost() {
  const repo = resolve("..");
  if (process.env.OH_WEB_PREBUILT !== "1")
    execFileSync("npm", ["run", "build"], { stdio: "inherit" });
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
