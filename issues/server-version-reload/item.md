---
created: 2026-10-16
updated: 2026-10-16
type: feature
reporter: jari
status: open
priority: high
lane: web
collision: [web/src/app/, web/src/components/, internal/gateway]
preparation: ready
---

# Show the server version in Palvelin settings; notice a new version and ask to reload

Jari, 2026-10-16 evening. Two related wishes:
1. **Server version visible.** Asetukset → Palvelimen ylläpito → Palvelin shows only "Palvelimen nimi". It should also show the running server version (release version and commit, from what the gateway already knows, e.g. `open-habitat --json version` provenance).
2. **Notice a new version.** The test server is upgraded on every push to main, and an old open tab keeps running the previous bundle. Twice on 2026-10-16 a reported bug turned out to be likely an old tab (`older-history-button-stays`, `sidebar-workspace-not-updated`). "Tämmöinen toiminnallisuus olisi hyvä." The browser should notice that the server runs a newer version than its bundle and ask the person to reload, without losing a draft. Design how first (where the version comes from, how the tab learns it, e.g. on reconnect/SSE hello or a periodic check, and what the prompt looks like), record it in result.md, then implement.

Authority: the version is non-secret release metadata, shown to every signed-in user is fine; the gateway serves it, the daemon is not involved unless its own version differs (if a running daemon is older than the gateway, say so in the admin view).

## Acceptance Criteria
- [ ] Palvelin settings show the running version (browser test).
- [ ] A tab with an older bundle shows a reload prompt after the server version changes; drafts survive the reload (browser test across a simulated upgrade).
