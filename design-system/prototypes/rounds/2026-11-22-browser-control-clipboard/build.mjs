// Offline-only comparison round; no production entrypoint or shared library changes.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
const here = dirname(fileURLToPath(import.meta.url));
const design = resolve(here, "../../..");
const out = resolve(
	process.argv[2] || join(here, "../../dist/browser-control-clipboard"),
);
function css(path) {
	return readFileSync(path, "utf8")
		.replace(/@import\s+["']([^"']+)["'];/g, (_, p) =>
			css(resolve(dirname(path), p)),
		)
		.replace(/url\(["']?([^)'"\s]+)["']?\)/g, (m, p) =>
			p.startsWith("data:")
				? m
				: `url(data:font/woff2;base64,${readFileSync(resolve(dirname(path), p)).toString("base64")})`,
		);
}
const styles =
	css(join(design, "styles.css")) +
	"\n" +
	readFileSync(join(here, "../../lib/picker.css"), "utf8") +
	"\n" +
	readFileSync(join(here, "round.css"), "utf8");
const js =
	readFileSync(join(here, "round.js"), "utf8") +
	"\n" +
	readFileSync(join(here, "../../lib/picker.js"), "utf8");
const html = `<!doctype html><html lang="fi" data-theme="light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="prototype-round" content="2026-11-22-browser-control-clipboard"><title>Palvelinselaimen ohjaus ja leikepöytä</title><style>${styles}</style></head><body><div id="stage"></div><nav class="proto-picker" aria-label="Prototype direction"><div class="proto-picker-highlight"></div><button class="proto-picker-item">1 Kehys</button><button class="proto-picker-item">2 Palkki</button><button class="proto-picker-item">3 Paneeli</button></nav><script>${js.replace(/<\/script/gi, "<\\/script")}</script></body></html>`;
mkdirSync(out, { recursive: true });
writeFileSync(join(out, "offline.html"), html);
console.log(join(out, "offline.html"));
