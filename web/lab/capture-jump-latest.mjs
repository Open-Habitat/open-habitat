#!/usr/bin/env node
// Storybook only (jump-latest-chip-layout): the floating jump-to-latest chip
// in its three forms, desktop and phone, light and dark, at scale factor 2.
//   node web/lab/capture-jump-latest.mjs <storybook-origin> <out-dir> <tag>
// Writes <out>/<tag>-<presentation>-<form>.png and <tag>-boxes.json.
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";

const [storybook, outArg, tag] = process.argv.slice(2);
if (!storybook || !outArg || !tag)
  throw new Error("usage: capture-jump-latest.mjs <origin> <out-dir> <tag>");
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(storybook))
  throw new Error("Storybook origin must be a loopback URL");
const out = resolve(outArg);
await mkdir(out, { recursive: true });

const presentations = [
  { id: "desktop-light", theme: "light", width: 1000 },
  { id: "desktop-dark", theme: "dark", width: 1000 },
  { id: "phone-light", theme: "light", width: 390 },
  { id: "phone-dark", theme: "dark", width: 390 },
];
const boxes = {};
const browser = await chromium.launch({ headless: true });
try {
  for (const p of presentations) {
    const page = await browser.newPage({
      viewport: { width: p.width, height: 420 },
      deviceScaleFactor: 2,
    });
    const story = `production-conversation-recovery--jump-to-latest-${p.theme}`;
    await page.goto(`${storybook}/iframe.html?id=${story}&viewMode=story`);
    await page.getByTestId("jump-latest").nth(2).waitFor();
    await page.evaluate(() => document.fonts.ready);
    for (const form of ["idle", "reply", "working"]) {
      const frame = page.locator(`[data-jump-form="${form}"]`);
      const chip = frame.getByTestId("jump-latest");
      await frame.screenshot({ path: `${out}/${tag}-${p.id}-${form}.png` });
      boxes[`${p.id}-${form}`] = await chip.evaluate((el) => {
        const own = el.getBoundingClientRect();
        const icon = el.querySelector("svg")?.getBoundingClientRect();
        return {
          height: own.height,
          width: own.width,
          iconCentreOffset: icon
            ? icon.top + icon.height / 2 - (own.top + own.height / 2)
            : null,
        };
      });
    }
    await page.close();
  }
} finally {
  await browser.close();
}
await writeFile(
  `${out}/${tag}-boxes.json`,
  `${JSON.stringify(boxes, null, 2)}\n`,
);
