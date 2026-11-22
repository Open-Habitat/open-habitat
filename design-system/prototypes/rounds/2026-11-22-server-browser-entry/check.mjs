// node check.mjs <offline.html> <evidence-directory>
// One Chromium, sequential pages. Synthetic presentation interactions only:
// picker, both scopes, other conversation, requests, explicit control, return,
// stopped state, keyboard dismissal, offline assets, and viewport containment.
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { mkdirSync } from "node:fs";
import assert from "node:assert/strict";
import { checkPicker } from "../../picker-check.mjs";
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(resolve(here, "../../../../web/package.json"));
const { chromium } = require("playwright");
const { default: AxeBuilder } = require("@axe-core/playwright");
const [input, out] = process.argv.slice(2);
if (!input || !out)
	throw new Error("usage: node check.mjs <offline.html> <evidence-directory>");
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const errors = [],
	requests = [];
let cases = 0;
const act = (p, a) =>
	p.locator(`[data-action="${a}"]`).filter({ visible: true }).first();
async function rail(page, width) {
	if (width < 700) await act(page, "rail-toggle").click();
}
async function containment(page) {
	assert.ok(
		await page.evaluate(
			() => document.documentElement.scrollWidth <= innerWidth,
		),
		"page fits viewport",
	);
	const escaped = await page
		.locator("button,select,textarea")
		.evaluateAll((elements) =>
			elements
				.filter((e) => e.getClientRects().length)
				.filter((e) => {
					const r = e.getBoundingClientRect();
					return r.left < 0 || r.right > innerWidth + 1;
				})
				.map((e) => e.outerHTML.slice(0, 120)),
		);
	assert.deepEqual(escaped, [], "visible controls fit viewport");
}
try {
	for (const width of [1440, 390])
		for (const theme of ["light", "dark", "contrast"])
			for (const lang of ["fi", "en"])
				for (let d = 0; d < 3; d++) {
					const context = await browser.newContext({
						viewport: { width, height: 1000 },
						reducedMotion: "reduce",
					});
					const page = await context.newPage();
					page.on("pageerror", (e) => errors.push(e.message));
					page.on("console", (m) => {
						if (m.type() === "error") errors.push(m.text());
					});
					await page.route(/^https?:/, (r) => {
						requests.push(r.request().url());
						return r.abort();
					});
					await page.goto(
						pathToFileURL(resolve(input)).href +
							`?v=${d + 1}&theme=${theme}&lang=${lang}`,
					);
					await page.locator(`.app[data-direction="${d}"]`).waitFor();
					await page.evaluate(() => document.fonts.ready);
					await checkPicker(page, "2026-11-22-server-browser-entry");
					await containment(page);
					if (width === 390 && theme === "light" && lang === "fi") {
						const audit = await new AxeBuilder({ page })
							.include(".app")
							.analyze();
						assert.deepEqual(audit.violations, [], "application accessibility");
					}
					assert.equal(
						await page.locator(".review li[aria-current]").count(),
						1,
					);
					assert.equal(await page.locator(".chip").count(), d === 1 ? 0 : 1);
					assert.equal(
						await page.locator(".work-line").count(),
						d === 1 ? 1 : 0,
					);
					await page.screenshot({
						path: `${out}/${d + 1}-${width}-${theme}-${lang}.png`,
						fullPage: true,
					});
					// The chip opens just the two conversation windows, never the personal one.
					if (d !== 1) {
						await act(page, "chip").click();
						assert.equal(
							await page.locator(".window-strip [data-window]").count(),
							2,
						);
						assert.equal(
							await page.locator('.window-strip [data-window="notes"]').count(),
							0,
						);
						await act(page, "request").click();
						assert.equal(
							await page.locator("#browser-dialog").getAttribute("data-scope"),
							"request",
						);
					} else {
						await rail(page, width);
						await act(page, "global").click();
						assert.equal(
							await page.locator("#browser-dialog [data-window]").count(),
							3,
						);
						await page
							.locator('#browser-dialog [data-window="ledger"]')
							.click();
					}
					assert.equal(
						await page.locator(".control-mode").getAttribute("data-control"),
						"false",
						"looking never takes control",
					);
					await act(page, "take").click();
					assert.equal(
						await page.locator(".control-mode").getAttribute("data-control"),
						"true",
					);
					await act(page, "confirm").click();
					assert.equal(
						await page.locator('[data-action="confirm"]').count(),
						0,
						"confirmation resolves request",
					);
					await act(page, "give-back").click();
					assert.equal(
						await page.locator(".control-mode").getAttribute("data-control"),
						"false",
					);
					await containment(page);
					await page.keyboard.press("Escape");
					assert.equal(await page.locator("dialog[open]").count(), 0);
					await page.waitForFunction(() => !document.querySelector(".request"));
					assert.equal(
						await page.locator(".request").count(),
						0,
						"request cleared in conversation too",
					);
					if (d === 0)
						assert.equal(
							await page.locator('[data-action="global"].browser-row').count(),
							0,
							"conditional row disappears",
						);
					await page.selectOption("#situation", "request");
					// Global access works even from the other conversation and contains personal windows.
					if (
						width < 700 &&
						(await page.locator(".app").getAttribute("data-rail-open")) !==
							"true"
					)
						await rail(page, width);
					await act(page, "conversation-plan").click();
					assert.equal(
						await page.locator(".request").count(),
						0,
						"foreign request not attributed to this conversation",
					);
					if (d === 2)
						assert.equal(
							await page.locator(".chip").count(),
							0,
							"no unrelated conversation chip",
						);
					await rail(page, width);
					await act(page, "global").click();
					assert.equal(
						await page.locator("#browser-dialog [data-window]").count(),
						3,
					);
					await page.locator('#browser-dialog [data-window="notes"]').click();
					assert.equal(
						await page.locator(".control-mode").getAttribute("data-control"),
						"false",
					);
					await page.screenshot({
						path: `${out}/${d + 1}-${width}-${theme}-${lang}-global.png`,
						fullPage: true,
					});
					await act(page, "close").click();
					await page.selectOption("#situation", "stopped");
					if (d === 0) {
						assert.equal(await page.locator(".browser-row").count(), 0);
						await act(page, "start").click();
						assert.equal(
							await page.locator(".window-strip [data-window]").count(),
							3,
							"chip-only retains global access outside a browser conversation",
						);
					} else {
						await act(page, "global").click();
						await act(page, "start-dialog").click();
						assert.equal(
							await page.locator("#browser-dialog [data-window]").count(),
							3,
						);
						await act(page, "close").click();
					}
					// Exercise picker wiring, not just query-string rendering.
					await page
						.locator(".proto-picker-item")
						.nth((d + 1) % 3)
						.click();
					await page.locator(`.app[data-direction="${(d + 1) % 3}"]`).waitFor();
					await checkPicker(page, "2026-11-22-server-browser-entry");
					await containment(page);
					await context.close();
					cases++;
				}
	assert.deepEqual(errors, [], "clean console");
	assert.deepEqual(requests, [], "offline: no network requests");
	console.log(
		`PASS: ${cases} direction/language/theme/viewport cases; scope, request, control, stop/start, picker and offline checks. Screenshots: ${out}`,
	);
} finally {
	await browser.close();
}
