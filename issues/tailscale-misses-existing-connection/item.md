---
created: 2026-11-22
updated: 2026-11-22
type: bug
reporter: jari
status: fixed
priority: normal
provenance: chat
source_ref: habitat:pi-current/2026-11-22-tailscale-existing
lane: unlaned
preparation: ready
closed: 2026-11-22
---

# Tailscale integration does not notice the device is already on the tailnet

## Description

Jari (22.11.2026): the Tailscale integration did not notice that the person's device was already connected to the tailnet; it still offered the join flow (QR code) instead of recognising the existing connection.
Next action (defect analysis, then fix).

## Comments

### 2026-11-22T18:01:25Z · @jari

Where: our own household installation (v0.1.4), the second person's account, on her laptop's browser. Goal: her agents can reach her own computer over Tailscale (Settings › Omat koneet).
