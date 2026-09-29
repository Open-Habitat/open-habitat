// Synthetic lab only. Never reuse a personal browser profile or real Chrome.
import { chromium } from "@playwright/test";

export const origin = "https://127.0.0.1:4175";
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
