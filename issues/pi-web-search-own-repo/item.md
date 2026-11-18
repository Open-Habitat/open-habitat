---
created: 2026-11-18
updated: 2026-11-18
type: task
reporter: jari
status: open
priority: normal
provenance: chat
source_ref: chat:2026-11-18/pi-web-search-own-repo
lane: pi-extension-repos
lane_seq: 1
collision: [runtime/core]
preparation: ready
---

# Web search extension moves to its own repository, Open-Habitat/pi-web-search

## Description

## Description

Move `runtime/core/web-search.mjs` to a new public repository `Open-Habitat/pi-web-search` and consume it from there. The extension adds the model provider's own server-side web search to Pi's requests and has no coupling to the host: no environment variable, socket or path of Open Habitat's.

This is the first of three extractions and establishes the pattern the other two reuse: repository layout, licence, release and how the core runtime locks the result.

## Why its own repository

Jari 18.11.2026: the Pi extensions that do not depend on Open Habitat go to their own repositories under the Open-Habitat organization, one repository per extension. Pi installs a git source as one package (`pi install git:github.com/<owner>/<repo>@<ref>`), its package gallery lists packages by the `pi-package` keyword, and each package shows its own changelog, so one repository per extension is what gives a Pi user without Open Habitat a direct install, a page, a README and an issue tracker for that extension. The product keeps consuming it as a locked dependency of the core runtime, as it already does with `@aliou/pi-processes`.

Extensions that are the daemon's other half (`process-extension.mjs`, `recap-extension.mjs` with `background-model.mjs`, `taskfleet-skills.mjs`, the `*_helper.mjs` scripts) stay in this repository.

## Acceptance Criteria

- [ ] `Open-Habitat/pi-web-search` exists as a public MIT repository with the extension, its tests, a README for a Pi user who has never heard of Open Habitat (what it does, which providers it covers, install, what it sends where), a changelog in Pi's format and a `package.json` carrying the `pi-package` keyword and a `pi.extensions` manifest. The conductor creates the repository; a worker cannot.
- [ ] The attributions the file carries today (pi-web-search by ttttmr, pi-web-access by Nico Bailon) are kept.
- [ ] A tagged release exists and `pi install git:github.com/Open-Habitat/pi-web-search@<tag>` loads the extension in a plain Pi with no Open Habitat present.
- [ ] The core runtime takes the extension from that release at a pinned version with its licence recorded, through the same lock and closure checks as the other runtime dependencies, and `runtime/core/web-search.mjs` is gone from this repository.
- [ ] Web search in a browser conversation works as before for the ChatGPT subscription, OpenAI keys and Anthropic keys; a person's own search tool still takes precedence.
- [ ] `runtime/core/AGENTS.md` says where the extension lives and how its pin is raised. The steps that the next two extractions repeat are written once, in this issue's Implementation Notes or the nearest `AGENTS.md`.
