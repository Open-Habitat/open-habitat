#!/usr/bin/env node
// Invented lab content and local design draft only; no live host or personal profile.
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { openLab, origin, snapshot } from "./session.mjs";

const { browser, page } = await openLab();
const draft = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const draftUrl = pathToFileURL(
  resolve("design-system/drafts/Agentin vuoro.proto.html"),
).href;
const longCommand = `find /synthetic/${"long-command/".repeat(18)} -type f`;
const longPath = `/synthetic/${"deep-directory/".repeat(18)}file.txt`;
const states = {
  command: longCommand,
  multiline: "printf '%s' first-line",
  path: longPath,
};
async function capture(page, base, region) {
  await snapshot(page, base, { region });
  const file = `${base}.html`;
  await writeFile(
    file,
    (await readFile(file, "utf8")).replace(/[ \t]+$/gm, ""),
  );
}
const fieldStates = {
  empty: "",
  one: "Yksi rivi",
  several: Array.from(
    { length: 8 },
    (_, i) => `Synteettinen rivi ${i + 1}`,
  ).join("\n"),
};
try {
  const workspace = await page
    .getByRole("navigation", { name: "Työtilat ja keskustelut" })
    .getByRole("link", { name: "aurinkokello", exact: true })
    .first()
    .getAttribute("href");
  if (!workspace) throw Error("Missing synthetic workspace");
  const reply = await page.request.get(
    `${origin}/fixture/scenario?value=ready`,
  );
  if (reply.status() !== 204) throw Error(`Fixture setup: ${reply.status()}`);
  await page.goto(`${origin}${workspace}`);
  await page.getByRole("button", { name: "Aloita uusi Pi-keskustelu" }).click();
  await page
    .getByRole("textbox", { name: "Viesti Pi:lle" })
    .fill("Tutki synteettinen työtila");
  await page.getByRole("button", { name: "Lähetä", exact: true }).click();
  await page
    .getByText(/Selvä. Kysyit:/)
    .last()
    .waitFor({ timeout: 30000 });
  await draft.goto(draftUrl);
  const draftTool = draft.locator('.disc:has(.name:text-is("bash"))').first();
  await draftTool.waitFor();
  for (const width of [1440, 390])
    for (const theme of ["light", "dark"]) {
      await page.setViewportSize({ width, height: 900 });
      await draft.setViewportSize({ width, height: 900 });
      await page.evaluate(
        (value) => document.documentElement.setAttribute("data-theme", value),
        theme,
      );
      await draft.evaluate(
        (value) => document.documentElement.setAttribute("data-theme", value),
        theme,
      );
      const prefix = `${width}-${theme}`;
      const row = page.locator(".ah-tool-row").first();
      await row.waitFor();
      const toggle = row.locator("button").first();
      if ((await toggle.getAttribute("aria-expanded")) === "true")
        await toggle.click();
      for (const [state, target] of Object.entries(states)) {
        await row.evaluate((node, text) => {
          const names = node.querySelector(".ah-tool-names");
          let code = names.querySelector(".ah-tool-target");
          if (!code) {
            code = document.createElement("code");
            code.className = "ah-tool-target";
            names.append(code);
          }
          code.textContent = text;
        }, target);
        await draftTool.locator(".target").evaluate((node, text) => {
          node.textContent = text;
        }, target);
        await capture(
          page,
          `issues/tool-row-ellipsis/lab-${prefix}-${state}`,
          ".ah-tool-row",
        );
        await draftTool.screenshot({
          path: `issues/tool-row-ellipsis/draft-${prefix}-${state}.png`,
        });
      }
      for (const [state, text] of Object.entries(fieldStates)) {
        await page.getByRole("textbox", { name: "Viesti Pi:lle" }).fill(text);
        await draft.locator(".composer textarea").first().fill(text);
        await draft
          .locator(".composer textarea")
          .first()
          .evaluate((node) => {
            node.style.height = "auto";
            node.style.height = `${node.scrollHeight + 2}px`;
          });
        await draft.locator(".composer .c-tools").evaluate((node) => {
          node.style.setProperty("display", "none", "important");
        });
        await capture(
          page,
          `issues/composer-text-centering/lab-${prefix}-${state}`,
          ".ah-composer-entry",
        );
        await draft
          .locator(".composer .cwrap")
          .first()
          .screenshot({
            path: `issues/composer-text-centering/draft-${prefix}-${state}.png`,
          });
      }
    }
} finally {
  await draft.close();
  await browser.close();
}
