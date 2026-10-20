import { execFileSync } from "node:child_process";
import { unlink } from "node:fs/promises";
import { chromium } from "@playwright/test";
import { snapshot } from "./session.mjs";
const origin = "https://127.0.0.1:15375";
const phase = process.argv[2];
const browser = await chromium.launch();
const page = await browser.newPage({
  ignoreHTTPSErrors: true,
  viewport: { width: 1440, height: 1000 },
});
try {
  await page.request.get(`${origin}/fixture/scenario?value=pi-onboarding`);
  await page.request.get(`${origin}/fixture/pi-state?value=missing`);
  await page.request.get(`${origin}/fixture/profile-missing-email`);
  await page.goto(`${origin}/workspaces`);
  await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
  await page.getByRole("link", { name: "Alice", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Sähköposti", exact: true })
    .fill("typed@example.invalid");
  await page.getByRole("button", { name: "Jatka", exact: true }).click();
  await page
    .getByRole("button", { name: "Vahvista Git-identiteetti" })
    .waitFor();
  const capture = async (name) => {
    const out = `issues/onboarding-ville-findings/${phase}-${name}`;
    await snapshot(page, out, { labOrigin: origin });
    execFileSync("avifenc", [
      "-j",
      "2",
      "-s",
      "8",
      "-q",
      "90",
      `${out}.png`,
      `${out}.avif`,
    ]);
    await unlink(`${out}.png`);
  };
  await capture("identity");
  await page.getByRole("button", { name: "Vahvista Git-identiteetti" }).click();
  await page
    .getByRole("heading", { name: "Valitse GitHub-repot haettaviksi" })
    .waitFor();
  await capture("repos");
  if (phase === "after") {
    await page.emulateMedia({ colorScheme: "dark" });
    await capture("repos-dark");
    await page.setViewportSize({ width: 390, height: 844 });
    await capture("repos-phone-dark");
    await page.emulateMedia({ colorScheme: "light" });
    await capture("repos-phone");
    await page.setViewportSize({ width: 1440, height: 1000 });
  }
  await page.request.get(`${origin}/fixture/clone?mode=hold`);
  await page
    .getByRole("list", { name: "GitHub-repot" })
    .getByRole("checkbox")
    .first()
    .check();
  await page.getByRole("button", { name: "Hae 1 repo ja jatka" }).click();
  await page
    .getByText(/120|125|829/)
    .first()
    .waitFor();
  await capture("progress");
} finally {
  await page.request.get(`${origin}/fixture/clone?mode=release`);
  await browser.close();
}
