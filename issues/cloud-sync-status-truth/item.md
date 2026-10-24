---
created: 2026-10-24
updated: 2026-10-24
type: bug
status: fixed
priority: normal
preparation: ready
lane: unlaned
collision: [web/src/components/Integrations]
closed: 2026-10-24
---

# File-service card does not show whether sync actually works (only the check time moves)

## Description

Jari, 2026-10-24 (test server): his Dropbox card now shows the first sync as incomplete (`dropbox-status-unknown`). "En ole varma, että synkronointi toimii. Kai siinä jotakin tapahtuu, mutta se kellonaika ei päivity" — only a time that changes about every 20 s (the status check), nothing that tells whether files are actually syncing.

Find out on the disposable test server whether Jari's Dropbox (and other file services) are actually syncing now (rclone bisync runs, their result, last successful pass), using metadata, unit state and journals only — never file contents. Then make the card tell the truth in a way a person can trust: the last *successful* sync time (not the last check), an in-progress state with something that moves (e.g. files transferred) during a pass, and a concrete failure when a pass fails. Coordinate with `first-sync-resume-after-restart` (running in parallel; it owns resuming the interrupted first pass) — do not take over its scope; rebase onto it if it lands first.

## Acceptance Criteria

- [ ] Live finding in result.md: is it syncing, and what did the card show vs. reality.
- [ ] Card shows last successful sync time and in-progress/failure states from real daemon data (tests, story).
- [ ] KOKEILTAVAA.md line.
