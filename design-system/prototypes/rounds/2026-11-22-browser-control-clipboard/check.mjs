// node check.mjs <offline.html> <evidence-directory> [--quick]
// One Chromium, sequential pages. Synthetic interactions only: typing on the
// canvas, paste on the canvas, strict-browser paste field and keystroke
// fallback, remote copy to the local clipboard and its fallback, Done, taking
// control from an idle and a busy agent (both choices), the agent's wish to
// continue, the idle return, picker shortcuts not stealing canvas keys,
// offline assets, clean console and viewport containment. --quick runs only
// 1440 px light Finnish.
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
const [input, out, flag] = process.argv.slice(2);
if (!input || !out)
	throw new Error("usage: node check.mjs <offline.html> <evidence-directory> [--quick]");
const quick = flag === "--quick";
const ROUND = "2026-11-22-browser-control-clipboard";
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const errors = [],
	requests = [];
let cases = 0;
const act = (p, a) => p.locator(`[data-action="${a}"]`).filter({ visible: true }).first();
const control = (p) => p.locator(".screen").getAttribute("data-control");
const field = (p, name) => p.locator(`[data-remote="${name}"] .r-value`).textContent();
async function situation(page, value) {
	await page.selectOption("#situation", value);
	await page.locator(".screen").waitFor();
}
async function paste(page, text) {
	await page.locator(".screen").focus();
	await page.evaluate((text) => {
		const dt = new DataTransfer();
		dt.setData("text/plain", text);
		document
			.querySelector(".screen")
			.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
	}, text);
}
async function containment(page, label) {
	assert.ok(
		await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
		`${label}: page fits viewport`,
	);
	const escaped = await page.locator("button,select,textarea,input").evaluateAll((els) =>
		els
			.filter((e) => e.getClientRects().length)
			.filter((e) => {
				const r = e.getBoundingClientRect();
				return r.left < 0 || r.right > innerWidth + 1;
			})
			.map((e) => e.outerHTML.slice(0, 120)),
	);
	assert.deepEqual(escaped, [], `${label}: visible controls fit viewport`);
}
// Directions open the paste field differently; this opens it in each.
async function openPaste(page, d) {
	if (d === 0 && !(await page.locator("[data-paste]").isVisible())) await act(page, "clip-toggle").click();
	if (d === 1 && !(await page.locator("[data-paste]").isVisible())) await act(page, "paste-toggle").click();
}

try {
	const widths = quick ? [1440] : [1440, 390];
	const themes = quick ? ["light"] : ["light", "dark", "contrast"];
	const langs = quick ? ["fi"] : ["fi", "en"];
	for (const width of widths)
		for (const theme of themes)
			for (const lang of langs)
				for (let d = 0; d < 3; d++) {
					const label = `${d + 1}-${width}-${theme}-${lang}`;
					const context = await browser.newContext({
						viewport: { width, height: 1000 },
						reducedMotion: "reduce",
						permissions: ["clipboard-read", "clipboard-write"],
					});
					const page = await context.newPage();
					page.on("pageerror", (e) => errors.push(`${label}: ${e.message}`));
					page.on("console", (m) => {
						if (m.type() === "error") errors.push(`${label}: ${m.text()}`);
					});
					await page.route(/^https?:/, (r) => {
						requests.push(r.request().url());
						return r.abort();
					});
					await page.goto(pathToFileURL(resolve(input)).href + `?v=${d + 1}&theme=${theme}&lang=${lang}`);
					await page.locator(`.app[data-direction="${d}"]`).waitFor();
					await page.evaluate(() => document.fonts.ready);
					await checkPicker(page, ROUND);
					await containment(page, label);
					assert.equal(await page.locator(".review li[aria-current]").count(), 1);
					assert.equal(await control(page), "person", "default: person drives the sign-in");
					await page.screenshot({ path: `${out}/${label}.png`, fullPage: true });
					if (width === 390 && theme === "light" && lang === "fi") {
						const audit = await new AxeBuilder({ page }).include(".app").analyze();
						assert.deepEqual(
							audit.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(" ")}`),
							[],
							`${label}: accessibility`,
						);
					}

					// Typing on the canvas reaches the page; "1" never switches direction.
					await page.locator(".screen").focus();
					await page.keyboard.type("ab1");
					assert.equal(await field(page, "password"), "•••", `${label}: typed`);
					await page.locator(`.app[data-direction="${d}"]`).waitFor();

					// Paste on the canvas: content is never echoed in the confirmation.
					await paste(page, "S4lasana!");
					assert.equal((await field(page, "password")).length, 12, `${label}: pasted`);
					const toast = await page.locator(".toast").first().textContent();
					assert.ok(/9/.test(toast) && !toast.includes("S4lasana"), `${label}: paste toast`);

					// Strict browser: canvas paste refused, the field takes over.
					await page.locator("#strict").check();
					await paste(page, "zzz");
					assert.equal((await field(page, "password")).length, 12, `${label}: strict refused`);
					assert.ok(await page.locator("[data-paste]").isVisible(), `${label}: paste field opened`);
					await page.locator("[data-paste]").fill("xy");
					await act(page, "send-paste").click();
					assert.equal((await field(page, "password")).length, 14, `${label}: field paste`);
					await openPaste(page, d);
					await page.locator("[data-paste]").fill("q");
					await act(page, "send-type").click();
					assert.equal((await field(page, "password")).length, 15, `${label}: keystroke fallback`);

					// Remote copy: strict browser offers an explicit button.
					await page.locator('[data-remote="select"]').click();
					await page.locator(".screen").press("Control+c");
					await page.locator(".remote-clip").waitFor();
					await act(page, "copy-local").click();
					await page.waitForFunction(
						() => !document.querySelector(".remote-clip") || document.querySelector(".remote-clip input"),
					);
					await page.locator("#strict").uncheck();
					// Without strict mode the copy goes straight through.
					await page.locator('[data-remote="select"]').click();
					await page.locator(".screen").press("Control+c");
					await page.waitForFunction(() => /Kopioitu etäsivulta koneellesi|Copied from the remote page/.test(document.body.textContent));
					await containment(page, `${label} clipboard`);

					// Done gives back and clears the remote clipboard.
					await act(page, "done").click();
					assert.equal(await control(page), "agent");
					assert.match(await page.locator(".toast").first().textContent(), /tyhjennettiin|cleared/);

					// Waiting agent: a click on a field takes control and lands there.
					await situation(page, "request");
					assert.equal(await control(page), "agent");
					await page.locator('[data-remote="email"]').click();
					assert.equal(await control(page), "person", `${label}: click took control`);
					assert.equal(await page.locator('[data-remote="email"][data-focus]').count(), 1);
					// …and so does a keystroke.
					await situation(page, "request");
					await page.locator(".screen").focus();
					await page.keyboard.press("x");
					assert.equal(await control(page), "person", `${label}: key took control`);

					// Busy agent: the click asks first; "take when done" waits.
					await situation(page, "busy");
					await page.locator('[data-remote="password"]').click();
					assert.ok(await page.locator(".popover").isVisible(), `${label}: mid-step warning`);
					assert.equal(await control(page), "agent", "click consumed");
					await page.screenshot({ path: `${out}/${label}-busy.png`, fullPage: true });
					await act(page, "take-after").click();
					await page.waitForFunction(() => document.querySelector(".screen")?.dataset.control === "person", null, {
						timeout: 10000,
					});
					assert.equal(await field(page, "email"), "alex@example.com");
					// "Take now" interrupts and says what was left behind.
					await situation(page, "busy");
					await page.locator(".screen").focus();
					await page.keyboard.press("k");
					await act(page, "take-now").click();
					assert.equal(await control(page), "person");
					assert.ok(await page.locator(".notice").isVisible(), `${label}: interruption notice`);
					// Escape cancels the warning.
					await situation(page, "busy");
					await page.locator(".screen").click();
					await page.locator(".popover button").first().focus();
					await page.keyboard.press("Escape");
					assert.equal(await page.locator(".popover").count(), 0);

					// The agent wants to continue; Done returns.
					await situation(page, "wants");
					assert.match(await page.locator(".app").textContent(), /kirjauduit|signed in/);
					await act(page, "done").click();
					assert.equal(await control(page), "agent");

					// Idle: a countdown with a way to keep control.
					await situation(page, "idle");
					assert.ok(await page.locator("[data-idle]").isVisible());
					await act(page, "keep").click();
					assert.equal(await page.locator("[data-idle]").count(), 0);
					assert.equal(await control(page), "person");
					await containment(page, `${label} end`);

					// Exercise picker wiring, not just query-string rendering.
					await page.locator(".proto-picker-item").nth((d + 1) % 3).click();
					await page.locator(`.app[data-direction="${(d + 1) % 3}"]`).waitFor();
					await checkPicker(page, ROUND);
					await context.close();
					cases++;
				}
	assert.deepEqual(errors, [], "clean console");
	assert.deepEqual(requests, [], "offline: no network requests");
	console.log(
		`PASS: ${cases} direction/language/theme/viewport cases; typing, paste, strict fallback, copy, Done, idle/busy takeover, idle return, picker and offline checks. Screenshots: ${out}`,
	);
} finally {
	await browser.close();
}
