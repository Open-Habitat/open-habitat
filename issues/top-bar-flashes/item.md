---
created: 2026-10-25
updated: 2026-10-25
type: bug
status: fixed
priority: normal
preparation: ready
provenance: chat
lane: unlaned
collision: [web/src/app/]
closed: 2026-10-25
commits:
- hash: 73cd268f
  summary: Keep idle event streams open over HTTP/2 and stop reconnect flashes
- hash: a952eb0d
  summary: Announce only dropped streams the probe cannot recover
---

# A top bar flashes a couple of times a minute on Birch

## Description

Jari 2026-10-25 on https://habitat.example.test (Birch, pilot.10, first session after sign-in): "Sivulla välähtelee jokin yläpalkki joka katoaa niin nopeasti että en kerkeä näkemään mitä siinä sanotaan … Välähtely tapahtuu nyt pari kertaa minuutissa." A top bar appears and vanishes a couple of times a minute, too fast to read.

Context: Jari's laptop reaches Birch only through Tailscale's DERP relay (Helsinki) until Birch is bridged onto the home LAN, so latency is higher and long-lived streams may drop. Gateway logs show slow UI and API requests (1–5 s) but no logged event-stream requests in that window.

## Goal

Find which bar flashes and why (likely the connection/reconnect banner on event-stream drops or a status poll), fix the cause if it is a product defect (e.g. a stream that drops on a timer or proxy idle timeout), and in any case do not flash a banner for a reconnect that succeeds within a few seconds: show it only when the condition lasts long enough to read, and keep it visible long enough to read.

## Acceptance Criteria

- [ ] The flashing element and its trigger identified with evidence.
- [ ] No sub-second banner flashes on transient reconnects (test with injected short stream drops); a real outage still shows a readable banner.

## Decisions

### 2026-10-25T04:10:29Z · @jari

Jari 2026-10-25: the fix is needed on Birch specifically, where the problem occurs. Once landed: cut a release, upgrade Birch first and confirm the fix there, then upgrade the Northwind pilot.
