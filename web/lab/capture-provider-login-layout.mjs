import { chromium } from "@playwright/test";
import { snapshot } from "./session.mjs";
import { execFileSync } from "node:child_process";
import { unlink } from "node:fs/promises";

const phase = process.argv[2];
if (!["before", "after"].includes(phase))
  throw Error("Expected before or after");
const origin = process.env.PROVIDER_LAB_ORIGIN ?? "https://127.0.0.1:16471";
const browser = await chromium.launch();
try {
  for (const provider of ["openai", "claude"]) {
    const page = await browser.newPage({ ignoreHTTPSErrors: true });
    // The lab has no Claude runtime. Supply only synthetic provider replies;
    // the production component and all layout/styles still run unchanged.
    await page.route("**/api/v1/pi/claude-login", (route) =>
      route.fulfill({
        json: {
          schema_version: 1,
          state: "code",
          attempt_id: "20261020T120000.000000000",
          verification_uri:
            "https://claude.com/cai/oauth/authorize?synthetic=1",
        },
      }),
    );
    await page.request.get(`${origin}/fixture/scenario?value=pi-onboarding`);
    await page.request.get(`${origin}/fixture/pi-state?value=missing`);
    await page.goto(`${origin}/workspaces`);
    await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
    await page.getByRole("link", { name: "Alice", exact: true }).click();
    await page
      .getByRole("button", { name: /Vahvista Git-identiteetti|Jatka repoihin/ })
      .click();
    await page.getByRole("button", { name: /jatka/i }).click();
    if (phase === "after" && provider === "claude")
      await page
        .getByRole("button", { name: "Claude-tilaus", exact: true })
        .click();
    if (provider === "openai") {
      await page
        .getByRole("button", { name: "Aloita kirjautuminen", exact: true })
        .click();
      await page.getByText("ABCD-1234").waitFor();
    } else await page.getByLabel(/Clauden palauttama koodi/).waitFor();
    for (const [size, width, height] of [
      ["desktop", 1440, 1000],
      ["phone", 390, 844],
    ]) {
      await page.setViewportSize({ width, height });
      for (const theme of ["light", "dark"]) {
        await page.emulateMedia({
          colorScheme: theme,
          reducedMotion: "reduce",
        });
        const out = `issues/provider-login-layout/${phase}-${provider}-${size}-${theme}`;
        await snapshot(page, out, { labOrigin: origin });
        execFileSync(
          "avifenc",
          ["-j", "2", "-s", "8", "-q", "80", `${out}.png`, `${out}.avif`],
          { stdio: "ignore" },
        );
        await unlink(`${out}.png`);
      }
    }
    await page.close();
  }
} finally {
  await browser.close();
}
