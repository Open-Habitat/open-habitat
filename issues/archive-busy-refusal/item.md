---
created: 2026-11-12
updated: 2026-11-12
type: bug
reporter: jari
status: open
priority: normal
provenance: chat
source_ref: chat:2026-11-12/archive-busy
lane: unlaned
preparation: ready
---

# Archiving conversations quickly fails with 'Toinen muutos oli juuri kesken'

## Description

Jari 12.11.2026 ~15.20 (Birch, screenshot beside this issue): archiving
conversations in quick succession showed "Arkiston muutosta ei tehty
*Yhteistapahtuman viestiluonnos* · Arkistointia ei tehty: Toinen muutos oli
juuri kesken. Yritä uudelleen. Keskustelu palautettiin listaan." He says
that is not good.

Daemon journal (`journalctl --user`): `POST /api/v1/workspaces` at
15:20:47 (200, 200), 15:20:52 (409, 200), 15:20:53 (409, 409), each 0–9 ms.
So archive operations issued close together are refused as busy (409)
instead of being serialised, and the person has to redo them by hand.

Expected: archiving several conversations quickly just works: the operations
queue behind each other (in the daemon, or the browser retries a busy
refusal itself), and the person sees an error only for a real failure.
