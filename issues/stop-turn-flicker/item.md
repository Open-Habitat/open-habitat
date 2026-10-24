---
created: 2026-10-24
updated: 2026-10-24
type: bug
status: open
priority: normal
preparation: ready
lane: unlaned
collision: [web/src/components/composer]
---

# Pysäytä: slow stop with banners, state-check button and flicker before the text returns

## Description

Jari, 2026-10-24 (test server, 0.0.0-pilot.364): pressing *Pysäytä* while the agent works does return the unsent text to the composer, but through "sata vaihetta ja vilkkumista": a *Tarkasta keskustelun tila* button appears, a banner appears, the text comes back to the field, etc., and all of it is slow.

Goal: stopping is one calm, fast transition. After the person confirms the stop, the composer shows the stop as in progress once, the turn ends, and the text (if any) is back in the field — without intermediate banners, a state-check button or layout jumps, unless the stop actually failed or its outcome is genuinely unknown (then one clear message). Find where the time goes (gateway/daemon stop path, event stream, state re-read) and why intermediate states render; fix both the latency and the flicker. Keep the existing explicit stop confirmation and the guarantee that unsent text is never lost.

## Acceptance Criteria

- [ ] Measured stop-to-idle time before/after in result.md (host-backed browser test against a real Pi turn or the existing slow-turn fixture).
- [ ] Browser spec asserting no intermediate banner/state-check button on a successful stop, text restored, and a failure path still reported.
- [ ] KOKEILTAVAA.md line.
