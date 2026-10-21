// Temporary prototype evidence, retained with the open design round.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";

const repo = resolve(import.meta.dirname, "../..");
const output = resolve(tmpdir(), `bash-prototype-${process.pid}.html`);
execFileSync(
  process.execPath,
  [
    "design-system/prototypes/build.mjs",
    "design-system/prototypes/rounds/2026-10-20-bash-runs",
    "--out",
    output,
  ],
  { cwd: repo },
);
const html = readFileSync(output, "utf8");

for (const width of [1280, 390]) {
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
      for (const direction of [0, 1, 2]) {
        await page
          .getByRole("button")
          .and(page.locator(".proto-picker-item"))
          .nth(direction)
          .click();
        await expect(page.locator(".b-run")).toHaveCount(1);
        await page
          .getByRole("button")
          .and(page.locator('[data-scene="many"]'))
          .click();
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
        await page
          .getByRole("button")
          .and(page.locator('[data-scene="fail"]'))
          .click();
        await expect(page.locator(".b-state")).toHaveClass(/err/);
        await expect(page.locator(".b-output pre")).toBeVisible();
        await page
          .getByRole("button")
          .and(page.locator('[data-scene="private"]'))
          .click();
        await expect(page.locator(".b-private")).toBeVisible();
        await page
          .getByRole("button")
          .and(page.locator('[data-scene="long"]'))
          .click();
        const field = page.getByRole("textbox");
        await field.fill("!git status");
        await field.press("Enter");
        await expect(page.locator(".b-run")).toHaveCount(1);
        await expect(page.locator("#bash-notice a")).toHaveAttribute(
          "href",
          "#bash-live",
        );
        await expect(field).toHaveValue("!git status");
        const stop = page
          .getByRole("button")
          .and(page.locator(".ah-crow-stop"));
        await stop.click();
        await expect(page.locator("#bash-notice .b-spinner")).toBeVisible();
        await expect(stop).toBeDisabled();
        await expect(page.locator("#bash-live")).toHaveCount(1);
        await page
          .getByRole("button")
          .and(page.locator("[data-confirm]"))
          .click();
        await expect(page.locator("#bash-live")).toHaveCount(0);
        await field.press("Enter");
        await expect(page.locator(".b-run")).toHaveCount(2);
        await expect(field).toHaveValue("");
        await page
          .getByRole("button")
          .and(page.locator('[data-scene="long"]'))
          .click();
        await stop.click();
        await page
          .getByRole("button")
          .and(page.locator("[data-disconnect]"))
          .click();
        await expect(stop).toBeHidden();
        await expect(page.locator("#bash-notice")).not.toBeEmpty();
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
      await page
        .getByRole("button")
        .and(page.locator('[data-scene="pi"]'))
        .click();
      await page.getByRole("button").and(page.locator(".ah-crow-stop")).click();
      await expect(page.locator("#bash-notice .b-spinner")).toBeVisible();
      await expect(page.locator(".ah-crow-stop")).toBeDisabled();
      await page
        .getByRole("button")
        .and(page.locator("[data-disconnect]"))
        .click();
      await expect(page.locator(".ah-crow-stop")).toBeHidden();
      await page
        .getByRole("button")
        .and(page.locator('[data-scene="pi"]'))
        .click();
      await page.getByRole("button").and(page.locator(".ah-crow-stop")).click();
      await page
        .getByRole("button")
        .and(page.locator("[data-confirm]"))
        .click();
      await expect(page.locator(".ah-crow-stop")).toBeHidden();
      await expect(page.locator("#bash-notice")).toBeEmpty();
      expect(errors).toEqual([]);
    });
  }
}
