---
created: 2026-11-24
updated: 2026-11-24
type: bug
status: untriaged
priority: low
provenance: agent
source_ref: taskfleet:01m85ars0xxa88g6mmj6wb118f/observation:onboarding-abort-layout-shift
originating_run: 01m85ars0xxa88g6mmj6wb118f
originating_run_kind: spinoff
---

# Onboarding's abort button moves when the Git step finishes reading

## Description

## Observed

In onboarding's Git step, the panel first shows a one-line "checking Git
settings" state. When the settings have been read, the panel grows by the
identity summary and its continue button, and the "abort onboarding and sign
out" button below the panel moves down by about 40 CSS pixels.

A browser test met this under load: it measured the abort button while the
panel was still reading, the panel then grew, and the click landed in the
empty space where the button had been. No confirmation opened. The test now
waits for the step's action first (`web/tests/pi-onboarding-race.spec.ts`).

## Why it matters to a person

The step opens on every onboarding visit and on reload, so the shift happens
whenever someone reaches for the abort button as the page arrives. The
continue button appears just above the abort button's old position, a few
pixels from it: a click aimed at the top of the abort button as the panel
grows can continue onboarding instead of abandoning it, and a click aimed at
its middle does nothing.

## Reproduce

1. Start onboarding with a synthetic GitHub account that has a Git identity.
2. Reload the Git step with CPU throttling (DevTools, 4× or more).
3. Watch the abort button while the panel shows its reading state, then its
   identity: the button moves down by the height the panel gained.

## Direction

Reserve the panel's settled height while it reads, or place the abort action
where the panel's growth does not move it.
