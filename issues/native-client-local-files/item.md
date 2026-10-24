---
created: 2026-10-24
updated: 2026-10-24
type: feature
status: deferred
priority: normal
provenance: other
---

# Native client on the person's computer: local files and computer use without cloud sync

## Description

## Description

Jari, 2026-10-24, while weighing the cloud-folder bridge (`proto-cloud-folder-bridge`, now deferred): "Jossain vaiheessa ajattelin vaihtaa web-liittymän natiiviin softaan. Silloin tätä ei tarvitse temppuilla, ja voimme jopa passata computer usen sen läpi."

A native client on the person's own computer (alongside or instead of the browser UI) could reach local files (Downloads, Desktop, screenshots) and offer computer use to the person's agents on the host, without cloud sync. This is a product and architecture direction, not scheduled work: it changes what runs on the person's machine, what the host may ask of it, and the security model (today only the browser talks to the gateway; Unix users on the host are the boundary). Needs Jari's decision on direction and timing before any design or prototype.

## Acceptance Criteria

- [ ] Jari decides whether and when to explore; if yes, a research/decision issue (platforms, authority model, what the host may request, how it coexists with the browser).

## Decisions

### 2026-10-24T15:43:17Z · @jari

Jari 2026-10-24: deferred until the browser UI has started to stabilise.
