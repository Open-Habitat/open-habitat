// Synthetic lab and accepted prototype only; no personal browser or live data.

import { readdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { expect } from "@playwright/test";
import { openLab, snapshot } from "./session.mjs";

const out = "issues/implement-workspace-ikonirivi";
const { browser, page, context } = await openLab();
const proto = await context.newPage();
try {
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "aurinkokello", exact: true })
    .click();
  await expect(page.locator(".ah-home-recap").first()).toBeVisible();
  await proto.goto(
    `file://${resolve("design-system/prototypes/dist/2026-10-16-tyotilasivu-2.html")}`,
  );
  await proto.keyboard.press("2");
  await expect(proto.locator(".wsp.v2")).toBeVisible();
  for (const width of [1440, 390])
    for (const theme of ["light", "dark"]) {
      await page.reload();
      await proto.reload();
      await proto.keyboard.press("2");
      await expect(proto.locator(".wsp.v2")).toBeVisible();
      await expect(page.locator(".ah-home-recap").first()).toBeVisible();
      await page.setViewportSize({ width, height: 900 });
      await page.evaluate((t) => {
        document.documentElement.dataset.theme = t;
        localStorage.setItem("nah:theme", t);
      }, theme);
      await proto.setViewportSize({ width: 1472, height: 1050 });
      await proto.selectOption("#theme", theme);
      await proto.locator("#phone").setChecked(width === 390);
      // Compare the application frame at the same width/height, not the prototype picker.
      await proto.addStyleTag({
        content: `.frame {width:${width}px!important; max-width:none!important; flex-shrink:0!important; height:900px!important}`,
      });
      const titles = await page
        .locator(".ah-home-card-title")
        .allTextContents();
      for (const state of ["page", "git", "rename", "hidden"]) {
        if (state === "git") {
          await page
            .getByRole("button", { name: "main · 2 muutosta ↑1", exact: true })
            .click();
          await proto.locator("[data-git]").click();
        }
        if (state === "rename") {
          await page
            .getByRole("button", { name: "Muuta näyttönimeä…", exact: true })
            .click();
          await proto.locator('[data-wa="rename-dlg"]').click();
        }
        if (state === "hidden") {
          await page
            .getByRole("button", { name: "Arkistoi työtila", exact: true })
            .click();
          await expect(page.locator(".ah-workspace-hidden")).toBeVisible();
          await expect(page.locator(".ah-home-card-title")).toHaveText(titles);
          await proto.locator('[data-wa="hide"]').click();
        }
        await snapshot(page, `${out}/lab-${state}-${width}-${theme}`);
        await proto.evaluate(() => document.fonts.ready);
        await proto
          .locator(".frame")
          .screenshot({ path: `${out}/round-${state}-${width}-${theme}.png` });
        const html = (await proto.content()).replace(
          /<script\b[^>]*>[\s\S]*?<\/script>/gi,
          "",
        );
        await writeFile(`${out}/round-${state}-${width}-${theme}.html`, html);
        if (state === "git" || state === "rename") {
          await page.keyboard.press("Escape");
          await proto.keyboard.press("Escape");
          // The custom prototype Git layer closes by its own button.
          const close = proto.locator("[data-wl-close]");
          if (await close.isVisible()) await close.click();
        }
        if (state === "hidden") {
          await page
            .getByRole("button", { name: "Palauta työtila", exact: true })
            .click();
          await expect(page.locator(".ah-workspace-hidden")).toHaveCount(0);
          await proto.locator('[data-wa="unhide"]').first().click();
        }
      }
    }
  let activity = "working";
  const workspaceId = new URL(page.url()).pathname.split("/").at(-1);
  await page.route("**/api/v1/snapshot", async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    const agent = body.agents.find((a) => a.workspace_id === workspaceId);
    agent.process = "daemon_managed_live";
    agent.activity = activity === "working" ? "running" : "idle";
    agent.run_active = activity === "working";
    agent.pending_question = null;
    agent.waiting_on =
      activity === "working"
        ? []
        : [
            {
              process_id: "synthetic-process",
              name: "Vertailuajo",
              kind:
                activity === "waiting_spinoff" ? "taskfleet_wait" : "process",
              run_ids: [],
            },
          ];
    await route.fulfill({ response, json: body });
  });
  for (const width of [1440, 390])
    for (const theme of ["light", "dark"]) {
      await page.setViewportSize({ width, height: 900 });
      await page.evaluate((t) => localStorage.setItem("nah:theme", t), theme);
      await proto.reload();
      await proto.keyboard.press("2");
      await proto.selectOption("#theme", theme);
      await proto.locator("#phone").setChecked(width === 390);
      await proto.addStyleTag({
        content: `.frame {width:${width}px!important; max-width:none!important; flex-shrink:0!important; height:900px!important}`,
      });
      for (const state of ["working", "waiting_process", "waiting_spinoff"]) {
        activity = state;
        await page.reload();
        const card = `.ah-home-card-${state}`;
        await expect(page.locator(card)).toBeVisible();
        await expect(
          page
            .locator(card)
            .getByRole("button", { name: "Arkistoi", exact: true }),
        ).toBeDisabled();
        await snapshot(page, `${out}/lab-${state}-${width}-${theme}`, {
          region: card,
        });
        await proto.evaluate(() => document.fonts.ready);
        const klass =
          state === "working"
            ? "working"
            : state === "waiting_process"
              ? "procwait"
              : "spinwait";
        await proto
          .locator(`.kc.${klass}`)
          .screenshot({ path: `${out}/round-${state}-${width}-${theme}.png` });
        await writeFile(
          `${out}/round-${state}-${width}-${theme}.html`,
          (await proto.content()).replace(
            /<script\b[^>]*>[\s\S]*?<\/script>/gi,
            "",
          ),
        );
      }
    }
} finally {
  await browser.close();
}

// CSSOM serialisation adds trailing spaces; normalize evidence without changing layout.
for (const file of await readdir(out)) {
  if (/^(lab|round)-.*\.html$/.test(file)) {
    const path = `${out}/${file}`;
    await writeFile(
      path,
      (await readFile(path, "utf8")).replace(/[ \t]+$/gm, ""),
    );
  }
}
