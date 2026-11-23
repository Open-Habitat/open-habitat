---
created: 2026-11-22
updated: 2026-11-23
type: feature
reporter: jari
status: open
priority: normal
provenance: chat
source_ref: chat:2026-11-22:own-machines-ssh-config
lane: own-machines-ssh
lane_seq: 1
preparation: ready
---

# Prototype: Omat koneet shows the existing connections from ~/.ssh/config

## Description

Jari (22.11.2026): the Omat koneet page (Settings › Omat koneet) knows only machines added through Habitat's guided setup; on our household installation the person's account already has working SSH connections in ~/.ssh/config, which the page does not show. Jari approved a prototype round (22.11. evening): how existing ~/.ssh/config hosts appear on the page, how the person adopts one as an own machine (or leaves it), what Habitat may read and never write there.

## Decisions

### 2026-11-23T04:20:14Z · @jari

Jari 23.11.2026: direction A (Oma ryhmä, a separate group for hosts found in ~/.ssh/config) approved. Next action: implement it as an experimental feature (off until turned on in Kokeelliset ominaisuudet) following the prototype and the host-side sketch in result.md: read-only parsing, never write ~/.ssh/config or known_hosts, check reachability only on request.
