---
created: 2026-11-22
updated: 2026-11-23
type: improvement
reporter: jari
status: done
priority: normal
provenance: chat
source_ref: habitat:pi-current/2026-11-22-night-visible
lane: attention-night
lane_seq: 1
preparation: ready
closed: 2026-11-23
---

# Prototype: show clearly when sounds are off because of night quiet

## Description

Jari (22.11.2026): sounds were silent because night quiet follows the device's dark mode, and nothing said so. The Settings page should clearly say at the top that sounds are off because it is night. Prototype how night quiet is shown (and, as a direction, what defines night: dark mode vs clock).

## Decisions

### 2026-11-22T16:43:58Z · @jari

Jari 22.11.2026 on round 1: C (A's status line at the top of Sounds, night defined by a clock window, default 22–7) — 'really good'. No one-night 'Soita silti' override: the action in the status line changes the setting permanently (turns night quiet off / edits the window). Showing 'Tämä laite on mykistetty' and 'Äänet ovat pois kaikilta laitteilta' on the same top status line: riff in round 2. Not answered, so C's default: the device dark mode is no longer a meaning of night. Implementation: attention-sound-night-clock-impl.

### 2026-11-22T17:31:09Z · @jari

Jari 22.11.2026 on round 2: B Kaikki syyt — the top status line lists every active reason (all devices off, this device muted, night) each with its own permanent fix; drop 'Kuuntelu toimii silti' from the off line. Account menu wording: pending (question re-explained). Implementation: attention-sound-status-all-reasons.

## Resolution

### 2026-11-23T06:07:19Z · @issuectl

The remaining account-menu question was approved on 2026-11-23 and is implemented: shared all-reasons status and permanent fixes, verified in Finnish/English at desktop and phone widths.
