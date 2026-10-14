# Syntax highlighting result

Implemented highlight.js core with individually imported local grammars in answer fences, code/output boxes and file read/write cards. File edits keep their add/delete and changed-word presentation; unpaired lines receive syntax spans. TOML uses INI, HTML uses XML. Explicit unknown languages stay plain; only complete untagged answer fences are candidates for conservative detection (four grammars, relevance ≥ 8). Partial streams debounce for 180 ms, parsing waits for visibility, and blocks over 16,384 characters stay plain. HTML from the library is parsed into React text and allowlisted span nodes only after its text matches the source. Copy still uses source text.

## Evidence

- `npm ci --prefix web`; `./scripts/test-focused.sh --area web` passed (39 test files / 233 tests). Vitest covers aliases, hostile markup, incomplete fences, unknown languages, size limits and lazy rendering.
- Production `npm run build --prefix web` emitted individual `/assets/{python,rust,json,yaml,bash,markdown,typescript,javascript,go,xml,css,ini,diff}-*.js` chunks, referenced by same-origin Vite dynamic imports; no runtime CDN or inline evaluation. These paths use the same origin as the main module and work under a same-origin `script-src` CSP. The app's built HTML has no restrictive CSP header of its own; deployment CSP must allow its existing Vite module assets.
- Browser `@file-tool-cards` and `@syntax-wrap` specs passed; the latter checks Markdown ancestry's computed wrap style and measured width. Host-backed screenshots: `lab-file-card-light.png`, `lab-file-card-dark.png` (both in this folder). Browser wrap test now checks actual scroll width rather than just the button state.
- Clean gate attempt 1 stopped at screenshot-spec formatting; fixed. Attempt 2 ran 159/160 browser cases successfully; `ended browser conversation continues explicitly without reposting` timed out after its button detached and passed on the one isolated rerun (`/var/tmp/syntax-gate-retry.log`, `/var/tmp/syntax-flaky-rerun.log`). After review fixes the final clean gate is rerun. The first post-review gate was intentionally stopped before its browser phase completed when independent verification found a remaining Markdown-specific wrap override; the regression test now covers it.
- WCAG contrast against `--ah-sunken`: light syntax token minimum 5.22:1; dark minimum 7.74:1, computed using sRGB relative luminance. The diff tint remains on its outer line and word spans.

## Decisions for later review

- Chose 16 KiB syntax bound and 180 ms partial-block debounce as conservative initial browser scheduling limits; measure actual frame time with longer live streams before increasing them. This trades large-block colour for responsive scroll and streaming.
- Detection is only enabled on unlabelled Markdown fences and standalone unlabelled CodeBlock, not generic tool output: guessing languages in arbitrary command output is misleading. Detection waits until a fence is closed; unknown explicit labels never trigger it.
