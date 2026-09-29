// Synthetic lab only. Never reuse a personal browser profile or real Chrome.
import { chromium } from "@playwright/test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { labOrigin } from "../test-ports.mjs";

const portFile = fileURLToPath(
  new URL("../../.cache/lab/port", import.meta.url),
);
let port;
try {
  port = readFileSync(portFile, "utf8").trim();
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
if (port && (!/^[0-9]+$/.test(port) || +port < 1024 || +port > 65535))
  throw new Error("Invalid lab port in .cache/lab/port");
export const origin = port ? `https://127.0.0.1:${port}` : labOrigin;
export async function openLab({
  identity = "alice",
  width = 1440,
  height = 900,
} = {}) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: { width, height },
  });
  const page = await context.newPage();
  await page.goto(`${origin}/workspaces`);
  await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
  await page
    .getByRole("link", {
      name: identity === "bob" ? "Bob" : "Alice",
      exact: true,
    })
    .click();
  return { browser, context, page };
}
