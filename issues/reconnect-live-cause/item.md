---
created: 2026-10-16
updated: 2026-10-21
type: bug
reporter: jari
status: open
priority: high
lane: unlaned
collision: [web/src/app/, web/src/components/]
preparation: ready
lane_seq: 99
---

# Yhdistä still does nothing live

Jari, 2026-10-16 18:0x local: "Nyt katkesi taas yhteys, ja Yhdistä-painike ei tee mitään. Tuntuu siltä, että on ihan turha räpsyttää sitä yhteyspainiketta." (In short: the connection dropped again, and the Yhdistä button does nothing; pressing it feels pointless.) The fix from `reconnect-button-dead` (94d56f4e "reconnect immediately") is live, but Yhdistä still does nothing for him. Find the live cause from evidence, as in `plus-live-cause`. On the disposable test server, read the gateway and daemon logs around his reconnect attempts and the event-stream responses for the mapped user `maintainer`, and never read conversation content. Find out what Yhdistä actually calls, and why the stream does not recover: for example a stale EventSource, an auth or session cookie after a restart, a gateway rejecting, or a retry backoff that ignores the click. Fix it. Also make the banner reflect real progress: Yhdistetään…, then success, or a concrete failure reason.

## Acceptance Criteria
- [ ] The named live cause with evidence in result.md.
- [x] Yhdistä recovers after a real gateway and daemon restart in a host-backed browser test, and the banner shows progress and outcome.

## Investigation status

The live journals establish a gateway/daemon restart, but do not identify why the browser's actual retry failed. The issue remains open. [Investigation and repair](result.md) separates that missing attribution from a reproduced equal-cursor recovery loop, progress/error feedback and passing host-backed restart tests. The repair is carried onto main with content-free browser diagnostics for the next occurrence; it is not a proven fix for the original live incident. See the result’s "Decisions for later review".
