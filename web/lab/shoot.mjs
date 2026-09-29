#!/usr/bin/env node
// Run from repository root: PLAYWRIGHT_BROWSERS_PATH="$PWD/.cache/ms-playwright" node web/lab/shoot.mjs /workspaces .cache/lab/shots/workspaces.png [--narrow] [--bob]
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { openLab, origin } from "./session.mjs";
const [route, output, ...flags] = process.argv.slice(2);
if (
  !route ||
  !output ||
  !route.startsWith("/") ||
  !output.endsWith(".png") ||
  flags.some((f) => !["--narrow", "--bob"].includes(f))
) {
  console.error(
    "usage: node web/lab/shoot.mjs /route .cache/lab/shots/name.png [--narrow] [--bob]",
  );
  process.exit(2);
}
const file = resolve(output);
if (!file.startsWith(`${resolve(".cache/lab/shots")}/`)) {
  console.error("screenshots belong under .cache/lab/shots/");
  process.exit(2);
}
const { browser, page } = await openLab({
  identity: flags.includes("--bob") ? "bob" : "alice",
  width: flags.includes("--narrow") ? 390 : 1440,
});
try {
  await page.goto(`${origin}${route}`);
  await page.locator("main").waitFor();
  await mkdir(dirname(file), { recursive: true });
  await page.screenshot({ path: file, fullPage: true });
  console.log(file);
} finally {
  await browser.close();
}
