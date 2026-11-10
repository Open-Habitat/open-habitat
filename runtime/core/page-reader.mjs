// Gives every agent a `read_page` tool: it opens a URL in the core runtime's
// headless Chromium, as the person, and returns the page's readable text as
// Markdown with its links, optionally with a screenshot (Jari, 2026-11-10:
// pages that need JavaScript are for everyone). The providers' own fetch tools
// do not run JavaScript, and a hosted renderer would send every URL to a
// company nobody chose, so the page is rendered here and reaches only the site.
//
// Each read is a fresh logged-out browser context: no cookies, storage,
// downloads or service workers survive it. Chromium runs with its sandbox and
// never without it; where the installation's AppArmor profile is missing, the
// tool says so instead. A public page's requests to loopback and private
// addresses are refused by Chromium's own Local Network Access check, which
// judges the resolved address, so DNS rebinding does not get around it.
//
// The extraction follows pi-web-access (Nico Bailon, MIT): Mozilla Readability
// finds the article and Turndown writes it as Markdown, falling back to the
// page's visible text. Both run inside the rendered page here; no code is
// copied. Nothing is read from or written to the person's settings.

import { createRequire } from 'node:module';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

export const limits = {
	defaultSeconds: 30,
	maxSeconds: 60,
	defaultChars: 20000,
	maxChars: 100000,
	// Bytes the page may transfer in all, scripts and images included.
	maxBytes: 25 * 1024 * 1024,
	links: 100,
	// Reads at once in one Pi process; further calls wait their turn.
	concurrent: 2,
	// The browser stays up this long after the last read, then exits.
	idleMs: 60_000,
};

const parameters = {
	type: 'object',
	properties: {
		url: { type: 'string', description: 'The http or https URL to open.' },
		screenshot: { type: 'boolean', description: 'Also return a screenshot of the visible part of the page.' },
		offset: { type: 'integer', minimum: 0, description: 'Character offset into the page text, to continue a long page.' },
		max_chars: { type: 'integer', minimum: 1000, maximum: limits.maxChars, description: `Characters of page text to return (default ${limits.defaultChars}).` },
		timeout_seconds: { type: 'integer', minimum: 5, maximum: limits.maxSeconds, description: `Time for the whole read (default ${limits.defaultSeconds}).` },
	},
	required: ['url'],
	additionalProperties: false,
};

// The page-side extraction. `module` and `exports` are local here so that
// both libraries hand over their export instead of looking for the page's own
// AMD loader or touching its globals.
const extractor = (readability, turndown) => `(() => {
	const Readability = (() => { const module = { exports: {} }; const exports = module.exports;
		${readability}
		return module.exports; })();
	const TurndownService = (() => { const module = { exports: {} }; const exports = module.exports;
		${turndown}
		return module.exports; })();
	const html = document.contentType === 'text/html' || document.contentType === 'application/xhtml+xml';
	let article = null;
	if (html) {
		try { article = new Readability(document.cloneNode(true)).parse(); } catch {}
	}
	let markdown = '';
	if (article && article.content) {
		const td = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced', bulletListMarker: '-' });
		td.remove(['script', 'style', 'noscript', 'iframe']);
		try { markdown = td.turndown(article.content).trim(); } catch {}
	}
	const visible = (document.body ? document.body.innerText : document.documentElement.textContent || '').trim();
	// Readability keeps only what it takes for the article; a page that is
	// mostly an application or a list reads better as its visible text.
	if (markdown.length < Math.min(500, visible.length / 3)) markdown = visible;
	const links = []; const seen = new Set();
	for (const a of document.querySelectorAll('a[href]')) {
		const href = a.href;
		if (!/^https?:/.test(href) || seen.has(href)) continue;
		seen.add(href);
		links.push({ href, text: (a.innerText || a.title || '').replace(/\\s+/g, ' ').trim().slice(0, 120) });
		if (links.length >= ${limits.links}) break;
	}
	return { title: (article && article.title) || document.title || '', byline: (article && article.byline) || '', markdown, links, html };
})()`;

// Not a page Chromium shows: it downloads these.
function notAPage(type, length) {
	const size = Number(length) > 0 ? `, ${(Number(length) / 1024 / 1024).toFixed(1)} MB` : '';
	return new Error(`This URL is not a web page (${type || 'unknown type'}${size}); a browser would download it. Fetch it with curl and use a tool for that format.`);
}

function short(message) {
	return String(message).split('\n')[0].replace(/^[a-zA-Z.]+: /, '').slice(0, 300);
}

// Reads one page. `browser` is a launched Playwright browser; `sources` holds
// the Readability and Turndown script texts. Throws with a message for the
// agent when the page cannot be read.
export async function readPage(browser, sources, params, signal) {
	let target;
	try { target = new URL(params.url); } catch { throw new Error(`Not a URL: ${params.url}`); }
	if (target.protocol !== 'http:' && target.protocol !== 'https:') throw new Error('Only http and https URLs can be read.');
	const seconds = Math.min(Math.max(params.timeout_seconds ?? limits.defaultSeconds, 5), limits.maxSeconds);
	const maxChars = Math.min(Math.max(params.max_chars ?? limits.defaultChars, 1000), limits.maxChars);
	const offset = Math.max(params.offset ?? 0, 0);
	const deadline = Date.now() + seconds * 1000;
	const remaining = () => Math.max(deadline - Date.now(), 1);
	// Time kept back from the page load for extraction and the screenshot.
	const reserveMs = Math.min(5000, seconds * 250);

	const context = await browser.newContext({
		acceptDownloads: false,
		serviceWorkers: 'block',
		viewport: { width: 1280, height: 800 },
	});
	const close = () => context.close().catch(() => {});
	const timer = setTimeout(close, seconds * 1000 + 2000);
	signal?.addEventListener('abort', close, { once: true });
	try {
		const page = await context.newPage();
		// Popups would load more of the same site's pages within the budget.
		context.on('page', p => { if (p !== page) p.close().catch(() => {}); });
		let bytes = 0;
		let oversize = false;
		await context.route('**/*', route => (oversize ? route.abort('blockedbyclient') : route.continue()));
		const cdp = await context.newCDPSession(page);
		await cdp.send('Network.enable');
		cdp.on('Network.dataReceived', e => {
			bytes += e.encodedDataLength || e.dataLength || 0;
			if (bytes > limits.maxBytes && !oversize) {
				oversize = true;
				cdp.send('Page.stopLoading').catch(() => {});
			}
		});
		let response = null;
		page.on('response', r => {
			if (r.frame() === page.mainFrame() && r.request().isNavigationRequest()) response = r;
		});

		let partial = false;
		try {
			response = await page.goto(target.href, { waitUntil: 'domcontentloaded', timeout: Math.max(remaining() - reserveMs, 1000) }) ?? response;
		} catch (e) {
			if (signal?.aborted) throw new Error('Cancelled.');
			if (/Download is starting|net::ERR_ABORTED/.test(e.message) && response) {
				const headers = await response.allHeaders().catch(() => ({}));
				const type = (headers['content-type'] ?? '').split(';')[0];
				if (!/html|xml|^text\//.test(type)) throw notAPage(type, headers['content-length']);
			}
			if (e.name !== 'TimeoutError') throw new Error(`Could not open ${target.href}: ${short(e.message)}`);
			if (!response) throw new Error(`No response from ${target.host} within ${seconds} s.`);
			partial = true;
		}
		if (!partial) {
			try { await page.waitForLoadState('load', { timeout: Math.max(remaining() - reserveMs, 1) }); } catch { partial = true; }
		}
		if (!partial) {
			// Pages that render after load (single-page applications) usually
			// settle once their data requests finish; give them a moment.
			await page.waitForLoadState('networkidle', { timeout: Math.min(3000, Math.max(remaining() - reserveMs, 1)) }).catch(() => {});
		}
		if (partial) await page.evaluate('window.stop()').catch(() => {});

		const headers = response ? await response.allHeaders().catch(() => ({})) : {};
		const type = (headers['content-type'] ?? '').split(';')[0].trim();
		const status = response ? response.status() : 0;
		let stop;
		const extracted = await Promise.race([
			page.evaluate(extractor(sources.readability, sources.turndown)),
			new Promise((_, reject) => { stop = setTimeout(() => reject(new Error(`The page did not finish rendering within ${seconds} s.`)), remaining()); }),
		]).finally(() => clearTimeout(stop));
		let shot;
		if (params.screenshot) {
			shot = await page.screenshot({ type: 'jpeg', quality: 70, timeout: Math.min(remaining(), reserveMs) }).catch(() => undefined);
		}
		return format({ target, finalUrl: page.url(), status, type, extracted, partial, oversize, seconds, offset, maxChars, shot, screenshot: params.screenshot });
	} catch (e) {
		if (signal?.aborted) throw new Error('Cancelled.');
		if (/closed/i.test(e.message) && Date.now() >= deadline) throw new Error(`The page did not finish within ${seconds} s.`);
		throw e;
	} finally {
		clearTimeout(timer);
		signal?.removeEventListener('abort', close);
		await close();
	}
}

export function format({ target, finalUrl, status, type, extracted, partial, oversize, seconds, offset, maxChars, shot, screenshot }) {
	const text = extracted.markdown;
	const slice = text.slice(offset, offset + maxChars);
	const lines = [];
	if (extracted.title) lines.push(`# ${extracted.title.replace(/\s+/g, ' ').trim()}`);
	lines.push(`URL: ${finalUrl}${finalUrl !== target.href ? ` (opened ${target.href})` : ''}`);
	lines.push(`Status: ${status || 'unknown'}${type ? `, ${type}` : ''}`);
	if (extracted.byline) lines.push(`By: ${extracted.byline.replace(/\s+/g, ' ').trim()}`);
	if (status >= 400) lines.push(`Note: the site answered ${status}; the text below is its error page.`);
	if (partial) lines.push(`Note: the page did not finish loading within ${seconds} s; the text is what had rendered by then.`);
	if (oversize) lines.push(`Note: the page passed ${limits.maxBytes / 1024 / 1024} MB of transfers and loading was stopped; the text is what had arrived.`);
	if (!extracted.html && /^image\//.test(type)) lines.push(`Note: this URL is an image${screenshot ? '; see the screenshot' : '; ask for a screenshot to see it'}.`);
	if (offset >= text.length && text.length > 0) {
		lines.push(`Note: the page text has ${text.length} characters; offset ${offset} is past its end.`);
	} else if (offset > 0 || offset + maxChars < text.length) {
		const end = offset + slice.length;
		lines.push(`Note: characters ${offset}–${end} of ${text.length}${end < text.length ? `; call again with offset ${end} for more` : ''}.`);
	}
	if (screenshot && !shot) lines.push('Note: the screenshot could not be taken.');
	lines.push('', slice || '(no text)');
	if (extracted.links.length > 0) {
		lines.push('', 'Links:');
		for (const l of extracted.links) lines.push(`- [${l.text.replace(/[[\]]/g, '') || l.href}](${l.href.replace(/[()\s]/g, c => encodeURIComponent(c))})`);
	}
	const content = [{ type: 'text', text: lines.join('\n') }];
	if (shot) content.push({ type: 'image', data: shot.toString('base64'), mimeType: 'image/jpeg' });
	return {
		content,
		details: { url: target.href, finalUrl, status, contentType: type, title: extracted.title, chars: text.length, offset, returned: slice.length, partial, oversize, links: extracted.links.length, screenshot: Boolean(shot) },
	};
}

// The headless shell in a Playwright browsers directory; the core runtime
// build puts its own beside this extension.
export function headlessShell(browsers) {
	for (const dir of readdirSync(browsers).filter(d => d.startsWith('chromium_headless_shell-')).sort()) {
		// Chrome for Testing and Playwright's own builds name the directory
		// and the executable differently per platform.
		for (const sub of readdirSync(join(browsers, dir))) {
			for (const name of ['chrome-headless-shell', 'headless_shell']) {
				const path = join(browsers, dir, sub, name);
				try { if (statSync(path).isFile()) return path; } catch {}
			}
		}
	}
	throw new Error('no headless shell in ' + browsers);
}

// One slot per concurrent read; waiting counts against the caller's signal.
function semaphore(size) {
	let active = 0;
	const queue = [];
	return {
		get active() { return active; },
		async acquire(signal) {
			if (active < size) { active++; return; }
			await new Promise((resolve, reject) => {
				const entry = { resolve, reject };
				queue.push(entry);
				signal?.addEventListener('abort', () => {
					const i = queue.indexOf(entry);
					if (i >= 0) { queue.splice(i, 1); reject(new Error('Cancelled.')); }
				}, { once: true });
			});
		},
		release() {
			const next = queue.shift();
			if (next) next.resolve(); else active--;
		},
	};
}

const description = `Open a web page in a headless browser that runs its JavaScript, and return the page's readable text as Markdown with its links; optionally a screenshot.
Use it for pages that need JavaScript, or when fetching the URL directly returns no useful content. The browser is logged out and keeps nothing between reads.
Only http and https; at most ${limits.maxSeconds} s per read, ${limits.maxBytes / 1024 / 1024} MB of transfers, and ${limits.defaultChars} characters by default (use offset for more).`;

export default function (pi) {
	const runtime = dirname(dirname(fileURLToPath(import.meta.url)));
	const require = createRequire(import.meta.url);
	const slots = semaphore(limits.concurrent);
	let sources;
	let browser;
	let idle;

	const launch = async () => {
		if (browser) {
			const b = await browser.catch(() => undefined);
			if (b?.isConnected()) return b;
		}
		browser = (async () => {
			const { chromium } = await import('playwright-core');
			try {
				return await chromium.launch({ executablePath: headlessShell(join(runtime, 'browsers')), chromiumSandbox: true, timeout: 20_000 });
			} catch (e) {
				if (/sandbox/i.test(e.message)) {
					throw new Error('The browser cannot start its sandbox on this server, so pages are not read. The administrator installs Open Habitat\'s AppArmor profile for the headless browser (upgrading Open Habitat does it).');
				}
				throw new Error(`The browser did not start: ${short(e.message)}`);
			}
		})();
		browser.catch(() => { browser = undefined; });
		return browser;
	};

	const shutdown = async () => {
		clearTimeout(idle);
		const b = browser;
		browser = undefined;
		if (b) await (await b.catch(() => undefined))?.close().catch(() => {});
	};

	pi.registerTool({
		name: 'read_page',
		label: 'Read page',
		description,
		parameters,
		annotations: { readOnlyHint: true, openWorldHint: true },
		async execute(_id, params, signal) {
			sources ??= {
				readability: readFileSync(require.resolve('@mozilla/readability/Readability.js'), 'utf8'),
				turndown: readFileSync(require.resolve('turndown/lib/turndown.browser.umd.js'), 'utf8'),
			};
			await slots.acquire(signal);
			clearTimeout(idle);
			try {
				return await readPage(await launch(), sources, params, signal);
			} finally {
				slots.release();
				if (slots.active === 0) {
					idle = setTimeout(shutdown, limits.idleMs);
					idle.unref();
				}
			}
		},
	});
	pi.on('session_shutdown', shutdown);
}
