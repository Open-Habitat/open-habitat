---
created: 2026-11-22
updated: 2026-11-22
type: improvement
reporter: jari
status: open
priority: normal
lane: server-browser-settings
lane_seq: 2
preparation: ready
---

# Server browser: a working agent tool, downloads, guidance in running conversations, ask-first rule

## Observed (testing agent, 22.11.2026, test server pilot.823)

An agent fetched 10 trips and 13 receipts from a site the person had signed in to in their server browser. Sign-in sharing worked and `browser status` was enough to start. Friction, most important first:

1. The browser skill (`internal/daemon/browser-skill/SKILL.md`) offers only Playwright, Puppeteer or chrome-devtools-mcp, all of which need Node; the agent's PATH has no `node`/`npm`. The agent wrote its own Python CDP client. Another agent could give up and tell the person the browser cannot be used. Whether Playwright accepts the `ws+unix://` endpoint was not verified.
2. The skill loads only into conversations started after the switch was turned on; a running conversation's agent gets no guidance although `open-habitat agent browser …` commands exist.
3. No guidance or tool for downloads: a PDF receipt opens in Chrome's viewer, `Page.printToPDF` printed the viewer (13 image-only PDFs); the originals had to be fetched with the page's own `fetch`.
4. The skill lets the agent use the signed-in browser without asking, "only as the task needs", but has no rule for purchases, cancellations or messages to other people.

## Expected

A ready tool available whenever the switch is on (e.g. `open-habitat agent browser goto|text|links|click|type|screenshot|download` or a built-in MCP server), a download folder named in `status`, guidance reachable from a running conversation (`open-habitat skill print browser`, a pointer in `browser status`), and an explicit "ask first" rule for purchases, cancellations, sending messages and other irreversible actions.
