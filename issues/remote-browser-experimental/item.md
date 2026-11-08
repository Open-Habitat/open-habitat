---
created: 2026-11-08
updated: 2026-11-08
type: feature
reporter: jari
status: done
priority: normal
lane: remote-browser-proto
lane_seq: 2
blocked_by: ['@proto-remote-browser-session']
preparation: ready
closed: 2026-11-08
---

# Server browser as an experimental feature

## Description

Jari 8.11.2026: "voisiko tämän prototyypin pohjalta tehdä nyt demon, jota voisi
testata". The server browser as an experimental feature (Settings ›
Kokeelliset ominaisuudet, off by default) that Jari can really use on the test
server: open his own server browser in Habitat, sign in to a service, hand it
to the agent, watch the agent work, and answer a request (e.g. MFA) for one
window.

Architecture is decided (`research-remote-browser-session` report.md and its
Decision): one browser per person in its own systemd user unit like the
editor; Xvnc (TigerVNC) on a 0600 Unix socket, Google Chrome from Google's apt
repo (minimum version only) with `--remote-debugging-pipe`, and a small
browser host (a new role of the `open-habitat` binary, run as the person) that
exposes CDP to the agent on a 0600 socket and has "take control back";
noVNC bundled in the web package through the gateway's WebSocket relay like
the shell; stop 24 h after the last viewer or agent; agent uses the running
browser without asking; no recording. Pi gets the CDP address as a
Habitat-supplied skill.

UI is `proto-remote-browser-session` rounds 1–4 (decisions in its item.md):
chip above the composer opening the strip with small live window images, the
agent's pointer and click trail visible, the browser as the top text row in
the rail, and round 4 direction **2 Esiin** (the window that needs you grows
large in the strip with its request beside it; *Ota ohjaus ja syötä koodi* /
*Katso ensin*; control is whole-browser, the agent waits; viewing never takes
control).

A demo, not the finished product: the smallest end-to-end slice that works
for real beats complete polish. Systemd units, packages and AppArmor need a
Fleetrepo installation change in the same round; record exactly what Fleetrepo
must install in result.md.
