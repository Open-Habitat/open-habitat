---
created: 2026-10-17
updated: 2026-10-17
type: chore
reporter: jari
status: done
priority: normal
lane: unlaned
collision: [scripts/inspect-trace.sh]
preparation: ready
closed: 2026-10-17
---

# Script for workers to inspect Playwright traces without rm -rf

A worker (run 01m531x5hck7hfx5wrqdrn6xr1, 2026-10-16) sat seven hours on a Claude Code safety prompt: to read failing Playwright traces it ran `cd /var/tmp/oh-wrq/tr && rm -rf * && unzip -o -q <web/test-results/<test>/trace.zip>`; the glob target could not be resolved, so Claude Code asked for confirmation and nobody answered. Jari, 2026-10-17: every such prompt is checked, and a recurring need gets a ready script.

Add `scripts/inspect-trace.sh <trace.zip|test-results dir>`: unzips into a fresh `mktemp -d` under a disk-backed TMPDIR, prints the path, a short summary (failing action, console errors, last network errors) and how to view it, and never deletes anything outside the directory it created. Name it in `TESTING.md` and `web/AGENTS.md` where traces are discussed.

## Acceptance Criteria
- [x] Script works on a real failing test's trace; documented in TESTING.md and web/AGENTS.md.
