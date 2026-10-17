---
created: 2026-10-17
updated: 2026-10-17
type: bug
reporter: jari
status: open
priority: high
lane: unlaned
collision: [web/src/app/conversationJournal.ts]
preparation: ready
---

# Live pilot.201: page falls back to Yhteys katkesi shortly after every Yhdistä

Jari, 2026-10-17 ~06:10 local on pilot.201 (`b415878d`): after using it a while the page shows only "Yhteys katkesi". Yhdistä brings it back, but a moment later it returns to Yhteys katkesi. The test server is unusable.

Conductor's first evidence (test server, read-only): the gateway restarted with the release at 02:57:52 UTC; the daemon was socket-activated at 03:06:57; at 03:06:58 `GET /api/v1/events` returned 409 in 267 ms. Jari reloaded at ~03:09 (`/onboarding/pi/status` first-load read). After that the gateway logged no completed `/api/v1/events` request, while `GET /api/v1/pi/models` (2.6–6.4 s each) repeated every 15–60 s, which looks like a recheck loop. Overnight landings that touch this path: `refresh-without-session-reads` (9ec1c1f3, session read paired with snapshot by web identity), request logging (009331ac, response writer wrapper; Flush/Unwrap kept), version reload check (ada2ef91), queued send (98e8d78c), reconnect repair (6850b868).

## Acceptance Criteria
- [ ] Live cause named with evidence; fix lands; a browser test reproduces the loop; after release the conductor confirms on the test server that the page stays connected.
