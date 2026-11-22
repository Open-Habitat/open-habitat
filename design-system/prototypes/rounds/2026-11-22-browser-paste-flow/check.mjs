// node check.mjs <offline.html> <evidence-directory> [--quick]
// One Chromium, sequential pages. For every direction, language, light/dark
// theme and 1440/390 px: click the password field, press Control+V on the
// picture and check what that direction does, send with Type as keystrokes,
// check that focus is back on the picture and that Backspace lands on the
// page, toggle the eye, check the honest guidance, Escape returning focus,
// a paste leaving a remote-clipboard note that Done clears, the waiting
// agent case, picker wiring, offline assets, clean console and viewport
// containment. Axe on 390 px light Finnish. --quick runs only 1440 px light fi.
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
if (!input || !out) throw new Error("usage: node check.mjs <offline.html> <evidence-directory> [--quick]");
const quick = flag === "--quick";
const ROUND = "2026-11-22-browser-paste-flow";
const SAMPLE = "Esim-Salasana-42"; // 16 characters
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const errors = [],
	requests = [];
let cases = 0;
const act = (p, a) => p.locator(`[data-action="${a}"]`).filter({ visible: true }).first();
const pw = async (p) => (await p.locator('[data-remote="password"] .r-value').textContent()).length;
const focused = (p) =>
	p.evaluate(() => {
		const a = document.activeElement;
		return a?.matches(".screen") ? "screen" : a?.matches("[data-clip-field]") ? "field" : a?.dataset?.action || a?.tagName;
	});
async function containment(page, label) {
	assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${label}: page fits viewport`);
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

try {
	const widths = quick ? [1440] : [1440, 390];
	const themes = quick ? ["light"] : ["light", "dark"];
	const langs = quick ? ["fi"] : ["fi", "en"];
	for (const width of widths)
		for (const theme of themes)
			for (const lang of langs)
				for (let d = 0; d < 3; d++) {
					const label = `${d + 1}-${width}-${theme}-${lang}`;
					const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: "reduce" });
					const page = await context.newPage();
					page.on("pageerror", (e) => errors.push(`${label}: ${e.message}`));
					page.on("console", (m) => {
						if (m.type() === "error") errors.push(`${label}: ${m.text()}`);
					});
					await page.route(/^https?:/, (r) => {
						requests.push(r.request().url());
						return r.abort();
					});
					await page.goto(`${pathToFileURL(resolve(input)).href}?v=${d + 1}&theme=${theme}&lang=${lang}`);
					await page.locator(`.app[data-direction="${d}"]`).waitFor();
					await page.evaluate(() => document.fonts.ready);
					await checkPicker(page, ROUND);
					await containment(page, label);
					assert.equal(await page.locator(".review li[aria-current]").count(), 1);

					// Typing on the picture reaches the page; "1" never switches direction.
					await page.locator('[data-remote="password"]').click();
					await page.keyboard.type("ab1");
					assert.equal(await pw(page), 3, `${label}: typed`);
					await page.locator(`.app[data-direction="${d}"]`).waitFor();

					// The Ctrl+V moment.
					await page.keyboard.press("Control+V");
					if (d === 0) {
						assert.ok(await page.locator(".clip-pop").isVisible(), `${label}: popover opens`);
						assert.equal(await page.locator("[data-clip-field]").inputValue(), SAMPLE, `${label}: pre-filled`);
						assert.equal(await pw(page), 3, `${label}: nothing pasted yet`);
						assert.equal(await focused(page), "send-type", `${label}: focus on the keystroke choice`);
					} else if (d === 1) {
						assert.ok(await page.locator(".clip-pop").isVisible(), `${label}: popover opens`);
						assert.equal(await page.locator("[data-clip-field]").inputValue(), "", `${label}: empty field`);
						assert.equal(await focused(page), "field", `${label}: focus in the field`);
						assert.equal(await pw(page), 3, `${label}: nothing pasted`);
						await page.keyboard.press("Control+V"); // pastes into the local field only
						assert.equal(await page.locator("[data-clip-field]").inputValue(), SAMPLE);
						assert.equal(await pw(page), 3);
					} else {
						assert.equal(await pw(page), 3 + SAMPLE.length, `${label}: pasted straight through`);
						const toast = await page.locator(".toast").textContent();
						assert.ok(/16/.test(toast) && !toast.includes(SAMPLE), `${label}: count-only toast`);
						assert.equal(await focused(page), "screen");
						await act(page, "hint").click();
						assert.ok(await page.locator(".clip-pop").isVisible(), `${label}: hint opens popover`);
						assert.equal(await focused(page), "field");
						await page.keyboard.type("Kirjoitettu-9");
					}
					const pop = await page.locator(".clip-pop").textContent();
					assert.match(pop, /piiloteta agentilta|not hidden from the agent/, `${label}: honest line`);
					assert.doesNotMatch(pop, /agentti ei näe|agent can(no|’)t see|agent cannot see/i, `${label}: no false claim`);

					// The eye at the field's right edge.
					const field = page.locator("[data-clip-field]");
					assert.match(await field.getAttribute("class"), /masked/, `${label}: hidden by default`);
					const eye = act(page, "eye");
					assert.equal(await eye.getAttribute("aria-pressed"), "false");
					const fb = await field.boundingBox();
					const eb = await eye.boundingBox();
					assert.ok(eb.x + eb.width <= fb.x + fb.width + 1 && eb.x > fb.x + fb.width / 2, `${label}: eye at right edge`);
					await eye.click();
					assert.doesNotMatch((await field.getAttribute("class")) || "", /masked/, `${label}: shown`);
					assert.equal(await act(page, "eye").getAttribute("aria-pressed"), "true");
					await containment(page, `${label} popover`);
					await page.screenshot({ path: `${out}/${label}-popover.png`, fullPage: true });
					if (width === 390 && theme === "light" && lang === "fi") {
						const audit = await new AxeBuilder({ page }).include(".app").analyze();
						assert.deepEqual(
							audit.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(" ")}`),
							[],
							`${label}: accessibility`,
						);
					}
					await act(page, "eye").click();

					// Type as keystrokes: popover closes, focus returns to the picture,
					// and the next Backspace lands on the page.
					const before = await pw(page);
					const sent = (await field.inputValue()).length;
					await act(page, "send-type").click();
					assert.equal(await page.locator(".clip-pop").count(), 0, `${label}: popover closed`);
					assert.equal(await pw(page), before + sent, `${label}: keystrokes landed`);
					assert.equal(await focused(page), "screen", `${label}: focus back on the page`);
					await page.keyboard.press("Backspace");
					assert.equal(await pw(page), before + sent - 1, `${label}: Backspace on the page`);
					assert.equal(await page.locator("[data-remote-clip]").count(), 0);
					await page.screenshot({ path: `${out}/${label}-after.png`, fullPage: true });

					// Escape from the popover returns focus to the picture, nothing sent.
					await act(page, "clip-toggle").click();
					assert.equal(await focused(page), "field");
					await page.keyboard.type("zz");
					const n = await pw(page);
					await page.keyboard.press("Escape");
					assert.equal(await page.locator(".clip-pop").count(), 0);
					assert.equal(await focused(page), "screen", `${label}: Escape returns focus`);
					assert.equal(await pw(page), n, `${label}: Escape sent nothing`);

					// Paste into page leaves a remote-clipboard note; Done clears it.
					await act(page, "clip-toggle").click();
					await page.keyboard.type("xy");
					await act(page, "send-paste").click();
					assert.equal(await focused(page), "screen", `${label}: focus back after paste`);
					await act(page, "clip-toggle").click();
					assert.match(await page.locator("[data-remote-clip]").textContent(), /2/);
					await act(page, "clip-close").click();
					await act(page, "done").click();
					assert.match(await page.locator(".toast").textContent(), /tyhjennettiin|cleared/);
					assert.equal(await page.locator('.frame[data-control="agent"]').count(), 1, `${label}: dashed border`);

					// Agent waiting: Ctrl+V on the picture takes control first.
					await page.selectOption("#situation", "request");
					await page.locator(".screen").focus();
					await page.keyboard.press("Control+V");
					assert.equal(await page.locator('.frame[data-control="person"]').count(), 1, `${label}: took control`);
					await containment(page, `${label} end`);

					await page.locator(".proto-picker-item").nth((d + 1) % 3).click();
					await page.locator(`.app[data-direction="${(d + 1) % 3}"]`).waitFor();
					await checkPicker(page, ROUND);
					await context.close();
					cases++;
				}
	assert.deepEqual(errors, [], "clean console");
	assert.deepEqual(requests, [], "offline: no network requests");
	console.log(
		`PASS: ${cases} direction/language/theme/viewport cases; Ctrl+V per direction, keystrokes with focus back and Backspace on the page, eye toggle, honest guidance, Escape, paste note and Done clear, takeover, picker, a11y and offline checks. Screenshots: ${out}`,
	);
} finally {
	await browser.close();
}
