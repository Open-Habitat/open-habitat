#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
// Deterministic synthetic host dialog paired with the design’s working-view composition.
import { chromium } from "@playwright/test";
import { openLab, origin, snapshot } from "./session.mjs";

const root = resolve("issues/show-pi-dialogs/pairs");
await mkdir(root, { recursive: true });
const drafts = resolve("design-system/drafts");
const fonts = (
  await Promise.all(
    [
      ["Instrument Sans", "instrument-sans-latin.woff2"],
      ["JetBrains Mono", "jetbrains-mono-latin.woff2"],
    ].map(
      async ([family, file]) =>
        `@font-face{font-family:'${family}';src:url(data:font/woff2;base64,${(await readFile(resolve("design-system/fonts", file))).toString("base64")}) format('woff2');font-weight:400 600}`,
    ),
  )
).join("\n");
const browser = await chromium.launch();
try {
  const reference = await browser.newContext({
    serviceWorkers: "block",
    viewport: { width: 1500, height: 960 },
  });
  await reference.route("https://fonts.googleapis.com/**", (route) =>
    route.fulfill({ contentType: "text/css", body: fonts }),
  );
  const draft = await reference.newPage();
  for (const width of [1440, 390])
    for (const theme of ["light", "dark"]) {
      const key = `${theme}-${width}`;
      await draft.goto(
        pathToFileURL(
          resolve(
            drafts,
            width === 390 ? "Puhelin.dc.html" : "Selainpolku.dc.html",
          ),
        ).href,
      );
      await draft.waitForFunction(
        () => typeof window.__dcSetProps === "function",
      );
      const name = await draft.evaluate(() => window.__dcRootName());
      await draft.evaluate(
        ({ name, theme }) => window.__dcSetProps(name, { theme }),
        { name, theme },
      );
      if (width === 1440)
        await draft
          .getByRole("button", { name: "Työskentelee + jono", exact: true })
          .first()
          .click();
      await draft.evaluate(() => document.fonts.ready);
      const target =
        width === 390
          ? draft
              .locator(
                '#dc-root [style*="width: 390px"][style*="height: 844px"]',
              )
              .nth(3)
          : draft
              .locator(
                '#dc-root [style*="width: 1440px"][style*="height: 900px"]',
              )
              .first();
      await target.screenshot({
        path: `${root}/${key}-draft.png`,
        animations: "disabled",
      });
      await writeFile(
        `${root}/${key}-draft.html`,
        await readFile(
          resolve(
            drafts,
            width === 390 ? "Puhelin.dc.html" : "Selainpolku.dc.html",
          ),
        ),
      );

      const {
        browser: labBrowser,
        page,
        context,
      } = await openLab({ width, height: width === 390 ? 844 : 900 });
      try {
        await page.evaluate(
          (theme) => localStorage.setItem("nah:theme", theme),
          theme,
        );
        await page.reload();
        const fixtures = [
          "scenario?value=ready",
          "pi-state?value=usable",
          "conversations-reset",
          "lab-conversations-clean",
        ];
        for (const fixture of fixtures) {
          const response = await page.request.get(
            `${origin}/fixture/${fixture}`,
          );
          if (response.status() !== 204)
            throw new Error(`${fixture}: ${response.status()}`);
        }
        await page.goto(`${origin}/workspaces`);
        const snapshotData = await (
          await page.request.get(`${origin}/api/v1/snapshot`)
        ).json();
        const workspace = snapshotData.workspaces.find(
          (item) => item.name === "aurinkokello",
        );
        if (!workspace) throw new Error("Missing synthetic workspace");
        await page.goto(`${origin}/workspaces/${workspace.workspace_id}`);
        await page
          .getByRole("button", { name: "Aloita uusi Pi-keskustelu" })
          .click();
        const editor = page.getByRole("textbox", { name: "Viesti Pi:lle" });
        await editor.waitFor();
        await page.request.get(
          `${origin}/fixture/scenario?value=pi-visual-hold`,
        );
        await page.reload();
        await editor.waitFor();
        await editor.fill(
          "Tarkista etusivun saavutettavuus ja korjaa mobiilinavigaatio.",
        );
        await page.getByRole("button", { name: "Lähetä", exact: true }).click();
        await page.getByRole("button", { name: "Ohjaa" }).waitFor();
        await editor.fill("Aja lopuksi Lighthouse mobiiliprofiililla.");
        await page.getByRole("button", { name: "Lähetä", exact: true }).click();
        await editor.fill("Älä muuta footerin rakennetta.");
        await page.getByRole("button", { name: "Ohjaa" }).click();
        await page
          .locator(".ah-queue")
          .getByText("Älä muuta footerin rakennetta.")
          .waitFor();
        await page.waitForFunction(
          async (url) => (await fetch(url)).status === 204,
          `${origin}/fixture/pi-visual-ready`,
          { timeout: 20000 },
        );
        await page.locator(".ah-live-tool-row").first().waitFor();
        let answered = false;
        await page.route(
          "**/api/v1/conversations/*/question",
          async (route) => {
            if (width !== 1440 || theme !== "light")
              throw new Error("Unexpected dialog write");
            const body = route.request().postDataJSON();
            if (
              body.request_id !== `visual-${key}` ||
              body.action !== "answer" ||
              body.value !== true
            )
              throw new Error("Unexpected dialog payload");
            answered = true;
            await route.fulfill({
              status: 200,
              contentType: "application/json",
              body: JSON.stringify({
                schema_version: 1,
                request_id: body.request_id,
                state: "uncertain",
              }),
            });
          },
        );
        await page.route("**/api/v1/conversations/*/status", async (route) => {
          const response = await route.fetch();
          const body = await response.json();
          body.pending_question = answered
            ? null
            : {
                request_id: `visual-${key}`,
                question_kind: "confirm",
                prompt: "Jatketaanko tarkistusta?",
                choices: [],
              };
          await route.fulfill({ response, json: body });
        });
        await page.reload();
        await page.getByRole("region", { name: "Pi:n kysymys" }).waitFor();
        await snapshot(page, `${root}/${key}-lab`);
        if (width === 1440 && theme === "light") {
          await page
            .getByRole("region", { name: "Pi:n kysymys" })
            .getByRole("button", { name: "Kyllä" })
            .click();
          await page.getByText(/Ei tiedossa, käsittelikö Pi pyynnön/).waitFor();
          await snapshot(page, `${root}/${key}-answered-lab`);
        }
      } finally {
        await context.close();
        await labBrowser.close();
      }
    }
} finally {
  await browser.close();
}
