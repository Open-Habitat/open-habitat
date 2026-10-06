#!/usr/bin/env node
// Integration: run against scripts/lab.sh start with synthetic data only.
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, request } from "@playwright/test";
import { openLab, origin, snapshot } from "./session.mjs";
const dir = await mkdtemp(join(tmpdir(), "oh-static-snapshot-"));
const reset = await request.newContext({ ignoreHTTPSErrors: true });
try {
  assert.equal((await reset.get(`${origin}/fixture/lab-marker`)).status(), 204);
  assert.equal(
    (await reset.get(`${origin}/fixture/scenario?value=ready`)).status(),
    204,
  );
} finally {
  await reset.dispose();
}
const { browser, page } = await openLab();
try {
  await page.goto(`${origin}/workspaces`);
  await page.locator("main h1").waitFor();
  await page.waitForFunction(
    () => !document.querySelector("main")?.textContent?.includes("Ladataan"),
  );
  await snapshot(page, join(dir, "sample"));
  await snapshot(page, join(dir, "fragment"), { region: "main" });
  const fragment = await readFile(join(dir, "fragment.html"), "utf8");
  assert.doesNotMatch(fragment, /<script\b|\bon\w+=/i);
  assert.match(fragment, /<main\b/);
  assert.match(fragment, /aria-hidden="true"/);
  const html = await readFile(join(dir, "sample.html"), "utf8");
  assert.doesNotMatch(html, /<script\b|\bon\w+=/i);
  assert.doesNotMatch(html.replace(/>[^<]*</g, "><"), /https?:\/\//i);
  assert.match(html, /data-theme=/);
  const offline = await chromium.launch();
  try {
    const context = await offline.newContext({
      viewport: { width: 1440, height: 900 },
    });
    let requests = 0;
    await context.route(/^https?:/, (route) => {
      requests++;
      return route.abort();
    });
    const view = await context.newPage();
    await view.goto(`file://${join(dir, "sample.html")}`);
    await view.evaluate(() => document.fonts.ready);
    assert.equal(requests, 0, "snapshot requested network assets");
    assert.equal(
      await view.locator("main h1").innerText(),
      await page.locator("main h1").innerText(),
    );
    assert.equal(
      await view.locator("a[href], form[action], script").count(),
      0,
    );
    const livePng = await readFile(join(dir, "sample.png"));
    const offlinePng = await view.screenshot({ fullPage: true });
    // Decode both in-browser and sample RGB pixels: layout should be broadly the same.
    const diff = await view.evaluate(
      async ([a, b]) => {
        const image = async (base64) => {
          const img = new Image();
          img.src = `data:image/png;base64,${base64}`;
          await img.decode();
          const canvas = document.createElement("canvas");
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0);
          return {
            width: img.width,
            height: img.height,
            data: ctx.getImageData(0, 0, img.width, img.height).data,
          };
        };
        const x = await image(a),
          y = await image(b);
        if (x.width !== y.width || Math.abs(x.height - y.height) > 80)
          return 256;
        let error = 0,
          n = 0;
        for (let row = 0; row < Math.min(x.height, y.height); row += 8)
          for (let col = 0; col < x.width; col += 8) {
            const ix = (row * x.width + col) * 4,
              iy = (row * y.width + col) * 4;
            for (let c = 0; c < 3; c++) {
              error += Math.abs(x.data[ix + c] - y.data[iy + c]);
              n++;
            }
          }
        return error / n;
      },
      [livePng.toString("base64"), offlinePng.toString("base64")],
    );
    assert.ok(
      diff < 35,
      `offline screenshot differed from lab (mean RGB error ${diff})`,
    );
    await view.goto(`file://${join(dir, "fragment.html")}`);
    assert.equal(requests, 0, "fragment requested network assets");
    assert.equal(
      await view.locator("main h1").innerText(),
      await page.locator("main h1").innerText(),
    );
    const fragmentPng = await readFile(join(dir, "fragment.png"));
    const offlineFragmentPng = await view.locator("main").screenshot();
    assert.equal(
      fragmentPng.readUInt32BE(16),
      offlineFragmentPng.readUInt32BE(16),
      "fragment width changed offline",
    );
    assert.equal(
      fragmentPng.readUInt32BE(20),
      offlineFragmentPng.readUInt32BE(20),
      "fragment height changed offline",
    );
    assert.equal(await view.locator("nav a").count(), 0);
    await context.close();
  } finally {
    await offline.close();
  }
  console.log("static snapshot: inert, offline, layout matched");
} finally {
  await browser.close();
  await rm(dir, { recursive: true, force: true });
}
