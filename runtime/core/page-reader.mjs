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
// tool says so instead.
//
// Every connection the read makes goes through a proxy of its own here, which
// resolves the name, refuses this host's own, loopback, private, link-local
// and shared addresses unless the agent asked for such an address itself, and
// connects to the address it checked. A page therefore cannot steer the
// browser at a service on the host or the person's network, by redirect,
// script, worker or DNS rebinding, and the transfer bound covers all of it.
// WebRTC may use only the proxy. The proxy serves only connections of this
// Unix user, which the kernel's socket table names; a password would not do,
// because Playwright offers the proxy's credentials to any site that asks.
//
// The extraction follows pi-web-access (Nico Bailon, MIT): Mozilla Readability
// finds the article and Turndown writes it as Markdown, falling back to the
// page's visible text. Both run inside the rendered page here; no code is
// copied. Nothing is read from or written to the person's settings.

import { createRequire } from 'node:module';
import { lookup } from 'node:dns/promises';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import { networkInterfaces } from 'node:os';
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
	// Characters of a title, byline, link text or link address.
	field: 300,
	href: 2000,
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
const extractor = (readability, turndown, limit) => `(() => {
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
		if (!/^https?:/.test(href) || href.length > ${limits.href} || seen.has(href)) continue;
		seen.add(href);
		links.push({ href, text: (a.innerText || a.title || '').replace(/\\s+/g, ' ').trim().slice(0, 120) });
		if (links.length >= ${limits.links}) break;
	}
	const clip = t => String(t || '').replace(/\\s+/g, ' ').trim().slice(0, ${limits.field});
	// Only what the read returns crosses into the agent's process.
	return { title: clip((article && article.title) || document.title), byline: clip(article && article.byline), markdown: markdown.slice(0, ${limit}), chars: markdown.length, links, html };
})()`;

// Addresses a page may not reach unless the agent asked for one itself:
// this host, private and shared (carrier-grade, tailnet) networks, link-local
// (cloud metadata), and the unspecified and multicast ranges.
const local = new net.BlockList();
for (const [a, n] of [['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.168.0.0', 16], ['224.0.0.0', 3]]) local.addSubnet(a, n, 'ipv4');
for (const [a, n] of [['::', 128], ['::1', 128], ['fc00::', 7], ['fe80::', 10], ['ff00::', 8]]) local.addSubnet(a, n, 'ipv6');

export function localAddress(ip) {
	const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip);
	if (mapped) return localAddress(mapped[1]);
	// The host's own interface addresses, public ones included: a service
	// bound to all of them is reached over loopback, past the firewall.
	const own = Object.values(networkInterfaces()).flat().some(i => i?.address === ip);
	return own || local.check(ip, net.isIP(ip) === 6 ? 'ipv6' : 'ipv4');
}

// The Unix user owning the loopback connection from `peerPort` to `port`, from
// the kernel's table of this network namespace, or -1.
export function socketOwner(peerPort, port) {
	const hex = n => '0100007F:' + n.toString(16).toUpperCase().padStart(4, '0');
	let table;
	try { table = readFileSync('/proc/self/net/tcp', 'utf8'); } catch { return -1; }
	for (const line of table.split('\n').slice(1)) {
		const f = line.trim().split(/\s+/);
		if (f[1] === hex(peerPort) && f[2] === hex(port)) return Number(f[7]);
	}
	return -1;
}

async function resolve(host) {
	const bare = host.replace(/^\[|\]$/g, '');
	if (net.isIP(bare)) return [bare];
	return (await lookup(bare, { all: true, verbatim: true })).map(a => a.address);
}

// The read's forward proxy. `allowLocal` is decided from the agent's own URL;
// `isLocal` is replaceable for tests, whose servers all live on loopback.
export async function egress({ allowLocal, maxBytes, isLocal = localAddress }) {
	const sockets = new Set();
	const state = { bytes: 0, oversize: false, refused: new Set() };
	const count = n => {
		state.bytes += n;
		if (state.bytes > maxBytes && !state.oversize) {
			state.oversize = true;
			for (const s of sockets) s.destroy();
		}
	};
	const track = s => { sockets.add(s); s.on('close', () => sockets.delete(s)); return s; };
	// The checked address to connect to, or undefined when the host is refused.
	const target = async host => {
		if (state.oversize) return undefined;
		let addresses;
		try { addresses = await resolve(host); } catch { return undefined; }
		if (addresses.length === 0) return undefined;
		if (!allowLocal && addresses.some(isLocal)) {
			state.refused.add(host);
			return undefined;
		}
		return addresses[0];
	};
	const deny = (socket, status) => {
		socket.end(`HTTP/1.1 ${status}\r\nContent-Length: 0\r\nConnection: close\r\n\r\n`);
	};
	const server = http.createServer(async (req, res) => {
		let url;
		try { url = new URL(req.url); } catch { deny(req.socket, '400 Bad Request'); return; }
		const ip = url.protocol === 'http:' ? await target(url.hostname) : undefined;
		if (!ip) { deny(req.socket, '403 Forbidden'); return; }
		const headers = { ...req.headers };
		delete headers['proxy-authorization'];
		delete headers['proxy-connection'];
		const up = http.request({ host: ip, port: url.port || 80, method: req.method, path: url.pathname + url.search, headers, agent: false, setHost: false }, upRes => {
			res.writeHead(upRes.statusCode, upRes.rawHeaders);
			upRes.on('data', c => count(c.length));
			upRes.pipe(res);
		});
		up.on('socket', s => track(s));
		up.on('error', () => req.socket.destroy());
		req.pipe(up);
	});
	server.on('connect', async (req, client, head) => {
		client.on('error', () => {});
		const at = req.url.lastIndexOf(':');
		const host = req.url.slice(0, at);
		const port = Number(req.url.slice(at + 1));
		const ip = Number.isInteger(port) && port > 0 && port < 65536 ? await target(host) : undefined;
		if (!ip) { deny(client, '403 Forbidden'); return; }
		const up = track(net.connect(port, ip, () => {
			client.write('HTTP/1.1 200 Connection Established\r\n\r\n');
			if (head.length) up.write(head);
			up.on('data', c => count(c.length));
			up.pipe(client);
			client.pipe(up);
		}));
		up.on('error', () => client.destroy());
	});
	server.on('connection', socket => {
		track(socket);
		socket.on('error', () => {});
		if (socketOwner(socket.remotePort, server.address().port) !== process.getuid()) socket.destroy();
	});
	server.on('clientError', (e, socket) => socket.destroy());
	await new Promise((ok, fail) => server.listen(0, '127.0.0.1', ok).once('error', fail));
	return {
		state,
		proxy: { server: `http://127.0.0.1:${server.address().port}`, bypass: '<-loopback>' },
		close: () => {
			for (const s of sockets) s.destroy();
			server.closeAllConnections();
			return new Promise(ok => server.close(() => ok()));
		},
	};
}

// WebRTC would send UDP past the proxy; it may use only the proxy.
export const launchArgs = ['--force-webrtc-ip-handling-policy=disable_non_proxied_udp'];

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
export async function readPage(browser, sources, params, signal, { isLocal = localAddress } = {}) {
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
	const cancelled = () => { if (signal?.aborted) throw new Error('Cancelled.'); };

	cancelled();
	// The agent may read a service on the host or its network itself, as it
	// could with curl; only then may the page reach such addresses too.
	let addresses;
	try { addresses = await resolve(target.hostname); } catch { addresses = []; }
	if (addresses.length === 0) throw new Error(`Could not resolve ${target.hostname}.`);
	// Every address, not some: a name that is half public and half local
	// stays refused, so a public page cannot unlock the host with it.
	const out = await egress({ allowLocal: addresses.every(isLocal), maxBytes: limits.maxBytes, isLocal });
	let context;
	const close = async () => { await context?.close().catch(() => {}); await out.close(); };
	const timer = setTimeout(close, seconds * 1000 + 2000);
	signal?.addEventListener('abort', close, { once: true });
	try {
		cancelled();
		context = await browser.newContext({
			acceptDownloads: false,
			serviceWorkers: 'block',
			viewport: { width: 1280, height: 800 },
			proxy: out.proxy,
		});
		cancelled();
		const page = await context.newPage();
		// Popups would load more of the same site's pages within the budget.
		context.on('page', p => { if (p !== page) p.close().catch(() => {}); });
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
		if (partial || out.state.oversize) await page.evaluate('window.stop()').catch(() => {});

		const headers = response ? await response.allHeaders().catch(() => ({})) : {};
		const type = (headers['content-type'] ?? '').split(';')[0].trim();
		const status = response ? response.status() : 0;
		let stop;
		const extracted = await Promise.race([
			page.evaluate(extractor(sources.readability, sources.turndown, offset + maxChars)),
			new Promise((_, reject) => { stop = setTimeout(() => reject(new Error(`The page did not finish rendering within ${seconds} s.`)), remaining()); }),
		]).finally(() => clearTimeout(stop));
		let shot;
		if (params.screenshot) {
			shot = await page.screenshot({ type: 'jpeg', quality: 70, timeout: Math.min(remaining(), reserveMs) }).catch(() => undefined);
		}
		return format({ target, finalUrl: page.url(), status, type, extracted, partial, oversize: out.state.oversize, refused: [...out.state.refused], seconds, offset, maxChars, shot, screenshot: params.screenshot });
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

export function format({ target, finalUrl, status, type, extracted, partial, oversize, refused = [], seconds, offset, maxChars, shot, screenshot }) {
	const text = extracted.markdown;
	const total = extracted.chars ?? text.length;
	const slice = text.slice(offset, offset + maxChars);
	const lines = [];
	// Everything the page controls is bounded, not only its text.
	const clip = (t, n = limits.field) => String(t ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
	const title = clip(extracted.title);
	const shown = clip(finalUrl, limits.href);
	if (title) lines.push(`# ${title}`);
	lines.push(`URL: ${shown}${finalUrl !== target.href ? ` (opened ${clip(target.href, limits.href)})` : ''}`);
	lines.push(`Status: ${status || 'unknown'}${type ? `, ${clip(type, 100)}` : ''}`);
	if (extracted.byline) lines.push(`By: ${clip(extracted.byline)}`);
	if (refused.length > 0) lines.push(`Note: the page tried to reach addresses on this host or a private network, which were refused: ${refused.slice(0, 5).map(h => clip(h, 100)).join(', ')}${refused.length > 5 ? ', …' : ''}.`);
	if (status >= 400) lines.push(`Note: the site answered ${status}; the text below is its error page.`);
	if (partial) lines.push(`Note: the page did not finish loading within ${seconds} s; the text is what had rendered by then.`);
	if (oversize) lines.push(`Note: the page passed ${limits.maxBytes / 1024 / 1024} MB of transfers and loading was stopped; the text is what had arrived.`);
	if (!extracted.html && /^image\//.test(type)) lines.push(`Note: this URL is an image${screenshot ? '; see the screenshot' : '; ask for a screenshot to see it'}.`);
	if (offset >= total && total > 0) {
		lines.push(`Note: the page text has ${total} characters; offset ${offset} is past its end.`);
	} else if (offset > 0 || offset + maxChars < total) {
		const end = offset + slice.length;
		lines.push(`Note: characters ${offset}–${end} of ${total}${end < total ? `; call again with offset ${end} for more` : ''}.`);
	}
	if (screenshot && !shot) lines.push('Note: the screenshot could not be taken.');
	lines.push('', slice || '(no text)');
	if (extracted.links.length > 0) {
		lines.push('', 'Links:');
		for (const l of extracted.links.slice(0, limits.links)) {
			const href = clip(l.href, limits.href);
			lines.push(`- [${clip(l.text, 120).replace(/[[\]]/g, '') || href}](${href.replace(/[()\s]/g, c => encodeURIComponent(c))})`);
		}
	}
	const content = [{ type: 'text', text: lines.join('\n') }];
	if (shot) content.push({ type: 'image', data: shot.toString('base64'), mimeType: 'image/jpeg' });
	return {
		content,
		details: { url: clip(target.href, limits.href), finalUrl: shown, status, contentType: clip(type, 100), title, chars: total, offset, returned: slice.length, partial, oversize, refused: refused.length, links: Math.min(extracted.links.length, limits.links), screenshot: Boolean(shot) },
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
			if (signal?.aborted) throw new Error('Cancelled.');
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
				return await chromium.launch({ executablePath: headlessShell(join(runtime, 'browsers')), chromiumSandbox: true, timeout: 20_000, args: launchArgs });
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
