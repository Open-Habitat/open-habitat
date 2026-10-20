// Temporary prototype evidence, retained with the open design round.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";

const repo = resolve(import.meta.dirname, "../..");
const output = resolve(tmpdir(), `bash-context-${process.pid}.html`);
execFileSync(
  process.execPath,
  [
    "design-system/prototypes/build.mjs",
    "design-system/prototypes/rounds/2026-10-20-bash-runs-context",
    "--out",
    output,
  ],
  { cwd: repo },
);
const html = readFileSync(output, "utf8");

for (const width of [1440, 1366, 390]) {
  for (const theme of ["light", "dark"]) {
    test(`bash prototype ${width} ${theme}: output, refusal and stop confirmation`, async ({
      page,
    }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
      });
      await page.setViewportSize({ width, height: 1000 });
      await page.route("http://prototype.test/**", (route) =>
        route.fulfill({ contentType: "text/html", body: html }),
      );
      await page.goto("http://prototype.test/");
      await page.locator("#theme").selectOption(theme);
      for (const name of ["Kortit", "Loki", "Nippu"]) {
        await page.getByRole("button", { name, exact: true }).click();
        await expect(page.locator(".b-run")).toHaveCount(1);
        // Production frame: 780 outer column including 24px gutters; phone 14px.
        // This catches the round-1 nested flex shrink that made the editor narrow.
        const box = await page.locator(".ah-cbox").boundingBox();
        expect(box?.width).toBeCloseTo(width === 390 ? 362 : 732, 0);
        const stream = await page.locator(".b-thread").boundingBox();
        expect(stream?.width).toBeCloseTo(box?.width ?? 0, 0);
        await expect(page.locator(".ah-message-interim")).toHaveCount(1);
        await expect(page.locator(".b-work")).toHaveCount(2);
        await expect(page.locator(".b-tray")).toBeVisible();
        await page.getByRole("button", { name: "Monta peräkkäin" }).click();
        await expect(page.locator(".b-run")).toHaveCount(4);
        const last = page.locator(".b-run").last();
        if (!(await last.getAttribute("open"))) {
          // Native details must remain keyboard operable in compact directions.
          if (!(await last.evaluate((el) => (el as HTMLDetailsElement).open))) {
            await last.locator("summary").focus();
            await page.keyboard.press("Enter");
          }
        }
        await expect(last.locator("pre")).toBeVisible();
        await page.getByRole("button", { name: "Virhe", exact: true }).click();
        await expect(page.locator(".b-state")).toHaveText("Paluuarvo 1");
        await expect(page.locator(".b-output pre")).toBeVisible();
        await page.getByRole("button", { name: "!! Vain sinulle" }).click();
        await expect(page.locator(".b-private")).toBeVisible();
        await page.getByRole("button", { name: "Pitkä ajo" }).click();
        const field = page.getByRole("textbox", { name: "Viesti Pi:lle" });
        await field.fill("!git status");
        await field.press("Enter");
        await expect(page.locator(".b-run")).toHaveCount(1);
        await expect(page.locator("#bash-notice")).toContainText(
          "Edellinen komento on vielä käynnissä",
        );
        await expect(field).toHaveValue("!git status");
        const stop = page.getByRole("button", {
          name: "Pysäytä komento",
          exact: true,
        });
        await stop.click();
        await expect(page.locator("#bash-notice")).toHaveText("Keskeytetään…");
        await expect(stop).toBeDisabled();
        await expect(page.locator(".b-state")).not.toHaveText("Pysäytetty");
        await page
          .getByRole("button", { name: "Vahvista päättyminen" })
          .click();
        await expect(page.locator(".b-state")).toHaveText("Pysäytetty");
        await field.press("Enter");
        await expect(page.locator(".b-run")).toHaveCount(2);
        await expect(field).toHaveValue("");
        await page.getByRole("button", { name: "Pitkä ajo" }).click();
        await stop.click();
        await page.getByRole("button", { name: "Yhteys katkeaa" }).click();
        await expect(page.locator(".b-state")).toHaveText("Tulos ei tiedossa");
        await expect(page.locator("#bash-notice")).toContainText(
          "päättymistä ei tiedetä",
        );
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth,
          ),
        ).toBe(true);
        const row = page.locator(".ah-crow");
        expect(
          await row.evaluate((el) => el.scrollWidth <= el.clientWidth),
        ).toBe(true);
      }
      await page.getByRole("button", { name: "Pi:n keskeytys" }).click();
      await page
        .getByRole("button", { name: "Pysäytä Pi", exact: true })
        .click();
      await expect(page.locator("#bash-notice")).toHaveText("Keskeytetään…");
      await expect(page.locator(".b-agent")).toHaveText("Pi · Keskeytetään…");
      await page.getByRole("button", { name: "Yhteys katkeaa" }).click();
      await expect(page.locator(".b-agent")).toHaveText(
        "Työn tila ei tiedossa",
      );
      await page.getByRole("button", { name: "Pi:n keskeytys" }).click();
      await page
        .getByRole("button", { name: "Pysäytä Pi", exact: true })
        .click();
      await page.getByRole("button", { name: "Vahvista päättyminen" }).click();
      await expect(page.locator(".b-agent")).toHaveText(
        "Pi odottaa seuraavaa viestiäsi.",
      );
      expect(errors).toEqual([]);
    });
  }
}
