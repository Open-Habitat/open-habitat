---
created: 2026-10-16
updated: 2026-10-30
type: bug
reporter: jari
status: fixed
priority: high
lane: reconnect
collision: [web/src/app/, web/src/components/]
preparation: ready
lane_seq: 1
closed: 2026-10-30
closed_by: agent
---

# Yhdistä still does nothing live

Jari, 2026-10-16 18:0x local: "Nyt katkesi taas yhteys, ja Yhdistä-painike ei tee mitään. Tuntuu siltä, että on ihan turha räpsyttää sitä yhteyspainiketta." (In short: the connection dropped again, and the Yhdistä button does nothing; pressing it feels pointless.) The fix from `reconnect-button-dead` (94d56f4e "reconnect immediately") is live, but Yhdistä still does nothing for him. Find the live cause from evidence, as in `plus-live-cause`. On the disposable test server, read the gateway and daemon logs around his reconnect attempts and the event-stream responses for the mapped user `maintainer`, and never read conversation content. Find out what Yhdistä actually calls, and why the stream does not recover: for example a stale EventSource, an auth or session cookie after a restart, a gateway rejecting, or a retry backoff that ignores the click. Fix it. Also make the banner reflect real progress: Yhdistetään…, then success, or a concrete failure reason.

## Acceptance Criteria
- [x] The named live cause with evidence in result.md.
- [x] Yhdistä recovers after a real gateway and daemon restart in a host-backed browser test, and the banner shows progress and outcome.

## Investigation status

Named in [result.md](result.md): every snapshot refresh cancelled the read before
it, and a running turn asks for refreshes faster than a read through the live
route finishes, so no read finished during a turn. The Oct 16 build left the
stale banner only on a finished read, so Yhdistä (itself a read) did nothing until
the turn stopped. cloudflared's log shows 35 cancelled snapshot reads in six
minutes after the restart while the stream advanced to sequence 416; Birch still
cancels more than half of Jari's reads. Fixed with one read at a time, bounded
reads, and a stream that reopens after sleep or a network change.

## Decisions

### 2026-10-30T07:11:20Z · @jari

Jari 30.10.: tee.
