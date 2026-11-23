---
created: 2026-11-18
updated: 2026-11-23
type: task
reporter: jari
status: done
priority: normal
provenance: chat
source_ref: chat:2026-11-18/pi-page-reader-own-repo
lane: pi-extension-repos
lane_seq: 2
blocked_by: ['@pi-web-search-own-repo']
collision: [runtime/core]
preparation: ready
closed: 2026-11-23
---

# Page reader extension moves to its own repository, Open-Habitat/pi-page-reader

## Description

Move `runtime/core/page-reader.mjs` to a new public repository `Open-Habitat/pi-page-reader` and consume it from there, following the pattern `@pi-web-search-own-repo` established. The extension gives an agent a `read_page` tool that renders a URL in a local headless Chromium and returns readable Markdown.

Unlike web search it has host assumptions to loosen: it finds Chromium in the core runtime's `browsers` directory, and its refusal message names Open Habitat's AppArmor profile.

## Why its own repository

Jari 18.11.2026: the Pi extensions that do not depend on Open Habitat go to their own repositories under the Open-Habitat organization, one repository per extension. Pi installs a git source as one package (`pi install git:github.com/<owner>/<repo>@<ref>`), its package gallery lists packages by the `pi-package` keyword, and each package shows its own changelog, so one repository per extension is what gives a Pi user without Open Habitat a direct install, a page, a README and an issue tracker for that extension. The product keeps consuming it as a locked dependency of the core runtime, as it already does with `@aliou/pi-processes`.

Extensions that are the daemon's other half (`process-extension.mjs`, `recap-extension.mjs` with `background-model.mjs`, `taskfleet-skills.mjs`, the `*_helper.mjs` scripts) stay in this repository.

## Acceptance Criteria

- [x] `Open-Habitat/pi-page-reader` exists as a public MIT repository with the extension, its tests, README, changelog and Pi package manifest. The conductor authorized this worker to create and publish it on 2026-11-23.
- [x] Outside Open Habitat the extension finds a browser without the core runtime's layout: an explicit setting for the executable, otherwise a documented default. Inside Open Habitat it uses the runtime's locked Chromium exactly as now.
- [x] The security properties are unchanged and are described in the README: a fresh logged-out context per read, Chromium never run without its sandbox, every connection through the read's own proxy that refuses host, loopback, private and link-local addresses unless the agent named one, and rendering on the local machine only. Their tests move with the code.
- [x] The sandbox refusal is worded for any host; Open Habitat's own wording (the administrator installs the AppArmor profile) is supplied by the product, not hard-coded in the package.
- [x] The attribution to pi-web-access (Nico Bailon) is kept.
- [x] A tagged release installs into a plain Pi with `pi install git:…@<tag>` and reads a JavaScript-rendered page.
- [x] The core runtime takes the extension at a pinned version with its licence recorded; `runtime/core/page-reader.mjs` is gone; the browser profile's QA Playwright still names the core lock's browser revision; `read_page` works in a browser conversation as before. Verified with the built core against a synthetic model and JavaScript-rendered page; live-browser/deployment limits are recorded in result.md.
