# Dependency and license boundary

Open Habitat has no third-party Go module in the foundation. Browser
runtime and build dependencies are exact pins in `web/package-lock.json`.
`scripts/check-licenses.py` requires every direct package to declare license
metadata and rejects AGPL/GPL dependencies. Transitive notices remain available
from the lockfile/package artifacts; adding a dependency requires review of its
source, authority boundary, maintenance status and license before lockfile
commit. The chosen public distribution license is MIT, but until the root
`LICENSE` file exists no script may imply permission beyond dependency
licenses.

The optional native Pi process owner is `@aliou/pi-processes` 0.10.9 (MIT),
pinned and installed through the host's native runtime, not bundled JavaScript
in the browser. Its parser is overridden to `@aliou/sh` 0.3.4 (MIT AND
BSD-3-Clause), retaining upstream attribution; 0.2.2 declares UNLICENSED and is
not shipped. The synthetic Pi integration-test lockfile mirrors that override.
The product companion itself is original code embedded in the Go binary.

The core runtime's web search extension (`runtime/core/web-search.mjs`) is
original code. Its provider tool shapes follow `pi-web-search` 1.7.0 (ttttmr,
MIT) and `pi-web-access` 0.47.0 (Nico Bailon, MIT), which it credits; no code is
copied from either and neither is installed. The core runtime build changes one
line of `pi-claude-bridge` 0.12.0 (Eli Dickinson, MIT), which MIT permits: its
provider path gives Claude Code the WebSearch and WebFetch tools
(`BRIDGE_PATCH` in `scripts/core-runtime-build.py`). The package keeps its
LICENSE in the closure.

The core runtime's page reader (`runtime/core/page-reader.mjs`) is original
code. Its extraction follows `pi-web-access` 0.47.0 (Nico Bailon, MIT): Mozilla
Readability, then Turndown. No code is copied from it, and it is not
installed. The core runtime installs `playwright-core` 1.58.0 (Microsoft,
Apache-2.0), `@mozilla/readability` 0.6.0 (Apache-2.0) and `turndown` 7.2.0
(Dom Christie, MIT), with Turndown's Node DOM `@mixmark-io/domino` 2.2.0
(BSD-2-Clause), which the reader does not load. All of them keep their licence
files in the closure. The headless shell is Chromium 145.0.7632.6 from
`runtime/core/browser-lock.json`, carrying its `LICENSE.headless_shell`. For the
arm64 build, which ships no notice of its own, that notice comes from the same
version's Chrome for Testing archive.

The daemon's Palaa tähän extension (`internal/daemon/rewind-extension.mjs`,
embedded in the Go binary) adapts the checkpoint capture, tracked-path rules
and restore of better-pi-rewind (raine, MIT, commit e42fa9c). Nothing is
installed from npm; the extension carries the upstream copyright and
permission notice in its header, and the Go preview's line count names it.

CodeMirror 6 and its Lezer parser/highlighter packages are MIT-licensed upstream
modules from the maintained CodeMirror project. They run as bundled browser
text-editing libraries only, with no repository plugins, preview execution,
network loader or language-server process. The selected grammars load on demand;
versions and transitive artifacts are pinned in the web lockfile.

The browser editor's three-way line merge is `node-diff3` 3.2.1 (MIT, no
dependencies, about 12 kB unminified), the diff3 implementation maintained by
OpenStreetMap iD's author. It only compares strings already in the browser;
it has no I/O. The concurrent-edit design Jari chose on 2026-10-24 asked for
a mature library rather than our own algorithm; it is pinned exactly in the
web lockfile.

Attachment previews render documents in the person's own tab from bytes the
app has already fetched with their session, loaded only when a document is
opened. `pdfjs-dist` 6.4.299 (Apache-2.0, Mozilla's pdf.js) draws PDF pages
onto canvases; only its core library and worker ship, not its viewer, so a
document's JavaScript has nothing to run in. Its optional `@napi-rs/canvas`
dependency serves Node only and never reaches the browser bundle.
`docx-preview` 0.4.1 (Apache-2.0, with `jszip`, MIT OR GPL-3.0-or-later used
under MIT) lays out Word documents; it builds into an inert document with
altChunk rendering off, and the result is cleaned and shown in a sandboxed
frame with no scripts, origin or network. `fflate` 0.8.3 (MIT, no
dependencies) unzips Excel and PowerPoint files for the app's own small
readers of cell values and slide text. No maintained, permissively licensed
library lays out slides in the browser, and SheetJS's maintained releases are
not on the npm registry, which is why those two formats use our readers.
