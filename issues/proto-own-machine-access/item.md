---
created: 2026-10-29
updated: 2026-10-29
type: feature
reporter: jari
status: open
priority: normal
lane: own-machine
lane_seq: 2
preparation: ready
---

# Prototype: managing access to my own computer in the UI

_Source: chat_

## Description

Jari 29.10.: prototype rounds for managing access to the person's own computer over Tailscale + SSH in the UI, after `research-own-machine-access` (its result names the surfaces). Method as design-system/prototypes: 2–3 directions on one axis, production context, desktop and phone, light and dark, synthetic data, one offline file.

## Decisions

### 2026-10-29T15:14:04Z · @jari

Jari 29.10.: (1) The agent gets everything the person's user has on that machine: this is exactly the principle. (2) The server's root can technically use the grant: accepted, that is how it is. (3) There is no pause button to promise; the UI does not offer a pause that does not really stop the agent. (4) Birch's host-wide tailnet membership is intentional (the whole Birch service sits behind Tailscale) and is not the normal model; the product's per-user Tailscale is.
